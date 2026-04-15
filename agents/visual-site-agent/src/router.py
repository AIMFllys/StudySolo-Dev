from fastapi import APIRouter

from src.endpoints.completions import router as completions_router
from src.endpoints.health import router as health_router
from src.endpoints.models import router as models_router

router = APIRouter()
router.include_router(health_router)
router.include_router(models_router)
router.include_router(completions_router)
