"""
Property-Based Test: 认证 Cookie 安全属性
Feature: studysolo-mvp, Property 1: 认证 Cookie 安全属性

Validates: Requirements 2.4
"""

import sys
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock

# ---------------------------------------------------------------------------
# Stub out 'supabase' before any app module is imported so that the test
# can run without the native supabase wheel being installed.
# ---------------------------------------------------------------------------

def _install_supabase_stub():
    if "supabase" not in sys.modules:
        stub = ModuleType("supabase")
        # Provide the symbols that app.core.database imports
        stub.AsyncClient = object  # type: ignore[attr-defined]
        stub.create_async_client = AsyncMock()  # type: ignore[attr-defined]
        sys.modules["supabase"] = stub
    for sub in ("supabase._async", "supabase._async.client", "supabase.lib"):
        sys.modules.setdefault(sub, ModuleType(sub))
    async_client_mod = sys.modules["supabase._async.client"]
    if not hasattr(async_client_mod, "AsyncClient"):
        async_client_mod.AsyncClient = object  # type: ignore[attr-defined]


_install_supabase_stub()

import os  # noqa: E402
from tests._helpers import TEST_JWT_SECRET  # noqa: E402

os.environ.setdefault("JWT_SECRET", TEST_JWT_SECRET)
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ["ENVIRONMENT"] = "production"

# Now safe to import app modules
from fastapi.testclient import TestClient  # noqa: E402
from hypothesis import given, settings as hyp_settings  # noqa: E402
from hypothesis import strategies as st  # noqa: E402

from app.main import app  # noqa: E402
from app.core.database import get_db, get_anon_db  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_db_mock(email: str):
    """Return a mock Supabase-like client that simulates a successful login."""
    mock_user = MagicMock()
    mock_user.id = "test-user-id"
    mock_user.email = email
    mock_user.user_metadata = {}

    mock_session = MagicMock()
    mock_session.access_token = "fake-access-token"
    mock_session.refresh_token = "fake-refresh-token"

    mock_result = MagicMock()
    mock_result.user = mock_user
    mock_result.session = mock_session

    mock_auth = AsyncMock()
    mock_auth.sign_in_with_password = AsyncMock(return_value=mock_result)

    mock_db = MagicMock()
    mock_db.auth = mock_auth
    return mock_db


def _get_set_cookie_headers(response) -> list:
    """Extract individual Set-Cookie directives from a TestClient response.

    TestClient (httpx) may combine multiple Set-Cookie values into a single
    comma-separated header string.  We split on ', <name>=' boundaries so
    that each cookie directive is treated independently.
    """
    raw = [v for k, v in response.headers.items() if k.lower() == "set-cookie"]
    # Flatten: split combined headers like "a=1; Path=/, b=2; Path=/"
    result = []
    for header_value in raw:
        # Split on ', ' followed by a word character (start of next cookie name)
        import re
        parts = re.split(r",\s+(?=\w+=)", header_value)
        result.extend(p.strip() for p in parts)
    return result


def _assert_cookie_security(set_cookie_headers: list, cookie_name: str):
    """Assert that a named cookie has HttpOnly, Secure, SameSite=Lax."""
    matching = [h for h in set_cookie_headers if h.lower().startswith(f"{cookie_name.lower()}=")]
    assert matching, (
        f"Cookie '{cookie_name}' not found in Set-Cookie headers: {set_cookie_headers}"
    )
    header = matching[0].lower()
    assert "httponly" in header, f"Cookie '{cookie_name}' missing HttpOnly. Header: {header}"
    assert "secure" in header, f"Cookie '{cookie_name}' missing Secure. Header: {header}"
    assert "samesite=lax" in header, (
        f"Cookie '{cookie_name}' missing SameSite=Lax. Header: {header}"
    )


# ---------------------------------------------------------------------------
# Property 1: 认证 Cookie 安全属性
# For any successful login response, Set-Cookie headers for access_token and
# refresh_token must contain HttpOnly, Secure, and SameSite=Lax.
# Validates: Requirements 2.4
# ---------------------------------------------------------------------------

@given(
    email=st.emails(),
    password=st.text(
        alphabet=st.characters(min_codepoint=33, max_codepoint=126),
        min_size=8,
        max_size=64,
    ),
)
@hyp_settings(max_examples=50)
def test_login_cookies_have_security_attributes(email: str, password: str):
    """
    **Validates: Requirements 2.4**

    Property 1: 认证 Cookie 安全属性
    For any successful login, the Set-Cookie headers for access_token and
    refresh_token must include HttpOnly, Secure, and SameSite=Lax.
    """
    mock_db = _make_db_mock(email)

    async def _override_get_db():
        return mock_db

    # Use FastAPI dependency override to inject the mock DB
    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_anon_db] = _override_get_db
    try:
        client = TestClient(
            app,
            raise_server_exceptions=True,
            base_url="https://testserver",
        )
        response = client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_anon_db, None)

    assert response.status_code == 200, (
        f"Expected 200, got {response.status_code}: {response.text}"
    )

    set_cookie_headers = _get_set_cookie_headers(response)
    _assert_cookie_security(set_cookie_headers, "access_token")
    _assert_cookie_security(set_cookie_headers, "refresh_token")
