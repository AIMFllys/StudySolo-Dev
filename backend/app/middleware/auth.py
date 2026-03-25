"""JWT Bearer Token validation middleware for protected API routes.

Uses Pure ASGI middleware to avoid response body buffering
that breaks SSE / StreamingResponse.

NOTE: BaseHTTPMiddleware wraps response body and consumes it fully
before forwarding — this kills SSE streaming. Pure ASGI middleware
passes the response through without buffering.
"""

import logging
import re

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.database import get_db

logger = logging.getLogger(__name__)

# Routes that do NOT require authentication
UNPROTECTED_PATHS = {
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/refresh",
    "/api/auth/sync-session",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/reset-password-with-code",
    "/api/auth/resend-verification",
    "/api/auth/send-code",
    "/api/auth/captcha-challenge",
    "/api/auth/captcha-token",
    "/api/health",
    "/api/workflow/marketplace",
    "/docs",
    "/openapi.json",
    "/redoc",
}

# Regex patterns for dynamic public routes (no auth required, but token
# is still extracted if present so get_optional_user can personalize)
_SOFT_AUTH_PATTERNS = [
    re.compile(r"^/api/workflow/[^/]+/public$"),
]


class JWTAuthMiddleware:
    """Validate JWT for all /api/* routes except the unprotected ones.

    Implemented as a pure ASGI middleware (NOT BaseHTTPMiddleware) so that
    streaming responses (SSE, chunked transfer) pass through without buffering.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        # Only process HTTP requests
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        path = request.url.path

        # Always allow CORS preflight requests through
        if request.method == "OPTIONS":
            await self.app(scope, receive, send)
            return

        # Admin paths are handled by AdminJWTMiddleware — skip here
        if path.startswith("/api/admin/"):
            await self.app(scope, receive, send)
            return

        # Only protect /api/* routes
        if not path.startswith("/api/"):
            await self.app(scope, receive, send)
            return

        # Skip unprotected paths
        if path in UNPROTECTED_PATHS:
            await self.app(scope, receive, send)
            return

        # Soft-auth paths: extract token if present but don't block unauthenticated
        if any(p.match(path) for p in _SOFT_AUTH_PATTERNS):
            token = _extract_token(request)
            if token:
                try:
                    db = await get_db()
                    result = await db.auth.get_user(token)
                    if result and result.user:
                        request.state.user = result.user
                except Exception:
                    pass  # best-effort: anonymous fallback
            await self.app(scope, receive, send)
            return

        # Extract token from Authorization header or cookie
        token = _extract_token(request)
        if not token:
            logger.debug("No token found for %s | cookies: %s", path, list(request.cookies.keys()))
            response = JSONResponse(
                status_code=401,
                content={"detail": "Token 无效或已过期"},
            )
            await response(scope, receive, send)
            return

        # Validate token via Supabase
        try:
            db = await get_db()
            result = await db.auth.get_user(token)
            if not result or not result.user:
                logger.debug("Supabase returned no user for %s", path)
                response = JSONResponse(
                    status_code=401,
                    content={"detail": "Token 无效或已过期"},
                )
                await response(scope, receive, send)
                return
            # Store user info on request state for downstream use
            # Accessing request.state auto-initializes a State object in scope
            request.state.user = result.user
            logger.debug("Auth OK: user=%s for %s", result.user.id, path)
        except Exception as e:
            logger.warning("Supabase auth error for %s: %s", path, e)
            response = JSONResponse(
                status_code=401,
                content={"detail": "Token 无效或已过期"},
            )
            await response(scope, receive, send)
            return

        # Pass through to the next middleware/route — NO response buffering
        await self.app(scope, receive, send)


def _extract_token(request: Request) -> str | None:
    """Return the JWT from Bearer header or access_token cookie."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[len("Bearer "):]
    return request.cookies.get("access_token")
