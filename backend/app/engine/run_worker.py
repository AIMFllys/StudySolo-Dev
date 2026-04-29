"""Background worker: run a workflow and persist events + final status.

This is the async counterpart of the SSE-based ``api/workflow/execute.py``.
Instead of streaming SSE to a single connected client, it writes node-level
events to ``ss_workflow_run_events`` so that HTTP pollers (CLI / MCP) can
observe progress via ``GET /api/workflow-runs/{run_id}/progress`` and
``GET /api/workflow-runs/{run_id}/events``.

The surface purposely mirrors the SSE producer (same trace accumulation,
same run finalization) so both code paths converge on identical DB state.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Iterable

from fastapi import HTTPException

from app.core.database import get_db
from app.engine.events import parse_sse_frame
from app.engine.executor import execute_workflow
from app.services.ai_catalog_service import get_sku_by_id, is_tier_allowed
from app.services.usage_tracker import usage_request_scope

logger = logging.getLogger(__name__)


# Frames we actually persist to ss_workflow_run_events. Token deltas
# (``node_output_chunk`` etc.) are intentionally dropped to keep the table
# small; pollers that need finer granularity should use SSE instead.
_PERSISTED_EVENT_TYPES: frozenset[str] = frozenset(
    {
        "workflow_status",
        "node_input",
        "node_status",
        "node_done",
        "save_error",
        "workflow_done",
    }
)


# Same category map as api/workflow/execute.py — single source of truth would
# live in backend/app/nodes/_categories.py; for now we duplicate to avoid a
# wider refactor.
_NODE_CATEGORY_MAP: dict[str, str] = {
    "trigger_input": "input",
    "knowledge_base": "input",
    "web_search": "input",
    "ai_analyzer": "analysis",
    "ai_planner": "analysis",
    "logic_switch": "analysis",
    "loop_map": "analysis",
    "outline_gen": "generation",
    "content_extract": "generation",
    "summary": "generation",
    "flashcard": "generation",
    "compare": "generation",
    "mind_map": "generation",
    "quiz_gen": "generation",
    "merge_polish": "generation",
    "chat_response": "interaction",
    "export_file": "output",
    "write_db": "output",
    "loop_group": "structure",
    "agent_code_review": "agent",
    "agent_deep_research": "agent",
    "agent_news": "agent",
    "agent_study_tutor": "agent",
    "agent_visual_site": "agent",
}


async def _next_seq(db, run_id: str) -> int:
    """Allocate the next monotonic ``seq`` for a given run."""
    result = (
        await db.from_("ss_workflow_run_events")
        .select("seq")
        .eq("run_id", run_id)
        .order("seq", desc=True)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return (rows[0]["seq"] + 1) if rows else 1


class EventSink:
    """Append-only sink that writes key-frame events to ss_workflow_run_events."""

    def __init__(self, db, run_id: str) -> None:
        self._db = db
        self._run_id = run_id
        self._seq = 0
        self._lock = asyncio.Lock()

    async def initialise(self) -> None:
        """Read the current max seq so re-runs / recoveries append cleanly."""
        self._seq = (await _next_seq(self._db, self._run_id)) - 1

    async def append(self, event_type: str, payload: dict[str, Any]) -> None:
        """Persist ``event_type`` + ``payload`` if it is a key frame."""
        if event_type not in _PERSISTED_EVENT_TYPES:
            return
        async with self._lock:
            self._seq += 1
            seq = self._seq
        try:
            await (
                self._db.from_("ss_workflow_run_events")
                .insert(
                    {
                        "run_id": self._run_id,
                        "seq": seq,
                        "event_type": event_type,
                        "payload": payload,
                    }
                )
                .execute()
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Failed to persist run event %s/%s: %s", self._run_id, event_type, exc
            )


async def run_to_db(
    *,
    run_id: str,
    workflow_id: str,
    user_id: str,
    user_tier: str,
) -> None:
    """Run the workflow identified by ``workflow_id`` to completion, writing
    events + traces + final status to the database.

    This coroutine is launched by ``POST /api/workflow/{id}/runs`` via
    ``asyncio.create_task`` and must never raise — all failures are captured
    and reflected in ``ss_workflow_runs.status``.
    """
    db = await get_db()
    sink = EventSink(db, run_id)
    await sink.initialise()

    run_status = "completed"
    final_output: dict | None = None
    total_tokens = 0
    node_traces: dict[str, dict] = {}
    node_timers: dict[str, float] = {}
    trace_order = 0
    nodes: list[dict] = []
    current_phase = "queued"

    async def emit_workflow_status(phase: str, message: str) -> None:
        nonlocal current_phase
        current_phase = phase
        await sink.append(
            "workflow_status",
            {"workflow_id": workflow_id, "phase": phase, "message": message},
        )

    try:
        await emit_workflow_status("loading", "正在加载工作流图")

        # Load the workflow graph (owner-scoped).
        wf_result = (
            await db.from_("ss_workflows")
            .select("id,nodes_json,edges_json")
            .eq("id", workflow_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not wf_result.data:
            raise HTTPException(status_code=404, detail="工作流不存在")

        workflow = wf_result.data
        nodes = workflow.get("nodes_json") or []
        edges = workflow.get("edges_json") or []
        workflow_input = _resolve_workflow_input(nodes)
        if workflow_input is not None:
            await _update_run_input(db, run_id, workflow_input)

        implicit_context = {
            "user_id": user_id,
            "workflow_id": workflow_id,
            "user_tier": user_tier,
            "workflow_run_id": run_id,
        }

        await emit_workflow_status("validating", "正在校验模型权限与执行图")
        for node in nodes:
            node_data = node.get("data", {})
            model_route = (
                node_data.get("model_route")
                or (node_data.get("config") or {}).get("model_route")
            )
            if not model_route:
                continue
            sku = await get_sku_by_id(model_route)
            if sku and not is_tier_allowed(user_tier, sku.required_tier):
                raise HTTPException(
                    status_code=403,
                    detail={
                        "code": "MODEL_TIER_FORBIDDEN",
                        "message": (
                            f"节点使用了当前会员等级（{user_tier}）无权访问的模型："
                            f"{sku.display_name}"
                        ),
                        "model": sku.model_id,
                        "required_tier": sku.required_tier,
                        "current_tier": user_tier,
                    },
                )

        # Mark the run as actively running now that we've passed validation.
        started_at = datetime.now(timezone.utc).isoformat()
        try:
            await (
                db.from_("ss_workflow_runs")
                .update({"status": "running", "started_at": started_at})
                .eq("id", run_id)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to mark run %s as running: %s", run_id, exc)

        await emit_workflow_status("executing", "正在执行工作流节点")

        async with usage_request_scope(
            user_id=user_id,
            source_type="workflow",
            source_subtype="workflow_execute",
            workflow_id=workflow_id,
            workflow_run_id=run_id,
        ) as usage_scope:

            async def _save_results(wf_id: str, updated_nodes: list[dict]) -> None:
                await emit_workflow_status("saving", "正在保存执行结果")
                await (
                    db.from_("ss_workflows")
                    .update({"nodes_json": updated_nodes})
                    .eq("id", wf_id)
                    .eq("user_id", user_id)
                    .execute()
                )

            did_emit_workflow_done = False
            async for event in execute_workflow(
                workflow_id,
                nodes,
                edges,
                implicit_context=implicit_context,
                save_callback=_save_results,
            ):
                event_type, payload = parse_sse_frame(event)
                if not event_type or payload is None:
                    continue

                await sink.append(event_type, payload)

                _accumulate_trace(
                    event_type, payload,
                    node_traces, node_timers, trace_order,
                )
                if event_type == "node_input":
                    trace_order += 1

                if event_type == "workflow_done":
                    did_emit_workflow_done = True
                    final_output = payload
                    if payload.get("status") != "completed":
                        run_status = "failed"
                        usage_scope.status = "failed"

            if not did_emit_workflow_done:
                run_status = "failed"
                usage_scope.status = "failed"
                await sink.append(
                    "workflow_done",
                    {
                        "workflow_id": workflow_id,
                        "status": "error",
                        "error": "执行流未正常结束",
                    },
                )

            total_tokens = await _load_request_total_tokens(db, usage_scope.request_id)

    except HTTPException as exc:
        run_status = "failed"
        await sink.append(
            "workflow_done",
            {
                "workflow_id": workflow_id,
                "status": "error",
                "error": _format_error_detail(exc.detail),
            },
        )
    except Exception as exc:  # noqa: BLE001
        run_status = "failed"
        logger.exception("run_to_db failed for run %s: %s", run_id, exc)
        await sink.append(
            "workflow_done",
            {
                "workflow_id": workflow_id,
                "status": "error",
                "error": "工作流执行失败，请稍后重试",
            },
        )
    finally:
        await emit_workflow_status("finalizing", "正在收尾执行状态")
        await _finalize_run(db, run_id, run_status, total_tokens, final_output)
        if node_traces:
            await _save_traces(db, run_id, user_id, nodes, node_traces)
        if total_tokens > 0:
            await _update_usage_daily(db, user_id, total_tokens)


# ── Helpers (copied from api/workflow/execute.py, intentionally small) ──────


def _resolve_workflow_input(nodes: Iterable[dict] | None) -> str | None:
    """Resolve the run input from the first trigger_input node.

    Mirrors the SSE execution path: user_content wins, label is the fallback.
    """
    if not nodes:
        return None
    for node in nodes:
        if node.get("type") != "trigger_input":
            continue
        data = node.get("data") or {}
        return data.get("user_content") or data.get("label") or None
    return None


async def _update_run_input(db, run_id: str, workflow_input: str) -> None:
    """Persist trigger input for REST-created runs (best-effort)."""
    try:
        await (
            db.from_("ss_workflow_runs")
            .update({"input": workflow_input})
            .eq("id", run_id)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to update run input for %s: %s", run_id, exc)


def _format_error_detail(detail: Any) -> str:
    if isinstance(detail, dict):
        return str(detail.get("message") or detail.get("detail") or detail)
    return str(detail)


def _accumulate_trace(
    event_type: str,
    payload: dict,
    node_traces: dict[str, dict],
    node_timers: dict[str, float],
    current_order: int,
) -> None:
    nid = payload.get("node_id")
    if not nid:
        return

    if event_type == "node_input":
        node_timers[nid] = time.monotonic()
        node_traces[nid] = {
            "node_id": nid,
            "execution_order": current_order + 1,
            "input_snapshot": payload.get("input_snapshot"),
            "status": "running",
            "is_parallel": bool(payload.get("parallel_group_id")),
            "parallel_group_id": payload.get("parallel_group_id"),
        }
    elif event_type == "node_status" and nid in node_traces:
        node_traces[nid]["status"] = payload.get("status", "unknown")
        if payload.get("error"):
            node_traces[nid]["error_message"] = payload["error"]
    elif event_type == "node_done" and nid in node_traces:
        node_traces[nid]["final_output"] = payload.get("full_output")
        node_traces[nid]["status"] = "done"
        metadata = payload.get("metadata")
        if isinstance(metadata, dict) and isinstance(metadata.get("resolved_model_route"), str):
            node_traces[nid]["model_route"] = metadata["resolved_model_route"]
        start = node_timers.get(nid)
        if start is not None:
            node_traces[nid]["duration_ms"] = int((time.monotonic() - start) * 1000)


async def _save_traces(
    db,
    run_id: str,
    user_id: str,
    nodes: list[dict],
    node_traces: dict[str, dict],
) -> None:
    node_map = {n["id"]: n for n in nodes}
    rows = []
    for nid, trace in node_traces.items():
        node_def = node_map.get(nid, {})
        node_data = node_def.get("data", {})
        node_type = node_def.get("type", "unknown")
        rows.append(
            {
                "run_id": run_id,
                "user_id": user_id,
                "node_id": nid,
                "node_type": node_type,
                "node_name": node_data.get("label", nid),
                "category": _NODE_CATEGORY_MAP.get(node_type),
                "execution_order": trace.get("execution_order", 0),
                "status": trace.get("status", "unknown"),
                "input_snapshot": trace.get("input_snapshot"),
                "final_output": trace.get("final_output"),
                "output_format": node_data.get("output_format"),
                "duration_ms": trace.get("duration_ms"),
                "model_route": trace.get("model_route") or node_data.get("model_route"),
                "is_parallel": trace.get("is_parallel", False),
                "parallel_group_id": trace.get("parallel_group_id"),
                "error_message": trace.get("error_message"),
            }
        )
    if rows:
        try:
            await db.from_("ss_workflow_run_traces").insert(rows).execute()
        except Exception as exc:  # noqa: BLE001
            logger.error("run_to_db: failed to save traces for %s: %s", run_id, exc)


async def _finalize_run(
    db,
    run_id: str,
    run_status: str,
    total_tokens: int,
    final_output: dict | None,
) -> None:
    completed_at = datetime.now(timezone.utc).isoformat()
    try:
        payload: dict = {
            "status": run_status,
            "completed_at": completed_at,
            "tokens_used": total_tokens,
        }
        if final_output is not None:
            current = (
                await db.from_("ss_workflow_runs")
                .select("output")
                .eq("id", run_id)
                .single()
                .execute()
            )
            current_output = current.data.get("output") if current.data else {}
            if not isinstance(current_output, dict):
                current_output = {}
            current_output["workflow_status"] = final_output
            payload["output"] = current_output
        await db.from_("ss_workflow_runs").update(payload).eq("id", run_id).execute()
    except Exception as exc:  # noqa: BLE001
        logger.error("run_to_db: failed to finalize run %s: %s", run_id, exc)


async def _load_request_total_tokens(db, request_id: str) -> int:
    try:
        result = (
            await db.from_("ss_ai_usage_events")
            .select("total_tokens")
            .eq("request_id", request_id)
            .eq("status", "success")
            .execute()
        )
    except Exception:  # noqa: BLE001
        return 0
    return sum(int(row.get("total_tokens") or 0) for row in (result.data or []))


async def _update_usage_daily(db, user_id: str, total_tokens: int) -> None:
    today = datetime.now(timezone.utc).date().isoformat()
    try:
        existing = (
            await db.from_("ss_usage_daily")
            .select("executions_count,tokens_used")
            .eq("user_id", user_id)
            .eq("date", today)
            .execute()
        )
        if existing.data:
            row = existing.data[0]
            await (
                db.from_("ss_usage_daily")
                .update(
                    {
                        "executions_count": (row.get("executions_count") or 0) + 1,
                        "tokens_used": (row.get("tokens_used") or 0) + total_tokens,
                    }
                )
                .eq("user_id", user_id)
                .eq("date", today)
                .execute()
            )
        else:
            await (
                db.from_("ss_usage_daily")
                .insert(
                    {
                        "user_id": user_id,
                        "date": today,
                        "executions_count": 1,
                        "tokens_used": total_tokens,
                    }
                )
                .execute()
            )
    except Exception as exc:  # noqa: BLE001
        logger.error("run_to_db: failed to update usage_daily for %s: %s", user_id, exc)


# ── Convenience: progress summary derived from events ───────────────────────


async def summarise_progress(db, run_id: str) -> dict[str, Any]:
    """Compute a ``/progress`` response by reading ss_workflow_runs + events."""
    run_result = (
        await db.from_("ss_workflow_runs")
        .select("id,status,started_at,completed_at,input,workflow_id")
        .eq("id", run_id)
        .maybe_single()
        .execute()
    )
    run_row = run_result.data if run_result else None
    if not run_row:
        raise HTTPException(status_code=404, detail="运行记录不存在")

    wf_row = None
    try:
        wf_result = (
            await db.from_("ss_workflows")
            .select("nodes_json")
            .eq("id", run_row["workflow_id"])
            .maybe_single()
            .execute()
        )
        wf_row = wf_result.data if wf_result else None
    except Exception:  # noqa: BLE001
        wf_row = None

    nodes_json = wf_row.get("nodes_json") if wf_row else None
    node_label_map = _build_node_label_map(nodes_json)
    runnable_node_ids = _runnable_node_ids(nodes_json)
    total_nodes = len(runnable_node_ids)

    events_result = (
        await db.from_("ss_workflow_run_events")
        .select("seq,event_type,payload,created_at")
        .eq("run_id", run_id)
        .order("seq", desc=True)
        .limit(200)
        .execute()
    )
    events: list[dict] = events_result.data or []

    phase = "queued"
    current_node_id: str | None = None
    current_node_label: str | None = None
    last_event_at: str | None = None

    for ev in reversed(events):  # oldest to newest for correct "current"
        last_event_at = ev.get("created_at") or last_event_at
        payload = ev.get("payload") or {}
        etype = ev.get("event_type")
        if etype == "workflow_status":
            phase = payload.get("phase") or phase
        elif etype == "node_input":
            nid = payload.get("node_id")
            if nid:
                current_node_id = nid
                current_node_label = (
                    payload.get("node_label")
                    or node_label_map.get(nid)
                    or nid
                )

    done_nodes = await _load_done_node_ids(db, run_id, runnable_node_ids)
    done_count = len(done_nodes)
    percent = 0
    if total_nodes:
        if run_row.get("status") == "completed":
            done_count = total_nodes
            percent = 100
        else:
            percent = min(100, int(done_count * 100 / total_nodes))

    elapsed_ms: int | None = None
    started_at = run_row.get("started_at")
    completed_at = run_row.get("completed_at")
    if started_at:
        try:
            start_dt = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            end_dt = (
                datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
                if completed_at
                else datetime.now(timezone.utc)
            )
            elapsed_ms = int((end_dt - start_dt).total_seconds() * 1000)
        except ValueError:
            elapsed_ms = None

    return {
        "run_id": run_id,
        "workflow_id": run_row["workflow_id"],
        "status": run_row.get("status", "queued"),
        "phase": phase,
        "current_node_id": current_node_id,
        "current_node_label": current_node_label,
        "total_nodes": total_nodes,
        "done_nodes": done_count,
        "percent": percent,
        "elapsed_ms": elapsed_ms,
        "last_event_at": last_event_at,
    }


def _runnable_node_ids(nodes: Iterable[dict] | None) -> set[str]:
    """Return node ids that actually execute (skip visual containers)."""
    if not nodes:
        return set()
    return {
        str(n.get("id"))
        for n in nodes
        if n.get("id") and (n.get("type") or "") != "loop_group"
    }


def _count_runnable_nodes(nodes: Iterable[dict] | None) -> int:
    """Count nodes that actually execute (skip purely visual containers)."""
    return len(_runnable_node_ids(nodes))


def _build_node_label_map(nodes: Iterable[dict] | None) -> dict[str, str]:
    """Map node ids to display labels for progress snapshots."""
    labels: dict[str, str] = {}
    if not nodes:
        return labels
    for node in nodes:
        node_id = node.get("id")
        if not node_id:
            continue
        data = node.get("data") or {}
        label = data.get("label") or data.get("user_content") or str(node_id)
        labels[str(node_id)] = str(label)
    return labels


async def _load_done_node_ids(
    db,
    run_id: str,
    runnable_node_ids: set[str],
) -> set[str]:
    """Load all completed node ids for a run, independent of recent-event window."""
    done: set[str] = set()
    page_size = 1000
    offset = 0

    while True:
        try:
            result = (
                await db.from_("ss_workflow_run_events")
                .select("payload")
                .eq("run_id", run_id)
                .eq("event_type", "node_done")
                .range(offset, offset + page_size - 1)
                .execute()
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to load done-node events for run %s: %s", run_id, exc)
            return done

        rows = result.data or []
        for row in rows:
            payload = row.get("payload") or {}
            node_id = payload.get("node_id")
            if not node_id:
                continue
            node_id = str(node_id)
            if not runnable_node_ids or node_id in runnable_node_ids:
                done.add(node_id)

        if len(rows) < page_size:
            return done
        offset += page_size
