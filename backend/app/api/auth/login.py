"""Login, logout, refresh, and session sync routes."""

import logging
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from supabase import AsyncClient

from app.api.auth._helpers import clear_auth_cookies, set_auth_cookies
from app.core.deps import get_anon_supabase_client, get_supabase_client
from app.models.user import SyncSessionRequest, UserInfo, UserLogin

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/login")
async def login(
    body: UserLogin, response: Response,
    anon_db: AsyncClient = Depends(get_anon_supabase_client),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Validate credentials via Supabase Auth and set HttpOnly cookies."""
    try:
        result = await anon_db.auth.sign_in_with_password({"email": body.email, "password": body.password})
    except Exception as exc:
        detail = str(exc)
        if "email not confirmed" in detail.lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="邮箱尚未验证，请查收验证邮件并点击确认链接") from exc
        if "invalid" in detail.lower() or "credentials" in detail.lower():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="邮箱或密码错误") from exc
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录失败，请重试") from exc

    if result.session is None or result.user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="邮箱或密码错误")

    session = result.session
    user = result.user
    set_auth_cookies(response, session.access_token, session.refresh_token, body.remember_me)
    user_meta = user.user_metadata or {}

    try:
        profile = await db.from_("user_profiles").select("tier, nickname, avatar_url, tos_accepted_at, tos_version, cookie_consent_at").eq("id", str(user.id)).maybe_single().execute()
        row = profile.data or {}
    except Exception:
        row = {}

    from app.models.user import CURRENT_TOS_VERSION
    return {
        "access_token": session.access_token, "refresh_token": session.refresh_token,
        "needs_tos": row.get("tos_accepted_at") is None or row.get("tos_version") != CURRENT_TOS_VERSION,
        "needs_cookie_consent": row.get("cookie_consent_at") is None,
        "user": UserInfo(
            id=str(user.id), email=user.email or "",
            name=row.get("nickname") or user_meta.get("name") or user_meta.get("full_name"),
            avatar_url=row.get("avatar_url") or user_meta.get("avatar_url"),
            role=user_meta.get("role", "user"), tier=row.get("tier", "free"),
        ),
    }


@router.post("/logout")
async def logout(
    response: Response, db: AsyncClient = Depends(get_supabase_client),
    access_token: Annotated[str | None, Cookie()] = None,
):
    if access_token:
        try:
            await db.auth.sign_out()
        except Exception:
            pass
    clear_auth_cookies(response)
    return {"message": "已退出登录"}


@router.post("/refresh")
async def refresh(
    response: Response, anon_db: AsyncClient = Depends(get_anon_supabase_client),
    refresh_token: Annotated[str | None, Cookie()] = None,
    remember_me: Annotated[str | None, Cookie()] = None,
):
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="缺少 refresh_token")
    try:
        result = await anon_db.auth.refresh_session(refresh_token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if result.session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token 刷新失败")
    session = result.session
    set_auth_cookies(response, session.access_token, session.refresh_token, remember_me != "0")
    return {"message": "Token 已刷新", "access_token": session.access_token, "refresh_token": session.refresh_token}


@router.post("/sync-session")
async def sync_session(
    body: SyncSessionRequest, response: Response,
    anon_db: AsyncClient = Depends(get_anon_supabase_client),
    db: AsyncClient = Depends(get_supabase_client),
):
    try:
        result = await anon_db.auth.set_session(body.access_token, body.refresh_token)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="本地登录态已失效，请重新登录") from exc
    if result.session is None or result.user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="本地登录态已失效，请重新登录")

    session = result.session
    user = result.user
    set_auth_cookies(response, session.access_token, session.refresh_token, body.remember_me)
    user_meta = user.user_metadata or {}

    try:
        profile = await db.from_("user_profiles").select("tier, nickname, avatar_url").eq("id", str(user.id)).maybe_single().execute()
        row = profile.data or {}
    except Exception:
        row = {}

    return {
        "message": "登录状态已恢复", "access_token": session.access_token, "refresh_token": session.refresh_token,
        "user": UserInfo(
            id=str(user.id), email=user.email or "",
            name=row.get("nickname") or user_meta.get("name") or user_meta.get("full_name"),
            avatar_url=row.get("avatar_url") or user_meta.get("avatar_url"),
            role=user_meta.get("role", "user"), tier=row.get("tier", "free"),
        ),
    }
