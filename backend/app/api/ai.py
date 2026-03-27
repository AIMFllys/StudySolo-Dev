"""AI workflow generation routes: /api/ai/*"""

import json
import logging
import re
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError

from app.core.deps import get_current_user
from app.models.ai import (
    AnalyzerOutput,
    GenerateWorkflowRequest,
    GenerateWorkflowResponse,
    ImplicitContext,
    NodeData,
    NodePosition,
    PlannerOutput,
    NodeType,
    WorkflowNodeSchema,
    WorkflowEdgeSchema,
)
from app.nodes._base import BaseNode
from app.services.ai_router import call_llm, AIRouterError
from app.services.usage_ledger import bind_usage_request, create_usage_request, finalize_usage_request
from app.core.config_loader import get_config

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Prompt injection protection ──────────────────────────────────────────────

_INJECTION_PATTERNS = [
    re.compile(r"忽略(以上|上面|前面|之前)(所有|全部)?指令", re.IGNORECASE),
    re.compile(r"ignore (all |previous |above )?instructions?", re.IGNORECASE),
    re.compile(r"^system\s*:", re.IGNORECASE | re.MULTILINE),
    re.compile(r"<\s*system\s*>", re.IGNORECASE),
    re.compile(r"你现在是", re.IGNORECASE),
    re.compile(r"act as", re.IGNORECASE),
    re.compile(r"jailbreak", re.IGNORECASE),
    re.compile(r"DAN\b", re.IGNORECASE),
]


def sanitize_user_input(text: str) -> str:
    """Escape/neutralize potential prompt injection patterns."""
    for pattern in _INJECTION_PATTERNS:
        text = pattern.sub("[FILTERED]", text)
    # Wrap in a sandbox marker so the model knows it's user content
    return f"[USER_INPUT_START]\n{text}\n[USER_INPUT_END]"


# ── JSON extraction helper ───────────────────────────────────────────────────

def _extract_json(text: str) -> str:
    """Extract JSON from a response that may contain markdown code fences."""
    # Try to find ```json ... ``` block
    m = re.search(r"```(?:json)?\s*([\s\S]+?)```", text)
    if m:
        return m.group(1).strip()
    # Try to find first { ... } or [ ... ] block
    m = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
    if m:
        return m.group(1).strip()
    return text.strip()


def _normalize_edges(nodes: list[WorkflowNodeSchema], edges: list[WorkflowEdgeSchema]) -> list[WorkflowEdgeSchema]:
    """Keep only valid edges and create a sequential fallback when missing."""
    node_ids = {node.id for node in nodes}
    normalized: list[WorkflowEdgeSchema] = []
    seen_pairs: set[tuple[str, str]] = set()

    for edge in edges:
        if edge.source not in node_ids or edge.target not in node_ids or edge.source == edge.target:
            continue

        pair = (edge.source, edge.target)
        if pair in seen_pairs:
            continue

        seen_pairs.add(pair)
        normalized.append(
            WorkflowEdgeSchema(
                id=edge.id or f"edge-{edge.source}-{edge.target}",
                source=edge.source,
                target=edge.target,
            )
        )

    if normalized:
        return normalized

    fallback_edges: list[WorkflowEdgeSchema] = []
    for index in range(len(nodes) - 1):
        source = nodes[index].id
        target = nodes[index + 1].id
        fallback_edges.append(
            WorkflowEdgeSchema(
                id=f"edge-{source}-{target}",
                source=source,
                target=target,
            )
        )

    return fallback_edges


def _should_auto_layout(nodes: list[WorkflowNodeSchema], edges: list[WorkflowEdgeSchema]) -> bool:
    """Auto-layout sparse or obviously flattened plans."""
    if len(nodes) <= 1:
        return False

    positions = [node.position for node in nodes if node.position]
    if len(positions) != len(nodes):
        return True

    snapped = {(round(position.x / 40), round(position.y / 40)) for position in positions}
    if len(snapped) < len(nodes):
        return True

    unique_x = {round(position.x / 40) for position in positions}
    unique_y = {round(position.y / 40) for position in positions}

    indegree = defaultdict(int)
    outdegree = defaultdict(int)
    for edge in edges:
        indegree[edge.target] += 1
        outdegree[edge.source] += 1

    has_branching = any(outdegree[node.id] > 1 or indegree[node.id] > 1 for node in nodes)
    if has_branching and (len(unique_x) <= 2 or len(unique_y) <= 1):
        return True

    return len(unique_x) == 1 or len(unique_y) == 1


