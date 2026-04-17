import json
from types import SimpleNamespace

import pytest

from app.models.ai_chat import AIChatRequest, CanvasContextSchema
from app.services.ai_chat.agent_loop import _maybe_run_direct_shortcut, run_agent_loop
from app.services.ai_chat.tools.base import ToolContext, ToolResult


class _FakeQuery:
    def __init__(self, rows):
        self.rows = rows

    def select(self, _selected):
        return self

    def eq(self, _key, _value):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, _value):
        return self

    async def execute(self):
        return SimpleNamespace(data=self.rows)


class _FakeWorkflowDb:
    def __init__(self, rows):
        self.rows = rows

    def from_(self, table):
        assert table == "ss_workflows"
        return _FakeQuery(self.rows)


@pytest.mark.asyncio
async def test_direct_shortcut_handles_start_workflow_background(monkeypatch):
    async def fake_handler(_ctx, params):
        return ToolResult(ok=True, data={"run_id": "run-1", "workflow_id": params["id"]})

    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.get_tool",
        lambda name: SimpleNamespace(handler=fake_handler)
        if name == "start_workflow_background"
        else None,
    )

    events = await _maybe_run_direct_shortcut(
        AIChatRequest(
            user_input="\u540e\u53f0\u8fd0\u884c\u5f53\u524d\u5de5\u4f5c\u6d41",
            mode="chat",
            canvas_context=CanvasContextSchema(
                workflow_id="wf-1",
                workflow_name="\u6d4b\u8bd5\u5de5\u4f5c\u6d41",
            ),
        ),
        ToolContext(
            user={"id": "user-1"},
            db=object(),
            service_db=object(),
            workflow_id="wf-1",
        ),
    )

    assert events is not None
    payloads = [json.loads(item["data"]) for item in events]
    assert any(
        item.get("event") == "tool_call"
        and item.get("tool") == "start_workflow_background"
        for item in payloads
    )
    assert any(
        item.get("event") == "segment_delta"
        and item.get("tag") == "answer"
        and "run_id" in item.get("delta", "")
        for item in payloads
    )


@pytest.mark.asyncio
async def test_direct_shortcut_handles_list_workflows(monkeypatch):
    async def fake_handler(_ctx, _params):
        return ToolResult(
            ok=True,
            data={
                "items": [
                    {"id": "wf-1", "name": "\u7b2c\u4e8c\u5de5\u4f5c\u6d41"},
                    {"id": "wf-2", "name": "Docker \u5165\u95e8"},
                ],
                "count": 2,
            },
        )

    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.get_tool",
        lambda name: SimpleNamespace(handler=fake_handler) if name == "list_workflows" else None,
    )

    events = await _maybe_run_direct_shortcut(
        AIChatRequest(user_input="\u5e2e\u6211\u5217\u51fa\u6211\u7684\u5de5\u4f5c\u6d41", mode="chat"),
        ToolContext(user={"id": "user-1"}, db=object(), service_db=object(), workflow_id=None),
    )

    assert events is not None
    payloads = [json.loads(item["data"]) for item in events]
    assert any(
        item.get("event") == "tool_call" and item.get("tool") == "list_workflows"
        for item in payloads
    )
    assert any(
        item.get("event") == "segment_delta"
        and item.get("tag") == "answer"
        and "\u7b2c\u4e8c\u5de5\u4f5c\u6d41" in item.get("delta", "")
        for item in payloads
    )


@pytest.mark.asyncio
async def test_direct_shortcut_handles_read_canvas(monkeypatch):
    async def fake_handler(_ctx, _params):
        return ToolResult(
            ok=True,
            data={
                "workflow_id": "wf-1",
                "node_count": 2,
                "edge_count": 1,
                "nodes": [
                    {"id": "n-1", "label": "\u8f93\u5165", "type": "trigger_input", "status": "pending"},
                    {"id": "n-2", "label": "\u603b\u7ed3", "type": "summary", "status": "running"},
                ],
            },
        )

    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.get_tool",
        lambda name: SimpleNamespace(handler=fake_handler) if name == "read_canvas" else None,
    )

    events = await _maybe_run_direct_shortcut(
        AIChatRequest(
            user_input="\u4f60\u80fd\u770b\u5230\u5f53\u524d\u753b\u5e03\u6709\u54ea\u4e9b\u8282\u70b9\u5417\uff1f",
            mode="chat",
            canvas_context=CanvasContextSchema(workflow_id="wf-1", workflow_name="\u6d4b\u8bd5"),
        ),
        ToolContext(user={"id": "user-1"}, db=object(), service_db=object(), workflow_id="wf-1"),
    )

    assert events is not None
    payloads = [json.loads(item["data"]) for item in events]
    assert any(
        item.get("event") == "tool_call" and item.get("tool") == "read_canvas"
        for item in payloads
    )
    assert any(
        item.get("event") == "segment_delta"
        and item.get("tag") == "answer"
        and "\u8f93\u5165" in item.get("delta", "")
        and "\u603b\u7ed3" in item.get("delta", "")
        for item in payloads
    )


