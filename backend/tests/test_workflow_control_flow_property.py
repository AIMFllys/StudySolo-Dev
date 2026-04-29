import asyncio
import json
from typing import Any, AsyncIterator

import pytest

from app.engine.executor import _get_max_wait_seconds, execute_workflow
from app.nodes._base import BaseNode, NodeInput, NodeOutput


def parse_event(event_str: str) -> tuple[str, dict]:
    event_type = ""
    payload = {}
    for line in event_str.split("\n"):
        if line.startswith("event: "):
            event_type = line[7:]
        if line.startswith("data: "):
            payload = json.loads(line[6:])
    return event_type, payload


async def collect_events(gen: AsyncIterator[str]) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    async for event_str in gen:
        events.append(parse_event(event_str))
    return events


class EchoNode(BaseNode):
    _abstract = True  # prevent auto-registration into BaseNode._registry
    node_type = "summary"
    category = "generation"
    description = "echo"
    output_format = "markdown"

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        yield f"echo:{node_input.user_content}"

    async def post_process(self, raw_output: str) -> NodeOutput:
        return NodeOutput(content=raw_output, format="markdown")


class BranchingNode(BaseNode):
    _abstract = True  # prevent auto-registration into BaseNode._registry
    node_type = "logic_switch"
    category = "analysis"
    description = "branch"
    output_format = "json"

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        yield '{"branch":"A","reason":"choose A"}'

    async def post_process(self, raw_output: str) -> NodeOutput:
        return NodeOutput(
            content=raw_output,
            format="json",
            metadata={"branch": "A", "reason": "choose A"},
        )


class StreamingNode(BaseNode):
    _abstract = True  # prevent auto-registration into BaseNode._registry
    node_type = "summary"
    category = "generation"
    description = "stream"
    output_format = "markdown"

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        yield f"{node_input.user_content}-1"
        await asyncio.sleep(0)
        yield f"{node_input.user_content}-2"

    async def post_process(self, raw_output: str) -> NodeOutput:
        return NodeOutput(content=raw_output, format="markdown")


class FailingNode(BaseNode):
    _abstract = True  # prevent auto-registration into BaseNode._registry
    node_type = "summary"
    category = "generation"
    description = "fail"
    output_format = "markdown"

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        raise RuntimeError("boom")
        yield ""

    async def post_process(self, raw_output: str) -> NodeOutput:
        return NodeOutput(content=raw_output, format="markdown")


@pytest.mark.asyncio
async def test_execute_workflow_emits_skipped_status_for_non_selected_branch(monkeypatch):
    registry = {"logic_switch": BranchingNode, "summary": EchoNode}
    monkeypatch.setattr("app.engine.level_runner.NODE_REGISTRY", registry)
    monkeypatch.setattr("app.engine.node_runner.NODE_REGISTRY", registry)

    nodes = [
        {"id": "switch", "type": "logic_switch", "data": {"label": "branch", "status": "pending", "output": ""}},
        {"id": "node-a", "type": "summary", "data": {"label": "A", "status": "pending", "output": ""}},
        {"id": "node-b", "type": "summary", "data": {"label": "B", "status": "pending", "output": ""}},
    ]
    edges = [
        {"id": "e-a", "source": "switch", "target": "node-a", "data": {"branch": "A"}},
        {"id": "e-b", "source": "switch", "target": "node-b", "data": {"branch": "B"}},
    ]

    events = await collect_events(execute_workflow("wf-branch", nodes, edges))
    skipped = [
        payload for event_type, payload in events
        if event_type == "node_status" and payload.get("status") == "skipped"
    ]

    assert any(payload.get("node_id") == "node-b" for payload in skipped)
    assert not any(
        event_type == "node_done" and payload.get("node_id") == "node-b"
        for event_type, payload in events
    )


@pytest.mark.asyncio
async def test_execute_workflow_emits_loop_iteration_events(monkeypatch):
    registry = {"summary": EchoNode}
    monkeypatch.setattr("app.engine.level_runner.NODE_REGISTRY", registry)
    monkeypatch.setattr("app.engine.node_runner.NODE_REGISTRY", registry)

    async def fake_sleep(_seconds: float):
        return None

    import app.engine.loop_runner as loop_runner_module
    monkeypatch.setattr(loop_runner_module.asyncio, "sleep", fake_sleep)

    nodes = [
        {
            "id": "loop-1",
            "type": "loop_group",
            "data": {"label": "循环块", "maxIterations": 3, "intervalSeconds": 0},
        },
        {
            "id": "child-1",
            "type": "summary",
            "parentId": "loop-1",
            "data": {"label": "child", "status": "pending", "output": ""},
        },
    ]
    edges = []

    events = await collect_events(execute_workflow("wf-loop", nodes, edges))
    loop_events = [payload for event_type, payload in events if event_type == "loop_iteration"]

    assert len(loop_events) == 3
    assert loop_events[-1]["group_id"] == "loop-1"
    assert loop_events[-1]["iteration"] == 3
    assert loop_events[-1]["total"] == 3


