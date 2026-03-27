"""Workflow execution engine — enhanced orchestration.

This is the replacement for services/workflow_engine.py.
It handles: topology sort → node dispatch → SSE streaming.
All node-specific logic lives in the nodes/ package.

Key features:
1. Uses NODE_REGISTRY for dynamic dispatch (no hardcoded if/else)
2. Only passes direct upstream outputs (not all accumulated)
3. Calls node.post_process() for output validation
4. Conditional branching via logic_switch nodes
5. Per-node timeout control
6. Parallel execution for independent nodes at the same topological level

7. Edge-level wait time (waitSeconds) before executing downstream nodes
8. Loop group containers that iterate their child subgraph N times
"""

import asyncio
import copy
import json
import logging
from collections import defaultdict, deque
from typing import AsyncIterator, Awaitable, Callable

from app.engine.context import build_upstream_map, build_downstream_map, get_all_downstream
from app.engine.events import sse_event
from app.nodes import NODE_REGISTRY
from app.nodes._base import BaseNode, NodeInput
from app.services.ai_router import call_llm, AIRouterError
from app.services.usage_ledger import bind_usage_call

logger = logging.getLogger(__name__)

# Default per-node timeout in seconds
DEFAULT_NODE_TIMEOUT = 120
# Maximum allowed wait between nodes (safety cap)
MAX_WAIT_SECONDS = 300


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


# ── Topological sort (level-aware) ───────────────────────────────────────────

def topological_sort_levels(
    nodes: list[dict], edges: list[dict]
) -> list[list[str]]:
    """Return node IDs grouped by topological levels (Kahn's algorithm).

    Each inner list contains node IDs that can be executed in parallel.
    Nodes with parentId (loop group children) are excluded.
    Returns list of levels from top to bottom.

    Raises ValueError if a cycle is detected.
    """
    # Exclude child nodes that belong to a loop_group container
    top_nodes = [
        n for n in nodes
        if not n.get("parentId")
    ]
    child_ids = {n["id"] for n in nodes if n.get("parentId")}

    in_degree: dict[str, int] = {n["id"]: 0 for n in top_nodes}
    adjacency: dict[str, list[str]] = defaultdict(list)

    for edge in edges:
        src, tgt = edge["source"], edge["target"]
        if src in child_ids or tgt in child_ids:
            continue
        adjacency[src].append(tgt)
        in_degree[tgt] = in_degree.get(tgt, 0) + 1

    queue: deque[str] = deque(nid for nid, deg in in_degree.items() if deg == 0)
    levels: list[list[str]] = []
    processed = 0

    while queue:
        level = list(queue)
        levels.append(level)
        queue.clear()
        for nid in level:
            processed += 1
            for neighbor in adjacency[nid]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

    if processed != len(top_nodes):
        raise ValueError("Workflow contains a cycle — cannot execute")

    return levels


def topological_sort(nodes: list[dict], edges: list[dict]) -> list[str]:
    """Flatten level-based sort into a single list (backward compatible)."""
    levels = topological_sort_levels(nodes, edges)
    return [nid for level in levels for nid in level]


# ── Wait time helper ─────────────────────────────────────────────────────────

def _get_max_wait_seconds(node_id: str, edges: list[dict]) -> float:
    """Get the max waitSeconds from all incoming edges of a node."""
    max_wait = 0.0
    for edge in edges:
        if edge["target"] == node_id:
            wait = edge.get("data", {}).get("waitSeconds", 0)
            if isinstance(wait, (int, float)) and wait > 0:
                max_wait = max(max_wait, float(wait))
    return min(max_wait, MAX_WAIT_SECONDS)


# ── Loop group execution ─────────────────────────────────────────────────────

