"""E2E Agent Gateway integration tests.

Tests the full Gateway -> code-review-agent flow by mocking Supabase
at the module level and using Starlette TestClient.

Usage:
    python -m pytest tests/e2e_agent_gateway.py -v --tb=short
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.testclient import TestClient

from app.services.agent_gateway.models import AgentCallResult
from app.services.agent_gateway.gateway import AgentGateway

MOCK_USER = MagicMock()
MOCK_USER.id = "test-user-001"
MOCK_USER.email = "test@studysolo.com"
MOCK_USER.user_metadata = {"role": "user"}


def _build_mock_db():
    """Build a mock Supabase client with proper async table chain."""
    db = MagicMock()
    db.auth = AsyncMock()
    db.auth.get_user = AsyncMock(return_value=MagicMock(user=MOCK_USER))
    t = MagicMock()
    t.select.return_value = t
    t.eq.return_value = t
    t.maybe_single.return_value = t
    t.execute = AsyncMock(return_value=MagicMock(data={"tier": "free"}))
    db.table = MagicMock(return_value=t)
    return db


_mock_db = _build_mock_db()


async def _mock_get_db():
    """Real async function (not AsyncMock) so FastAPI can introspect it."""
    return _mock_db


@pytest.fixture
def client():
    """TestClient with fully mocked Supabase.

    IMPORTANT: We replace get_db with a real async function (not AsyncMock),
    because FastAPI's Depends() introspects the function signature. An
    AsyncMock would cause 422 errors with 'args'/'kwargs' query params.
    """
    # Reset the mock db's auth for each test
    _mock_db.auth.get_user = AsyncMock(return_value=MagicMock(user=MOCK_USER))

    with patch("app.core.database.get_db", _mock_get_db), \
         patch("app.middleware.auth.get_db", _mock_get_db), \
         patch("app.core.deps.get_db", _mock_get_db), \
         patch("app.services.ai_catalog_service.get_db", _mock_get_db):

        # Reset gateway singleton
        import app.api.agents as agents_mod
        agents_mod._gateway = None

        from app.main import app
        with TestClient(app) as c:
            yield c


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test-jwt-token"}


def _mock_health_ok():
    """Patch HealthChecker to always report healthy."""
    m = AsyncMock()
    m.get = AsyncMock(return_value=MagicMock(status_code=200))
    m.__aenter__ = AsyncMock(return_value=m)
    m.__aexit__ = AsyncMock(return_value=False)
    return patch("app.services.agent_gateway.health.httpx.AsyncClient", return_value=m)


# ═══════════════════════════════════════════════════════════════════
# Test 1: Auth guards
# ═══════════════════════════════════════════════════════════════════

def test_no_jwt_returns_401(client):
    """No JWT -> 401."""
    resp = client.get("/api/agents")
    assert resp.status_code == 401
    assert "Token" in resp.json()["detail"]


# ═══════════════════════════════════════════════════════════════════
# Test 2: Agent Discovery
# ═══════════════════════════════════════════════════════════════════

def test_list_agents_with_auth(client, auth_headers):
    """Valid JWT -> agent list containing code-review."""
    with _mock_health_ok():
        resp = client.get("/api/agents", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["name"] == "code-review"
    assert data[0]["owner"] == "小李"


# ═══════════════════════════════════════════════════════════════════
# Test 3: Non-stream Chat
# ═══════════════════════════════════════════════════════════════════

def test_chat_nonstream_success(client, auth_headers):
    """Non-stream chat -> 200 + upstream JSON."""

    async def fake_call(self, agent_name, messages, *, model=None, stream=False, user_id=None):
        return AgentCallResult(
            status_code=200,
            body={
                "id": "chatcmpl-test",
                "object": "chat.completion",
                "model": "code-review-v1",
                "choices": [{
                    "index": 0,
                    "message": {"role": "assistant", "content": "Review OK"},
                    "finish_reason": "stop",
                }],
                "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            },
            duration_ms=100,
            request_id="test-req-001",
        )

    with _mock_health_ok(), \
         patch.object(AgentGateway, "call", new=fake_call):
        resp = client.post(
            "/api/agents/code-review/chat",
            headers=auth_headers,
            json={
                "messages": [{"role": "user", "content": "review: def foo(): pass"}],
                "stream": False,
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert "choices" in data
    assert data["choices"][0]["message"]["content"] == "Review OK"
    assert resp.headers.get("x-request-id") == "test-req-001"


# ═══════════════════════════════════════════════════════════════════
# Test 4: Stream Chat (SSE)
# ═══════════════════════════════════════════════════════════════════

def test_chat_stream_success(client, auth_headers):
    """Stream chat -> SSE events with [DONE]."""

    async def fake_stream():
        yield b'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n'
        yield b'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'
        yield b'data: [DONE]\n\n'

    async def fake_call_stream(self, agent_name, messages, *, model=None, user_id=None):
        return (fake_stream(), "req-stream-001")

    with _mock_health_ok(), \
         patch.object(AgentGateway, "call_stream", new=fake_call_stream):
        resp = client.post(
            "/api/agents/code-review/chat",
            headers=auth_headers,
            json={
                "messages": [{"role": "user", "content": "review: code"}],
                "stream": True,
            },
        )

    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers.get("content-type", "")
    assert "hello" in resp.text
    assert "[DONE]" in resp.text
    assert resp.headers.get("x-request-id") == "req-stream-001"


# ═══════════════════════════════════════════════════════════════════
# Test 5: Error Scenarios
# ═══════════════════════════════════════════════════════════════════

def test_unknown_agent_returns_404(client, auth_headers):
    """Unknown agent name -> 404."""
    async def fake_call_404(self, agent_name, messages, *, model=None, stream=False, user_id=None):
        return AgentCallResult(
            status_code=404,
            error=f"Agent not found: {agent_name}",
            request_id="req-404",
        )

    with _mock_health_ok(), \
         patch.object(AgentGateway, "call", new=fake_call_404):
        resp = client.post(
            "/api/agents/nonexistent/chat",
            headers=auth_headers,
            json={
                "messages": [{"role": "user", "content": "test"}],
                "stream": False,
            },
        )
    assert resp.status_code == 404
    body = resp.json()
    assert "not found" in body["error"]["message"].lower()


def test_unhealthy_agent_returns_503(client, auth_headers):
    """Agent unhealthy -> 503."""
    async def fake_call_503(self, agent_name, messages, *, model=None, stream=False, user_id=None):
        return AgentCallResult(
            status_code=503,
            error=f"Agent unavailable: {agent_name}",
            request_id="req-503",
        )

    with _mock_health_ok(), \
         patch.object(AgentGateway, "call", new=fake_call_503):
        resp = client.post(
            "/api/agents/code-review/chat",
            headers=auth_headers,
            json={
                "messages": [{"role": "user", "content": "test"}],
                "stream": False,
            },
        )
    assert resp.status_code == 503


def test_agent_health_endpoint(client, auth_headers):
    """GET /api/agents/{name}/health -> 200 + healthy."""
    with _mock_health_ok():
        # Clear health cache
        import app.api.agents as agents_mod
        gw = agents_mod.get_gateway()
        gw.health._cache.clear()

        resp = client.get(
            "/api/agents/code-review/health",
            headers=auth_headers,
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "code-review"
    assert data["healthy"] is True


def test_unknown_agent_health_returns_404(client, auth_headers):
    """GET /api/agents/{name}/health with unknown agent -> 404."""
    resp = client.get(
        "/api/agents/nonexistent/health",
        headers=auth_headers,
    )
    assert resp.status_code == 404
