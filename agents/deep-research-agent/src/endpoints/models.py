from fastapi import APIRouter

from src.config import get_settings
from src.schemas.response import ModelCard, ModelListResponse

router = APIRouter(tags=["models"])


@router.get("/v1/models", response_model=ModelListResponse)
async def list_models() -> ModelListResponse:
    settings = get_settings()
    return ModelListResponse(data=[ModelCard(id=model_id) for model_id in settings.models])