async def _execute_loop_group(
    group_node: dict,
    all_nodes: list[dict],
    all_edges: list[dict],
    implicit_context: dict | None,
    accumulated_outputs: dict[str, str],
) -> AsyncIterator[str]:
    """Execute a loop_group container: iterate its child subgraph N times."""
    group_id = group_node["id"]
    group_data = group_node.get("data", {})
    max_iterations = min(int(group_data.get("maxIterations", 3)), 100)
    interval_seconds = min(float(group_data.get("intervalSeconds", 0)), MAX_WAIT_SECONDS)

    # Collect child nodes + internal edges
    child_nodes = [n for n in all_nodes if n.get("parentId") == group_id]
    child_ids = {n["id"] for n in child_nodes}
    child_edges = [
        e for e in all_edges
        if e["source"] in child_ids and e["target"] in child_ids
    ]

    if not child_nodes:
        yield sse_event("node_done", {"node_id": group_id, "full_output": "[循环块无子节点]"})
        return

    iteration_results: list[dict[str, str]] = []

    for iteration in range(1, max_iterations + 1):
        yield sse_event("loop_iteration", {
            "group_id": group_id,
            "iteration": iteration,
            "total": max_iterations,
        })

        # Build sub-topology
        try:
            sub_levels = topological_sort_levels(child_nodes, child_edges)
        except ValueError:
            yield sse_event("node_status", {
                "node_id": group_id, "status": "error",
                "error": "循环块内部存在环",
            })
            return

        # For iteration > 1, inject previous iteration outputs
        iter_outputs = dict(accumulated_outputs)
        if iteration_results:
            iter_outputs.update(iteration_results[-1])

        sub_outputs: dict[str, str] = {}
        sub_failed: set[str] = set()
        upstream_map = build_upstream_map(child_edges)

        for level in sub_levels:
            tasks = []
            for nid in level:
                if nid in sub_failed:
                    continue
                node_cfg = next((n for n in child_nodes if n["id"] == nid), None)
                if not node_cfg:
                    continue

                direct_ups = upstream_map.get(nid, [])
                ups = {
                    uid: sub_outputs.get(uid, iter_outputs.get(uid, ""))
                    for uid in direct_ups
                }

                tasks.append(asyncio.create_task(
                    _execute_single_node_with_timeout(
                        nid, node_cfg, ups, implicit_context,
                    )
                ))

            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for res in results:
                    if isinstance(res, Exception):
                        continue
                    nid, output, error = res
                    if error:
                        sub_failed.add(nid)
                    elif output is not None:
                        sub_outputs[nid] = output

        iteration_results.append(sub_outputs)

        # Wait between iterations
        if interval_seconds > 0 and iteration < max_iterations:
            await asyncio.sleep(interval_seconds)

    # Aggregate: last iteration outputs become the group's output
    final_output = json.dumps(iteration_results, ensure_ascii=False, indent=2)
    accumulated_outputs[group_id] = final_output


# ── Branch filtering for logic_switch ────────────────────────────────────────

def get_branch_filtered_downstream(
    switch_node_id: str,
    chosen_branch: str,
    edges: list[dict],
    downstream_map: dict[str, set[str]],
) -> set[str]:
    """Return node IDs that should be SKIPPED because they're on non-chosen branches.

    For a logic_switch node, edges going to downstream nodes may have
    `data.branch` labels. Only the edges matching `chosen_branch` (or
    edges with no branch label) are considered active. All nodes on
    inactive branches are collected as skipped.
    """
    active_targets: set[str] = set()
    inactive_targets: set[str] = set()

    for edge in edges:
        if edge["source"] != switch_node_id:
            continue

        target = edge["target"]
        edge_branch = edge.get("data", {}).get("branch", "")

        if not edge_branch:
            # Unlabeled edges always active (default path)
            active_targets.add(target)
        elif edge_branch.lower() == chosen_branch.lower():
            active_targets.add(target)
        else:
            inactive_targets.add(target)

    # Collect ALL transitive descendants of inactive targets
    skip_nodes: set[str] = set()
    for inactive in inactive_targets:
        if inactive not in active_targets:  # Not also reachable via active path
            skip_nodes.add(inactive)
            skip_nodes.update(get_all_downstream(inactive, downstream_map))

    # Remove any nodes that are also reachable via active edges
    for active in active_targets:
        skip_nodes.discard(active)
        for downstream in get_all_downstream(active, downstream_map):
            skip_nodes.discard(downstream)

    return skip_nodes


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


