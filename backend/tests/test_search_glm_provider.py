"""Unit tests for the Zhipu Web Search provider (app.services.search_glm).

Covers:
- Successful /api/paas/v4/web_search response parsing
- HTTP error paths → error field populated
- httpx network errors → error field populated
- Missing API key → early error return
- Response error object → error field populated
- Query trimming (search_query capped at 70 chars per Zhipu docs)
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.services import search_glm as sg


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
    monkeypatch.setattr(sg.httpx, "AsyncClient", _factory)


def _stub_credentials(monkeypatch: pytest.MonkeyPatch, api_key: str = "zhipu-test-key") -> None:
    monkeypatch.setattr(
        sg, "_resolve_credentials",
        lambda: (api_key, "https://open.bigmodel.cn/api/paas/v4"),
    )


@pytest.mark.asyncio
async def test_search_via_glm_success_parses_structured_results(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_credentials(monkeypatch)
    payload = {
        "id": "wsp-abc",
        "created": 1715200000,
        "search_result": [
            {
                "title": "Python 3.12 changelog",
                "link": "https://docs.python.org/3.12/whatsnew/3.12.html",
                "content": "Python 3.12 adds per-interpreter GIL ...",
                "refer": "ref1",
                "media": "docs.python.org",
                "publish_date": "2023-10-02",
            },
            {
                "title": "Second",
                "link": "https://example.com/x",
                "content": "body",
            },
        ],
    }
    fake = _FakeAsyncClient(_FakeResponse(200, payload))
    _install_fake_client(monkeypatch, fake)

    resp = await sg.search_via_glm("Python 3.12 new features", max_results=5)

    assert resp.error is None, resp.error
    assert len(resp.results) == 2
    first = resp.results[0]
    assert first.title == "Python 3.12 changelog"
    assert first.url == "https://docs.python.org/3.12/whatsnew/3.12.html"
    assert first.media == "docs.python.org"
    assert fake.last_url == "https://open.bigmodel.cn/api/paas/v4/web_search"
    assert fake.last_json["search_engine"] == "search_pro"
    assert fake.last_json["count"] == 5


@pytest.mark.asyncio
async def test_search_via_glm_trims_search_query_to_70_chars(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_credentials(monkeypatch)
    fake = _FakeAsyncClient(_FakeResponse(200, {"search_result": []}))
    _install_fake_client(monkeypatch, fake)

    long_query = "a" * 200
    await sg.search_via_glm(long_query)

    assert fake.last_json is not None
    assert len(fake.last_json["search_query"]) == 70


@pytest.mark.asyncio
async def test_search_via_glm_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_credentials(monkeypatch)
    fake = _FakeAsyncClient(_FakeResponse(401, None, text="unauthorized"))
    _install_fake_client(monkeypatch, fake)

    resp = await sg.search_via_glm("q")

    assert resp.error is not None
    assert "401" in resp.error
    assert resp.results == []


@pytest.mark.asyncio
async def test_search_via_glm_network_error(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_credentials(monkeypatch)
    fake = _FakeAsyncClient(httpx.ReadTimeout("timeout"))
    _install_fake_client(monkeypatch, fake)

    resp = await sg.search_via_glm("q")

    assert resp.error is not None
    assert "网络异常" in resp.error
    assert resp.results == []


@pytest.mark.asyncio
async def test_search_via_glm_missing_key(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_credentials(monkeypatch, api_key="")
    fake = _FakeAsyncClient(_FakeResponse(200, {"search_result": []}))
    _install_fake_client(monkeypatch, fake)

    resp = await sg.search_via_glm("q")

    assert resp.error is not None
    assert "未配置" in resp.error
    assert fake.last_url is None


@pytest.mark.asyncio
async def test_search_via_glm_error_object_in_body(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_credentials(monkeypatch)
    body = {"error": {"code": "1020", "message": "quota exceeded"}}
    fake = _FakeAsyncClient(_FakeResponse(200, body))
    _install_fake_client(monkeypatch, fake)

    resp = await sg.search_via_glm("q")

    assert resp.error is not None
    assert "quota" in resp.error
    assert resp.results == []
