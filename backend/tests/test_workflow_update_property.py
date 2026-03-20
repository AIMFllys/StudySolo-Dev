"""
Regression test: workflow update should not chain select() after update().
"""

import os
import sys
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock


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

import jwt
from fastapi.testclient import TestClient

from tests._helpers import TEST_JWT_SECRET

os.environ.setdefault("JWT_SECRET", TEST_JWT_SECRET)
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

from app.main import app  # noqa: E402
from app.core import deps  # noqa: E402


_FAKE_USER = {"id": "user-test-001", "email": "test@example.com"}


def _make_auth_headers() -> dict:
    token = jwt.encode(
        {"sub": _FAKE_USER["id"], "email": _FAKE_USER["email"]},
        TEST_JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def _make_update_db_mock(workflow_id: str) -> MagicMock:
    updated_record = {
        "id": workflow_id,
        "name": "Updated workflow",
        "description": "Updated description",
        "status": "draft",
        "created_at": "2026-03-19T00:00:00+00:00",
        "updated_at": "2026-03-19T00:00:00+00:00",
    }

    state = {"mode": None}
    chain = MagicMock()

    def _from_(_table):
        state["mode"] = None
        return chain

    def _update(_payload):
        state["mode"] = "update"
        return chain

    def _select(_cols):
        state["mode"] = "select"
        return chain

    chain.from_ = MagicMock(side_effect=_from_)
    chain.update = MagicMock(side_effect=_update)
    chain.select = MagicMock(side_effect=_select)
    chain.eq = MagicMock(return_value=chain)
    chain.single = MagicMock(return_value=chain)

    async def _execute():
        result = MagicMock()
        if state["mode"] == "update":
            result.data = [{"id": workflow_id}]
        elif state["mode"] == "select":
            result.data = updated_record
        else:
            result.data = None
        return result

    chain.execute = _execute
    return chain


def test_update_workflow_returns_updated_meta_without_update_select_chain():
    workflow_id = "834135dc-74b1-4487-93c4-1e3a07f00973"
    db_mock = _make_update_db_mock(workflow_id)

    app.dependency_overrides[deps.get_current_user] = lambda: _FAKE_USER
    app.dependency_overrides[deps.get_supabase_client] = lambda: db_mock

    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.put(
            f"/api/workflow/{workflow_id}",
            json={"name": "Updated workflow", "description": "Updated description"},
            headers=_make_auth_headers(),
        )

        assert response.status_code == 200, response.text
        assert response.json()["id"] == workflow_id
        assert response.json()["name"] == "Updated workflow"
        assert db_mock.update.called
        assert db_mock.select.called
    finally:
        app.dependency_overrides.clear()
