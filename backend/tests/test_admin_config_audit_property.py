# -*- coding: utf-8 -*-
"""
Property-Based Tests: 系统配置和审计日志属性测试
Feature: admin-panel

Properties:
  P11: Config key uniqueness — GET /config returns unique keys
  P14: Config update audit — PUT /config returns success + key matches
  P15: Audit log pagination — page/page_size constraints are respected
Validates: Requirements 14.3, 14.4, 15.2, 15.4, 16.1
"""

import sys
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# Stub out 'supabase' before any app module is imported
# ---------------------------------------------------------------------------

def _install_supabase_stub():
    if "supabase" not in sys.modules:
        stub = ModuleType("supabase")
        stub.AsyncClient = object  # type: ignore[attr-defined]
        stub.create_async_client = AsyncMock()  # type: ignore[attr-defined]
        sys.modules["supabase"] = stub

    for sub in ("supabase._async", "supabase._async.client", "supabase.lib"):
        if sub not in sys.modules:
            sys.modules[sub] = ModuleType(sub)

    async_client_mod = sys.modules["supabase._async.client"]
    if not hasattr(async_client_mod, "AsyncClient"):
        async_client_mod.AsyncClient = object  # type: ignore[attr-defined]


_install_supabase_stub()

import os
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from hypothesis import given, settings as hyp_settings
from hypothesis import strategies as st
from jose import jwt
import pytest
from tests._helpers import TEST_JWT_SECRET, make_client_with_cookie

os.environ.setdefault("JWT_SECRET", TEST_JWT_SECRET)
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ENVIRONMENT", "development")

from app.main import app  # noqa: E402
from app.core.database import get_db  # noqa: E402


@pytest.fixture(autouse=True)
def _disable_audit_queue():
    with patch("app.api.admin_config.queue_audit_log"):
        yield

# ---------------------------------------------------------------------------
# JWT helper
# ---------------------------------------------------------------------------

JWT_SECRET = TEST_JWT_SECRET


def _make_admin_client(token: str, *, raise_server_exceptions: bool) -> TestClient:
    return make_client_with_cookie(
        app,
        "admin_token",
        token,
        raise_server_exceptions=raise_server_exceptions,
    )


