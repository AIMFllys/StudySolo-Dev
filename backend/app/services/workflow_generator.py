"""Workflow generation logic — graph normalization, auto-layout, two-stage AI pipeline."""

import json
import logging
import re
from collections import defaultdict, deque
from pathlib import Path
from urllib.request import Request, urlopen

from fastapi import HTTPException, status
from pydantic import ValidationError

from app.core.config_loader import get_config
from app.models.ai import (
    AnalyzerOutput,
    GenerateWorkflowRequest,
    GenerateWorkflowResponse,
    ImplicitContext,
    NodePosition,
    NodeType,
    PlannerOutput,
    WorkflowEdgeSchema,
    WorkflowNodeSchema,
)
from app.nodes._base import BaseNode
from app.services.workflow_canvas_service import create_workflow_edge_instance, create_workflow_node_instance
from app.services.llm.router import AIRouterError, call_llm

logger = logging.getLogger(__name__)
DEBUG_LOG_PATH = Path("backend/debug-f04052b.log")


def _debug_log(hypothesis_id: str, location: str, message: str, data: dict) -> None:
    payload = {
        "sessionId": "f04052",
        "runId": "pre-fix",
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(__import__("time").time() * 1000),
    }
    try:
        # Write to a dedicated dev log file that Cursor can read.
        with DEBUG_LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")

        # Also try to forward to the provisioned ingest server (best-effort).
        req = Request(
            "http://127.0.0.1:7807/ingest/6761d4ab-0d6d-4e94-a0bc-90a491230a9a",
            method="POST",
            headers={"Content-Type": "application/json", "X-Debug-Session-Id": "f04052"},
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        )
        with urlopen(req, timeout=0.2):
            pass
    except Exception:
        logger.debug("debug log write failed", exc_info=True)

AGENT_NODE_TYPES = {
    NodeType.agent_code_review,
    NodeType.agent_deep_research,
    NodeType.agent_news,
    NodeType.agent_study_tutor,
    NodeType.agent_visual_site,
}


def _node_schema(
    node_type: str,
    *,
    label: str,
    position: NodePosition | None,
    data_patch: dict | None = None,
    node_id: str | None = None,
) -> WorkflowNodeSchema:
    node = create_workflow_node_instance(
        node_type,
        label=label,
        position=position.model_dump() if position else {"x": 0, "y": 0},
        data_patch=data_patch or {},
        node_id=node_id,
    )
    return WorkflowNodeSchema.model_validate(node)


def _edge_schemas(edges: list[WorkflowEdgeSchema], nodes: list[WorkflowNodeSchema]) -> list[WorkflowEdgeSchema]:
    node_dicts = [node.model_dump(exclude_none=True) for node in nodes]
    edge_dicts: list[dict] = []
    result: list[WorkflowEdgeSchema] = []
    for edge in edges:
        edge_obj = create_workflow_edge_instance(
            edge.source,
            edge.target,
            edge_id=edge.id,
            data_patch=edge.data,
            existing_edges=edge_dicts,
            nodes=node_dicts,
        )
        edge_dicts.append(edge_obj)
        result.append(WorkflowEdgeSchema.model_validate(edge_obj))
    return result


# ── JSON extraction ──────────────────────────────────────────────────────────

def extract_json(text: str) -> str:
    """Extract JSON from a response that may contain markdown code fences."""
    m = re.search(r"```(?:json)?\s*\n([\s\S]+?)\n\s*```", text)
    if m:
        return m.group(1).strip()
    m = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
    if m:
        return m.group(1).strip()
    return text.strip()


# ── Graph normalization ──────────────────────────────────────────────────────

def normalize_edges(nodes: list[WorkflowNodeSchema], edges: list[WorkflowEdgeSchema]) -> list[WorkflowEdgeSchema]:
    """Keep only valid edges; create sequential fallback when missing."""
    node_ids = {n.id for n in nodes}
    normalized: list[WorkflowEdgeSchema] = []
    seen: set[tuple[str, str]] = set()
    for e in edges:
        if e.source not in node_ids or e.target not in node_ids or e.source == e.target:
            continue
        pair = (e.source, e.target)
        if pair in seen:
            continue
        seen.add(pair)
        normalized.append(WorkflowEdgeSchema(id=e.id or f"edge-{e.source}-{e.target}", source=e.source, target=e.target))
    if normalized:
        return normalized
    return [
        WorkflowEdgeSchema(id=f"edge-{nodes[i].id}-{nodes[i+1].id}", source=nodes[i].id, target=nodes[i+1].id)
        for i in range(len(nodes) - 1)
    ]


