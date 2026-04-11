"""Single-node execution: input building, LLM caller construction, and timeout wrapper."""

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

from app.nodes import NODE_REGISTRY
from app.nodes._base import NodeInput
from app.engine.events import sse_event
from app.services.ai_catalog_service import get_sku_by_id
from app.services.llm.router import call_llm, call_llm_direct
from app.services.usage_ledger import bind_usage_call

logger = logging.getLogger(__name__)

DEFAULT_NODE_TIMEOUT = 120
DEFAULT_NODE_STARTUP_TIMEOUT = 30

_NODE_PROGRESS_MESSAGES: dict[str, str] = {
    "knowledge_base": "正在检索知识库",
    "web_search": "正在联网搜索",
    "logic_switch": "正在分析分支条件",
    "loop_group": "正在准备循环执行",
}


@dataclass
class NodeExecutionResult:
    """Mutable execution result populated while a node streams events."""
    node_id: str
    output: str | None = None
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


def build_parallel_group_id(node_ids: list[str]) -> str:
    """Build a stable parallel group identifier shared with the frontend."""
    return "|".join(sorted(node_ids))


def get_node_progress_message(node_type: str) -> str:
    """Resolve a user-facing progress label for long-running node phases."""
    return _NODE_PROGRESS_MESSAGES.get(node_type, "正在执行节点")


def build_input_snapshot(node_input: NodeInput) -> str:
    """Safely serialize the combined node input into a JSON string."""
    snapshot = {
        "user_content": node_input.user_content,
        "upstream_outputs": node_input.upstream_outputs,
        "node_config": node_input.node_config,
    }
    return json.dumps(snapshot, ensure_ascii=False)


def resolve_user_content(node_data: dict) -> str:
    """Resolve effective user content with config fallback for input nodes."""
    config = node_data.get("config")
    if isinstance(config, dict):
        template = config.get("input_template")
        if isinstance(template, str) and template.strip():
            return node_data.get("user_content") or template
    return node_data.get("user_content") or node_data.get("label", "")


def build_runtime_config(node_data: dict) -> dict[str, Any] | None:
    """Merge node.data root execution fields into node_config."""
    merged: dict[str, Any] = {}
    config = node_data.get("config")
    if isinstance(config, dict):
        merged.update(config)

    for key in (
        "model_route", "community_node_id", "output_format",
        "input_hint", "model_preference", "community_icon",
    ):
        value = node_data.get(key)
        if value not in (None, ""):
            merged[key] = value

    return merged or None


def build_node_llm_caller(runtime_config: dict[str, Any] | None):
    """Create an LLM caller closure that respects the node's model_route."""
    async def _llm_caller(node_type: str, messages: list[dict], stream: bool = False):
        model_route = runtime_config.get("model_route") if runtime_config else None
        if isinstance(model_route, str) and model_route:
            sku = await get_sku_by_id(model_route)
            if sku:
                return await call_llm_direct(sku.provider, sku.model_id, messages, stream=stream)
        return await call_llm(node_type, messages, stream=stream)
    return _llm_caller


async def execute_single_node(
    node_id: str,
    node_config: dict,
    upstream_outputs: dict[str, str],
    implicit_context: dict | None,
) -> tuple[str, str | None, str | None]:
    """Execute a single node and return (node_id, output, error)."""
    node_type_str = node_config.get("type", "chat_response")
    node_data = node_config.get("data", {})

    NodeClass = NODE_REGISTRY.get(node_type_str)
    if not NodeClass:
        NodeClass = NODE_REGISTRY.get("chat_response")
        if not NodeClass:
            return (node_id, None, f"Unknown node type: {node_type_str}")

    node_instance = NodeClass()
    runtime_config = build_runtime_config(node_data)

    node_input = NodeInput(
        user_content=resolve_user_content(node_data),
        upstream_outputs=upstream_outputs,
        implicit_context=implicit_context,
        node_config=runtime_config,
    )

    full_output = ""
    try:
        with bind_usage_call(node_id=node_id, node_type=node_type_str):
            async for token in node_instance.execute(
                node_input, build_node_llm_caller(runtime_config),
            ):
                full_output += token
        result = await node_instance.post_process(full_output)
        return (node_id, result.content, None)
    except Exception as e:
        logger.error("Node %s execution failed: %s", node_id, e)
        return (node_id, None, str(e))


