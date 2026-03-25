"""Register and verification-code routes."""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from supabase import AsyncClient

from app.api.auth._helpers import (
    FRONTEND_URL,
    clear_rate_limit_failures,
    is_rate_limited,
    record_rate_limit_failure,
    resolve_client_ip,
)
from app.api.auth.captcha import consume_captcha_token
from app.core.deps import get_anon_supabase_client, get_supabase_client
from app.models.user import ForgotPasswordRequest, SendCodeRequest, UserRegister
from app.services.email_service import send_verification_code_to_email, verify_code

logger = logging.getLogger(__name__)

router = APIRouter()
_VERIFY_RATE_LIMIT_WINDOW_SECONDS = 10 * 60
_VERIFY_RATE_LIMIT_MAX_ATTEMPTS = 8


@router.post("/send-code")
async def send_code(
    body: SendCodeRequest,
    db: AsyncClient = Depends(get_supabase_client),
):
    """Send a 6-digit verification code after captcha validation."""
    if not await consume_captcha_token(body.captcha_token, db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="人机验证失败，请重新滑动滑块",
        )

    code_type = body.code_type if body.code_type in ("register", "reset_password") else "register"
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=60)).isoformat()
    recent = (
        await db.from_("verification_codes_v2")
        .select("id")
        .eq("email", body.email)
        .eq("type", code_type)
        .gte("created_at", cutoff)
        .limit(1)
        .execute()
    )
    if recent.data:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="发送太频繁，请 60 秒后再试",
        )

    try:
        await send_verification_code_to_email(body.email, code_type, db)
    except Exception as exc:
        logger.exception("Failed to send verification code")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="验证码发送失败，请稍后重试",
        ) from exc

    return {"message": "验证码已发送，请查收邮件"}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: UserRegister,
    request: Request,
    db: AsyncClient = Depends(get_supabase_client),
    anon_db: AsyncClient = Depends(get_anon_supabase_client),
):
    """Create a new user via Supabase Auth."""
    del anon_db
    client_ip = resolve_client_ip(request)
    email_bucket = f"register:{body.email.lower()}"
    ip_bucket = f"register-ip:{client_ip}"
    if await is_rate_limited(
        db, email_bucket, "register_verify_failure", _VERIFY_RATE_LIMIT_MAX_ATTEMPTS, _VERIFY_RATE_LIMIT_WINDOW_SECONDS
    ) or await is_rate_limited(
        db, ip_bucket, "register_verify_failure", _VERIFY_RATE_LIMIT_MAX_ATTEMPTS, _VERIFY_RATE_LIMIT_WINDOW_SECONDS
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="验证码校验过于频繁，请稍后再试",
        )

    is_valid = await verify_code(body.email, body.verification_code, "register", db)
    if not is_valid:
        await record_rate_limit_failure(
            db, email_bucket, "register_verify_failure", _VERIFY_RATE_LIMIT_WINDOW_SECONDS
        )
        await record_rate_limit_failure(
            db, ip_bucket, "register_verify_failure", _VERIFY_RATE_LIMIT_WINDOW_SECONDS
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码无效或已过期，请重新获取",
        )
    await clear_rate_limit_failures(db, "register_verify_failure", email_bucket, ip_bucket)

    try:
        result = await db.auth.admin.create_user(
            {
                "email": body.email,
                "password": body.password,
                "email_confirm": True,
                "user_metadata": {
                    "name": body.name or "",
                    "nickname": body.name or "",
                    "email_redirect_to": f"{FRONTEND_URL}/auth/callback",
                },
            }
        )
    except Exception as exc:
        detail = str(exc)
        if "already registered" in detail.lower() or "already been registered" in detail.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="该邮箱已注册，请直接登录或使用忘记密码功能",
            ) from exc
        if "unique" in detail.lower() or "duplicate" in detail.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="该邮箱已注册，请直接登录或使用忘记密码功能",
            ) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc

    if result.user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="注册失败，请检查邮箱格式或密码强度（至少 6 位）",
        )

    return {
        "message": "注册成功，可以直接登录",
        "confirmed": True,
    }


@router.post("/resend-verification")
async def resend_verification(
    body: ForgotPasswordRequest,
    anon_db: AsyncClient = Depends(get_anon_supabase_client),
):
    """Resend verification email for compatibility."""
    try:
        await anon_db.auth.resend(
            {
                "type": "signup",
                "email": body.email,
                "options": {"email_redirect_to": f"{FRONTEND_URL}/auth/callback"},
            }
        )
    except Exception:
        pass

    return {"message": "如果该邮箱已注册但未验证，你将收到一封新的验证邮件"}
