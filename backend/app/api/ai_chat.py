"""AI chat routes."""

import json
import logging
import re

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.models.ai_chat import AIChatRequest, AIChatResponse, CanvasAction
from app.prompts import (
    get_chat_system_prompt,
    get_intent_system_prompt,
    get_modify_system_prompt,
)
from app.services.ai_catalog_service import is_tier_allowed, resolve_selected_sku
from app.services.ai_router import LLMCallResult, call_llm_direct_structured, call_llm_structured
from app.services.usage_ledger import bind_usage_request, create_usage_request, finalize_usage_request

logger = logging.getLogger(__name__)
router = APIRouter()

_JSON_PATTERN = re.compile(r"```(?:json)?\s*([\s\S]+?)```")
_OBJ_PATTERN = re.compile(r"(\{[\s\S]*\})")


def _extract_json_obj(text: str) -> dict:
    m = _JSON_PATTERN.search(text)
    raw = m.group(1).strip() if m else text.strip()
    m2 = _OBJ_PATTERN.search(raw)
    if m2:
        raw = m2.group(1).strip()
    return json.loads(raw)


def _build_canvas_summary(ctx) -> str:
    if not ctx or not ctx.nodes:
        return "Canvas is empty."

    lines = [f"Workflow: {ctx.workflow_name or 'Untitled'}"]
    lines.append(f"Node count: {len(ctx.nodes)}")
    if ctx.execution_status:
        lines.append(f"Execution status: {ctx.execution_status}")
    lines.append("")

    for node in ctx.nodes:
        status = f" [{node.status}]" if node.status != "pending" else ""
        upstream = f" <- {', '.join(node.upstream_labels)}" if node.upstream_labels else ""
        downstream = f" -> {', '.join(node.downstream_labels)}" if node.downstream_labels else ""
        preview = f" output={node.output_preview}" if node.has_output else ""
        pos = f" @({int(node.position.get('x', 0))},{int(node.position.get('y', 0))})"
        lines.append(f"#{node.index + 1} [{node.type}] {node.label}{pos}{status}{upstream}{downstream}{preview}")

    if ctx.dag_description:
        lines.append(f"DAG: {ctx.dag_description}")

    if ctx.selected_node_id:
        selected = next((node for node in ctx.nodes if node.id == ctx.selected_node_id), None)
        if selected:
            lines.append(f"Selected node: #{selected.index + 1} {selected.label}")

    return "\n".join(lines)


async def _call_with_model(
    selected_model_key: str | None,
    platform: str | None,
    model: str | None,
    messages: list[dict],
) -> tuple[str, str, str]:
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
            stream=False,
        )
    else:
        result = await call_llm_structured("chat_response", messages, stream=False)

    assert isinstance(result, LLMCallResult)
    return result.content, result.provider, result.model


def _resolve_assistant_subtype(body: AIChatRequest) -> str:
    if body.intent_hint == "MODIFY":
        return "modify"
    return "chat"


@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    body: AIChatRequest,
    current_user: dict = Depends(get_current_user),
):
    usage_request = await create_usage_request(
        user_id=current_user["id"],
        source_type="assistant",
        source_subtype=_resolve_assistant_subtype(body),
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

            canvas_summary = _build_canvas_summary(body.canvas_context)
            has_canvas = bool(body.canvas_context and body.canvas_context.nodes)

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
                    raw, _, _ = await _call_with_model(
                        body.selected_model_key,
                        body.selected_platform,
                        body.selected_model,
                        classify_msgs,
                    )
                    parsed = _extract_json_obj(raw)
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
                raw, platform_used, model_used = await _call_with_model(
                    body.selected_model_key,
                    body.selected_platform,
                    body.selected_model,
                    modify_msgs,
                )
                try:
                    parsed = _extract_json_obj(raw)
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
                {"role": "system", "content": get_chat_system_prompt(canvas_summary)},
                *history_msgs,
                {"role": "user", "content": body.user_input},
            ]
            raw, platform_used, model_used = await _call_with_model(
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