def should_auto_layout(nodes: list[WorkflowNodeSchema], edges: list[WorkflowEdgeSchema]) -> bool:
    if len(nodes) <= 1:
        return False
    positions = [n.position for n in nodes if n.position]
    if len(positions) != len(nodes):
        return True
    snapped = {(round(p.x / 40), round(p.y / 40)) for p in positions}
    if len(snapped) < len(nodes):
        return True
    unique_x = {round(p.x / 40) for p in positions}
    unique_y = {round(p.y / 40) for p in positions}
    indegree: dict[str, int] = defaultdict(int)
    outdegree: dict[str, int] = defaultdict(int)
    for e in edges:
        indegree[e.target] += 1
        outdegree[e.source] += 1
    has_branching = any(outdegree[n.id] > 1 or indegree[n.id] > 1 for n in nodes)
    if has_branching and (len(unique_x) <= 2 or len(unique_y) <= 1):
        return True
    return len(unique_x) == 1 or len(unique_y) == 1


def auto_layout_nodes(nodes: list[WorkflowNodeSchema], edges: list[WorkflowEdgeSchema]) -> list[WorkflowNodeSchema]:
    """Lay out workflow by dependency levels so branches become visible."""
    adjacency: dict[str, list[str]] = defaultdict(list)
    indeg: dict[str, int] = {n.id: 0 for n in nodes}
    node_order = {n.id: i for i, n in enumerate(nodes)}
    for e in edges:
        adjacency[e.source].append(e.target)
        indeg[e.target] = indeg.get(e.target, 0) + 1

    roots = [n.id for n in nodes if indeg.get(n.id, 0) == 0]
    queue = deque(sorted(roots, key=node_order.get))
    levels: dict[str, int] = {nid: 0 for nid in roots}
    visited: list[str] = []
    while queue:
        cur = queue.popleft()
        visited.append(cur)
        for nb in adjacency.get(cur, []):
            levels[nb] = max(levels.get(nb, 0), levels.get(cur, 0) + 1)
            indeg[nb] -= 1
            if indeg[nb] == 0:
                queue.append(nb)
    if len(visited) != len(nodes):
        nxt = max(levels.values(), default=-1) + 1
        for n in nodes:
            if n.id not in levels:
                levels[n.id] = nxt
                nxt += 1

    columns: dict[int, list[WorkflowNodeSchema]] = defaultdict(list)
    for n in nodes:
        columns[levels.get(n.id, 0)].append(n)

    laid_out: list[WorkflowNodeSchema] = []
    for lv in sorted(columns.keys()):
        col = sorted(columns[lv], key=lambda c: (round(c.position.y / 20) if c.position else 0, node_order[c.id]))
        offset = 36 if len(col) > 1 and lv % 2 else 0
        for row, n in enumerate(col):
            node_payload = n.model_dump(exclude_none=True)
            node_payload["position"] = {"x": 120 + lv * 340, "y": 120 + row * 220 + offset}
            laid_out.append(WorkflowNodeSchema.model_validate(node_payload))
    return sorted(laid_out, key=lambda n: node_order[n.id])


# ── Retry-validated AI call ──────────────────────────────────────────────────

async def call_with_retry(node_type: str, messages: list[dict], model_cls, max_retries: int = 3):
    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            raw = await call_llm(node_type, messages, stream=False)
            return model_cls.model_validate_json(extract_json(raw))
        except (ValidationError, json.JSONDecodeError, ValueError) as e:
            logger.warning("Attempt %d/%d validation failed: %s", attempt, max_retries, e)
            last_error = e
            messages = messages + [
                {"role": "assistant", "content": raw if "raw" in dir() else ""},
                {"role": "user", "content": f"输出格式不正确，请重新生成严格的 JSON。错误：{e}"},
            ]
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"AI 输出验证失败（已重试 {max_retries} 次）：{last_error}",
    )


# ── Two-stage generation pipeline ────────────────────────────────────────────

