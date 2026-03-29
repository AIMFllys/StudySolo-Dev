# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.services import usage_analytics

UTC = timezone.utc
FIXED_NOW = datetime(2026, 3, 26, 11, 12, tzinfo=UTC)


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, rows: list[dict]):
        self._rows = rows
        self._limit: int | None = None

    def select(self, _fields: str):
        return self

    def gte(self, field: str, value: str):
        self._rows = [row for row in self._rows if str(row.get(field)) >= value]
        return self

    def eq(self, field: str, value):
        self._rows = [row for row in self._rows if row.get(field) == value]
        return self

    def order(self, field: str, desc: bool = False):
        self._rows = sorted(self._rows, key=lambda row: str(row.get(field)), reverse=desc)
        return self

    def limit(self, value: int):
        self._limit = value
        return self

    async def execute(self):
        data = self._rows[: self._limit] if self._limit is not None else self._rows
        return _FakeResult(data)


class _FakeDB:
    def __init__(self, tables: dict[str, list[dict]]):
        self._tables = tables

    def table(self, table_name: str):
        return _FakeQuery(list(self._tables.get(table_name, [])))


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _build_fake_db() -> _FakeDB:
    assistant_started = FIXED_NOW - timedelta(minutes=2)
    workflow_started = FIXED_NOW - timedelta(minutes=1)
    assistant_bucket = assistant_started.replace(second=0, microsecond=0)
    workflow_bucket = workflow_started.replace(second=0, microsecond=0)

    return _FakeDB(
        {
            "ss_ai_requests": [
                {
                    "id": "assistant-request",
                    "source_type": "assistant",
                    "source_subtype": "chat",
                    "status": "completed",
                    "started_at": _iso(assistant_started),
                },
                {
                    "id": "workflow-request",
                    "source_type": "workflow",
                    "source_subtype": "workflow_execute",
                    "status": "completed",
                    "started_at": _iso(workflow_started),
                },
            ],
            "ss_ai_usage_events": [
                {
                    "id": "assistant-error",
                    "request_id": "assistant-request",
                    "source_type": "assistant",
                    "source_subtype": "chat",
                    "sku_id": "sku_qiniu_qwen3_max_proxy",
                    "family_id": "qwen_premium",
                    "provider": "qiniu",
                    "vendor": "qwen",
                    "model": "Qwen3-Max",
                    "billing_channel": "proxy",
                    "node_id": None,
                    "status": "error",
                    "is_fallback": False,
                    "latency_ms": 1200,
                    "total_tokens": 0,
                    "cost_amount_cny": 0.0,
                    "started_at": _iso(assistant_started),
                },
                {
                    "id": "assistant-success",
                    "request_id": "assistant-request",
                    "source_type": "assistant",
                    "source_subtype": "chat",
                    "sku_id": "sku_deepseek_reasoner_native",
                    "family_id": "deepseek_reasoning",
                    "provider": "deepseek",
                    "vendor": "deepseek",
                    "model": "deepseek-reasoner",
                    "billing_channel": "native",
                    "node_id": None,
                    "status": "success",
                    "is_fallback": True,
                    "latency_ms": 3400,
                    "total_tokens": 1500,
                    "cost_amount_cny": 0.0120002,
                    "started_at": _iso(assistant_started + timedelta(seconds=5)),
                },
                {
                    "id": "workflow-success",
                    "request_id": "workflow-request",
                    "source_type": "workflow",
                    "source_subtype": "workflow_execute",
                    "sku_id": "sku_dashscope_qwen_turbo_native",
                    "family_id": "qwen_budget_chat",
                    "provider": "dashscope",
                    "vendor": "qwen",
                    "model": "qwen-turbo",
                    "billing_channel": "native",
                    "node_id": "node-chat-1",
                    "status": "success",
                    "is_fallback": False,
                    "latency_ms": 800,
                    "total_tokens": 800,
                    "cost_amount_cny": 0.0003291,
                    "started_at": _iso(workflow_started),
                },
            ],
            "ss_ai_usage_minute": [
                {
                    "minute_bucket": _iso(assistant_bucket),
                    "logical_requests": 1,
                    "provider_calls": 0,
                    "successful_provider_calls": 0,
                    "total_tokens": 0,
                    "total_cost_cny": 0.0,
                    "error_count": 0,
                    "fallback_count": 0,
                },
                {
                    "minute_bucket": _iso(assistant_bucket),
                    "logical_requests": 0,
                    "provider_calls": 1,
                    "successful_provider_calls": 0,
                    "total_tokens": 0,
                    "total_cost_cny": 0.0,
                    "error_count": 1,
                    "fallback_count": 0,
                },
                {
                    "minute_bucket": _iso(assistant_bucket),
                    "logical_requests": 0,
                    "provider_calls": 1,
                    "successful_provider_calls": 1,
                    "total_tokens": 1500,
                    "total_cost_cny": 0.0120002,
                    "error_count": 0,
                    "fallback_count": 1,
                },
                {
                    "minute_bucket": _iso(workflow_bucket),
                    "logical_requests": 1,
                    "provider_calls": 0,
                    "successful_provider_calls": 0,
                    "total_tokens": 0,
                    "total_cost_cny": 0.0,
                    "error_count": 0,
                    "fallback_count": 0,
                },
                {
                    "minute_bucket": _iso(workflow_bucket),
                    "logical_requests": 0,
                    "provider_calls": 1,
                    "successful_provider_calls": 1,
                    "total_tokens": 800,
                    "total_cost_cny": 0.0003291,
                    "error_count": 0,
                    "fallback_count": 0,
                },
            ],
            "ai_model_families": [
                {"id": "deepseek_reasoning", "task_family": "reasoning", "family_name": "DeepSeek Reasoning"},
                {"id": "qwen_budget_chat", "task_family": "cheap_chat", "family_name": "Qwen Budget Chat"},
                {"id": "qwen_premium", "task_family": "premium_chat", "family_name": "Qwen Premium"},
            ],
        }
    )


