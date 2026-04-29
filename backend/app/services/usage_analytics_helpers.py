"""Usage analytics helpers — time parsing, bucketing, metrics computation, data fetching."""

from datetime import datetime, timedelta, timezone
from statistics import quantiles

from supabase import AsyncClient

from app.models.usage import UsageMetrics

UTC = timezone.utc


def utcnow() -> datetime:
    return datetime.now(UTC)


def parse_range(range_value: str) -> timedelta:
    return {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30), "90d": timedelta(days=90), "all": timedelta(days=3650)}[range_value]


def parse_window(window_value: str) -> timedelta:
    return {"5m": timedelta(minutes=5), "60m": timedelta(minutes=60)}[window_value]


def bucket_key(ts: datetime, range_value: str) -> str:
    if range_value == "24h":
        return ts.astimezone(UTC).replace(minute=0, second=0, microsecond=0).isoformat()
    return ts.astimezone(UTC).date().isoformat()


def bucket_sequence(range_value: str) -> list[str]:
    now = utcnow()
    if range_value == "24h":
        start = (now - timedelta(hours=23)).replace(minute=0, second=0, microsecond=0)
        return [(start + timedelta(hours=i)).isoformat() for i in range(24)]
    if range_value == "all":
        days = 90
    else:
        days = 7 if range_value == "7d" else 30
    start_date = (now - timedelta(days=days - 1)).date()
    return [(start_date + timedelta(days=i)).isoformat() for i in range(days)]


def window_sequence(window_value: str) -> list[datetime]:
    now = utcnow().replace(second=0, microsecond=0)
    minutes = 5 if window_value == "5m" else 60
    start = now - timedelta(minutes=minutes - 1)
    return [start + timedelta(minutes=i) for i in range(minutes)]


def safe_int(value: object) -> int:
    return int(value or 0)


def safe_float(value: object) -> float:
    return float(value or 0.0)


def compute_metrics(request_rows: list[dict], event_rows: list[dict], source_type: str | None) -> UsageMetrics:
    filtered_requests = [r for r in request_rows if source_type is None or r.get("source_type") == source_type]
    filtered_events = [r for r in event_rows if source_type is None or r.get("source_type") == source_type]
    provider_call_count = len(filtered_events)
    successful = [r for r in filtered_events if r.get("status") == "success"]
    error_count = provider_call_count - len(successful)
    fallback_count = sum(1 for r in filtered_events if bool(r.get("is_fallback")))
    latencies = [safe_int(r.get("latency_ms")) for r in successful if r.get("latency_ms") is not None]
    p95: int | None = None
    if len(latencies) == 1:
        p95 = latencies[0]
    elif len(latencies) > 1:
        p95 = int(quantiles(latencies, n=100, method="inclusive")[94])
    return UsageMetrics(
        logical_request_count=len(filtered_requests),
        provider_call_count=provider_call_count,
        successful_provider_call_count=len(successful),
        total_tokens=sum(safe_int(r.get("total_tokens")) for r in successful),
        total_cost_cny=round(sum(safe_float(r.get("cost_amount_cny")) for r in successful), 6),
        error_rate=round(error_count / provider_call_count, 4) if provider_call_count else 0.0,
        fallback_rate=round(fallback_count / provider_call_count, 4) if provider_call_count else 0.0,
        p95_latency_ms=p95,
    )


_EVENT_COLS = (
    "id, request_id, source_type, source_subtype, sku_id, family_id, provider, vendor, model, "
    "billing_channel, node_id, status, is_fallback, latency_ms, total_tokens, cost_amount_cny, started_at"
)


async def fetch_request_rows(db: AsyncClient, *, cutoff: datetime, user_id: str | None = None) -> list[dict]:
    query = db.table("ss_ai_requests").select("id, source_type, source_subtype, status, started_at").gte("started_at", cutoff.isoformat())
    if user_id:
        query = query.eq("user_id", user_id)
    return (await query.execute()).data or []


async def fetch_event_rows(db: AsyncClient, *, cutoff: datetime, user_id: str | None = None, source_filter: str = "all") -> list[dict]:
    query = db.table("ss_ai_usage_events").select(_EVENT_COLS).gte("started_at", cutoff.isoformat())
    if user_id:
        query = query.eq("user_id", user_id)
    if source_filter != "all":
        query = query.eq("source_type", source_filter)
    return (await query.order("started_at", desc=False).execute()).data or []


async def fetch_family_map(db: AsyncClient) -> dict[str, dict]:
    result = await db.table("ai_model_families").select("id, task_family, family_name").execute()
    return {str(r["id"]): r for r in (result.data or [])}
