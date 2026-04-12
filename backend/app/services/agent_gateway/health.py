"""HealthChecker — Agent 健康检查，带 TTL 缓存."""

from __future__ import annotations

import logging
import time

import httpx

from .models import AgentMeta

logger = logging.getLogger(__name__)

_DEFAULT_HEALTH_TIMEOUT = 5  # seconds


class HealthChecker:
    """检查 Agent 的 /health/ready 端点，结果缓存 cache_ttl 秒."""

    def __init__(self, cache_ttl: int = 30) -> None:
        self._cache: dict[str, tuple[bool, float]] = {}
        self._cache_ttl = cache_ttl

    async def is_healthy(self, agent: AgentMeta) -> bool:
        """检查单个 Agent 是否健康（优先读缓存）."""
        now = time.monotonic()
        cached = self._cache.get(agent.name)
        if cached and (now - cached[1]) < self._cache_ttl:
            return cached[0]

        healthy = await self._probe(agent)
        self._cache[agent.name] = (healthy, now)
        return healthy

    async def check_all(self, agents: list[AgentMeta]) -> dict[str, bool]:
        """批量检查多个 Agent 的健康状态."""
        results: dict[str, bool] = {}
        for agent in agents:
            results[agent.name] = await self.is_healthy(agent)
        return results

    def invalidate(self, name: str) -> None:
        """手动清除某个 Agent 的缓存."""
        self._cache.pop(name, None)

    # ── internal ────────────────────────────────────────────────

    async def _probe(self, agent: AgentMeta) -> bool:
        try:
            async with httpx.AsyncClient(timeout=_DEFAULT_HEALTH_TIMEOUT) as client:
                resp = await client.get(f"{agent.url}/health/ready")
            return resp.status_code == 200
        except Exception as exc:
            logger.debug("Health check failed for %s: %s", agent.name, exc)
            return False
