"""`studysolo wf run <id>` — start a workflow and wait for completion.

Two output modes (mutually exclusive):

- ``--stream`` (default): short-interval polling (0.5s) over
  ``/api/workflow-runs/{id}/events`` to simulate real-time node events.
- ``--poll --interval N``: print aggregated progress every ``N`` seconds
  and finally the terminal output.
"""

from __future__ import annotations

import asyncio
import json

import typer
from rich.panel import Panel
from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TextColumn,
    TimeElapsedColumn,
)

from studysolo_cli.client import ApiError
from studysolo_cli.commands._common import console, err_console, require_client, run_async


def run_workflow(
    workflow_id: str = typer.Argument(..., help="工作流 ID（完整 UUID）"),
    stream: bool = typer.Option(False, "--stream", help="实时打印节点事件（默认开启，若同时指定 --poll 则生效 poll）"),
    poll: bool = typer.Option(False, "--poll", help="定时打印聚合进度，等待终态"),
    interval: float = typer.Option(
        3.0, "--interval", min=0.5, max=60.0, help="轮询间隔秒数（--poll 时生效）"
    ),
    timeout: float = typer.Option(
        600.0, "--timeout", min=5.0, help="等待终态的最大秒数"
    ),
) -> None:
    """启动工作流并等待完成。"""
    if stream and poll:
        err_console.print("[red]--stream 与 --poll 互斥，只能二选一。[/red]")
        raise typer.Exit(code=1)
    if not stream and not poll:
        stream = True  # default

    async def _run() -> None:
        client = require_client()
        started = await client.post(f"/api/workflow/{workflow_id}/runs")
        run_id = started.get("run_id")
        if not run_id:
            err_console.print("[red]后端未返回 run_id。[/red]")
            raise typer.Exit(code=1)

        console.print(f"[green]已创建 Run[/green] · run_id={run_id}")
        if stream:
            exit_code = await _stream_events(client, run_id, timeout)
        else:
            exit_code = await _poll_progress(client, run_id, interval, timeout)
        if exit_code != 0:
            raise typer.Exit(code=exit_code)

    run_async(_run())


async def _stream_events(client, run_id: str, timeout: float) -> int:
    """Tail events every 500ms and print each new frame."""
    after_seq = 0
    deadline = asyncio.get_event_loop().time() + timeout
    terminal_status: str | None = None

    try:
        while True:
            if asyncio.get_event_loop().time() > deadline:
                err_console.print("[red]等待超时。[/red]")
                return 3
            batch = await client.get(
                f"/api/workflow-runs/{run_id}/events",
                params={"after_seq": after_seq, "limit": 200},
            )
            for ev in batch.get("events") or []:
                _print_event(ev)
                after_seq = max(after_seq, int(ev.get("seq") or 0))
            if batch.get("is_terminal"):
                terminal_status = batch.get("run_status")
                break
            await asyncio.sleep(0.5)
    except KeyboardInterrupt:
        err_console.print("[yellow]已取消监听（后台运行仍在继续）。[/yellow]")
        return 0

    console.print(
        f"[bold]完成[/bold] · status=[{'green' if terminal_status == 'completed' else 'red'}]"
        f"{terminal_status}[/]"
    )
    return 0 if terminal_status == "completed" else 3


async def _poll_progress(client, run_id: str, interval: float, timeout: float) -> int:
    """Print a summary line every ``interval`` seconds until terminal."""
    deadline = asyncio.get_event_loop().time() + timeout
    terminal_status: str | None = None

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("{task.completed}/{task.total} 节点"),
        TimeElapsedColumn(),
        console=console,
        transient=False,
    ) as progress:
        task_id = progress.add_task("初始化…", total=1, completed=0)
        while True:
            if asyncio.get_event_loop().time() > deadline:
                err_console.print("[red]等待超时。[/red]")
                return 3
            try:
                snap = await client.get(f"/api/workflow-runs/{run_id}/progress")
            except ApiError as exc:
                err_console.print(f"[red]progress 请求失败：{exc.message}[/red]")
                return 1

            total = int(snap.get("total_nodes") or 1)
            done = int(snap.get("done_nodes") or 0)
            phase = snap.get("phase") or snap.get("status") or "running"
            current = snap.get("current_node_label") or snap.get("current_node_id") or "…"
            progress.update(
                task_id,
                description=f"[cyan]{phase}[/cyan] · {current}",
                total=total,
                completed=done,
            )
            if snap.get("status") in {"completed", "failed"}:
                terminal_status = snap.get("status")
                break
            await asyncio.sleep(interval)

    # Fetch the final workflow_done payload for terminal output.
    events = await client.get(
        f"/api/workflow-runs/{run_id}/events",
        params={"after_seq": 0, "limit": 1000},
    )
    final = next(
        (
            e for e in (events.get("events") or [])
            if e.get("event_type") == "workflow_done"
        ),
        None,
    )
    if final is not None:
        console.print(Panel(
            json.dumps(final.get("payload") or {}, ensure_ascii=False, indent=2),
            title="workflow_done",
            border_style="green" if terminal_status == "completed" else "red",
        ))
    return 0 if terminal_status == "completed" else 3


def _print_event(ev: dict) -> None:
    seq = ev.get("seq")
    etype = ev.get("event_type")
    payload = ev.get("payload") or {}
    color = {
        "workflow_status": "cyan",
        "node_input": "yellow",
        "node_status": "magenta",
        "node_done": "green",
        "workflow_done": "bold green",
    }.get(etype, "white")
    brief = payload.get("phase") or payload.get("status") or payload.get("node_id") or ""
    summary = payload.get("node_label") or payload.get("message") or payload.get("error") or ""
    console.print(
        f"[dim]#{seq}[/dim] [{color}]{etype}[/{color}]"
        + (f"  {brief}" if brief else "")
        + (f"  · {summary}" if summary else "")
    )
