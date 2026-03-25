"""Workflow SSE execution route: /api/workflow/{id}/execute"""

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from supabase import AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user, get_supabase_client
from app.engine.executor import execute_workflow

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{workflow_id}/execute")
async def execute_workflow_sse(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
    service_db: AsyncClient = Depends(get_db),
):
    """SSE endpoint: execute a workflow and stream node events.

    Event types: node_status, node_token, node_done, workflow_done
    """
    # Fetch workflow content (verifies ownership via user_id)
    result = (
        await db.from_("ss_workflows")
        .select("id,nodes_json,edges_json")
        .eq("id", workflow_id)
        .eq("user_id", current_user["id"])
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="工作流不存在")

    workflow = result.data
    nodes = workflow.get("nodes_json") or []
    edges = workflow.get("edges_json") or []
    user_id = current_user["id"]

    # INSERT a workflow run record with status='running'
    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc).isoformat()
    try:
        await service_db.from_("ss_workflow_runs").insert({
            "id": run_id,
            "workflow_id": workflow_id,
            "user_id": user_id,
            "status": "running",
            "started_at": started_at,
        }).execute()
    except Exception as e:
        logger.error("Failed to insert ss_workflow_runs record: %s", e)

    async def _save_results(wf_id: str, updated_nodes: list[dict]) -> None:
        await db.from_("ss_workflows").update(
            {"nodes_json": updated_nodes}
        ).eq("id", wf_id).eq("user_id", user_id).execute()

    async def event_generator():
        total_tokens = 0
        final_output: dict | None = None
        run_status = "completed"

        def _parse_event(evt: str) -> None:
            nonlocal total_tokens, final_output, run_status
            try:
                if evt.startswith("event: node_token"):
                    for line in evt.strip().split("\n"):
                        if line.startswith("data: "):
                            data = json.loads(line[6:])
                            total_tokens += len(data.get("token", "").split())
                elif evt.startswith("event: workflow_done"):
                    for line in evt.strip().split("\n"):
                        if line.startswith("data: "):
                            data = json.loads(line[6:])
                            if data.get("status") != "completed":
                                run_status = "failed"
                            final_output = data
            except Exception:
                pass

        try:
            async for event in execute_workflow(
                workflow_id, nodes, edges, save_callback=_save_results
            ):
                yield event
                _parse_event(event)

        except Exception as e:
            logger.error("Workflow execution error for run %s: %s", run_id, e)
            run_status = "failed"

        # UPDATE ss_workflow_runs with final status
        await _finalize_run(service_db, run_id, run_status, total_tokens, final_output)
        await _update_usage_daily(service_db, user_id, total_tokens)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _finalize_run(
    db: AsyncClient,
    run_id: str,
    run_status: str,
    total_tokens: int,
    final_output: dict | None,
) -> None:
    """Update ss_workflow_runs with completion data."""
    completed_at = datetime.now(timezone.utc).isoformat()
    try:
        payload: dict = {
            "status": run_status,
            "completed_at": completed_at,
            "tokens_used": total_tokens,
        }
        if final_output is not None:
            payload["output"] = final_output
        await db.from_("ss_workflow_runs").update(payload).eq("id", run_id).execute()
    except Exception as e:
        logger.error("Failed to update ss_workflow_runs record %s: %s", run_id, e)


async def _update_usage_daily(
    db: AsyncClient, user_id: str, total_tokens: int
) -> None:
    """Increment ss_usage_daily executions_count and tokens_used."""
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
            await db.from_("ss_usage_daily").update({
                "executions_count": (row.get("executions_count") or 0) + 1,
                "tokens_used": (row.get("tokens_used") or 0) + total_tokens,
            }).eq("user_id", user_id).eq("date", today).execute()
        else:
            await db.from_("ss_usage_daily").insert({
                "user_id": user_id,
                "date": today,
                "executions_count": 1,
                "tokens_used": total_tokens,
            }).execute()
    except Exception as e:
        logger.error("Failed to update ss_usage_daily for user %s: %s", user_id, e)