@pytest.mark.asyncio
async def test_execute_workflow_streams_parallel_node_tokens_with_shared_group_metadata(monkeypatch):
    registry = {"summary": StreamingNode}
    monkeypatch.setattr("app.engine.level_runner.NODE_REGISTRY", registry)
    monkeypatch.setattr("app.engine.node_runner.NODE_REGISTRY", registry)

    nodes = [
      {"id": "node-a", "type": "summary", "data": {"label": "A", "user_content": "A", "status": "pending", "output": ""}},
      {"id": "node-b", "type": "summary", "data": {"label": "B", "user_content": "B", "status": "pending", "output": ""}},
    ]
    edges: list[dict] = []

    events = await collect_events(execute_workflow("wf-parallel", nodes, edges))
    token_events = [
        payload for event_type, payload in events
        if event_type == "node_token"
    ]
    done_indexes = [
        index for index, (event_type, _) in enumerate(events)
        if event_type == "node_done"
    ]

    assert len(token_events) >= 4
    assert {payload["parallel_group_id"] for payload in token_events} == {"node-a|node-b"}
    assert any(payload["node_id"] == "node-a" for payload in token_events)
    assert any(payload["node_id"] == "node-b" for payload in token_events)
    assert any(
        event_type == "node_token"
        for event_type, _ in events[:done_indexes[0]]
    )


@pytest.mark.asyncio
async def test_execute_workflow_loop_children_emit_iteration_metadata(monkeypatch):
    registry = {"summary": StreamingNode}
    monkeypatch.setattr("app.engine.level_runner.NODE_REGISTRY", registry)
    monkeypatch.setattr("app.engine.node_runner.NODE_REGISTRY", registry)

    nodes = [
        {
            "id": "loop-1",
            "type": "loop_group",
            "data": {"label": "循环块", "maxIterations": 2, "intervalSeconds": 0},
        },
        {
            "id": "child-1",
            "type": "summary",
            "parentId": "loop-1",
            "data": {"label": "child", "user_content": "child", "status": "pending", "output": ""},
        },
    ]
    edges = []

    events = await collect_events(execute_workflow("wf-loop-meta", nodes, edges))
    child_inputs = [
        payload for event_type, payload in events
        if event_type == "node_input" and payload.get("node_id") == "child-1"
    ]

    assert len(child_inputs) == 2
    assert child_inputs[0]["loop_group_id"] == "loop-1"
    assert child_inputs[0]["iteration"] == 1
    assert child_inputs[1]["iteration"] == 2


@pytest.mark.asyncio
async def test_execute_workflow_marks_terminal_status_error_when_node_fails(monkeypatch):
    registry = {"summary": FailingNode}
    monkeypatch.setattr("app.engine.level_runner.NODE_REGISTRY", registry)
    monkeypatch.setattr("app.engine.node_runner.NODE_REGISTRY", registry)

    nodes = [
        {"id": "node-a", "type": "summary", "data": {"label": "A", "status": "pending", "output": ""}},
    ]
    edges: list[dict] = []

    events = await collect_events(execute_workflow("wf-error", nodes, edges))
    workflow_done = next(
        payload for event_type, payload in events
        if event_type == "workflow_done"
    )

    assert workflow_done["status"] == "error"
    assert workflow_done["error"] == "1 个节点执行失败"


def test_get_max_wait_seconds_uses_highest_incoming_edge_and_caps_value():
    edges = [
        {"id": "a", "source": "n1", "target": "n3", "data": {"waitSeconds": 1.5}},
        {"id": "b", "source": "n2", "target": "n3", "data": {"waitSeconds": 999}},
        {"id": "c", "source": "n2", "target": "n4", "data": {"waitSeconds": 2}},
    ]

    assert _get_max_wait_seconds("n3", edges) == 300
    assert _get_max_wait_seconds("n4", edges) == 2
