"""`studysolo login` / `studysolo logout` — PAT storage helpers."""

from __future__ import annotations

import asyncio

import typer
from rich import print as rprint
from rich.prompt import Prompt

from studysolo_cli.client import ApiClient, ApiError
from studysolo_cli.config import CliConfig, CONFIG_PATH, load_config, save_config


def login(
    token: str | None = typer.Option(
        None,
        "--token",
        help="直接传入 PAT（sk_studysolo_...）。留空则改为交互式粘贴。",
    ),
    api_base: str | None = typer.Option(
        None, "--api-base", help="后端地址，覆盖环境变量与 config.toml。"
    ),
) -> None:
    """保存 PAT 到 ~/.studysolo/config.toml。"""
    cfg = load_config()
    if api_base:
        cfg.api_base = api_base.rstrip("/")

    plaintext = token or Prompt.ask(
        "请粘贴 PAT",
        password=True,
    )
    plaintext = plaintext.strip()
    if not plaintext.startswith("sk_studysolo_"):
        rprint("[red]看起来不是一个有效的 PAT（应以 sk_studysolo_ 开头）。[/red]")
        raise typer.Exit(code=1)

    cfg.token = plaintext
    asyncio.run(_verify_and_save(cfg))


async def _verify_and_save(cfg: CliConfig) -> None:
    client = ApiClient(cfg)
    try:
        me = await client.get("/api/auth/me")
    except ApiError as exc:
        rprint(f"[red]登录校验失败（{exc.status}）：{exc.message}[/red]")
        raise typer.Exit(code=2) from exc
    path = save_config(cfg)
    email = me.get("email") if isinstance(me, dict) else ""
    tier = me.get("tier") if isinstance(me, dict) else ""
    rprint(
        f"[green]登录成功[/green] — {email or 'unknown'} · tier={tier or 'free'}"
    )
    rprint(f"[dim]PAT 已保存到 {path}[/dim]")


def logout() -> None:
    """清除本机保存的 PAT。"""
    cfg = load_config()
    cfg.token = None
    save_config(cfg)
    rprint(f"[green]已登出[/green]。{CONFIG_PATH} 中的 token 已清除。")
