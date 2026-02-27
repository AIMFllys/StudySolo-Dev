"""
Property-Based Test: JWT 中间件拒绝无效令牌
Feature: studysolo-mvp, Property 2: JWT 中间件拒绝无效令牌

Validates: Requirements 2.8, 9.3, 9.6
"""

import sys
from types import ModuleType
from unittest.mock import AsyncMock

# ---------------------------------------------------------------------------
# Stub out 'supabase' before any app module is imported.
# ---------------------------------------------------------------------------

def _install_supabase_stub():
    if "supabase" not in sys.modules:
        stub = ModuleType("supabase")
        stub.AsyncClient = object  # type: ignore[attr-defined]
        stub.create_async_client = AsyncMock()  # type: ignore[attr-defined]
        sys.modules["supabase"] = stub
    for sub in ("supabase._async", "supabase._async.client", "supabase.lib"):
        sys.modules.setdefault(sub, ModuleType(sub))


_install_supabase_stub()

import os
import jwt as pyjwt  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402
from hypothesis import given, settings as hyp_settings  # noqa: E402
from hypothesis import strategies as st  # noqa: E402

# Ensure a JWT_SECRET is set before importing app (pydantic-settings requires it)
os.environ.setdefault("JWT_SECRET", "test-secret-for-property-tests")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

from app.main import app  # noqa: E402
from app.core.config import get_settings  # noqa: E402

# ---------------------------------------------------------------------------
# A protected route to test against — /api/auth/me requires a valid JWT.
# ---------------------------------------------------------------------------
PROTECTED_PATH = "/api/auth/me"

# ---------------------------------------------------------------------------
# Strategies for generating invalid tokens
# ---------------------------------------------------------------------------

# Random printable strings that are NOT valid JWTs
_random_string = st.text(
    alphabet=st.characters(min_codepoint=33, max_codepoint=126),
    min_size=1,
    max_size=256,
).filter(lambda s: "." not in s or s.count(".") != 2)

# Strings that look like JWTs (3 dot-separated parts) but have wrong content
_fake_jwt_parts = st.builds(
    lambda a, b, c: f"{a}.{b}.{c}",
    st.text(alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", min_size=1, max_size=64),
    st.text(alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", min_size=1, max_size=64),
    st.text(alphabet="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", min_size=1, max_size=64),
)

# JWTs signed with a WRONG secret
_wrong_secret_jwt = st.builds(
    lambda sub, wrong_secret: pyjwt.encode(
        {"sub": sub, "exp": 9999999999},
        wrong_secret,
        algorithm="HS256",
    ),
    sub=st.text(min_size=1, max_size=64),
    wrong_secret=st.text(min_size=8, max_size=64).filter(
        lambda s: s != os.environ.get("JWT_SECRET", "test-secret-for-property-tests")
    ),
)

# Combine all invalid token strategies
_invalid_token = st.one_of(_random_string, _fake_jwt_parts, _wrong_secret_jwt)


# ---------------------------------------------------------------------------
# Property 2: JWT 中间件拒绝无效令牌
# For any protected API route request carrying an invalid JWT token
# (malformed, wrong signature, expired), the middleware must return 401.
# Validates: Requirements 2.8, 9.3, 9.6
# ---------------------------------------------------------------------------

@given(invalid_token=_invalid_token)
@hyp_settings(max_examples=100)
def test_middleware_rejects_invalid_tokens(invalid_token: str):
    """
    **Validates: Requirements 2.8, 9.3, 9.6**

    Property 2: JWT 中间件拒绝无效令牌
    For any protected API route request with an invalid JWT token
    (malformed, wrong signature, expired), the middleware must return 401.
    """
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get(
        PROTECTED_PATH,
        headers={"Authorization": f"Bearer {invalid_token}"},
    )
    assert response.status_code == 401, (
        f"Expected 401 for invalid token '{invalid_token[:40]}...', "
        f"got {response.status_code}: {response.text}"
    )


@given(invalid_token=_invalid_token)
@hyp_settings(max_examples=50)
def test_middleware_rejects_invalid_tokens_via_cookie(invalid_token: str):
    """
    **Validates: Requirements 2.8, 9.3, 9.6**

    Property 2 (cookie variant): JWT 中间件拒绝无效令牌 (via cookie)
    Invalid tokens passed as access_token cookie must also return 401.
    """
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get(
        PROTECTED_PATH,
        cookies={"access_token": invalid_token},
    )
    assert response.status_code == 401, (
        f"Expected 401 for invalid cookie token '{invalid_token[:40]}...', "
        f"got {response.status_code}: {response.text}"
    )


def test_middleware_rejects_missing_token():
    """Baseline: request with no token at all must return 401."""
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get(PROTECTED_PATH)
    assert response.status_code == 401


def test_middleware_rejects_expired_token():
    """Baseline: an expired JWT (signed with correct secret) must return 401."""
    settings = get_settings()
    expired_token = pyjwt.encode(
        {"sub": "user-id", "exp": 1},  # exp=1 is far in the past
        settings.jwt_secret,
        algorithm="HS256",
    )
    client = TestClient(app, raise_server_exceptions=False)
    response = client.get(
        PROTECTED_PATH,
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
