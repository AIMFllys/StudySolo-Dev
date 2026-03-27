"""User consent management routes.

Handles:
- Cookie consent preference (essential / all)
- ToS re-signing for existing users (triggered when tos_accepted_at is NULL)
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.core.deps import get_current_user, get_supabase_client
from app.models.user import (
    CURRENT_PRIVACY_VERSION,
    CURRENT_TOS_VERSION,
    ConsentUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/consent")
async def update_consent(
    body: ConsentUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Record user consent choices.

    Handles three types of consent in one call:
    - Cookie consent level (essential / all)
    - ToS re-signing (for existing users with NULL tos_accepted_at)
    - Privacy policy re-signing
    """
    user_id = current_user["id"]
    now = datetime.now(timezone.utc).isoformat()
    updates: dict = {}

    if body.cookie_consent_level is not None:
        updates["cookie_consent_at"] = now
        updates["cookie_consent_level"] = body.cookie_consent_level

    if body.agreed_to_terms is True:
        updates["tos_accepted_at"] = now
        updates["tos_version"] = CURRENT_TOS_VERSION

    if body.agreed_to_privacy is True:
        updates["privacy_accepted_at"] = now
        updates["privacy_version"] = CURRENT_PRIVACY_VERSION

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未提供任何同意选项",
        )

    try:
        await db.from_("user_profiles").update(updates).eq("id", user_id).execute()
    except Exception as exc:
        logger.exception("Failed to update consent for user %s", user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="同意记录保存失败，请重试",
        ) from exc

    return {"message": "同意记录已更新", "updated": list(updates.keys())}


@router.get("/consent/status")
async def get_consent_status(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Return current consent status for the authenticated user.

    Frontend uses this to decide whether to show:
    - Cookie banner (cookie_consent_at is NULL)
    - ToS re-sign prompt (tos_accepted_at is NULL or version mismatch)
    """
    user_id = current_user["id"]
    try:
        result = (
            await db.from_("user_profiles")
            .select("tos_accepted_at,tos_version,privacy_accepted_at,privacy_version,cookie_consent_at,cookie_consent_level")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        row = result.data or {}
    except Exception:
        row = {}

    return {
        "needs_tos": row.get("tos_accepted_at") is None or row.get("tos_version") != CURRENT_TOS_VERSION,
        "needs_privacy": row.get("privacy_accepted_at") is None or row.get("privacy_version") != CURRENT_PRIVACY_VERSION,
        "needs_cookie_consent": row.get("cookie_consent_at") is None,
        "tos_version": row.get("tos_version"),
        "cookie_consent_level": row.get("cookie_consent_level"),
        "current_tos_version": CURRENT_TOS_VERSION,
        "current_privacy_version": CURRENT_PRIVACY_VERSION,
    }
