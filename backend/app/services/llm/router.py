"""AI router — task-based routing with fallback + direct model calls."""

import logging
from collections.abc import AsyncIterator

from openai import APIError, APITimeoutError

from app.services.ai_catalog_service import (
    get_sku_by_provider_model,
    normalize_provider_key,
    resolve_task_route_skus,
)
from app.services.llm.caller import (
    LLMCallResult,
    LLMStreamResult,
    call_non_stream,
    empty_stream,
    stream_tokens,
)
from app.services.llm.provider import (
    AIRouterError,
    get_client,
    is_provider_configured,
    pricing_from_sku,
    record_error_attempt,
)
from app.services.usage_ledger import UsageNumbers, record_usage_event, utcnow

logger = logging.getLogger(__name__)

# Re-export for backward compatibility
__all__ = [
    "AIRouterError", "LLMCallResult", "LLMStreamResult",
    "call_llm", "call_llm_direct", "call_llm_structured", "call_llm_direct_structured",
]


async def _build_route_candidates(node_type: str):
    try:
        candidates = await resolve_task_route_skus(node_type)
    except KeyError as exc:
        raise AIRouterError(f"Unknown task route: {node_type}") from exc
    filtered = [sku for sku in candidates if is_provider_configured(sku.provider)]
    if not filtered:
        raise AIRouterError(f"No configured route candidates for task '{node_type}'")
    return filtered


async def call_llm_direct_structured(
    platform_name: str, model_name: str, messages: list[dict], stream: bool = False,
) -> LLMCallResult | LLMStreamResult:
    normalized_provider = normalize_provider_key(platform_name)
    if not is_provider_configured(normalized_provider):
        logger.warning("Direct call target '%s' not configured, falling back", normalized_provider)
        return await call_llm_structured("chat_response", messages, stream=stream)

    sku = await get_sku_by_provider_model(normalized_provider, model_name)
    if stream:
        client = get_client(normalized_provider)
        result = LLMStreamResult()
        result.provider = normalized_provider
        result.model = model_name
        result.request_meta = {"attempt_index": 1, "is_fallback": False, "sku_id": sku.sku_id if sku else None}

        async def token_gen() -> AsyncIterator[str]:
            started_at = utcnow()
            yielded_any = False
            try:
                async for token in stream_tokens(client, model_name, messages, result):
                    yielded_any = True
                    yield token
                await record_usage_event(
                    provider=result.provider, model=result.model or model_name, status="success",
                    usage=result.usage or UsageNumbers(), pricing=pricing_from_sku(sku),
                    attempt_index=1, is_fallback=False, started_at=started_at, finished_at=utcnow(),
                    sku_id=sku.sku_id if sku else None, family_id=sku.family_id if sku else None,
                    vendor=sku.vendor if sku else None, billing_channel=sku.billing_channel if sku else None,
                    provider_request_id=result.request_meta.get("provider_request_id"),
                )
            except (APITimeoutError, APIError) as exc:
                await record_error_attempt(
                    attempt_index=1, is_fallback=False, started_at=started_at, finished_at=utcnow(),
                    sku=sku, provider_name=normalized_provider, model_name=model_name,
                )
                logger.warning("Direct streaming '%s/%s' failed: %s", normalized_provider, model_name, exc)
                if yielded_any:
                    raise AIRouterError(f"Streaming interrupted: {exc}") from exc
                fb = await call_llm_structured("chat_response", messages, stream=True)
                assert isinstance(fb, LLMStreamResult)
                result.provider = fb.provider
                result.model = fb.model
                result.request_meta = fb.request_meta
                async for t in fb.token_stream or empty_stream():
                    yield t
                result.usage = fb.usage
                result.content = fb.content

        result.token_stream = token_gen()
        return result

    try:
        return await call_non_stream(
            sku=sku, provider_name=normalized_provider, model_name=model_name,
            messages=messages, attempt_index=1, is_fallback=False,
        )
    except (APITimeoutError, APIError) as exc:
        await record_error_attempt(
            attempt_index=1, is_fallback=False, started_at=utcnow(), finished_at=utcnow(),
            sku=sku, provider_name=normalized_provider, model_name=model_name,
        )
        logger.warning("Direct call '%s/%s' failed: %s, falling back", normalized_provider, model_name, exc)
        return await call_llm_structured("chat_response", messages, stream=stream)


