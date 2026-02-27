"""FastAPI dependency injection helpers."""

from typing import Annotated

import jwt
from fastapi import Cookie, Depends, HTTPException, status
from supabase import AsyncClient

from app.core.config import Settings, get_settings
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
# Current-user dependency (JWT validation)
# ---------------------------------------------------------------------------

async def get_current_user(
    access_token: Annotated[str | None, Cookie()] = None,
    settings: Settings = Depends(get_settings),
) -> dict:
    """Validate the JWT access_token cookie and return the user payload.

    Raises 401 if the token is missing, expired, or has an invalid signature.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token 无效或已过期",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not access_token:
        raise credentials_exception

    try:
        payload = jwt.decode(
            access_token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise credentials_exception

    return {
        "id": user_id,
        "email": payload.get("email", ""),
        "role": payload.get("role", "user"),
    }
