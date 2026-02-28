"""Workflow execution engine.

Executes workflow nodes in topological order, injecting implicit context
into each LLM node's system prompt, and streaming results via SSE.
"""

import copy
import json
import logging
from collections import defaultdict, deque
from typing import AsyncIterator, Awaitable, Callable

from app.models.ai import ImplicitContext, LLM_NODE_TYPES, NodeType, SYSTEM_PROMPTS
from app.services.ai_router import call_llm, AIRouterError

logger = logging.getLogger(__name__)


# ── SSE event helpers ────────────────────────────────────────────────────────

def _sse_event(event_type: str, data: dict) -> str:
    """Format a single SSE event string."""
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# ── Topological sort ─────────────────────────────────────────────────────────

def topological_sort(nodes: list[dict], edges: list[dict]) -> list[str]:
    """Return node IDs in topological execution order (Kahn's algorithm).

    Raises ValueError if a cycle is detected.
    """
    in_degree: dict[str, int] = {n["id"]: 0 for n in nodes}
    adjacency: dict[str, list[str]] = defaultdict(list)

    for edge in edges:
        src, tgt = edge["source"], edge["target"]
        adjacency[src].append(tgt)
        in_degree[tgt] = in_degree.get(tgt, 0) + 1

    queue: deque[str] = deque(nid for nid, deg in in_degree.items() if deg == 0)
    order: list[str] = []

    while queue:
        nid = queue.popleft()
        order.append(nid)
        for neighbor in adjacency[nid]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(order) != len(nodes):
        raise ValueError("Workflow contains a cycle — cannot execute")

    return order


# ── Implicit context injection ───────────────────────────────────────────────

def _build_context_prompt(implicit_context: dict | None) -> str:
    if not implicit_context:
        return ""
    return (
        "\n\n---\n暗线上下文（请保持输出风格与以下上下文一致）：\n"
        + json.dumps(implicit_context, ensure_ascii=False, indent=2)
        + "\n---"
    )


def _get_all_downstream_helper(node_id: str, downstream: dict[str, set[str]]) -> set[str]:
    """Return all transitive downstream node IDs from a given node."""
    result: set[str] = set()
    queue = deque(downstream.get(node_id, set()))
    while queue:
        nid = queue.popleft()
        if nid not in result:
            result.add(nid)
            queue.extend(downstream.get(nid, set()))
    return result


# ── Merge outputs helper ─────────────────────────────────────────────────────

def _merge_outputs(
    nodes: list[dict],
    node_map: dict[str, dict],
    accumulated_outputs: dict[str, str],
    failed_nodes: set[str],
) -> list[dict]:
    """Merge execution outputs back into a deep copy of the original nodes.

    For each node that produced output, sets ``data.output`` and ``data.status``
    to reflect the execution result.
    """
    updated = copy.deepcopy(nodes)
    for node in updated:
        nid = node["id"]
        data = node.setdefault("data", {})
        if nid in accumulated_outputs:
            data["output"] = accumulated_outputs[nid]
            data["status"] = "done"
        elif nid in failed_nodes:
            data["status"] = "error"
        # nodes that were skipped keep their original status
    return updated


# ── Execution engine ─────────────────────────────────────────────────────────

async def execute_workflow(
    workflow_id: str,
    nodes: list[dict],
    edges: list[dict],
    implicit_context: dict | None = None,
    save_callback: Callable[[str, list[dict]], Awaitable[None]] | None = None,
) -> AsyncIterator[str]:
    """Execute a workflow and yield SSE event strings.

    Yields:
        node_status — when a node starts or finishes
        node_token  — for each streamed token
        node_done   — when a node completes with full output
        workflow_done — when all nodes finish
    """
    if not nodes:
        yield _sse_event("workflow_done", {"workflow_id": workflow_id, "status": "completed"})
        return

    try:
        execution_order = topological_sort(nodes, edges)
    except ValueError as e:
        yield _sse_event("workflow_done", {"workflow_id": workflow_id, "status": "error", "error": str(e)})
        return

    node_map = {n["id"]: n for n in nodes}
    failed_nodes: set[str] = set()
    downstream: dict[str, set[str]] = defaultdict(set)

    # Build downstream map for error propagation
    for edge in edges:
        downstream[edge["source"]].add(edge["target"])

    def _get_all_downstream(node_id: str) -> set[str]:
        return _get_all_downstream_helper(node_id, downstream)

    context_prompt = _build_context_prompt(implicit_context)
    accumulated_outputs: dict[str, str] = {}

    for node_id in execution_order:
        node = node_map.get(node_id)
        if not node:
            continue

        # Skip downstream nodes of failed nodes
        if node_id in failed_nodes:
            yield _sse_event("node_status", {"node_id": node_id, "status": "pending"})
            continue

        node_type_str = node.get("type", "chat_response")
        node_data = node.get("data", {})

        # Emit running status
        yield _sse_event("node_status", {"node_id": node_id, "status": "running"})

        try:
            node_type_enum = NodeType(node_type_str)
        except ValueError:
            node_type_enum = NodeType.chat_response

        # Non-LLM nodes (trigger_input, write_db) — pass through
        if node_type_enum not in LLM_NODE_TYPES:
            yield _sse_event("node_done", {
                "node_id": node_id,
                "full_output": node_data.get("output", ""),
            })
            yield _sse_event("node_status", {"node_id": node_id, "status": "done"})
            accumulated_outputs[node_id] = node_data.get("output", "")
            continue

        # Build system prompt with implicit context
        base_prompt = node_data.get("system_prompt") or SYSTEM_PROMPTS.get(node_type_enum, "")
        system_prompt = base_prompt + context_prompt

        # Build user message — include previous node outputs as context
        prev_outputs = "\n\n".join(
            f"[{nid}]: {out}"
            for nid, out in accumulated_outputs.items()
            if out
        )
        user_content = node_data.get("label", "")
        if prev_outputs:
            user_content = f"前序节点输出：\n{prev_outputs}\n\n当前任务：{user_content}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        full_output = ""
        try:
            token_stream = await call_llm(node_type_str, messages, stream=True)
            async for token in token_stream:
                full_output += token
                yield _sse_event("node_token", {"node_id": node_id, "token": token})

            accumulated_outputs[node_id] = full_output
            yield _sse_event("node_done", {"node_id": node_id, "full_output": full_output})
            yield _sse_event("node_status", {"node_id": node_id, "status": "done"})

        except (AIRouterError, Exception) as e:
            logger.error("Node %s execution failed: %s", node_id, e)
            yield _sse_event("node_status", {"node_id": node_id, "status": "error", "error": str(e)})

            # Mark all downstream nodes as failed
            failed_nodes.update(_get_all_downstream(node_id))

    # Save results before signalling completion
    if save_callback:
        try:
            updated_nodes = _merge_outputs(nodes, node_map, accumulated_outputs, failed_nodes)
            await save_callback(workflow_id, updated_nodes)
        except Exception as e:
            logger.error("Auto-save failed for workflow %s: %s", workflow_id, e)
            yield _sse_event("save_error", {"workflow_id": workflow_id, "error": str(e)})

    yield _sse_event("workflow_done", {"workflow_id": workflow_id, "status": "completed"})


