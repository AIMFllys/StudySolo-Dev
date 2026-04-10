"""Workflow CRUD routes: /api/workflow/*"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.core.database import get_db
from app.core.deps import check_workflow_access, get_current_user, get_supabase_client
from app.models.workflow import WorkflowContent, WorkflowCreate, WorkflowMeta, WorkflowUpdate
from app.services.quota_service import assert_workflow_quota

logger = logging.getLogger(__name__)

router = APIRouter()

# Derived from WorkflowMeta model — single source of truth, prevents field-drift
_META_COLS = WorkflowMeta.select_cols()
_CONTENT_COLS = (
    "id,name,description,nodes_json,edges_json,annotations_json,"
    "status,tags,is_public,created_at,updated_at"
)


@router.get("/", response_model=list[WorkflowMeta])
async def list_workflows(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
    service_db: AsyncClient = Depends(get_db),
):
    """Return metadata list for the current user's workflows."""
    user_id = current_user["id"]
    result = (
        await db.from_("ss_workflows")
        .select(_META_COLS)
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    workflows = result.data or []
    if not workflows:
        return []

    # Batch fetch interaction states for current user
    wf_ids = [w["id"] for w in workflows]
    interactions = (
        await service_db.from_("ss_workflow_interactions")
        .select("workflow_id,action")
        .eq("user_id", user_id)
        .in_("workflow_id", wf_ids)
        .execute()
    )
    liked_ids = {r["workflow_id"] for r in (interactions.data or []) if r["action"] == "like"}
    faved_ids = {r["workflow_id"] for r in (interactions.data or []) if r["action"] == "favorite"}

    # Fetch owner nickname
    profile = (
        await service_db.from_("user_profiles")
        .select("nickname")
        .eq("id", user_id)
        .single()
        .execute()
    )
    owner_name = (profile.data or {}).get("nickname") or "未知用户"

    for w in workflows:
        w["owner_name"] = owner_name
        w["is_liked"] = w["id"] in liked_ids
        w["is_favorited"] = w["id"] in faved_ids

    return workflows


@router.post("/", response_model=WorkflowMeta, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    body: WorkflowCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
    service_db: AsyncClient = Depends(get_db),
):
    """Create a new workflow for the current user."""
    user_id = current_user["id"]
    tier = current_user.get("tier", "free")

    # Hard quota enforcement — must run before INSERT
    await assert_workflow_quota(user_id, tier, service_db)

    payload = {
        "user_id": user_id,
        "name": body.name,
        "description": body.description,
        "nodes_json": [],
        "edges_json": [],
        "annotations_json": [],
        "status": "draft",
    }
    try:
        insert_result = await db.from_("ss_workflows").insert(payload).execute()
    except Exception as e:
        logger.exception("创建工作流失败: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建工作流失败: {e}",
        )
    if not insert_result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建工作流失败: 无返回数据")

    # Enrich with owner_name (not in DB columns)
    wf = insert_result.data[0]
    profile = await service_db.from_("user_profiles").select("nickname").eq("id", user_id).single().execute()
    wf["owner_name"] = (profile.data or {}).get("nickname") or "未知用户"
    wf["is_liked"] = False
    wf["is_favorited"] = False
    return wf


@router.get("/{workflow_id}/content", response_model=WorkflowContent)
async def get_workflow_content(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Return full nodes/edges JSON for a workflow.

    Access: owner + editor + viewer (viewer sees read-only in frontend).
    """
    await check_workflow_access(workflow_id, current_user["id"], "viewer", db)
    result = (
        await db.from_("ss_workflows")
        .select(_CONTENT_COLS)
        .eq("id", workflow_id)
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
    service_db: AsyncClient = Depends(get_db),
):
    """Update a workflow (used for auto-save).

    Access: owner + editor can save content.
    Owner-only fields (is_public) are guarded separately.
    """
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无更新内容")

    user_id = current_user["id"]

    # is_public toggle is owner-only
    required = "owner" if "is_public" in updates else "editor"
    await check_workflow_access(workflow_id, user_id, required, db)

    update_result = (
        await db.from_("ss_workflows")
        .update(updates)
        .eq("id", workflow_id)
        .execute()
    )

    if update_result.data is not None and len(update_result.data) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="工作流不存在")

    result = (
        await db.from_("ss_workflows")
        .select(_META_COLS)
        .eq("id", workflow_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="工作流不存在")

    # Enrich with virtual fields
    wf = result.data
    profile = await service_db.from_("user_profiles").select("nickname").eq("id", user_id).single().execute()
    wf["owner_name"] = (profile.data or {}).get("nickname") or "未知用户"
    interactions = (
        await service_db.from_("ss_workflow_interactions")
        .select("action")
        .eq("user_id", user_id)
        .eq("workflow_id", workflow_id)
        .execute()
    )
    actions = {r["action"] for r in (interactions.data or [])}
    wf["is_liked"] = "like" in actions
    wf["is_favorited"] = "favorite" in actions
    return wf


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Delete a workflow. Access: owner only."""
    await check_workflow_access(workflow_id, current_user["id"], "owner", db)
    result = (
        await db.from_("ss_workflows")
        .delete()
        .eq("id", workflow_id)
        .execute()
    )
    if result.data is not None and len(result.data) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="工作流不存在")
    return {"success": True}

