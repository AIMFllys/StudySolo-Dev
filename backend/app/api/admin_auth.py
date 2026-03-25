"""Admin Authentication API.

Endpoints:
  POST /admin/login           — bcrypt verify, sign JWT (2h), set HttpOnly Cookie
  POST /admin/logout          — clear Cookie, record audit log
  POST /admin/change-password — password complexity validation, bcrypt update
"""

import logging
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from jose import jwt
from supabase._async.client import AsyncClient

from app.core.config import get_settings
from app.core.database import get_db
from app.models.admin import (
    AdminLogin,
    AdminLoginResponse,
    AdminProfile,
    ChangePasswordRequest,
)
from app.services.audit_logger import get_client_info, queue_audit_log

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin-auth"])

# Cookie configuration
COOKIE_NAME = "admin_token"
COOKIE_MAX_AGE = 2 * 3600  # 2 hours in seconds
JWT_EXPIRY_HOURS = 2
LOCK_DURATION_MINUTES = 30
MAX_FAILED_ATTEMPTS = 5


def _sign_jwt(admin_id: str, username: str) -> str:
    """Sign an admin JWT token with a short-lived expiry."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": admin_id,
        "username": username,
        "exp": now + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": now,
        "type": "admin",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _set_admin_cookie(response: Response, token: str) -> None:
    """Set the admin_token HttpOnly cookie on the response."""
    settings = get_settings()
    is_production = settings.environment == "production"
    # Clear any legacy root-path cookie before issuing the scoped admin cookie.
    response.delete_cookie(key=COOKIE_NAME, path="/")
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_production,
        samesite="strict",
        max_age=COOKIE_MAX_AGE,
        path="/api/admin",
    )


def _clear_admin_cookie(response: Response) -> None:
    """Clear the admin_token cookie."""
    response.delete_cookie(key=COOKIE_NAME, httponly=True, samesite="strict", path="/")
    response.delete_cookie(key=COOKIE_NAME, httponly=True, samesite="strict", path="/api/admin")


@router.post("/login", response_model=AdminLoginResponse)
async def login(
    body: AdminLogin,
    request: Request,
    response: Response,
    db: AsyncClient = Depends(get_db),
) -> AdminLoginResponse:
    """Authenticate admin and issue JWT cookie.

    Returns 401 for invalid credentials, 423 if account is locked.
    """
    ip_address, user_agent = get_client_info(request)

    # 1. Query ss_admin_accounts by username
    result = (
        await db.table("ss_admin_accounts")
        .select("*")
        .eq("username", body.username)
        .maybe_single()
        .execute()
    )
    account = result.data if result else None

    # 2. Username not found — return 401 (don't reveal existence)
    if not account:
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_credentials", "remaining_attempts": 0},
        )

    # 3. Check if account is locked
    now = datetime.now(timezone.utc)
    locked_until = account.get("locked_until")
    if locked_until:
        locked_until_dt = datetime.fromisoformat(locked_until.replace("Z", "+00:00"))
        if locked_until_dt > now:
            queue_audit_log(
                db,
                admin_id=account["id"],
                action="login_rejected_locked",
                ip_address=ip_address,
                user_agent=user_agent,
            )
            raise HTTPException(
                status_code=423,
                detail={
                    "error": "account_locked",
                    "locked_until": locked_until_dt.isoformat(),
                },
            )

    # 4. Verify bcrypt password
    password_valid = bcrypt.checkpw(
        body.password.encode("utf-8"),
        account["password_hash"].encode("utf-8"),
    )

    if not password_valid:
        # Increment failed_attempts
        new_failed = account.get("failed_attempts", 0) + 1
        update_data: dict = {"failed_attempts": new_failed}

        if new_failed >= MAX_FAILED_ATTEMPTS:
            lock_until = now + timedelta(minutes=LOCK_DURATION_MINUTES)
            update_data["locked_until"] = lock_until.isoformat()

        await db.table("ss_admin_accounts").update(update_data).eq(
            "id", account["id"]
        ).execute()

        queue_audit_log(
            db,
            admin_id=account["id"],
            action="login_failed",
            details={"failed_attempts": new_failed},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        if new_failed >= MAX_FAILED_ATTEMPTS:
            raise HTTPException(
                status_code=423,
                detail={
                    "error": "account_locked",
                    "locked_until": (
                        now + timedelta(minutes=LOCK_DURATION_MINUTES)
                    ).isoformat(),
                },
            )

        remaining = MAX_FAILED_ATTEMPTS - new_failed
        raise HTTPException(
            status_code=401,
            detail={
                "error": "invalid_credentials",
                "remaining_attempts": remaining,
            },
        )

    # 5. Successful login — reset failed_attempts, update last_login
    await db.table("ss_admin_accounts").update(
        {
            "failed_attempts": 0,
            "locked_until": None,
            "last_login": now.isoformat(),
        }
    ).eq("id", account["id"]).execute()

    # 6. Sign JWT and set cookie
    token = _sign_jwt(account["id"], account["username"])
    _set_admin_cookie(response, token)

    # 7. Record audit log (fire-and-forget)
    queue_audit_log(
        db,
        admin_id=account["id"],
        action="login_success",
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return AdminLoginResponse(
        success=True,
        admin=AdminProfile(
            id=account["id"],
            username=account["username"],
            force_change_password=account.get("force_change_password", False),
        ),
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncClient = Depends(get_db),
) -> dict:
    """Clear admin_token cookie and record audit log."""
    ip_address, user_agent = get_client_info(request)

    # Extract admin_id from request state (set by AdminJWTMiddleware)
    admin_id: str | None = getattr(request.state, "admin_id", None)

    _clear_admin_cookie(response)

    queue_audit_log(
        db,
        admin_id=admin_id,
        action="logout",
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return {"message": "已退出登录"}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    db: AsyncClient = Depends(get_db),
) -> dict:
    """Change admin password with complexity validation.

    Requires valid current_password and new_password meeting complexity rules.
    Pydantic validates new_password complexity via ChangePasswordRequest validator.
    """
    ip_address, user_agent = get_client_info(request)

    # Get admin_id from middleware-injected state
    admin_id: str | None = getattr(request.state, "admin_id", None)
    if not admin_id:
        raise HTTPException(status_code=401, detail="管理员未认证")

    # Fetch current account record
    result = (
        await db.table("ss_admin_accounts")
        .select("id, username, password_hash")
        .eq("id", admin_id)
        .maybe_single()
        .execute()
    )
    account = result.data if result else None
    if not account:
        raise HTTPException(status_code=404, detail="管理员账号不存在")

    # Verify current password
    current_valid = bcrypt.checkpw(
        body.current_password.encode("utf-8"),
        account["password_hash"].encode("utf-8"),
    )
    if not current_valid:
        raise HTTPException(status_code=401, detail="当前密码不正确")

    # Hash new password with bcrypt (12 rounds)
    new_hash = bcrypt.hashpw(
        body.new_password.encode("utf-8"),
        bcrypt.gensalt(rounds=12),
    ).decode("utf-8")

    # Update password_hash and clear force_change_password
    await db.table("ss_admin_accounts").update(
        {
            "password_hash": new_hash,
            "force_change_password": False,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", admin_id).execute()

    # Record audit log (fire-and-forget)
    queue_audit_log(
        db,
        admin_id=admin_id,
        action="password_changed",
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return {"message": "密码修改成功"}
