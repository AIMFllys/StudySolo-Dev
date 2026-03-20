"""Workflow CRUD routes: /api/workflow/*"""

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from supabase import AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user, get_supabase_client
from app.models.workflow import WorkflowContent, WorkflowCreate, WorkflowMeta, WorkflowUpdate
from app.engine.executor import execute_workflow

logger = logging.getLogger(__name__)

router = APIRouter()

_META_COLS = "id,name,description,status,created_at,updated_at"
_CONTENT_COLS = "id,name,description,nodes_json,edges_json,status,created_at,updated_at"


@router.get("", response_model=list[WorkflowMeta])
@router.get("/", response_model=list[WorkflowMeta], include_in_schema=False)
async def list_workflows(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Return metadata list for the current user's workflows."""
    result = (
        await db.from_("ss_workflows")
        .select(_META_COLS)
        .eq("user_id", current_user["id"])
        .order("updated_at", desc=True)
        .execute()
    )
    return result.data or []


@router.post("", response_model=WorkflowMeta, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=WorkflowMeta, status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def create_workflow(
    body: WorkflowCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Create a new workflow for the current user."""
    user_id = current_user["id"]

    payload = {
        "user_id": user_id,
        "name": body.name,
        "description": body.description,
        "nodes_json": [],
        "edges_json": [],
        "status": "draft",
    }
    # Insert the workflow
    try:
        insert_result = await db.from_("ss_workflows").insert(payload).execute()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建工作流失败: {e}",
        )
    if not insert_result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建工作流失败: 无返回数据")
    return insert_result.data[0]


@router.get("/{workflow_id}/content", response_model=WorkflowContent)
async def get_workflow_content(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Return full nodes/edges JSON for a workflow."""
    result = (
        await db.from_("ss_workflows")
        .select(_CONTENT_COLS)
        .eq("id", workflow_id)
        .eq("user_id", current_user["id"])
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="工作流不存在")
    return result.data


@router.put("/{workflow_id}", response_model=WorkflowMeta)
async def update_workflow(
    workflow_id: str,
    body: WorkflowUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Update a workflow (used for auto-save)."""
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无更新内容")

    update_result = (
        await db.from_("ss_workflows")
        .update(updates)
        .eq("id", workflow_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    # Some Supabase Python client builders do not support chaining select()
    # after update(). Query the updated row separately for a stable response.
    if update_result.data is not None and len(update_result.data) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="工作流不存在")

    result = (
        await db.from_("ss_workflows")
        .select(_META_COLS)
        .eq("id", workflow_id)
        .eq("user_id", current_user["id"])
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="工作流不存在")
    return result.data


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Delete a workflow owned by the current user."""
    result = (
        await db.from_("ss_workflows")
        .delete()
        .eq("id", workflow_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    # If RLS filtered it out, data will be empty — treat as not found
    if result.data is not None and len(result.data) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="工作流不存在")
    return {"success": True}


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
        await db.from_("ss_workflows").update({"nodes_json": updated_nodes}).eq("id", wf_id).eq("user_id", user_id).execute()

    async def event_generator():
        total_tokens = 0
        final_output: dict | None = None
        run_status = "completed"

        try:
            async for event in execute_workflow(workflow_id, nodes, edges, save_callback=_save_results):
                yield event

                # Parse SSE events to track tokens and final output
                try:
                    if event.startswith("event: node_token"):
                        lines = event.strip().split("\n")
                        for line in lines:
                            if line.startswith("data: "):
                                data = json.loads(line[6:])
                                token = data.get("token", "")
                                total_tokens += len(token.split())
                    elif event.startswith("event: workflow_done"):
                        lines = event.strip().split("\n")
                        for line in lines:
                            if line.startswith("data: "):
                                data = json.loads(line[6:])
                                if data.get("status") != "completed":
                                    run_status = "failed"
                                final_output = data
                except Exception:
                    pass  # Don't let parsing errors break the stream

        except Exception as e:
            logger.error("Workflow execution error for run %s: %s", run_id, e)
            run_status = "failed"

        # UPDATE ss_workflow_runs with final status
        completed_at = datetime.now(timezone.utc).isoformat()
        try:
            update_payload: dict = {
                "status": run_status,
                "completed_at": completed_at,
                "tokens_used": total_tokens,
            }
            if final_output is not None:
                update_payload["output"] = final_output
            await service_db.from_("ss_workflow_runs").update(update_payload).eq("id", run_id).execute()
        except Exception as e:
            logger.error("Failed to update ss_workflow_runs record %s: %s", run_id, e)

        # UPSERT ss_usage_daily — increment executions_count and tokens_used
        today = datetime.now(timezone.utc).date().isoformat()
        try:
            await service_db.from_("ss_usage_daily").upsert(
                {
                    "user_id": user_id,
                    "date": today,
                    "executions_count": 1,
                    "tokens_used": total_tokens,
                },
                on_conflict="user_id,date",
                count="exact",
            ).execute()
        except Exception:
            # Upsert with increment requires raw SQL; fall back to read-then-write
            try:
                existing = (
                    await service_db.from_("ss_usage_daily")
                    .select("executions_count,tokens_used")
                    .eq("user_id", user_id)
                    .eq("date", today)
                    .execute()
                )
                if existing.data:
                    row = existing.data[0]
                    await service_db.from_("ss_usage_daily").update({
                        "executions_count": (row.get("executions_count") or 0) + 1,
                        "tokens_used": (row.get("tokens_used") or 0) + total_tokens,
                    }).eq("user_id", user_id).eq("date", today).execute()
                else:
                    await service_db.from_("ss_usage_daily").insert({
                        "user_id": user_id,
                        "date": today,
                        "executions_count": 1,
                        "tokens_used": total_tokens,
                    }).execute()
            except Exception as e2:
                logger.error("Failed to update ss_usage_daily for user %s: %s", user_id, e2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        },
    )