@pytest.mark.asyncio
async def test_direct_shortcut_handles_open_workflow_by_name(monkeypatch):
    async def fake_handler(_ctx, params):
        return ToolResult(
            ok=True,
            data={"id": params["id"], "name": "\u7b2c\u4e8c\u5de5\u4f5c\u6d41"},
        )

    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.get_tool",
        lambda name: SimpleNamespace(handler=fake_handler) if name == "open_workflow" else None,
    )

    events = await _maybe_run_direct_shortcut(
        AIChatRequest(user_input="\u6253\u5f00\u5de5\u4f5c\u6d41\u300c\u7b2c\u4e8c\u5de5\u4f5c\u6d41\u300d", mode="chat"),
        ToolContext(
            user={"id": "user-1"},
            db=_FakeWorkflowDb([{"id": "wf-2", "name": "\u7b2c\u4e8c\u5de5\u4f5c\u6d41"}]),
            service_db=object(),
            workflow_id=None,
        ),
    )

    assert events is not None
    payloads = [json.loads(item["data"]) for item in events]
    assert any(
        item.get("event") == "tool_call" and item.get("tool") == "open_workflow"
        for item in payloads
    )
    assert any(
        item.get("event") == "segment_delta"
        and item.get("tag") == "answer"
        and "\u5df2\u6253\u5f00\u5de5\u4f5c\u6d41\u300c\u7b2c\u4e8c\u5de5\u4f5c\u6d41\u300d" in item.get("delta", "")
        for item in payloads
    )


@pytest.mark.asyncio
async def test_direct_shortcut_handles_missing_open_workflow(monkeypatch):
    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.get_tool",
        lambda name: SimpleNamespace(handler=lambda *_args, **_kwargs: None) if name == "open_workflow" else None,
    )

    events = await _maybe_run_direct_shortcut(
        AIChatRequest(user_input="\u6253\u5f00\u5de5\u4f5c\u6d41\u300c\u4e0d\u5b58\u5728\u7684\u540d\u5b57\u300d", mode="chat"),
        ToolContext(
            user={"id": "user-1"},
            db=_FakeWorkflowDb([{"id": "wf-2", "name": "\u7b2c\u4e8c\u5de5\u4f5c\u6d41"}]),
            service_db=object(),
            workflow_id=None,
        ),
    )

    assert events is not None
    payloads = [json.loads(item["data"]) for item in events]
    assert any(
        item.get("event") == "tool_result"
        and item.get("ok") is False
        and "\u627e\u4e0d\u5230\u5de5\u4f5c\u6d41" in (item.get("error") or "")
        for item in payloads
    )


@pytest.mark.asyncio
async def test_direct_shortcut_uses_run_id_from_history(monkeypatch):
    async def fake_handler(_ctx, params):
        return ToolResult(ok=True, data={"run_id": params["run_id"], "status": "running"})

    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.get_tool",
        lambda name: SimpleNamespace(handler=fake_handler)
        if name == "get_workflow_run_status"
        else None,
    )

    events = await _maybe_run_direct_shortcut(
        AIChatRequest(
            user_input="\u67e5\u8be2\u521a\u624d\u90a3\u4e2a\u8fd0\u884c\u72b6\u6001",
            mode="chat",
            conversation_history=[
                {
                    "role": "assistant",
                    "content": "run_id = `123e4567-e89b-12d3-a456-426614174000`",
                }
            ],
        ),
        ToolContext(user={"id": "user-1"}, db=object(), service_db=object(), workflow_id=None),
    )

    assert events is not None
    payloads = [json.loads(item["data"]) for item in events]
    assert any(
        item.get("event") == "tool_call"
        and item.get("tool") == "get_workflow_run_status"
        for item in payloads
    )
    assert any(
        item.get("event") == "tool_result"
        and item.get("data", {}).get("run_id") == "123e4567-e89b-12d3-a456-426614174000"
        for item in payloads
    )


