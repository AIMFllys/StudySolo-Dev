# -*- coding: utf-8 -*-
"""Security hardening regression tests for auth-related fixes."""

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
        sys.modules.setdefault(sub, ModuleType(sub))
    async_client_mod = sys.modules["supabase._async.client"]
    if not hasattr(async_client_mod, "AsyncClient"):
        async_client_mod.AsyncClient = object


_install_supabase_stub()

import os

import pytest
from fastapi.testclient import TestClient
from jose import jwt

os.environ.setdefault("JWT_SECRET", "test-secret-for-auth-security-hardening")
os.environ.setdefault("CAPTCHA_SECRET", "test-captcha-secret-for-auth-security-hardening")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ENVIRONMENT", "development")

from app.main import app
from app.middleware import admin_auth as admin_auth_middleware
from app.api.auth import captcha as captcha_module
from app.services.email_service import verify_code


def _make_admin_token() -> str:
    return jwt.encode(
        {"sub": "admin-1", "username": "root", "type": "admin"},
        os.environ["JWT_SECRET"],
        algorithm="HS256",
    )


def test_admin_middleware_returns_503_when_db_check_errors(monkeypatch):
    class _BrokenAdminChain:
        def select(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def maybe_single(self):
            return self

        async def execute(self):
            raise RuntimeError("db down")

    broken_db = MagicMock()
    broken_db.table = MagicMock(return_value=_BrokenAdminChain())

    async def _broken_get_db():
        return broken_db

    monkeypatch.setattr(admin_auth_middleware, "get_db", _broken_get_db)

    client = TestClient(app, raise_server_exceptions=False)
    client.cookies.set("admin_token", _make_admin_token())
    response = client.get("/api/admin/users")

    assert response.status_code == 503
    assert response.json()["detail"] == "管理员鉴权服务暂不可用，请稍后重试"


@pytest.mark.asyncio
async def test_captcha_token_can_only_be_consumed_once():
    challenge_id = "challenge-1"
    token_ts = "1700000000"
    token = f"{challenge_id}:{token_ts}:{captcha_module._sign(f'{challenge_id}:{token_ts}')}"

    result = MagicMock()
    result.data = {"id": challenge_id, "verified": True, "consumed": False}
    empty_result = MagicMock()
    empty_result.data = {"id": challenge_id, "verified": True, "consumed": True}

    select_chain = MagicMock()
    select_chain.eq = MagicMock(return_value=select_chain)
    select_chain.gte = MagicMock(return_value=select_chain)
    select_chain.maybe_single = MagicMock(return_value=select_chain)
    select_chain.execute = AsyncMock(side_effect=[result, result, empty_result])

    update_chain = MagicMock()
    update_chain.eq = MagicMock(return_value=update_chain)
    update_chain.execute = AsyncMock(return_value=MagicMock())

    db = MagicMock()
    table = MagicMock()
    table.select = MagicMock(return_value=select_chain)
    table.update = MagicMock(return_value=update_chain)
    db.from_ = MagicMock(return_value=table)

    assert await captcha_module.verify_captcha_token(token, db) is True
    assert await captcha_module.consume_captcha_token(token, db) is True
    assert await captcha_module.consume_captcha_token(token, db) is False


@pytest.mark.asyncio
async def test_verify_code_invalid_attempts_exhaust_latest_code():
    class _Query:
        def __init__(self, db):
            self.db = db

        def select(self, *_args, **_kwargs):
            return self

        def eq(self, key, value):
            self.db.filters[key] = value
            return self

        def gte(self, *_args, **_kwargs):
            return self

        def order(self, *_args, **_kwargs):
            return self

        def limit(self, *_args, **_kwargs):
            return self

        async def execute(self):
            return MagicMock(data=[self.db.record] if self.db.record else [])

    class _Update:
        def __init__(self, db, payload):
            self.db = db
            self.payload = payload

        def eq(self, key, value):
            if key == "id" and self.db.record and self.db.record["id"] == value:
                self.db.record.update(self.payload)
            return self

        async def execute(self):
            return MagicMock()

    class _Table:
        def __init__(self, db):
            self.db = db

        def select(self, *_args, **_kwargs):
            return _Query(self.db)

        def update(self, payload):
            return _Update(self.db, payload)

    class _FakeDB:
        def __init__(self):
            self.record = {
                "id": "code-1",
                "code": "123456",
                "attempt_count": 4,
                "is_used": False,
            }
            self.filters = {}

        def from_(self, _table_name):
            self.filters = {}
            return _Table(self)

    db = _FakeDB()

    assert await verify_code("user@example.com", "000000", "register", db) is False
    assert db.record["attempt_count"] == 5
    assert db.record["is_used"] is True

    assert await verify_code("user@example.com", "123456", "register", db) is False


def test_missing_captcha_secret_is_rejected(monkeypatch):
    monkeypatch.delenv("CAPTCHA_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="CAPTCHA_SECRET 未配置"):
        captcha_module._get_captcha_secret()
