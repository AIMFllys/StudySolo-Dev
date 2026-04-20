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


# ---------------------------------------------------------------------------
# Workflow access control (3-tier: owner > editor > viewer)
# ---------------------------------------------------------------------------

_ROLE_LEVEL = {"viewer": 1, "editor": 2, "owner": 3}


async def check_workflow_access(
    workflow_id: str,
    user_id: str,
    required_role: str,
    db: AsyncClient,
) -> dict:
    """Unified workflow permission check.

    Returns: {"workflow": {...}, "access_role": "owner"|"editor"|"viewer"}
    Raises:
        404 if workflow does not exist
        403 if user lacks the required role level
    """
    wf_result = (
        await db.from_("ss_workflows")
        .select("id,user_id,name,is_public")
        .eq("id", workflow_id)
        .maybe_single()
        .execute()
    )
    if not wf_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="工作流不存在",
        )

    wf = wf_result.data

    # Determine access role
    if wf["user_id"] == user_id:
        access_role = "owner"
    else:
        collab = (
            await db.from_("ss_workflow_collaborators")
            .select("role")
            .eq("workflow_id", workflow_id)
            .eq("user_id", user_id)
            .eq("status", "accepted")
            .maybe_single()
            .execute()
        )
        access_role = collab.data["role"] if collab.data else None

    if access_role is None or _ROLE_LEVEL.get(access_role, 0) < _ROLE_LEVEL[required_role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权访问此工作流",
        )

    return {"workflow": wf, "access_role": access_role}


# ---------------------------------------------------------------------------
# Admin authentication dependency
# ---------------------------------------------------------------------------

async def get_current_admin(
    request: Request,
    db: AsyncClient = Depends(get_db),
) -> dict:
    """Validate admin authentication and return admin info.

    Requires AdminJWTMiddleware to be active (which sets request.state.admin_id).
    Returns dict with id, username.
    Raises 401 if not authenticated.
    """
    admin_id: str | None = getattr(request.state, "admin_id", None)
    if not admin_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="管理员未认证",
        )

    # Fetch admin details from database
    result = (
        await db.table("ss_admin_accounts")
        .select("id, username, is_active")
        .eq("id", admin_id)
        .maybe_single()
        .execute()
    )
    account = result.data if result else None

    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="管理员账号不存在",
        )

    if not account.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理员账号已被禁用",
        )

    return {
        "id": str(account["id"]),
        "username": account["username"],
        "is_active": account.get("is_active", True),
    }
