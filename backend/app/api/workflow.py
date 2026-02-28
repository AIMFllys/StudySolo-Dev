"""Workflow CRUD routes: /api/workflow/*"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from supabase import AsyncClient

from app.core.deps import get_current_user, get_supabase_client
from app.models.workflow import WorkflowContent, WorkflowCreate, WorkflowMeta, WorkflowUpdate
from app.services.workflow_engine import execute_workflow

router = APIRouter()

_META_COLS = "id,name,description,status,created_at,updated_at"
_CONTENT_COLS = "id,name,description,nodes_json,edges_json,status,created_at,updated_at"


@router.get("", response_model=list[WorkflowMeta])
async def list_workflows(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Return metadata list for the current user's workflows."""
    result = (
        await db.from_("workflows")
        .select(_META_COLS)
        .eq("user_id", current_user["id"])
        .order("updated_at", desc=True)
        .execute()
    )
    return result.data or []


@router.post("", response_model=WorkflowMeta, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    body: WorkflowCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Create a new workflow for the current user."""
    user_id = current_user["id"]

    # Ensure user exists in public.users (FK target for workflows.user_id)
    try:
        await db.from_("users").upsert(
            {"id": user_id, "email": current_user.get("email", "")},
            on_conflict="id",
        ).execute()
    except Exception:
        pass  # Best-effort; if users table doesn't exist yet, skip

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
        insert_result = await db.from_("workflows").insert(payload).execute()
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
        await db.from_("workflows")
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

    result = (
        await db.from_("workflows")
        .update(updates)
        .eq("id", workflow_id)
        .eq("user_id", current_user["id"])
        .select(_META_COLS)
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
        await db.from_("workflows")
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
):
    """SSE endpoint: execute a workflow and stream node events.

    Event types: node_status, node_token, node_done, workflow_done
    """
    # Fetch workflow content (verifies ownership via user_id)
    result = (
        await db.from_("workflows")
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

    async def event_generator():
        async for event in execute_workflow(workflow_id, nodes, edges):
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        },
    )
