"""Admin JWT middleware — protects /api/admin/* routes (except /login and OPTIONS).

Uses Pure ASGI middleware to avoid response body buffering (same reason as auth.py).
"""

import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import get_settings
from app.core.database import get_db

logger = logging.getLogger(__name__)

# Paths under /api/admin/ that are publicly accessible (no token required)
_PUBLIC_ADMIN_PATHS = {"/api/admin/login"}

# Loopback 主机白名单：开发模式下这些主机可免鉴权访问诊断等只读端点
_LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}

# 开发模式下允许 loopback 免鉴权的路径（严格限制为只读诊断）
_DEV_LOOPBACK_ALLOWED_PATHS = {"/api/admin/diagnostics/full"}


class AdminJWTMiddleware:
    """Validate admin_token cookie for all /api/admin/* routes.

    - Skips /api/admin/login and OPTIONS requests.
    - On valid token: attaches admin_id to scope state.
    - On invalid/expired token: returns 401.
    - On inactive account: returns 403.

    Implemented as pure ASGI middleware to avoid BaseHTTPMiddleware
    response buffering that breaks SSE streaming.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        path = request.url.path

        # Only handle /api/admin/* paths
        if not path.startswith("/api/admin/"):
            await self.app(scope, receive, send)
            return

        # Always allow CORS preflight
        if request.method == "OPTIONS":
            await self.app(scope, receive, send)
            return

        # Allow public admin paths (login)
        if path in _PUBLIC_ADMIN_PATHS:
            await self.app(scope, receive, send)
            return

        # Extract admin_token cookie
        token = request.cookies.get("admin_token")
        if not token:
            # Dev + loopback bypass: 仅限白名单路径且环境为 development
            settings = get_settings()
            client_host = request.client.host if request.client else ""
            is_dev = settings.environment.lower() in ("development", "dev", "local")
            is_loopback = client_host in _LOOPBACK_HOSTS
            if is_dev and is_loopback and path in _DEV_LOOPBACK_ALLOWED_PATHS:
                logger.info(
                    "AdminJWTMiddleware: dev+loopback bypass for %s (client=%s)",
                    path, client_host,
                )
                await self.app(scope, receive, send)
                return
            response = JSONResponse(
                status_code=401,
                content={"detail": "管理员未认证"},
            )
            await response(scope, receive, send)
            return

        # Validate JWT
        try:
            settings = get_settings()
            payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])

            # Verify token type claim
            if payload.get("type") != "admin":
                response = JSONResponse(
                    status_code=401,
                    content={"detail": "Token 类型无效"},
                )
                await response(scope, receive, send)
                return

            admin_id: str | None = payload.get("sub")
            if not admin_id:
                response = JSONResponse(
                    status_code=401,
                    content={"detail": "Token 缺少 sub 字段"},
                )
                await response(scope, receive, send)
                return

        except JWTError:
            response = JSONResponse(
                status_code=401,
                content={"detail": "Token 无效或已过期"},
            )
            await response(scope, receive, send)
            return

        # Optional: verify account is still active in DB
        try:
            db = await get_db()
            result = (
                await db.table("ss_admin_accounts")
                .select("id, is_active")
                .eq("id", admin_id)
                .maybe_single()
                .execute()
            )
            account = result.data if result else None
            if not account:
                response = JSONResponse(
                    status_code=401,
                    content={"detail": "管理员账号不存在"},
                )
                await response(scope, receive, send)
                return
            if not account.get("is_active", True):
                response = JSONResponse(
                    status_code=403,
                    content={"detail": "管理员账号已被禁用"},
                )
                await response(scope, receive, send)
                return
        except Exception as e:
            logger.warning(
                "AdminJWTMiddleware: DB check failed for admin_id=%s: %s", admin_id, e
            )
            response = JSONResponse(
                status_code=503,
                content={"detail": "管理员鉴权服务暂不可用，请稍后重试"},
            )
            await response(scope, receive, send)
            return

        # Attach admin_id to request state for downstream handlers
        request.state.admin_id = admin_id

        # Pass through — NO response buffering
        await self.app(scope, receive, send)
