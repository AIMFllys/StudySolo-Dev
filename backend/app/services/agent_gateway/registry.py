"""AgentRegistry — 从 agents.yaml 加载 Agent 注册信息."""

from __future__ import annotations

import logging
from pathlib import Path

import yaml

from .models import AgentMeta

logger = logging.getLogger(__name__)


class AgentRegistry:
    """启动时从 YAML 文件加载所有 Agent 元信息."""

    def __init__(self, config_path: str | Path) -> None:
        self._agents: dict[str, AgentMeta] = {}
        self._load(Path(config_path))

    # ── public API ──────────────────────────────────────────────

    def get(self, name: str) -> AgentMeta | None:
        return self._agents.get(name)

    def list_all(self) -> list[AgentMeta]:
        return list(self._agents.values())

    def list_enabled(self) -> list[AgentMeta]:
        return [a for a in self._agents.values() if a.enabled]

    # ── internal ────────────────────────────────────────────────

    def _load(self, path: Path) -> None:
        if not path.exists():
            logger.warning("agents.yaml not found at %s — registry is empty", path)
            return

        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        agents_dict: dict = raw.get("agents", {})

        for name, cfg in agents_dict.items():
            if not isinstance(cfg, dict):
                logger.warning("Skipping invalid agent entry: %s", name)
                continue
            try:
                meta = AgentMeta(name=name, **cfg)
                self._agents[name] = meta
                logger.info("Registered agent: %s → %s", name, meta.url)
            except Exception as exc:
                logger.error("Failed to parse agent '%s': %s", name, exc)