def _build_input_snapshot(node_input: NodeInput) -> str:
    """Safely serialize the combined node input into a JSON string."""
    snapshot = {
        "user_content": node_input.user_content,
        "upstream_outputs": node_input.upstream_outputs,
        "node_config": node_input.node_config,
    }
    return json.dumps(snapshot, ensure_ascii=False)


# ── Single node execution ────────────────────────────────────────────────────

async def _execute_single_node(
    node_id: str,
    node_config: dict,
    upstream_outputs: dict[str, str],
    implicit_context: dict | None,
) -> tuple[str, str | None, str | None]:
    """Execute a single node and return (node_id, output, error).

    Returns:
        (node_id, full_output, None) on success
        (node_id, None, error_message) on failure
    """
    node_type_str = node_config.get("type", "chat_response")
    node_data = node_config.get("data", {})

    NodeClass = NODE_REGISTRY.get(node_type_str)
    if not NodeClass:
        NodeClass = NODE_REGISTRY.get("chat_response")
        if not NodeClass:
            return (node_id, None, f"Unknown node type: {node_type_str}")

    node_instance = NodeClass()

    node_input = NodeInput(
        user_content=node_data.get("user_content") or node_data.get("label", ""),
        upstream_outputs=upstream_outputs,
        implicit_context=implicit_context,
        node_config=node_data.get("config"),
    )

    full_output = ""
    try:
        with bind_usage_call(node_id=node_id, node_type=node_type_str):
            async for token in node_instance.execute(node_input, call_llm):
                full_output += token

        result = await node_instance.post_process(full_output)
        return (node_id, result.content, None)

    except Exception as e:
        logger.error("Node %s execution failed: %s", node_id, e)
        return (node_id, None, str(e))


async def _execute_single_node_with_timeout(
    node_id: str,
    node_config: dict,
    upstream_outputs: dict[str, str],
    implicit_context: dict | None,
    timeout_seconds: int = DEFAULT_NODE_TIMEOUT,
) -> tuple[str, str | None, str | None]:
    """Wrapper that applies per-node timeout.

    If the node exceeds timeout_seconds, it returns an error
    WITHOUT affecting other parallel tasks.
    """
    try:
        return await asyncio.wait_for(
            _execute_single_node(
                node_id=node_id,
                node_config=node_config,
                upstream_outputs=upstream_outputs,
                implicit_context=implicit_context,
            ),
            timeout=timeout_seconds,
        )
    except asyncio.TimeoutError:
        logger.error("Node %s timed out after %ds", node_id, timeout_seconds)
        return (node_id, None, f"节点执行超时（{timeout_seconds}秒）")


# ── Main execution engine ────────────────────────────────────────────────────

