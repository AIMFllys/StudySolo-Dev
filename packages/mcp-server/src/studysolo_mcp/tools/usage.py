"""Usage analytics tools."""

from __future__ import annotations

from typing import Any

from mcp.types import Tool

from studysolo_mcp.client import ApiClient


TOOLS: list[Tool] = [
    Tool(
        name="get_usage_overview",
        description=(
            "查看 AI 使用总览：指定时间窗口内的调用次数、Token 消耗与成功率。"
            "等同于左侧仪表盘的概览卡片。"
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "range": {
                    "type": "string",
                    "enum": ["24h", "7d"],
                    "default": "24h",
                    "description": "统计窗口：过去 24 小时或 7 天。",
                }
            },
            "additionalProperties": False,
        },
    ),
    Tool(
        name="get_usage_timeseries",
        description=(
            "按时间桶返回 AI 调用量，可按 source 过滤（例如 workflow / chat）。"
            "用于回答「最近用量趋势」「每天调用量」类问题。"
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "range": {
                    "type": "string",
                    "enum": ["24h", "7d"],
                    "default": "24h",
                },
                "source": {
                    "type": "string",
                    "default": "all",
                    "description": "过滤来源：all 或具体 source_type。",
                },
            },
            "additionalProperties": False,
        },
    ),
    Tool(
        name="get_usage_live",
        description=(
            "返回最近 N 分钟的实时调用窗口（默认 5 分钟），用于回答「刚刚有没有在跑」「现在 AI 是否在用」。"
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "window": {
                    "type": "string",
                    "default": "5m",
                    "description": "实时窗口长度，例如 '5m'。",
                }
            },
            "additionalProperties": False,
        },
    ),
]


async def get_usage_overview(client: ApiClient, args: dict[str, Any]) -> Any:
    return await client.get(
        "/api/usage/overview",
        params={"range": args.get("range", "24h")},
    )


async def get_usage_timeseries(client: ApiClient, args: dict[str, Any]) -> Any:
    return await client.get(
        "/api/usage/timeseries",
        params={
            "range": args.get("range", "24h"),
            "source": args.get("source", "all"),
        },
    )


async def get_usage_live(client: ApiClient, args: dict[str, Any]) -> Any:
    return await client.get(
        "/api/usage/live",
        params={"window": args.get("window", "5m")},
    )
