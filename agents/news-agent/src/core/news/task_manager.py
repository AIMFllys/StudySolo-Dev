"""Background task manager for Mode 2 (async research with polling).

Stores task state in memory. Tasks run via asyncio in background threads.
"""

import asyncio
import time
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, Optional

from .models import ResponseObject, gen_id


_store: Dict[str, Dict[str, Any]] = {}
_executor = ThreadPoolExecutor(max_workers=4)


def create_task(response_id: str, model: str) -> Dict[str, Any]:
    """Register a new background task."""
    task = {
        "id": response_id,
        "status": "queued",
        "model": model,
        "created_at": int(time.time()),
        "metadata": {
            "sources_completed": [],
            "sources_pending": [],
            "elapsed_seconds": 0,
        },
        "output": None,
        "usage": None,
        "error": None,
    }
    _store[response_id] = task
    return task


def get_task(response_id: str) -> Optional[Dict[str, Any]]:
    """Get task by ID."""
    task = _store.get(response_id)
    if task and task["status"] == "in_progress":
        task["metadata"]["elapsed_seconds"] = int(time.time() - task["created_at"])
    return task


def update_progress(response_id: str, source: str, status: str = "completed", count: int = 0):
    """Update task progress when a source completes."""
    task = _store.get(response_id)
    if not task:
        return
    meta = task["metadata"]
    if status == "completed":
        if source not in meta["sources_completed"]:
            meta["sources_completed"].append(source)
        if source in meta.get("sources_pending", []):
            meta["sources_pending"].remove(source)
    elif status == "started":
        if source not in meta.get("sources_pending", []):
            meta.setdefault("sources_pending", []).append(source)


def complete_task(response_id: str, response_obj: ResponseObject):
    """Mark task as completed with result."""
    task = _store.get(response_id)
    if not task:
        return
    task["status"] = "completed"
    task["output"] = [msg.model_dump() for msg in response_obj.output]
    task["usage"] = response_obj.usage.model_dump() if response_obj.usage else None
    task["metadata"]["elapsed_seconds"] = int(time.time() - task["created_at"])


def fail_task(response_id: str, error_message: str):
    """Mark task as failed."""
    task = _store.get(response_id)
    if not task:
        return
    task["status"] = "failed"
    task["error"] = {"message": error_message, "code": "research_failed"}
    task["metadata"]["elapsed_seconds"] = int(time.time() - task["created_at"])


def delete_task(response_id: str) -> bool:
    """Delete a task from the store."""
    return _store.pop(response_id, None) is not None


def run_in_background(response_id: str, func, *args, **kwargs):
    """Submit a function to run in the background thread pool."""
    task = _store.get(response_id)
    if task:
        task["status"] = "in_progress"

    def _wrapper():
        try:
            func(*args, **kwargs)
        except Exception as e:
            fail_task(response_id, f"{type(e).__name__}: {e}")
            traceback.print_exc()

    _executor.submit(_wrapper)
