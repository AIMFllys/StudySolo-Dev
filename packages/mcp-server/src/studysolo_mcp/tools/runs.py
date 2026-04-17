"""Workflow run tools: start / progress / events / wait."""

from __future__ import annotations

import asyncio
import time
from typing import Any

from mcp.types import Tool

from studysolo_mcp.client import ApiClient, ApiError


TOOLS: list[Tool] = [
    Tool(
        name="start_workflow_run",
        description=(
            "异步启动一个工作流 run，立即返回 run_id（202 Accepted）。"
            "执行过程在后端后台进行，用 get_run_progress / get_run_events 观察进度。"
            "若需要「一路等到完成」，优先使用 run_workflow_and_wait。"
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "workflow_id": {
                    "type": "string",
                    "description": "工作流 ID（完整 UUID）。",
                }
            },
            "required": ["workflow_id"],
            "additionalProperties": False,
        },
    ),
    Tool(
        name="get_run_progress",
        description=(
            "获取某个 run 的聚合进度：phase、current_node_id/label、已完成节点数、总节点数、"
            "百分比、耗时。适合低频轮询。"
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "run_id": {"type": "string", "description": "运行 ID。"}
            },
            "required": ["run_id"],
            "additionalProperties": False,
        },
    ),
    Tool(
        name="get_run_events",
        description=(
            "获取 run 的节点级事件增量（关键帧，不含 token 流）。"
            "客户端应持续传递上一次返回的 next_seq 作为 after_seq，直到 is_terminal 为 true。"
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "run_id": {"type": "string"},
                "after_seq": {
                    "type": "integer",
                    "minimum": 0,
                    "default": 0,
                    "description": "只返回 seq 严格大于该值的事件。",
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 1000,
                    "default": 200,
                },
            },
            "required": ["run_id"],
            "additionalProperties": False,
        },
    ),
    Tool(
        name="run_workflow_and_wait",
        description=(
            "一站式执行：启动工作流并等待到终态，返回完整事件列表 + 最终 workflow_done 载荷。"
            "mode=stream 则按 0.5s 步长增量拉取事件（仍是小步轮询，stdio 下没有真正 SSE）；"
            "mode=poll 则按 poll_interval_s 拉取聚合进度直到完成。"
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "workflow_id": {"type": "string"},
                "mode": {
                    "type": "string",
                    "enum": ["stream", "poll"],
                    "default": "stream",
                },
                "poll_interval_s": {
                    "type": "number",
                    "minimum": 0.5,
                    "maximum": 60,
                    "default": 3,
                },
                "timeout_s": {
                    "type": "number",
                    "minimum": 5,
                    "maximum": 3600,
                    "default": 600,
                },
            },
            "required": ["workflow_id"],
            "additionalProperties": False,
        },
    ),
]


async def start_workflow_run(client: ApiClient, args: dict[str, Any]) -> Any:
    workflow_id = args.get("workflow_id")
    if not workflow_id:
        raise ValueError("workflow_id 为必填项")
    return await client.post(f"/api/workflow/{workflow_id}/runs")


async def get_run_progress(client: ApiClient, args: dict[str, Any]) -> Any:
    run_id = args.get("run_id")
    if not run_id:
        raise ValueError("run_id 为必填项")
    return await client.get(f"/api/workflow-runs/{run_id}/progress")


async def get_run_events(client: ApiClient, args: dict[str, Any]) -> Any:
    run_id = args.get("run_id")
    if not run_id:
        raise ValueError("run_id 为必填项")
    after_seq = int(args.get("after_seq") or 0)
    limit = int(args.get("limit") or 200)
    return await client.get(
        f"/api/workflow-runs/{run_id}/events",
        params={"after_seq": after_seq, "limit": limit},
    )


async def run_workflow_and_wait(client: ApiClient, args: dict[str, Any]) -> Any:
    workflow_id = args.get("workflow_id")
    if not workflow_id:
        raise ValueError("workflow_id 为必填项")
    mode = args.get("mode") or "stream"
    interval = float(args.get("poll_interval_s") or 3)
    timeout = float(args.get("timeout_s") or 600)
    step = 0.5 if mode == "stream" else interval

    started = await client.post(f"/api/workflow/{workflow_id}/runs")
    run_id = started.get("run_id") if isinstance(started, dict) else None
    if not run_id:
        raise ApiError(500, "后端未返回 run_id。")

    deadline = time.monotonic() + timeout
    after_seq = 0
    all_events: list[dict[str, Any]] = []
    final_status: str | None = None
    final_payload: dict[str, Any] | None = None

    while True:
        if time.monotonic() > deadline:
            raise ApiError(
                504,
                f"run {run_id} 等待 {timeout}s 仍未结束，请稍后使用 get_run_progress 继续观察。",
            )
        batch = await client.get(
            f"/api/workflow-runs/{run_id}/events",
            params={"after_seq": after_seq, "limit": 200},
        )
        events = batch.get("events") or [] if isinstance(batch, dict) else []
        for ev in events:
            all_events.append(ev)
            after_seq = max(after_seq, int(ev.get("seq") or 0))
            if ev.get("event_type") == "workflow_done":
                final_payload = ev.get("payload")
        if isinstance(batch, dict) and batch.get("is_terminal"):
            final_status = batch.get("run_status")
            break
        await asyncio.sleep(step)

    return {
        "run_id": run_id,
        "mode": mode,
        "status": final_status,
        "workflow_done": final_payload,
        "event_count": len(all_events),
        "events": all_events,
    }
