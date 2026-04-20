"""SSE event construction compatible with OpenAI Responses API streaming format.

Builds Server-Sent Events matching the 53 event types defined by OpenAI.
Each event is two lines (event: + data:) followed by a blank line.
"""

import json
from typing import Any, Dict

_seq = 0


def _next_seq() -> int:
    global _seq
    _seq += 1
    return _seq


def reset_sequence():
    global _seq
    _seq = 0


def sse_line(event_type: str, data: dict) -> str:
    """Format a single SSE event as a string."""
    data["sequence_number"] = _next_seq()
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# --- Envelope lifecycle ---

def response_created(response: dict) -> str:
    return sse_line("response.created", {"type": "response.created", "response": response})


def response_in_progress(response: dict) -> str:
    return sse_line("response.in_progress", {"type": "response.in_progress", "response": response})


def response_completed(response: dict) -> str:
    return sse_line("response.completed", {"type": "response.completed", "response": response})


def response_failed(response: dict) -> str:
    return sse_line("response.failed", {"type": "response.failed", "response": response})


# --- Output item assembly ---

def output_item_added(output_index: int, item: dict) -> str:
    return sse_line("response.output_item.added", {
        "type": "response.output_item.added",
        "output_index": output_index,
        "item": item,
    })


def output_item_done(output_index: int, item: dict) -> str:
    return sse_line("response.output_item.done", {
        "type": "response.output_item.done",
        "output_index": output_index,
        "item": item,
    })


def content_part_added(item_id: str, output_index: int, content_index: int, part: dict) -> str:
    return sse_line("response.content_part.added", {
        "type": "response.content_part.added",
        "item_id": item_id,
        "output_index": output_index,
        "content_index": content_index,
        "part": part,
    })


def content_part_done(item_id: str, output_index: int, content_index: int, part: dict) -> str:
    return sse_line("response.content_part.done", {
        "type": "response.content_part.done",
        "item_id": item_id,
        "output_index": output_index,
        "content_index": content_index,
        "part": part,
    })


def output_text_delta(item_id: str, output_index: int, content_index: int, delta: str) -> str:
    return sse_line("response.output_text.delta", {
        "type": "response.output_text.delta",
        "item_id": item_id,
        "output_index": output_index,
        "content_index": content_index,
        "delta": delta,
    })


def output_text_done(item_id: str, output_index: int, content_index: int, text: str) -> str:
    return sse_line("response.output_text.done", {
        "type": "response.output_text.done",
        "item_id": item_id,
        "output_index": output_index,
        "content_index": content_index,
        "text": text,
    })


# --- Reasoning summary (Mode 3) ---

def reasoning_summary_part_added(item_id: str, output_index: int, summary_index: int) -> str:
    return sse_line("response.reasoning_summary_part.added", {
        "type": "response.reasoning_summary_part.added",
        "item_id": item_id,
        "output_index": output_index,
        "summary_index": summary_index,
        "part": {"type": "summary_text", "text": ""},
    })


def reasoning_summary_text_delta(item_id: str, output_index: int, summary_index: int, delta: str) -> str:
    return sse_line("response.reasoning_summary_text.delta", {
        "type": "response.reasoning_summary_text.delta",
        "item_id": item_id,
        "output_index": output_index,
        "summary_index": summary_index,
        "delta": delta,
    })


def reasoning_summary_text_done(item_id: str, output_index: int, summary_index: int, text: str) -> str:
    return sse_line("response.reasoning_summary_text.done", {
        "type": "response.reasoning_summary_text.done",
        "item_id": item_id,
        "output_index": output_index,
        "summary_index": summary_index,
        "text": text,
    })


def reasoning_summary_part_done(item_id: str, output_index: int, summary_index: int, text: str) -> str:
    return sse_line("response.reasoning_summary_part.done", {
        "type": "response.reasoning_summary_part.done",
        "item_id": item_id,
        "output_index": output_index,
        "summary_index": summary_index,
        "part": {"type": "summary_text", "text": text},
    })