async def stream_single_node_events(
    node_id: str,
    node_config: dict,
    upstream_outputs: dict[str, str],
    implicit_context: dict | None,
    result: NodeExecutionResult,
    *,
    event_meta: dict[str, Any] | None = None,
    timeout_seconds: int = DEFAULT_NODE_TIMEOUT,
    startup_timeout_seconds: int = DEFAULT_NODE_STARTUP_TIMEOUT,
) -> AsyncIterator[str]:
    """Execute a single node and emit SSE frames as work progresses."""
    node_type_str = node_config.get("type", "chat_response")
    node_data = node_config.get("data", {})

    NodeClass = NODE_REGISTRY.get(node_type_str)
    if not NodeClass:
        NodeClass = NODE_REGISTRY.get("chat_response")
        if not NodeClass:
            result.error = f"Unknown node type: {node_type_str}"
            yield sse_event("node_status", {
                "node_id": node_id,
                "status": "error",
                "error": result.error,
            }, event_meta)
            return

    runtime_config = build_runtime_config(node_data)
    node_input = NodeInput(
        user_content=resolve_user_content(node_data),
        upstream_outputs=upstream_outputs,
        implicit_context=implicit_context,
        node_config=runtime_config,
    )

    yield sse_event("node_status", {"node_id": node_id, "status": "running"}, event_meta)
    try:
        yield sse_event("node_input", {"node_id": node_id, "input_snapshot": build_input_snapshot(node_input)}, event_meta)
    except Exception as exc:
        logger.warning("Failed to serialize input snapshot for node %s: %s", node_id, exc)

    yield sse_event("node_progress", {
        "node_id": node_id,
        "message": get_node_progress_message(node_type_str),
        "phase": "start",
    }, event_meta)

    node_instance = NodeClass()
    llm_caller = build_node_llm_caller(runtime_config)
    full_output = ""

    try:
        with bind_usage_call(node_id=node_id, node_type=node_type_str):
            async with asyncio.timeout(timeout_seconds):
                token_iter = node_instance.execute(node_input, llm_caller)

                try:
                    first_token = await asyncio.wait_for(
                        token_iter.__anext__(),
                        timeout=startup_timeout_seconds,
                    )
                except asyncio.TimeoutError:
                    result.error = f"节点启动超时（{startup_timeout_seconds}秒）"
                    yield sse_event("node_status", {
                        "node_id": node_id,
                        "status": "error",
                        "error": result.error,
                    }, event_meta)
                    return
                except StopAsyncIteration:
                    first_token = None

                if first_token is not None:
                    full_output += first_token
                    yield sse_event("node_token", {"node_id": node_id, "token": first_token}, event_meta)
                    async for token in token_iter:
                        full_output += token
                        yield sse_event("node_token", {"node_id": node_id, "token": token}, event_meta)

                yield sse_event("node_progress", {
                    "node_id": node_id,
                    "message": "正在整理节点结果",
                    "phase": "postprocess",
                }, event_meta)
                output = await node_instance.post_process(full_output)
    except TimeoutError:
        result.error = f"节点执行超时（{timeout_seconds}秒）"
    except Exception as exc:
        logger.error("Node %s execution failed: %s", node_id, exc)
        result.error = str(exc)
    else:
        result.output = output.content
        result.metadata = dict(output.metadata or {})
        yield sse_event("node_done", {"node_id": node_id, "full_output": output.content}, event_meta)
        yield sse_event("node_status", {"node_id": node_id, "status": "done"}, event_meta)
        return

    yield sse_event("node_status", {
        "node_id": node_id,
        "status": "error",
        "error": result.error,
    }, event_meta)


async def execute_single_node_with_timeout(
    node_id: str,
    node_config: dict,
    upstream_outputs: dict[str, str],
    implicit_context: dict | None,
    timeout_seconds: int = DEFAULT_NODE_TIMEOUT,
) -> tuple[str, str | None, str | None]:
    """Wrapper that applies per-node timeout."""
    try:
        return await asyncio.wait_for(
            execute_single_node(
                node_id=node_id, node_config=node_config,
                upstream_outputs=upstream_outputs, implicit_context=implicit_context,
            ),
            timeout=timeout_seconds,
        )
    except asyncio.TimeoutError:
        logger.error("Node %s timed out after %ds", node_id, timeout_seconds)
        return (node_id, None, f"节点执行超时（{timeout_seconds}秒）")
