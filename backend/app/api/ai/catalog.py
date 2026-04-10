"""AI model catalog routes — relocated from api/ai_catalog.py."""

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.models.ai_catalog import UserCatalogResponse
from app.services.ai_catalog_service import list_catalog_items

router = APIRouter(tags=["ai-catalog"])


@router.get("/models/catalog", response_model=UserCatalogResponse)
async def get_user_model_catalog(
    current_user: dict = Depends(get_current_user),
) -> UserCatalogResponse:
    tier = current_user.get("tier", "free")
    items = await list_catalog_items(tier=tier)
    return UserCatalogResponse(items=items)
