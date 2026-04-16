"""POST /v1/chat/completions — OpenAI Chat Completions compatible endpoint.

Converts Chat Completions format requests into research pipeline calls,
and returns results in Chat Completions response format (streaming or sync).
"""

import asyncio
import json
import time
import uuid
from typing import Any, Dict, List, Optional, Union

from fastapi import Header, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from .auth import parse_source_keys, verify_auth
from .models import gen_id
from .pipeline import execute_research, merge_config
from .progress_sse import ProgressSSE

from lib import env, render


# --- Request models ---

class ChatMessage(BaseModel):
    role: str
    content: Union[str, List[Dict[str, Any]], None] = None


class ChatCompletionRequest(BaseModel):
    model: str = "last30days"
    messages: List[ChatMessage]
    stream: bool = False
    temperature: Optional[float] = None  # ignored, kept for compat
    max_tokens: Optional[int] = None  # ignored
    n: int = 1  # ignored

    def get_topic(self) -> str:
        """Extract topic from the last user message."""
        for msg in reversed(self.messages):
            if msg.role == "user" and msg.content:
                if isinstance(msg.content, str):
                    return msg.content
                if isinstance(msg.content, list):
                    for part in msg.content:
                        if isinstance(part, dict) and part.get("type") == "text":
                            return part.get("text", "")
        return ""

    def get_depth(self) -> str:
        if self.model.endswith("-quick"):
            return "quick"
        elif self.model.endswith("-deep"):
            return "deep"
        return "default"


# --- Response helpers ---

def _chat_chunk(chat_id: str, model: str, delta: dict, finish_reason=None) -> str:
    """Build a single SSE chunk in Chat Completions streaming format."""
    data = {
        "id": chat_id,
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [{
            "index": 0,
            "delta": delta,
            "finish_reason": finish_reason,
        }],
    }
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def _chat_response(chat_id: str, model: str, content: str) -> dict:
    """Build a non-streaming Chat Completions response."""
    return {
        "id": chat_id,
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": content},
            "finish_reason": "stop",
        }],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": len(content),
            "total_tokens": len(content),
        },
    }


# --- Handler ---

async def handle_chat_completions(
    req: ChatCompletionRequest,
    authorization: Optional[str],
    x_source_keys: Optional[str],
):
    verify_auth(authorization)
    source_keys = parse_source_keys(x_source_keys)

    from .models import AVAILABLE_MODELS
    valid_models = {m.id for m in AVAILABLE_MODELS.data}
    if req.model not in valid_models:
        raise HTTPException(status_code=400, detail=f"Invalid model: {req.model}")

    topic = req.get_topic()
    if not topic.strip():
        raise HTTPException(status_code=400, detail="No user message with content found")

    depth = req.get_depth()
    file_config = env.get_config()
    config = merge_config(file_config, source_keys)
    chat_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"

    if req.stream:
        return StreamingResponse(
            _stream_chat(chat_id, topic, config, depth, req.model),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    else:
        report = execute_research(topic=topic, config=config, depth=depth)
        content = render.render_compact(report)
        return JSONResponse(_chat_response(chat_id, req.model, content))


async def _stream_chat(chat_id: str, topic: str, config: dict, depth: str, model: str):
    """Stream research results in Chat Completions SSE format."""
    # Role chunk
    yield _chat_chunk(chat_id, model, {"role": "assistant"})

    progress = ProgressSSE()
    loop = asyncio.get_event_loop()
    full_text = ""

    def _run():
        nonlocal full_text
        report = execute_research(topic=topic, config=config, depth=depth, progress=progress)
        full_text = render.render_compact(report)
        progress.mark_done()

    future = loop.run_in_executor(None, _run)

    # Stream progress messages
    q = progress.get_queue()
    while True:
        try:
            msg = await asyncio.wait_for(
                loop.run_in_executor(None, q.get, True, 0.5),
                timeout=1.0,
            )
        except (asyncio.TimeoutError, Exception):
            if progress.is_done():
                break
            continue
        if msg is None:
            break
        yield _chat_chunk(chat_id, model, {"content": msg})

    await future

    # Stream report in chunks
    chunk_size = 120
    for i in range(0, len(full_text), chunk_size):
        yield _chat_chunk(chat_id, model, {"content": full_text[i:i + chunk_size]})

    # Finish
    yield _chat_chunk(chat_id, model, {}, finish_reason="stop")
    yield "data: [DONE]\n\n"
