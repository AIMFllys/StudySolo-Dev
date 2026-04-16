# -*- coding: utf-8 -*-
"""
Property-Based Tests: 会员分布和评分属性测试
Feature: admin-panel

Properties:
  P16: Member tier distribution — free/pro/pro_plus/ultra counts are non-negative,
       paid_total = pro + pro_plus + ultra, total = free + paid_total
  P17: Ratings NPS/CSAT aggregation — NPS score in [-100, 100],
       CSAT avg in [1, 5] when data exists, counts are non-negative
Validates: Requirements 12.1, 13.1
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
VALID_TIERS = ["free", "pro", "pro_plus", "ultra"]


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

def _make_members_db_mock(tier_rows: list[dict] | None = None) -> AsyncMock:
    """Build a mock Supabase AsyncClient for member queries."""
    mock_db = MagicMock()
    _rows = tier_rows or []

    def _make_chain(count=0, data=None):
        result = MagicMock()
        result.count = count
        result.data = data if data is not None else []

        chain = MagicMock()
        chain.execute = AsyncMock(return_value=result)
        chain.eq = MagicMock(return_value=chain)
        chain.neq = MagicMock(return_value=chain)
        chain.gte = MagicMock(return_value=chain)
        chain.order = MagicMock(return_value=chain)
        chain.range = MagicMock(return_value=chain)
        chain.select = MagicMock(return_value=chain)
        chain.limit = MagicMock(return_value=chain)
        return chain

    def table_side_effect(table_name: str):
        tbl = MagicMock()
        if table_name == "user_profiles":
            tbl.select = MagicMock(return_value=_make_chain(count=len(_rows), data=_rows))
        elif table_name == "subscriptions":
            tbl.select = MagicMock(return_value=_make_chain(count=0, data=[]))
        else:
            tbl.select = MagicMock(return_value=_make_chain())
        return tbl

    mock_db.table = MagicMock(side_effect=table_side_effect)
    return mock_db


def _make_ratings_db_mock(rating_rows: list[dict] | None = None) -> AsyncMock:
    """Build a mock Supabase AsyncClient for ratings queries."""
    mock_db = MagicMock()
    _rows = rating_rows or []

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
        chain.limit = MagicMock(return_value=chain)
        return chain

    def table_side_effect(table_name: str):
        tbl = MagicMock()
        if table_name == "ss_feedback":
            tbl.select = MagicMock(return_value=_make_chain(count=len(_rows), data=_rows))
        else:
            tbl.select = MagicMock(return_value=_make_chain())
        return tbl

    mock_db.table = MagicMock(side_effect=table_side_effect)
    return mock_db


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

_tier_st = st.sampled_from(VALID_TIERS)

_tier_rows_st = st.lists(
    st.fixed_dictionaries({"tier": _tier_st}),
    min_size=0,
    max_size=50,
)

_feedback_rows_st = st.lists(
    st.fixed_dictionaries(
        {
            "rating": st.integers(min_value=1, max_value=5),
            "reward_applied": st.booleans(),
        }
    ),
    min_size=0,
    max_size=30,
)


# ---------------------------------------------------------------------------
# Property 16a: Tier counts are non-negative and sum correctly
# Validates: Requirements 12.1
# ---------------------------------------------------------------------------

@given(tier_rows=_tier_rows_st)
@hyp_settings(max_examples=20)
def test_p16_tier_counts_sum_correctly(tier_rows: list[dict]):
    """
    **Validates: Requirements 12.1**

    Property 16a: For any set of user_profiles rows with valid tiers,
    the stats response must satisfy:
      - All counts >= 0
      - paid_total = pro + pro_plus + ultra
      - total = free + pro + pro_plus + ultra
    """
    mock_db = _make_members_db_mock(tier_rows)
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/members/stats")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    body = response.json()

    free = body["free"]
    pro = body["pro"]
    pro_plus = body["pro_plus"]
    ultra = body["ultra"]
    total = body["total"]
    paid_total = body["paid_total"]

    assert free >= 0
    assert pro >= 0
    assert pro_plus >= 0
    assert ultra >= 0
    assert paid_total == pro + pro_plus + ultra, (
        f"paid_total={paid_total} != pro({pro}) + pro_plus({pro_plus}) + ultra({ultra})"
    )
    assert total == free + pro + pro_plus + ultra, (
        f"total={total} != free({free}) + pro({pro}) + pro_plus({pro_plus}) + ultra({ultra})"
    )


# ---------------------------------------------------------------------------
# Property 16b: Tier counts match input data
# Validates: Requirements 12.1
# ---------------------------------------------------------------------------

@given(tier_rows=_tier_rows_st)
@hyp_settings(max_examples=20)
def test_p16_tier_counts_match_input(tier_rows: list[dict]):
    """
    **Validates: Requirements 12.1**

    Property 16b: The tier counts in the response must exactly match
    the counts in the input data.
    """
    mock_db = _make_members_db_mock(tier_rows)
    token = _make_admin_token()

    # Compute expected counts from input
    expected: dict[str, int] = {"free": 0, "pro": 0, "pro_plus": 0, "ultra": 0}
    for row in tier_rows:
        t = row.get("tier", "free") or "free"
        if t in expected:
            expected[t] += 1
        else:
            expected["free"] += 1

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/members/stats")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()

    for tier_key in ["free", "pro", "pro_plus", "ultra"]:
        assert body[tier_key] == expected[tier_key], (
            f"Tier {tier_key}: expected {expected[tier_key]}, got {body[tier_key]}"
        )


# ---------------------------------------------------------------------------
# Property 17a: Avg rating is in [1, 5] when data exists
# Validates: Requirements 13.1
# ---------------------------------------------------------------------------

@given(feedback_rows=_feedback_rows_st)
@hyp_settings(max_examples=20)
def test_p17_avg_rating_in_valid_range(feedback_rows: list[dict]):
    """
    **Validates: Requirements 13.1**

    Property 17a: For any set of ss_feedback ratings (scores 1-5),
    avg_rating must be None when no data, otherwise in [1, 5].
    """
    mock_db = _make_ratings_db_mock(feedback_rows)
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/ratings/overview")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()

    total_count = body["total_count"]
    avg_rating = body["avg_rating"]

    assert total_count == len(feedback_rows), (
        f"total_count={total_count} != {len(feedback_rows)}"
    )

    if total_count == 0:
        assert avg_rating is None, (
            f"avg_rating should be None when no data, got {avg_rating}"
        )
    else:
        assert avg_rating is not None
        assert 1.0 <= avg_rating <= 5.0, (
            f"avg_rating {avg_rating} out of range [1, 5]"
        )


# ---------------------------------------------------------------------------
# Property 17b: Distribution counts must match input
# Validates: Requirements 13.1
# ---------------------------------------------------------------------------

@given(feedback_rows=_feedback_rows_st)
@hyp_settings(max_examples=20)
def test_p17_distribution_matches_input(feedback_rows: list[dict]):
    """
    **Validates: Requirements 13.1**

    Property 17b: rating_distribution keys 1..5 must exactly match
    the score frequencies in input rows.
    """
    mock_db = _make_ratings_db_mock(feedback_rows)
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/ratings/overview")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()

    distribution = body["rating_distribution"]
    expected = {score: 0 for score in range(1, 6)}
    for row in feedback_rows:
        expected[int(row["rating"])] += 1

    for score in range(1, 6):
        key = str(score) if str(score) in distribution else score
        assert distribution[key] == expected[score], (
            f"distribution[{score}]={distribution[key]} != {expected[score]}"
        )


# ---------------------------------------------------------------------------
# Property 17c: reward_applied_count must match input
# Validates: Requirements 13.1
# ---------------------------------------------------------------------------

@given(feedback_rows=_feedback_rows_st)
@hyp_settings(max_examples=20)
def test_p17_reward_applied_count_matches_input(feedback_rows: list[dict]):
    """
    **Validates: Requirements 13.1**

    Property 17c: reward_applied_count must equal number of rows where
    reward_applied is truthy.
    """
    mock_db = _make_ratings_db_mock(feedback_rows)
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/ratings/overview")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()

    expected_reward_applied = sum(1 for row in feedback_rows if row["reward_applied"])
    assert body["reward_applied_count"] == expected_reward_applied, (
        f"reward_applied_count={body['reward_applied_count']} != {expected_reward_applied}"
    )


# ---------------------------------------------------------------------------
# Baseline unit tests
# ---------------------------------------------------------------------------

def test_member_stats_empty_returns_zeros():
    """GET /api/admin/members/stats with no users returns all zeros."""
    mock_db = _make_members_db_mock([])
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/members/stats")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()
    assert body["free"] == 0
    assert body["pro"] == 0
    assert body["pro_plus"] == 0
    assert body["ultra"] == 0
    assert body["total"] == 0
    assert body["paid_total"] == 0


def test_ratings_overview_empty_returns_nulls():
    """GET /api/admin/ratings/overview with no ratings returns zero/empty stats."""
    mock_db = _make_ratings_db_mock([])
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/ratings/overview")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()
    assert body["total_count"] == 0
    assert body["avg_rating"] is None
    assert body["reward_applied_count"] == 0
    distribution = body["rating_distribution"]
    for score in range(1, 6):
        key = str(score) if str(score) in distribution else score
        assert distribution[key] == 0


def test_members_stats_without_token_returns_401():
    """GET /api/admin/members/stats without token returns 401."""
    mock_db = _make_members_db_mock()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/admin/members/stats")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401


def test_ratings_overview_without_token_returns_401():
    """GET /api/admin/ratings/overview without token returns 401."""
    mock_db = _make_ratings_db_mock()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app, raise_server_exceptions=False)
        response = client.get("/api/admin/ratings/overview")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 401


def test_avg_rating_all_five_stars():
    """avg_rating = 5.0 when all ratings are 5."""
    rows = [{"rating": 5, "reward_applied": False}] * 5
    mock_db = _make_ratings_db_mock(rows)
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/ratings/overview")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()
    assert body["avg_rating"] == 5.0


def test_avg_rating_all_one_stars():
    """avg_rating = 1.0 when all ratings are 1."""
    rows = [{"rating": 1, "reward_applied": True}] * 5
    mock_db = _make_ratings_db_mock(rows)
    token = _make_admin_token()

    async def _override_get_db():
        return mock_db

    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = _make_admin_client(token, raise_server_exceptions=True)
        response = client.get("/api/admin/ratings/overview")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200
    body = response.json()
    assert body["avg_rating"] == 1.0
