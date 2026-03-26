"""AI router using YAML task routes + Supabase catalog-backed SKUs."""

import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

from openai import APIError, APITimeoutError, AsyncOpenAI

from app.core.config_loader import get_config
from app.models.ai_catalog import CatalogSku
from app.services.ai_catalog_service import (
    get_sku_by_provider_model,
    normalize_provider_key,
    resolve_task_route_skus,
)
from app.services.usage_ledger import (
    UsageNumbers,
    UsagePricing,
    estimate_usage_from_messages,
    parse_openai_usage,
    record_usage_event,
    utcnow,
)

logger = logging.getLogger(__name__)


class AIRouterError(Exception):
    """Raised when all route options are exhausted."""


@dataclass(slots=True)
class LLMCallResult:
    content: str
    provider: str
    model: str
    usage: UsageNumbers
    request_meta: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class LLMStreamResult:
    provider: str = ""
    model: str = ""
    usage: UsageNumbers | None = None
    content: str = ""
    request_meta: dict[str, Any] = field(default_factory=dict)
    token_stream: AsyncIterator[str] | None = None


def _get_provider_config(provider_name: str) -> dict[str, Any]:
    normalized = normalize_provider_key(provider_name)
    config = get_config().get("providers", {})
    provider = config.get(normalized)
    if not provider:
        raise AIRouterError(f"Unknown provider: {provider_name}")
    return provider


def _get_client(provider_name: str) -> AsyncOpenAI:
    provider = _get_provider_config(provider_name)
    return AsyncOpenAI(
        base_url=provider["base_url"],
        api_key=provider["api_key"],
        timeout=float(get_config().get("engine", {}).get("timeout_ms", 30000)) / 1000,
    )


def _is_provider_configured(provider_name: str) -> bool:
    provider = _get_provider_config(provider_name)
    base_url = str(provider.get("base_url", "")).strip()
    api_key = str(provider.get("api_key", "")).strip()
    return bool(base_url and api_key and not base_url.startswith("$") and not api_key.startswith("$"))


def _pricing_from_sku(sku: CatalogSku | None) -> UsagePricing:
    if sku is None:
        return UsagePricing()
    return UsagePricing(
        input_price_cny_per_million=sku.input_price_cny_per_million,
        output_price_cny_per_million=sku.output_price_cny_per_million,
    )


async def _record_error_attempt(
    *,
    attempt_index: int,
    is_fallback: bool,
    started_at,
    finished_at,
    sku: CatalogSku | None,
    provider_name: str,
    model_name: str,
) -> None:
    await record_usage_event(
        provider=provider_name,
        model=model_name,
        status="error",
        usage=UsageNumbers(),
        pricing=_pricing_from_sku(sku),
        attempt_index=attempt_index,
        is_fallback=is_fallback,
        started_at=started_at,
        finished_at=finished_at,
        sku_id=sku.sku_id if sku else None,
        family_id=sku.family_id if sku else None,
        vendor=sku.vendor if sku else None,
        billing_channel=sku.billing_channel if sku else None,
    )


async def _call_non_stream(
    *,
    sku: CatalogSku | None,
    provider_name: str,
    model_name: str,
    messages: list[dict],
    attempt_index: int,
    is_fallback: bool,
) -> LLMCallResult:
    client = _get_client(provider_name)
    started_at = utcnow()
    response = await client.chat.completions.create(
        model=model_name,
        messages=messages,
        stream=False,
    )
    finished_at = utcnow()

    content = response.choices[0].message.content or ""
    usage = parse_openai_usage(getattr(response, "usage", None))
    if usage.total_tokens <= 0:
        usage = estimate_usage_from_messages(messages, content)

    request_meta = {
        "attempt_index": attempt_index,
        "is_fallback": is_fallback,
        "provider_request_id": getattr(response, "id", None),
        "sku_id": sku.sku_id if sku else None,
    }
    await record_usage_event(
        provider=provider_name,
        model=model_name,
        status="success",
        usage=usage,
        pricing=_pricing_from_sku(sku),
        attempt_index=attempt_index,
        is_fallback=is_fallback,
        started_at=started_at,
        finished_at=finished_at,
        sku_id=sku.sku_id if sku else None,
        family_id=sku.family_id if sku else None,
        vendor=sku.vendor if sku else None,
        billing_channel=sku.billing_channel if sku else None,
        provider_request_id=request_meta["provider_request_id"],
    )
    return LLMCallResult(
        content=content,
        provider=provider_name,
        model=model_name,
        usage=usage,
        request_meta=request_meta,
    )


