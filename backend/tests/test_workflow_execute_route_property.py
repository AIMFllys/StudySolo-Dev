import contextlib
import os
import sys
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock

from fastapi.testclient import TestClient


def _install_supabase_stub():
    if "supabase" not in sys.modules:
        stub = ModuleType("supabase")
        stub.AsyncClient = object  # type: ignore[attr-defined]
        sys.modules["supabase"] = stub
    for sub in ("supabase._async", "supabase._async.client", "supabase.lib"):
        sys.modules.setdefault(sub, ModuleType(sub))
    async_client_mod = sys.modules["supabase._async.client"]
    if not hasattr(async_client_mod, "AsyncClient"):
        async_client_mod.AsyncClient = object  # type: ignore[attr-defined]


_install_supabase_stub()

os.environ.setdefault("JWT_SECRET", "test-secret-for-property-tests-32-bytes-long")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

from app.main import app  # noqa: E402
from app.core import deps  # noqa: E402
from app.api import workflow_execute as workflow_execute_module  # noqa: E402


class _DbMock:
    def __init__(self, workflow: dict):
        self.workflow = workflow
        self.table = ""
        self.operation = ""
        self.payload = None

    def from_(self, table: str):
        self.table = table
        self.operation = ""
        self.payload = None
        return self

    def select(self, _cols: str):
        self.operation = "select"
        return self

    def insert(self, payload: dict):
        self.operation = "insert"
        self.payload = payload
        return self

    def update(self, payload: dict):
        self.operation = "update"
        self.payload = payload
        return self

    def eq(self, _key: str, _value):
        return self

    def single(self):
        return self

    async def execute(self):
        result = MagicMock()
        if self.table == "ss_workflows" and self.operation == "select":
            result.data = self.workflow
        elif self.table == "ss_workflows" and self.operation == "update":
            result.data = [self.payload]
        elif self.table == "ss_workflow_runs" and self.operation == "insert":
            result.data = [self.payload]
        else:
            result.data = []
        return result


def _install_execution_stubs(monkeypatch, captured: dict):
    async def fake_execute_workflow(workflow_id: str, nodes: list[dict], edges: list[dict], **_kwargs):
        captured["workflow_id"] = workflow_id
        captured["nodes"] = nodes
        captured["edges"] = edges
        yield 'event: workflow_done\ndata: {"workflow_id":"wf-1","status":"completed"}\n\n'

    async def fake_create_usage_request(**_kwargs):
        return SimpleNamespace(request_id="req-1")

    async def fake_finalize_usage_request(*_args, **_kwargs):
        return None

    async def fake_load_total_tokens(*_args, **_kwargs):
        return 0

    async def fake_noop(*_args, **_kwargs):
        return None

    monkeypatch.setattr(workflow_execute_module, "execute_workflow", fake_execute_workflow)
    monkeypatch.setattr(workflow_execute_module, "create_usage_request", fake_create_usage_request)
    monkeypatch.setattr(workflow_execute_module, "finalize_usage_request", fake_finalize_usage_request)
    monkeypatch.setattr(workflow_execute_module, "bind_usage_request", lambda _req: contextlib.nullcontext())
    monkeypatch.setattr(workflow_execute_module, "_load_request_total_tokens", fake_load_total_tokens)
    monkeypatch.setattr(workflow_execute_module, "_finalize_run", fake_noop)
    monkeypatch.setattr(workflow_execute_module, "_update_usage_daily", fake_noop)


def test_post_execute_prefers_request_body(monkeypatch):
    workflow = {
        "id": "wf-1",
        "nodes_json": [{"id": "db-node", "type": "summary", "data": {"label": "db"}}],
        "edges_json": [],
    }
    captured: dict = {}
    _install_execution_stubs(monkeypatch, captured)

    app.dependency_overrides[deps.get_current_user] = lambda: {"id": "user-1", "tier": "free"}
    app.dependency_overrides[deps.get_supabase_client] = lambda: _DbMock(workflow)
    app.dependency_overrides[deps.get_db] = lambda: _DbMock(workflow)

    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post(
            "/api/workflow/wf-1/execute",
            json={
                "nodes_json": [{"id": "body-node", "type": "summary", "data": {"label": "body"}}],
                "edges_json": [{"id": "e-1", "source": "body-node", "target": "body-node"}],
            },
        )

        assert response.status_code == 200, response.text
        assert response.headers["content-type"].startswith("text/event-stream")
        assert captured["nodes"][0]["id"] == "body-node"
        assert captured["edges"][0]["id"] == "e-1"
    finally:
        app.dependency_overrides.clear()


def test_post_execute_without_body_falls_back_to_db(monkeypatch):
    workflow = {
        "id": "wf-1",
        "nodes_json": [{"id": "db-node", "type": "summary", "data": {"label": "db"}}],
        "edges_json": [{"id": "e-db", "source": "db-node", "target": "db-node"}],
    }
    captured: dict = {}
    _install_execution_stubs(monkeypatch, captured)

    app.dependency_overrides[deps.get_current_user] = lambda: {"id": "user-1", "tier": "free"}
    app.dependency_overrides[deps.get_supabase_client] = lambda: _DbMock(workflow)
    app.dependency_overrides[deps.get_db] = lambda: _DbMock(workflow)

    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post("/api/workflow/wf-1/execute")

        assert response.status_code == 200, response.text
        assert captured["nodes"][0]["id"] == "db-node"
        assert captured["edges"][0]["id"] == "e-db"
    finally:
        app.dependency_overrides.clear()


def test_post_execute_rejects_half_graph(monkeypatch):
    workflow = {
        "id": "wf-1",
        "nodes_json": [],
        "edges_json": [],
    }

    app.dependency_overrides[deps.get_current_user] = lambda: {"id": "user-1", "tier": "free"}
    app.dependency_overrides[deps.get_supabase_client] = lambda: _DbMock(workflow)
    app.dependency_overrides[deps.get_db] = lambda: _DbMock(workflow)

    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post(
            "/api/workflow/wf-1/execute",
            json={"nodes_json": [{"id": "body-node", "type": "summary", "data": {"label": "body"}}]},
        )

        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_get_execute_route_still_streams(monkeypatch):
    workflow = {
        "id": "wf-1",
        "nodes_json": [{"id": "db-node", "type": "summary", "data": {"label": "db"}}],
        "edges_json": [],
    }
    captured: dict = {}
    _install_execution_stubs(monkeypatch, captured)

    app.dependency_overrides[deps.get_current_user] = lambda: {"id": "user-1", "tier": "free"}
    app.dependency_overrides[deps.get_supabase_client] = lambda: _DbMock(workflow)
    app.dependency_overrides[deps.get_db] = lambda: _DbMock(workflow)

    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/workflow/wf-1/execute")

        assert response.status_code == 200, response.text
        assert response.headers["content-type"].startswith("text/event-stream")
        assert captured["nodes"][0]["id"] == "db-node"
    finally:
        app.dependency_overrides.clear()
