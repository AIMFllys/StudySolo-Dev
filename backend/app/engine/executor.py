"""Workflow execution engine — pure orchestration.

This is the replacement for services/workflow_engine.py.
It ONLY handles: topology sort → node dispatch → SSE streaming.
All node-specific logic lives in the nodes/ package.

Key improvements over the old engine:
1. Uses NODE_REGISTRY for dynamic dispatch (no hardcoded if/else)
2. Only passes direct upstream outputs (not all accumulated)
3. Calls node.post_process() for output validation
4. Cleaner separation of concerns (~100 lines vs old 229 lines)
"""

import copy
import logging
from collections import defaultdict, deque
from typing import AsyncIterator, Awaitable, Callable

from app.nodes import NODE_REGISTRY
from app.nodes._base import BaseNode, NodeInput
from app.engine.sse import sse_event
from app.engine.context import build_upstream_map, build_downstream_map, get_all_downstream
from app.services.ai_router import call_llm, AIRouterError

logger = logging.getLogger(__name__)


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


# ── Merge outputs helper ─────────────────────────────────────────────────────

def _merge_outputs(
    nodes: list[dict],
    accumulated_outputs: dict[str, str],
    failed_nodes: set[str],
) -> list[dict]:
    """Merge execution outputs back into a deep copy of the original nodes."""
    updated = copy.deepcopy(nodes)
    for node in updated:
        nid = node["id"]
        data = node.setdefault("data", {})
        if nid in accumulated_outputs:
            data["output"] = accumulated_outputs[nid]
            data["status"] = "done"
        elif nid in failed_nodes:
            data["status"] = "error"
    return updated


# ── Main execution engine ────────────────────────────────────────────────────

async def execute_workflow(
    workflow_id: str,
    nodes: list[dict],
    edges: list[dict],
    implicit_context: dict | None = None,
    save_callback: Callable[[str, list[dict]], Awaitable[None]] | None = None,
) -> AsyncIterator[str]:
    """Execute a workflow and yield SSE event strings.

    This is a drop-in replacement for the old services/workflow_engine.execute_workflow.
    The API contract is identical, so api/workflow.py doesn't need changes.
    """
    if not nodes:
        yield sse_event("workflow_done", {"workflow_id": workflow_id, "status": "completed"})
        return

    # 1. Topological sort
    try:
        execution_order = topological_sort(nodes, edges)
    except ValueError as e:
        yield sse_event("workflow_done", {"workflow_id": workflow_id, "status": "error", "error": str(e)})
        return

    # 2. Build maps
    node_map = {n["id"]: n for n in nodes}
    upstream_map = build_upstream_map(edges)
    downstream_map = build_downstream_map(edges)
    failed_nodes: set[str] = set()
    accumulated_outputs: dict[str, str] = {}

    # 3. Execute each node in order
    for node_id in execution_order:
        node_config = node_map.get(node_id)
        if not node_config:
            continue

        # Skip downstream nodes of failed nodes
        if node_id in failed_nodes:
            yield sse_event("node_status", {"node_id": node_id, "status": "pending"})
            continue

        node_type_str = node_config.get("type", "chat_response")
        node_data = node_config.get("data", {})

        # Emit running status
        yield sse_event("node_status", {"node_id": node_id, "status": "running"})

        # 4. Look up node class from registry
        NodeClass = NODE_REGISTRY.get(node_type_str)
        if not NodeClass:
            # Fallback: try chat_response for unknown types
            NodeClass = NODE_REGISTRY.get("chat_response")
            if not NodeClass:
                yield sse_event("node_status", {"node_id": node_id, "status": "error", "error": f"Unknown node type: {node_type_str}"})
                failed_nodes.update(get_all_downstream(node_id, downstream_map))
                continue

        node_instance = NodeClass()

        # 5. Build input — ONLY direct upstream outputs (key improvement!)
        direct_upstream_ids = upstream_map.get(node_id, [])
        upstream_outputs = {
            uid: accumulated_outputs[uid]
            for uid in direct_upstream_ids
            if uid in accumulated_outputs
        }

        node_input = NodeInput(
            user_content=node_data.get("label", ""),
            upstream_outputs=upstream_outputs,
            implicit_context=implicit_context,
            node_config=node_data.get("config"),
        )

        # 6. Execute and stream
        full_output = ""
        try:
            async for token in node_instance.execute(node_input, call_llm):
                full_output += token
                yield sse_event("node_token", {"node_id": node_id, "token": token})

            # 7. Post-process output
            result = await node_instance.post_process(full_output)
            accumulated_outputs[node_id] = result.content

            yield sse_event("node_done", {"node_id": node_id, "full_output": result.content})
            yield sse_event("node_status", {"node_id": node_id, "status": "done"})

        except (AIRouterError, Exception) as e:
            logger.error("Node %s execution failed: %s", node_id, e)
            yield sse_event("node_status", {"node_id": node_id, "status": "error", "error": str(e)})
            failed_nodes.update(get_all_downstream(node_id, downstream_map))

    # 8. Save results
    if save_callback:
        try:
            updated_nodes = _merge_outputs(nodes, accumulated_outputs, failed_nodes)
            await save_callback(workflow_id, updated_nodes)
        except Exception as e:
            logger.error("Auto-save failed for workflow %s: %s", workflow_id, e)
            yield sse_event("save_error", {"workflow_id": workflow_id, "error": str(e)})

    yield sse_event("workflow_done", {"workflow_id": workflow_id, "status": "completed"})