@pytest.mark.asyncio
async def test_direct_shortcut_handles_missing_node_rename(monkeypatch):
    async def fake_handler(_ctx, _params):
        return ToolResult(ok=False, error="\u627e\u4e0d\u5230\u8282\u70b9\u300c\u4e0d\u5b58\u5728\u7684\u300d")

    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.get_tool",
        lambda name: SimpleNamespace(handler=fake_handler) if name == "update_node" else None,
    )

    events = await _maybe_run_direct_shortcut(
        AIChatRequest(
            user_input="\u628a\u4e0d\u5b58\u5728\u7684\u8282\u70b9\u6539\u540d\u4e3a\u300c\u6d4b\u8bd5\u300d",
            mode="chat",
            canvas_context=CanvasContextSchema(workflow_id="wf-1", workflow_name="\u6d4b\u8bd5"),
        ),
        ToolContext(user={"id": "user-1"}, db=object(), service_db=object(), workflow_id="wf-1"),
    )

    assert events is not None
    payloads = [json.loads(item["data"]) for item in events]
    assert any(
        item.get("event") == "tool_call" and item.get("tool") == "update_node"
        for item in payloads
    )
    assert any(
        item.get("event") == "segment_delta"
        and item.get("tag") == "answer"
        and "\u64cd\u4f5c\u5931\u8d25" in item.get("delta", "")
        for item in payloads
    )
    assert any(
        item.get("event") == "segment_delta"
        and item.get("tag") == "summary.change"
        and "\u672c\u8f6e\u672a\u4ea7\u751f\u526f\u4f5c\u7528" in item.get("delta", "")
        for item in payloads
    )


@pytest.mark.asyncio
async def test_direct_shortcut_handles_add_edge(monkeypatch):
    async def fake_handler(_ctx, params):
        return ToolResult(
            ok=True,
            data={"source": params["source"], "target": params["target"]},
        )

    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.get_tool",
        lambda name: SimpleNamespace(handler=fake_handler) if name == "add_edge" else None,
    )

    events = await _maybe_run_direct_shortcut(
        AIChatRequest(
            user_input="\u628a\u300c\u8f93\u5165\u300d\u8282\u70b9\u8fde\u5230\u300cDocker \u590d\u76d8\u300d",
            mode="chat",
            canvas_context=CanvasContextSchema(workflow_id="wf-1", workflow_name="\u6d4b\u8bd5"),
        ),
        ToolContext(user={"id": "user-1"}, db=object(), service_db=object(), workflow_id="wf-1"),
    )

    assert events is not None
    payloads = [json.loads(item["data"]) for item in events]
    assert any(
        item.get("event") == "tool_call" and item.get("tool") == "add_edge"
        for item in payloads
    )
    assert any(
        item.get("event") == "segment_delta"
        and item.get("tag") == "answer"
        and "\u5df2\u5c06\u300c\u8f93\u5165\u300d\u8fde\u63a5\u5230\u300cDocker \u590d\u76d8\u300d" in item.get("delta", "")
        for item in payloads
    )


@pytest.mark.asyncio
async def test_direct_shortcut_handles_add_node_after_last_step(monkeypatch):
    async def fake_handler(_ctx, params):
        assert params["node_type"] == "summary"
        assert params["label"] == "Docker \u603b\u7ed3"
        assert params["anchor"] == "\u603b\u7ed3"
        return ToolResult(ok=True, data={"created_node_id": "summary-1", "node_type": params["node_type"]})

    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.get_tool",
        lambda name: SimpleNamespace(handler=fake_handler) if name == "add_node" else None,
    )

    events = await _maybe_run_direct_shortcut(
        AIChatRequest(
            user_input="\u5728\u5f53\u524d\u753b\u5e03\u6700\u540e\u4e00\u6b65\u540e\u9762\u65b0\u589e\u4e00\u4e2a\u603b\u7ed3\u8282\u70b9\uff0c\u53eb\u300cDocker \u603b\u7ed3\u300d",
            mode="chat",
            canvas_context=CanvasContextSchema(
                workflow_id="wf-1",
                workflow_name="\u6d4b\u8bd5",
                nodes=[
                    {
                        "id": "n-1",
                        "index": 0,
                        "label": "\u8f93\u5165",
                        "type": "trigger_input",
                    },
                    {
                        "id": "n-2",
                        "index": 1,
                        "label": "\u603b\u7ed3",
                        "type": "summary",
                    },
                ],
            ),
        ),
        ToolContext(user={"id": "user-1"}, db=object(), service_db=object(), workflow_id="wf-1"),
    )

    assert events is not None
    payloads = [json.loads(item["data"]) for item in events]
    assert any(
        item.get("event") == "tool_call" and item.get("tool") == "add_node"
        for item in payloads
    )
    assert any(
        item.get("event") == "segment_delta"
        and item.get("tag") == "answer"
        and "\u5df2\u65b0\u589e\u8282\u70b9\u300cDocker \u603b\u7ed3\u300d" in item.get("delta", "")
        for item in payloads
    )


