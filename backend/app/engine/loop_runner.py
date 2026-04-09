"""Loop group container execution — iterates a child subgraph N times."""

import asyncio
import json
from collections import defaultdict, deque
from collections.abc import AsyncIterator

from app.engine.context import build_downstream_map, build_upstream_map, get_all_downstream
from app.engine.events import sse_event
from app.engine.node_runner import (
    DEFAULT_NODE_STARTUP_TIMEOUT,
    DEFAULT_NODE_TIMEOUT,
    NodeExecutionResult,
    build_parallel_group_id,
    stream_single_node_events,
)
from app.engine.topology import MAX_WAIT_SECONDS, get_branch_filtered_downstream, get_max_wait_seconds
from app.services.quota_service import TIER_LOOP_ITERATION_LIMITS

_ABSOLUTE_MAX_ITERATIONS = 9_999_999  # Safety ceiling for ultra tier


def _topological_sort_child_levels(nodes: list[dict], edges: list[dict]) -> list[list[str]]:
    """Topologically sort loop child nodes without excluding parentId nodes."""
    in_degree: dict[str, int] = {node["id"]: 0 for node in nodes}
    adjacency: dict[str, list[str]] = defaultdict(list)

    for edge in edges:
        src, tgt = edge["source"], edge["target"]
        adjacency[src].append(tgt)
        in_degree[tgt] = in_degree.get(tgt, 0) + 1

    queue: deque[str] = deque(nid for nid, degree in in_degree.items() if degree == 0)
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

    if processed != len(nodes):
        raise ValueError("Loop group contains a cycle")

    return levels


