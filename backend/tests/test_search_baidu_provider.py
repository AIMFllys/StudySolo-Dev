"""Unit tests for the Qiniu Baidu search provider (app.services.search_baidu).

Covers:
- Successful /v1/search/web response parsing (happy path)
- HTTP 4xx/5xx → error field populated, not treated as empty
- httpx network errors → error field populated
- Missing API key → early error return (no network call)
- Malformed JSON / success=false → error field populated
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import httpx
import pytest

from app.services import search_baidu as sb


class _FakeResponse:
    def __init__(self, status_code: int, body: Any = None, text: str = "") -> None:
        self.status_code = status_code
        self._body = body
        self.text = text or (str(body) if body is not None else "")

    def json(self) -> Any:
        if isinstance(self._body, Exception):
            raise self._body
        return self._body


class _FakeAsyncClient:
    def __init__(self, response: _FakeResponse | Exception) -> None:
        self._response = response
        self.last_url: str | None = None
        self.last_json: Any = None
        self.last_headers: dict[str, str] | None = None

    async def __aenter__(self) -> "_FakeAsyncClient":
        return self

    async def __aexit__(self, *_exc: Any) -> None:
        return None

    async def post(self, url: str, headers: dict[str, str], json: Any) -> _FakeResponse:
        self.last_url = url
        self.last_json = json
        self.last_headers = headers
        if isinstance(self._response, Exception):
            raise self._response
        return self._response


def _install_fake_client(monkeypatch: pytest.MonkeyPatch, fake: _FakeAsyncClient) -> None:
    def _factory(*_args: Any, **_kwargs: Any) -> _FakeAsyncClient:
        return fake
    monkeypatch.setattr(sb.httpx, "AsyncClient", _factory)


def _stub_credentials(monkeypatch: pytest.MonkeyPatch, api_key: str = "test-key") -> None:
    monkeypatch.setattr(sb, "_resolve_credentials", lambda: (api_key, "https://api.qnaigc.com/v1"))


@pytest.mark.asyncio
async def test_search_via_baidu_success_parses_structured_results(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_credentials(monkeypatch)
    payload = {
        "success": True,
        "data": {
            "results": [
                {
                    "title": "量子计算入门",
                    "url": "https://baike.baidu.com/item/quantum",
                    "content": "量子计算是利用量子力学原理处理信息的方式……",
                    "date": "2024-10-01",
                    "source": "百度百科",
                    "authority_score": 0.91,
                },
                {
                    "title": "Another result",
                    "url": "https://example.com/article",
                    "content": "some content",
                },
            ],
        },
    }
    fake = _FakeAsyncClient(_FakeResponse(200, payload))
    _install_fake_client(monkeypatch, fake)

    resp = await sb.search_via_baidu("量子计算", max_results=5)

    assert resp.error is None, resp.error
    assert len(resp.results) == 2
    first = resp.results[0]
    assert first.title == "量子计算入门"
    assert first.url.startswith("https://baike.baidu.com")
    assert first.authority_score == 0.91
    assert first.source == "百度百科"
    assert fake.last_url == "https://api.qnaigc.com/v1/search/web"
    assert fake.last_headers is not None
    assert fake.last_headers.get("Authorization") == "Bearer test-key"
    assert fake.last_json["query"] == "量子计算"
    assert fake.last_json["max_results"] == 5


@pytest.mark.asyncio
async def test_search_via_baidu_http_error_populates_error(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_credentials(monkeypatch)
    fake = _FakeAsyncClient(_FakeResponse(500, None, text="internal"))
    _install_fake_client(monkeypatch, fake)

    resp = await sb.search_via_baidu("q", max_results=3)

    assert resp.error is not None
    assert "500" in resp.error
    assert resp.results == []


@pytest.mark.asyncio
async def test_search_via_baidu_network_error_populates_error(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_credentials(monkeypatch)
    fake = _FakeAsyncClient(httpx.ConnectError("conn refused"))
    _install_fake_client(monkeypatch, fake)

    resp = await sb.search_via_baidu("q", max_results=3)

    assert resp.error is not None
    assert "网络异常" in resp.error
    assert resp.results == []


@pytest.mark.asyncio
async def test_search_via_baidu_missing_key_short_circuits(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_credentials(monkeypatch, api_key="")
    fake = _FakeAsyncClient(_FakeResponse(200, {"success": True, "data": {"results": []}}))
    _install_fake_client(monkeypatch, fake)

    resp = await sb.search_via_baidu("q")

    assert resp.error is not None
    assert "未配置" in resp.error
    assert fake.last_url is None


@pytest.mark.asyncio
async def test_search_via_baidu_success_false_body(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_credentials(monkeypatch)
    body = {"success": False, "message": "rate limit"}
    fake = _FakeAsyncClient(_FakeResponse(200, body))
    _install_fake_client(monkeypatch, fake)

    resp = await sb.search_via_baidu("q")

    assert resp.error is not None
    assert "rate limit" in resp.error
    assert resp.results == []


@pytest.mark.asyncio
async def test_search_via_baidu_skips_invalid_items(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_credentials(monkeypatch)
    body = {
        "success": True,
        "data": {
            "results": [
                {"title": "", "url": "", "content": ""},  # empty → skipped
                "not a dict",                              # wrong type → skipped
                {"title": "valid", "url": "https://x", "content": "body"},
            ]
        },
    }
    fake = _FakeAsyncClient(_FakeResponse(200, body))
    _install_fake_client(monkeypatch, fake)

    resp = await sb.search_via_baidu("q", max_results=5)

    assert resp.error is None
    assert [r.title for r in resp.results] == ["valid"]
