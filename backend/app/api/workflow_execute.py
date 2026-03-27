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
from app.models.workflow import WorkflowExecuteRequest
from app.services.ai_catalog_service import get_sku_by_id, is_tier_allowed
from app.services.usage_ledger import bind_usage_request, create_usage_request, finalize_usage_request

logger = logging.getLogger(__name__)

router = APIRouter()


def _resolve_requested_graph(
    workflow: dict,
    body: WorkflowExecuteRequest | None,
) -> tuple[list[dict], list[dict]]:
    if body is None or (body.nodes_json is None and body.edges_json is None):
        return workflow.get("nodes_json") or [], workflow.get("edges_json") or []

    if body.nodes_json is None or body.edges_json is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="nodes_json 和 edges_json 必须同时提供，不能只提交半张图",
        )

    return body.nodes_json, body.edges_json


async def _execute_workflow_sse_impl(
    workflow_id: str,
    body: WorkflowExecuteRequest | None,
    current_user: dict,
    db: AsyncClient,
    service_db: AsyncClient,
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
    nodes, edges = _resolve_requested_graph(workflow, body)
    user_id = current_user["id"]
    user_tier = current_user.get("tier", "free")
    workflow_input = next(
        (
            (node.get("data") or {}).get("user_content")
            or (node.get("data") or {}).get("label")
            for node in nodes
            if node.get("type") == "trigger_input"
        ),
        None,
    )
    implicit_context = {
        "user_id": user_id,
        "workflow_id": workflow_id,
    }

    # Tier enforcement: validate all AI node model selections before execution.
    # Prevents bypassing the frontend greyed-out PRO badge to run premium models.
    for _node in nodes:
        _nd = _node.get("data", {})
        _mr = _nd.get("model_route") or (_nd.get("config") or {}).get("model_route")
        if not _mr:
            continue
        _sku = await get_sku_by_id(_mr)
        if _sku and not is_tier_allowed(user_tier, _sku.required_tier):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "MODEL_TIER_FORBIDDEN",
                    "message": (
                        f"节点使用了当前会员等级（{user_tier}）无权访问的模型："
                        f"{_sku.display_name}，请升级会员后再执行"
                    ),
                    "model": _sku.model_id,
                    "required_tier": _sku.required_tier,
                    "current_tier": user_tier,
                },
            )

    # INSERT a workflow run record with status='running'
    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc).isoformat()
    workflow_run_ref: str | None = run_id
    try:
        await service_db.from_("ss_workflow_runs").insert({
            "id": run_id,
            "workflow_id": workflow_id,
            "user_id": user_id,
            "input": workflow_input,
            "status": "running",
            "started_at": started_at,
        }).execute()
        implicit_context["workflow_run_id"] = run_id
    except Exception as e:
        workflow_run_ref = None
        logger.error("Failed to insert ss_workflow_runs record: %s", e)

    usage_request = await create_usage_request(
        user_id=user_id,
        source_type="workflow",
        source_subtype="workflow_execute",
        workflow_id=workflow_id,
        workflow_run_id=workflow_run_ref,
    )

    async def _save_results(wf_id: str, updated_nodes: list[dict]) -> None:
        await db.from_("ss_workflows").update(
            {"nodes_json": updated_nodes}
        ).eq("id", wf_id).eq("user_id", user_id).execute()

    async def event_generator():
        total_tokens = 0
        final_output: dict | None = None
        run_status = "completed"
        with bind_usage_request(usage_request):
            try:
                async for event in execute_workflow(
                    workflow_id,
                    nodes,
                    edges,
                    implicit_context=implicit_context,
                    save_callback=_save_results,
                ):
                    yield event
                    try:
                        if evt := _parse_sse_data(event):
                            if event.startswith("event: workflow_done"):
                                if evt.get("status") != "completed":
                                    run_status = "failed"
                                final_output = evt
                    except Exception:
                        pass
            except Exception as e:
                logger.error("Workflow execution error for run %s: %s", run_id, e)
                run_status = "failed"
            finally:
                await finalize_usage_request(usage_request.request_id, run_status)

        total_tokens = await _load_request_total_tokens(service_db, usage_request.request_id)
        if workflow_run_ref:
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


@router.get("/{workflow_id}/execute")
async def execute_workflow_sse(
    workflow_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
    service_db: AsyncClient = Depends(get_db),
):
    """Deprecated GET execute endpoint kept for older clients."""
    return await _execute_workflow_sse_impl(
        workflow_id=workflow_id,
        body=None,
        current_user=current_user,
        db=db,
        service_db=service_db,
    )


@router.post("/{workflow_id}/execute")
async def execute_workflow_sse_post(
    workflow_id: str,
    body: WorkflowExecuteRequest | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
    service_db: AsyncClient = Depends(get_db),
):
    """POST SSE endpoint that accepts an optional in-memory workflow graph."""
    return await _execute_workflow_sse_impl(
        workflow_id=workflow_id,
        body=body,
        current_user=current_user,
        db=db,
        service_db=service_db,
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
    except Exception as e:
        logger.error("Failed to update ss_workflow_runs record %s: %s", run_id, e)


def _parse_sse_data(event: str) -> dict | None:
    payload_line = next((line for line in event.strip().split("\n") if line.startswith("data: ")), None)
    if not payload_line:
        return None
    return json.loads(payload_line[6:])


async def _load_request_total_tokens(db: AsyncClient, request_id: str) -> int:
    result = (
        await db.from_("ss_ai_usage_events")
        .select("total_tokens")
        .eq("request_id", request_id)
        .eq("status", "success")
        .execute()
    )
    return sum(int(row.get("total_tokens") or 0) for row in (result.data or []))


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
