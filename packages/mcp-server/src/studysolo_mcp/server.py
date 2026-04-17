"""MCP Server wire-up — registers all tools and serves over stdio.

Design notes:
- The server is intentionally stateless except for a single shared ApiClient.
- Every tool returns a ``TextContent`` whose body is JSON (stable, easy for
  models to parse). Errors are returned with ``isError=True`` and an
  ``error`` object so tool callers get structured diagnostics.
- InputSchemas are written out by hand (not generated) because models rely
  on precise ``description`` fields to pick the right tool.
"""

from __future__ import annotations

import json
from typing import Any

import mcp.server.stdio
from mcp.server import NotificationOptions, Server
from mcp.server.models import InitializationOptions
from mcp.types import ServerCapabilities, TextContent, Tool

from studysolo_mcp import __version__
from studysolo_mcp.client import ApiClient, ApiError
from studysolo_mcp.config import load_config
from studysolo_mcp.tools import (
    profile,
    runs,
    usage,
    workflows,
)

SERVER_NAME = "studysolo"


def _jsonify(data: Any) -> str:
    """Serialize ``data`` to a compact, UTF-8 JSON string."""
    return json.dumps(data, ensure_ascii=False, indent=2)


def _ok(data: Any) -> list[TextContent]:
    return [TextContent(type="text", text=_jsonify(data))]


def _err(exc: ApiError) -> list[TextContent]:
    return [TextContent(type="text", text=_jsonify(exc.to_tool_payload()))]


async def serve() -> None:
    """Launch the stdio MCP server and block until stdin closes."""
    config = load_config()
    client = ApiClient(config)
    server: Server = Server(SERVER_NAME)

    @server.list_tools()
    async def handle_list_tools() -> list[Tool]:
        return [
            *profile.TOOLS,
            *usage.TOOLS,
            *workflows.TOOLS,
            *runs.TOOLS,
        ]

    @server.call_tool()
    async def handle_call_tool(
        name: str, arguments: dict[str, Any] | None
    ) -> list[TextContent]:
        args = arguments or {}
        try:
            handler = _dispatch(name)
            result = await handler(client, args)
        except ApiError as exc:
            return _err(exc)
        except ValueError as exc:
            # Validation error from a tool handler — structured, safe.
            return _err(ApiError(400, str(exc)))
        return _ok(result)

    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name=SERVER_NAME,
                server_version=__version__,
                capabilities=ServerCapabilities(tools={}),
            ),
        )


# ── Dispatch table ──────────────────────────────────────────────────────────

_HANDLERS = {
    # profile
    "get_me": profile.get_me,
    "get_quota": profile.get_quota,
    # usage
    "get_usage_overview": usage.get_usage_overview,
    "get_usage_timeseries": usage.get_usage_timeseries,
    "get_usage_live": usage.get_usage_live,
    # workflows
    "list_workflows": workflows.list_workflows,
    "get_workflow": workflows.get_workflow,
    "get_nodes_manifest": workflows.get_nodes_manifest,
    # runs
    "start_workflow_run": runs.start_workflow_run,
    "get_run_progress": runs.get_run_progress,
    "get_run_events": runs.get_run_events,
    "run_workflow_and_wait": runs.run_workflow_and_wait,
}


def _dispatch(name: str):
    handler = _HANDLERS.get(name)
    if handler is None:
        raise ApiError(404, f"未知工具：{name}")
    return handler
