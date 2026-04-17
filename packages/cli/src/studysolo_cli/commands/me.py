"""`studysolo me` + `studysolo quota`."""

from __future__ import annotations

import typer
from rich.panel import Panel
from rich.table import Table

from studysolo_cli.commands._common import console, require_client, run_async


def me() -> None:
    """查看当前账户的基本信息（邮箱、会员、到期时间）。"""

    async def _run() -> None:
        client = require_client()
        info = await client.get("/api/auth/me")
        table = Table.grid(padding=(0, 2))
        table.add_column(style="dim", justify="right")
        table.add_column(style="bold")
        table.add_row("ID", str(info.get("id", "")))
        table.add_row("Email", str(info.get("email", "")))
        table.add_row("Name", str(info.get("name") or ""))
        table.add_row("Role", str(info.get("role", "user")))
        table.add_row("Tier", str(info.get("tier", "free")))
        if info.get("tier_expires_at"):
            table.add_row("Tier 到期", str(info["tier_expires_at"]))
        console.print(Panel(table, title="StudySolo · Me", border_style="cyan"))

    run_async(_run())


def quota() -> None:
    """查看会员额度：每日执行次数、工作流总数等。"""

    async def _run() -> None:
        client = require_client()
        data = await client.get("/api/usage/quota")
        table = Table(title="StudySolo · Quota", show_header=True, header_style="bold cyan")
        table.add_column("项目")
        table.add_column("值")
        for key in (
            "tier",
            "workflows_limit",
            "workflows_used",
            "daily_executions_limit",
            "daily_executions_used",
            "daily_executions_remaining",
        ):
            if key in data:
                table.add_row(key, str(data[key]))
        for key, value in data.items():
            if key not in {
                "tier",
                "workflows_limit",
                "workflows_used",
                "daily_executions_limit",
                "daily_executions_used",
                "daily_executions_remaining",
            }:
                table.add_row(key, str(value))
        console.print(table)

    run_async(_run())


__all__ = ["me", "quota"]
