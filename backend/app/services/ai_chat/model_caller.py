"""Unified LLM model caller for AI chat routes.

Extracted from the former api/ai_chat.py to share between
streaming and non-streaming endpoints.
"""

from app.services.ai_catalog_service import resolve_selected_sku
from app.services.llm.router import LLMCallResult, call_llm_direct_structured, call_llm_structured


async def call_with_model(
    selected_model_key: str | None,
    platform: str | None,
    model: str | None,
    messages: list[dict],
    *,
    stream: bool = False,
):
    """Unified model invocation entry point.

    Non-streaming: returns ``(content, provider, model)`` tuple.
    Streaming (future): returns async token iterator.
    """
    selected_sku = await resolve_selected_sku(
        selected_model_key=selected_model_key,
        selected_platform=platform,
        selected_model=model,
    )
    if selected_sku:
        result = await call_llm_direct_structured(
            selected_sku.provider,
            selected_sku.model_id,
            messages,
            stream=stream,
        )
    else:
        result = await call_llm_structured("chat_response", messages, stream=stream)

    assert isinstance(result, LLMCallResult)
    return result.content, result.provider, result.model