@pytest.mark.asyncio
async def test_direct_shortcut_handles_missing_edge_delete(monkeypatch):
    async def fake_handler(_ctx, params):
        assert params["edge_id"] == "__missing_edge__"
        return ToolResult(ok=False, error="[edge_not_found] \u627e\u4e0d\u5230\u8fde\u7ebf")

    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.get_tool",
        lambda name: SimpleNamespace(handler=fake_handler) if name == "delete_edge" else None,
    )

    events = await _maybe_run_direct_shortcut(
        AIChatRequest(
            user_input="\u5220\u9664\u4e0d\u5b58\u5728\u7684\u8fde\u7ebf",
            mode="chat",
            canvas_context=CanvasContextSchema(workflow_id="wf-1", workflow_name="\u6d4b\u8bd5"),
        ),
        ToolContext(user={"id": "user-1"}, db=object(), service_db=object(), workflow_id="wf-1"),
    )

    assert events is not None
    payloads = [json.loads(item["data"]) for item in events]
    assert any(
        item.get("event") == "tool_call" and item.get("tool") == "delete_edge"
        for item in payloads
    )
    assert any(
        item.get("event") == "segment_delta"
        and item.get("tag") == "answer"
        and "\u64cd\u4f5c\u5931\u8d25" in item.get("delta", "")
        for item in payloads
    )


@pytest.mark.asyncio
async def test_run_agent_loop_emits_fallback_segments_after_tool_only_round(monkeypatch):
    rounds = {"count": 0}

    async def fake_token_iter(_selected_sku, _messages, _thinking_level):
        rounds["count"] += 1

        async def gen():
            if rounds["count"] == 1:
                yield (
                    '<tool_use name="add_edge">'
                    '<params>{"source":"\u8f93\u5165","target":"Docker \u590d\u76d8"}</params>'
                    "</tool_use>"
                )
            else:
                if False:
                    yield ""

        return gen()

    async def fake_resolve_selected_sku(**_kwargs):
        return None

    async def fake_workflow_list(_ctx):
        return ""

    async def fake_add_edge(_ctx, _params):
        return ToolResult(ok=True, data={"source": "n-1", "target": "n-2"})

    monkeypatch.setattr("app.services.ai_chat.agent_loop._get_token_iter", fake_token_iter)
    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.resolve_selected_sku",
        fake_resolve_selected_sku,
    )
    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop._build_workflow_list_summary",
        fake_workflow_list,
    )
    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.get_tool",
        lambda name: SimpleNamespace(handler=fake_add_edge) if name == "add_edge" else None,
    )

    body = AIChatRequest(
        user_input="\u628a\u300c\u8f93\u5165\u300d\u8282\u70b9\u8fde\u5230\u300cDocker \u590d\u76d8\u300d",
        mode="chat",
        canvas_context=CanvasContextSchema(workflow_id="wf-1", workflow_name="\u6d4b\u8bd5"),
    )

    payloads: list[dict[str, object]] = []
    async for event in run_agent_loop(
        body,
        {"id": "user-1"},
        db=object(),
        service_db=object(),
    ):
        if event["data"] == "[DONE]":
            continue
        payloads.append(json.loads(event["data"]))

    assert any(
        item.get("event") == "tool_call" and item.get("tool") == "add_edge"
        for item in payloads
    )
    assert any(
        item.get("event") == "segment_delta"
        and item.get("tag") == "answer"
        and "\u5df2\u5c06\u300c\u8f93\u5165\u300d\u8fde\u63a5\u5230\u300cDocker \u590d\u76d8\u300d" in item.get("delta", "")
        for item in payloads
    )
    assert any(
        item.get("event") == "segment_delta"
        and item.get("tag") == "summary.change"
        and "add_edge: \u8f93\u5165 -> Docker \u590d\u76d8" in item.get("delta", "")
        for item in payloads
    )
