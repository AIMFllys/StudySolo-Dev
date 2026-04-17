"""Backend-orchestrated ReAct agent loop for the AI chat.

Flow (per user turn):
    1. Build system prompt (identity + XML protocol + tool schema + canvas
       snapshot + workflow list summary).
    2. Stream the LLM; feed tokens through :class:`XmlStreamParser`.
    3. Whenever a ``<tool_use>`` closes, the parser emits ``tool_call_ready``.
       We execute the corresponding tool, emit ``tool_call`` / ``tool_result``
       / ``canvas_mutation`` / ``ui_effect`` SSE events, and append a
       ``<tool_result>`` message into the running history for the next round.
    4. On ``<done/>`` OR when the LLM returns no new tool calls (i.e. the
       stream finished without any ``<tool_use>``), we exit.
    5. Hard cap at ``MAX_ROUNDS`` rounds to prevent runaway loops.

Every event we yield is already in the SSE dict form (``{"data": ...}``) so
the API layer just passes them through :class:`EventSourceResponse`.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, AsyncIterator

from app.models.ai_chat import AIChatRequest
from app.prompts import get_agent_xml_prompt
from app.services.ai_catalog_service import resolve_selected_sku
from app.services.ai_chat.helpers import build_canvas_summary, strip_reasoning_blocks
from app.services.ai_chat.thinking import (
    ThinkingLevel,
    resolve_effective_thinking_level,
    should_force_reasoning_model,
)
from app.services.ai_chat.tools import (
    CanvasMutation,
    ToolContext,
    ToolResult,
    UIEffect,
    get_tool,
    iter_tool_specs,
)
from app.services.ai_chat.xml_stream_parser import XmlStreamParser
from app.services.llm.router import (
    AIRouterError,
    call_lightweight_chat_response,
    call_llm_direct,
)

logger = logging.getLogger(__name__)


MAX_ROUNDS = 6
MAX_DUPLICATE_TOOL_CALLS = 3  # same (tool, params) in a row = probable loop
_CURRENT_WORKFLOW_RENAME_PATTERNS = (
    re.compile(
        r"(?:把|将)?当前(?:工作流|画布)(?:重命名(?:为)?|改名(?:为|叫)?|改成|改为)\s*[\"“”'「『]?(.*?)[\"“”'」』]?\s*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"rename\s+(?:the\s+)?current\s+(?:workflow|canvas)\s+to\s+[\"“”'「『]?(.*?)[\"“”'」』]?\s*$",
        re.IGNORECASE,
    ),
)
_CURRENT_WORKFLOW_RUN_PATTERNS = (
    re.compile(
        r"(?:\u8bf7)?(?:\u5728)?(?:\u540e\u53f0|background)?\s*(?:\u8fd0\u884c|\u6267\u884c|\u542f\u52a8)\s*(?:\u5f53\u524d|\u8fd9\u4e2a)?(?:\u5de5\u4f5c\u6d41|\u753b\u5e03)\s*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:run|start|execute)\s+(?:the\s+)?current\s+(?:workflow|canvas)(?:\s+in\s+background)?\s*$",
        re.IGNORECASE,
    ),
)
_OPEN_WORKFLOW_NAME_PATTERNS = (
    re.compile(
        r"(?:\u6253\u5f00|\u8fdb\u5165)\s*(?:\u5de5\u4f5c\u6d41)?\s*[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"open\s+(?:the\s+)?(?:workflow\s+)?[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s*$",
        re.IGNORECASE,
    ),
)
_DIRECT_NODE_TYPE_ALIASES = {
    "summary": "summary",
    "\u603b\u7ed3": "summary",
    "flashcard": "flashcard",
    "\u95ea\u5361": "flashcard",
    "qa": "qa",
    "\u95ee\u7b54": "qa",
    "trigger_input": "trigger_input",
    "\u8f93\u5165": "trigger_input",
}
_RUN_ID_PATTERN = re.compile(
    r"\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b",
    re.IGNORECASE,
)
_RUN_STATUS_PATTERNS = (
    re.compile(
        r"(?:\u67e5\u8be2|\u67e5\u770b|\u83b7\u53d6).*(?:run[_\s-]*id)\s*(?:\u4e3a|=|is)?\s*([0-9a-f-]{8,})",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:run[_\s-]*id)\s*(?:\u4e3a|=|is)?\s*([0-9a-f-]{8,}).*(?:\u72b6\u6001|status)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:status|state)\s+(?:of|for)\s+(?:run[_\s-]*id\s*)?([0-9a-f-]{8,})",
        re.IGNORECASE,
    ),
)
_NODE_RENAME_PATTERNS = (
    re.compile(
        r"(?:\u628a|\u5c06)\s*[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s*\u8282\u70b9(?:\u7684\u6807\u9898)?(?:\u6539\u540d(?:\u4e3a)?|\u6539\u6210|\u6539\u4e3a|\u91cd\u547d\u540d\u4e3a)\s*[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"rename\s+(?:node\s+)?[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s+to\s+[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s*$",
        re.IGNORECASE,
    ),
)
_DELETE_EDGE_PATTERNS = (
    re.compile(
        r"(?:\u5220\u9664|\u5220\u6389)\s*(?:\u4ece)?\s*[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s*(?:\u5230|->|\u81f3)\s*[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s*(?:\u8fd9\u6761)?(?:\u8fde\u7ebf|\u8fde\u63a5|\u8fb9)\s*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"delete\s+(?:the\s+)?(?:edge|connection)\s+(?:from\s+)?[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s+(?:to|->)\s+[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s*$",
        re.IGNORECASE,
    ),
)
_ADD_EDGE_PATTERNS = (
    re.compile(
        r"(?:\u628a|\u5c06)?\s*[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s*\u8282\u70b9?\s*(?:\u8fde\u5230|\u8fde\u63a5\u5230|\u8fde\u63a5\u81f3)\s*[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:connect|link)\s+[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s+(?:to|with)\s+[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s*$",
        re.IGNORECASE,
    ),
)
_ADD_NODE_LABEL_PATTERNS = (
    re.compile(
        r"(?:\u53eb|\u547d\u540d\u4e3a|\u540d\u53eb)\s*[\u300c\"\u201c]?(.*?)[\u300d\"\u201d]?\s*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"[\u300c\"\u201c](.*?)[\u300d\"\u201d]",
        re.IGNORECASE,
    ),
)
_DELETE_MISSING_EDGE_PATTERNS = (
    re.compile(r"(?:\u5220\u9664|\u5220\u6389).*(?:\u4e0d\u5b58\u5728).*(?:\u8fde\u7ebf|\u8fde\u63a5|\u8fb9)\s*$", re.IGNORECASE),
    re.compile(r"delete\s+.*(?:missing|non[-\s]?existent).*(?:edge|connection)\s*$", re.IGNORECASE),
)


# ── Helpers ──────────────────────────────────────────────────────────────

def _format_tools_block() -> str:
    """Render the tool registry into a prompt-friendly XML snippet."""
    lines: list[str] = []
    for spec in iter_tool_specs():
        lines.append(f"- **{spec.name}** — {spec.description}")
        try:
            schema = json.dumps(spec.params_schema, ensure_ascii=False)
        except (TypeError, ValueError):
            schema = "{}"
        lines.append(f"  参数 JSON schema: `{schema}`")
    return "\n".join(lines) if lines else "（无可用工具）"


async def _build_workflow_list_summary(ctx: ToolContext) -> str:
    """Best-effort: list top workflows for implicit context. Non-fatal."""
    try:
        result = (
            await ctx.db.from_("ss_workflows")
            .select("id,name,updated_at,nodes_json")
            .eq("user_id", ctx.user["id"])
            .order("updated_at", desc=True)
            .limit(15)
            .execute()
        )
        rows = result.data or []
        if not rows:
            return "（用户暂无工作流）"
        lines = []
        for r in rows:
            node_count = len(r.get("nodes_json") or [])
            lines.append(
                f"- id={r['id']} | 名称={(r.get('name') or '未命名')} | 节点数={node_count}"
            )
        return "\n".join(lines)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to build workflow list summary: %s", exc)
        return "（加载工作流列表失败）"


def _sse(data: dict[str, Any]) -> dict[str, str]:
    return {"data": json.dumps(data, ensure_ascii=False)}


def _serialize_canvas_mutation(m: CanvasMutation) -> dict[str, Any]:
    return {
        "workflow_id": m.workflow_id,
        "nodes": m.nodes,
        "edges": m.edges,
    }


def _serialize_ui_effect(u: UIEffect) -> dict[str, Any]:
    return {"type": u.type, "url": u.url, "payload": u.payload}


def _maybe_extract_current_workflow_rename(text: str) -> str | None:
    raw = (text or "").strip()
    if not raw:
        return None
    for pattern in _CURRENT_WORKFLOW_RENAME_PATTERNS:
        match = pattern.search(raw)
        if not match:
            continue
        new_name = match.group(1).strip().strip("。.!?？")
        if new_name:
            return new_name
    return None


def _emit_text_segment(tag: str, text: str) -> list[dict[str, str]]:
    return [
        _sse({"event": "segment_start", "tag": tag, "attrs": {}}),
        _sse({"event": "segment_delta", "tag": tag, "delta": text}),
        _sse({"event": "segment_end", "tag": tag}),
    ]


def _emit_summary_segments(changes: list[str]) -> list[dict[str, str]]:
    events = [_sse({"event": "segment_start", "tag": "summary", "attrs": {}})]
    events.append(_sse({"event": "segment_start", "tag": "summary.changes", "attrs": {}}))
    for change in changes:
        events.append(_sse({"event": "segment_start", "tag": "summary.change", "attrs": {}}))
        events.append(_sse({"event": "segment_delta", "tag": "summary.change", "delta": change}))
        events.append(_sse({"event": "segment_end", "tag": "summary.change"}))
    events.append(_sse({"event": "segment_end", "tag": "summary.changes"}))
    events.append(_sse({"event": "segment_end", "tag": "summary"}))
    return events


def _clean_extracted_text(value: Any) -> str:
    return str(value or "").strip().strip("\"'`“”‘’「」『』《》 ")


def _maybe_extract_current_workflow_run(text: str) -> bool:
    raw = (text or "").strip()
    if not raw:
        return False
    return any(pattern.search(raw) for pattern in _CURRENT_WORKFLOW_RUN_PATTERNS)


def _looks_like_list_workflows_request(text: str) -> bool:
    raw = (text or "").strip().lower()
    if not raw:
        return False
    workflow_keywords = ("\u5de5\u4f5c\u6d41", "workflow", "workflows")
    list_keywords = ("\u5217\u51fa", "\u770b\u770b", "\u54ea\u4e9b", "list", "show")
    return any(keyword in raw for keyword in workflow_keywords) and any(
        keyword in raw for keyword in list_keywords
    )


def _looks_like_open_latest_workflow_request(text: str) -> bool:
    raw = (text or "").strip().lower()
    if not raw:
        return False
    return any(keyword in raw for keyword in ("\u6700\u8fd1\u7f16\u8f91", "latest", "recent")) and any(
        keyword in raw for keyword in ("\u5de5\u4f5c\u6d41", "workflow")
    ) and any(keyword in raw for keyword in ("\u6253\u5f00", "\u8fdb\u5165", "open"))


def _looks_like_read_canvas_request(text: str) -> bool:
    raw = (text or "").strip().lower()
    if not raw:
        return False
    canvas_keywords = ("\u753b\u5e03", "canvas")
    read_keywords = ("\u54ea\u4e9b\u8282\u70b9", "\u80fd\u770b\u5230", "\u8bfb\u53d6", "read", "nodes")
    return any(keyword in raw for keyword in canvas_keywords) and any(
        keyword in raw for keyword in read_keywords
    )


def _maybe_extract_open_workflow_name(text: str) -> str | None:
    raw = (text or "").strip()
    if not raw:
        return None
    lowered = raw.lower()
    if not any(keyword in lowered for keyword in ("\u6253\u5f00", "\u8fdb\u5165", "open")):
        return None
    quoted = re.search(r"[\u300c\"\u201c](.*?)[\u300d\"\u201d]", raw)
    if quoted:
        name = _clean_extracted_text(quoted.group(1))
        if name:
            return name
    for pattern in _OPEN_WORKFLOW_NAME_PATTERNS:
        match = pattern.search(raw)
        if not match:
            continue
        name = _clean_extracted_text(match.group(1))
        if name and "\u6700\u8fd1\u7f16\u8f91" not in name:
            return name
    return None


def _maybe_extract_run_id_from_text(text: str) -> str | None:
    raw = (text or "").strip()
    if not raw:
        return None
    for pattern in _RUN_STATUS_PATTERNS:
        match = pattern.search(raw)
        if match:
            run_id = _clean_extracted_text(match.group(1))
            if run_id:
                return run_id
    match = _RUN_ID_PATTERN.search(raw)
    if match:
        return match.group(1)
    return None


def _looks_like_run_status_query(text: str) -> bool:
    raw = (text or "").strip().lower()
    if not raw:
        return False
    keywords = (
        "run_id",
        "run status",
        "status",
        "\u8fd0\u884c\u72b6\u6001",
        "\u67e5\u8be2",
        "\u521a\u624d",
    )
    return any(keyword in raw for keyword in keywords)


def _collect_recent_run_id(body: AIChatRequest) -> str | None:
    run_id = _maybe_extract_run_id_from_text(body.user_input)
    if run_id:
        return run_id
    for message in reversed(body.conversation_history or []):
        run_id = _maybe_extract_run_id_from_text(message.content)
        if run_id:
            return run_id
    return None


def _maybe_extract_node_rename(text: str) -> tuple[str, str] | None:
    raw = (text or "").strip()
    if not raw:
        return None
    for pattern in _NODE_RENAME_PATTERNS:
        match = pattern.search(raw)
        if not match:
            continue
        target = _clean_extracted_text(match.group(1))
        new_label = _clean_extracted_text(match.group(2))
        if target and new_label:
            return target, new_label
    return None


def _maybe_extract_delete_edge(text: str) -> tuple[str, str] | None:
    raw = (text or "").strip()
    if not raw:
        return None
    for pattern in _DELETE_EDGE_PATTERNS:
        match = pattern.search(raw)
        if not match:
            continue
        source = _clean_extracted_text(match.group(1))
        target = _clean_extracted_text(match.group(2))
        if source and target:
            return source, target
    return None


def _maybe_extract_add_edge(text: str) -> tuple[str, str] | None:
    raw = (text or "").strip()
    if not raw:
        return None
    for pattern in _ADD_EDGE_PATTERNS:
        match = pattern.search(raw)
        if not match:
            continue
        source = _clean_extracted_text(match.group(1))
        target = _clean_extracted_text(match.group(2))
        if source and target:
            return source, target
    return None


def _resolve_direct_node_type(text: str) -> str | None:
    raw = (text or "").lower()
    if not raw or "\u8282\u70b9" not in raw and "node" not in raw:
        return None
    for alias, canonical in _DIRECT_NODE_TYPE_ALIASES.items():
        if alias.lower() in raw:
            return canonical
    return None


def _resolve_last_canvas_label(body: AIChatRequest) -> str | None:
    nodes = list((body.canvas_context.nodes if body.canvas_context else None) or [])
    if not nodes:
        return None
    nodes.sort(key=lambda item: item.index)
    last = nodes[-1]
    return _clean_extracted_text(last.label)


def _maybe_extract_add_node_params(body: AIChatRequest) -> dict[str, Any] | None:
    raw = (body.user_input or "").strip()
    if not raw:
        return None
    lowered = raw.lower()
    if not any(keyword in lowered for keyword in ("\u65b0\u589e", "\u6dfb\u52a0", "add", "create")):
        return None
    if "\u8282\u70b9" not in raw and "node" not in lowered:
        return None

    node_type = _resolve_direct_node_type(raw)
    if not node_type:
        return None

    label: str | None = None
    for pattern in _ADD_NODE_LABEL_PATTERNS:
        match = pattern.search(raw)
        if not match:
            continue
        label = _clean_extracted_text(match.group(1))
        if label:
            break
    if not label:
        return None

    params: dict[str, Any] = {
        "workflow_id": body.canvas_context.workflow_id if body.canvas_context else None,
        "node_type": node_type,
        "label": label,
    }
    if any(keyword in raw for keyword in ("\u6700\u540e\u4e00\u6b65", "\u6700\u540e\u4e00\u4e2a\u8282\u70b9", "\u540e\u9762", "\u4e4b\u540e")):
        anchor = _resolve_last_canvas_label(body)
        if anchor:
            params["anchor"] = anchor
    return params


def _looks_like_delete_missing_edge(text: str) -> bool:
    raw = (text or "").strip()
    if not raw:
        return False
    return any(pattern.search(raw) for pattern in _DELETE_MISSING_EDGE_PATTERNS)


def _build_tool_outcome(
    tool_name: str,
    params: dict[str, Any],
    result: ToolResult,
    *,
    meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data = result.data if isinstance(result.data, dict) else {}
    return {
        "tool": tool_name,
        "params": params,
        "result": data,
        "ok": result.ok,
        "error": result.error,
        "meta": meta or {},
    }


def _build_tool_fallback_completion(
    tool_outcomes: list[dict[str, Any]],
    *,
    need_answer: bool = True,
    need_summary: bool = True,
    include_done_tag: bool = True,
) -> list[dict[str, str]] | None:
    if not tool_outcomes:
        return None
    last = tool_outcomes[-1]
    tool_name = last.get("tool")
    params = last.get("params") or {}
    result = last.get("result") or {}
    meta = last.get("meta") or {}
    ok = bool(last.get("ok"))
    answer_text: str | None = None
    summary_changes: list[str] = []

    if not ok:
        error = last.get("error") or "工具执行失败"
        answer_text = f"操作失败：{error}"
        summary_changes = ["本轮未产生副作用"]

    elif tool_name == "list_workflows":
        items = result.get("items") or []
        if items:
            names = [str(item.get("name") or item.get("id") or "") for item in items[:5]]
            answer_text = f"我找到了 {len(items)} 个工作流：{', '.join(filter(None, names))}。"
        else:
            answer_text = "你当前还没有可用的工作流。"
        summary_changes = ["本轮未产生副作用"]
    elif tool_name == "open_workflow":
        name = result.get("name") or params.get("id") or "目标工作流"
        answer_text = f"已打开工作流「{name}」。"
        summary_changes = [f"open_workflow: {name}"]
    elif tool_name == "rename_workflow":
        new_name = params.get("new_name") or result.get("new_name") or "未命名"
        old_name = meta.get("old_name")
        answer_text = f"已将工作流重命名为 **{new_name}**。"
        if old_name:
            summary_changes = [f"rename_workflow: {old_name} -> {new_name}"]
        else:
            summary_changes = [f"rename_workflow: {new_name}"]
    elif tool_name == "read_canvas":
        nodes = result.get("nodes") or []
        node_count = result.get("node_count", len(nodes))
        edge_count = result.get("edge_count", 0)
        if nodes:
            parts = []
            for node in nodes[:5]:
                label = node.get("label") or node.get("id") or "节点"
                node_type = node.get("type") or "unknown"
                status = node.get("status") or "pending"
                parts.append(f"{label}（{node_type}/{status}）")
            answer_text = (
                f"当前画布共有 {node_count} 个节点、{edge_count} 条连线。"
                f"节点包括：{', '.join(parts)}。"
            )
        else:
            answer_text = f"当前画布为空，节点数为 0，连线数为 {edge_count}。"
        summary_changes = ["本轮未产生副作用"]
    elif tool_name == "add_edge":
        source = params.get("source") or "源节点"
        target = params.get("target") or "目标节点"
        answer_text = f"已将「{source}」连接到「{target}」。"
        summary_changes = [f"add_edge: {source} -> {target}"]
    elif tool_name == "delete_edge":
        source = params.get("source") or "源节点"
        target = params.get("target") or "目标节点"
        answer_text = f"已删除「{source}」到「{target}」这条连线。"
        summary_changes = [f"delete_edge: {source} -> {target}"]
    elif tool_name == "add_node":
        label = params.get("label") or result.get("created_node_id") or "新节点"
        answer_text = f"已新增节点「{label}」。"
        summary_changes = [f"add_node: {label}"]
    elif tool_name == "update_node":
        target = params.get("target") or result.get("updated_node_id") or "节点"
        new_label = ((params.get("updates") or {}).get("label")) or target
        answer_text = f"已将「{target}」更新为「{new_label}」。"
        summary_changes = [f"update_node: {target} -> {new_label}"]
    elif tool_name == "delete_node":
        target = params.get("target") or result.get("deleted_node_id") or "节点"
        answer_text = f"已删除「{target}」节点。"
        summary_changes = [f"delete_node: {target}"]
    elif tool_name == "start_workflow_background":
        run_id = result.get("run_id") or "unknown"
        answer_text = f"已在后台启动当前工作流，run_id = `{run_id}`。"
        summary_changes = [f"start_workflow_background: run_id={run_id}"]
    elif tool_name == "get_workflow_run_status":
        status = result.get("status") or "unknown"
        done_nodes = result.get("done_nodes")
        total_nodes = result.get("total_nodes")
        progress = ""
        if done_nodes is not None and total_nodes is not None:
            progress = f"（{done_nodes}/{total_nodes}）"
        error = result.get("error")
        error_suffix = f"，错误：{error}" if error else ""
        answer_text = f"当前运行状态为 **{status}**{progress}{error_suffix}。"
        summary_changes = [f"get_workflow_run_status: status={status}"]
    else:
        return None

    events: list[dict[str, str]] = []
    if need_answer and answer_text:
        events.extend(_emit_text_segment("answer", answer_text))
    if need_summary and summary_changes:
        events.extend(_emit_summary_segments(summary_changes))
    if include_done_tag:
        events.append(_sse({"event": "llm_done_tag"}))
    return events or None


async def _run_direct_tool(
    *,
    ctx: ToolContext,
    tool_name: str,
    params: dict[str, Any],
    meta: dict[str, Any] | None = None,
    call_id: str | None = None,
) -> list[dict[str, str]] | None:
    spec = get_tool(tool_name)
    if spec is None:
        return None
    try:
        result = await spec.handler(ctx, params)
    except Exception as exc:  # noqa: BLE001
        logger.exception("direct tool %s crashed: %s", tool_name, exc)
        result = ToolResult(ok=False, error=f"工具执行异常: {exc}")
    return _build_direct_tool_events(
        tool_name=tool_name,
        params=params,
        result=result,
        meta=meta,
        call_id=call_id,
    )


def _build_direct_tool_events(
    *,
    tool_name: str,
    params: dict[str, Any],
    result: ToolResult,
    meta: dict[str, Any] | None = None,
    call_id: str | None = None,
) -> list[dict[str, str]]:
    direct_call_id = call_id or f"tc-direct-{tool_name}"
    events: list[dict[str, str]] = [
        _sse({"event": "round_start", "round": 1}),
        _sse({
            "event": "tool_call",
            "tool": tool_name,
            "params": params,
            "call_id": direct_call_id,
            "status": "running",
        }),
        _sse({
            "event": "tool_result",
            "tool": tool_name,
            "call_id": direct_call_id,
            "ok": result.ok,
            "data": result.data,
            "error": result.error,
        }),
    ]
    if result.ui_effect is not None:
        events.append(_sse({"event": "ui_effect", **_serialize_ui_effect(result.ui_effect)}))
    if result.canvas_mutation is not None:
        events.append(_sse({"event": "canvas_mutation", **_serialize_canvas_mutation(result.canvas_mutation)}))
    fallback = _build_tool_fallback_completion(
        [_build_tool_outcome(tool_name, params, result, meta=meta)],
    )
    if fallback:
        events.extend(fallback)
    return events


async def _maybe_run_direct_shortcut(
    body: AIChatRequest,
    ctx: ToolContext,
) -> list[dict[str, str]] | None:
    if _looks_like_list_workflows_request(body.user_input):
        return await _run_direct_tool(
            ctx=ctx,
            tool_name="list_workflows",
            params={"limit": 20},
            call_id="tc-direct-list-workflows",
        )

    if _looks_like_open_latest_workflow_request(body.user_input):
        result = (
            await ctx.db.from_("ss_workflows")
            .select("id,name")
            .eq("user_id", ctx.user["id"])
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        items = result.data or []
        if not items:
            open_result = ToolResult(ok=False, error="找不到可打开的工作流")
            return _build_direct_tool_events(
                tool_name="open_workflow",
                params={"id": "__missing__"},
                result=open_result,
                call_id="tc-direct-open-latest",
            )
        return await _run_direct_tool(
            ctx=ctx,
            tool_name="open_workflow",
            params={"id": items[0]["id"]},
            call_id="tc-direct-open-latest",
        )

    workflow_name = _maybe_extract_open_workflow_name(body.user_input)
    if workflow_name:
        result = (
            await ctx.db.from_("ss_workflows")
            .select("id,name")
            .eq("user_id", ctx.user["id"])
            .order("updated_at", desc=True)
            .limit(20)
            .execute()
        )
        items = result.data or []
        matched = next(
            (
                item
                for item in items
                if _clean_extracted_text(item.get("name")).lower() == workflow_name.lower()
            ),
            None,
        )
        if matched is None:
            open_result = ToolResult(ok=False, error=f"找不到工作流「{workflow_name}」")
            return _build_direct_tool_events(
                tool_name="open_workflow",
                params={"id": workflow_name},
                result=open_result,
                call_id="tc-direct-open-workflow",
            )
        return await _run_direct_tool(
            ctx=ctx,
            tool_name="open_workflow",
            params={"id": matched["id"]},
            call_id="tc-direct-open-workflow",
        )

    run_id = _collect_recent_run_id(body)
    if run_id and _looks_like_run_status_query(body.user_input):
        return await _run_direct_tool(
            ctx=ctx,
            tool_name="get_workflow_run_status",
            params={"run_id": run_id},
            call_id="tc-direct-run-status",
        )

    if not ctx.workflow_id:
        return None

    if _looks_like_read_canvas_request(body.user_input):
        return await _run_direct_tool(
            ctx=ctx,
            tool_name="read_canvas",
            params={"workflow_id": ctx.workflow_id},
            call_id="tc-direct-read-canvas",
        )

    new_name = _maybe_extract_current_workflow_rename(body.user_input)
    if new_name:
        old_name = (body.canvas_context.workflow_name if body.canvas_context else "") or "当前工作流"
        return await _run_direct_tool(
            ctx=ctx,
            tool_name="rename_workflow",
            params={"id": ctx.workflow_id, "new_name": new_name},
            meta={"old_name": old_name},
            call_id="tc-direct-rename",
        )

    if _maybe_extract_current_workflow_run(body.user_input):
        return await _run_direct_tool(
            ctx=ctx,
            tool_name="start_workflow_background",
            params={"id": ctx.workflow_id},
            call_id="tc-direct-start-run",
        )

    node_rename = _maybe_extract_node_rename(body.user_input)
    if node_rename is not None:
        target, new_label = node_rename
        return await _run_direct_tool(
            ctx=ctx,
            tool_name="update_node",
            params={"workflow_id": ctx.workflow_id, "target": target, "updates": {"label": new_label}},
            call_id="tc-direct-update-node",
        )

    add_node_params = _maybe_extract_add_node_params(body)
    if add_node_params is not None:
        return await _run_direct_tool(
            ctx=ctx,
            tool_name="add_node",
            params=add_node_params,
            call_id="tc-direct-add-node",
        )

    add_edge = _maybe_extract_add_edge(body.user_input)
    if add_edge is not None:
        source, target = add_edge
        return await _run_direct_tool(
            ctx=ctx,
            tool_name="add_edge",
            params={"workflow_id": ctx.workflow_id, "source": source, "target": target},
            call_id="tc-direct-add-edge",
        )

    delete_edge = _maybe_extract_delete_edge(body.user_input)
    if delete_edge is not None:
        source, target = delete_edge
        return await _run_direct_tool(
            ctx=ctx,
            tool_name="delete_edge",
            params={"workflow_id": ctx.workflow_id, "source": source, "target": target},
            call_id="tc-direct-delete-edge",
        )

    if _looks_like_delete_missing_edge(body.user_input):
        return await _run_direct_tool(
            ctx=ctx,
            tool_name="delete_edge",
            params={"workflow_id": ctx.workflow_id, "edge_id": "__missing_edge__"},
            call_id="tc-direct-delete-edge-missing",
        )

    return None

async def _get_token_iter(
    selected_sku,
    stream_msgs: list[dict[str, str]],
    effective_thinking_level: ThinkingLevel,
) -> AsyncIterator[str]:
    if selected_sku:
        return await call_llm_direct(
            selected_sku.provider,
            selected_sku.model_id,
            stream_msgs,
            stream=True,
        )
    if should_force_reasoning_model(selected_sku, effective_thinking_level):
        return await call_llm_direct(
            "deepseek",
            "deepseek-reasoner",
            stream_msgs,
            stream=True,
        )
    return await call_lightweight_chat_response(stream_msgs, stream=True)


# ── Main entry point ────────────────────────────────────────────────────

async def run_agent_loop(
    body: AIChatRequest,
    current_user: dict,
    *,
    db,
    service_db,
) -> AsyncIterator[dict[str, str]]:
    """Run the ReAct loop for one user turn, yielding SSE-ready events."""
    selected_sku = await resolve_selected_sku(
        selected_model_key=body.selected_model_key,
        selected_platform=body.selected_platform,
        selected_model=body.selected_model,
    )

    canvas_summary = build_canvas_summary(body.canvas_context)
    model_identity = selected_sku.display_name if selected_sku else "StudySolo 默认模型"
    workflow_id = body.canvas_context.workflow_id if body.canvas_context else None

    ctx = ToolContext(
        user=current_user,
        db=db,
        service_db=service_db,
        workflow_id=workflow_id,
    )
    workflow_list = await _build_workflow_list_summary(ctx)
    tools_block = _format_tools_block()

    system_prompt = get_agent_xml_prompt(
        canvas_summary=canvas_summary,
        workflow_list_summary=workflow_list,
        tools_block=tools_block,
        model_identity=model_identity,
    )

    history_msgs = [
        {"role": m.role, "content": m.content}
        for m in (body.conversation_history or [])[-20:]
    ]
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_prompt},
        *history_msgs,
        {"role": "user", "content": body.user_input},
    ]

    effective_thinking_level = resolve_effective_thinking_level(
        body.thinking_level,
        selected_sku,
    )

    # Emit initial intent event so frontend can mark message as "agent".
    yield _sse({"event": "agent_start", "intent": "AGENT", "mode": body.mode})

    recent_calls: list[tuple[str, str]] = []
    done_flag = False
    last_tool_outcomes: list[dict[str, Any]] = []

    shortcut_events = await _maybe_run_direct_shortcut(body, ctx)
    if shortcut_events is not None:
        for event in shortcut_events:
            yield event
        yield _sse({"event": "agent_end", "done": True})
        yield {"data": "[DONE]"}
        return

    for round_idx in range(MAX_ROUNDS):
        yield _sse({"event": "round_start", "round": round_idx + 1})

        parser = XmlStreamParser()
        assistant_chunks: list[str] = []
        pending_tool_calls: list[dict[str, Any]] = []
        saw_answer_segment = False
        saw_summary_segment = False
        saw_done_tag = False

        try:
            token_iter = await _get_token_iter(selected_sku, messages, effective_thinking_level)
        except AIRouterError as exc:
            logger.warning("agent loop: LLM router error: %s", exc)
            yield _sse({"event": "error", "error": "AI 模型调用失败，请稍后重试", "done": True})
            yield {"data": "[DONE]"}
            return

        async for token in token_iter:
            assistant_chunks.append(token)
            for ev in parser.feed(token):
                if ev.get("type") == "segment_delta" and ev.get("tag") == "answer" and str(ev.get("delta") or "").strip():
                    saw_answer_segment = True
                elif ev.get("type") == "segment_delta" and str(ev.get("tag") or "").startswith("summary"):
                    saw_summary_segment = True
                elif ev.get("type") == "done":
                    saw_done_tag = True
                forwarded = _forward_parser_event(ev, pending_tool_calls)
                if forwarded is not None:
                    yield forwarded

        for ev in parser.close():
            if ev.get("type") == "segment_delta" and ev.get("tag") == "answer" and str(ev.get("delta") or "").strip():
                saw_answer_segment = True
            elif ev.get("type") == "segment_delta" and str(ev.get("tag") or "").startswith("summary"):
                saw_summary_segment = True
            elif ev.get("type") == "done":
                saw_done_tag = True
            forwarded = _forward_parser_event(ev, pending_tool_calls)
            if forwarded is not None:
                yield forwarded

        assistant_full = "".join(assistant_chunks)
        # Append assistant XML to history, excluding R1 reasoning so later rounds
        # do not accumulate hidden chain-of-thought tokens.
        messages.append({"role": "assistant", "content": strip_reasoning_blocks(assistant_full)})

        # Detect <done/>.
        if "<done" in assistant_full:
            done_flag = True

        if not pending_tool_calls:
            if last_tool_outcomes and (not saw_answer_segment or not saw_summary_segment):
                fallback = _build_tool_fallback_completion(
                    last_tool_outcomes,
                    need_answer=not saw_answer_segment,
                    need_summary=not saw_summary_segment,
                    include_done_tag=not saw_done_tag,
                )
                if fallback:
                    for event in fallback:
                        yield event
            # No tool calls this round → terminal.
            break

        # Execute tool calls sequentially (keeps deterministic DB ordering).
        tool_results_payload: list[str] = []
        current_tool_outcomes: list[dict[str, Any]] = []
        for call in pending_tool_calls:
            tool_name = call.get("tool", "")
            params = call.get("params") or {}
            call_id = call.get("call_id", "")

            signature = (tool_name, json.dumps(params, sort_keys=True, ensure_ascii=False))
            recent_calls.append(signature)
            recent_calls = recent_calls[-MAX_DUPLICATE_TOOL_CALLS:]
            if (
                len(recent_calls) == MAX_DUPLICATE_TOOL_CALLS
                and all(c == signature for c in recent_calls)
            ):
                yield _sse({
                    "event": "warning",
                    "message": f"tool {tool_name} 重复调用 {MAX_DUPLICATE_TOOL_CALLS} 次，已强制中断",
                })
                done_flag = True
                break

            spec = get_tool(tool_name)
            if not spec:
                result = ToolResult(ok=False, error=f"未知工具: {tool_name}")
            else:
                yield _sse({
                    "event": "tool_call",
                    "tool": tool_name,
                    "params": params,
                    "call_id": call_id,
                    "status": "running",
                })
                try:
                    result = await spec.handler(ctx, params)
                except Exception as exc:  # noqa: BLE001
                    logger.exception("tool %s crashed: %s", tool_name, exc)
                    result = ToolResult(ok=False, error=f"工具执行异常: {exc}")

            result_payload = result.to_llm_payload()
            yield _sse({
                "event": "tool_result",
                "tool": tool_name,
                "call_id": call_id,
                "ok": result.ok,
                "data": result_payload.get("data"),
                "error": result.error,
            })
            if result.canvas_mutation is not None:
                yield _sse({
                    "event": "canvas_mutation",
                    **_serialize_canvas_mutation(result.canvas_mutation),
                })
            if result.ui_effect is not None:
                yield _sse({
                    "event": "ui_effect",
                    **_serialize_ui_effect(result.ui_effect),
                })
            current_tool_outcomes.append(_build_tool_outcome(tool_name, params, result))

            tool_results_payload.append(
                f"<tool_result call_id=\"{call_id}\" tool=\"{tool_name}\">\n"
                f"{json.dumps(result_payload, ensure_ascii=False)}\n"
                f"</tool_result>"
            )

        if done_flag:
            break

        last_tool_outcomes = current_tool_outcomes

        # Feed tool results back as a user-turn reply.
        messages.append(
            {
                "role": "user",
                "content": (
                    "以下是你上一轮工具调用的结果，请基于这些结果继续执行下一步，"
                    "直到最终可以输出 <answer> + <summary> + <done/>:\n\n"
                    + "\n".join(tool_results_payload)
                ),
            }
        )
    else:
        # Loop exhausted.
        yield _sse({
            "event": "warning",
            "message": f"已达到最大轮次 {MAX_ROUNDS}，强制结束",
        })

    yield _sse({"event": "agent_end", "done": True})
    yield {"data": "[DONE]"}


def _forward_parser_event(
    ev: dict[str, Any],
    pending_tool_calls: list[dict[str, Any]],
) -> dict[str, str] | None:
    """Convert a parser event into an SSE payload; collect tool calls."""
    t = ev.get("type")
    if t == "segment_start":
        return _sse({"event": "segment_start", "tag": ev["tag"], "attrs": ev.get("attrs", {})})
    if t == "segment_delta":
        return _sse({"event": "segment_delta", "tag": ev["tag"], "delta": ev["delta"]})
    if t == "segment_end":
        return _sse({"event": "segment_end", "tag": ev["tag"]})
    if t == "text":
        # Stray text outside all segments — forward as segment_delta answer.
        return _sse({"event": "segment_delta", "tag": "answer", "delta": ev["delta"]})
    if t == "tool_call_ready":
        pending_tool_calls.append(ev)
        return None  # tool_call SSE is emitted after we actually run it
    if t == "done":
        return _sse({"event": "llm_done_tag"})
    return None


__all__ = ["run_agent_loop", "MAX_ROUNDS", "_maybe_extract_current_workflow_rename"]
