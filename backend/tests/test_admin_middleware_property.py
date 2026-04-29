# -*- coding: utf-8 -*-
"""
Property-Based Tests: Admin middleware path routing property tests
Feature: admin-panel

Properties:
  P5: Admin middleware path routing -- Validates: Requirements 3.1, 3.2, 3.3, 3.4
"""

import sys
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock


def _install_supabase_stub():
    if "supabase" not in sys.modules:
        stub = ModuleType("supabase")
        stub.AsyncClient = object
        stub.create_async_client = AsyncMock()
        sys.modules["supabase"] = stub
    for sub in ("supabase._async", "supabase._async.client", "supabase.lib"):
        if sub not in sys.modules:
            sys.modules[sub] = ModuleType(sub)
    async_client_mod = sys.modules["supabase._async.client"]
    if not hasattr(async_client_mod, "AsyncClient"):
        async_client_mod.AsyncClient = object


_install_supabase_stub()

import os
from fastapi.testclient import TestClient
from hypothesis import given, settings as hyp_settings
from hypothesis import strategies as st

os.environ.setdefault("JWT_SECRET", "test-secret-for-admin-middleware-property-tests")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("ENVIRONMENT", "development")

from app.main import app
from app.core.database import get_db

# Unicode escape to avoid encoding issues in this helper script
ADMIN_UNAUTH_MSG = "\u7ba1\u7406\u5458\u672a\u8ba4\u8bc1"   # 管理员未认证
ADMIN_TOKEN_TYPE_MSG = "Token \u7c7b\u578b\u65e0\u6548"        # Token 类型无效


def _make_db_mock_pass_through():
    mock_db = AsyncMock()
    mock_db.auth = AsyncMock()
    mock_db.auth.get_user = AsyncMock(return_value=MagicMock(user=None))
    mock_db.table = MagicMock(return_value=MagicMock())
    return mock_db


_segment_st = st.text(
    alphabet=st.characters(min_codepoint=33, max_codepoint=126, blacklist_characters="/?#"),
    min_size=1, max_size=20,
)

_admin_subpath_st = st.text(
    alphabet=st.characters(min_codepoint=33, max_codepoint=126, blacklist_characters="?#"),
    min_size=1, max_size=40,
).filter(lambda s: s != "login" and not s.startswith("login/"))

_non_admin_api_path_st = st.builds(
    lambda seg: f"/api/{seg}", _segment_st,
).filter(lambda p: not p.startswith("/api/admin/"))

_non_api_path_st = st.builds(
    lambda seg: f"/{seg}", _segment_st,
).filter(lambda p: not p.startswith("/api/"))


@given(subpath=_admin_subpath_st)
@hyp_settings(max_examples=20)
def test_p5_admin_paths_intercepted_without_token(subpath):
    """Validates: Requirements 3.1, 3.3 -- admin paths return 401 without token."""
    path = f"/api/admin/{subpath}"
    mock_db = _make_db_mock_pass_through()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get(path)
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401, (
        f"Expected 401 for path {path!r}, got {response.status_code}: {response.text}"
    )
    body = response.json()
    assert "detail" in body
    detail = body["detail"]
    # Accept either English or Chinese admin middleware messages
    assert (
        "admin" in detail.lower()
        or "Token" in detail
        or "token" in detail.lower()
        or detail == ADMIN_UNAUTH_MSG
        or detail == ADMIN_TOKEN_TYPE_MSG
    ), (
        f"Expected AdminJWTMiddleware 401 message, got: {detail}"
    )


@given(subpath=_admin_subpath_st)
@hyp_settings(max_examples=20)
def test_p5_admin_paths_post_intercepted_without_token(subpath):
    """Validates: Requirements 3.1, 3.3 -- POST to admin paths returns 401 without token."""
    path = f"/api/admin/{subpath}"
    mock_db = _make_db_mock_pass_through()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post(path, json={})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401, (
        f"Expected 401 for POST {path!r}, got {response.status_code}: {response.text}"
    )


