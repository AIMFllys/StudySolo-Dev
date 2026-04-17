"""Shared plumbing: error-to-exit mapping + rich console."""

from __future__ import annotations

import asyncio
from typing import Awaitable, TypeVar

import typer
from rich.console import Console

from studysolo_cli.client import ApiClient, ApiError
from studysolo_cli.config import load_config

console = Console()
err_console = Console(stderr=True)

T = TypeVar("T")


def require_client() -> ApiClient:
    cfg = load_config()
    if not cfg.token:
        err_console.print(
            "[red]未登录[/red]：请先运行 [bold]studysolo login[/bold] 或设置 "
            "环境变量 STUDYSOLO_TOKEN。"
        )
        raise typer.Exit(code=2)
    return ApiClient(cfg)


def run_async(coro: Awaitable[T]) -> T:
    """``asyncio.run`` with user-facing error → exit-code mapping."""
    try:
        return asyncio.run(coro)
    except ApiError as exc:
        if exc.status in (401, 403):
            err_console.print(f"[red]认证失败（{exc.status}）：{exc.message}[/red]")
            raise typer.Exit(code=2) from exc
        err_console.print(f"[red]请求失败（{exc.status}）：{exc.message}[/red]")
        raise typer.Exit(code=1) from exc