async def _stream_tokens(
    client: AsyncOpenAI,
    model_name: str,
    messages: list[dict],
    result: LLMStreamResult,
) -> AsyncIterator[str]:
    try:
        stream = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            stream=True,
            stream_options={"include_usage": True},
        )
    except APIError:
        stream = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            stream=True,
        )

    in_thinking = False
    content_parts: list[str] = []
    usage = UsageNumbers()
    provider_request_id: str | None = None

    async for chunk in stream:
        if provider_request_id is None:
            provider_request_id = getattr(chunk, "id", None)
        chunk_usage = parse_openai_usage(getattr(chunk, "usage", None))
        if chunk_usage.total_tokens > 0:
            usage = chunk_usage
        if getattr(chunk, "model", None):
            result.model = str(chunk.model)

        choice = chunk.choices[0] if chunk.choices else None
        delta = getattr(choice, "delta", None)
        if delta is None:
            continue

        reasoning = getattr(delta, "reasoning_content", None)
        if reasoning:
            if not in_thinking:
                content_parts.append("<think>")
                yield "<think>"
                in_thinking = True
            content_parts.append(reasoning)
            yield reasoning

        content = getattr(delta, "content", None)
        if content:
            if in_thinking:
                content_parts.append("</think>")
                yield "</think>"
                in_thinking = False
            content_parts.append(content)
            yield content

    if in_thinking:
        content_parts.append("</think>")
        yield "</think>"

    result.content = "".join(content_parts)
    result.usage = usage if usage.total_tokens > 0 else estimate_usage_from_messages(messages, result.content)
    result.request_meta["provider_request_id"] = provider_request_id


def _empty_stream() -> AsyncIterator[str]:
    async def _stream() -> AsyncIterator[str]:
        if False:
            yield ""

    return _stream()


async def _build_route_candidates(node_type: str) -> list[CatalogSku]:
    try:
        candidates = await resolve_task_route_skus(node_type)
    except KeyError as exc:
        raise AIRouterError(f"Unknown task route: {node_type}") from exc
    filtered = [sku for sku in candidates if _is_provider_configured(sku.provider)]
    if not filtered:
        raise AIRouterError(f"No configured route candidates for task '{node_type}'")
    return filtered


async def call_llm_direct_structured(
    platform_name: str,
    model_name: str,
    messages: list[dict],
    stream: bool = False,
) -> LLMCallResult | LLMStreamResult:
    normalized_provider = normalize_provider_key(platform_name)
    if not _is_provider_configured(normalized_provider):
        logger.warning("Direct call target '%s' not configured, falling back to chat_response route", normalized_provider)
        return await call_llm_structured("chat_response", messages, stream=stream)

    sku = await get_sku_by_provider_model(normalized_provider, model_name)
    if stream:
        client = _get_client(normalized_provider)
        result = LLMStreamResult(
            provider=normalized_provider,
            model=model_name,
            request_meta={"attempt_index": 1, "is_fallback": False, "sku_id": sku.sku_id if sku else None},
        )

        async def token_stream() -> AsyncIterator[str]:
            started_at = utcnow()
            yielded_any = False
            try:
                async for token in _stream_tokens(client, model_name, messages, result):
                    yielded_any = True
                    yield token
                await record_usage_event(
                    provider=result.provider,
                    model=result.model or model_name,
                    status="success",
                    usage=result.usage or UsageNumbers(),
                    pricing=_pricing_from_sku(sku),
                    attempt_index=1,
                    is_fallback=False,
                    started_at=started_at,
                    finished_at=utcnow(),
                    sku_id=sku.sku_id if sku else None,
                    family_id=sku.family_id if sku else None,
                    vendor=sku.vendor if sku else None,
                    billing_channel=sku.billing_channel if sku else None,
                    provider_request_id=result.request_meta.get("provider_request_id"),
                )
            except (APITimeoutError, APIError) as exc:
                await _record_error_attempt(
                    attempt_index=1,
                    is_fallback=False,
                    started_at=started_at,
                    finished_at=utcnow(),
                    sku=sku,
                    provider_name=normalized_provider,
                    model_name=model_name,
                )
                logger.warning("Direct streaming call to '%s/%s' failed: %s", normalized_provider, model_name, exc)
                if yielded_any:
                    raise AIRouterError(f"Streaming interrupted on {normalized_provider}/{model_name}: {exc}") from exc
                fallback_result = await call_llm_structured("chat_response", messages, stream=True)
                assert isinstance(fallback_result, LLMStreamResult)
                result.provider = fallback_result.provider
                result.model = fallback_result.model
                result.request_meta = fallback_result.request_meta
                async for token in fallback_result.token_stream or _empty_stream():
                    yield token
                result.usage = fallback_result.usage
                result.content = fallback_result.content

        result.token_stream = token_stream()
        return result

    try:
        return await _call_non_stream(
            sku=sku,
            provider_name=normalized_provider,
            model_name=model_name,
            messages=messages,
            attempt_index=1,
            is_fallback=False,
        )
    except (APITimeoutError, APIError) as exc:
        await _record_error_attempt(
            attempt_index=1,
            is_fallback=False,
            started_at=utcnow(),
            finished_at=utcnow(),
            sku=sku,
            provider_name=normalized_provider,
            model_name=model_name,
        )
        logger.warning("Direct call to '%s/%s' failed: %s, falling back", normalized_provider, model_name, exc)
        return await call_llm_structured("chat_response", messages, stream=stream)


