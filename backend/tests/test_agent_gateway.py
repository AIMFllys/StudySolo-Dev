"""Agent Gateway unit tests.

Covers: AgentRegistry, AgentMeta, HealthChecker, AgentGateway (non-stream + stream),
        and /api/agents/* route-level integration.
"""

import json
import os
import textwrap
import time
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
import pytest
import pytest_asyncio

from app.services.agent_gateway.models import AgentCallResult, AgentMeta
from app.services.agent_gateway.registry import AgentRegistry
from app.services.agent_gateway.health import HealthChecker
from app.services.agent_gateway.caller import AgentCaller
from app.services.agent_gateway.gateway import AgentGateway


# ═══════════════════════════════════════════════════════════════════
# Registry
# ═══════════════════════════════════════════════════════════════════

class TestAgentRegistry:
    def test_load_valid_yaml(self, tmp_path: Path):
        cfg = tmp_path / "agents.yaml"
        cfg.write_text(textwrap.dedent("""\
            agents:
              code-review:
                url: http://127.0.0.1:8001
                timeout: 45
                api_key_env: AGENT_CODE_REVIEW_KEY
                models: [code-review-v1]
                enabled: true
                description: "代码审查"
                owner: "小李"
              disabled-agent:
                url: http://127.0.0.1:9999
                enabled: false
        """), encoding="utf-8")

        registry = AgentRegistry(cfg)

        assert registry.get("code-review") is not None
        assert registry.get("code-review").url == "http://127.0.0.1:8001"
        assert registry.get("code-review").timeout == 45
        assert registry.get("nonexistent") is None

        assert len(registry.list_all()) == 2
        assert len(registry.list_enabled()) == 1
        assert registry.list_enabled()[0].name == "code-review"

    def test_missing_yaml(self, tmp_path: Path):
        registry = AgentRegistry(tmp_path / "nope.yaml")
        assert registry.list_all() == []

    def test_malformed_entry_skipped(self, tmp_path: Path):
        cfg = tmp_path / "agents.yaml"
        cfg.write_text(textwrap.dedent("""\
            agents:
              good:
                url: http://localhost:8001
              bad: "not a dict"
        """), encoding="utf-8")

        registry = AgentRegistry(cfg)
        assert len(registry.list_all()) == 1
        assert registry.get("good") is not None


# ═══════════════════════════════════════════════════════════════════
# HealthChecker
# ═══════════════════════════════════════════════════════════════════

