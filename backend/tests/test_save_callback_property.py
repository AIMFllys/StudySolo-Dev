"""
Property 8: save_callback 接收正确的 updated_nodes
Property 9: 保存失败时 SSE 包含 save_error 且后续有 workflow_done
Feature: studysolo-integration-fixes, Properties 8 & 9
Validates: Requirements 10.1, 10.2, 10.3
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from unittest.mock import patch

from app.engine.executor import execute_workflow, _merge_outputs


# ── Helpers ──────────────────────────────────────────────────────────────────

def parse_event_type(event_str: str) -> str:
    for line in event_str.split("\n"):
        if line.startswith("event: "):
            return line[7:]
    return ""


async def collect_events(gen) -> list[str]:
    events = []
    async for event_str in gen:
        events.append(event_str)
    return events


def make_node(node_id: str) -> dict:
    return {"id": node_id, "type": "chat_response", "data": {"label": node_id, "output": ""}}


# ── Strategies ────────────────────────────────────────────────────────────────

_node_ids_strategy = st.lists(
    st.uuids().map(lambda u: str(u)[:8]),
    min_size=1,
    max_size=6,
    unique=True,
)

_output_text_strategy = st.text(min_size=1, max_size=200)


# ── Property 8: _merge_outputs correctness ───────────────────────────────────

@given(node_ids=_node_ids_strategy, output_text=_output_text_strategy)
@settings(max_examples=200)
def test_merge_outputs_sets_done_status_for_accumulated(node_ids, output_text):
    """
    **Validates: Requirements 10.1, 10.2**

    For any nodes with accumulated outputs, _merge_outputs must set
    data.output to the accumulated value and data.status to 'done'.
    """
    nodes = [make_node(nid) for nid in node_ids]
    # Use a subset of node_ids as accumulated outputs
    accumulated_outputs = {nid: f"{output_text}_{nid}" for nid in node_ids[:max(1, len(node_ids) // 2)]}
    blocked_nodes: set[str] = set()
    error_nodes: set[str] = set()

    result = _merge_outputs(nodes, accumulated_outputs, blocked_nodes, error_nodes)

    # Length must equal input nodes
    assert len(result) == len(nodes), (
        f"updated_nodes length {len(result)} must equal input nodes length {len(nodes)}"
    )

    for node in result:
        nid = node["id"]
        data = node["data"]
        if nid in accumulated_outputs:
            assert data["output"] == accumulated_outputs[nid], (
                f"Node {nid}: data.output must equal accumulated output"
            )
            assert data["status"] == "done", (
                f"Node {nid}: data.status must be 'done' when output is accumulated"
            )


@given(node_ids=_node_ids_strategy)
@settings(max_examples=200)
def test_merge_outputs_sets_error_status_for_failed(node_ids):
    """
    **Validates: Requirements 10.1**

    For any nodes in blocked_nodes (without accumulated output),
    _merge_outputs must set data.status to 'skipped'.
    """
    nodes = [make_node(nid) for nid in node_ids]
    # No accumulated outputs; all nodes are blocked by upstream failures
    accumulated_outputs: dict[str, str] = {}
    blocked_nodes = set(node_ids)

    result = _merge_outputs(nodes, accumulated_outputs, blocked_nodes, set())

    assert len(result) == len(nodes)

    for node in result:
        nid = node["id"]
        assert node["data"]["status"] == "skipped", (
            f"Node {nid}: data.status must be 'skipped' when in blocked_nodes"
        )


@given(node_ids=_node_ids_strategy, output_text=_output_text_strategy)
@settings(max_examples=200)
def test_merge_outputs_accumulated_takes_priority_over_failed(node_ids, output_text):
    """
    **Validates: Requirements 10.1, 10.2**

    When a node is in both accumulated_outputs and error_nodes,
    accumulated output takes priority: status must be 'done'.
    """
    nodes = [make_node(nid) for nid in node_ids]
    accumulated_outputs = {nid: f"{output_text}_{nid}" for nid in node_ids}
    error_nodes = set(node_ids)  # same nodes in both

    result = _merge_outputs(nodes, accumulated_outputs, set(), error_nodes)

    for node in result:
        nid = node["id"]
        data = node["data"]
        assert data["status"] == "done", (
            f"Node {nid}: accumulated output takes priority, status must be 'done'"
        )
        assert data["output"] == accumulated_outputs[nid]


@given(node_ids=_node_ids_strategy)
@settings(max_examples=200)
def test_merge_outputs_length_equals_input(node_ids):
    """
    **Validates: Requirements 10.1**

    The length of updated_nodes must always equal the length of input nodes.
    """
    nodes = [make_node(nid) for nid in node_ids]
    result = _merge_outputs(nodes, {}, set(), set())

    assert len(result) == len(nodes)


# ── Property 9: save_error event followed by workflow_done ───────────────────

@pytest.mark.asyncio
async def test_save_error_event_emitted_when_callback_raises():
    """
    **Validates: Requirements 10.3**

    When save_callback raises an exception, execute_workflow must yield
    a 'save_error' SSE event AND a subsequent 'workflow_done' event.
    """
    workflow_id = "test-wf-001"
    nodes = [make_node("node-a")]
    edges = []

    async def failing_save_callback(wf_id: str, updated_nodes: list) -> None:
        raise RuntimeError("db error")

    # Mock call_llm to return an empty async generator (no LLM calls needed)
    async def mock_call_llm(*args, **kwargs):
        async def empty_gen():
            return
            yield  # make it an async generator
        return empty_gen()

    with patch("app.engine.node_runner.call_llm", side_effect=mock_call_llm):
        gen = execute_workflow(
            workflow_id=workflow_id,
            nodes=nodes,
            edges=edges,
            save_callback=failing_save_callback,
        )
        events = await collect_events(gen)

    event_types = [parse_event_type(e) for e in events]

    assert "save_error" in event_types, (
        f"Expected 'save_error' event in stream, got: {event_types}"
    )
    assert "workflow_done" in event_types, (
        f"Expected 'workflow_done' event in stream, got: {event_types}"
    )

    # workflow_done must come AFTER save_error
    save_error_idx = event_types.index("save_error")
    workflow_done_idx = event_types.index("workflow_done")
    assert save_error_idx < workflow_done_idx, (
        f"'save_error' (idx {save_error_idx}) must appear before 'workflow_done' (idx {workflow_done_idx})"
    )


@pytest.mark.asyncio
async def test_workflow_done_emitted_even_when_save_fails():
    """
    **Validates: Requirements 10.3**

    workflow_done must always be the final event, even when save_callback fails.
    """
    workflow_id = "test-wf-002"
    nodes = [make_node("node-b")]
    edges = []

    async def always_failing_callback(wf_id: str, updated_nodes: list) -> None:
        raise ValueError("connection refused")

    async def mock_call_llm(*args, **kwargs):
        async def empty_gen():
            return
            yield
        return empty_gen()

    with patch("app.engine.node_runner.call_llm", side_effect=mock_call_llm):
        gen = execute_workflow(
            workflow_id=workflow_id,
            nodes=nodes,
            edges=edges,
            save_callback=always_failing_callback,
        )
        events = await collect_events(gen)

    event_types = [parse_event_type(e) for e in events]

    assert event_types[-1] == "workflow_done", (
        f"Last event must be 'workflow_done', got: {event_types[-1]}"
    )


@pytest.mark.asyncio
async def test_no_save_error_when_callback_succeeds():
    """
    **Validates: Requirements 10.1, 10.2**

    When save_callback succeeds, no 'save_error' event should be emitted.
    """
    workflow_id = "test-wf-003"
    nodes = [make_node("node-c")]
    edges = []
    saved_data = {}

    async def successful_callback(wf_id: str, updated_nodes: list) -> None:
        saved_data["wf_id"] = wf_id
        saved_data["nodes"] = updated_nodes

    async def mock_call_llm(*args, **kwargs):
        async def empty_gen():
            return
            yield
        return empty_gen()

    with patch("app.engine.node_runner.call_llm", side_effect=mock_call_llm):
        gen = execute_workflow(
            workflow_id=workflow_id,
            nodes=nodes,
            edges=edges,
            save_callback=successful_callback,
        )
        events = await collect_events(gen)

    event_types = [parse_event_type(e) for e in events]

    assert "save_error" not in event_types, (
        f"No 'save_error' expected when callback succeeds, got: {event_types}"
    )
    assert "workflow_done" in event_types

    # Verify callback was called with correct workflow_id
    assert saved_data.get("wf_id") == workflow_id


@pytest.mark.asyncio
async def test_no_save_callback_does_not_error():
    """
    **Validates: Requirements 10.4**

    When save_callback is None, execute_workflow must complete normally
    without any 'save_error' event.
    """
    workflow_id = "test-wf-004"
    nodes = [make_node("node-d")]
    edges = []

    async def mock_call_llm(*args, **kwargs):
        async def empty_gen():
            return
            yield
        return empty_gen()

    with patch("app.engine.node_runner.call_llm", side_effect=mock_call_llm):
        gen = execute_workflow(
            workflow_id=workflow_id,
            nodes=nodes,
            edges=edges,
            save_callback=None,
        )
        events = await collect_events(gen)

    event_types = [parse_event_type(e) for e in events]

    assert "save_error" not in event_types
    assert "workflow_done" in event_types
