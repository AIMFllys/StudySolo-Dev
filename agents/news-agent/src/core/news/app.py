"""NewsAgents API server — OpenAI Responses API compatible.

Usage:
    uvicorn server.app:app --host 0.0.0.0 --port 8000
"""

import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Dict, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

# Ensure project root on path
_ROOT = Path(__file__).parent.parent.parent.resolve()
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from lib import env, render

from .auth import parse_source_keys, verify_auth
from .api_chat import ChatCompletionRequest, handle_chat_completions
from .models import (
    AVAILABLE_MODELS,
    CreateResponseRequest,
    OutputMessage,
    OutputTextContent,
    RequestMetadata,
    ResponseObject,
    UsageInfo,
    gen_id,
)
from .pipeline import execute_research, merge_config
from .progress_sse import ProgressBackground, ProgressSSE
from .sse import (
    content_part_added,
    content_part_done,
    output_item_added,
    output_item_done,
    output_text_delta,
    output_text_done,
    reasoning_summary_part_added,
    reasoning_summary_part_done,
    reasoning_summary_text_delta,
    reasoning_summary_text_done,
    reset_sequence,
    response_completed,
    response_created,
    response_in_progress,
)
from . import task_manager

app = FastAPI(
    title="NewsAgents",
    description="OpenAI-compatible research agent API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health check ---

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/v1/health")
async def health_v1():
    return {"status": "ok"}


@app.get("/health/ready")
async def health_ready():
    return {"ready": True}


# --- Routes ---

@app.get("/v1/models")
async def list_models():
    return AVAILABLE_MODELS.model_dump()


@app.post("/v1/responses")
async def create_response(
    req: CreateResponseRequest,
    authorization: Optional[str] = Header(None),
    x_source_keys: Optional[str] = Header(None, alias="X-Source-Keys"),
):
    """Create a research response. Supports streaming, background, and reasoning modes."""
    verify_auth(authorization)
    source_keys = parse_source_keys(x_source_keys)

    # Validate model
    valid_models = {m.id for m in AVAILABLE_MODELS.data}
    if req.model not in valid_models:
        raise HTTPException(status_code=400, detail=f"Invalid model: {req.model}. Valid: {', '.join(valid_models)}")

    topic = req.get_topic()
    if not topic.strip():
        raise HTTPException(status_code=400, detail="Input topic is empty")

    depth = req.get_depth()
    mode = req.get_output_mode()
    meta = req.metadata or RequestMetadata()

    # Build config
    file_config = env.get_config()
    config = merge_config(file_config, source_keys)

    if mode == "streaming":
        return StreamingResponse(
            _stream_mode1(topic, config, depth, meta, req.model),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    elif mode == "background":
        resp_id = gen_id("resp")
        task_manager.create_task(resp_id, req.model)

        def _run_bg():
            progress = ProgressBackground(resp_id)
            try:
                report = execute_research(
                    topic=topic, config=config, depth=depth,
                    days=meta.days, sources_filter=meta.sources,
                    include_web=meta.include_web, x_handle=meta.x_handle,
                    progress=progress,
                )
                resp_obj = ResponseObject.from_report(report, model=req.model)
                resp_obj.id = resp_id
                task_manager.complete_task(resp_id, resp_obj)
            except Exception as e:
                task_manager.fail_task(resp_id, f"{type(e).__name__}: {e}")

        task_manager.run_in_background(resp_id, _run_bg)
        return JSONResponse({"id": resp_id, "object": "response", "status": "queued", "model": req.model})

    elif mode == "reasoning":
        return StreamingResponse(
            _stream_mode3(topic, config, depth, meta, req.model),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    else:
        # Synchronous mode (quick only recommended)
        report = execute_research(
            topic=topic, config=config, depth=depth,
            days=meta.days, sources_filter=meta.sources,
            include_web=meta.include_web, x_handle=meta.x_handle,
        )
        resp = ResponseObject.from_report(report, model=req.model)
        return resp.model_dump()


@app.get("/v1/responses/{response_id}")
async def get_response(response_id: str, authorization: Optional[str] = Header(None)):
    """Get a background task's status or result."""
    verify_auth(authorization)
    task = task_manager.get_task(response_id)
    if not task:
        raise HTTPException(status_code=404, detail="Response not found")
    return task


@app.delete("/v1/responses/{response_id}")
async def delete_response(response_id: str, authorization: Optional[str] = Header(None)):
    """Delete a response."""
    verify_auth(authorization)
    if task_manager.delete_task(response_id):
        return {"deleted": True}
    raise HTTPException(status_code=404, detail="Response not found")


@app.post("/v1/chat/completions")
async def chat_completions(
    req: ChatCompletionRequest,
    authorization: Optional[str] = Header(None),
    x_source_keys: Optional[str] = Header(None, alias="X-Source-Keys"),
):
    """Chat Completions compatible endpoint."""
    return await handle_chat_completions(req, authorization, x_source_keys)


# --- Streaming generators ---

async def _stream_mode1(topic: str, config: dict, depth: str, meta, model: str):
    """Mode 1: Stream progress + compact report as SSE text deltas."""
    reset_sequence()

    resp_id = gen_id("resp")
    msg_id = gen_id("msg")
    resp_stub = {"id": resp_id, "object": "response", "status": "in_progress", "model": model}

    yield response_created(resp_stub)
    yield response_in_progress(resp_stub)

    # Output item: message
    msg_item = {"id": msg_id, "type": "message", "role": "assistant", "status": "in_progress", "content": []}
    yield output_item_added(0, msg_item)
    yield content_part_added(msg_id, 0, 0, {"type": "output_text", "text": ""})

    # Run research in a thread, collect progress via queue
    progress = ProgressSSE()
    loop = asyncio.get_event_loop()

    full_text = ""

    def _run():
        nonlocal full_text
        report = execute_research(
            topic=topic, config=config, depth=depth,
            days=meta.days, sources_filter=meta.sources,
            include_web=meta.include_web, x_handle=meta.x_handle,
            progress=progress,
        )
        full_text = render.render_compact(report)
        progress.mark_done()

    future = loop.run_in_executor(None, _run)

    # Stream progress messages as text deltas
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

        if msg is None:  # Sentinel
            break
        yield output_text_delta(msg_id, 0, 0, msg)

    # Wait for research to finish
    await future

    # Stream the report in chunks
    chunk_size = 120
    for i in range(0, len(full_text), chunk_size):
        chunk = full_text[i:i + chunk_size]
        yield output_text_delta(msg_id, 0, 0, chunk)

    # Finalize
    yield output_text_done(msg_id, 0, 0, full_text)
    yield content_part_done(msg_id, 0, 0, {"type": "output_text", "text": full_text})

    msg_item["status"] = "completed"
    msg_item["content"] = [{"type": "output_text", "text": full_text, "annotations": []}]
    yield output_item_done(0, msg_item)

    resp_stub["status"] = "completed"
    resp_stub["output"] = [msg_item]
    resp_stub["usage"] = {"input_tokens": 0, "output_tokens": len(full_text), "total_tokens": len(full_text)}
    yield response_completed(resp_stub)


async def _stream_mode3(topic: str, config: dict, depth: str, meta, model: str):
    """Mode 3: Stream reasoning XML+JSON blocks, then final report."""
    reset_sequence()

    resp_id = gen_id("resp")
    reasoning_id = gen_id("reason")
    msg_id = gen_id("msg")
    resp_stub = {"id": resp_id, "object": "response", "status": "in_progress", "model": model}

    yield response_created(resp_stub)
    yield response_in_progress(resp_stub)

    # Reasoning output item
    reasoning_item = {"id": reasoning_id, "type": "reasoning", "status": "in_progress"}
    yield output_item_added(0, reasoning_item)

    # Run research in thread, collect progress
    progress = ProgressSSE()
    loop = asyncio.get_event_loop()

    full_text = ""
    report_dict = {}
    summary_idx = 0

    def _run():
        nonlocal full_text, report_dict
        report = execute_research(
            topic=topic, config=config, depth=depth,
            days=meta.days, sources_filter=meta.sources,
            include_web=meta.include_web, x_handle=meta.x_handle,
            progress=progress,
        )
        full_text = render.render_compact(report)
        report_dict = report.to_dict()
        progress.mark_done()

    future = loop.run_in_executor(None, _run)

    # Stream progress as reasoning summary parts (XML+JSON)
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

        # Wrap progress message as XML+JSON reasoning block
        xml_block = f"<progress>\n{json.dumps({'message': msg.strip()}, ensure_ascii=False)}\n</progress>"
        yield reasoning_summary_part_added(reasoning_id, 0, summary_idx)
        yield reasoning_summary_text_delta(reasoning_id, 0, summary_idx, xml_block)
        yield reasoning_summary_text_done(reasoning_id, 0, summary_idx, xml_block)
        yield reasoning_summary_part_done(reasoning_id, 0, summary_idx, xml_block)
        summary_idx += 1

    await future

    # Emit source-level data as reasoning blocks
    for source_name in ["reddit", "x", "youtube", "tiktok", "instagram", "hackernews", "bluesky", "truthsocial", "polymarket", "web"]:
        items = report_dict.get(source_name, [])
        if not items:
            continue
        source_data = {
            "source": source_name,
            "count": len(items),
            "error": report_dict.get(f"{source_name}_error"),
        }
        xml_block = f"<source_{source_name}>\n{json.dumps(source_data, ensure_ascii=False)}\n</source_{source_name}>"
        yield reasoning_summary_part_added(reasoning_id, 0, summary_idx)
        yield reasoning_summary_text_delta(reasoning_id, 0, summary_idx, xml_block)
        yield reasoning_summary_text_done(reasoning_id, 0, summary_idx, xml_block)
        yield reasoning_summary_part_done(reasoning_id, 0, summary_idx, xml_block)
        summary_idx += 1

    # Final report as XML block
    final_block = f"<final_report>\n{json.dumps({'format': 'markdown', 'length': len(full_text)}, ensure_ascii=False)}\n</final_report>"
    yield reasoning_summary_part_added(reasoning_id, 0, summary_idx)
    yield reasoning_summary_text_delta(reasoning_id, 0, summary_idx, final_block)
    yield reasoning_summary_text_done(reasoning_id, 0, summary_idx, final_block)
    yield reasoning_summary_part_done(reasoning_id, 0, summary_idx, final_block)

    reasoning_item["status"] = "completed"
    yield output_item_done(0, reasoning_item)

    # Message output item with full report
    msg_item = {"id": msg_id, "type": "message", "role": "assistant", "status": "in_progress", "content": []}
    yield output_item_added(1, msg_item)
    yield content_part_added(msg_id, 1, 0, {"type": "output_text", "text": ""})

    chunk_size = 120
    for i in range(0, len(full_text), chunk_size):
        yield output_text_delta(msg_id, 1, 0, full_text[i:i + chunk_size])

    yield output_text_done(msg_id, 1, 0, full_text)
    yield content_part_done(msg_id, 1, 0, {"type": "output_text", "text": full_text})

    msg_item["status"] = "completed"
    msg_item["content"] = [{"type": "output_text", "text": full_text, "annotations": []}]
    yield output_item_done(1, msg_item)

    resp_stub["status"] = "completed"
    resp_stub["output"] = [reasoning_item, msg_item]
    resp_stub["usage"] = {"input_tokens": 0, "output_tokens": len(full_text), "total_tokens": len(full_text)}
    yield response_completed(resp_stub)
