"""Admin Dashboard API.

Endpoints:
  GET /dashboard/overview  — aggregate KPI metrics from user_profiles,
                             v_daily_signups, v_daily_workflow_stats, subscriptions
  GET /dashboard/charts    — time-series chart data (7d / 30d / 90d)
"""

import logging
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase._async.client import AsyncClient

from app.core.database import get_db
from app.models.usage import (
    CostSplitResponse,
    ModelBreakdownResponse,
    RecentCallsResponse,
    UsageLiveResponse,
    UsageOverviewResponse,
    UsageTimeseriesResponse,
)
from app.services.usage_analytics import (
    get_cost_split,
    get_model_breakdown,
    get_recent_calls,
    get_usage_live,
    get_usage_overview,
    get_usage_timeseries,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["admin-dashboard"])


# ---------------------------------------------------------------------------
# Pydantic response models
# ---------------------------------------------------------------------------


class TierDistribution(BaseModel):
    free: int
    pro: int
    pro_plus: int
    ultra: int


class DashboardOverview(BaseModel):
    total_users: int
    active_users: int
    tier_distribution: TierDistribution
    today_signups: int
    today_edu_signups: int
    total_workflow_runs: int
    today_workflow_runs: int
    active_subscriptions: int


class SignupDataPoint(BaseModel):
    date: str  # ISO date string "YYYY-MM-DD"
    signups: int
    edu_signups: int


class WorkflowDataPoint(BaseModel):
    date: str  # ISO date string "YYYY-MM-DD"
    total_runs: int
    success: int
    failed: int
    total_tokens: int


class DashboardCharts(BaseModel):
    time_range: str
    signups_chart: list[SignupDataPoint]
    workflow_chart: list[WorkflowDataPoint]


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _days_for_range(time_range: str) -> int:
    mapping = {"7d": 7, "30d": 30, "90d": 90}
    return mapping.get(time_range, 7)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/dashboard/overview", response_model=DashboardOverview)
async def get_dashboard_overview(
    db: AsyncClient = Depends(get_db),
) -> DashboardOverview:
    """Return aggregated KPI metrics for the dashboard overview cards."""
    today = date.today().isoformat()

    try:
        # 1. Total users
        total_result = (
            await db.table("user_profiles")
            .select("id", count="exact")
            .execute()
        )
        total_users: int = total_result.count or 0

        # 2. Active users
        active_result = (
            await db.table("user_profiles")
            .select("id", count="exact")
            .eq("is_active", True)
            .execute()
        )
        active_users: int = active_result.count or 0

        # 3. Tier distribution — fetch all tiers in one query
        tier_result = (
            await db.table("user_profiles")
            .select("tier")
            .execute()
        )
        tier_counts: dict[str, int] = {"free": 0, "pro": 0, "pro_plus": 0, "ultra": 0}
        for row in (tier_result.data or []):
            t = row.get("tier", "free") or "free"
            if t in tier_counts:
                tier_counts[t] += 1
            else:
                tier_counts["free"] += 1

        # 4. Today's signups from v_daily_signups
        signup_result = (
            await db.table("v_daily_signups")
            .select("signups, edu_signups")
            .eq("date", today)
            .maybe_single()
            .execute()
        )
        signup_row = signup_result.data if signup_result else None
        today_signups: int = int(signup_row["signups"]) if signup_row else 0
        today_edu_signups: int = int(signup_row["edu_signups"]) if signup_row else 0

        # 5. Total workflow runs
        wf_total_result = (
            await db.table("ss_workflow_runs")
            .select("id", count="exact")
            .execute()
        )
        total_workflow_runs: int = wf_total_result.count or 0

        # 6. Today's workflow runs
        wf_today_result = (
            await db.table("ss_workflow_runs")
            .select("id", count="exact")
            .gte("started_at", f"{today}T00:00:00+00:00")
            .lt("started_at", f"{today}T23:59:59+00:00")
            .execute()
        )
        today_workflow_runs: int = wf_today_result.count or 0

        # 7. Active subscriptions
        sub_result = (
            await db.table("subscriptions")
            .select("user_id", count="exact")
            .eq("status", "active")
            .execute()
        )
        active_subscriptions: int = sub_result.count or 0

    except Exception as exc:
        logger.exception("Dashboard overview query failed: %s", exc)
        raise HTTPException(status_code=500, detail="获取 Dashboard 数据失败")

    return DashboardOverview(
        total_users=total_users,
        active_users=active_users,
        tier_distribution=TierDistribution(**tier_counts),
        today_signups=today_signups,
        today_edu_signups=today_edu_signups,
        total_workflow_runs=total_workflow_runs,
        today_workflow_runs=today_workflow_runs,
        active_subscriptions=active_subscriptions,
    )


