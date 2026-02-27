"""Unified route aggregation for StudySolo API."""

from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.workflow import router as workflow_router
from app.api.ai import router as ai_router

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(workflow_router, prefix="/workflow", tags=["workflow"])
router.include_router(ai_router, prefix="/ai", tags=["ai"])