async def call_llm_structured(
    node_type: str, messages: list[dict], stream: bool = False,
) -> LLMCallResult | LLMStreamResult:
    candidates = await _build_route_candidates(node_type)

    if stream:
        result = LLMStreamResult()

        async def token_gen() -> AsyncIterator[str]:
            errors: list[str] = []
            for index, sku in enumerate(candidates, start=1):
                is_fallback = index > 1
                result.provider = sku.provider
                result.model = sku.model_id
                result.request_meta = {"attempt_index": index, "is_fallback": is_fallback, "sku_id": sku.sku_id}
                yielded_any = False
                started_at = utcnow()
                try:
                    client = get_client(sku.provider)
                    async for token in stream_tokens(client, sku.model_id, messages, result):
                        yielded_any = True
                        yield token
                    await record_usage_event(
                        provider=result.provider, model=result.model or sku.model_id, status="success",
                        usage=result.usage or UsageNumbers(), pricing=pricing_from_sku(sku),
                        attempt_index=index, is_fallback=is_fallback, started_at=started_at, finished_at=utcnow(),
                        sku_id=sku.sku_id, family_id=sku.family_id, vendor=sku.vendor,
                        billing_channel=sku.billing_channel,
                        provider_request_id=result.request_meta.get("provider_request_id"),
                    )
                    return
                except (APITimeoutError, APIError) as exc:
                    await record_error_attempt(
                        attempt_index=index, is_fallback=is_fallback, started_at=started_at, finished_at=utcnow(),
                        sku=sku, provider_name=sku.provider, model_name=sku.model_id,
                    )
                    logger.warning("Streaming '%s/%s' failed: %s", sku.provider, sku.model_id, exc)
                    if yielded_any:
                        raise AIRouterError(f"Streaming interrupted: {exc}") from exc
                    errors.append(f"{sku.provider}/{sku.model_id}: {exc}")
            raise AIRouterError(f"All routes for '{node_type}' exhausted: {' | '.join(errors)}")

        result.token_stream = token_gen()
        return result

    errors: list[str] = []
    for index, sku in enumerate(candidates, start=1):
        started_at = utcnow()
        try:
            return await call_non_stream(
                sku=sku, provider_name=sku.provider, model_name=sku.model_id,
                messages=messages, attempt_index=index, is_fallback=index > 1,
            )
        except (APITimeoutError, APIError) as exc:
            await record_error_attempt(
                attempt_index=index, is_fallback=index > 1, started_at=started_at, finished_at=utcnow(),
                sku=sku, provider_name=sku.provider, model_name=sku.model_id,
            )
            logger.warning("Provider '%s/%s' failed: %s", sku.provider, sku.model_id, exc)
            errors.append(f"{sku.provider}/{sku.model_id}: {exc}")
    raise AIRouterError(f"All routes for '{node_type}' exhausted: {' | '.join(errors)}")


async def call_llm_direct(
    platform_name: str, model_name: str, messages: list[dict], stream: bool = False,
) -> str | AsyncIterator[str]:
    result = await call_llm_direct_structured(platform_name, model_name, messages, stream=stream)
    if stream:
        assert isinstance(result, LLMStreamResult)
        return result.token_stream or empty_stream()
    assert isinstance(result, LLMCallResult)
    return result.content


async def call_llm(
    node_type: str, messages: list[dict], stream: bool = False,
) -> str | AsyncIterator[str]:
    result = await call_llm_structured(node_type, messages, stream=stream)
    if stream:
        assert isinstance(result, LLMStreamResult)
        return result.token_stream or empty_stream()
    assert isinstance(result, LLMCallResult)
    return result.content
