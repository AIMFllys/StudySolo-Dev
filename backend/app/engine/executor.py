"""Workflow execution engine — main orchestration.

Delegates to:
- topology.py: topological sort, branch filtering, wait helpers
- node_runner.py: single-node execution, input building, LLM caller
- loop_runner.py: loop group container iteration
- level_runner.py: per-level single/parallel dispatch with SSE streaming
"""

import copy
import json
import logging
from typing import AsyncIterator, Awaitable, Callable

from app.engine.context import build_upstream_map, build_downstream_map, get_all_downstream
from app.engine.events import sse_event
from app.engine.level_runner import execute_single_level_node, execute_parallel_level
from app.engine.node_runner import (
    build_input_snapshot,
    build_node_llm_caller,
    build_runtime_config,
    execute_single_node_with_timeout,
    resolve_user_content,
)
from app.engine.topology import (
    get_max_wait_seconds,
    topological_sort,  # noqa: F401 — re-exported for test monkeypatching
    topological_sort_levels,
)
from app.nodes import NODE_REGISTRY  # noqa: F401 — re-exported for test monkeypatching
from app.nodes._base import NodeInput  # noqa: F401 — re-exported for test compatibility
from app.services.ai_catalog_service import get_sku_by_id  # noqa: F401 — re-exported for test monkeypatching
from app.services.llm.router import AIRouterError, call_llm, call_llm_direct  # noqa: F401 — re-exported for test patching
from app.services.usage_ledger import bind_usage_call  # noqa: F401 — re-exported for test compatibility

logger = logging.getLogger(__name__)


# ── Backward-compatible re-exports (used by tests) ──────────────────────────

def _build_context_prompt(implicit_context: dict | None) -> str:
    """Compatibility helper retained for tests and diagnostics."""
    if not implicit_context:
        return ""
    return (
        "\n\n---\n暗线上下文（请保持输出风格与以下上下文一致）：\n"
        + json.dumps(implicit_context, ensure_ascii=False, indent=2)
        + "\n---"
    )


def _get_all_downstream_helper(node_id: str, downstream_map: dict[str, set[str]]) -> set[str]:
    """Compatibility helper retained for tests."""
    return get_all_downstream(node_id, downstream_map)


# Keep old private names accessible for existing test imports
_get_max_wait_seconds = get_max_wait_seconds
_build_input_snapshot = build_input_snapshot
_build_runtime_config = build_runtime_config
_build_node_llm_caller = build_node_llm_caller
_resolve_user_content = resolve_user_content
_execute_single_node_with_timeout = execute_single_node_with_timeout


# ── Merge outputs helper ─────────────────────────────────────────────────────

def _merge_outputs(
    nodes: list[dict],
    accumulated_outputs: dict[str, str],
    blocked_nodes: set[str],
    error_nodes: set[str] | None = None,
) -> list[dict]:
    """Merge execution outputs back into a deep copy of the original nodes."""
    updated = copy.deepcopy(nodes)
    node_errors = error_nodes or set()
    for node in updated:
        nid = node["id"]
        data = node.setdefault("data", {})
        if nid in accumulated_outputs:
            data["output"] = accumulated_outputs[nid]
            data["status"] = "done"
        elif nid in node_errors:
            data["status"] = "error"
        elif nid in blocked_nodes:
            data["status"] = "skipped"
    return updated


# ── Main execution engine ────────────────────────────────────────────────────

async def execute_workflow(
    workflow_id: str,
    nodes: list[dict],
    edges: list[dict],
    implicit_context: dict | None = None,
    save_callback: Callable[[str, list[dict]], Awaitable[None]] | None = None,
) -> AsyncIterator[str]:
    """Execute a workflow and yield SSE event strings."""
    if not nodes:
        yield sse_event("workflow_done", {"workflow_id": workflow_id, "status": "completed"})
        return

    try:
        levels = topological_sort_levels(nodes, edges)
    except ValueError as e:
        yield sse_event("workflow_done", {"workflow_id": workflow_id, "status": "error", "error": str(e)})
        return

    node_map = {n["id"]: n for n in nodes}
    upstream_map = build_upstream_map(edges)
    downstream_map = build_downstream_map(edges)
    error_nodes: set[str] = set()
    failed_nodes: set[str] = set()
    skipped_nodes: set[str] = set()
    accumulated_outputs: dict[str, str] = {}
    accumulated_metadata: dict[str, dict] = {}

    for level in levels:
        for nid in level:
            if nid in skipped_nodes:
                yield sse_event("node_status", {"node_id": nid, "status": "skipped"})
            elif nid in failed_nodes:
                yield sse_event("node_status", {
                    "node_id": nid,
                    "status": "skipped",
                    "error": "上游节点执行失败，已跳过",
                })

        active_nodes = [
            nid for nid in level
            if nid not in failed_nodes and nid not in skipped_nodes
        ]
        if not active_nodes:
            continue

        if len(active_nodes) == 1:
            async for ev in execute_single_level_node(
                active_nodes[0], node_map, nodes, edges, upstream_map, downstream_map,
                implicit_context, accumulated_outputs, error_nodes, failed_nodes, skipped_nodes,
                accumulated_metadata=accumulated_metadata,
            ):
                yield ev
        else:
            async for ev in execute_parallel_level(
                active_nodes, node_map, edges, upstream_map, downstream_map,
                implicit_context, accumulated_outputs, error_nodes, failed_nodes, skipped_nodes,
                accumulated_metadata=accumulated_metadata,
            ):
                yield ev

    if save_callback:
        try:
            updated_nodes = _merge_outputs(nodes, accumulated_outputs, failed_nodes, error_nodes)
            await save_callback(workflow_id, updated_nodes)
        except Exception as e:
            logger.error("Auto-save failed for workflow %s: %s", workflow_id, e)
            yield sse_event("save_error", {"workflow_id": workflow_id, "error": str(e)})

    yield sse_event("workflow_done", {
        "workflow_id": workflow_id,
        "status": "error" if error_nodes else "completed",
        **({"error": f"{len(error_nodes)} 个节点执行失败"} if error_nodes else {}),
    })
