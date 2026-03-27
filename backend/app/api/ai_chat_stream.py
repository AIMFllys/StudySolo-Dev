"""Streaming AI chat routes."""

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from app.core.deps import get_current_user
from app.models.ai_chat import AIChatRequest
from app.prompts import get_chat_prompt, get_create_prompt, get_intent_prompt, get_plan_prompt
from app.services.ai_catalog_service import is_tier_allowed, resolve_selected_sku
from app.services.ai_router import AIRouterError, call_llm, call_llm_direct
from app.services.usage_ledger import bind_usage_request, create_usage_request, finalize_usage_request
from app.api.ai_chat import _build_canvas_summary, _call_with_model, _extract_json_obj

logger = logging.getLogger(__name__)
stream_router = APIRouter()

_DEPTH_INSTRUCTIONS: dict[str, str] = {
    "fast": "Please answer briefly and directly.",
    "balanced": "Please answer with useful detail and clear structure.",
    "deep": "Please analyze in depth from multiple angles before answering.",
}
_MODIFY_FORMAT_RETRIES = 2
_MODIFY_FORMAT_ERROR = (
    "上一条输出不是合法 JSON。现在只允许返回一个裸 JSON 对象，"
    "首字符必须是 {，不得包含 Markdown 代码块、解释文字或额外前后缀。"
)

def _resolve_source_subtype(body: AIChatRequest) -> str:
    if body.mode == "plan":
        return "plan"
    if body.mode == "create":
        return "modify"
    return "chat"


