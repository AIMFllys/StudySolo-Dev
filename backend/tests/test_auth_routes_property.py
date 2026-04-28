"""Property tests for auth routes — login, register, logout, refresh.

Uses FastAPI TestClient with mocked Supabase dependencies.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.auth.login import router as login_router
from app.api.auth.register import router as register_router
from app.core.deps import get_anon_supabase_client, get_supabase_client


# ── Test app setup ───────────────────────────────────────────────────────────

def _make_app():
    app = FastAPI()
    app.include_router(login_router, prefix="/auth")
    app.include_router(register_router, prefix="/auth")
    return app


def _mock_db():
    db = AsyncMock()
    db.from_ = MagicMock(return_value=db)
    db.select = MagicMock(return_value=db)
    db.eq = MagicMock(return_value=db)
    db.gte = MagicMock(return_value=db)
    db.limit = MagicMock(return_value=db)
    db.maybe_single = MagicMock(return_value=db)
    db.execute = AsyncMock(return_value=SimpleNamespace(data=None))
    db.upsert = MagicMock(return_value=db)
    db.auth = AsyncMock()
    db.auth.admin = AsyncMock()
    return db


# ── Login tests ──────────────────────────────────────────────────────────────

class TestLogin:
    def _client(self, anon_db=None, db=None):
        app = _make_app()
        app.dependency_overrides[get_anon_supabase_client] = lambda: anon_db or _mock_db()
        app.dependency_overrides[get_supabase_client] = lambda: db or _mock_db()
        return TestClient(app)

    def test_login_success(self):
        anon_db = _mock_db()
        anon_db.auth.sign_in_with_password = AsyncMock(return_value=SimpleNamespace(
            session=SimpleNamespace(access_token="at", refresh_token="rt"),
            user=SimpleNamespace(id="u1", email="a@b.com", user_metadata={"name": "Test"}),
        ))
        db = _mock_db()
        db.from_ = MagicMock(return_value=db)
        db.select = MagicMock(return_value=db)
        db.eq = MagicMock(return_value=db)
        db.maybe_single = MagicMock(return_value=db)
        db.execute = AsyncMock(return_value=SimpleNamespace(data={"tier": "free", "nickname": "Test"}))

        client = self._client(anon_db, db)
        resp = client.post("/auth/login", json={"email": "a@b.com", "password": "pass123"})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["user"]["email"] == "a@b.com"

    def test_login_invalid_credentials(self):
        anon_db = _mock_db()
        anon_db.auth.sign_in_with_password = AsyncMock(side_effect=Exception("Invalid credentials"))
        client = self._client(anon_db)
        resp = client.post("/auth/login", json={"email": "a@b.com", "password": "wrong"})
        assert resp.status_code == 401

    def test_login_email_not_confirmed(self):
        anon_db = _mock_db()
        anon_db.auth.sign_in_with_password = AsyncMock(side_effect=Exception("Email not confirmed"))
        client = self._client(anon_db)
        resp = client.post("/auth/login", json={"email": "a@b.com", "password": "pass"})
        assert resp.status_code == 403

    def test_login_missing_email(self):
        client = self._client()
        resp = client.post("/auth/login", json={"password": "pass"})
        assert resp.status_code == 422

    def test_login_missing_password(self):
        client = self._client()
        resp = client.post("/auth/login", json={"email": "a@b.com"})
        assert resp.status_code == 422

    def test_login_null_session(self):
        anon_db = _mock_db()
        anon_db.auth.sign_in_with_password = AsyncMock(return_value=SimpleNamespace(session=None, user=None))
        client = self._client(anon_db)
        resp = client.post("/auth/login", json={"email": "a@b.com", "password": "pass"})
        assert resp.status_code == 401


# ── Logout tests ─────────────────────────────────────────────────────────────

class TestLogout:
    def test_logout_clears_cookies(self):
        app = _make_app()
        db = _mock_db()
        app.dependency_overrides[get_supabase_client] = lambda: db
        client = TestClient(app)
        resp = client.post("/auth/logout")
        assert resp.status_code == 200
        assert "已退出" in resp.json()["message"]


# ── Register tests ───────────────────────────────────────────────────────────

class TestRegister:
    def _client(self, anon_db=None, db=None):
        app = _make_app()
        app.dependency_overrides[get_anon_supabase_client] = lambda: anon_db or _mock_db()
        app.dependency_overrides[get_supabase_client] = lambda: db or _mock_db()
        return TestClient(app)

    def test_register_missing_terms_agreement(self):
        client = self._client()
        resp = client.post("/auth/register", json={
            "email": "a@b.com", "password": "pass123456",
            "verification_code": "123456",
            "agreed_to_terms": False, "agreed_to_privacy": True,
        })
        assert resp.status_code == 400
        assert "服务条款" in resp.json()["detail"]

    def test_register_missing_privacy_agreement(self):
        client = self._client()
        resp = client.post("/auth/register", json={
            "email": "a@b.com", "password": "pass123456",
            "verification_code": "123456",
            "agreed_to_terms": True, "agreed_to_privacy": False,
        })
        assert resp.status_code == 400

    def test_register_missing_fields(self):
        client = self._client()
        resp = client.post("/auth/register", json={"email": "a@b.com"})
        assert resp.status_code == 422

    @patch("app.api.auth.register.verify_code", new_callable=AsyncMock, return_value=False)
    @patch("app.api.auth.register.is_rate_limited", new_callable=AsyncMock, return_value=False)
    @patch("app.api.auth.register.record_rate_limit_failure", new_callable=AsyncMock)
    def test_register_invalid_verification_code(self, mock_record, mock_rate, mock_verify):
        client = self._client()
        resp = client.post("/auth/register", json={
            "email": "a@b.com", "password": "pass123456",
            "verification_code": "000000",
            "agreed_to_terms": True, "agreed_to_privacy": True,
        })
        assert resp.status_code == 400
        assert "验证码" in resp.json()["detail"]

    @patch("app.api.auth.register.is_rate_limited", new_callable=AsyncMock, return_value=True)
    def test_register_rate_limited(self, mock_rate):
        client = self._client()
        resp = client.post("/auth/register", json={
            "email": "a@b.com", "password": "pass123456",
            "verification_code": "123456",
            "agreed_to_terms": True, "agreed_to_privacy": True,
        })
        assert resp.status_code == 429


# ── Refresh tests ────────────────────────────────────────────────────────────

class TestRefresh:
    def test_refresh_no_token(self):
        app = _make_app()
        app.dependency_overrides[get_anon_supabase_client] = lambda: _mock_db()
        client = TestClient(app)
        resp = client.post("/auth/refresh")
        assert resp.status_code == 401