async def execute_loop_group(
    group_node: dict,
    all_nodes: list[dict],
    all_edges: list[dict],
    implicit_context: dict | None,
    accumulated_outputs: dict[str, str],
    error_nodes: set[str] | None = None,
    failed_nodes: set[str] | None = None,
) -> AsyncIterator[str]:
    """Execute a loop_group container: iterate its child subgraph N times."""
    group_id = group_id = group_node["id"]
    group_data = group_node.get("data", {})

    # Tier-based iteration limit
    user_tier = (implicit_context or {}).get("user_tier", "free")
    tier_max = TIER_LOOP_ITERATION_LIMITS.get(user_tier, TIER_LOOP_ITERATION_LIMITS["free"])
    max_iterations = min(int(group_data.get("maxIterations", 3)), tier_max)
    # Ensure it never exceeds an absolute safety ceiling
    max_iterations = min(max_iterations, _ABSOLUTE_MAX_ITERATIONS)

    interval_seconds = min(float(group_data.get("intervalSeconds", 0)), MAX_WAIT_SECONDS)

    child_nodes = [n for n in all_nodes if n.get("parentId") == group_id]
    child_ids = {n["id"] for n in child_nodes}
    child_edges = [
        e for e in all_edges
        if e["source"] in child_ids and e["target"] in child_ids
    ]

    if not child_nodes:
        accumulated_outputs[group_id] = "[循环块无子节点]"
        yield sse_event("node_progress", {
            "node_id": group_id,
            "message": "循环块内没有可执行子节点",
            "phase": "empty",
        }, {"loop_group_id": group_id})
        return

    try:
        sub_levels = _topological_sort_child_levels(child_nodes, child_edges)
    except ValueError:
        if error_nodes is not None:
            error_nodes.add(group_id)
        yield sse_event("node_status", {
            "node_id": group_id,
            "status": "error",
            "error": "循环块内部存在环",
        }, {"loop_group_id": group_id})
        return

    child_node_map = {node["id"]: node for node in child_nodes}
    upstream_map = build_upstream_map(child_edges)
    downstream_map = build_downstream_map(child_edges)
    all_downstream_map = build_downstream_map(all_edges)
    iteration_results: list[dict[str, str]] = []
    loop_had_error = False

    async def _run_child_node(
        nid: str,
        sub_outputs: dict[str, str],
        iter_outputs: dict[str, str],
        iteration: int,
        *,
        parallel_group_id: str | None = None,
    ) -> tuple[NodeExecutionResult, list[str]]:
        node_cfg = child_node_map[nid]
        meta = {
            "loop_group_id": group_id,
            "iteration": iteration,
            "parallel_group_id": parallel_group_id,
        }
        result = NodeExecutionResult(node_id=nid)
        events: list[str] = []
        direct_ups = upstream_map.get(nid, [])
        upstream_outputs = {
            uid: sub_outputs.get(uid, iter_outputs.get(uid, ""))
            for uid in direct_ups
        }
        wait_secs = get_max_wait_seconds(nid, child_edges)
        if wait_secs > 0:
            events.append(sse_event("node_status", {"node_id": nid, "status": "waiting"}, meta))
            events.append(sse_event("node_progress", {
                "node_id": nid,
                "message": f"等待 {wait_secs:g} 秒后开始执行",
                "phase": "waiting",
            }, meta))
            await asyncio.sleep(wait_secs)

        async for event in stream_single_node_events(
            node_id=nid,
            node_config=node_cfg,
            upstream_outputs=upstream_outputs,
            implicit_context=implicit_context,
            result=result,
            event_meta=meta,
            timeout_seconds=DEFAULT_NODE_TIMEOUT,
            startup_timeout_seconds=DEFAULT_NODE_STARTUP_TIMEOUT,
        ):
            events.append(event)

        return result, events

    for iteration in range(1, max_iterations + 1):
        yield sse_event("loop_iteration", {
            "group_id": group_id,
            "iteration": iteration,
            "total": max_iterations,
        }, {"loop_group_id": group_id, "iteration": iteration})
        yield sse_event("node_progress", {
            "node_id": group_id,
            "message": f"正在执行第 {iteration}/{max_iterations} 轮循环",
            "phase": "prepare",
        }, {"loop_group_id": group_id, "iteration": iteration})

        iter_outputs = dict(accumulated_outputs)
        if iteration_results:
            iter_outputs.update(iteration_results[-1])

        sub_outputs: dict[str, str] = {}
        sub_failed: set[str] = set()
        sub_skipped: set[str] = set()

        for level in sub_levels:
            for nid in level:
                if nid in sub_skipped:
                    yield sse_event("node_status", {"node_id": nid, "status": "skipped"}, {
                        "loop_group_id": group_id,
                        "iteration": iteration,
                    })
                elif nid in sub_failed:
                    yield sse_event("node_status", {
                        "node_id": nid,
                        "status": "skipped",
                        "error": "上游节点执行失败，已跳过",
                    }, {
                        "loop_group_id": group_id,
                        "iteration": iteration,
                    })

            active_nodes = [
                nid for nid in level
                if nid not in sub_failed and nid not in sub_skipped
            ]
            if not active_nodes:
                continue

            if len(active_nodes) == 1:
                result, events = await _run_child_node(
                    active_nodes[0],
                    sub_outputs,
                    iter_outputs,
                    iteration,
                )
                for event in events:
                    yield event
                if result.error:
                    loop_had_error = True
                    sub_failed.update(get_all_downstream(result.node_id, downstream_map))
                elif result.output is not None:
                    sub_outputs[result.node_id] = result.output
                    if child_node_map[result.node_id].get("type") == "logic_switch" and result.metadata.get("branch"):
                        sub_skipped.update(
                            get_branch_filtered_downstream(
                                result.node_id,
                                str(result.metadata["branch"]),
                                child_edges,
                                downstream_map,
                            )
                        )
            else:
                parallel_group_id = build_parallel_group_id(active_nodes)
                queue: asyncio.Queue[str | None] = asyncio.Queue()

                async def _pump_parallel_node(nid: str) -> NodeExecutionResult:
                    result, events = await _run_child_node(
                        nid,
                        sub_outputs,
                        iter_outputs,
                        iteration,
                        parallel_group_id=parallel_group_id,
                    )
                    try:
                        for event in events:
                            await queue.put(event)
                    finally:
                        await queue.put(None)
                    return result

                tasks = [asyncio.create_task(_pump_parallel_node(nid)) for nid in active_nodes]
                completed_tasks = 0
                while completed_tasks < len(tasks):
                    item = await queue.get()
                    if item is None:
                        completed_tasks += 1
                        continue
                    yield item

                results = await asyncio.gather(*tasks)
                for result in results:
                    if result.error:
                        loop_had_error = True
                        sub_failed.update(get_all_downstream(result.node_id, downstream_map))
                    elif result.output is not None:
                        sub_outputs[result.node_id] = result.output
                        if child_node_map[result.node_id].get("type") == "logic_switch" and result.metadata.get("branch"):
                            sub_skipped.update(
                                get_branch_filtered_downstream(
                                    result.node_id,
                                    str(result.metadata["branch"]),
                                    child_edges,
                                    downstream_map,
                                )
                            )

        iteration_results.append(sub_outputs)

        if interval_seconds > 0 and iteration < max_iterations:
            yield sse_event("node_progress", {
                "node_id": group_id,
                "message": f"第 {iteration} 轮完成，等待 {interval_seconds:g} 秒进入下一轮",
                "phase": "cooldown",
            }, {"loop_group_id": group_id, "iteration": iteration})
            await asyncio.sleep(interval_seconds)

    final_output = json.dumps(iteration_results, ensure_ascii=False, indent=2)
    accumulated_outputs[group_id] = final_output
    if loop_had_error:
        if error_nodes is not None:
            error_nodes.add(group_id)
        if failed_nodes is not None:
            failed_nodes.update(get_all_downstream(group_id, all_downstream_map))
        yield sse_event("node_status", {
            "node_id": group_id,
            "status": "error",
            "error": "循环块内存在执行失败的子节点",
        }, {"loop_group_id": group_id, "iteration": max_iterations})
        return

    yield sse_event("node_progress", {
        "node_id": group_id,
        "message": "正在汇总循环结果",
        "phase": "finalize",
    }, {"loop_group_id": group_id, "iteration": max_iterations})
