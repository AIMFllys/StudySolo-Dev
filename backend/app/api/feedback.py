"""User feedback API.

Endpoints:
  POST /feedback       — submit feedback + auto-grant membership reward
  GET  /feedback/mine  — list current user's own feedback history
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase._async.client import AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["feedback"])

REWARD_DAYS = 3  # base reward days per feedback


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class FeedbackCreateRequest(BaseModel):
    """用户提交反馈的请求体."""
    rating: int = Field(..., ge=1, le=5, description="满意度评分 1-5")
    issue_type: str = Field(default="", max_length=100)
    content: str = Field(..., min_length=5, max_length=2000)


class FeedbackResponse(BaseModel):
    """反馈提交后的响应."""
    id: str
    reward_days: int
    message: str


class FeedbackItem(BaseModel):
    """单条反馈记录."""
    id: str
    rating: int
    issue_type: str
    content: str
    reward_days: int
    created_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _grant_membership_reward(
    db: AsyncClient,
    user_id: str,
    days: int,
) -> None:
    """Extend user tier to 'pro' for N days (or extend existing expiry)."""
    try:
        profile = (
            await db.table("user_profiles")
            .select("tier, tier_expires_at")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        data = profile.data or {}
        current_tier = data.get("tier", "free")
        current_expiry = data.get("tier_expires_at")

        now = datetime.now(timezone.utc)
        if current_tier == "pro" and current_expiry:
            base = max(
                now,
                datetime.fromisoformat(current_expiry.replace("Z", "+00:00")),
            )
        else:
            base = now

        new_expiry = base + timedelta(days=days)

        await (
            db.table("user_profiles")
            .update({
                "tier": "pro",
                "tier_expires_at": new_expiry.isoformat(),
                "updated_at": now.isoformat(),
            })
            .eq("id", user_id)
            .execute()
        )
        logger.info(
            "Granted %d-day pro to user %s, expires %s",
            days, user_id, new_expiry.isoformat(),
        )
    except Exception as exc:
        logger.exception("Failed to grant membership reward: %s", exc)
        # Don't fail the feedback submission if reward fails
        raise


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("", response_model=FeedbackResponse)
async def submit_feedback(
    body: FeedbackCreateRequest,
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> FeedbackResponse:
    """Submit user feedback and auto-grant membership reward."""
    user_id = user["id"]
    email = user.get("email", "")

    # Fetch nickname
    nickname = ""
    try:
        profile = (
            await db.table("user_profiles")
            .select("nickname")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        nickname = (profile.data or {}).get("nickname", "")
    except Exception:
        pass

    # Insert feedback record
    try:
        result = (
            await db.table("ss_feedback")
            .insert({
                "user_id": user_id,
                "user_email": email,
                "user_nickname": nickname or "",
                "rating": body.rating,
                "issue_type": body.issue_type,
                "content": body.content,
                "reward_days": REWARD_DAYS,
                "reward_applied": False,
            })
            .execute()
        )
        row = (result.data or [{}])[0]
        feedback_id = row.get("id", "")
    except Exception as exc:
        logger.exception("Failed to insert feedback: %s", exc)
        raise HTTPException(status_code=500, detail="反馈提交失败，请稍后重试")

    # Grant membership reward
    try:
        await _grant_membership_reward(db, user_id, REWARD_DAYS)
        await (
            db.table("ss_feedback")
            .update({"reward_applied": True})
            .eq("id", feedback_id)
            .execute()
        )
    except Exception:
        pass  # reward failure is non-blocking

    return FeedbackResponse(
        id=feedback_id,
        reward_days=REWARD_DAYS,
        message=f"感谢反馈！已赠送 {REWARD_DAYS} 天高级会员",
    )


@router.get("/mine", response_model=list[FeedbackItem])
async def list_my_feedback(
    user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> list[FeedbackItem]:
    """List the current user's feedback history."""
    try:
        result = (
            await db.table("ss_feedback")
            .select("id, rating, issue_type, content, reward_days, created_at")
            .eq("user_id", user["id"])
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        return [
            FeedbackItem(
                id=r["id"],
                rating=r["rating"],
                issue_type=r.get("issue_type", ""),
                content=r["content"],
                reward_days=r.get("reward_days", 0),
                created_at=str(r["created_at"]),
            )
            for r in (result.data or [])
        ]
    except Exception as exc:
        logger.exception("Failed to list feedback: %s", exc)
        raise HTTPException(status_code=500, detail="获取反馈历史失败")
