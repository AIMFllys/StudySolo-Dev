"""Workflow Memory API — run history, trace details, and sharing.

Routes are mounted at /api/workflow-runs by router.py.
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Run list for a specific workflow ─────────────────────────────────────────

@router.get("/by-workflow/{workflow_id}")
async def get_workflow_runs(
    workflow_id: str,
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """List run history for a specific workflow (owner only)."""
    result = (
        await db.from_("ss_workflow_runs")
        .select("id, workflow_id, status, input, tokens_used, started_at, completed_at, is_shared")
        .eq("workflow_id", workflow_id)
        .eq("user_id", current_user["id"])
        .order("started_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return result.data or []


# ── All runs across all workflows (for knowledge base) ──────────────────────

@router.get("/all")
async def get_all_runs(
    limit: int = 30,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """List all run records for the current user across all workflows."""
    # Fetch runs
    runs_result = (
        await db.from_("ss_workflow_runs")
        .select("id, workflow_id, status, input, tokens_used, started_at, completed_at, is_shared")
        .eq("user_id", current_user["id"])
        .order("started_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    runs = runs_result.data or []
    if not runs:
        return []

    # Batch-fetch workflow names
    wf_ids = list({r["workflow_id"] for r in runs})
    wf_result = (
        await db.from_("ss_workflows")
        .select("id, name")
        .in_("id", wf_ids)
        .execute()
    )
    wf_name_map = {w["id"]: w["name"] for w in (wf_result.data or [])}

    for run in runs:
        run["workflow_name"] = wf_name_map.get(run["workflow_id"], "未知工作流")

    return runs


# ── Single run detail + traces (authenticated) ──────────────────────────────

@router.get("/{run_id}")
async def get_run_detail(
    run_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """Get a single run's detail with all node traces (owner only)."""
    run = (
        await db.from_("ss_workflow_runs")
        .select("*")
        .eq("id", run_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not run.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "运行记录不存在")

    # Fetch workflow name + canvas data for memory canvas view
    wf = (
        await db.from_("ss_workflows")
        .select("name, nodes_json, edges_json")
        .eq("id", run.data["workflow_id"])
        .maybe_single()
        .execute()
    )

    traces = (
        await db.from_("ss_workflow_run_traces")
        .select("*")
        .eq("run_id", run_id)
        .order("execution_order")
        .execute()
    )

    return {
        **run.data,
        "workflow_name": wf.data["name"] if wf.data else "未知工作流",
        "nodes_json": wf.data.get("nodes_json", []) if wf.data else [],
        "edges_json": wf.data.get("edges_json", []) if wf.data else [],
        "traces": traces.data or [],
    }


# ── Public run detail (no auth required, only shared runs) ───────────────────

@router.get("/{run_id}/public")
async def get_public_run(
    run_id: str,
    optional_user: dict | None = Depends(get_optional_user),
    db: AsyncClient = Depends(get_db),
):
    """Public access to a shared run. If the run is not shared, returns 404."""
    # First try: if user is the owner, allow access regardless of sharing
    if optional_user:
        owner_run = (
            await db.from_("ss_workflow_runs")
            .select("id, workflow_id, input, status, tokens_used, started_at, completed_at, is_shared")
            .eq("id", run_id)
            .eq("user_id", optional_user["id"])
            .maybe_single()
            .execute()
        )
        if owner_run.data:
            return await _build_public_run_response(db, owner_run.data, run_id)

    # Fallback: check if shared
    run = (
        await db.from_("ss_workflow_runs")
        .select("id, workflow_id, input, status, tokens_used, started_at, completed_at, is_shared")
        .eq("id", run_id)
        .eq("is_shared", True)
        .maybe_single()
        .execute()
    )
    if not run.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "运行记录不存在或未公开分享")

    return await _build_public_run_response(db, run.data, run_id)


async def _build_public_run_response(db: AsyncClient, run_data: dict, run_id: str) -> dict:
    """Build the full public run response with workflow name, canvas data, and traces."""
    wf = (
        await db.from_("ss_workflows")
        .select("name, nodes_json, edges_json")
        .eq("id", run_data["workflow_id"])
        .maybe_single()
        .execute()
    )
    traces = (
        await db.from_("ss_workflow_run_traces")
        .select(
            "id, node_id, node_type, node_name, category, execution_order, "
            "status, input_snapshot, final_output, output_format, duration_ms, "
            "model_route, is_parallel, parallel_group_id, error_message"
        )
        .eq("run_id", run_id)
        .order("execution_order")
        .execute()
    )
    return {
        **run_data,
        "workflow_name": wf.data["name"] if wf.data else "未知工作流",
        "nodes_json": wf.data.get("nodes_json", []) if wf.data else [],
        "edges_json": wf.data.get("edges_json", []) if wf.data else [],
        "traces": traces.data or [],
    }


# ── Toggle sharing ───────────────────────────────────────────────────────────

@router.post("/{run_id}/share")
async def toggle_run_share(
    run_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_db),
):
    """Toggle the sharing state of a run record (owner only)."""
    run = (
        await db.from_("ss_workflow_runs")
        .select("id, is_shared")
        .eq("id", run_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not run.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "运行记录不存在")

    new_shared = not run.data.get("is_shared", False)
    update: dict = {
        "is_shared": new_shared,
        "shared_at": datetime.now(timezone.utc).isoformat() if new_shared else None,
    }

    await db.from_("ss_workflow_runs").update(update).eq("id", run_id).execute()
    return {"is_shared": new_shared, "run_id": run_id}