def test_p5_login_path_not_intercepted():
    """Validates: Requirements 3.1 -- /api/admin/login passes through middleware."""
    mock_db = _make_db_mock_pass_through()
    no_result = MagicMock()
    no_result.data = None
    chain = AsyncMock()
    chain.execute = AsyncMock(return_value=no_result)
    chain.maybe_single = MagicMock(return_value=chain)
    chain.eq = MagicMock(return_value=chain)
    chain.select = MagicMock(return_value=chain)
    tbl = MagicMock()
    tbl.select = MagicMock(return_value=chain)
    mock_db.table = MagicMock(return_value=tbl)

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post("/api/admin/login", json={"username": "nobody", "password": "wrongpass"})
    finally:
        app.dependency_overrides.pop(get_db, None)

    body = response.json()
    detail = body.get("detail", "")
    assert detail != ADMIN_UNAUTH_MSG, (
        f"/api/admin/login should not be blocked by AdminJWTMiddleware, got: {detail!r}"
    )


@given(path=_non_admin_api_path_st)
@hyp_settings(max_examples=20)
def test_p5_non_admin_api_paths_not_intercepted_by_admin_middleware(path):
    """Validates: Requirements 3.1, 3.5 -- non-admin paths not blocked by admin middleware."""
    mock_db = _make_db_mock_pass_through()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get(path)
    finally:
        app.dependency_overrides.pop(get_db, None)

    if response.status_code == 401:
        body = response.json()
        detail = body.get("detail", "")
        assert ADMIN_UNAUTH_MSG not in detail, (
            f"Non-admin path {path!r} returned AdminJWTMiddleware 401: {detail!r}"
        )
        assert detail != ADMIN_TOKEN_TYPE_MSG, (
            f"Non-admin path {path!r} returned AdminJWTMiddleware token type error"
        )


@given(path=_non_api_path_st)
@hyp_settings(max_examples=20)
def test_p5_non_api_paths_not_intercepted(path):
    """Validates: Requirements 3.1 -- non-API paths return 404, not 401."""
    mock_db = _make_db_mock_pass_through()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get(path)
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 404, (
        f"Non-API path {path!r} should return 404, got {response.status_code}"
    )


@given(subpath=_admin_subpath_st)
@hyp_settings(max_examples=20)
def test_p5_options_requests_not_intercepted(subpath):
    """Validates: Requirements 3.1 -- OPTIONS (CORS preflight) not blocked by admin middleware."""
    path = f"/api/admin/{subpath}"
    mock_db = _make_db_mock_pass_through()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.options(path)
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code != 401, (
        f"OPTIONS to {path!r} should not be intercepted by AdminJWTMiddleware, got 401"
    )


def test_admin_dashboard_returns_401_without_token():
    """GET /api/admin/dashboard/overview returns 401 without admin_token."""
    mock_db = _make_db_mock_pass_through()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/admin/dashboard/overview")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401
    assert response.json()["detail"] == ADMIN_UNAUTH_MSG


def test_admin_users_returns_401_without_token():
    """GET /api/admin/users returns 401 without admin_token."""
    mock_db = _make_db_mock_pass_through()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/admin/users")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401
    assert response.json()["detail"] == ADMIN_UNAUTH_MSG


def test_health_endpoint_not_intercepted():
    """GET /api/health is not intercepted by AdminJWTMiddleware."""
    mock_db = _make_db_mock_pass_through()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/health")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_login_path_passes_through_middleware():
    """POST /api/admin/login is not blocked by AdminJWTMiddleware."""
    mock_db = _make_db_mock_pass_through()
    no_result = MagicMock()
    no_result.data = None
    chain = AsyncMock()
    chain.execute = AsyncMock(return_value=no_result)
    chain.maybe_single = MagicMock(return_value=chain)
    chain.eq = MagicMock(return_value=chain)
    chain.select = MagicMock(return_value=chain)
    tbl = MagicMock()
    tbl.select = MagicMock(return_value=chain)
    mock_db.table = MagicMock(return_value=tbl)

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post("/api/admin/login", json={"username": "test", "password": "test"})
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.json().get("detail") != ADMIN_UNAUTH_MSG, (
        "Login path was incorrectly blocked by AdminJWTMiddleware"
    )
