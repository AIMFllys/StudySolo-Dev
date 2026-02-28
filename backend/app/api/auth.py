"""Authentication routes: /api/auth/*"""

import os
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from supabase import AsyncClient

from app.core.deps import get_current_user, get_supabase_client
from app.models.user import UserInfo, UserLogin, UserRegister

router = APIRouter()

# Cookie settings — secure=False in development so cookies work over HTTP
_IS_DEV = os.getenv("ENVIRONMENT", "development").lower() == "development"
_COOKIE_OPTS = dict(
    httponly=True,
    secure=not _IS_DEV,
    samesite="lax",
    path="/",
)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: UserRegister,
    db: AsyncClient = Depends(get_supabase_client),
):
    """Create a new user and trigger email verification."""
    try:
        result = await db.auth.sign_up({"email": body.email, "password": body.password})
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=repr(exc))

    if result.user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="注册失败，请检查邮箱格式或密码强度",
        )

    return {"message": "注册成功，请查收验证邮件"}


@router.post("/login")
async def login(
    body: UserLogin,
    response: Response,
    db: AsyncClient = Depends(get_supabase_client),
):
    """Validate credentials and set HttpOnly cookies."""
    try:
        result = await db.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        )

    if result.session is None or result.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="邮箱或密码错误"
        )

    session = result.session
    user = result.user

    response.set_cookie(key="access_token", value=session.access_token, **_COOKIE_OPTS)
    response.set_cookie(key="refresh_token", value=session.refresh_token, **_COOKIE_OPTS)

    user_meta = user.user_metadata or {}
    return {
        "access_token": session.access_token,
        "user": UserInfo(
            id=str(user.id),
            email=user.email or "",
            name=user_meta.get("name") or user_meta.get("full_name"),
            avatar_url=user_meta.get("avatar_url"),
            role=user_meta.get("role", "user"),
        ),
    }


@router.post("/logout")
async def logout(
    response: Response,
    db: AsyncClient = Depends(get_supabase_client),
    access_token: Annotated[str | None, Cookie()] = None,
):
    """Invalidate the session and clear auth cookies."""
    if access_token:
        try:
            await db.auth.sign_out()
        except Exception:
            pass  # Best-effort; always clear cookies

    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "已退出登录"}


@router.post("/refresh")
async def refresh(
    response: Response,
    db: AsyncClient = Depends(get_supabase_client),
    refresh_token: Annotated[str | None, Cookie()] = None,
):
    """Use the refresh_token cookie to obtain a new access_token."""
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="缺少 refresh_token"
        )

    try:
        result = await db.auth.refresh_session(refresh_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        )

    if result.session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token 刷新失败"
        )

    session = result.session
    response.set_cookie(key="access_token", value=session.access_token, **_COOKIE_OPTS)
    response.set_cookie(key="refresh_token", value=session.refresh_token, **_COOKIE_OPTS)
    return {"message": "Token 已刷新"}


@router.get("/me", response_model=UserInfo)
async def me(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Return the current authenticated user's info."""
    try:
        result = await db.from_("users").select("*").eq("id", current_user["id"]).single().execute()
        row = result.data or {}
    except Exception:
        row = {}

    return UserInfo(
        id=current_user["id"],
        email=current_user.get("email") or row.get("email", ""),
        name=row.get("name"),
        avatar_url=row.get("avatar_url"),
        role=row.get("role", current_user.get("role", "user")),
    )
