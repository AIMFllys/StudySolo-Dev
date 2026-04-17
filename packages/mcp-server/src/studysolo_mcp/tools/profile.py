"""Profile + quota tools (`get_me`, `get_quota`)."""

from __future__ import annotations

from typing import Any

from mcp.types import Tool

from studysolo_mcp.client import ApiClient


TOOLS: list[Tool] = [
    Tool(
        name="get_me",
        description=(
            "获取当前 StudySolo 账户的基本信息，包括 id、email、姓名、系统 role 和会员 tier。"
            "用于回答「我是谁」「我的账号是什么」「我是什么会员」等问题。"
        ),
        inputSchema={
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    ),
    Tool(
        name="get_quota",
        description=(
            "查看当前会员的额度：可创建的工作流上限、已使用数量，以及每日工作流执行配额。"
            "当用户问「我还能跑几次工作流」「我的会员还剩多少额度」时调用。"
        ),
        inputSchema={
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        },
    ),
]


async def get_me(client: ApiClient, _args: dict[str, Any]) -> Any:
    return await client.get("/api/auth/me")


async def get_quota(client: ApiClient, _args: dict[str, Any]) -> Any:
    return await client.get("/api/usage/quota")
