"""Redemption Code API.

Endpoints:
  POST /discounts/redeem  — validate & apply a redemption code to current user

Business rules (server-authoritative):
  1. Code must exist in redeem_codes and is_active=true.
  2. Code must not be expired (expires_at IS NULL or > now).
  3. Code must not have used_count >= max_uses.
  4. User must not have redeemed the same code before (redeem_logs).
  5. Apply effect based on code.type:
     - tier_pro / tier_pro_plus / tier_ultra → UPDATE user_profiles.tier + tier_expires_at
     - student_verify → UPDATE user_profiles.is_student_verified = true
  6. Write to redeem_logs and increment redeem_codes.used_count.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from supabase._async.client import AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["discounts"])

# Map code type → target tier value
_TIER_MAP: dict[str, str] = {
    "tier_pro": "pro",
    "tier_pro_plus": "pro_plus",
    "tier_ultra": "ultra",
}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class RedeemRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=64, description="兑换码（大写）")


class RedeemResult(BaseModel):
    code: str
    type: str
    tier: str | None = None            # New tier applied, None for student_verify
    tier_expires_at: str | None = None # ISO 8601 UTC, None if no expiry
    is_student_verified: bool = False
    duration_days: int | None = None
    message: str


# ---------------------------------------------------------------------------
# Helper: apply membership tier upgrade
# ---------------------------------------------------------------------------

async def _apply_tier_upgrade(
    db: AsyncClient,
    user_id: str,
    target_tier: str,
    duration_days: int,
    current_tier: str,
    current_expires_at: str | None,
) -> str:
    """Extend or set the user's tier. Returns the new tier_expires_at ISO string."""
    now = datetime.now(timezone.utc)

    _TIER_RANK = {"free": 0, "pro": 1, "pro_plus": 2, "ultra": 3}
    target_rank = _TIER_RANK.get(target_tier, 0)
    current_rank = _TIER_RANK.get(current_tier, 0)

    # Determine base time for duration extension
    if target_rank == current_rank and current_expires_at:
        # Same tier — extend from current expiry
        try:
            base = max(
                now,
                datetime.fromisoformat(current_expires_at.replace("Z", "+00:00")),
            )
        except ValueError:
            base = now
    else:
        # Upgrade (or downgrade is not done) — always start fresh from now
        base = now

    new_expiry = base + timedelta(days=duration_days)
    new_expiry_iso = new_expiry.isoformat()

    await (
        db.table("user_profiles")
        .update({
            "tier": target_tier,
            "tier_expires_at": new_expiry_iso,
            "updated_at": now.isoformat(),
        })
        .eq("id", user_id)
        .execute()
    )
    logger.info(
        "Tier upgrade applied: user=%s tier=%s expires=%s",
        user_id, target_tier, new_expiry_iso,
    )
    return new_expiry_iso


# ---------------------------------------------------------------------------
# Helper: apply student verification
# ---------------------------------------------------------------------------

async def _apply_student_verify(db: AsyncClient, user_id: str) -> None:
    now = datetime.now(timezone.utc)
    await (
        db.table("user_profiles")
        .update({
            "is_student_verified": True,
            "student_verified_at": now.isoformat(),
            "updated_at": now.isoformat(),
        })
        .eq("id", user_id)
        .execute()
    )
    logger.info("Student verification applied: user=%s", user_id)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/redeem", response_model=RedeemResult, status_code=200)
async def redeem_code(
    body: RedeemRequest,
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> RedeemResult:
    """Validate and apply a redemption code for the current user."""
    user_id = user["id"]
    code = body.code.strip().upper()

    # ── 1. Fetch the code record ──────────────────────────────────────────
    try:
        code_res = (
            await db.table("redeem_codes")
            .select("*")
            .eq("code", code)
            .eq("is_active", True)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to query redeem_codes: %s", exc)
        raise HTTPException(status_code=500, detail="兑换码查询失败，请稍后重试")

    if not code_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="兑换码无效或已停用",
        )

    rec = code_res.data
    now = datetime.now(timezone.utc)

    # ── 2. Check expiry ───────────────────────────────────────────────────
    if rec.get("expires_at"):
        try:
            expires = datetime.fromisoformat(rec["expires_at"].replace("Z", "+00:00"))
        except ValueError:
            expires = None
        if expires and now > expires:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="该兑换码已过期",
            )

    # ── 3. Check usage limit ──────────────────────────────────────────────
    if rec.get("max_uses") is not None and rec.get("used_count", 0) >= rec["max_uses"]:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="该兑换码已达到使用上限",
        )

    # ── 4. Check duplicate redemption by this user ────────────────────────
    try:
        dup_res = (
            await db.table("redeem_logs")
            .select("id", count="exact", head=True)
            .eq("user_id", user_id)
            .eq("code", code)
            .execute()
        )
        if (dup_res.count or 0) > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="您已使用过该兑换码，每人限兑一次",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to check redeem_logs: %s", exc)
        raise HTTPException(status_code=500, detail="兑换校验失败，请稍后重试")

    # ── 5. Fetch current user tier for smart extension ────────────────────
    try:
        profile_res = (
            await db.table("user_profiles")
            .select("tier, tier_expires_at")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        profile = profile_res.data or {}
    except Exception:
        profile = {}

    current_tier: str = profile.get("tier", "free")
    current_expires: str | None = profile.get("tier_expires_at")

    # ── 6. Apply the effect ───────────────────────────────────────────────
    code_type: str = rec.get("type", "")
    duration_days: int = rec.get("duration_days") or 30
    new_tier: str | None = None
    new_expires: str | None = None
    is_student = False

    try:
        if code_type in _TIER_MAP:
            new_tier = _TIER_MAP[code_type]
            new_expires = await _apply_tier_upgrade(
                db, user_id, new_tier, duration_days, current_tier, current_expires
            )
        elif code_type == "student_verify":
            is_student = True
            await _apply_student_verify(db, user_id)
        else:
            logger.warning("Unknown redeem code type '%s' for code '%s'", code_type, code)
            raise HTTPException(status_code=500, detail="兑换码类型暂不支持，请联系客服")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to apply redeem effect: %s", exc)
        raise HTTPException(status_code=500, detail="权益写入失败，请重试")

    # ── 7. Write audit log ────────────────────────────────────────────────
    try:
        await db.table("redeem_logs").insert({
            "user_id": user_id,
            "code": code,
            "type": code_type,
            "multiplier": str(rec.get("multiplier", "1.00")),
            "duration_days": duration_days if code_type in _TIER_MAP else None,
            "expires_at": new_expires,
            "redeemed_at": now.isoformat(),
        }).execute()
    except Exception as exc:
        logger.exception("Failed to write redeem_logs: %s", exc)
        # Non-blocking — don't fail the user interaction

    # ── 8. Increment usage counter via DB function ────────────────────────
    try:
        await db.rpc("increment_redeem_used_count", {"p_code": code}).execute()
    except Exception as exc:
        logger.warning("Failed to increment redeem used_count for %s: %s", code, exc)

    # ── 9. Build response ─────────────────────────────────────────────────
    if is_student:
        message = "学生认证成功！您现在可以享受学生专属权益"
    else:
        tier_label = {"pro": "Pro", "pro_plus": "Pro+", "ultra": "Ultra"}.get(new_tier or "", new_tier or "")
        message = f"{tier_label} 会员已激活，有效期 {duration_days} 天，感谢您的支持！"

    return RedeemResult(
        code=code,
        type=code_type,
        tier=new_tier,
        tier_expires_at=new_expires,
        is_student_verified=is_student,
        duration_days=duration_days if code_type in _TIER_MAP else None,
        message=message,
    )
