"""JWT Bearer Token validation middleware for protected API routes."""

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.database import get_db

# Routes that do NOT require authentication
UNPROTECTED_PATHS = {
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/logout",
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

        # Always allow CORS preflight requests through
        if request.method == "OPTIONS":
            return await call_next(request)

        # Only protect /api/* routes
        if not path.startswith("/api/"):
            return await call_next(request)

        # Skip unprotected paths
        if path in UNPROTECTED_PATHS:
            return await call_next(request)

        # Extract token from Authorization header or cookie
        token = _extract_token(request)
        if not token:
            print(f"[AUTH] No token found for {path} | cookies: {list(request.cookies.keys())}")
            return JSONResponse(
                status_code=401,
                content={"detail": "Token 无效或已过期"},
            )

        # Validate token via Supabase
        try:
            db = await get_db()
            result = await db.auth.get_user(token)
            if not result or not result.user:
                print(f"[AUTH] Supabase returned no user for {path}")
                return JSONResponse(
                    status_code=401,
                    content={"detail": "Token 无效或已过期"},
                )
            # Store user info on request state for downstream use
            request.state.user = result.user
            print(f"[AUTH] OK: user={result.user.id} for {path}")
        except Exception as e:
            print(f"[AUTH] Supabase error for {path}: {e}")
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

