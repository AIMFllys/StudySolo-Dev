"""User usage analytics routes."""

from fastapi import APIRouter, Depends, Query
from supabase import AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.usage import UsageLiveResponse, UsageOverviewResponse, UsageTimeseriesResponse
from app.services.usage_analytics import get_usage_live, get_usage_overview, get_usage_timeseries
from app.services.quota_service import (
    check_daily_chat_quota,
    check_daily_execution_quota,
    get_workflow_quota,
)
from pydantic import BaseModel

router = APIRouter(tags=["usage"])


@router.get("/overview", response_model=UsageOverviewResponse)
async def usage_overview(
    range_value: str = Query(default="24h", alias="range"),
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> UsageOverviewResponse:
    return await get_usage_overview(db, range_value=range_value, user_id=current_user["id"])


@router.get("/live", response_model=UsageLiveResponse)
async def usage_live(
    window: str = Query(default="5m"),
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> UsageLiveResponse:
    return await get_usage_live(db, window_value=window, user_id=current_user["id"])


@router.get("/timeseries", response_model=UsageTimeseriesResponse)
async def usage_timeseries(
    range_value: str = Query(default="24h", alias="range"),
    source: str = Query(default="all"),
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> UsageTimeseriesResponse:
    return await get_usage_timeseries(
        db,
        range_value=range_value,
        user_id=current_user["id"],
        source_filter=source,
    )


class WorkflowQuotaResponse(BaseModel):
    tier: str
    workflows_used: int
    workflows_base_limit: int
    workflows_addon_qty: int
    workflows_total: int
    workflows_remaining: int
    # Daily quotas
    daily_chat_used: int
    daily_chat_limit: int
    daily_execution_used: int
    daily_execution_limit: int


@router.get("/quota", response_model=WorkflowQuotaResponse)
async def get_user_quota(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
) -> WorkflowQuotaResponse:
    """Return the current user's resource quota summary.

    Clients should call this on workspace init to get accurate
    tier + addon-adjusted limits for display and soft-enforcement.
    """
    user_id = current_user["id"]
    tier = current_user.get("tier", "free")
    
    # Workflow count quota
    quota = await get_workflow_quota(user_id, tier, db)
    
    # Daily quotas
    chat_quota = await check_daily_chat_quota(user_id, tier, db)
    exec_quota = await check_daily_execution_quota(user_id, tier, db)
    
    return WorkflowQuotaResponse(
        tier=tier,
        workflows_used=quota["used"],
        workflows_base_limit=quota["base_limit"],
        workflows_addon_qty=quota["addon_qty"],
        workflows_total=quota["total_limit"],
        workflows_remaining=quota["remaining"],
        daily_chat_used=chat_quota["used"],
        daily_chat_limit=chat_quota["limit"],
        daily_execution_used=exec_quota["used"],
        daily_execution_limit=exec_quota["limit"],
    )