async def execute_workflow(
    workflow_id: str,
    nodes: list[dict],
    edges: list[dict],
    implicit_context: dict | None = None,
    save_callback: Callable[[str, list[dict]], Awaitable[None]] | None = None,
) -> AsyncIterator[str]:
    """Execute a workflow and yield SSE event strings.

    Enhanced features:
    - Parallel execution: independent nodes at the same level run concurrently
    - Conditional branching: logic_switch nodes control which branch executes
    - Per-node timeout: nodes that exceed timeout are treated as failed
    """
    if not nodes:
        yield sse_event("workflow_done", {"workflow_id": workflow_id, "status": "completed"})
        return

    # 1. Topological sort (level-aware for parallel execution)
    try:
        levels = topological_sort_levels(nodes, edges)
    except ValueError as e:
        yield sse_event("workflow_done", {"workflow_id": workflow_id, "status": "error", "error": str(e)})
        return

    # 2. Build maps
    node_map = {n["id"]: n for n in nodes}
    upstream_map = build_upstream_map(edges)
    downstream_map = build_downstream_map(edges)
    failed_nodes: set[str] = set()
    skipped_nodes: set[str] = set()  # Nodes skipped due to branch filtering
    accumulated_outputs: dict[str, str] = {}

    # 3. Execute level by level
    for level in levels:
        for nid in level:
            if nid in skipped_nodes:
                yield sse_event("node_status", {"node_id": nid, "status": "skipped"})
            elif nid in failed_nodes:
                yield sse_event("node_status", {"node_id": nid, "status": "pending"})

        # Filter out failed/skipped nodes in this level
        active_nodes = [
            nid for nid in level
            if nid not in failed_nodes and nid not in skipped_nodes
        ]

        if not active_nodes:
            continue

        if len(active_nodes) == 1:
            # ── Single node: stream tokens directly ──────────────────────
            node_id = active_nodes[0]
            node_cfg = node_map.get(node_id)
            if not node_cfg:
                continue

            node_type_str = node_cfg.get("type", "chat_response")
            node_data = node_cfg.get("data", {})

            # Handle loop_group container
            if node_type_str == "loop_group":
                yield sse_event("node_status", {"node_id": node_id, "status": "running"})
                async for event in _execute_loop_group(
                    node_cfg, nodes, edges, implicit_context, accumulated_outputs,
                ):
                    yield event
                yield sse_event("node_done", {
                    "node_id": node_id,
                    "full_output": accumulated_outputs.get(node_id, ""),
                })
                yield sse_event("node_status", {"node_id": node_id, "status": "done"})
                continue

            # Edge wait time
            wait_secs = _get_max_wait_seconds(node_id, edges)
            if wait_secs > 0:
                yield sse_event("node_status", {"node_id": node_id, "status": "waiting"})
                await asyncio.sleep(wait_secs)

            yield sse_event("node_status", {"node_id": node_id, "status": "running"})

            NodeClass = NODE_REGISTRY.get(node_type_str)
            if not NodeClass:
                NodeClass = NODE_REGISTRY.get("chat_response")
                if not NodeClass:
                    yield sse_event("node_status", {
                        "node_id": node_id, "status": "error",
                        "error": f"Unknown node type: {node_type_str}"
                    })
                    failed_nodes.update(get_all_downstream(node_id, downstream_map))
                    continue

            node_instance = NodeClass()

            direct_upstream_ids = upstream_map.get(node_id, [])
            upstream_outputs = {
                uid: accumulated_outputs[uid]
                for uid in direct_upstream_ids
                if uid in accumulated_outputs
            }

            node_input = NodeInput(
                user_content=node_data.get("user_content") or node_data.get("label", ""),
                upstream_outputs=upstream_outputs,
                implicit_context=implicit_context,
                node_config=node_data.get("config"),
            )

            # Emit input snapshot
            try:
                snapshot_json = _build_input_snapshot(node_input)
                yield sse_event("node_input", {"node_id": node_id, "input_snapshot": snapshot_json})
            except Exception as e:
                logger.warning("Failed to serialize input snapshot for node %s: %s", node_id, e)

            full_output = ""
            try:
                with bind_usage_call(node_id=node_id, node_type=node_type_str):
                    async for token in node_instance.execute(node_input, call_llm):
                        full_output += token
                        yield sse_event("node_token", {"node_id": node_id, "token": token})

                result = await node_instance.post_process(full_output)
                accumulated_outputs[node_id] = result.content

                yield sse_event("node_done", {"node_id": node_id, "full_output": result.content})
                yield sse_event("node_status", {"node_id": node_id, "status": "done"})

                # Handle logic_switch branching
                if node_type_str == "logic_switch" and result.metadata.get("branch"):
                    chosen_branch = result.metadata["branch"]
                    branch_skips = get_branch_filtered_downstream(
                        node_id, chosen_branch, edges, downstream_map
                    )
                    skipped_nodes.update(branch_skips)
                    logger.info(
                        "logic_switch %s chose branch '%s', skipping %d nodes",
                        node_id, chosen_branch, len(branch_skips),
                    )

            except (AIRouterError, Exception) as e:
                logger.error("Node %s execution failed: %s", node_id, e)
                yield sse_event("node_status", {"node_id": node_id, "status": "error", "error": str(e)})
                failed_nodes.update(get_all_downstream(node_id, downstream_map))

        else:
            # ── Multiple nodes: parallel execution ───────────────────────
            # Emit running status for all
            for nid in active_nodes:
                yield sse_event("node_status", {"node_id": nid, "status": "running"})

            # Build tasks
            tasks: list[asyncio.Task] = []
            for nid in active_nodes:
                node_cfg = node_map.get(nid)
                if not node_cfg:
                    continue

                direct_upstream_ids = upstream_map.get(nid, [])
                upstream_outputs = {
                    uid: accumulated_outputs[uid]
                    for uid in direct_upstream_ids
                    if uid in accumulated_outputs
                }

                # Construct node input for the snapshot
                node_data = node_cfg.get("data", {})
                node_input = NodeInput(
                    user_content=node_data.get("user_content") or node_data.get("label", ""),
                    upstream_outputs=upstream_outputs,
                    implicit_context=implicit_context,
                    node_config=node_data.get("config"),
                )
                try:
                    snapshot_json = _build_input_snapshot(node_input)
                    yield sse_event("node_input", {"node_id": nid, "input_snapshot": snapshot_json})
                except Exception as e:
                    logger.warning("Failed to serialize input snapshot for node %s: %s", nid, e)

                task = asyncio.create_task(
                    _execute_single_node_with_timeout(
                        node_id=nid,
                        node_config=node_cfg,
                        upstream_outputs=upstream_outputs,
                        implicit_context=implicit_context,
                        timeout_seconds=DEFAULT_NODE_TIMEOUT,
                    )
                )
                tasks.append(task)

            # Wait for all — each task manages its own timeout internally,
            # so no outer wait_for needed. A slow node won't kill fast ones.
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results
            for res in results:
                if isinstance(res, Exception):
                    # Task raised an exception
                    logger.error("Parallel task exception: %s", res)
                    continue

                nid, output, error = res
                if error:
                    yield sse_event("node_status", {"node_id": nid, "status": "error", "error": error})
                    failed_nodes.update(get_all_downstream(nid, downstream_map))
                else:
                    accumulated_outputs[nid] = output
                    # For parallel nodes, emit the full output at once
                    yield sse_event("node_done", {"node_id": nid, "full_output": output})
                    yield sse_event("node_status", {"node_id": nid, "status": "done"})

                    # Handle logic_switch in parallel (edge case)
                    node_cfg = node_map.get(nid, {})
                    if node_cfg.get("type") == "logic_switch":
                        try:
                            parsed = json.loads(output)
                            if isinstance(parsed, dict) and "branch" in parsed:
                                branch_skips = get_branch_filtered_downstream(
                                    nid, parsed["branch"], edges, downstream_map
                                )
                                skipped_nodes.update(branch_skips)
                        except (json.JSONDecodeError, TypeError):
                            pass

    # 4. Save results
    if save_callback:
        try:
            updated_nodes = _merge_outputs(nodes, accumulated_outputs, failed_nodes)
            await save_callback(workflow_id, updated_nodes)
        except Exception as e:
            logger.error("Auto-save failed for workflow %s: %s", workflow_id, e)
            yield sse_event("save_error", {"workflow_id": workflow_id, "error": str(e)})

    yield sse_event("workflow_done", {"workflow_id": workflow_id, "status": "completed"})
