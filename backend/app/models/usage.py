from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


UsageSourceType = Literal["assistant", "workflow"]
UsageSourceFilter = Literal["assistant", "workflow", "all"]
UsageRange = Literal["24h", "7d", "30d"]
UsageWindow = Literal["5m", "60m"]


class UsageMetrics(BaseModel):
    logical_request_count: int = 0
    provider_call_count: int = 0
    successful_provider_call_count: int = 0
    total_tokens: int = 0
    total_cost_cny: float = 0.0
    error_rate: float = 0.0
    fallback_rate: float = 0.0
    p95_latency_ms: int | None = None


class UsageOverviewResponse(BaseModel):
    range: str
    assistant: UsageMetrics
    workflow: UsageMetrics
    all: UsageMetrics


class UsageLivePoint(BaseModel):
    ts: datetime
    logical_requests: int = 0
    provider_calls: int = 0
    successful_provider_calls: int = 0
    total_tokens: int = 0
    total_cost_cny: float = 0.0
    error_count: int = 0
    fallback_count: int = 0


class UsageLiveResponse(BaseModel):
    window: str
    points: list[UsageLivePoint] = Field(default_factory=list)
    summary: UsageMetrics


class UsageTimeseriesPoint(BaseModel):
    ts: str
    assistant_calls: int = 0
    workflow_calls: int = 0
    assistant_tokens: int = 0
    workflow_tokens: int = 0
    assistant_cost_cny: float = 0.0
    workflow_cost_cny: float = 0.0


class UsageTimeseriesResponse(BaseModel):
    range: str
    source: UsageSourceFilter
    points: list[UsageTimeseriesPoint] = Field(default_factory=list)


class ModelBreakdownItem(BaseModel):
    sku_id: str | None = None
    family_id: str | None = None
    provider: str
    vendor: str
    model: str
    billing_channel: str
    task_family: str | None = None
    provider_call_count: int = 0
    successful_provider_call_count: int = 0
    total_tokens: int = 0
    total_cost_cny: float = 0.0
    success_rate: float = 0.0


class ModelBreakdownResponse(BaseModel):
    range: str
    source: UsageSourceFilter
    items: list[ModelBreakdownItem] = Field(default_factory=list)


class RecentCallItem(BaseModel):
    id: str
    request_id: str
    source_type: UsageSourceType
    source_subtype: str
    sku_id: str | None = None
    family_id: str | None = None
    provider: str
    vendor: str
    model: str
    billing_channel: str
    node_id: str | None = None
    status: str
    is_fallback: bool
    latency_ms: int | None = None
    total_tokens: int = 0
    cost_amount_cny: float = 0.0
    started_at: datetime


class RecentCallsResponse(BaseModel):
    calls: list[RecentCallItem] = Field(default_factory=list)


class CostSplitItem(BaseModel):
    source_type: UsageSourceType
    provider_call_count: int = 0
    total_tokens: int = 0
    total_cost_cny: float = 0.0


class CostSplitResponse(BaseModel):
    range: str
    items: list[CostSplitItem] = Field(default_factory=list)