async def call_llm_structured(
    node_type: str,
    messages: list[dict],
    stream: bool = False,
) -> LLMCallResult | LLMStreamResult:
    candidates = await _build_route_candidates(node_type)

    if stream:
        result = LLMStreamResult()

        async def token_stream() -> AsyncIterator[str]:
            errors: list[str] = []

            for index, sku in enumerate(candidates, start=1):
                provider_name = sku.provider
                model_name = sku.model_id
                is_fallback = index > 1
                result.provider = provider_name
                result.model = model_name
                result.request_meta = {
                    "attempt_index": index,
                    "is_fallback": is_fallback,
                    "sku_id": sku.sku_id,
                }

                yielded_any = False
                started_at = utcnow()
                try:
                    client = _get_client(provider_name)
                    async for token in _stream_tokens(client, model_name, messages, result):
                        yielded_any = True
                        yield token
                    await record_usage_event(
                        provider=result.provider,
                        model=result.model or model_name,
                        status="success",
                        usage=result.usage or UsageNumbers(),
                        pricing=_pricing_from_sku(sku),
                        attempt_index=index,
                        is_fallback=is_fallback,
                        started_at=started_at,
                        finished_at=utcnow(),
                        sku_id=sku.sku_id,
                        family_id=sku.family_id,
                        vendor=sku.vendor,
                        billing_channel=sku.billing_channel,
                        provider_request_id=result.request_meta.get("provider_request_id"),
                    )
                    return
                except (APITimeoutError, APIError) as exc:
                    await _record_error_attempt(
                        attempt_index=index,
                        is_fallback=is_fallback,
                        started_at=started_at,
                        finished_at=utcnow(),
                        sku=sku,
                        provider_name=provider_name,
                        model_name=model_name,
                    )
                    logger.warning(
                        "Streaming provider '%s' model '%s' failed: %s, trying next route candidate",
                        provider_name,
                        model_name,
                        exc,
                    )
                    if yielded_any:
                        raise AIRouterError(f"Streaming interrupted on {provider_name}/{model_name}: {exc}") from exc
                    errors.append(f"{provider_name}/{model_name}: {exc}")
                    continue

            raise AIRouterError(f"All route options for '{node_type}' exhausted. Errors: {' | '.join(errors)}")

        result.token_stream = token_stream()
        return result

    errors: list[str] = []
    for index, sku in enumerate(candidates, start=1):
        provider_name = sku.provider
        model_name = sku.model_id
        is_fallback = index > 1
        started_at = utcnow()
        try:
            return await _call_non_stream(
                sku=sku,
                provider_name=provider_name,
                model_name=model_name,
                messages=messages,
                attempt_index=index,
                is_fallback=is_fallback,
            )
        except (APITimeoutError, APIError) as exc:
            await _record_error_attempt(
                attempt_index=index,
                is_fallback=is_fallback,
                started_at=started_at,
                finished_at=utcnow(),
                sku=sku,
                provider_name=provider_name,
                model_name=model_name,
            )
            logger.warning(
                "Provider '%s' model '%s' failed: %s, trying next route candidate",
                provider_name,
                model_name,
                exc,
            )
            errors.append(f"{provider_name}/{model_name}: {exc}")
            continue

    raise AIRouterError(f"All route options for '{node_type}' exhausted. Errors: {' | '.join(errors)}")


async def call_llm_direct(
    platform_name: str,
    model_name: str,
    messages: list[dict],
    stream: bool = False,
) -> str | AsyncIterator[str]:
    result = await call_llm_direct_structured(platform_name, model_name, messages, stream=stream)
    if stream:
        assert isinstance(result, LLMStreamResult)
        return result.token_stream or _empty_stream()
    assert isinstance(result, LLMCallResult)
    return result.content


async def call_llm(
    node_type: str,
    messages: list[dict],
    stream: bool = False,
) -> str | AsyncIterator[str]:
    result = await call_llm_structured(node_type, messages, stream=stream)
    if stream:
        assert isinstance(result, LLMStreamResult)
        return result.token_stream or _empty_stream()
    assert isinstance(result, LLMCallResult)
    return result.content