async def generate_workflow_core(body: GenerateWorkflowRequest, safe_input: str) -> GenerateWorkflowResponse:
    cfg = get_config()
    max_retries = cfg["engine"]["json_validation_retries"]

    # Stage 1: AI_Analyzer
    analyzer_messages = [
        {"role": "system", "content": BaseNode.get_system_prompt_for_type("ai_analyzer")},
        {"role": "user", "content": safe_input},
    ]
    try:
        analyzer_output: AnalyzerOutput = await call_with_retry("ai_analyzer", analyzer_messages, AnalyzerOutput, max_retries)
    except AIRouterError as e:
        raise HTTPException(status_code=503, detail=f"AI 服务暂时不可用：{e}")

    implicit_context = ImplicitContext(
        global_theme=analyzer_output.goal,
        language_style=analyzer_output.extras.get("language_style", "简洁专业"),
        core_outline=analyzer_output.user_defined_steps,
        target_audience=analyzer_output.extras.get("target_audience", "学习者"),
        user_constraints=analyzer_output.constraints,
    )

    # Stage 2: AI_Planner
    planner_messages = [
        {"role": "system", "content": BaseNode.get_system_prompt_for_type("ai_planner")},
        {"role": "user", "content": f"需求分析结果：\n{analyzer_output.model_dump_json(indent=2)}\n\n暗线上下文：\n{implicit_context.model_dump_json(indent=2)}"},
    ]
    try:
        planner_output: PlannerOutput = await call_with_retry("ai_planner", planner_messages, PlannerOutput, max_retries)
    except AIRouterError as e:
        raise HTTPException(status_code=503, detail=f"AI 服务暂时不可用：{e}")

    # Enrich nodes
    enriched_nodes: list[WorkflowNodeSchema] = []
    for node in planner_output.nodes:
        try:
            nt = NodeType(node.type)
        except ValueError:
            nt = NodeType.chat_response
        model_route = node.data.model_route if nt in AGENT_NODE_TYPES else (node.data.model_route or f"{nt.value}/default")
        enriched_nodes.append(_node_schema(
            nt.value,
            label=node.data.label,
            position=node.position or NodePosition(x=0, y=0),
            node_id=node.id,
            data_patch={
                "system_prompt": BaseNode.get_system_prompt_for_type(nt.value),
                "model_route": model_route,
                "status": "pending",
                "output": "",
            },
        ))
    # #region agent log
    _debug_log(
        "H1",
        "workflow_generator.py:229",
        "planner nodes before normalize/layout",
        {
            "count": len(enriched_nodes),
            "positions": [{"id": n.id, "x": n.position.x, "y": n.position.y} for n in enriched_nodes[:12]],
        },
    )
    # #endregion

    normalized_edges = normalize_edges(enriched_nodes, planner_output.edges)

    # Inject input source nodes
    input_source_types = {"trigger_input", "knowledge_base", "web_search"}
    existing_types = {n.type for n in enriched_nodes}
    injected_ids: list[str] = []

    if "trigger_input" not in existing_types:
        tid = "trigger-input-0"
        enriched_nodes.insert(0, _node_schema(
            "trigger_input",
            label=body.user_input.strip().replace("\n", " ")[:80],
            position=NodePosition(x=0, y=0),
            node_id=tid,
            data_patch={"user_content": body.user_input},
        ))
        injected_ids.append(tid)

    if analyzer_output.input_sources.need_knowledge_base and "knowledge_base" not in existing_types:
        kid = "kb-input-0"
        enriched_nodes.insert(1, _node_schema(
            "knowledge_base",
            label="\U0001f4da \u77e5\u8bc6\u5e93\u68c0\u7d22",
            position=NodePosition(x=0, y=0),
            node_id=kid,
            data_patch={"config": {"top_k": 5, "threshold": 0.7}},
        ))
        injected_ids.append(kid)

    if analyzer_output.input_sources.need_web_search and "web_search" not in existing_types:
        wid = "ws-input-0"
        enriched_nodes.insert(min(2, len(enriched_nodes)), _node_schema(
            "web_search",
            label="\U0001f310 \u8054\u7f51\u641c\u7d22",
            position=NodePosition(x=0, y=0),
            node_id=wid,
            data_patch={"config": {"max_results": 5, "search_depth": "advanced"}},
        ))
        injected_ids.append(wid)

    if injected_ids:
        targets_with_incoming = {e.target for e in normalized_edges}
        root_ids = [n.id for n in enriched_nodes if n.type not in input_source_types and n.id not in targets_with_incoming]
        for sid in injected_ids:
            for rid in root_ids:
                normalized_edges.insert(0, WorkflowEdgeSchema(id=f"edge-{sid}-{rid}", source=sid, target=rid))

    final_nodes = auto_layout_nodes(enriched_nodes, normalized_edges)
    # #region agent log
    _debug_log(
        "H2",
        "workflow_generator.py:282",
        "final nodes after auto layout",
        {
            "count": len(final_nodes),
            "positions": [{"id": n.id, "x": n.position.x, "y": n.position.y} for n in final_nodes[:12]],
            "edge_count": len(normalized_edges),
        },
    )
    # #endregion
    final_edges = _edge_schemas(normalized_edges, final_nodes)
    return GenerateWorkflowResponse(nodes=final_nodes, edges=final_edges, implicit_context=implicit_context)
