# -*- coding: utf-8 -*-
"""
Property-Based Tests: 工作流告警属性测试
Feature: admin-panel

Properties:
  P10: Workflow alert thresholds — failed status detection, time range filtering
  Validates: Requirements 10.3
"""

import sys
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock


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
from tests._helpers import TEST_JWT_SECRET, make_client_with_cookie

os.environ.setdefault("JWT_SECRET", TEST_JWT_SECRET)
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ENVIRONMENT", "development")

from app.main import app  # noqa: E402
from app.core.database import get_db  # noqa: E402

# ---------------------------------------------------------------------------
# JWT helper
# ---------------------------------------------------------------------------

JWT_SECRET = TEST_JWT_SECRET

VALID_TIME_RANGES = {"7d", "30d", "90d"}


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
# DB mock factory
# ---------------------------------------------------------------------------

def _make_workflows_db_mock(
    run_rows: list[dict] | None = None,
    run_count: int = 0,
) -> AsyncMock:
    """Build a mock Supabase AsyncClient for workflow queries."""
    mock_db = MagicMock()
    _rows = run_rows or []

    def _make_chain(count=0, data=None):
        result = MagicMock()
        result.count = count
        result.data = data if data is not None else []

        chain = MagicMock()
        chain.execute = AsyncMock(return_value=result)
        chain.eq = MagicMock(return_value=chain)
        chain.gte = MagicMock(return_value=chain)
        chain.lte = MagicMock(return_value=chain)
        chain.order = MagicMock(return_value=chain)
        chain.range = MagicMock(return_value=chain)
        chain.select = MagicMock(return_value=chain)
        chain.maybe_single = MagicMock(return_value=chain)
        chain.limit = MagicMock(return_value=chain)
        return chain

    def table_side_effect(table_name: str):
        tbl = MagicMock()
        if table_name == "ss_workflow_runs":
            tbl.select = MagicMock(return_value=_make_chain(count=run_count, data=_rows))
        else:
            tbl.select = MagicMock(return_value=_make_chain())
        return tbl

    mock_db.table = MagicMock(side_effect=table_side_effect)
    return mock_db


# ---------------------------------------------------------------------------
# Property 10a: Valid time range returns 200
# Validates: Requirements 10.3
# ---------------------------------------------------------------------------

_valid_time_range_st = st.sampled_from(sorted(VALID_TIME_RANGES))


@given(time_range=_valid_time_range_st)
@hyp_settings(max_examples=20)
def test_p10_valid_time_range_returns_200(time_range: str):
    """
    **Validates: Requirements 10.3**

    Property 10a: For any valid time_range in {7d, 30d, 90d},
    GET /api/admin/workflows/stats should return 200.
    """
    mock_db = _make_workflows_db_mock()
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get(
            f"/api/admin/workflows/stats?time_range={time_range}",
        )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200, (
        f"Expected 200 for time_range={time_range!r}, "
        f"got {response.status_code}: {response.text}"
    )


# ---------------------------------------------------------------------------
# Property 10b: Invalid time range returns 422
# Validates: Requirements 10.3
# ---------------------------------------------------------------------------

_invalid_time_range_st = st.text(
    alphabet=st.characters(min_codepoint=32, max_codepoint=126),
    min_size=1,
    max_size=10,
).filter(lambda s: s.strip() not in VALID_TIME_RANGES and s.strip() != "")


@given(invalid_range=_invalid_time_range_st)
@hyp_settings(max_examples=20)
def test_p10_invalid_time_range_returns_422(invalid_range: str):
    """
    **Validates: Requirements 10.3**

    Property 10b: Any time_range NOT in {7d, 30d, 90d} should return 422.
    """
    mock_db = _make_workflows_db_mock()
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=False)
        response = client.get(
            f"/api/admin/workflows/stats?time_range={invalid_range}",
        )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 422, (
        f"Expected 422 for invalid time_range={invalid_range!r}, "
        f"got {response.status_code}: {response.text}"
    )


# ---------------------------------------------------------------------------
# Property 10c: Stats response structure is correct
# Validates: Requirements 10.3
# ---------------------------------------------------------------------------

@given(time_range=_valid_time_range_st)
@hyp_settings(max_examples=20)
def test_p10_stats_response_has_required_fields(time_range: str):
    """
    **Validates: Requirements 10.3**

    Property 10c: Stats response must contain stats object with required fields.
    """
    mock_db = _make_workflows_db_mock()
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get(
            f"/api/admin/workflows/stats?time_range={time_range}",
        )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()
    assert "stats" in body
    assert "time_range" in body
    assert body["time_range"] == time_range

    stats = body["stats"]
    for field in ["total_runs", "completed", "failed", "running", "success_rate", "total_tokens_used"]:
        assert field in stats, f"Missing field: {field}"


# ---------------------------------------------------------------------------
# Baseline unit tests
# ---------------------------------------------------------------------------

def test_workflow_stats_returns_200_default():
    """GET /api/admin/workflows/stats returns 200 with default time_range=7d."""
    mock_db = _make_workflows_db_mock()
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/workflows/stats")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()
    assert body["time_range"] == "7d"
    assert body["stats"]["total_runs"] == 0
    assert body["stats"]["success_rate"] == 0.0


def test_workflow_running_returns_200():
    """GET /api/admin/workflows/running returns 200 with empty list."""
    mock_db = _make_workflows_db_mock()
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/workflows/running")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()
    assert "running" in body
    assert "total" in body
    assert isinstance(body["running"], list)


def test_workflow_errors_returns_200():
    """GET /api/admin/workflows/errors returns 200 with empty list."""
    mock_db = _make_workflows_db_mock()
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/workflows/errors")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()
    assert "errors" in body
    assert "total" in body


def test_workflow_stats_without_token_returns_401():
    """GET /api/admin/workflows/stats without token returns 401."""
    mock_db = _make_workflows_db_mock()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/admin/workflows/stats")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401


def test_workflow_stats_success_rate_zero_when_no_runs():
    """Success rate is 0.0 when there are no runs."""
    mock_db = _make_workflows_db_mock(run_rows=[], run_count=0)
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/workflows/stats")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    assert response.json()["stats"]["success_rate"] == 0.0
