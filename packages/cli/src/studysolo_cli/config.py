"""Config loading + PAT storage for the StudySolo CLI.

Precedence (highest → lowest):
1. CLI flag ``--token``
2. Env var ``STUDYSOLO_TOKEN``
3. ``~/.studysolo/config.toml``

The same rule applies to ``api_base`` via ``STUDYSOLO_API_BASE``.
"""

from __future__ import annotations

import os
import stat
from dataclasses import dataclass
from pathlib import Path

try:  # py>=3.11
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    import tomli as tomllib  # type: ignore

try:
    import tomli_w
except ModuleNotFoundError:  # pragma: no cover
    tomli_w = None  # type: ignore

DEFAULT_API_BASE = "http://127.0.0.1:2038"
CONFIG_DIR = Path.home() / ".studysolo"
CONFIG_PATH = CONFIG_DIR / "config.toml"


@dataclass
class CliConfig:
    api_base: str = DEFAULT_API_BASE
    token: str | None = None


def load_config() -> CliConfig:
    """Load the persisted config, then layer env vars on top."""
    data: dict = {}
    if CONFIG_PATH.exists():
        try:
            data = tomllib.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except Exception:
            data = {}
    default = data.get("default", {}) if isinstance(data, dict) else {}

    api_base = (
        os.environ.get("STUDYSOLO_API_BASE")
        or default.get("api_base")
        or DEFAULT_API_BASE
    ).rstrip("/")
    token = os.environ.get("STUDYSOLO_TOKEN") or default.get("token") or None
    return CliConfig(api_base=api_base, token=token)


def save_config(cfg: CliConfig) -> Path:
    """Persist ``cfg`` to ``~/.studysolo/config.toml`` (mode 600 on POSIX)."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "default": {
            "api_base": cfg.api_base,
            **({"token": cfg.token} if cfg.token else {}),
        }
    }
    if tomli_w is not None:
        content = tomli_w.dumps(payload)
    else:
        # Fallback — extremely simple writer for our flat schema.
        lines = ["[default]"]
        for key, value in payload["default"].items():
            lines.append(f'{key} = "{value}"')
        content = "\n".join(lines) + "\n"

    CONFIG_PATH.write_text(content, encoding="utf-8")
    try:
        os.chmod(CONFIG_PATH, stat.S_IRUSR | stat.S_IWUSR)
    except OSError:
        # Windows chmod is a best-effort no-op; acceptable.
        pass
    return CONFIG_PATH
