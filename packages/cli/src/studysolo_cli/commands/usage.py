"""`studysolo usage <sub>` — read-only views of /api/usage/*."""

from __future__ import annotations

import typer
from rich.table import Table

from studysolo_cli.commands._common import console, require_client, run_async

usage_app = typer.Typer(no_args_is_help=True, help="查看 AI 调用与工作流执行数据。")


RangeArg = typer.Option("24h", "--range", help="统计窗口：24h / 7d")
SourceArg = typer.Option("all", "--source", help="source 过滤器：all / workflow / chat / …")


@usage_app.command("overview")
def overview(range_: str = RangeArg) -> None:
    """调用总览：Token / 调用次数 / 成功率等。"""

    async def _run() -> None:
        client = require_client()
        data = await client.get("/api/usage/overview", params={"range": range_})
        _render_kv("Usage · Overview", data)

    run_async(_run())


@usage_app.command("timeseries")
def timeseries(range_: str = RangeArg, source: str = SourceArg) -> None:
    """按时间桶聚合的调用量。"""

    async def _run() -> None:
        client = require_client()
        data = await client.get(
            "/api/usage/timeseries", params={"range": range_, "source": source}
        )
        buckets = data.get("buckets") if isinstance(data, dict) else None
        if not buckets:
            console.print("[dim]该窗口内暂无数据[/dim]")
            return
        table = Table(title=f"Usage · Timeseries ({range_}, {source})", show_header=True)
        columns = list(buckets[0].keys())
        for col in columns:
            table.add_column(col, style="bold" if col == "t" else None)
        for row in buckets:
            table.add_row(*[str(row.get(col, "")) for col in columns])
        console.print(table)

    run_async(_run())


@usage_app.command("live")
def live(window: str = typer.Option("5m", "--window", help="实时窗口长度")) -> None:
    """最近 N 分钟的实时调用窗口。"""

    async def _run() -> None:
        client = require_client()
        data = await client.get("/api/usage/live", params={"window": window})
        _render_kv(f"Usage · Live ({window})", data)

    run_async(_run())


def _render_kv(title: str, data: dict) -> None:
    table = Table(title=title, show_header=True, header_style="bold cyan")
    table.add_column("key")
    table.add_column("value")
    for key, value in data.items():
        if isinstance(value, (dict, list)):
            import json

            table.add_row(str(key), json.dumps(value, ensure_ascii=False))
        else:
            table.add_row(str(key), str(value))
    console.print(table)