def _auto_layout_nodes(nodes: list[WorkflowNodeSchema], edges: list[WorkflowEdgeSchema]) -> list[WorkflowNodeSchema]:
    """Lay out the workflow by dependency levels so branches become visible."""
    adjacency: dict[str, list[str]] = defaultdict(list)
    indegree: dict[str, int] = {node.id: 0 for node in nodes}
    node_order = {node.id: index for index, node in enumerate(nodes)}

    for edge in edges:
        adjacency[edge.source].append(edge.target)
        indegree[edge.target] = indegree.get(edge.target, 0) + 1

    roots = [node.id for node in nodes if indegree.get(node.id, 0) == 0]
    queue = deque(sorted(roots, key=node_order.get))
    levels: dict[str, int] = {node_id: 0 for node_id in roots}
    visited: list[str] = []

    while queue:
        current = queue.popleft()
        visited.append(current)
        current_level = levels.get(current, 0)

        for neighbor in adjacency.get(current, []):
            levels[neighbor] = max(levels.get(neighbor, 0), current_level + 1)
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)

    if len(visited) != len(nodes):
        next_level = max(levels.values(), default=-1) + 1
        for node in nodes:
            if node.id not in levels:
                levels[node.id] = next_level
                next_level += 1

    columns: dict[int, list[WorkflowNodeSchema]] = defaultdict(list)
    for node in nodes:
        columns[levels.get(node.id, 0)].append(node)

    laid_out: list[WorkflowNodeSchema] = []
    for level in sorted(columns.keys()):
        column_nodes = sorted(
            columns[level],
            key=lambda current: (
                round(current.position.y / 20) if current.position else 0,
                node_order[current.id],
            ),
        )
        offset = 36 if len(column_nodes) > 1 and level % 2 else 0

        for row, node in enumerate(column_nodes):
            laid_out.append(
                WorkflowNodeSchema(
                    id=node.id,
                    type=node.type,
                    position=NodePosition(
                        x=120 + level * 340,
                        y=120 + row * 220 + offset,
                    ),
                    data=node.data,
                )
            )

    return sorted(laid_out, key=lambda node: node_order[node.id])


# ── Retry-validated AI call ──────────────────────────────────────────────────

async def _call_with_retry(node_type: str, messages: list[dict], model_cls, max_retries: int = 3):
    """Call AI and validate output against model_cls, retrying up to max_retries times."""
    last_error: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            raw = await call_llm(node_type, messages, stream=False)
            json_str = _extract_json(raw)
            return model_cls.model_validate_json(json_str)
        except (ValidationError, json.JSONDecodeError, ValueError) as e:
            logger.warning("Attempt %d/%d validation failed: %s", attempt, max_retries, e)
            last_error = e
            # Append error feedback for next attempt
            messages = messages + [
                {"role": "assistant", "content": raw if "raw" in dir() else ""},
                {
                    "role": "user",
                    "content": f"输出格式不正确，请重新生成严格的 JSON。错误：{e}",
                },
            ]
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"AI 输出验证失败（已重试 {max_retries} 次）：{last_error}",
    )


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/generate-workflow", response_model=GenerateWorkflowResponse)
async def generate_workflow(
    body: GenerateWorkflowRequest,
    current_user: dict = Depends(get_current_user),
):
    return await _generate_workflow_impl(body, current_user)


async def _generate_workflow_impl(
    body: GenerateWorkflowRequest,
    current_user: dict,
) -> GenerateWorkflowResponse:
    usage_request = await create_usage_request(
        user_id=current_user["id"],
        source_type="assistant",
        source_subtype="generate_workflow",
    )
    request_status = "completed"

    with bind_usage_request(usage_request):
        try:
            return await _generate_workflow_core(body)
        except HTTPException:
            request_status = "failed"
            raise
        except Exception:
            request_status = "failed"
            raise
        finally:
            await finalize_usage_request(usage_request.request_id, request_status)