@pytest.fixture(autouse=True)
def _freeze_usage_clock(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(usage_analytics, "_utcnow", lambda: FIXED_NOW)
    monkeypatch.setattr("app.services.usage_analytics_helpers.utcnow", lambda: FIXED_NOW)
    monkeypatch.setattr("app.services.usage_analytics.utcnow", lambda: FIXED_NOW)


@pytest.mark.asyncio
async def test_usage_overview_splits_assistant_and_workflow_metrics():
    db = _build_fake_db()

    result = await usage_analytics.get_usage_overview(db, range_value="24h")

    assert result.assistant.logical_request_count == 1
    assert result.assistant.provider_call_count == 2
    assert result.assistant.successful_provider_call_count == 1
    assert result.assistant.total_tokens == 1500
    assert result.assistant.total_cost_cny == 0.012
    assert result.assistant.error_rate == 0.5
    assert result.assistant.fallback_rate == 0.5
    assert result.assistant.p95_latency_ms == 3400

    assert result.workflow.logical_request_count == 1
    assert result.workflow.provider_call_count == 1
    assert result.workflow.successful_provider_call_count == 1
    assert result.workflow.total_tokens == 800
    assert result.workflow.total_cost_cny == 0.000329
    assert result.workflow.error_rate == 0.0
    assert result.workflow.fallback_rate == 0.0
    assert result.workflow.p95_latency_ms == 800

    assert result.all.logical_request_count == 2
    assert result.all.provider_call_count == 3
    assert result.all.successful_provider_call_count == 2
    assert result.all.total_tokens == 2300
    assert result.all.total_cost_cny == 0.012329
    assert result.all.error_rate == 0.3333
    assert result.all.fallback_rate == 0.3333
    assert result.all.p95_latency_ms == 3270


@pytest.mark.asyncio
async def test_usage_live_rolls_up_recent_minute_buckets():
    db = _build_fake_db()

    result = await usage_analytics.get_usage_live(db, window_value="5m")

    assert len(result.points) == 5
    assert result.summary.logical_request_count == 2
    assert result.summary.provider_call_count == 3
    assert result.summary.successful_provider_call_count == 2
    assert result.summary.total_tokens == 2300
    assert result.summary.total_cost_cny == 0.012329
    assert result.summary.error_rate == 0.3333
    assert result.summary.fallback_rate == 0.3333

    populated = [point for point in result.points if point.provider_calls or point.logical_requests]
    assert len(populated) == 2
    assert populated[0].logical_requests == 1
    assert populated[0].provider_calls == 2
    assert populated[0].error_count == 1
    assert populated[0].fallback_count == 1
    assert populated[1].logical_requests == 1
    assert populated[1].provider_calls == 1
    assert populated[1].total_tokens == 800


@pytest.mark.asyncio
async def test_usage_timeseries_keeps_assistant_and_workflow_costs_separate():
    db = _build_fake_db()

    result = await usage_analytics.get_usage_timeseries(db, range_value="24h", source_filter="all")

    assert len(result.points) == 24
    populated = [point for point in result.points if point.assistant_calls or point.workflow_calls]
    assert len(populated) == 1

    point = populated[0]
    assert point.assistant_calls == 2
    assert point.assistant_tokens == 1500
    assert point.assistant_cost_cny == 0.012
    assert point.workflow_calls == 1
    assert point.workflow_tokens == 800
    assert point.workflow_cost_cny == 0.000329
