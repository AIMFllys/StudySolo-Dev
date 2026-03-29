"""Usage analytics — overview, live, timeseries, model breakdown, recent calls, cost split."""

from collections import defaultdict
from datetime import datetime

from supabase import AsyncClient

from app.models.usage import (
    CostSplitItem, CostSplitResponse,
    ModelBreakdownItem, ModelBreakdownResponse,
    RecentCallItem, RecentCallsResponse,
    UsageLivePoint, UsageLiveResponse, UsageMetrics,
    UsageOverviewResponse, UsageTimeseriesPoint, UsageTimeseriesResponse,
)
from app.services.usage_analytics_helpers import (
    UTC, bucket_key, bucket_sequence, compute_metrics,
    fetch_event_rows, fetch_family_map, fetch_request_rows,
    parse_range, parse_window, safe_float, safe_int, utcnow, window_sequence,
)

# Backward-compatible alias for test monkeypatching
_utcnow = utcnow


async def get_usage_overview(db: AsyncClient, *, range_value: str, user_id: str | None = None) -> UsageOverviewResponse:
    cutoff = utcnow() - parse_range(range_value)
    req_rows = await fetch_request_rows(db, cutoff=cutoff, user_id=user_id)
    evt_rows = await fetch_event_rows(db, cutoff=cutoff, user_id=user_id)
    return UsageOverviewResponse(
        range=range_value,
        assistant=compute_metrics(req_rows, evt_rows, "assistant"),
        workflow=compute_metrics(req_rows, evt_rows, "workflow"),
        all=compute_metrics(req_rows, evt_rows, None),
    )


async def get_usage_live(db: AsyncClient, *, window_value: str, user_id: str | None = None) -> UsageLiveResponse:
    cutoff = utcnow() - parse_window(window_value)
    query = db.table("ss_ai_usage_minute").select(
        "minute_bucket, logical_requests, provider_calls, successful_provider_calls, total_tokens, total_cost_cny, error_count, fallback_count"
    ).gte("minute_bucket", cutoff.replace(second=0, microsecond=0).isoformat())
    if user_id:
        query = query.eq("user_id", user_id)
    result = await query.order("minute_bucket", desc=False).execute()

    buckets: dict[str, dict[str, float]] = defaultdict(lambda: {
        "logical_requests": 0, "provider_calls": 0, "successful_provider_calls": 0,
        "total_tokens": 0, "total_cost_cny": 0.0, "error_count": 0, "fallback_count": 0,
    })
    for row in result.data or []:
        b = buckets[str(row["minute_bucket"])]
        for k in ("logical_requests", "provider_calls", "successful_provider_calls", "total_tokens", "error_count", "fallback_count"):
            b[k] += safe_int(row.get(k))
        b["total_cost_cny"] += safe_float(row.get("total_cost_cny"))

    points = [
        UsageLivePoint(
            ts=t, logical_requests=safe_int(buckets.get(t.isoformat(), {}).get("logical_requests")),
            provider_calls=safe_int(buckets.get(t.isoformat(), {}).get("provider_calls")),
            successful_provider_calls=safe_int(buckets.get(t.isoformat(), {}).get("successful_provider_calls")),
            total_tokens=safe_int(buckets.get(t.isoformat(), {}).get("total_tokens")),
            total_cost_cny=round(safe_float(buckets.get(t.isoformat(), {}).get("total_cost_cny")), 6),
            error_count=safe_int(buckets.get(t.isoformat(), {}).get("error_count")),
            fallback_count=safe_int(buckets.get(t.isoformat(), {}).get("fallback_count")),
        )
        for t in window_sequence(window_value)
    ]
    pc = sum(p.provider_calls for p in points)
    ec = sum(p.error_count for p in points)
    fc = sum(p.fallback_count for p in points)
    summary = UsageMetrics(
        logical_request_count=sum(p.logical_requests for p in points),
        provider_call_count=pc, successful_provider_call_count=sum(p.successful_provider_calls for p in points),
        total_tokens=sum(p.total_tokens for p in points),
        total_cost_cny=round(sum(p.total_cost_cny for p in points), 6),
        error_rate=round(ec / pc, 4) if pc else 0.0, fallback_rate=round(fc / pc, 4) if pc else 0.0, p95_latency_ms=None,
    )
    return UsageLiveResponse(window=window_value, points=points, summary=summary)


async def get_usage_timeseries(
    db: AsyncClient, *, range_value: str, user_id: str | None = None, source_filter: str = "all",
) -> UsageTimeseriesResponse:
    cutoff = utcnow() - parse_range(range_value)
    rows = await fetch_event_rows(db, cutoff=cutoff, user_id=user_id, source_filter=source_filter)
    bkts: dict[str, UsageTimeseriesPoint] = {k: UsageTimeseriesPoint(ts=k) for k in bucket_sequence(range_value)}
    for row in rows:
        started_at = datetime.fromisoformat(str(row["started_at"]).replace("Z", "+00:00"))
        bk = bucket_key(started_at, range_value)
        pt = bkts.setdefault(bk, UsageTimeseriesPoint(ts=bk))
        tokens = safe_int(row.get("total_tokens")) if row.get("status") == "success" else 0
        cost = safe_float(row.get("cost_amount_cny")) if row.get("status") == "success" else 0.0
        if row.get("source_type") == "assistant":
            pt.assistant_calls += 1; pt.assistant_tokens += tokens; pt.assistant_cost_cny = round(pt.assistant_cost_cny + cost, 6)
        elif row.get("source_type") == "workflow":
            pt.workflow_calls += 1; pt.workflow_tokens += tokens; pt.workflow_cost_cny = round(pt.workflow_cost_cny + cost, 6)
    return UsageTimeseriesResponse(range=range_value, source=source_filter, points=list(bkts.values()))


