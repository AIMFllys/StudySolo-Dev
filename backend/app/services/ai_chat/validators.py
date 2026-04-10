"""Validation and SKU resolution helpers for AI chat.

Extracted from the former api/ai_chat.py and ai_chat_stream.py.
"""

from app.models.ai_chat import AIChatRequest
from app.services.ai_catalog_service import is_tier_allowed, resolve_selected_sku


async def validate_and_resolve_sku(
    body: AIChatRequest,
    user_tier: str,
):
    """Resolve the selected SKU and check tier access.

    Returns:
        (resolved_sku | None, is_tier_forbidden: bool)
    """
    selected_sku = await resolve_selected_sku(
        selected_model_key=body.selected_model_key,
        selected_platform=body.selected_platform,
        selected_model=body.selected_model,
    )
    is_forbidden = bool(
        selected_sku and not is_tier_allowed(user_tier, selected_sku.required_tier)
    )
    return selected_sku, is_forbidden


def resolve_source_subtype(body: AIChatRequest) -> str:
    """Determine the usage source_subtype based on mode and intent_hint."""
    if body.mode == "plan":
        return "plan"
    if body.mode == "create":
        return "modify"
    if body.intent_hint == "MODIFY":
        return "modify"
    return "chat"


def resolve_assistant_subtype(body: AIChatRequest) -> str:
    """Legacy subtype resolver for non-streaming endpoint (backward compat)."""
    if body.intent_hint == "MODIFY":
        return "modify"
    return "chat"
