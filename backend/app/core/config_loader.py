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
_ENV_FILE_PATH = Path(__file__).parent.parent.parent / ".env"
_ENV_VAR_RE = re.compile(r"^\$([A-Z_][A-Z0-9_]*(?:\|[A-Z_][A-Z0-9_]*)*)$")

# Load .env file values as a fallback lookup dict.
# pydantic-settings loads .env into its own Settings object but does NOT
# inject values into os.environ, so config.yaml $VAR references fail.
_dotenv_cache: dict[str, str] | None = None


def _load_dotenv() -> dict[str, str]:
    """Parse the .env file into a dict (no external dependency needed)."""
    global _dotenv_cache
    if _dotenv_cache is not None:
        return _dotenv_cache

    env_vars: dict[str, str] = {}
    if _ENV_FILE_PATH.is_file():
        with open(_ENV_FILE_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip()
                # Strip surrounding quotes if present
                if len(val) >= 2 and val[0] == val[-1] and val[0] in ('"', "'"):
                    val = val[1:-1]
                env_vars[key] = val
    _dotenv_cache = env_vars
    return env_vars


def _resolve_env_vars(value: Any) -> Any:
    """Recursively replace $ENV_VAR references with their environment values.

    Lookup order: os.environ (real env) → .env file (dotenv fallback).
    """
    if isinstance(value, str):
        m = _ENV_VAR_RE.match(value)
        if m:
            candidate_names = [name.strip() for name in m.group(1).split("|") if name.strip()]
            # 1) Check real environment first
            for var_name in candidate_names:
                env_val = os.environ.get(var_name)
                if env_val is not None:
                    return env_val
            # 2) Fallback to .env file
            dotenv = _load_dotenv()
            for var_name in candidate_names:
                env_val = dotenv.get(var_name)
                if env_val is not None:
                    return env_val
            return value
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
