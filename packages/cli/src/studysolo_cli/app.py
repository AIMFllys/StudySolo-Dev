"""Typer application assembly.

Command tree:

    studysolo
    ├── login / logout
    ├── me
    ├── quota
    ├── usage
    │   ├── overview
    │   ├── timeseries
    │   └── live
    └── wf
        ├── list
        ├── show
        ├── manifest
        └── run
"""

from __future__ import annotations

import typer

from studysolo_cli import __version__
from studysolo_cli.auth import login, logout
from studysolo_cli.commands import me as me_cmd
from studysolo_cli.commands.usage import usage_app
from studysolo_cli.commands.workflow import wf_app

app = typer.Typer(
    name="studysolo",
    help="StudySolo command-line client.",
    no_args_is_help=True,
    add_completion=False,
)


@app.callback()
def _root(
    version: bool = typer.Option(
        False, "--version", "-v", help="显示版本并退出。", is_flag=True
    ),
) -> None:
    if version:
        typer.echo(f"studysolo-cli {__version__}")
        raise typer.Exit()


# Flat convenience commands.
app.command("login", help="登录：保存 PAT 到本地配置。")(login)
app.command("logout", help="登出：清除本机保存的 PAT。")(logout)
app.command("me", help="查看账户基本信息。")(me_cmd.me)
app.command("quota", help="查看会员额度与剩余执行次数。")(me_cmd.quota)

# Sub-apps.
app.add_typer(usage_app, name="usage", help="查看 AI 调用与执行数据。")
app.add_typer(wf_app, name="wf", help="查看与触发工作流。")


__all__ = ["app"]
