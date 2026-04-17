"""`studysolo wf <sub>` — inspect workflows and run them."""

from __future__ import annotations

import typer
from rich.table import Table
from rich.tree import Tree

from studysolo_cli.commands._common import console, require_client, run_async
from studysolo_cli.commands.run import run_workflow  # re-exported below

wf_app = typer.Typer(no_args_is_help=True, help="查看与触发工作流。")


@wf_app.command("list")
def list_workflows() -> None:
    """列出当前用户的所有工作流。"""

    async def _run() -> None:
        client = require_client()
        data = await client.get("/api/workflow")
        rows = data if isinstance(data, list) else data.get("items", [])
        if not rows:
            console.print("[dim]暂无工作流[/dim]")
            return
        table = Table(title="Workflows", show_header=True, header_style="bold cyan")
        table.add_column("id", style="dim")
        table.add_column("name")
        table.add_column("updated_at", style="dim")
        table.add_column("nodes")
        for row in rows:
            node_count = len(row.get("nodes_json") or []) if isinstance(row.get("nodes_json"), list) else row.get("node_count", "")
            table.add_row(
                str(row.get("id", ""))[:8] + "…",
                str(row.get("name", "")),
                str(row.get("updated_at", ""))[:19],
                str(node_count),
            )
        console.print(table)

    run_async(_run())


@wf_app.command("show")
def show_workflow(
    workflow_id: str = typer.Argument(..., help="工作流 ID（完整 UUID）"),
    raw: bool = typer.Option(False, "--raw", help="输出原始 JSON 而非树形视图"),
) -> None:
    """查看工作流的画布节点元信息。"""

    async def _run() -> None:
        client = require_client()
        data = await client.get(f"/api/workflow/{workflow_id}/content")
        if raw:
            console.print_json(data=data)
            return
        nodes = data.get("nodes_json") or []
        edges = data.get("edges_json") or []
        tree = Tree(f"[bold]{data.get('name', workflow_id)}[/bold] ({len(nodes)} 节点 · {len(edges)} 边)")
        for node in nodes:
            label = (node.get("data") or {}).get("label") or node.get("id", "")
            ntype = node.get("type", "unknown")
            tree.add(f"[cyan]{ntype}[/cyan] · {label} [dim]({node.get('id', '')[:8]}…)[/dim]")
        console.print(tree)

    run_async(_run())


@wf_app.command("manifest")
def manifest() -> None:
    """查看节点类型清单。"""

    async def _run() -> None:
        client = require_client()
        data = await client.get("/api/nodes/manifest")
        items = data.get("nodes") if isinstance(data, dict) else data
        if not items:
            console.print("[dim]节点清单为空[/dim]")
            return
        table = Table(title="Node Manifest", show_header=True, header_style="bold cyan")
        table.add_column("type")
        table.add_column("category")
        table.add_column("label")
        table.add_column("required_tier")
        for node in items:
            table.add_row(
                str(node.get("type", "")),
                str(node.get("category", "")),
                str(node.get("label", "")),
                str(node.get("required_tier", "")),
            )
        console.print(table)

    run_async(_run())


wf_app.command("run")(run_workflow)
