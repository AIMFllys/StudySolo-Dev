"""Workflow metadata tools (read-only)."""

from __future__ import annotations

from typing import Any

from mcp.types import Tool

from studysolo_mcp.client import ApiClient


TOOLS: list[Tool] = [
    Tool(
        name="list_workflows",
        description=(
            "列出当前用户的所有工作流（仅元数据 + 最后更新时间）。"
            "用于回答「我有哪些工作流」。"
        ),
        inputSchema={
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    ),
    Tool(
        name="get_workflow",
        description=(
            "获取指定工作流的完整画布：节点 (nodes_json) 与连线 (edges_json)。"
            "用于分析图结构、检查节点配置，或在调用 start_workflow_run 之前确认 trigger_input 节点。"
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "workflow_id": {
                    "type": "string",
                    "description": "工作流 ID（完整 UUID）。",
                }
            },
            "required": ["workflow_id"],
            "additionalProperties": False,
        },
    ),
    Tool(
        name="get_nodes_manifest",
        description=(
            "返回所有注册节点类型的元信息：type、label、category、所需 tier。"
            "用于回答「系统有哪些节点可以用」。"
        ),
        inputSchema={
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    ),
]


async def list_workflows(client: ApiClient, _args: dict[str, Any]) -> Any:
    return await client.get("/api/workflow")


async def get_workflow(client: ApiClient, args: dict[str, Any]) -> Any:
    workflow_id = args.get("workflow_id")
    if not workflow_id:
        raise ValueError("workflow_id 为必填项")
    return await client.get(f"/api/workflow/{workflow_id}/content")


async def get_nodes_manifest(client: ApiClient, _args: dict[str, Any]) -> Any:
    return await client.get("/api/nodes/manifest")
