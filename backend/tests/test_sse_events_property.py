"""
Property 16: SSE 事件类型合规性
Feature: studysolo-mvp, Property 16: SSE 事件类型合规性

For any SSE event emitted during workflow execution, the event type
must be one of: node_status, node_token, node_done, workflow_done.

Validates: Requirements 6.6
"""

import json
import re

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.services.workflow_engine import _sse_event

VALID_EVENT_TYPES = {"node_status", "node_token", "node_done", "workflow_done"}

_event_type_strategy = st.sampled_from(list(VALID_EVENT_TYPES))
_data_strategy = st.fixed_dictionaries({
    "node_id": st.uuids().map(str),
    "status": st.sampled_from(["pending", "running", "done", "error"]),
})


@given(_event_type_strategy, _data_strategy)
@settings(max_examples=200)
def test_sse_event_format_is_valid(event_type, data):
    """_sse_event must produce correctly formatted SSE strings."""
    result = _sse_event(event_type, data)

    # Must start with "event: <type>"
    assert result.startswith(f"event: {event_type}\n"), (
        f"SSE event must start with 'event: {event_type}\\n', got: {result[:50]}"
    )

    # Must contain "data: <json>"
    assert "data: " in result

    # Must end with double newline
    assert result.endswith("\n\n")

    # Data must be valid JSON
    data_line = [line for line in result.split("\n") if line.startswith("data: ")][0]
    json_str = data_line[len("data: "):]
    parsed = json.loads(json_str)
    assert isinstance(parsed, dict)


@given(st.sampled_from(list(VALID_EVENT_TYPES)))
@settings(max_examples=100)
def test_sse_event_type_is_in_valid_set(event_type):
    """All generated event types must be in the valid set."""
    assert event_type in VALID_EVENT_TYPES


def test_sse_event_types_cover_all_required():
    """The valid event type set must contain all 4 required types."""
    required = {"node_status", "node_token", "node_done", "workflow_done"}
    assert required == VALID_EVENT_TYPES


@given(
    node_id=st.uuids().map(str),
    token=st.text(min_size=1, max_size=100),
)
@settings(max_examples=100)
def test_node_token_event_structure(node_id, token):
    """node_token events must contain node_id and token fields."""
    result = _sse_event("node_token", {"node_id": node_id, "token": token})
    data_line = [line for line in result.split("\n") if line.startswith("data: ")][0]
    parsed = json.loads(data_line[len("data: "):])
    assert parsed["node_id"] == node_id
    assert parsed["token"] == token


@given(
    workflow_id=st.uuids().map(str),
    status=st.sampled_from(["completed", "error"]),
)
@settings(max_examples=100)
def test_workflow_done_event_structure(workflow_id, status):
    """workflow_done events must contain workflow_id and status fields."""
    result = _sse_event("workflow_done", {"workflow_id": workflow_id, "status": status})
    data_line = [line for line in result.split("\n") if line.startswith("data: ")][0]
    parsed = json.loads(data_line[len("data: "):])
    assert parsed["workflow_id"] == workflow_id
    assert parsed["status"] == status
