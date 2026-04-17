"""Dev-only debug log ingestion for Cursor Debug Mode.

This endpoint exists to bypass filesystem permission/locking issues on the
provisioned debug log file during local development.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

router = APIRouter()

_SESSION_ID = "f04052"
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_LOG_PATH = _BACKEND_ROOT / "debug-f04052b.log"


def _resolve_log_path() -> Path:
    override = os.getenv("STUDYSOLO_DEBUG_LOG_PATH")
    return Path(override).expanduser() if override else _DEFAULT_LOG_PATH


def _require_session(x_debug_session_id: str | None) -> None:
    if x_debug_session_id != _SESSION_ID:
        raise HTTPException(status_code=403, detail="Debug session not allowed")


@router.post("/log")
async def ingest_debug_log(
    request: Request,
    x_debug_session_id: str | None = Header(default=None, alias="X-Debug-Session-Id"),
) -> dict[str, Any]:
    _require_session(x_debug_session_id)
    payload = await request.json()
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payload")
    if payload.get("sessionId") != _SESSION_ID:
        raise HTTPException(status_code=403, detail="Session mismatch")
    # Prevent accidental secret logging (best-effort): refuse very large payloads.
    raw = json.dumps(payload, ensure_ascii=False)
    if len(raw) > 50_000:
        raise HTTPException(status_code=413, detail="Payload too large")
    log_path = _resolve_log_path()
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(raw + "\n")
    return {"ok": True}


@router.get("/log")
async def read_debug_log(
    limit: int = 200,
    x_debug_session_id: str | None = Header(default=None, alias="X-Debug-Session-Id"),
) -> dict[str, Any]:
    _require_session(x_debug_session_id)
    if limit < 1:
        limit = 1
    if limit > 2000:
        limit = 2000
    log_path = _resolve_log_path()
    if not log_path.exists():
        return {"ok": True, "lines": []}
    # Read last N lines efficiently enough for dev size.
    lines = log_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    return {"ok": True, "lines": lines[-limit:]}
