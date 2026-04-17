"""Service layer for queuing workflow background runs.

Extracted from ``api/workflow/execute.py:start_workflow_run`` so that the
agent-loop tools (``tools/start_workflow_background.py``) can kick off a run
without going through the HTTP handler and its FastAPI dependencies.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from supabase import AsyncClient

from app.engine.run_worker import run_to_db
from app.engine.run_worker import summarise_progress
from app.services.quota_service import check_daily_execution_quota

logger = logging.getLogger(__name__)

WF_EXEC_RATE_LIMIT = 20
WF_EXEC_WINDOW_SECONDS = 60


class StartRunError(Exception):
    """Raised when a run cannot be queued. ``code`` is machine-readable."""

    def __init__(self, message: str, *, code: str = "start_run_failed", detail: dict | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.detail = detail or {}


async def start_run(
    *,
    user: dict,
    workflow_id: str,
    db: AsyncClient,
    service_db: AsyncClient,
    enforce_rate_limit: bool = True,
) -> dict:
    """Queue a workflow for background execution and return run metadata.

    Returns a dict with: ``run_id``, ``workflow_id``, ``status``,
    ``started_at``, ``progress_url``, ``events_url``.
    """
    from app.api.auth._helpers import is_rate_limited, record_rate_limit_failure

    user_id = user["id"]
    user_tier = user.get("tier", "free")

    if enforce_rate_limit:
        bucket = f"wf_exec:{user_id}"
        event_type = "workflow_execute"
        if await is_rate_limited(
            service_db, bucket, event_type, WF_EXEC_RATE_LIMIT, WF_EXEC_WINDOW_SECONDS,
        ):
            raise StartRunError(
                "工作流触发过于频繁，请稍后再试",
                code="rate_limited",
            )
        await record_rate_limit_failure(service_db, bucket, event_type, WF_EXEC_WINDOW_SECONDS)

    exec_quota = await check_daily_execution_quota(user_id, user_tier, service_db)
    if not exec_quota["allowed"]:
        raise StartRunError(
            f"今日工作流执行次数已达上限（{exec_quota['used']}/{exec_quota['limit']}），明日重置或升级会员",
            code="quota_exceeded",
            detail={"used": exec_quota["used"], "limit": exec_quota["limit"]},
        )

    wf_result = (
        await db.from_("ss_workflows")
        .select("id,name")
        .eq("id", workflow_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not wf_result or not wf_result.data:
        raise StartRunError("工作流不存在", code="workflow_not_found")

    run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc).isoformat()
    try:
        await (
            service_db.from_("ss_workflow_runs")
            .insert(
                {
                    "id": run_id,
                    "workflow_id": workflow_id,
                    "user_id": user_id,
                    "input": None,
                    "status": "queued",
                    "started_at": started_at,
                }
            )
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to create ss_workflow_runs row: %s", exc)
        raise StartRunError("创建工作流运行记录失败，请稍后重试", code="db_insert_failed") from exc

    asyncio.create_task(
        run_to_db(
            run_id=run_id,
            workflow_id=workflow_id,
            user_id=user_id,
            user_tier=user_tier,
        )
    )

    return {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": "queued",
        "started_at": started_at,
        "progress_url": f"/api/workflow-runs/{run_id}/progress",
        "events_url": f"/api/workflow-runs/{run_id}/events",
        "workflow_name": (wf_result.data or {}).get("name"),
    }


async def get_run_status(
    *,
    run_id: str,
    user: dict,
    service_db: AsyncClient,
) -> dict:
    """Return the latest status snapshot for a workflow run.

    Includes the compact progress fields used by ``/api/workflow-runs/{run_id}/progress``
    so agent answers can report real completion counts instead of only a bare status.
    """
    user_id = user["id"]
    result = (
        await service_db.from_("ss_workflow_runs")
        .select("id,workflow_id,user_id,status,started_at,completed_at,tokens_used")
        .eq("id", run_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not result or not result.data:
        raise StartRunError("工作流运行记录不存在", code="run_not_found")
    data = result.data
    progress = await summarise_progress(service_db, run_id)
    progress["started_at"] = data.get("started_at")
    progress["completed_at"] = data.get("completed_at")
    progress["tokens_used"] = data.get("tokens_used")

    if data.get("status") == "failed":
        done_event = (
            await service_db.from_("ss_workflow_run_events")
            .select("payload")
            .eq("run_id", run_id)
            .eq("event_type", "workflow_done")
            .order("seq", desc=True)
            .limit(1)
            .maybe_single()
            .execute()
        )
        payload = (done_event.data or {}).get("payload") if done_event else None
        error = payload.get("error") if isinstance(payload, dict) else None
        if error:
            progress["error"] = error

    return progress
