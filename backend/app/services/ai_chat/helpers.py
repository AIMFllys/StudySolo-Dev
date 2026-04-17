"""Shared helper functions for AI chat routes.

Extracted from the former api/ai_chat.py to eliminate duplication
between the non-streaming and streaming endpoints.
"""

import json
import re

_JSON_PATTERN = re.compile(r"```(?:json)?\s*([\s\S]+?)```")
_OBJ_PATTERN = re.compile(r"(\{[\s\S]*\})")
_REASONING_BLOCK_RE = re.compile(
    r"<(?:think|thinking|reasoning)\b[^>]*>[\s\S]*?</(?:think|thinking|reasoning)>",
    re.IGNORECASE,
)
_REASONING_OPEN_TAG_RE = re.compile(r"^<(?:think|thinking|reasoning)\b[^>]*>$", re.IGNORECASE)
_REASONING_CLOSE_TAG_RE = re.compile(r"^</(?:think|thinking|reasoning)\s*>$", re.IGNORECASE)
_REASONING_TAG_PREFIXES = (
    "<think",
    "</think",
    "<thinking",
    "</thinking",
    "<reasoning",
    "</reasoning",
)


def extract_json_obj(text: str) -> dict:
    """Extract a JSON object from LLM output, handling markdown code blocks."""
    m = _JSON_PATTERN.search(text)
    raw = m.group(1).strip() if m else text.strip()
    m2 = _OBJ_PATTERN.search(raw)
    if m2:
        raw = m2.group(1).strip()
    return json.loads(raw)


def strip_reasoning_blocks(text: str) -> str:
    """Remove complete reasoning tags from a full model response."""
    return _REASONING_BLOCK_RE.sub("", text)


def _could_be_reasoning_tag_prefix(fragment: str) -> bool:
    lowered = fragment.lower()
    return any(prefix.startswith(lowered) for prefix in _REASONING_TAG_PREFIXES)


class ReasoningStreamSanitizer:
    """Drop streamed reasoning tags without disabling token streaming."""

    def __init__(self) -> None:
        self._buffer = ""
        self._inside_reasoning = False

    def feed(self, chunk: str) -> str:
        if not chunk:
            return ""
        self._buffer += chunk
        emitted: list[str] = []

        while self._buffer:
            if self._inside_reasoning:
                start = self._buffer.find("</")
                if start == -1:
                    self._buffer = self._buffer[-16:]
                    break
                self._buffer = self._buffer[start:]
                tag_end = self._buffer.find(">")
                if tag_end == -1:
                    break
                tag = self._buffer[: tag_end + 1]
                self._buffer = self._buffer[tag_end + 1 :]
                if _REASONING_CLOSE_TAG_RE.match(tag):
                    self._inside_reasoning = False
                continue

            next_lt = self._buffer.find("<")
            if next_lt == -1:
                emitted.append(self._buffer)
                self._buffer = ""
                break
            if next_lt > 0:
                emitted.append(self._buffer[:next_lt])
                self._buffer = self._buffer[next_lt:]

            tag_end = self._buffer.find(">")
            if tag_end == -1:
                if _could_be_reasoning_tag_prefix(self._buffer):
                    break
                emitted.append(self._buffer[0])
                self._buffer = self._buffer[1:]
                continue

            tag = self._buffer[: tag_end + 1]
            self._buffer = self._buffer[tag_end + 1 :]
            if _REASONING_OPEN_TAG_RE.match(tag):
                self._inside_reasoning = True
                continue
            if _REASONING_CLOSE_TAG_RE.match(tag):
                continue
            emitted.append(tag)

        return "".join(emitted)

    def flush(self) -> str:
        if self._inside_reasoning:
            self._inside_reasoning = False
            self._buffer = ""
            return ""
        if not self._buffer:
            return ""
        if _could_be_reasoning_tag_prefix(self._buffer):
            self._buffer = ""
            return ""
        tail = self._buffer
        self._buffer = ""
        return tail


def build_canvas_summary(ctx) -> str:
    """Serialize canvas context into an LLM-readable text summary."""
    if not ctx:
        return "Canvas is empty."

    lines = [f"Workflow: {ctx.workflow_name or 'Untitled'}"]
    if getattr(ctx, "workflow_id", None):
        lines.append(f"Workflow ID: {ctx.workflow_id}")
    lines.append(f"Node count: {len(ctx.nodes)}")
    if ctx.execution_status:
        lines.append(f"Execution status: {ctx.execution_status}")
    if not ctx.nodes:
        lines.append("Canvas is empty.")
        return "\n".join(lines)

    lines.append("")

    for node in ctx.nodes:
        status = f" [{node.status}]" if node.status != "pending" else ""
        upstream = f" <- {', '.join(node.upstream_labels)}" if node.upstream_labels else ""
        downstream = f" -> {', '.join(node.downstream_labels)}" if node.downstream_labels else ""
        preview = f" output={node.output_preview}" if node.has_output else ""
        pos = f" @({int(node.position.get('x', 0))},{int(node.position.get('y', 0))})"
        lines.append(f"#{node.index + 1} [{node.type}] {node.label}{pos}{status}{upstream}{downstream}{preview}")

    if ctx.dag_description:
        lines.append(f"DAG: {ctx.dag_description}")

    if ctx.selected_node_id:
        selected = next((node for node in ctx.nodes if node.id == ctx.selected_node_id), None)
        if selected:
            lines.append(f"Selected node: #{selected.index + 1} {selected.label}")

    return "\n".join(lines)
