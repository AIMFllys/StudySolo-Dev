import math
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.core.database import get_db

UTC = timezone.utc
REQUEST_PROVIDER_SENTINEL = "__all__"
MODEL_UNKNOWN_SENTINEL = "__unknown__"
REQUEST_SKU_SENTINEL = "__request__"
REQUEST_VENDOR_SENTINEL = "__request__"
REQUEST_BILLING_CHANNEL = "request"


@dataclass(slots=True)
class BoundUsageRequest:
    request_id: str
    user_id: str
    source_type: str
    source_subtype: str
    workflow_id: str | None = None
    workflow_run_id: str | None = None
    conversation_id: str | None = None
    message_id: str | None = None


@dataclass(slots=True)
class BoundUsageCall:
    node_id: str | None = None
    node_type: str | None = None


@dataclass(slots=True)
class UsageNumbers:
    input_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int = 0
    cached_tokens: int = 0
    total_tokens: int = 0


@dataclass(slots=True)
class UsagePricing:
    input_price_cny_per_million: float = 0.0
    output_price_cny_per_million: float = 0.0


_request_context: ContextVar[BoundUsageRequest | None] = ContextVar(
    "usage_request_context",
    default=None,
)
_call_context: ContextVar[BoundUsageCall | None] = ContextVar(
    "usage_call_context",
    default=None,
)
def utcnow() -> datetime:
    return datetime.now(UTC)


def normalize_provider(value: str | None) -> str:
    return (value or MODEL_UNKNOWN_SENTINEL).strip() or MODEL_UNKNOWN_SENTINEL


def normalize_model(value: str | None) -> str:
    return (value or MODEL_UNKNOWN_SENTINEL).strip() or MODEL_UNKNOWN_SENTINEL


def bucket_to_minute(dt: datetime) -> datetime:
    return dt.astimezone(UTC).replace(second=0, microsecond=0)


def estimate_token_count(text: str) -> int:
    normalized = text.strip()
    if not normalized:
        return 0
    return max(1, math.ceil(len(normalized) / 4))


def estimate_usage_from_messages(messages: list[dict[str, Any]], output_text: str) -> UsageNumbers:
    input_text = "\n".join(str(message.get("content", "")) for message in messages)
    input_tokens = estimate_token_count(input_text)
    output_tokens = estimate_token_count(output_text)
    return UsageNumbers(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
    )


def parse_openai_usage(usage: Any) -> UsageNumbers:
    if usage is None:
        return UsageNumbers()

    prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
    total_tokens = int(getattr(usage, "total_tokens", 0) or 0)
    prompt_details = getattr(usage, "prompt_tokens_details", None)
    completion_details = getattr(usage, "completion_tokens_details", None)
    cached_tokens = int(getattr(prompt_details, "cached_tokens", 0) or 0) if prompt_details else 0
    reasoning_tokens = (
        int(getattr(completion_details, "reasoning_tokens", 0) or 0)
        if completion_details
        else 0
    )

    if total_tokens <= 0:
        total_tokens = prompt_tokens + completion_tokens

    return UsageNumbers(
        input_tokens=prompt_tokens,
        output_tokens=completion_tokens,
        reasoning_tokens=reasoning_tokens,
        cached_tokens=cached_tokens,
        total_tokens=total_tokens,
    )


@contextmanager
def bind_usage_request(request: BoundUsageRequest):
    token = _request_context.set(request)
    try:
        yield request
    finally:
        _request_context.reset(token)


@contextmanager
def bind_usage_call(node_id: str | None = None, node_type: str | None = None):
    token = _call_context.set(BoundUsageCall(node_id=node_id, node_type=node_type))
    try:
        yield
    finally:
        _call_context.reset(token)


def get_bound_usage_request() -> BoundUsageRequest | None:
    return _request_context.get()


def get_bound_usage_call() -> BoundUsageCall | None:
    return _call_context.get()


async def create_usage_request(
    *,
    user_id: str,
    source_type: str,
    source_subtype: str,
    workflow_id: str | None = None,
    workflow_run_id: str | None = None,
    conversation_id: str | None = None,
    message_id: str | None = None,
) -> BoundUsageRequest:
    db = await get_db()
    started_at = utcnow()
    result = (
        await db.table("ss_ai_requests")
        .insert({
            "user_id": user_id,
            "source_type": source_type,
            "source_subtype": source_subtype,
            "workflow_id": workflow_id,
            "workflow_run_id": workflow_run_id,
            "conversation_id": conversation_id,
            "message_id": message_id,
            "status": "running",
            "started_at": started_at.isoformat(),
        })
        .execute()
    )
    row = (result.data or [{}])[0]
    request = BoundUsageRequest(
        request_id=str(row.get("id")),
        user_id=user_id,
        source_type=source_type,
        source_subtype=source_subtype,
        workflow_id=workflow_id,
        workflow_run_id=workflow_run_id,
        conversation_id=conversation_id,
        message_id=message_id,
    )
    await _increment_minute_rollup(
        minute_bucket=bucket_to_minute(started_at),
        user_id=user_id,
        source_type=source_type,
        source_subtype=source_subtype,
        logical_requests=1,
    )
    return request


