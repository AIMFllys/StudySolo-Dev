"""YAML configuration loader with environment variable substitution.

Usage:
    from app.core.config_loader import get_config
    cfg = get_config()
    platform = cfg["platforms"]["dashscope"]
"""

import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

_CONFIG_PATH = Path(__file__).parent.parent.parent / "config.yaml"
_ENV_VAR_RE = re.compile(r"^\$([A-Z_][A-Z0-9_]*)$")


def _resolve_env_vars(value: Any) -> Any:
    """Recursively replace $ENV_VAR references with their environment values."""
    if isinstance(value, str):
        m = _ENV_VAR_RE.match(value)
        if m:
            return os.environ.get(m.group(1), value)
        return value
    if isinstance(value, dict):
        return {k: _resolve_env_vars(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_resolve_env_vars(item) for item in value]
    return value


@lru_cache(maxsize=1)
def get_config() -> dict:
    """Load config.yaml once per process lifetime and resolve env vars."""
    with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    return _resolve_env_vars(raw)