def _normalize_modify_actions(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    actions_data = parsed.get("tool_calls") or parsed.get("actions", [])
    formatted_actions: list[dict[str, Any]] = []
    for action in actions_data:
        payload = action.get("params", action.get("payload", {}))
        formatted_actions.append(
            {
                "operation": action.get("tool", action.get("operation", "")).upper(),
                "target_node_id": payload.get("target_node_id") or action.get("target_node_id"),
                "payload": payload,
            }
        )
    return formatted_actions


async def _call_modify_with_retry(
    body: AIChatRequest,
    base_messages: list[dict[str, str]],
) -> tuple[dict[str, Any] | None, str | None, str | None, str | None]:
    messages = list(base_messages)
    last_raw: str | None = None
    last_model_used: str | None = None

    for attempt in range(_MODIFY_FORMAT_RETRIES + 1):
        raw, _, model_used = await _call_with_model(
            body.selected_model_key,
            body.selected_platform,
            body.selected_model,
            messages,
        )
        last_raw = raw
        last_model_used = model_used
        try:
            parsed = _extract_json_obj(raw)
            return parsed, raw, model_used, None
        except Exception as exc:  # noqa: BLE001
            if attempt >= _MODIFY_FORMAT_RETRIES:
                return None, raw, model_used, str(exc)

            messages = [
                *messages,
                {"role": "assistant", "content": raw},
                {"role": "user", "content": f"{_MODIFY_FORMAT_ERROR}\n错误：{exc}"},
            ]

    return None, last_raw, last_model_used, "unknown modify parsing error"


async def _chat_stream_generator(
    body: AIChatRequest,
    current_user: dict,
):
    usage_request = await create_usage_request(
        user_id=current_user["id"],
        source_type="assistant",
        source_subtype=_resolve_source_subtype(body),
        workflow_id=body.canvas_context.workflow_id if body.canvas_context else None,
    )
    request_status = "completed"

    with bind_usage_request(usage_request):
        try:
            selected_sku = await resolve_selected_sku(
                selected_model_key=body.selected_model_key,
                selected_platform=body.selected_platform,
                selected_model=body.selected_model,
            )
            user_tier = current_user.get("tier", "free")
            if selected_sku and not is_tier_allowed(user_tier, selected_sku.required_tier):
                request_status = "failed"
                yield {
                    "data": json.dumps(
                        {"error": "This model requires a paid tier.", "done": True},
                        ensure_ascii=False,
                    )
                }
                return

            canvas_summary = _build_canvas_summary(body.canvas_context)
            has_canvas = bool(body.canvas_context and body.canvas_context.nodes)
            model_identity = selected_sku.display_name if selected_sku else "StudySolo 默认模型"
            history_msgs = [
                {"role": message.role, "content": message.content}
                for message in (body.conversation_history or [])[-10:]
            ]
            mode = getattr(body, "mode", "chat")

            if mode == "create":
                intent = body.intent_hint or "MODIFY"
                if not body.intent_hint or body.intent_hint not in ("BUILD", "MODIFY", "ACTION"):
                    classify_msgs = [
                        {"role": "system", "content": get_intent_prompt(canvas_summary, model_identity=model_identity)},
                        *history_msgs,
                        {"role": "user", "content": body.user_input},
                    ]
                    try:
                        raw, _, _ = await _call_with_model(
                            body.selected_model_key,
                            body.selected_platform,
                            body.selected_model,
                            classify_msgs,
                        )
                        parsed = _extract_json_obj(raw)
                        intent = parsed.get("intent", "MODIFY")
                        if intent not in ("BUILD", "MODIFY", "ACTION"):
                            intent = "MODIFY"
                    except Exception:
                        intent = "BUILD" if not has_canvas else "MODIFY"

                if intent in ("BUILD", "ACTION"):
                    yield {
                        "data": json.dumps(
                            {"intent": intent, "done": True, "response": "Redirecting..."},
                            ensure_ascii=False,
                        )
                    }
                    return

                system_content = get_create_prompt(canvas_summary, body.thinking_level, model_identity=model_identity)
                create_msgs = [
                    {"role": "system", "content": system_content},
                    *history_msgs,
                    {"role": "user", "content": body.user_input},
                ]

                try:
                    parsed, raw, model_used, parse_error = await _call_modify_with_retry(body, create_msgs)
                    if not parsed:
                        request_status = "failed"
                        yield {
                            "data": json.dumps(
                                {
                                    "intent": "MODIFY",
                                    "done": True,
                                    "response": "未能生成可执行的画布操作。请重试，或改用手动编辑节点。",
                                    "error": "INVALID_CREATE_JSON",
                                    "error_detail": parse_error,
                                },
                                ensure_ascii=False,
                            )
                        }
                        return

                    formatted_actions = _normalize_modify_actions(parsed)
                    yield {
                        "data": json.dumps(
                            {
                                "intent": "MODIFY",
                                "done": True,
                                "response": parsed.get("response", "Canvas updated."),
                                "actions": formatted_actions,
                                "model_used": model_used,
                            },
                            ensure_ascii=False,
                        )
                    }
                except Exception as exc:
                    request_status = "failed"
                    yield {
                        "data": json.dumps(
                            {"intent": "MODIFY", "done": True, "response": str(exc)},
                            ensure_ascii=False,
                        )
                    }
                return

            if mode == "plan":
                intent = "PLAN"
                system_content = get_plan_prompt(canvas_summary, body.thinking_level, model_identity=model_identity)
            else:
                intent = "CHAT"
                system_content = get_chat_prompt(canvas_summary, body.thinking_level, model_identity=model_identity)

            stream_msgs = [
                {"role": "system", "content": system_content},
                *history_msgs,
                {"role": "user", "content": body.user_input},
            ]

            force_thinking = body.thinking_level in ("balanced", "deep")
            _ = _DEPTH_INSTRUCTIONS.get(body.thinking_level, "")

            yield {"data": json.dumps({"intent": intent}, ensure_ascii=False)}

            if selected_sku:
                token_iter = await call_llm_direct(
                    selected_sku.provider,
                    selected_sku.model_id,
                    stream_msgs,
                    stream=True,
                )
            elif force_thinking:
                token_iter = await call_llm_direct(
                    "deepseek",
                    "deepseek-reasoner",
                    stream_msgs,
                    stream=True,
                )
            else:
                token_iter = await call_llm("chat_response", stream_msgs, stream=True)

            full = ""
            async for token in token_iter:
                full += token
                yield {"data": json.dumps({"token": token}, ensure_ascii=False)}

            yield {"data": json.dumps({"done": True, "full": full}, ensure_ascii=False)}
            yield {"data": "[DONE]"}
        except AIRouterError as exc:
            request_status = "failed"
            yield {
                "data": json.dumps(
                    {"error": str(exc), "done": True},
                    ensure_ascii=False,
                )
            }
        except Exception as exc:
            request_status = "failed"
            logger.exception("AI chat stream failed: %s", exc)
            yield {
                "data": json.dumps(
                    {"error": str(exc), "done": True},
                    ensure_ascii=False,
                )
            }
        finally:
            await finalize_usage_request(usage_request.request_id, request_status)


@stream_router.post("/chat-stream")
async def ai_chat_stream(
    body: AIChatRequest,
    current_user: dict = Depends(get_current_user),
):
    return EventSourceResponse(_chat_stream_generator(body, current_user))
