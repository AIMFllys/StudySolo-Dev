"""JWT Bearer Token validation middleware for protected API routes."""

import jwt
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings

# Routes that do NOT require authentication
UNPROTECTED_PATHS = {
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/health",
    "/docs",
    "/openapi.json",
    "/redoc",
}


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """Validate JWT for all /api/* routes except the unprotected ones."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Only protect /api/* routes
        if not path.startswith("/api/"):
            return await call_next(request)

        # Skip unprotected paths
        if path in UNPROTECTED_PATHS:
            return await call_next(request)

        # Extract token from Authorization header or cookie
        token = _extract_token(request)
        if not token:
            return JSONResponse(
                status_code=401,
                content={"detail": "Token 无效或已过期"},
            )

        settings = get_settings()
        try:
            jwt.decode(
                token,
                settings.jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return JSONResponse(
                status_code=401,
                content={"detail": "Token 无效或已过期"},
            )

        return await call_next(request)


def _extract_token(request: Request) -> str | None:
    """Return the JWT from Bearer header or access_token cookie."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[len("Bearer "):]
    return request.cookies.get("access_token")