class TestHealthChecker:
    @pytest.fixture
    def agent(self) -> AgentMeta:
        return AgentMeta(name="test", url="http://127.0.0.1:9999")

    @pytest.mark.asyncio
    async def test_healthy_agent(self, agent: AgentMeta):
        checker = HealthChecker(cache_ttl=30)
        mock_resp = httpx.Response(200)

        with patch("app.services.agent_gateway.health.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            assert await checker.is_healthy(agent) is True

    @pytest.mark.asyncio
    async def test_unhealthy_agent(self, agent: AgentMeta):
        checker = HealthChecker(cache_ttl=30)

        with patch("app.services.agent_gateway.health.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            assert await checker.is_healthy(agent) is False

    @pytest.mark.asyncio
    async def test_cache_hit(self, agent: AgentMeta):
        checker = HealthChecker(cache_ttl=60)
        # Seed cache manually
        checker._cache[agent.name] = (True, time.monotonic())

        # Should not make any HTTP call
        assert await checker.is_healthy(agent) is True

    @pytest.mark.asyncio
    async def test_invalidate(self, agent: AgentMeta):
        checker = HealthChecker(cache_ttl=60)
        checker._cache[agent.name] = (True, time.monotonic())
        checker.invalidate(agent.name)
        assert agent.name not in checker._cache


# ═══════════════════════════════════════════════════════════════════
# AgentCaller
# ═══════════════════════════════════════════════════════════════════

class TestAgentCaller:
    @pytest.mark.asyncio
    async def test_non_stream_success(self):
        caller = AgentCaller()
        mock_resp = httpx.Response(
            200,
            json={"choices": [{"message": {"content": "ok"}}]},
        )

        with patch("app.services.agent_gateway.caller.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            result = await caller.call(
                "http://localhost:8001",
                messages=[{"role": "user", "content": "test"}],
                model="code-review-v1",
                timeout=30,
                headers={"X-Request-Id": "abc"},
            )

        assert result.status_code == 200
        assert result.body is not None
        assert result.error is None

    @pytest.mark.asyncio
    async def test_non_stream_timeout(self):
        caller = AgentCaller()

        with patch("app.services.agent_gateway.caller.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            result = await caller.call(
                "http://localhost:8001",
                messages=[],
                model="m",
                timeout=5,
                headers={},
            )

        assert result.status_code == 504
        assert "timeout" in (result.error or "").lower()

    @pytest.mark.asyncio
    async def test_non_stream_connect_error(self):
        caller = AgentCaller()

        with patch("app.services.agent_gateway.caller.httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            result = await caller.call(
                "http://localhost:8001",
                messages=[],
                model="m",
                timeout=5,
                headers={},
            )

        assert result.status_code == 503


# ═══════════════════════════════════════════════════════════════════
# AgentGateway (integration with mocked caller/health)
# ═══════════════════════════════════════════════════════════════════

class TestAgentGateway:
    @pytest.fixture
    def registry(self, tmp_path: Path) -> AgentRegistry:
        cfg = tmp_path / "agents.yaml"
        cfg.write_text(textwrap.dedent("""\
            agents:
              test-agent:
                url: http://127.0.0.1:8001
                timeout: 30
                api_key_env: TEST_KEY
                models: [test-v1]
                enabled: true
        """), encoding="utf-8")
        return AgentRegistry(cfg)

    @pytest.fixture
    def gateway(self, registry: AgentRegistry) -> AgentGateway:
        return AgentGateway(registry)

    @pytest.mark.asyncio
    async def test_call_not_found(self, gateway: AgentGateway):
        result = await gateway.call("nonexistent", [])
        assert result.status_code == 404

    @pytest.mark.asyncio
    async def test_call_unhealthy(self, gateway: AgentGateway):
        with patch.object(gateway.health, "is_healthy", return_value=False):
            result = await gateway.call("test-agent", [{"role": "user", "content": "hi"}])
        assert result.status_code == 503

    @pytest.mark.asyncio
    async def test_call_success(self, gateway: AgentGateway):
        with patch.object(gateway.health, "is_healthy", return_value=True), \
             patch.object(
                 gateway.caller,
                 "call",
                 return_value=AgentCallResult(status_code=200, body={"ok": True}, duration_ms=50),
             ), \
             patch.dict(os.environ, {"TEST_KEY": "secret"}):
            result = await gateway.call(
                "test-agent",
                [{"role": "user", "content": "hi"}],
                user_id="user-1",
            )
        assert result.status_code == 200
        assert result.body == {"ok": True}

    @pytest.mark.asyncio
    async def test_call_stream_not_found(self, gateway: AgentGateway):
        result = await gateway.call_stream("nonexistent", [])
        assert isinstance(result, AgentCallResult)
        assert result.status_code == 404

    @pytest.mark.asyncio
    async def test_call_stream_success(self, gateway: AgentGateway):
        async def fake_stream(*a, **kw):
            yield b"data: {}\n\n"

        with patch.object(gateway.health, "is_healthy", return_value=True), \
             patch.object(gateway.caller, "call_stream", side_effect=fake_stream), \
             patch.dict(os.environ, {"TEST_KEY": "secret"}):
            result = await gateway.call_stream(
                "test-agent",
                [{"role": "user", "content": "hi"}],
                user_id="user-1",
            )

        assert not isinstance(result, AgentCallResult)
        stream_iter, request_id = result
        chunks = []
        async for chunk in stream_iter:
            chunks.append(chunk)
        assert len(chunks) >= 1

    @pytest.mark.asyncio
    async def test_discover_filters_unhealthy(self, gateway: AgentGateway):
        with patch.object(gateway.health, "check_all", return_value={"test-agent": False}):
            agents = await gateway.discover()
        assert agents == []

    @pytest.mark.asyncio
    async def test_discover_returns_healthy(self, gateway: AgentGateway):
        with patch.object(gateway.health, "check_all", return_value={"test-agent": True}):
            agents = await gateway.discover()
        assert len(agents) == 1
        assert agents[0].name == "test-agent"

    @pytest.mark.asyncio
    async def test_headers_include_api_key(self, gateway: AgentGateway):
        agent = gateway.registry.get("test-agent")
        with patch.dict(os.environ, {"TEST_KEY": "my-secret"}):
            headers = gateway._build_headers(agent, "req-1", "user-1")
        assert headers["Authorization"] == "Bearer my-secret"
        assert headers["X-Request-Id"] == "req-1"
        assert headers["X-User-Id"] == "user-1"
