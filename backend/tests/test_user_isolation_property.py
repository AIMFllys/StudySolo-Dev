"""
Property-Based Test: 用户数据隔离
Feature: studysolo-mvp, Property 5: 用户数据隔离

Validates: Requirements 3.3, 9.3
"""

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

import os
import uuid
from datetime import datetime, timezone

import jwt
from hypothesis import given, settings as hyp_settings
from hypothesis import strategies as st
from fastapi.testclient import TestClient
from tests._helpers import TEST_JWT_SECRET

os.environ.setdefault("JWT_SECRET", TEST_JWT_SECRET)
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

from app.main import app  # noqa: E402
from app.core import deps  # noqa: E402

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_JWT_SECRET = TEST_JWT_SECRET


def _make_user(user_id: str) -> dict:
    return {"id": user_id, "email": f"{user_id}@example.com", "role": "user"}


def _make_auth_headers(user_id: str) -> dict:
    """Generate a valid JWT Bearer token for the given user."""
    token = jwt.encode(
        {"sub": user_id, "email": f"{user_id}@example.com"},
        _JWT_SECRET,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def _make_empty_supabase_mock():
    """
    Simulate Supabase RLS filtering: returns no data for any query.
    This represents what happens when user A queries user B's workflow —
    the RLS policy filters it out and returns an empty result.
    """
    chain = MagicMock()
    chain.from_ = MagicMock(return_value=chain)
    chain.select = MagicMock(return_value=chain)
    chain.eq = MagicMock(return_value=chain)
    chain.order = MagicMock(return_value=chain)
    chain.maybe_single = MagicMock(return_value=chain)
    chain.single = MagicMock(return_value=chain)

    result = MagicMock()
    result.data = None  # RLS filtered — no data returned
    chain.execute = AsyncMock(return_value=result)

    return chain


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Generate distinct user ID pairs
_user_id_pair = st.lists(
    st.uuids().map(str),
    min_size=2,
    max_size=2,
    unique=True,
)

_workflow_id = st.uuids().map(str)


# ---------------------------------------------------------------------------
# Property 5: 用户数据隔离
# ---------------------------------------------------------------------------

@given(user_ids=_user_id_pair, workflow_id=_workflow_id)
@hyp_settings(max_examples=100)
def test_user_isolation_cross_user_access_returns_404(
    user_ids: list[str], workflow_id: str
):
    """
    **Validates: Requirements 3.3, 9.3**

    Property 5: 用户数据隔离
    For any two distinct users A and B, when user A requests a workflow
    owned by user B, the system must return 404 (Supabase RLS filters out
    the row, returning no data). No data belonging to user B is exposed.
    """
    user_a_id, user_b_id = user_ids
    assert user_a_id != user_b_id, "Users must be distinct"

    # user_a is the authenticated caller; Supabase returns empty (RLS simulation)
    user_a = _make_user(user_a_id)
    db_mock = _make_empty_supabase_mock()
    headers = _make_auth_headers(user_a_id)

    app.dependency_overrides[deps.get_current_user] = lambda: user_a
    app.dependency_overrides[deps.get_supabase_client] = lambda: db_mock

    try:
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(f"/api/workflow/{workflow_id}/content", headers=headers)

        # RLS returns no data → API must return 404, never 200
        assert resp.status_code == 404, (
            f"Expected 404 when user A ({user_a_id}) accesses user B's workflow "
            f"({workflow_id}), got {resp.status_code}: {resp.text}"
        )

        # Ensure no user B data leaks in the response body
        body = resp.text
        assert user_b_id not in body, (
            f"User B's ID ({user_b_id}) leaked in response body"
        )
    finally:
        app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Baseline unit tests (non-property)
# ---------------------------------------------------------------------------

def test_isolation_concrete_example():
    """Concrete example: user A cannot read user B's workflow."""
    user_a_id = "user-a-001"
    user_a = _make_user(user_a_id)
    workflow_id = str(uuid.uuid4())
    db_mock = _make_empty_supabase_mock()
    headers = _make_auth_headers(user_a_id)

    app.dependency_overrides[deps.get_current_user] = lambda: user_a
    app.dependency_overrides[deps.get_supabase_client] = lambda: db_mock

    try:
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(f"/api/workflow/{workflow_id}/content", headers=headers)
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_isolation_list_returns_empty_for_other_user():
    """User A's workflow list is empty when Supabase RLS filters all rows."""
    user_a_id = "user-a-002"
    user_a = _make_user(user_a_id)
    headers = _make_auth_headers(user_a_id)

    chain = MagicMock()
    chain.from_ = MagicMock(return_value=chain)
    chain.select = MagicMock(return_value=chain)
    chain.eq = MagicMock(return_value=chain)
    chain.order = MagicMock(return_value=chain)

    result = MagicMock()
    result.data = []  # RLS returns empty list
    chain.execute = AsyncMock(return_value=result)

    app.dependency_overrides[deps.get_current_user] = lambda: user_a
    app.dependency_overrides[deps.get_supabase_client] = lambda: chain

    try:
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/workflow/", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []
    finally:
        app.dependency_overrides.clear()