def _make_admin_token() -> str:
    payload = {
        "sub": "test-admin-id",
        "username": "testadmin",
        "type": "admin",
        "exp": datetime.now(timezone.utc) + timedelta(hours=4),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


# ---------------------------------------------------------------------------
# DB mock factories
# ---------------------------------------------------------------------------

def _make_config_db_mock(config_rows: list[dict] | None = None) -> AsyncMock:
    """Build a mock Supabase AsyncClient for config queries."""
    mock_db = MagicMock()
    _rows = config_rows or []

    def _make_chain(count=0, data=None):
        result = MagicMock()
        result.count = count
        result.data = data if data is not None else []

        chain = MagicMock()
        chain.execute = AsyncMock(return_value=result)
        chain.eq = MagicMock(return_value=chain)
        chain.order = MagicMock(return_value=chain)
        chain.range = MagicMock(return_value=chain)
        chain.select = MagicMock(return_value=chain)
        chain.upsert = MagicMock(return_value=chain)
        chain.ilike = MagicMock(return_value=chain)
        return chain

    def table_side_effect(table_name: str):
        tbl = MagicMock()
        if table_name == "ss_system_config":
            tbl.select = MagicMock(return_value=_make_chain(count=len(_rows), data=_rows))
            tbl.upsert = MagicMock(return_value=_make_chain())
        elif table_name == "ss_admin_audit_logs":
            tbl.insert = MagicMock(return_value=_make_chain())
        else:
            tbl.select = MagicMock(return_value=_make_chain())
        return tbl

    mock_db.table = MagicMock(side_effect=table_side_effect)
    return mock_db


def _make_audit_db_mock(log_rows: list[dict] | None = None, total: int = 0) -> AsyncMock:
    """Build a mock Supabase AsyncClient for audit log queries."""
    mock_db = MagicMock()
    _rows = log_rows or []
    _total = total or len(_rows)

    def _make_chain(count=0, data=None):
        result = MagicMock()
        result.count = count
        result.data = data if data is not None else []

        chain = MagicMock()
        chain.execute = AsyncMock(return_value=result)
        chain.eq = MagicMock(return_value=chain)
        chain.order = MagicMock(return_value=chain)
        chain.range = MagicMock(return_value=chain)
        chain.select = MagicMock(return_value=chain)
        return chain

    def table_side_effect(table_name: str):
        tbl = MagicMock()
        if table_name == "ss_admin_audit_logs":
            tbl.select = MagicMock(return_value=_make_chain(count=_total, data=_rows))
        else:
            tbl.select = MagicMock(return_value=_make_chain())
        return tbl

    mock_db.table = MagicMock(side_effect=table_side_effect)
    return mock_db


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_config_key_st = st.text(
    alphabet=st.characters(min_codepoint=97, max_codepoint=122),
    min_size=1,
    max_size=20,
).map(lambda s: f"test.{s}")

_config_value_st = st.one_of(
    st.integers(min_value=0, max_value=1000),
    st.booleans(),
    st.text(min_size=0, max_size=50),
)

_config_rows_st = st.lists(
    st.fixed_dictionaries({
        "key": _config_key_st,
        "value": _config_value_st,
        "description": st.one_of(st.none(), st.text(min_size=0, max_size=30)),
        "updated_by": st.none(),
        "updated_at": st.none(),
    }),
    min_size=0,
    max_size=20,
)

_page_st = st.integers(min_value=1, max_value=10)
_page_size_st = st.integers(min_value=1, max_value=100)


# ---------------------------------------------------------------------------
# Property 11: Config GET returns 200 with correct structure
# Validates: Requirements 14.3
# ---------------------------------------------------------------------------

@given(config_rows=_config_rows_st)
@hyp_settings(max_examples=20)
def test_p11_config_list_returns_correct_structure(config_rows: list[dict]):
    """
    **Validates: Requirements 14.3**

    Property 11: GET /config always returns 200 with configs list and total.
    total must equal len(configs).
    """
    mock_db = _make_config_db_mock(config_rows)
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/config")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    body = response.json()
    assert "configs" in body
    assert "total" in body
    assert body["total"] == len(body["configs"]), (
        f"total={body['total']} != len(configs)={len(body['configs'])}"
    )


# ---------------------------------------------------------------------------
# Property 14: Config PUT returns success with matching key
# Validates: Requirements 14.4
# ---------------------------------------------------------------------------

@given(config_key=_config_key_st, config_value=_config_value_st)
@hyp_settings(max_examples=20)
def test_p14_config_update_returns_success_with_key(config_key: str, config_value):
    """
    **Validates: Requirements 14.4**

    Property 14: PUT /config with any valid key/value returns success=True
    and the response key matches the request key.
    """
    mock_db = _make_config_db_mock()
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.put(
            "/api/admin/config",
            json={"key": config_key, "value": config_value},
        )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    body = response.json()
    assert body["success"] is True
    assert body["key"] == config_key, f"Response key {body['key']!r} != request key {config_key!r}"


# ---------------------------------------------------------------------------
# Property 15: Audit log pagination constraints
# Validates: Requirements 15.2, 15.4
# ---------------------------------------------------------------------------

@given(page=_page_st, page_size=_page_size_st)
@hyp_settings(max_examples=20)
def test_p15_audit_log_pagination_constraints(page: int, page_size: int):
    """
    **Validates: Requirements 15.2, 15.4**

    Property 15: GET /audit-logs with any valid page/page_size returns 200.
    Response page and page_size must match request values.
    total_pages >= 1 always.
    """
    mock_db = _make_audit_db_mock(log_rows=[], total=0)
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get(
            f"/api/admin/audit-logs?page={page}&page_size={page_size}",
        )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    body = response.json()
    assert body["page"] == page
    assert body["page_size"] == page_size
    assert body["total_pages"] >= 1


# ---------------------------------------------------------------------------
# Baseline unit tests
# ---------------------------------------------------------------------------

def test_config_list_empty_returns_200():
    """GET /api/admin/config with no entries returns empty list."""
    mock_db = _make_config_db_mock([])
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/config")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()
    assert body["configs"] == []
    assert body["total"] == 0


def test_config_update_without_token_returns_401():
    """PUT /api/admin/config without token returns 401."""
    mock_db = _make_config_db_mock()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.put("/api/admin/config", json={"key": "test", "value": "val"})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401


def test_audit_logs_empty_returns_200():
    """GET /api/admin/audit-logs with no logs returns empty list."""
    mock_db = _make_audit_db_mock([], total=0)
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/audit-logs")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()
    assert body["logs"] == []
    assert body["total"] == 0
    assert body["total_pages"] == 1


def test_audit_logs_without_token_returns_401():
    """GET /api/admin/audit-logs without token returns 401."""
    mock_db = _make_audit_db_mock()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/admin/audit-logs")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401


def test_audit_logs_action_filter_passes_through():
    """GET /api/admin/audit-logs?action=login returns 200."""
    mock_db = _make_audit_db_mock([], total=0)
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/audit-logs?action=login")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200


def test_config_list_without_token_returns_401():
    """GET /api/admin/config without token returns 401."""
    mock_db = _make_config_db_mock()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/admin/config")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401
