"""Workflow social routes: like, favorite, marketplace, public view, fork."""

import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user, get_supabase_client
from app.models.workflow import (
    InteractionToggleResponse,
    WorkflowMeta,
    WorkflowPublicView,
)

logger = logging.getLogger(__name__)

router = APIRouter()

_PUBLIC_VIEW_COLS = (
    "id,name,description,nodes_json,edges_json,tags,"
    "is_featured,is_official,likes_count,favorites_count,"
    "user_id,created_at"
)
_MARKETPLACE_COLS = (
    "id,name,description,status,tags,is_public,is_featured,is_official,"
    "likes_count,favorites_count,user_id,created_at,updated_at"
)


async def _toggle_interaction(
    workflow_id: str,
    user_id: str,
    action: str,
    db: AsyncClient,
) -> InteractionToggleResponse:
    """Toggle like/favorite — attempt INSERT; on conflict, DELETE."""
    try:
        await db.from_("ss_workflow_interactions").insert({
            "user_id": user_id,
            "workflow_id": workflow_id,
            "action": action,
        }).execute()
        toggled = True
    except Exception:
        # UNIQUE constraint violation → already exists → remove it
        existing = (
            await db.from_("ss_workflow_interactions")
            .select("id")
            .eq("user_id", user_id)
            .eq("workflow_id", workflow_id)
            .eq("action", action)
            .execute()
        )
        if existing.data:
            await db.from_("ss_workflow_interactions").delete().eq(
                "id", existing.data[0]["id"]
            ).execute()
        toggled = False

    # Read back the updated count from ss_workflows
    count_col = "likes_count" if action == "like" else "favorites_count"
    wf = (
        await db.from_("ss_workflows")
        .select(count_col)
        .eq("id", workflow_id)
        .single()
        .execute()
    )
    count = (wf.data or {}).get(count_col, 0)
    return InteractionToggleResponse(toggled=toggled, count=count)


@router.post("/{workflow_id}/like", response_model=InteractionToggleResponse)
async def toggle_like(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """Toggle like on a workflow."""
    return await _toggle_interaction(
        workflow_id, current_user["id"], "like", db
    )


@router.post("/{workflow_id}/favorite", response_model=InteractionToggleResponse)
async def toggle_favorite(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """Toggle favorite on a workflow."""
    return await _toggle_interaction(
        workflow_id, current_user["id"], "favorite", db
    )


@router.get("/{workflow_id}/public", response_model=WorkflowPublicView)
async def get_public_workflow(
    workflow_id: str,
    db: AsyncClient = Depends(get_db),
    current_user: dict | None = Depends(get_optional_user),
):
    """Get a public workflow — no auth required, optionally personalized."""
    try:
        result = (
            await db.from_("ss_workflows")
            .select(_PUBLIC_VIEW_COLS)
            .eq("id", workflow_id)
            .eq("is_public", True)
            .limit(1)
            .execute()
        )
        rows = result.data or []
    except Exception:
        rows = []

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="工作流不存在或未公开",
        )

    wf = rows[0]
    # Resolve owner name
    profile = (
        await db.from_("user_profiles")
        .select("nickname")
        .eq("id", wf["user_id"])
        .single()
        .execute()
    )
    wf["owner_name"] = (profile.data or {}).get("nickname") or "未知用户"

    # Personalize interaction state for logged-in users
    if current_user:
        interactions = (
            await db.from_("ss_workflow_interactions")
            .select("action")
            .eq("user_id", current_user["id"])
            .eq("workflow_id", workflow_id)
            .execute()
        )
        actions = {r["action"] for r in (interactions.data or [])}
        wf["is_liked"] = "like" in actions
        wf["is_favorited"] = "favorite" in actions
    else:
        wf["is_liked"] = False
        wf["is_favorited"] = False
    return wf


@router.get("/marketplace", response_model=list[WorkflowMeta])
async def list_marketplace(
    filter: str | None = Query(None, regex="^(official|public|featured)$"),
    search: str | None = Query(None, max_length=100),
    tags: str | None = Query(None, description="Comma-separated tag filter"),
    sort: str = Query("likes", regex="^(likes|newest|favorites)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncClient = Depends(get_db),
):
    """List public/official workflows for the marketplace."""
    query = db.from_("ss_workflows").select(_MARKETPLACE_COLS)

    # Base filter: only public or official
    if filter == "official":
        query = query.eq("is_official", True)
    elif filter == "featured":
        query = query.eq("is_featured", True)
    else:
        query = query.or_("is_public.eq.true,is_official.eq.true")

    if search:
        # Sanitize: strip PostgREST filter metacharacters to prevent injection
        safe = re.sub(r'[.,()\%]', '', search).strip()
        if safe:
            query = query.or_(f"name.ilike.%{safe}%,description.ilike.%{safe}%")

    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        if tag_list:
            query = query.contains("tags", tag_list)

    sort_map = {
        "likes": ("likes_count", True),
        "favorites": ("favorites_count", True),
        "newest": ("created_at", True),
    }
    col, desc = sort_map[sort]
    query = query.order(col, desc=desc)

    offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1)

    result = await query.execute()
    workflows = result.data or []

    # Batch resolve owner names
    user_ids = list({w["user_id"] for w in workflows})
    if user_ids:
        profiles = (
            await db.from_("user_profiles")
            .select("id,nickname")
            .in_("id", user_ids)
            .execute()
        )
        name_map = {p["id"]: p.get("nickname") or "未知用户" for p in (profiles.data or [])}
        for w in workflows:
            w["owner_name"] = name_map.get(w["user_id"], "未知用户")

    return workflows


@router.post("/{workflow_id}/fork", response_model=WorkflowMeta)
async def fork_workflow(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """Fork a public workflow to the current user's workspace."""
    source = (
        await db.from_("ss_workflows")
        .select("name,description,nodes_json,edges_json,annotations_json,tags")
        .eq("id", workflow_id)
        .eq("is_public", True)
        .single()
        .execute()
    )
    if not source.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="工作流不存在或未公开",
        )

    s = source.data
    insert_result = (
        await db.from_("ss_workflows")
        .insert({
            "user_id": current_user["id"],
            "name": f"[Fork] {s['name']}",
            "description": s.get("description"),
            "nodes_json": s.get("nodes_json") or [],
            "edges_json": s.get("edges_json") or [],
            "annotations_json": s.get("annotations_json") or [],
            "tags": s.get("tags") or [],
            "status": "draft",
            "is_public": False,
        })
        .execute()
    )
    if not insert_result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Fork 工作流失败",
        )

    # Enrich with owner_name for WorkflowMeta response
    wf = insert_result.data[0]
    user_id = current_user["id"]
    profile = await db.from_("user_profiles").select("nickname").eq("id", user_id).single().execute()
    wf["owner_name"] = (profile.data or {}).get("nickname") or "未知用户"
    wf["is_liked"] = False
    wf["is_favorited"] = False
    return wf
