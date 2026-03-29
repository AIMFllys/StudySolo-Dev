"""Current user profile route: /api/auth/me."""

from fastapi import APIRouter, Depends
from supabase import AsyncClient

from app.core.deps import get_current_user, get_supabase_client
from app.models.user import UserInfo

router = APIRouter()


@router.get("/me", response_model=UserInfo)
async def me(current_user: dict = Depends(get_current_user), db: AsyncClient = Depends(get_supabase_client)):
    try:
        result = await db.from_("user_profiles").select("*").eq("id", current_user["id"]).single().execute()
        row = result.data or {}
    except Exception:
        row = {}
    return UserInfo(
        id=current_user["id"],
        email=current_user.get("email") or row.get("email", ""),
        name=row.get("nickname"),
        avatar_url=row.get("avatar_url"),
        role=current_user.get("role", "user"),
        tier=row.get("tier", "free"),
        tier_expires_at=row.get("tier_expires_at"),
    )
