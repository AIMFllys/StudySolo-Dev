from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.debug_log import router


SESSION_ID = "f04052"


def _client(tmp_path, monkeypatch):
    monkeypatch.setenv("STUDYSOLO_DEBUG_LOG_PATH", str(tmp_path / "debug.log"))
    app = FastAPI()
    app.include_router(router, prefix="/api/debug")
    return TestClient(app, raise_server_exceptions=False)


def test_debug_log_rejects_missing_or_wrong_session(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    assert client.post("/api/debug/log", json={"sessionId": SESSION_ID}).status_code == 403
    assert client.post(
        "/api/debug/log",
        json={"sessionId": SESSION_ID},
        headers={"X-Debug-Session-Id": "wrong"},
    ).status_code == 403


def test_debug_log_writes_and_reads_chinese_lines(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)
    headers = {"X-Debug-Session-Id": SESSION_ID}

    response = client.post(
        "/api/debug/log",
        json={"sessionId": SESSION_ID, "message": "工作流 / 节点 / 本轮变更"},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"ok": True}

    read_response = client.get("/api/debug/log?limit=1", headers=headers)
    assert read_response.status_code == 200, read_response.text
    lines = read_response.json()["lines"]
    assert len(lines) == 1
    assert "工作流 / 节点 / 本轮变更" in lines[0]


def test_debug_log_rejects_large_payload(tmp_path, monkeypatch):
    client = _client(tmp_path, monkeypatch)

    response = client.post(
        "/api/debug/log",
        json={"sessionId": SESSION_ID, "message": "x" * 50_000},
        headers={"X-Debug-Session-Id": SESSION_ID},
    )

    assert response.status_code == 413
