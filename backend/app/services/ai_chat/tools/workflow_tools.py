"""Workflow-level tools: list / open / rename (single + batch)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from .base import ToolContext, ToolResult, UIEffect, register

logger = logging.getLogger(__name__)


# ── list_workflows ───────────────────────────────────────────────────────

@register(
    name="list_workflows",
    description="列出当前用户的工作流（返回 id/name/更新时间/节点数），用于提供给 LLM 选择目标。",
    params_schema={
        "type": "object",
        "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 100}},
    },
)
async def list_workflows_tool(ctx: ToolContext, params: dict[str, Any]) -> ToolResult:
    limit = int(params.get("limit") or 50)
    limit = max(1, min(100, limit))
    try:
        result = (
            await ctx.db.from_("ss_workflows")
            .select("id,name,description,updated_at,nodes_json")
            .eq("user_id", ctx.user["id"])
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = result.data or []
        items = [
            {
                "id": r["id"],
                "name": r.get("name") or "未命名",
                "description": r.get("description") or "",
                "updated_at": r.get("updated_at"),
                "node_count": len(r.get("nodes_json") or []),
            }
            for r in rows
        ]
        return ToolResult(ok=True, data={"items": items, "count": len(items)})
    except Exception as exc:  # noqa: BLE001
        logger.exception("list_workflows failed: %s", exc)
        return ToolResult(ok=False, error=f"查询工作流失败: {exc}")


# ── open_workflow ────────────────────────────────────────────────────────

@register(
    name="open_workflow",
    description="在前端打开指定工作流（router push /c/{id}）。不修改数据库，只下发 UI 事件。",
    params_schema={
        "type": "object",
        "required": ["id"],
        "properties": {"id": {"type": "string"}},
    },
)
async def open_workflow_tool(ctx: ToolContext, params: dict[str, Any]) -> ToolResult:
    wf_id = str(params.get("id") or "").strip()
    if not wf_id:
        return ToolResult(ok=False, error="缺少参数 id")
    result = (
        await ctx.db.from_("ss_workflows")
        .select("id,name")
        .eq("id", wf_id)
        .eq("user_id", ctx.user["id"])
        .maybe_single()
        .execute()
    )
    if not result or not result.data:
        return ToolResult(ok=False, error=f"找不到工作流 {wf_id}")
    row = result.data
    return ToolResult(
        ok=True,
        data={"id": row["id"], "name": row.get("name") or "未命名"},
        ui_effect=UIEffect(type="router_push", url=f"/c/{row['id']}"),
    )


# ── rename_workflow (single) ─────────────────────────────────────────────

@register(
    name="rename_workflow",
    description="重命名单个工作流。",
    params_schema={
        "type": "object",
        "required": ["id", "new_name"],
        "properties": {
            "id": {"type": "string"},
            "new_name": {"type": "string", "minLength": 1, "maxLength": 120},
        },
    },
)
async def rename_workflow_tool(ctx: ToolContext, params: dict[str, Any]) -> ToolResult:
    wf_id = str(params.get("id") or "").strip()
    new_name = str(params.get("new_name") or "").strip()
    if not wf_id or not new_name:
        return ToolResult(ok=False, error="id 和 new_name 均为必填")
    if len(new_name) > 120:
        return ToolResult(ok=False, error="新名称最多 120 字符")
    try:
        result = (
            await ctx.db.from_("ss_workflows")
            .update({"name": new_name})
            .eq("id", wf_id)
            .eq("user_id", ctx.user["id"])
            .execute()
        )
        if result.data is not None and len(result.data) == 0:
            return ToolResult(ok=False, error=f"找不到工作流 {wf_id}")
        return ToolResult(
            ok=True,
            data={"id": wf_id, "new_name": new_name},
            ui_effect=UIEffect(type="router_refresh"),
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("rename_workflow failed: %s", exc)
        return ToolResult(ok=False, error=f"重命名失败: {exc}")


# ── batch_rename_workflows ───────────────────────────────────────────────

@register(
    name="batch_rename_workflows",
    description="批量重命名工作流。items 为 [{id, new_name}] 数组，并发执行。",
    params_schema={
        "type": "object",
        "required": ["items"],
        "properties": {
            "items": {
                "type": "array",
                "minItems": 1,
                "items": {
                    "type": "object",
                    "required": ["id", "new_name"],
                    "properties": {
                        "id": {"type": "string"},
                        "new_name": {"type": "string", "minLength": 1, "maxLength": 120},
                    },
                },
            }
        },
    },
)
async def batch_rename_workflows_tool(ctx: ToolContext, params: dict[str, Any]) -> ToolResult:
    items = params.get("items") or []
    if not isinstance(items, list) or not items:
        return ToolResult(ok=False, error="items 必须是非空数组")
    valid: list[tuple[str, str]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        wid = str(item.get("id") or "").strip()
        new_name = str(item.get("new_name") or "").strip()
        if wid and new_name and len(new_name) <= 120:
            valid.append((wid, new_name))
    if not valid:
        return ToolResult(ok=False, error="没有合法的 {id,new_name} 条目")

    async def _rename(wid: str, new_name: str) -> dict[str, Any]:
        try:
            result = (
                await ctx.db.from_("ss_workflows")
                .update({"name": new_name})
                .eq("id", wid)
                .eq("user_id", ctx.user["id"])
                .execute()
            )
            if result.data is not None and len(result.data) == 0:
                return {"id": wid, "ok": False, "error": "not_found"}
            return {"id": wid, "ok": True, "new_name": new_name}
        except Exception as exc:  # noqa: BLE001
            return {"id": wid, "ok": False, "error": str(exc)}

    results = await asyncio.gather(*(_rename(wid, n) for wid, n in valid))
    ok_count = sum(1 for r in results if r.get("ok"))
    return ToolResult(
        ok=ok_count > 0,
        data={"total": len(results), "succeeded": ok_count, "results": results},
    )
