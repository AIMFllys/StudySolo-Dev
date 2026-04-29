"""Level execution helpers — single-node streaming and parallel dispatch."""

import asyncio
import logging
from collections.abc import AsyncIterator

from app.engine.context import get_all_downstream
from app.engine.events import sse_event
from app.engine.loop_runner import execute_loop_group
from app.nodes import NODE_REGISTRY  # noqa: F401 — re-exported for test monkeypatching
from app.engine.node_runner import (
    DEFAULT_NODE_STARTUP_TIMEOUT,
    DEFAULT_NODE_TIMEOUT,
    NodeExecutionResult,
    build_parallel_group_id,
    stream_single_node_events,
)
from app.engine.topology import get_branch_filtered_downstream, get_max_wait_seconds

logger = logging.getLogger(__name__)


def _finalize_node_result(
    node_id: str,
    node_cfg: dict,
    result: NodeExecutionResult,
    *,
    edges: list[dict],
    downstream_map: dict[str, set[str]],
    accumulated_outputs: dict[str, str],
    error_nodes: set[str],
    failed_nodes: set[str],
    skipped_nodes: set[str],
    accumulated_metadata: dict[str, dict] | None = None,
) -> None:
    if result.error:
        error_nodes.add(node_id)
        failed_nodes.update(get_all_downstream(node_id, downstream_map))
        return

    output = result.output or ""
    accumulated_outputs[node_id] = output
    if accumulated_metadata is not None and result.metadata:
        accumulated_metadata[node_id] = dict(result.metadata)
    if node_cfg.get("type") == "logic_switch" and result.metadata.get("branch"):
        chosen_branch = str(result.metadata["branch"])
        skipped_nodes.update(get_branch_filtered_downstream(node_id, chosen_branch, edges, downstream_map))
        logger.info("logic_switch %s chose branch '%s', skipping %d nodes", node_id, chosen_branch, len(skipped_nodes))


async def execute_single_level_node(
    node_id: str,
    node_map: dict[str, dict],
    all_nodes: list[dict],
    edges: list[dict],
    upstream_map: dict,
    downstream_map: dict,
    implicit_context: dict | None,
    accumulated_outputs: dict[str, str],
    error_nodes: set[str],
    failed_nodes: set[str],
    skipped_nodes: set[str],
    accumulated_metadata: dict[str, dict] | None = None,
) -> AsyncIterator[str]:
    """Execute a single node at a topological level with full SSE streaming."""
    node_cfg = node_map.get(node_id)
    if not node_cfg:
        return

    upstream_ids = upstream_map.get(node_id, [])
    upstream_outputs = {
        uid: accumulated_outputs[uid]
        for uid in upstream_ids
        if uid in accumulated_outputs
    }
    upstream_metadata: dict[str, dict] = {}
    if accumulated_metadata:
        upstream_metadata = {
            uid: accumulated_metadata[uid]
            for uid in upstream_ids
            if uid in accumulated_metadata
        }

    if node_cfg.get("type") == "loop_group":
        wait_secs = get_max_wait_seconds(node_id, edges)
        if wait_secs > 0:
            yield sse_event("node_status", {"node_id": node_id, "status": "waiting"})
            yield sse_event("node_progress", {
                "node_id": node_id,
                "message": f"等待 {wait_secs:g} 秒后开始执行",
                "phase": "waiting",
            })
            await asyncio.sleep(wait_secs)

        yield sse_event("node_status", {"node_id": node_id, "status": "running"})
        yield sse_event("node_progress", {
            "node_id": node_id,
            "message": "正在准备循环执行",
            "phase": "prepare",
        })
        async for event in execute_loop_group(
            node_cfg,
            all_nodes,
            edges,
            implicit_context,
            accumulated_outputs,
            error_nodes=error_nodes,
            failed_nodes=failed_nodes,
        ):
            yield event

        if node_id in error_nodes:
            return

        output = accumulated_outputs.get(node_id, "")
        yield sse_event("node_done", {"node_id": node_id, "full_output": output})
        yield sse_event("node_status", {"node_id": node_id, "status": "done"})
        return

    result = NodeExecutionResult(node_id=node_id)
    wait_secs = get_max_wait_seconds(node_id, edges)
    if wait_secs > 0:
        yield sse_event("node_status", {"node_id": node_id, "status": "waiting"})
        yield sse_event("node_progress", {
            "node_id": node_id,
            "message": f"等待 {wait_secs:g} 秒后开始执行",
            "phase": "waiting",
        })
        await asyncio.sleep(wait_secs)

    async for event in stream_single_node_events(
        node_id=node_id,
        node_config=node_cfg,
        upstream_outputs=upstream_outputs,
        implicit_context=implicit_context,
        result=result,
        timeout_seconds=DEFAULT_NODE_TIMEOUT,
        startup_timeout_seconds=DEFAULT_NODE_STARTUP_TIMEOUT,
        upstream_metadata=upstream_metadata,
    ):
        yield event

    _finalize_node_result(
        node_id=node_id,
        node_cfg=node_cfg,
        result=result,
        edges=edges,
        downstream_map=downstream_map,
        accumulated_outputs=accumulated_outputs,
        error_nodes=error_nodes,
        failed_nodes=failed_nodes,
        skipped_nodes=skipped_nodes,
        accumulated_metadata=accumulated_metadata,
    )