@router.get("/dashboard/charts", response_model=DashboardCharts)
async def get_dashboard_charts(
    time_range: Literal["7d", "30d", "90d"] = Query(default="7d"),
    db: AsyncClient = Depends(get_db),
) -> DashboardCharts:
    """Return time-series chart data for the given time range."""
    days = _days_for_range(time_range)
    cutoff = (date.today() - timedelta(days=days - 1)).isoformat()

    try:
        # Signups chart from v_daily_signups
        signup_result = (
            await db.table("v_daily_signups")
            .select("date, signups, edu_signups")
            .gte("date", cutoff)
            .order("date", desc=False)
            .execute()
        )
        signups_chart = [
            SignupDataPoint(
                date=str(row["date"]),
                signups=int(row["signups"]),
                edu_signups=int(row["edu_signups"]),
            )
            for row in (signup_result.data or [])
        ]

        # Workflow chart from v_daily_workflow_stats
        wf_result = (
            await db.table("v_daily_workflow_stats")
            .select("date, total_runs, success, failed, total_tokens")
            .gte("date", cutoff)
            .order("date", desc=False)
            .execute()
        )
        workflow_chart = [
            WorkflowDataPoint(
                date=str(row["date"]),
                total_runs=int(row["total_runs"]),
                success=int(row["success"]),
                failed=int(row["failed"]),
                total_tokens=int(row["total_tokens"]),
            )
            for row in (wf_result.data or [])
        ]

    except Exception as exc:
        logger.exception("Dashboard charts query failed: %s", exc)
        raise HTTPException(status_code=500, detail="获取图表数据失败")

    return DashboardCharts(
        time_range=time_range,
        signups_chart=signups_chart,
        workflow_chart=workflow_chart,
    )


@router.get("/dashboard/ai-overview", response_model=UsageOverviewResponse)
async def get_dashboard_ai_overview(
    range_value: str = Query(default="24h", alias="range"),
    db: AsyncClient = Depends(get_db),
) -> UsageOverviewResponse:
    return await get_usage_overview(db, range_value=range_value)


@router.get("/dashboard/ai-live", response_model=UsageLiveResponse)
async def get_dashboard_ai_live(
    window: str = Query(default="5m"),
    db: AsyncClient = Depends(get_db),
) -> UsageLiveResponse:
    return await get_usage_live(db, window_value=window)


@router.get("/dashboard/ai-timeseries", response_model=UsageTimeseriesResponse)
async def get_dashboard_ai_timeseries(
    range_value: str = Query(default="7d", alias="range"),
    source: str = Query(default="all"),
    db: AsyncClient = Depends(get_db),
) -> UsageTimeseriesResponse:
    return await get_usage_timeseries(db, range_value=range_value, source_filter=source)


@router.get("/dashboard/ai-model-breakdown", response_model=ModelBreakdownResponse)
async def get_dashboard_ai_model_breakdown(
    range_value: str = Query(default="7d", alias="range"),
    source: str = Query(default="all"),
    db: AsyncClient = Depends(get_db),
) -> ModelBreakdownResponse:
    return await get_model_breakdown(db, range_value=range_value, source_filter=source)


@router.get("/dashboard/ai-recent-calls", response_model=RecentCallsResponse)
async def get_dashboard_ai_recent_calls(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: AsyncClient = Depends(get_db),
) -> RecentCallsResponse:
    return await get_recent_calls(db, page=page, page_size=page_size)


@router.get("/dashboard/ai-cost-split", response_model=CostSplitResponse)
async def get_dashboard_ai_cost_split(
    range_value: str = Query(default="7d", alias="range"),
    db: AsyncClient = Depends(get_db),
) -> CostSplitResponse:
    return await get_cost_split(db, range_value=range_value)
