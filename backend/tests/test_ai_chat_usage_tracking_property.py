import contextlib
import os
import sys
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from tests._helpers import TEST_JWT_SECRET, make_bearer_headers


def _install_supabase_stub():
    if "supabase" not in sys.modules:
        stub = ModuleType("supabase")
        stub.AsyncClient = object  # type: ignore[attr-defined]
        stub.create_async_client = AsyncMock()  # type: ignore[attr-defined]
        sys.modules["supabase"] = stub
    for sub in ("supabase._async", "supabase._async.client", "supabase.lib"):
        sys.modules.setdefault(sub, ModuleType(sub))
    async_client_mod = sys.modules["supabase._async.client"]
    if not hasattr(async_client_mod, "AsyncClient"):
        async_client_mod.AsyncClient = object  # type: ignore[attr-defined]


_install_supabase_stub()

os.environ.setdefault("JWT_SECRET", TEST_JWT_SECRET)
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

from app.main import app  # noqa: E402
from app.api.ai import chat as ai_chat_module  # noqa: E402
from app.core import deps  # noqa: E402
from app.middleware import auth as auth_middleware  # noqa: E402
from app.services import usage_tracker as usage_tracker_module  # noqa: E402


def _stream_lines(response) -> list[str]:
    return [line for line in response.iter_lines() if line]


def _install_auth_stub(monkeypatch):
    async def fake_get_user(_token: str):
        return SimpleNamespace(user=SimpleNamespace(id="user-1", email="user-1@example.com"))

    async def fake_get_db():
        return SimpleNamespace(auth=SimpleNamespace(get_user=fake_get_user))

    monkeypatch.setattr(auth_middleware, "get_db", fake_get_db)
    return make_bearer_headers("user-1", email="user-1@example.com", secret=TEST_JWT_SECRET)


def _install_usage_stubs(monkeypatch, create_calls: list[dict], finalize_calls: list[tuple[str, str]]):
    async def fake_create_usage_request(**kwargs):
        create_calls.append(kwargs)
        return SimpleNamespace(request_id="req-1")

    async def fake_finalize_usage_request(request_id: str, status: str):
        finalize_calls.append((request_id, status))

    monkeypatch.setattr(usage_tracker_module, "create_usage_request", fake_create_usage_request)
    monkeypatch.setattr(usage_tracker_module, "finalize_usage_request", fake_finalize_usage_request)
    monkeypatch.setattr(usage_tracker_module, "bind_usage_request", lambda _req: contextlib.nullcontext())


def test_ai_chat_tracks_modify_subtype_and_workflow_id(monkeypatch):
    create_calls: list[dict] = []
    finalize_calls: list[tuple[str, str]] = []
    headers = _install_auth_stub(monkeypatch)
    _install_usage_stubs(monkeypatch, create_calls, finalize_calls)

    async def fake_resolve_selected_sku(**_kwargs):
        return None

    async def fake_call_with_model(*_args, **_kwargs):
        return '{"response":"Canvas updated.","actions":[]}', "mock-platform", "mock-model"

    monkeypatch.setattr(ai_chat_module, "resolve_selected_sku", fake_resolve_selected_sku)
    monkeypatch.setattr(ai_chat_module, "call_with_model", fake_call_with_model)
    monkeypatch.setattr(
        ai_chat_module,
        "extract_json_obj",
        lambda _raw: {"response": "Canvas updated.", "actions": []},
    )

    app.dependency_overrides[deps.get_current_user] = lambda: {"id": "user-1", "tier": "free"}

    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post(
            "/api/ai/chat",
            headers=headers,
            json={
                "user_input": "请帮我修改这个画布",
                "intent_hint": "MODIFY",
                "canvas_context": {"workflow_id": "wf-1", "nodes": []},
                "conversation_history": [],
            },
        )

        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["intent"] == "MODIFY"
        assert create_calls == [
            {
                "user_id": "user-1",
                "source_type": "assistant",
                "source_subtype": "modify",
                "workflow_id": "wf-1",
            }
        ]
        assert finalize_calls == [("req-1", "completed")]
    finally:
        app.dependency_overrides.clear()


