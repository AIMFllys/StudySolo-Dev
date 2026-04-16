"""AgentGateway — 主入口：注册 → 发现 → 调用 → 审计."""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from collections.abc import AsyncIterator

from .caller import AgentCaller
from .health import HealthChecker
from .models import AgentCallResult, AgentMeta, AgentModelsResult
from .registry import AgentRegistry

logger = logging.getLogger(__name__)

# Structured JSON audit logger (stdout)
_audit = logging.getLogger("agent_gateway.audit")


class AgentGateway:
    """子后端 Agent 的统一调用网关.

    职责：
    - 从 AgentRegistry 查找 Agent
    - 通过 HealthChecker 确认可用性
    - 通过 AgentCaller 执行 HTTP 调用（non-stream / SSE stream）
    - 记录审计日志（stdout JSON）
    """

    def __init__(self, registry: AgentRegistry, *, model_cache_ttl: int = 30) -> None:
        self.registry = registry
        self.caller = AgentCaller()
        self.health = HealthChecker()
        self._model_cache_ttl = model_cache_ttl
        self._models_cache: dict[str, tuple[AgentModelsResult, float]] = {}

    # ── Discovery ───────────────────────────────────────────────

    async def discover(self) -> list[AgentMeta]:
        """返回所有已注册且健康的 Agent."""
        enabled = self.registry.list_enabled()
        results = await self.health.check_all(enabled)
        return [a for a in enabled if results.get(a.name, False)]

    async def list_enabled_with_health(self) -> list[tuple[AgentMeta, bool]]:
        """Return every enabled agent plus its current health state."""
        enabled = self.registry.list_enabled()
        health_map = await self.health.check_all(enabled)
        return [(agent, health_map.get(agent.name, False)) for agent in enabled]

    async def get_models(
        self,
        agent_name: str,
        *,
        user_id: str | None = None,
    ) -> AgentModelsResult | AgentCallResult:
        """Return models for a registered Agent with runtime-first fallback."""
        agent = self.registry.get(agent_name)
        if not agent or not agent.enabled:
            return AgentCallResult(
                status_code=404,
                error=f"Agent not found: {agent_name}",
                request_id=uuid.uuid4().hex,
            )

        now = time.monotonic()
        cached = self._models_cache.get(agent_name)
        if cached and (now - cached[1]) < self._model_cache_ttl:
            return cached[0]

        request_id = uuid.uuid4().hex
        headers = self._build_headers(agent, request_id, user_id)
        healthy = await self.health.is_healthy(agent)
        source = "registry-fallback"
        models = list(agent.models)

        if healthy:
            runtime_models = await self.caller.fetch_models(
                agent.url,
                timeout=min(agent.timeout, 15),
                headers=headers,
            )
            if runtime_models:
                models = runtime_models
                source = "runtime"

        result = AgentModelsResult(
            agent=agent.name,
            healthy=healthy,
            source=source,
            models=models,
        )
        self._models_cache[agent_name] = (result, now)
        return result

    # ── Non-stream call ─────────────────────────────────────────

    async def call(
        self,
        agent_name: str,
        messages: list[dict],
        *,
        model: str | None = None,
        stream: bool = False,
        user_id: str | None = None,
    ) -> AgentCallResult:
        """统一 non-stream 调用入口."""
        agent = self.registry.get(agent_name)
        if not agent or not agent.enabled:
            return AgentCallResult(
                status_code=404,
                error=f"Agent not found: {agent_name}",
                request_id=uuid.uuid4().hex,
            )

        healthy = await self.health.is_healthy(agent)
        if not healthy:
            return AgentCallResult(
                status_code=503,
                error=f"Agent unavailable: {agent_name}",
                request_id=uuid.uuid4().hex,
            )

        request_id = uuid.uuid4().hex
        headers = self._build_headers(agent, request_id, user_id)
        resolved_model = model or (agent.models[0] if agent.models else agent_name)

        result = await self.caller.call(
            agent.url,
            messages=messages,
            model=resolved_model,
            timeout=agent.timeout,
            headers=headers,
            max_retries=agent.max_retries,
        )
        result.request_id = request_id

        self._audit_log(
            request_id=request_id,
            agent_name=agent_name,
            user_id=user_id,
            stream=False,
            status_code=result.status_code,
            duration_ms=result.duration_ms,
            error=result.error,
        )

        return result

    # ── Stream call ─────────────────────────────────────────────

    async def call_stream(
        self,
        agent_name: str,
        messages: list[dict],
        *,
        model: str | None = None,
        user_id: str | None = None,
    ) -> tuple[AsyncIterator[bytes], str] | AgentCallResult:
        """流式调用入口. 成功返回 (stream_iterator, request_id)，失败返回 AgentCallResult."""
        agent = self.registry.get(agent_name)
        if not agent or not agent.enabled:
            return AgentCallResult(
                status_code=404,
                error=f"Agent not found: {agent_name}",
                request_id=uuid.uuid4().hex,
            )

        healthy = await self.health.is_healthy(agent)
        if not healthy:
            return AgentCallResult(
                status_code=503,
                error=f"Agent unavailable: {agent_name}",
                request_id=uuid.uuid4().hex,
            )

        request_id = uuid.uuid4().hex
        headers = self._build_headers(agent, request_id, user_id)
        resolved_model = model or (agent.models[0] if agent.models else agent_name)

        start = time.monotonic()

        async def audited_stream() -> AsyncIterator[bytes]:
            async for chunk in self.caller.call_stream(
                agent.url,
                messages=messages,
                model=resolved_model,
                timeout=agent.timeout,
                headers=headers,
            ):
                yield chunk

            duration_ms = int((time.monotonic() - start) * 1000)
            self._audit_log(
                request_id=request_id,
                agent_name=agent_name,
                user_id=user_id,
                stream=True,
                status_code=200,
                duration_ms=duration_ms,
                error=None,
            )

        return audited_stream(), request_id

    # ── Helpers ─────────────────────────────────────────────────

    def _build_headers(
        self,
        agent: AgentMeta,
        request_id: str,
        user_id: str | None,
    ) -> dict[str, str]:
        headers: dict[str, str] = {
            "Content-Type": "application/json",
            "X-Request-Id": request_id,
        }
        if user_id:
            headers["X-User-Id"] = user_id

        # Resolve Agent API key from environment
        if agent.api_key_env:
            api_key = os.environ.get(agent.api_key_env, "")
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"
            else:
                logger.warning(
                    "Agent '%s' api_key_env '%s' is not set in environment",
                    agent.name,
                    agent.api_key_env,
                )

        return headers

    def _audit_log(
        self,
        *,
        request_id: str,
        agent_name: str,
        user_id: str | None,
        stream: bool,
        status_code: int,
        duration_ms: int,
        error: str | None,
    ) -> None:
        record = {
            "event": "agent_call",
            "request_id": request_id,
            "agent": agent_name,
            "user_id": user_id,
            "stream": stream,
            "status": status_code,
            "duration_ms": duration_ms,
            "ts": time.time(),
        }
        if error:
            record["error"] = error[:500]

        _audit.info(json.dumps(record, ensure_ascii=False))
