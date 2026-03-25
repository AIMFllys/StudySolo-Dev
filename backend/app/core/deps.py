"""FastAPI dependency injection helpers."""

from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request, status
from supabase import AsyncClient

from app.core.database import get_db, get_anon_db


# ---------------------------------------------------------------------------
# Supabase client dependency
# ---------------------------------------------------------------------------

async def get_supabase_client(
    db: AsyncClient = Depends(get_db),
) -> AsyncClient:
    """Yield the shared Supabase AsyncClient (service_role)."""
    return db


async def get_anon_supabase_client(
    db: AsyncClient = Depends(get_anon_db),
) -> AsyncClient:
    """Yield the shared Supabase AsyncClient (anon key).

    Use this for user-facing auth operations so that Supabase
    email verification and auth policies are respected.
    """
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

    Returns dict with id, email, role (system), and tier (subscription).
    Raises 401 if the token is missing, expired, or invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token 无效或已过期",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id: str | None = None
    email: str = ""
    role: str = "user"

    # If middleware already validated, use cached user
    if hasattr(request.state, "user") and request.state.user:
        user = request.state.user
        user_id = str(user.id)
        email = user.email or ""
        role = (user.user_metadata or {}).get("role", "user")
    else:
        # Fallback: validate token directly
        if not access_token:
            raise credentials_exception
        try:
            result = await db.auth.get_user(access_token)
            if not result or not result.user:
                raise credentials_exception
            user = result.user
            user_id = str(user.id)
            email = user.email or ""
            role = (user.user_metadata or {}).get("role", "user")
        except Exception:
            raise credentials_exception

    # Query tier from user_profiles (cached per request)
    if hasattr(request.state, "user_tier"):
        tier = request.state.user_tier
    else:
        try:
            profile = (
                await db.table("user_profiles")
                .select("tier")
                .eq("id", user_id)
                .maybe_single()
                .execute()
            )
            tier = (profile.data or {}).get("tier", "free")
        except Exception:
            tier = "free"
        request.state.user_tier = tier

    return {
        "id": user_id,
        "email": email,
        "role": role,
        "tier": tier,
    }


async def get_optional_user(
    request: Request,
    access_token: Annotated[str | None, Cookie()] = None,
    db: AsyncClient = Depends(get_db),
) -> dict | None:
    """Like get_current_user, but returns None if not authenticated.

    Use for public endpoints that optionally personalize for logged-in users.
    """
    if not access_token and not (hasattr(request.state, "user") and request.state.user):
        return None
    try:
        return await get_current_user(request, access_token, db)
    except HTTPException:
        return None


