"""
Property 20: CORS 来源限制
Feature: studysolo-mvp, Property 20: CORS 来源限制

For any cross-origin request from a domain not matching CORS_ORIGIN,
the CORS middleware must not return Access-Control-Allow-Origin header.

Validates: Requirements 9.1
"""

import importlib
import os

from fastapi.testclient import TestClient
from hypothesis import given, settings
from hypothesis import strategies as st

# Set required env vars before importing app
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ["JWT_SECRET"] = "test-jwt-secret-for-testing-only"
os.environ["CORS_ORIGIN"] = "https://studysolo.example.com"

from app.core.config import get_settings


ALLOWED_ORIGIN = "https://studysolo.example.com"


def _build_client() -> TestClient:
    """Create a fresh app instance after applying test env overrides."""
    get_settings.cache_clear()
    import app.main as app_main
    reloaded = importlib.reload(app_main)
    return TestClient(reloaded.app, raise_server_exceptions=False)

# Strategy: generate domains that are NOT the allowed origin
_disallowed_origin = st.from_regex(
    r"https://[a-z]{3,10}\.[a-z]{2,5}",
    fullmatch=True,
).filter(lambda s: s != ALLOWED_ORIGIN)


@given(_disallowed_origin)
@settings(max_examples=100)
def test_cors_rejects_disallowed_origins(origin: str):
    """Requests from non-allowed origins must not receive ACAO header."""
    client = _build_client()
    response = client.get(
        "/api/health",
        headers={"Origin": origin},
    )
    acao = response.headers.get("access-control-allow-origin", "")
    assert acao != origin, (
        f"Origin '{origin}' should be rejected but got ACAO: '{acao}'"
    )
    assert acao != "*", "Wildcard ACAO must never be returned"


def test_cors_allows_configured_origin():
    """Requests from the configured CORS_ORIGIN must receive ACAO header."""
    client = _build_client()
    response = client.get(
        "/api/health",
        headers={"Origin": ALLOWED_ORIGIN},
    )
    acao = response.headers.get("access-control-allow-origin", "")
    assert acao == ALLOWED_ORIGIN, (
        f"Expected ACAO '{ALLOWED_ORIGIN}', got '{acao}'"
    )


def test_cors_preflight_allowed_origin():
    """OPTIONS preflight from allowed origin must succeed."""
    client = _build_client()
    response = client.options(
        "/api/health",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code in (200, 204)
    acao = response.headers.get("access-control-allow-origin", "")
    assert acao == ALLOWED_ORIGIN