async def _generate_workflow_core(
    body: GenerateWorkflowRequest,
) -> GenerateWorkflowResponse:
    """Two-stage AI workflow generation.

    Stage 1 — AI_Analyzer: parse user input into structured requirements JSON.
    Stage 2 — AI_Planner: generate nodes[] + edges[] from requirements.
    """
    cfg = get_config()
    max_retries = cfg["engine"]["json_validation_retries"]

    safe_input = sanitize_user_input(body.user_input)

    # ── Stage 1: AI_Analyzer ─────────────────────────────────────────────
    analyzer_messages = [
        {"role": "system", "content": BaseNode.get_system_prompt_for_type("ai_analyzer")},
        {"role": "user", "content": safe_input},
    ]

    try:
        analyzer_output: AnalyzerOutput = await _call_with_retry(
            "ai_analyzer", analyzer_messages, AnalyzerOutput, max_retries
        )
    except AIRouterError as e:
        raise HTTPException(status_code=503, detail=f"AI 服务暂时不可用：{e}")

    # Build implicit context from analyzer output
    implicit_context = ImplicitContext(
        global_theme=analyzer_output.goal,
        language_style=analyzer_output.extras.get("language_style", "简洁专业"),
        core_outline=analyzer_output.user_defined_steps,
        target_audience=analyzer_output.extras.get("target_audience", "学习者"),
        user_constraints=analyzer_output.constraints,
    )

    # ── Stage 2: AI_Planner ──────────────────────────────────────────────
    planner_messages = [
        {"role": "system", "content": BaseNode.get_system_prompt_for_type("ai_planner")},
        {
            "role": "user",
            "content": (
                f"需求分析结果：\n{analyzer_output.model_dump_json(indent=2)}\n\n"
                f"暗线上下文：\n{implicit_context.model_dump_json(indent=2)}"
            ),
        },
    ]

    try:
        planner_output: PlannerOutput = await _call_with_retry(
            "ai_planner", planner_messages, PlannerOutput, max_retries
        )
    except AIRouterError as e:
        raise HTTPException(status_code=503, detail=f"AI 服务暂时不可用：{e}")

    # Inject system prompts and model routes into generated nodes
    enriched_nodes: list[WorkflowNodeSchema] = []
    for node in planner_output.nodes:
        try:
            node_type_enum = NodeType(node.type)
        except ValueError:
            node_type_enum = NodeType.chat_response  # fallback

        enriched_nodes.append(
            WorkflowNodeSchema(
                id=node.id,
                type=node.type,
                position=node.position or NodePosition(x=0, y=0),
                data=NodeData(
                    label=node.data.label,
                    type=node.type,
                    system_prompt=BaseNode.get_system_prompt_for_type(node_type_enum.value),
                    model_route=node.data.model_route or f"{node_type_enum.value}/default",
                    status="pending",
                    output="",
                ),
            )
        )

    normalized_edges = _normalize_edges(enriched_nodes, planner_output.edges)

    # ── 自动注入 trigger_input（若 Planner 未生成） ──────────────────
    has_trigger = any(n.type == "trigger_input" for n in enriched_nodes)
    if not has_trigger:
        trigger_id = "trigger-input-0"
        trigger_label = body.user_input.strip().replace("\n", " ")[:80]
        trigger_node = WorkflowNodeSchema(
            id=trigger_id,
            type="trigger_input",
            position=NodePosition(x=0, y=0),  # auto_layout 会重新计算
            data=NodeData(
                label=trigger_label,
                type="trigger_input",
                user_content=body.user_input,  # Full input for downstream nodes
            ),
        )
        enriched_nodes.insert(0, trigger_node)

        # 找到所有入度=0 的非 trigger 节点，从 trigger 连接过去
        targets_with_incoming = {e.target for e in normalized_edges}
        root_ids = [
            n.id for n in enriched_nodes
            if n.id != trigger_id and n.id not in targets_with_incoming
        ]
        for root_id in root_ids:
            normalized_edges.insert(
                0,
                WorkflowEdgeSchema(
                    id=f"edge-{trigger_id}-{root_id}",
                    source=trigger_id,
                    target=root_id,
                ),
            )

    # ── 始终执行自动布局（AI 生成的坐标不可靠） ─────────────────────
    final_nodes = _auto_layout_nodes(enriched_nodes, normalized_edges)

    return GenerateWorkflowResponse(
        nodes=final_nodes,
        edges=normalized_edges,
        implicit_context=implicit_context,
    )
