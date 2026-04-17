"""Environment-driven config for the StudySolo MCP Server."""

from __future__ import annotations

import os
from dataclasses import dataclass


DEFAULT_API_BASE = "http://127.0.0.1:2038"


@dataclass(slots=True)
class ServerConfig:
    api_base: str
    token: str | None


def load_config() -> ServerConfig:
    """Read ``STUDYSOLO_API_BASE`` and ``STUDYSOLO_TOKEN`` from env."""
    api_base = (os.environ.get("STUDYSOLO_API_BASE") or DEFAULT_API_BASE).rstrip("/")
    token = os.environ.get("STUDYSOLO_TOKEN") or None
    return ServerConfig(api_base=api_base, token=token)
