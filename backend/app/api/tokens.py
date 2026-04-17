"""Personal Access Token management routes: /api/tokens/*.

PATs power CLI / MCP Bearer authentication. Plaintext is only returned from
the create endpoint and never stored anywhere; the database only keeps the
SHA-256 hash.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.api_token import ApiTokenCreate, ApiTokenCreated, ApiTokenListItem
from app.services.api_token_service import (
    create_token,
    list_tokens,
    revoke_token,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=list[ApiTokenListItem])
@router.get("/", response_model=list[ApiTokenListItem])
async def list_api_tokens(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> list[ApiTokenListItem]:
    """List the current user's PATs (metadata only; plaintext is never returned)."""
    rows = await list_tokens(db, current_user["id"])
    return [ApiTokenListItem(**row) for row in rows]


@router.post(
    "",
    response_model=ApiTokenCreated,
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/",
    response_model=ApiTokenCreated,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_token(
    body: ApiTokenCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> ApiTokenCreated:
    """Create a new PAT. The plaintext is returned **exactly once**."""
    try:
        plaintext, row = await create_token(
            db=db,
            user_id=current_user["id"],
            name=body.name,
            expires_in_days=body.expires_in_days,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to create API token: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建 API Token 失败，请稍后重试",
        ) from exc

    return ApiTokenCreated(token=plaintext, **row)


@router.delete("/{token_id}")
async def delete_api_token(
    token_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """Revoke (hard-delete) one of the current user's PATs."""
    ok = await revoke_token(db, current_user["id"], token_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token 不存在或已被撤销",
        )
    return {"success": True}
