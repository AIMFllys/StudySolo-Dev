"""Low-level LLM call helpers — non-streaming and streaming token generation."""

from collections.abc import AsyncIterator
from typing import Any

from openai import APIError, AsyncOpenAI

from app.models.ai_catalog import CatalogSku
from app.services.llm.provider import get_client, pricing_from_sku
from app.services.usage_ledger import (
    UsageNumbers,
    estimate_usage_from_messages,
    parse_openai_usage,
    record_usage_event,
    utcnow,
)


class LLMStreamResult:
    """Mutable container populated during streaming."""
    __slots__ = ("provider", "model", "usage", "content", "request_meta", "token_stream")

    def __init__(self) -> None:
        self.provider: str = ""
        self.model: str = ""
        self.usage: UsageNumbers | None = None
        self.content: str = ""
        self.request_meta: dict[str, Any] = {}
        self.token_stream: AsyncIterator[str] | None = None


class LLMCallResult:
    """Immutable result of a non-streaming LLM call."""
    __slots__ = ("content", "provider", "model", "usage", "request_meta")

    def __init__(self, *, content: str, provider: str, model: str, usage: UsageNumbers, request_meta: dict[str, Any] | None = None) -> None:
        self.content = content
        self.provider = provider
        self.model = model
        self.usage = usage
        self.request_meta = request_meta or {}


async def call_non_stream(
    *,
    sku: CatalogSku | None,
    provider_name: str,
    model_name: str,
    messages: list[dict],
    attempt_index: int,
    is_fallback: bool,
) -> LLMCallResult:
    client = get_client(provider_name)
    started_at = utcnow()
    response = await client.chat.completions.create(model=model_name, messages=messages, stream=False)
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
        provider=provider_name, model=model_name, status="success",
        usage=usage, pricing=pricing_from_sku(sku),
        attempt_index=attempt_index, is_fallback=is_fallback,
        started_at=started_at, finished_at=finished_at,
        sku_id=sku.sku_id if sku else None,
        family_id=sku.family_id if sku else None,
        vendor=sku.vendor if sku else None,
        billing_channel=sku.billing_channel if sku else None,
        provider_request_id=request_meta["provider_request_id"],
    )
    return LLMCallResult(content=content, provider=provider_name, model=model_name, usage=usage, request_meta=request_meta)


async def stream_tokens(
    client: AsyncOpenAI,
    model_name: str,
    messages: list[dict],
    result: LLMStreamResult,
) -> AsyncIterator[str]:
    try:
        stream = await client.chat.completions.create(model=model_name, messages=messages, stream=True, stream_options={"include_usage": True})
    except APIError:
        stream = await client.chat.completions.create(model=model_name, messages=messages, stream=True)

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


def empty_stream() -> AsyncIterator[str]:
    async def _stream() -> AsyncIterator[str]:
        if False:
            yield ""
    return _stream()
