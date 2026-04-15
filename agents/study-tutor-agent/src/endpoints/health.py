import time

from fastapi import APIRouter, Request

from src.config import get_settings
from src.schemas.response import HealthResponse, ReadyResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    settings = get_settings()
    started_at = getattr(request.app.state, "started_at", time.monotonic())
    return HealthResponse(
        agent=settings.agent_name,
        version=settings.version,
        uptime_seconds=max(0, int(time.monotonic() - started_at)),
        models=settings.models,
    )


@router.get("/health/ready", response_model=ReadyResponse)
async def health_ready() -> ReadyResponse:
    return ReadyResponse()