async def finalize_usage_request(request_id: str, status: str) -> None:
    db = await get_db()
    await (
        db.table("ss_ai_requests")
        .update({
            "status": status,
            "finished_at": utcnow().isoformat(),
        })
        .eq("id", request_id)
        .execute()
    )


def calculate_cost_cny(
    *,
    usage: UsageNumbers,
    pricing: UsagePricing,
) -> float:
    input_cost = usage.input_tokens * pricing.input_price_cny_per_million / 1_000_000
    output_cost = usage.output_tokens * pricing.output_price_cny_per_million / 1_000_000
    return round(input_cost + output_cost, 8)


async def record_usage_event(
    *,
    provider: str,
    model: str,
    status: str,
    usage: UsageNumbers,
    pricing: UsagePricing | None = None,
    attempt_index: int,
    is_fallback: bool,
    started_at: datetime,
    finished_at: datetime,
    sku_id: str | None = None,
    family_id: str | None = None,
    vendor: str | None = None,
    billing_channel: str | None = None,
    provider_request_id: str | None = None,
) -> None:
    request = get_bound_usage_request()
    if request is None:
        return

    call_context = get_bound_usage_call()
    db = await get_db()
    latency_ms = max(0, int((finished_at - started_at).total_seconds() * 1000))
    resolved_pricing = pricing or UsagePricing()
    cost_amount_cny = calculate_cost_cny(usage=usage, pricing=resolved_pricing)

    await (
        db.table("ss_ai_usage_events")
        .insert({
            "request_id": request.request_id,
            "user_id": request.user_id,
            "source_type": request.source_type,
            "source_subtype": request.source_subtype,
            "provider": normalize_provider(provider),
            "model": normalize_model(model),
            "sku_id": sku_id,
            "family_id": family_id,
            "vendor": vendor,
            "billing_channel": billing_channel,
            "node_id": call_context.node_id if call_context else None,
            "attempt_index": attempt_index,
            "is_fallback": is_fallback,
            "status": status,
            "latency_ms": latency_ms,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "reasoning_tokens": usage.reasoning_tokens,
            "cached_tokens": usage.cached_tokens,
            "total_tokens": usage.total_tokens,
            "input_price_cny_per_million": resolved_pricing.input_price_cny_per_million,
            "output_price_cny_per_million": resolved_pricing.output_price_cny_per_million,
            "cost_amount_cny": cost_amount_cny,
            "provider_request_id": provider_request_id,
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
        })
        .execute()
    )

    await _increment_minute_rollup(
        minute_bucket=bucket_to_minute(started_at),
        user_id=request.user_id,
        source_type=request.source_type,
        source_subtype=request.source_subtype,
        provider=provider,
        model=model,
        sku_id=sku_id or REQUEST_SKU_SENTINEL,
        family_id=family_id or REQUEST_SKU_SENTINEL,
        vendor=vendor or REQUEST_VENDOR_SENTINEL,
        billing_channel=billing_channel or REQUEST_BILLING_CHANNEL,
        provider_calls=1,
        successful_provider_calls=1 if status == "success" else 0,
        total_tokens=usage.total_tokens if status == "success" else 0,
        total_cost_cny=cost_amount_cny if status == "success" else 0.0,
        error_count=0 if status == "success" else 1,
        fallback_count=1 if is_fallback else 0,
        latency_ms_sum=latency_ms,
        latency_ms_count=1,
    )


async def _increment_minute_rollup(
    *,
    minute_bucket: datetime,
    user_id: str,
    source_type: str,
    source_subtype: str,
    provider: str = REQUEST_PROVIDER_SENTINEL,
    model: str = REQUEST_PROVIDER_SENTINEL,
    sku_id: str = REQUEST_SKU_SENTINEL,
    family_id: str = REQUEST_SKU_SENTINEL,
    vendor: str = REQUEST_VENDOR_SENTINEL,
    billing_channel: str = REQUEST_BILLING_CHANNEL,
    logical_requests: int = 0,
    provider_calls: int = 0,
    successful_provider_calls: int = 0,
    total_tokens: int = 0,
    total_cost_cny: float = 0.0,
    error_count: int = 0,
    fallback_count: int = 0,
    latency_ms_sum: int = 0,
    latency_ms_count: int = 0,
) -> None:
    db = await get_db()
    await db.rpc(
        "fn_ss_ai_usage_minute_increment",
        {
            "p_minute_bucket": minute_bucket.isoformat(),
            "p_user_id": user_id,
            "p_source_type": source_type,
            "p_source_subtype": source_subtype,
            "p_provider": normalize_provider(provider),
            "p_model": normalize_model(model),
            "p_sku_id": sku_id,
            "p_family_id": family_id,
            "p_vendor": vendor,
            "p_billing_channel": billing_channel,
            "p_logical_requests": logical_requests,
            "p_provider_calls": provider_calls,
            "p_successful_provider_calls": successful_provider_calls,
            "p_total_tokens": total_tokens,
            "p_total_cost_cny": total_cost_cny,
            "p_error_count": error_count,
            "p_fallback_count": fallback_count,
            "p_latency_ms_sum": latency_ms_sum,
            "p_latency_ms_count": latency_ms_count,
        },
    ).execute()
