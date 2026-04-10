"""AI Chat routes — unified endpoint (Task 2.1 merge result).

Replaces the former ``api/ai_chat.py`` and ``api/ai_chat_stream.py``.
Both ``/chat`` (non-streaming) and ``/chat-stream`` (SSE) live here.
"""

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.ai_chat import AIChatRequest, AIChatResponse, CanvasAction
from app.prompts import (
    get_chat_prompt,
    get_chat_system_prompt,
    get_create_prompt,
    get_intent_prompt,
    get_intent_system_prompt,
    get_modify_system_prompt,
    get_plan_prompt,
)
from app.services.ai_catalog_service import get_sku_by_id, is_tier_allowed, resolve_selected_sku
from app.services.ai_chat.helpers import build_canvas_summary, extract_json_obj
from app.services.ai_chat.model_caller import call_with_model
from app.services.ai_chat.validators import resolve_assistant_subtype, resolve_source_subtype
from app.services.ai_router import AIRouterError, call_llm, call_llm_direct
from app.services.quota_service import check_daily_chat_quota
from app.services.usage_ledger import bind_usage_request, create_usage_request, finalize_usage_request

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Constants ────────────────────────────────────────────────────────────────

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


# ── Shared helpers (stream-specific) ─────────────────────────────────────────

def _normalize_modify_actions(parsed: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize action format from LLM output for canvas operations."""
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
    """Call LLM for MODIFY intent with JSON parsing retries."""
    messages = list(base_messages)
    last_raw: str | None = None
    last_model_used: str | None = None

    for attempt in range(_MODIFY_FORMAT_RETRIES + 1):
        raw, _, model_used = await call_with_model(
            body.selected_model_key,
            body.selected_platform,
            body.selected_model,
            messages,
        )
        last_raw = raw
        last_model_used = model_used
        try:
            parsed = extract_json_obj(raw)
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


# ═══════════════════════════════════════════════════════════════════════════════
# NON-STREAMING ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    body: AIChatRequest,
    current_user: dict = Depends(get_current_user),
):
    usage_request = await create_usage_request(
        user_id=current_user["id"],
        source_type="assistant",
        source_subtype=resolve_assistant_subtype(body),
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
                return AIChatResponse(
                    intent="CHAT",
                    response="This model requires a paid tier.",
                    model_used=selected_sku.model_id,
                    platform_used=selected_sku.provider,
                )

            canvas_summary = build_canvas_summary(body.canvas_context)
            has_canvas = bool(body.canvas_context and body.canvas_context.nodes)
            model_identity = selected_sku.display_name if selected_sku else "StudySolo 默认模型"

            if body.intent_hint == "ACTION":
                return AIChatResponse(
                    intent="ACTION",
                    response="Executing action...",
                    model_used="none",
                    platform_used="none",
                )

            history_msgs = [
                {"role": message.role, "content": message.content}
                for message in (body.conversation_history or [])[-10:]
            ]

            if body.intent_hint and body.intent_hint in ("BUILD", "MODIFY", "CHAT"):
                intent = body.intent_hint
            else:
                classify_msgs = [
                    {"role": "system", "content": get_intent_system_prompt(canvas_summary)},
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
                    if intent not in ("BUILD", "MODIFY", "CHAT", "ACTION"):
                        intent = "CHAT"
                except Exception:
                    intent = "BUILD" if not has_canvas else "CHAT"

            if intent == "BUILD":
                return AIChatResponse(
                    intent="BUILD",
                    response="Preparing workflow generation...",
                    model_used=selected_sku.model_id if selected_sku else (body.selected_model or "default"),
                    platform_used=selected_sku.provider if selected_sku else (body.selected_platform or "default"),
                )

            if intent == "MODIFY":
                modify_msgs = [
                    {"role": "system", "content": get_modify_system_prompt(canvas_summary)},
                    *history_msgs,
                    {"role": "user", "content": body.user_input},
                ]
                raw, platform_used, model_used = await call_with_model(
                    body.selected_model_key,
                    body.selected_platform,
                    body.selected_model,
                    modify_msgs,
                )
                try:
                    parsed = extract_json_obj(raw)
                    actions_data = parsed.get("tool_calls") or parsed.get("actions", [])
                    actions = [
                        CanvasAction(
                            operation=action.get("tool", action.get("operation", "")).upper(),
                            target_node_id=(
                                action.get("params", action.get("payload", {})).get("target_node_id")
                                or action.get("target_node_id")
                            ),
                            payload=action.get("params", action.get("payload", {})),
                        )
                        for action in actions_data
                    ]
                    response_text = parsed.get("response", "Canvas updated.")
                except (json.JSONDecodeError, KeyError):
                    actions = None
                    response_text = raw

                return AIChatResponse(
                    intent="MODIFY",
                    response=response_text,
                    actions=actions,
                    model_used=model_used,
                    platform_used=platform_used,
                )

            chat_msgs = [
                {"role": "system", "content": get_chat_system_prompt(canvas_summary, model_identity=model_identity)},
                *history_msgs,
                {"role": "user", "content": body.user_input},
            ]
            raw, platform_used, model_used = await call_with_model(
                body.selected_model_key,
                body.selected_platform,
                body.selected_model,
                chat_msgs,
            )
            return AIChatResponse(
                intent="CHAT",
                response=raw,
                model_used=model_used,
                platform_used=platform_used,
            )
        except Exception:
            request_status = "failed"
            raise
        finally:
            await finalize_usage_request(usage_request.request_id, request_status)


# ═══════════════════════════════════════════════════════════════════════════════
# STREAMING ENDPOINT (SSE)
# ═══════════════════════════════════════════════════════════════════════════════

async def _chat_stream_generator(
    body: AIChatRequest,
    current_user: dict,
    service_db=None,
):
    usage_request = await create_usage_request(
        user_id=current_user["id"],
        source_type="assistant",
        source_subtype=resolve_source_subtype(body),
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

            # ── Daily chat quota check (soft block → degrade to fallback model) ──
            quota_degraded = False
            if service_db is not None:
                chat_quota = await check_daily_chat_quota(
                    current_user["id"], user_tier, service_db,
                )
                if not chat_quota["allowed"]:
                    fallback = await get_sku_by_id(chat_quota["fallback_sku_id"])
                    if fallback:
                        selected_sku = fallback
                        quota_degraded = True
                        yield {
                            "data": json.dumps(
                                {
                                    "quota_warning": True,
                                    "message": (
                                        f"今日 AI 对话次数已达上限（{chat_quota['used']}/{chat_quota['limit']}），"
                                        f"已自动切换至基础模型（{fallback.display_name}）。升级会员可获取更多额度"
                                    ),
                                    "used": chat_quota["used"],
                                    "limit": chat_quota["limit"],
                                },
                                ensure_ascii=False,
                            )
                        }

            if selected_sku and not quota_degraded and not is_tier_allowed(user_tier, selected_sku.required_tier):
                request_status = "failed"
                yield {
                    "data": json.dumps(
                        {"error": "This model requires a paid tier.", "done": True},
                        ensure_ascii=False,
                    )
                }
                return

            canvas_summary = build_canvas_summary(body.canvas_context)
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
                        raw, _, _ = await call_with_model(
                            body.selected_model_key,
                            body.selected_platform,
                            body.selected_model,
                            classify_msgs,
                        )
                        parsed = extract_json_obj(raw)
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
            logger.warning("AI router error: %s", exc)
            yield {
                "data": json.dumps(
                    {"error": "AI 模型调用失败，请稍后重试", "done": True},
                    ensure_ascii=False,
                )
            }
        except Exception as exc:
            request_status = "failed"
            logger.exception("AI chat stream failed: %s", exc)
            yield {
                "data": json.dumps(
                    {"error": "服务内部错误，请稍后重试", "done": True},
                    ensure_ascii=False,
                )
            }
        finally:
            await finalize_usage_request(usage_request.request_id, request_status)


@router.post("/chat-stream")
async def ai_chat_stream(
    body: AIChatRequest,
    current_user: dict = Depends(get_current_user),
    service_db=Depends(get_db),
):
    return EventSourceResponse(_chat_stream_generator(body, current_user, service_db=service_db))