async def get_model_breakdown(
    db: AsyncClient, *, range_value: str, user_id: str | None = None, source_filter: str = "all",
) -> ModelBreakdownResponse:
    cutoff = utcnow() - parse_range(range_value)
    rows = await fetch_event_rows(db, cutoff=cutoff, user_id=user_id, source_filter=source_filter)
    fam_map = await fetch_family_map(db)
    grouped: dict[tuple, dict] = defaultdict(lambda: {
        "provider_call_count": 0, "successful_provider_call_count": 0, "total_tokens": 0,
        "total_cost_cny": 0.0, "sku_id": None, "family_id": None, "vendor": "__unknown__", "billing_channel": "unknown",
    })
    for r in rows:
        key = (str(r.get("provider") or "__unknown__"), str(r.get("vendor") or "__unknown__"),
               str(r.get("model") or "__unknown__"), str(r.get("billing_channel") or "unknown"), str(r.get("family_id") or ""))
        g = grouped[key]
        g["provider_call_count"] += 1; g["sku_id"] = r.get("sku_id"); g["family_id"] = r.get("family_id")
        g["vendor"] = key[1]; g["billing_channel"] = key[3]
        if r.get("status") == "success":
            g["successful_provider_call_count"] += 1; g["total_tokens"] += safe_int(r.get("total_tokens"))
            g["total_cost_cny"] += safe_float(r.get("cost_amount_cny"))
    items = [
        ModelBreakdownItem(
            sku_id=str(v["sku_id"]) if v.get("sku_id") else None,
            family_id=str(v["family_id"]) if v.get("family_id") else None,
            provider=k[0], vendor=str(v["vendor"]), model=k[2], billing_channel=str(v["billing_channel"]),
            task_family=fam_map.get(k[4], {}).get("task_family"),
            provider_call_count=int(v["provider_call_count"]),
            successful_provider_call_count=int(v["successful_provider_call_count"]),
            total_tokens=int(v["total_tokens"]),
            total_cost_cny=round(float(v["total_cost_cny"]), 6),
            success_rate=round(float(v["successful_provider_call_count"]) / float(v["provider_call_count"]), 4) if v["provider_call_count"] else 0.0,
        )
        for k, v in grouped.items()
    ]
    items.sort(key=lambda i: (i.total_cost_cny, i.total_tokens, i.provider_call_count), reverse=True)
    return ModelBreakdownResponse(range=range_value, source=source_filter, items=items)


async def get_recent_calls(db: AsyncClient, *, limit: int, user_id: str | None = None) -> RecentCallsResponse:
    query = db.table("ss_ai_usage_events").select(
        "id, request_id, source_type, source_subtype, sku_id, family_id, provider, vendor, model, "
        "billing_channel, node_id, status, is_fallback, latency_ms, total_tokens, cost_amount_cny, started_at"
    ).order("started_at", desc=True).limit(limit)
    if user_id:
        query = query.eq("user_id", user_id)
    result = await query.execute()
    return RecentCallsResponse(calls=[
        RecentCallItem(
            id=str(r["id"]), request_id=str(r["request_id"]),
            source_type=r["source_type"], source_subtype=r["source_subtype"],
            sku_id=str(r["sku_id"]) if r.get("sku_id") else None,
            family_id=str(r["family_id"]) if r.get("family_id") else None,
            provider=str(r.get("provider") or "__unknown__"), vendor=str(r.get("vendor") or "__unknown__"),
            model=str(r.get("model") or "__unknown__"), billing_channel=str(r.get("billing_channel") or "unknown"),
            node_id=r.get("node_id"), status=r.get("status") or "error",
            is_fallback=bool(r.get("is_fallback")),
            latency_ms=safe_int(r.get("latency_ms")) if r.get("latency_ms") is not None else None,
            total_tokens=safe_int(r.get("total_tokens")),
            cost_amount_cny=round(safe_float(r.get("cost_amount_cny")), 6),
            started_at=datetime.fromisoformat(str(r["started_at"]).replace("Z", "+00:00")),
        )
        for r in (result.data or [])
    ])


async def get_cost_split(db: AsyncClient, *, range_value: str, user_id: str | None = None) -> CostSplitResponse:
    cutoff = utcnow() - parse_range(range_value)
    rows = await fetch_event_rows(db, cutoff=cutoff, user_id=user_id)
    grouped: dict[str, dict[str, float]] = defaultdict(lambda: {"provider_call_count": 0, "total_tokens": 0, "total_cost_cny": 0.0})
    for r in rows:
        st = str(r.get("source_type") or "assistant")
        grouped[st]["provider_call_count"] += 1
        if r.get("status") == "success":
            grouped[st]["total_tokens"] += safe_int(r.get("total_tokens"))
            grouped[st]["total_cost_cny"] += safe_float(r.get("cost_amount_cny"))
    items = [
        CostSplitItem(source_type=st, provider_call_count=int(v["provider_call_count"]),
                       total_tokens=int(v["total_tokens"]), total_cost_cny=round(float(v["total_cost_cny"]), 6))
        for st, v in grouped.items()
    ]
    items.sort(key=lambda i: i.source_type)
    return CostSplitResponse(range=range_value, items=items)
