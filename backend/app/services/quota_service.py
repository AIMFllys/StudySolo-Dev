"""User resource quota computation.

Single source of truth for all tier-based limits and addon calculations.
Used by workflow.create_workflow to enforce hard limits, and by
/api/usage/quota to expose quota data to the frontend.
"""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from supabase import AsyncClient

# ── Timezone ─────────────────────────────────────────────────────────────────
CST = timezone(timedelta(hours=8))  # Beijing time — quota resets at CST 00:00

# ── Tier limits ──────────────────────────────────────────────────────────────

# Tier → max workflow count mapping (matches vip-01-membership-system-design.md §2.1)
TIER_WORKFLOW_LIMITS: dict[str, int] = {
    "free": 10,
    "pro": 50,
    "pro_plus": 200,
    "ultra": 9_999_999,  # Treated as unlimited in UI
}

# Tier → daily AI chat request limits
TIER_DAILY_CHAT_LIMITS: dict[str, int] = {
    "free": 100,
    "pro": 200,
    "pro_plus": 500,
    "ultra": 2000,
}

# Tier → daily workflow execution limits (matches Upgrade page)
TIER_DAILY_EXECUTION_LIMITS: dict[str, int] = {
    "free": 20,
    "pro": 50,
    "pro_plus": 150,
    "ultra": 500,
}

# Tier → max loop iterations per execution
TIER_LOOP_ITERATION_LIMITS: dict[str, int] = {
    "free": 5,
    "pro": 20,
    "pro_plus": 100,
    "ultra": 9_999_999,  # Treated as unlimited
}

# Fallback SKU when user exceeds daily AI chat quota
QUOTA_EXCEEDED_FALLBACK_SKU_ID = "sku_dashscope_qwen_turbo_native"


async def get_workflow_quota(user_id: str, tier: str, db: AsyncClient) -> dict:
    """Compute workflow quota for a user.

    Returns:
        {
            "used": int,
            "base_limit": int,
            "addon_qty": int,
            "total_limit": int,
            "remaining": int,
        }
    """
    base = TIER_WORKFLOW_LIMITS.get(tier, 10)

    # Ultra users skip DB queries — they are unlimited
    if tier == "ultra":
        count_res = (
            await db.from_("ss_workflows")
            .select("id", count="exact", head=True)
            .eq("user_id", user_id)
            .execute()
        )
        used = count_res.count or 0
        return {
            "used": used,
            "base_limit": base,
            "addon_qty": 0,
            "total_limit": base,
            "remaining": base,
        }

    # Sum active, non-expired workflow addon quantities
    addon_res = (
        await db.from_("addon_purchases")
        .select("quantity")
        .eq("user_id", user_id)
        .eq("addon_type", "workflows")
        .eq("status", "active")
        .gt("expires_at", "now()")
        .execute()
    )
    addon_qty = sum(r["quantity"] for r in (addon_res.data or []))
    total = base + addon_qty

    # Count actual workflows via DB (service_role bypasses RLS for accuracy)
    count_res = (
        await db.from_("ss_workflows")
        .select("id", count="exact", head=True)
        .eq("user_id", user_id)
        .execute()
    )
    used = count_res.count or 0

    return {
        "used": used,
        "base_limit": base,
        "addon_qty": addon_qty,
        "total_limit": total,
        "remaining": max(0, total - used),
    }


async def assert_workflow_quota(user_id: str, tier: str, db: AsyncClient) -> None:
    """Raise HTTP 403 if the user has no remaining workflow slots.

    Call this before any ss_workflows INSERT to enforce hard quota limits.
    """
    if tier == "ultra":
        return  # Unlimited — skip check entirely

    quota = await get_workflow_quota(user_id, tier, db)
    if quota["remaining"] <= 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "WORKFLOW_QUOTA_EXCEEDED",
                "message": "工作流数量已达上限，请升级会员或购买增值包",
                "used": quota["used"],
                "total_limit": quota["total_limit"],
                "tier": tier,
            },
        )


# ── Daily quota helpers ──────────────────────────────────────────────────────

def _get_cst_today_start_utc() -> str:
    """Return today 00:00:00 CST as a UTC ISO-8601 string for DB queries."""
    now_cst = datetime.now(CST)
    today_start_cst = now_cst.replace(hour=0, minute=0, second=0, microsecond=0)
    return today_start_cst.astimezone(timezone.utc).isoformat()


async def _count_daily_requests(
    db: AsyncClient,
    user_id: str,
    source_type: str,
) -> int:
    """Count today's requests for a given source_type (CST timezone)."""
    today_start = _get_cst_today_start_utc()
    result = (
        await db.from_("ss_ai_requests")
        .select("id", count="exact", head=True)
        .eq("user_id", user_id)
        .eq("source_type", source_type)
        .gte("started_at", today_start)
        .execute()
    )
    return result.count or 0


async def check_daily_chat_quota(
    user_id: str,
    tier: str,
    db: AsyncClient,
) -> dict:
    """Check whether the user can make AI chat requests today.

    Returns:
        {
            "allowed": bool,
            "used": int,
            "limit": int,
            "fallback_sku_id": str | None,
        }
    """
    limit = TIER_DAILY_CHAT_LIMITS.get(tier, TIER_DAILY_CHAT_LIMITS["free"])
    used = await _count_daily_requests(db, user_id, "assistant")
    allowed = used < limit
    return {
        "allowed": allowed,
        "used": used,
        "limit": limit,
        "fallback_sku_id": None if allowed else QUOTA_EXCEEDED_FALLBACK_SKU_ID,
    }


async def check_daily_execution_quota(
    user_id: str,
    tier: str,
    db: AsyncClient,
) -> dict:
    """Check whether the user can execute workflows today.

    Returns:
        {
            "allowed": bool,
            "used": int,
            "limit": int,
        }
    """
    limit = TIER_DAILY_EXECUTION_LIMITS.get(tier, TIER_DAILY_EXECUTION_LIMITS["free"])
    used = await _count_daily_requests(db, user_id, "workflow")
    return {
        "allowed": used < limit,
        "used": used,
        "limit": limit,
    }

