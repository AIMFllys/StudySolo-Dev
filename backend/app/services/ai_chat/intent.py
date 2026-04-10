"""Intent classification logic for AI chat.

Extracted from the former api/ai_chat.py for single-point maintenance.
"""

import logging

from app.models.ai_chat import AIChatRequest
from app.services.ai_chat.helpers import extract_json_obj
from app.services.ai_chat.model_caller import call_with_model

logger = logging.getLogger(__name__)


async def classify_intent(
    body: AIChatRequest,
    canvas_summary: str,
    model_identity: str,
    *,
    system_prompt_fn,
    history_msgs: list[dict],
    has_canvas: bool,
) -> str:
    """Classify user intent via LLM and return one of BUILD/MODIFY/CHAT/ACTION/PLAN.

    Args:
        body: The incoming chat request.
        canvas_summary: Pre-built canvas summary text.
        model_identity: Display name of the selected model.
        system_prompt_fn: Callable that builds the intent classifier system prompt.
        history_msgs: Truncated conversation history messages.
        has_canvas: Whether the canvas has nodes.

    Returns:
        Intent string: "BUILD" | "MODIFY" | "CHAT" | "ACTION" | "PLAN".
    """
    classify_msgs = [
        {"role": "system", "content": system_prompt_fn(canvas_summary, model_identity=model_identity)},
        *history_msgs,
        {"role": "user", "content": body.user_input},
    ]
    try:
        raw, _, _ = await call_with_model(
            body.selected_model_key,
            body.selected_platform,
            body.selected_model,
            classify_msgs,
        )
        parsed = extract_json_obj(raw)
        intent = parsed.get("intent", "CHAT")
        if intent not in ("BUILD", "MODIFY", "CHAT", "ACTION", "PLAN"):
            intent = "CHAT"
        return intent
    except Exception:
        logger.debug("Intent classification failed, using fallback", exc_info=True)
        return "BUILD" if not has_canvas else "CHAT"