async def execute_parallel_level(
    active_nodes: list[str],
    node_map: dict[str, dict],
    edges: list[dict],
    upstream_map: dict,
    downstream_map: dict,
    implicit_context: dict | None,
    accumulated_outputs: dict[str, str],
    error_nodes: set[str],
    failed_nodes: set[str],
    skipped_nodes: set[str],
    accumulated_metadata: dict[str, dict] | None = None,
) -> AsyncIterator[str]:
    """Execute multiple independent nodes in parallel and stream events as they arrive."""
    parallel_group_id = build_parallel_group_id(active_nodes)
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def _run_parallel_node(nid: str) -> NodeExecutionResult:
        node_cfg = node_map.get(nid)
        result = NodeExecutionResult(node_id=nid)
        if not node_cfg:
            result.error = f"Node config missing: {nid}"
            return result

        upstream_ids = upstream_map.get(nid, [])
        upstream_outputs = {
            uid: accumulated_outputs[uid]
            for uid in upstream_ids
            if uid in accumulated_outputs
        }
        upstream_metadata: dict[str, dict] = {}
        if accumulated_metadata:
            upstream_metadata = {
                uid: accumulated_metadata[uid]
                for uid in upstream_ids
                if uid in accumulated_metadata
            }
        event_meta = {"parallel_group_id": parallel_group_id}
        wait_secs = get_max_wait_seconds(nid, edges)

        try:
            if wait_secs > 0:
                await queue.put(sse_event("node_status", {"node_id": nid, "status": "waiting"}, event_meta))
                await queue.put(sse_event("node_progress", {
                    "node_id": nid,
                    "message": f"等待 {wait_secs:g} 秒后开始执行",
                    "phase": "waiting",
                }, event_meta))
                await asyncio.sleep(wait_secs)

            async for event in stream_single_node_events(
                node_id=nid,
                node_config=node_cfg,
                upstream_outputs=upstream_outputs,
                implicit_context=implicit_context,
                result=result,
                event_meta=event_meta,
                timeout_seconds=DEFAULT_NODE_TIMEOUT,
                startup_timeout_seconds=DEFAULT_NODE_STARTUP_TIMEOUT,
                upstream_metadata=upstream_metadata,
            ):
                await queue.put(event)
        except Exception as exc:
            logger.error("Parallel node %s failed unexpectedly: %s", nid, exc)
            result.error = str(exc)
            await queue.put(sse_event("node_status", {
                "node_id": nid,
                "status": "error",
                "error": result.error,
            }, event_meta))
        finally:
            await queue.put(None)

        return result

    tasks = [
        asyncio.create_task(_run_parallel_node(nid))
        for nid in active_nodes
    ]

    completed_tasks = 0
    while completed_tasks < len(tasks):
        item = await queue.get()
        if item is None:
            completed_tasks += 1
            continue
        yield item

    results = await asyncio.gather(*tasks)
    for result in results:
        node_cfg = node_map.get(result.node_id, {})
        _finalize_node_result(
            node_id=result.node_id,
            node_cfg=node_cfg,
            result=result,
            edges=edges,
            downstream_map=downstream_map,
            accumulated_outputs=accumulated_outputs,
            error_nodes=error_nodes,
            failed_nodes=failed_nodes,
            skipped_nodes=skipped_nodes,
            accumulated_metadata=accumulated_metadata,
        )
