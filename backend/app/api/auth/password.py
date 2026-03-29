"""Password reset routes: forgot-password, reset-password, reset-password-with-code."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from supabase import AsyncClient

from app.api.auth._helpers import (
    clear_auth_cookies, clear_rate_limit_failures,
    is_rate_limited, record_rate_limit_failure, resolve_client_ip,
)
from app.core.deps import get_anon_supabase_client, get_supabase_client
from app.models.user import ForgotPasswordRequest, ResetPasswordRequest, ResetPasswordWithCodeRequest
from app.services.email_service import send_verification_code_to_email, verify_code

logger = logging.getLogger(__name__)
router = APIRouter()

_RESET_CODE_RATE_LIMIT_WINDOW_SECONDS = 10 * 60
_RESET_CODE_RATE_LIMIT_MAX_ATTEMPTS = 8


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncClient = Depends(get_supabase_client)):
    try:
        await send_verification_code_to_email(body.email, "reset_password", db)
    except Exception:
        pass
    return {"message": "如果该邮箱已注册，你将收到一封包含验证码的邮件"}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, response: Response, anon_db: AsyncClient = Depends(get_anon_supabase_client)):
    try:
        session_result = await anon_db.auth.set_session(body.access_token, body.refresh_token)
        if not session_result.session:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="重置链接无效或已过期")
        update_result = await anon_db.auth.update_user({"password": body.new_password})
        if not update_result.user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密码重置失败")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    clear_auth_cookies(response)
    return {"message": "密码重置成功，请使用新密码登录"}


@router.post("/reset-password-with-code")
async def reset_password_with_code(body: ResetPasswordWithCodeRequest, request: Request, db: AsyncClient = Depends(get_supabase_client)):
    client_ip = resolve_client_ip(request)
    email_bucket = f"reset-password:{body.email.lower()}"
    ip_bucket = f"reset-password-ip:{client_ip}"
    if await is_rate_limited(db, email_bucket, "reset_password_verify_failure", _RESET_CODE_RATE_LIMIT_MAX_ATTEMPTS, _RESET_CODE_RATE_LIMIT_WINDOW_SECONDS) or \
       await is_rate_limited(db, ip_bucket, "reset_password_verify_failure", _RESET_CODE_RATE_LIMIT_MAX_ATTEMPTS, _RESET_CODE_RATE_LIMIT_WINDOW_SECONDS):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="验证码校验过于频繁，请稍后再试")

    is_valid = await verify_code(body.email, body.code, "reset_password", db)
    if not is_valid:
        await record_rate_limit_failure(db, email_bucket, "reset_password_verify_failure", _RESET_CODE_RATE_LIMIT_WINDOW_SECONDS)
        await record_rate_limit_failure(db, ip_bucket, "reset_password_verify_failure", _RESET_CODE_RATE_LIMIT_WINDOW_SECONDS)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="验证码无效或已过期，请重新获取")
    await clear_rate_limit_failures(db, "reset_password_verify_failure", email_bucket, ip_bucket)

    try:
        result = await db.from_("user_profiles").select("id").eq("email", body.email).limit(1).execute()
        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="该邮箱未注册")
        await db.auth.admin.update_user_by_id(result.data[0]["id"], {"password": body.new_password})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Failed to reset password")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密码重置失败，请重试") from exc
    return {"message": "密码重置成功，请使用新密码登录"}
