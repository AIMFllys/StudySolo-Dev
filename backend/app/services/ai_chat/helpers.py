"""Shared helper functions for AI chat routes.

Extracted from the former api/ai_chat.py to eliminate duplication
between the non-streaming and streaming endpoints.
"""

import json
import re

_JSON_PATTERN = re.compile(r"```(?:json)?\s*([\s\S]+?)```")
_OBJ_PATTERN = re.compile(r"(\{[\s\S]*\})")


def extract_json_obj(text: str) -> dict:
    """Extract a JSON object from LLM output, handling markdown code blocks."""
    m = _JSON_PATTERN.search(text)
    raw = m.group(1).strip() if m else text.strip()
    m2 = _OBJ_PATTERN.search(raw)
    if m2:
        raw = m2.group(1).strip()
    return json.loads(raw)


def build_canvas_summary(ctx) -> str:
    """Serialize canvas context into an LLM-readable text summary."""
    if not ctx or not ctx.nodes:
        return "Canvas is empty."

    lines = [f"Workflow: {ctx.workflow_name or 'Untitled'}"]
    lines.append(f"Node count: {len(ctx.nodes)}")
    if ctx.execution_status:
        lines.append(f"Execution status: {ctx.execution_status}")
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
