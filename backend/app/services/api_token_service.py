"""Service helpers for Personal Access Tokens (ss_api_tokens).

Design notes:
- Plaintext tokens are generated as ``sk_studysolo_<32-byte token_urlsafe>``
  and are **only** returned from the creation endpoint. The database only
  stores the SHA-256 hex of the plaintext (``token_hash``).
- ``token_prefix`` (first 12 chars) is kept for UI display so users can tell
  tokens apart without exposing the full secret.
- ``verify_bearer`` is the hot path called on every authenticated request
  that uses Bearer authentication. We update ``last_used_at`` on a best-effort
  basis so the hot path stays cheap and non-blocking.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import TypedDict

from supabase import AsyncClient

logger = logging.getLogger(__name__)

TOKEN_PREFIX = "sk_studysolo_"
TOKEN_PREFIX_DISPLAY_LEN = 12  # 12 = "sk_studyso.." visible part for UI


class PatVerifyResult(TypedDict):
    """Shape returned by ``verify_bearer`` on success."""

    id: str            # ss_api_tokens.id
    user_id: str       # ss_api_tokens.user_id
    tier: str          # user_profiles.tier (fallback: "free")
    email: str         # auth.users.email (best-effort, may be "")


def generate_token() -> str:
    """Return a freshly-generated plaintext PAT."""
    return f"{TOKEN_PREFIX}{secrets.token_urlsafe(32)}"


def hash_token(plaintext: str) -> str:
    """Return the SHA-256 hex digest of ``plaintext`` (what the DB stores)."""
    return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def token_display_prefix(plaintext: str) -> str:
    """Return the short prefix shown in the UI (``sk_studyso..``)."""
    return plaintext[:TOKEN_PREFIX_DISPLAY_LEN]


async def create_token(
    db: AsyncClient,
    user_id: str,
    name: str,
    expires_in_days: int | None = None,
) -> tuple[str, dict]:
    """Create a new PAT for ``user_id``.

    Returns ``(plaintext, row)``. ``plaintext`` must be shown to the user
    exactly once; only ``row`` is ever safe to keep around.
    """
    plaintext = generate_token()
    row_payload: dict = {
        "user_id": user_id,
        "name": name,
        "token_hash": hash_token(plaintext),
        "token_prefix": token_display_prefix(plaintext),
    }
    if expires_in_days is not None:
        row_payload["expires_at"] = (
            datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        ).isoformat()

    result = await db.from_("ss_api_tokens").insert(row_payload).execute()
    if not result.data:
        raise RuntimeError("Failed to create API token: no row returned")
    return plaintext, result.data[0]


async def list_tokens(db: AsyncClient, user_id: str) -> list[dict]:
    """Return metadata for all non-revoked tokens owned by ``user_id``."""
    result = (
        await db.from_("ss_api_tokens")
        .select(
            "id,name,token_prefix,scopes,created_at,expires_at,last_used_at,revoked_at"
        )
        .eq("user_id", user_id)
        .is_("revoked_at", "null")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


async def revoke_token(db: AsyncClient, user_id: str, token_id: str) -> bool:
    """Hard-delete the given token (only if it belongs to ``user_id``)."""
    result = (
        await db.from_("ss_api_tokens")
        .delete()
        .eq("id", token_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(result.data)


async def verify_bearer(db: AsyncClient, plaintext: str) -> PatVerifyResult | None:
    """Validate a Bearer PAT and return the resolved user, or None.

    Silently returns None for any of: unknown hash, revoked, expired. This
    keeps the middleware path simple — the caller just raises 401.
    """
    if not plaintext.startswith(TOKEN_PREFIX):
        return None

    token_hash = hash_token(plaintext)
    try:
        result = (
            await db.from_("ss_api_tokens")
            .select("id,user_id,expires_at,revoked_at")
            .eq("token_hash", token_hash)
            .maybe_single()
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("PAT lookup failed: %s", exc)
        return None

    row = result.data if result else None
    if not row:
        return None

    if row.get("revoked_at"):
        return None

    expires_at = row.get("expires_at")
    if expires_at:
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp_dt < datetime.now(timezone.utc):
                return None
        except ValueError:
            # If the DB value is malformed we treat it as expired to be safe.
            return None

    user_id = str(row["user_id"])

    # Best-effort user details: tier (from user_profiles) + email (auth.users)
    tier = "free"
    email = ""
    try:
        profile = (
            await db.from_("user_profiles")
            .select("tier")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        if profile and profile.data:
            tier = profile.data.get("tier") or "free"
    except Exception:  # noqa: BLE001
        pass

    try:
        # ``auth.admin.get_user_by_id`` is available on supabase-py v2.
        auth_res = await db.auth.admin.get_user_by_id(user_id)
        if auth_res and getattr(auth_res, "user", None):
            email = auth_res.user.email or ""
    except Exception:  # noqa: BLE001
        pass

    # Fire-and-forget: update last_used_at on the hot path.
    asyncio.create_task(_touch_last_used(db, row["id"]))

    return {
        "id": str(row["id"]),
        "user_id": user_id,
        "tier": tier,
        "email": email,
    }


async def _touch_last_used(db: AsyncClient, token_id: str) -> None:
    """Update ``last_used_at`` asynchronously (best-effort)."""
    try:
        await (
            db.from_("ss_api_tokens")
            .update({"last_used_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", token_id)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.debug("Failed to update last_used_at for token %s: %s", token_id, exc)