def test_ai_chat_tracks_failed_status_for_model_tier_denial(monkeypatch):
    create_calls: list[dict] = []
    finalize_calls: list[tuple[str, str]] = []
    headers = _install_auth_stub(monkeypatch)
    _install_usage_stubs(monkeypatch, create_calls, finalize_calls)

    async def fake_resolve_selected_sku(**_kwargs):
        return SimpleNamespace(
            model_id="pro-model",
            provider="openai",
            required_tier="pro",
        )

    monkeypatch.setattr(ai_chat_module, "resolve_selected_sku", fake_resolve_selected_sku)

    app.dependency_overrides[deps.get_current_user] = lambda: {"id": "user-1", "tier": "free"}

    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post(
            "/api/ai/chat",
            headers=headers,
            json={"user_input": "你好", "conversation_history": []},
        )

        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["response"] == "This model requires a paid tier."
        assert create_calls[0]["source_subtype"] == "chat"
        assert finalize_calls == [("req-1", "failed")]
    finally:
        app.dependency_overrides.clear()


def test_ai_chat_tracks_failed_status_on_exception(monkeypatch):
    finalize_calls: list[tuple[str, str]] = []
    headers = _install_auth_stub(monkeypatch)
    _install_usage_stubs(monkeypatch, [], finalize_calls)

    async def fake_resolve_selected_sku(**_kwargs):
        return None

    async def fake_call_with_model(*_args, **_kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(ai_chat_module, "resolve_selected_sku", fake_resolve_selected_sku)
    monkeypatch.setattr(ai_chat_module, "call_with_model", fake_call_with_model)

    app.dependency_overrides[deps.get_current_user] = lambda: {"id": "user-1", "tier": "free"}

    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post(
            "/api/ai/chat",
            headers=headers,
            json={"user_input": "你好", "intent_hint": "CHAT", "conversation_history": []},
        )

        assert response.status_code == 500
        assert finalize_calls == [("req-1", "failed")]
    finally:
        app.dependency_overrides.clear()


def test_ai_chat_stream_tracks_completed_status(monkeypatch):
    create_calls: list[dict] = []
    finalize_calls: list[tuple[str, str]] = []
    headers = _install_auth_stub(monkeypatch)
    _install_usage_stubs(monkeypatch, create_calls, finalize_calls)

    async def fake_resolve_selected_sku(**_kwargs):
        return None

    async def fake_call_llm(*_args, **_kwargs):
        async def _stream():
            yield "hello"

        return _stream()

    monkeypatch.setattr(ai_chat_module, "resolve_selected_sku", fake_resolve_selected_sku)
    monkeypatch.setattr(ai_chat_module, "call_llm", fake_call_llm)

    app.dependency_overrides[deps.get_current_user] = lambda: {"id": "user-1", "tier": "free"}
    app.dependency_overrides[ai_chat_module.get_db] = lambda: None

    try:
        client = TestClient(app, raise_server_exceptions=False)
        with client.stream(
            "POST",
            "/api/ai/chat-stream",
            headers=headers,
            json={"user_input": "你好", "conversation_history": [], "thinking_level": "fast"},
        ) as response:
            assert response.status_code == 200
            lines = _stream_lines(response)

        assert any("hello" in line for line in lines)
        assert create_calls == [
            {
                "user_id": "user-1",
                "source_type": "assistant",
                "source_subtype": "chat",
                "workflow_id": None,
                "workflow_run_id": None,
            }
        ]
        assert finalize_calls == [("req-1", "completed")]
    finally:
        app.dependency_overrides.clear()


def test_ai_chat_stream_tracks_failed_status_on_router_error(monkeypatch):
    finalize_calls: list[tuple[str, str]] = []
    headers = _install_auth_stub(monkeypatch)
    _install_usage_stubs(monkeypatch, [], finalize_calls)

    async def fake_resolve_selected_sku(**_kwargs):
        return None

    async def fake_call_llm(*_args, **_kwargs):
        raise ai_chat_module.AIRouterError("no route")

    monkeypatch.setattr(ai_chat_module, "resolve_selected_sku", fake_resolve_selected_sku)
    monkeypatch.setattr(ai_chat_module, "call_llm", fake_call_llm)

    app.dependency_overrides[deps.get_current_user] = lambda: {"id": "user-1", "tier": "free"}
    app.dependency_overrides[ai_chat_module.get_db] = lambda: None

    try:
        client = TestClient(app, raise_server_exceptions=False)
        with client.stream(
            "POST",
            "/api/ai/chat-stream",
            headers=headers,
            json={"user_input": "你好", "conversation_history": [], "thinking_level": "fast"},
        ) as response:
            assert response.status_code == 200
            lines = _stream_lines(response)

        assert any("error" in line for line in lines)
        assert finalize_calls == [("req-1", "failed")]
    finally:
        app.dependency_overrides.clear()
