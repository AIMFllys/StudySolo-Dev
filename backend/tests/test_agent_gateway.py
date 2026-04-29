"""Agent Gateway unit tests.

Covers: AgentRegistry, AgentMeta, HealthChecker, AgentGateway (non-stream + stream),
        and /api/agents/* route-level integration.
"""

import os
import textwrap
import time
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api import agents as agents_api
from app.core.deps import get_current_user
from app.middleware import auth as auth_middleware
from app.services.agent_gateway.models import AgentCallResult, AgentMeta
from app.services.agent_gateway.models import AgentModelsResult
from app.services.agent_gateway.registry import AgentRegistry
from app.services.agent_gateway.health import HealthChecker
from app.services.agent_gateway.caller import AgentCaller
from app.services.agent_gateway.gateway import AgentGateway
from tests._helpers import TEST_JWT_SECRET, make_bearer_headers


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

    @pytest.mark.asyncio
    async def test_get_models_uses_runtime_models_when_available(self, gateway: AgentGateway):
        with patch.object(gateway.health, "is_healthy", return_value=True), \
             patch.object(gateway.caller, "fetch_models", return_value=["runtime-v1", "runtime-v2"]):
            result = await gateway.get_models("test-agent", user_id="user-1")

        assert isinstance(result, AgentModelsResult)
        assert result.models == ["runtime-v1", "runtime-v2"]
        assert result.source == "runtime"
        assert result.healthy is True

    @pytest.mark.asyncio
    async def test_get_models_falls_back_to_registry_when_runtime_unavailable(self, gateway: AgentGateway):
        with patch.object(gateway.health, "is_healthy", return_value=False), \
             patch.object(gateway.caller, "fetch_models", return_value=[]):
            result = await gateway.get_models("test-agent", user_id="user-1")

        assert isinstance(result, AgentModelsResult)
        assert result.models == ["test-v1"]
        assert result.source == "registry-fallback"
        assert result.healthy is False


def _install_auth_stub(monkeypatch):
    async def fake_get_db():
        class _User:
            id = "user-1"
            email = "user-1@example.com"

        class _Response:
            user = _User()

        class _Auth:
            async def get_user(self, _token: str):
                return _Response()

        class _Db:
            auth = _Auth()

        return _Db()

    monkeypatch.setattr(auth_middleware, "get_db", fake_get_db)
    return make_bearer_headers("user-1", email="user-1@example.com", secret=TEST_JWT_SECRET)


def test_list_agents_route_returns_enabled_agents_with_health(monkeypatch):
    headers = _install_auth_stub(monkeypatch)
    fake_gateway = SimpleNamespace(
        list_enabled_with_health=AsyncMock(return_value=[
            (
                AgentMeta(
                    name="test-agent",
                    url="http://127.0.0.1:8001",
                    models=["test-v1"],
                    enabled=True,
                    description="测试 Agent",
                    owner="主系统",
                    capabilities=["review"],
                    skills_ready=False,
                    mcp_ready=False,
                ),
                False,
            )
        ]),
    )
    app.dependency_overrides[agents_api.get_gateway] = lambda: fake_gateway
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1", "email": "user-1@example.com", "role": "user", "tier": "free"}
    client = TestClient(app, raise_server_exceptions=False)

    try:
        response = client.get("/api/agents", headers=headers)
    finally:
        app.dependency_overrides.pop(agents_api.get_gateway, None)
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200, response.text
    assert response.json() == [{
        "name": "test-agent",
        "description": "测试 Agent",
        "models": ["test-v1"],
        "owner": "主系统",
        "healthy": False,
        "capabilities": ["review"],
        "skills_ready": False,
        "mcp_ready": False,
    }]


def test_get_agent_models_route_returns_runtime_first_result(monkeypatch):
    headers = _install_auth_stub(monkeypatch)
    fake_gateway = SimpleNamespace(
        get_models=AsyncMock(return_value=AgentModelsResult(
            agent="test-agent",
            healthy=True,
            source="runtime",
            models=["runtime-v1", "runtime-v2"],
        )),
    )
    app.dependency_overrides[agents_api.get_gateway] = lambda: fake_gateway
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1", "email": "user-1@example.com", "role": "user", "tier": "free"}
    client = TestClient(app, raise_server_exceptions=False)

    try:
        response = client.get("/api/agents/test-agent/models", headers=headers)
    finally:
        app.dependency_overrides.pop(agents_api.get_gateway, None)
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200, response.text
    assert response.json() == {
        "agent": "test-agent",
        "healthy": True,
        "source": "runtime",
        "models": ["runtime-v1", "runtime-v2"],
    }
