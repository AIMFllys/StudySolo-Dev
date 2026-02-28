"""FastAPI dependency injection helpers."""

from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request, status
from supabase import AsyncClient

from app.core.database import get_db


# ---------------------------------------------------------------------------
# Supabase client dependency
# ---------------------------------------------------------------------------

async def get_supabase_client(
    db: AsyncClient = Depends(get_db),
) -> AsyncClient:
    """Yield the shared Supabase AsyncClient."""
    return db


# ---------------------------------------------------------------------------
# Current-user dependency (uses Supabase token validation)
# ---------------------------------------------------------------------------

async def get_current_user(
    request: Request,
    access_token: Annotated[str | None, Cookie()] = None,
    db: AsyncClient = Depends(get_db),
) -> dict:
    """Validate the access_token via Supabase and return the user payload.

    First checks request.state.user (set by middleware), then falls back
    to direct Supabase validation.

    Raises 401 if the token is missing, expired, or invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token 无效或已过期",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # If middleware already validated, use cached user
    if hasattr(request.state, "user") and request.state.user:
        user = request.state.user
        return {
            "id": str(user.id),
            "email": user.email or "",
            "role": (user.user_metadata or {}).get("role", "user"),
        }

    # Fallback: validate token directly
    if not access_token:
        raise credentials_exception

    try:
        result = await db.auth.get_user(access_token)
        if not result or not result.user:
            raise credentials_exception
        user = result.user
        return {
            "id": str(user.id),
            "email": user.email or "",
            "role": (user.user_metadata or {}).get("role", "user"),
        }
    except Exception:
        raise credentials_exception

