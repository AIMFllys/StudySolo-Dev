import json
from types import SimpleNamespace

import pytest

from app.api.ai.chat import _agent_loop_enabled, _sanitize_legacy_chat_text
from app.models.ai_catalog import CatalogSku
from app.models.ai_chat import AIChatRequest, CanvasContextSchema
from app.services.ai_chat.agent_loop import (
    _get_token_iter,
    _maybe_extract_current_workflow_rename,
    _maybe_run_direct_shortcut,
)
from app.services.ai_chat.helpers import (
    ReasoningStreamSanitizer,
    build_canvas_summary,
    strip_reasoning_blocks,
)
from app.services.ai_chat.tools.base import ToolContext
from app.services.ai_chat.tools.canvas_tools import read_canvas_tool
from app.services.ai_chat.thinking import (
    resolve_effective_thinking_level,
    should_force_reasoning_model,
)
from app.services.ai_chat.tools import iter_tool_specs
from app.services.llm.caller import LLMStreamResult, stream_tokens
from app.services.workflow_runs_service import get_run_status


def _sku(sku_id: str, *, supports_thinking: bool) -> CatalogSku:
    return CatalogSku(
        sku_id=sku_id,
        family_id=f"family-{sku_id}",
        family_name=f"Family {sku_id}",
        provider="test-provider",
        vendor="test-vendor",
        model_id=f"model-{sku_id}",
        display_name=f"Model {sku_id}",
        billing_channel="native",
        task_family="chat_response",
        routing_policy="native_first",
        supports_thinking=supports_thinking,
    )


def test_ai_chat_request_defaults_to_fast_thinking():
    assert AIChatRequest(user_input="你好").thinking_level == "fast"


def test_agent_loop_disabled_for_plain_chat_without_canvas(monkeypatch):
    monkeypatch.delenv("AGENT_LOOP_DISABLED", raising=False)
    body = AIChatRequest(user_input="你好，解释一下费曼学习法", mode="chat")

    assert _agent_loop_enabled(body) is False


def test_agent_loop_enabled_for_tool_contexts(monkeypatch):
    monkeypatch.delenv("AGENT_LOOP_DISABLED", raising=False)

    assert _agent_loop_enabled(AIChatRequest(user_input="帮我规划", mode="plan")) is True
    assert _agent_loop_enabled(AIChatRequest(user_input="新增两个节点", mode="create")) is True
    assert _agent_loop_enabled(
        AIChatRequest(
            user_input="你好",
            mode="chat",
            canvas_context=CanvasContextSchema(workflow_id="wf-1"),
        )
    ) is True
    assert _agent_loop_enabled(AIChatRequest(user_input="列出我的工作流", mode="chat")) is True


def test_build_canvas_summary_keeps_current_workflow_when_canvas_is_empty():
    summary = build_canvas_summary(
        CanvasContextSchema(
            workflow_id="wf-empty",
            workflow_name="空白工作流",
            nodes=[],
        )
    )

    assert "Workflow: 空白工作流" in summary
    assert "Workflow ID: wf-empty" in summary
    assert "Node count: 0" in summary
    assert "Canvas is empty." in summary


def test_agent_loop_respects_global_and_intent_opt_out(monkeypatch):
    monkeypatch.setenv("AGENT_LOOP_DISABLED", "1")
    assert _agent_loop_enabled(AIChatRequest(user_input="列出我的工作流", mode="chat")) is False

    monkeypatch.delenv("AGENT_LOOP_DISABLED", raising=False)
    assert _agent_loop_enabled(
        AIChatRequest(user_input="列出我的工作流", mode="chat", intent_hint="LEGACY")
    ) is False


def test_strip_reasoning_blocks_preserves_agent_xml():
    raw = (
        "<think>hidden</think>"
        "<answer>ok</answer>"
        "<thinking>more hidden</thinking>"
        "<tool_use name=\"read_canvas\"><params>{}</params></tool_use>"
        "<reasoning>also hidden</reasoning>"
        "<summary><change>改了节点</change></summary>"
    )

    cleaned = strip_reasoning_blocks(raw)

    assert "hidden" not in cleaned
    assert "<answer>ok</answer>" in cleaned
    assert "<tool_use name=\"read_canvas\">" in cleaned
    assert "<summary><change>改了节点</change></summary>" in cleaned


def test_agent_tool_registry_contains_expected_tools():
    names = {spec.name for spec in iter_tool_specs()}

    assert names == {
        "list_workflows",
        "open_workflow",
        "rename_workflow",
        "batch_rename_workflows",
        "start_workflow_background",
        "get_workflow_run_status",
        "read_canvas",
        "add_node",
        "update_node",
        "delete_node",
        "add_edge",
        "delete_edge",
    }


@pytest.mark.asyncio
async def test_read_canvas_tool_includes_node_status(monkeypatch):
    async def fake_load_workflow(_ctx, _workflow_id):
        return {
            "id": "wf-1",
            "name": "测试工作流",
            "nodes_json": [
                {
                    "id": "n-1",
                    "type": "summary",
                    "data": {"label": "Docker 总结", "status": "running"},
                }
            ],
            "edges_json": [],
        }

    monkeypatch.setattr(
        "app.services.ai_chat.tools.canvas_tools._load_workflow",
        fake_load_workflow,
    )

    result = await read_canvas_tool(
        ToolContext(user={"id": "user-1"}, db=object(), service_db=object(), workflow_id="wf-1"),
        {},
    )

    assert result.ok is True
    assert result.data["nodes"] == [
        {
            "id": "n-1",
            "type": "summary",
            "label": "Docker 总结",
            "status": "running",
        }
    ]


class _RunResult:
    def __init__(self, data):
        self.data = data


class _RunStatusDb:
    def from_(self, table: str):
        return _RunStatusQuery(table)


class _RunStatusQuery:
    def __init__(self, table: str):
        self.table = table
        self.filters: list[tuple[str, object]] = []
        self.selected = "*"

    def select(self, selected: str):
        self.selected = selected
        return self

    def eq(self, key: str, value):
        self.filters.append((key, value))
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def maybe_single(self):
        return self

    async def execute(self):
        if self.table == "ss_workflow_runs":
            return _RunResult(
                {
                    "id": "run-1",
                    "workflow_id": "wf-1",
                    "user_id": "user-1",
                    "status": "failed",
                    "started_at": "2026-04-17T00:00:00+00:00",
                    "completed_at": "2026-04-17T00:00:10+00:00",
                    "tokens_used": 42,
                }
            )
        if self.table == "ss_workflow_run_events":
            return _RunResult({"payload": {"error": "节点执行失败"}})
        return _RunResult(None)


@pytest.mark.asyncio
async def test_get_run_status_merges_progress_snapshot(monkeypatch):
    async def fake_progress(_db, _run_id):
        return {
            "run_id": "run-1",
            "workflow_id": "wf-1",
            "status": "failed",
            "phase": "executing",
            "current_node_id": "n-2",
            "current_node_label": "Docker 复盘",
            "total_nodes": 3,
            "done_nodes": 2,
            "percent": 66,
            "elapsed_ms": 10000,
            "last_event_at": "2026-04-17T00:00:10+00:00",
        }

    monkeypatch.setattr(
        "app.services.workflow_runs_service.summarise_progress",
        fake_progress,
    )

    result = await get_run_status(
        run_id="run-1",
        user={"id": "user-1"},
        service_db=_RunStatusDb(),
    )

    assert result["done_nodes"] == 2
    assert result["percent"] == 66
    assert result["current_node_label"] == "Docker 复盘"
    assert result["tokens_used"] == 42
    assert result["error"] == "节点执行失败"


def test_effective_thinking_level_respects_selected_sku_capability():
    thinking_sku = _sku("thinking", supports_thinking=True)
    non_thinking_sku = _sku("fast", supports_thinking=False)

    assert resolve_effective_thinking_level("deep", None) == "deep"
    assert should_force_reasoning_model(None, "deep") is True
    assert resolve_effective_thinking_level("deep", thinking_sku) == "deep"
    assert should_force_reasoning_model(thinking_sku, "deep") is False
    assert resolve_effective_thinking_level("deep", non_thinking_sku) == "balanced"
    assert resolve_effective_thinking_level("balanced", non_thinking_sku) == "balanced"
    assert resolve_effective_thinking_level("fast", non_thinking_sku) == "fast"


@pytest.mark.asyncio
async def test_get_token_iter_only_forces_r1_without_selected_sku(monkeypatch):
    calls: list[tuple[str, str]] = []

    async def fake_direct(provider, model_id, _messages, *, stream):
        calls.append((provider, model_id))

        async def gen():
            yield "ok"

        return gen()

    async def fake_lightweight(_messages, *, stream):
        calls.append(("lightweight", "chat_response"))

        async def gen():
            yield "ok"

        return gen()

    monkeypatch.setattr("app.services.ai_chat.agent_loop.call_llm_direct", fake_direct)
    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.call_lightweight_chat_response",
        fake_lightweight,
    )

    tokens = [token async for token in await _get_token_iter(None, [], "deep")]
    assert tokens == ["ok"]
    assert calls[-1] == ("deepseek", "deepseek-reasoner")

    selected = _sku("manual", supports_thinking=False)
    tokens = [token async for token in await _get_token_iter(selected, [], "balanced")]
    assert tokens == ["ok"]
    assert calls[-1] == ("test-provider", "model-manual")

    tokens = [token async for token in await _get_token_iter(None, [], "fast")]
    assert tokens == ["ok"]
    assert calls[-1] == ("lightweight", "chat_response")


@pytest.mark.asyncio
async def test_stream_tokens_yields_reasoning_but_keeps_result_content_clean():
    async def fake_stream():
        yield SimpleNamespace(
            id="req-1",
            model="fake-model",
            choices=[SimpleNamespace(delta=SimpleNamespace(reasoning_content="hidden"))],
        )
        yield SimpleNamespace(
            id="req-1",
            model="fake-model",
            choices=[SimpleNamespace(delta=SimpleNamespace(content="<answer>visible</answer>"))],
        )

    class FakeCompletions:
        async def create(self, **_kwargs):
            return fake_stream()

    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
    result = LLMStreamResult()

    tokens = [
        token
        async for token in stream_tokens(
            fake_client,
            "fake-model",
            [{"role": "user", "content": "hi"}],
            result,
        )
    ]

    assert tokens == ["<think>", "hidden", "</think>", "<answer>visible</answer>"]
    assert result.content == "<answer>visible</answer>"


def test_reasoning_stream_sanitizer_strips_split_think_tags():
    sanitizer = ReasoningStreamSanitizer()
    chunks = ["<thi", "nk>hidden", "</th", "ink>visible"]

    cleaned = "".join(sanitizer.feed(chunk) for chunk in chunks) + sanitizer.flush()

    assert cleaned == "visible"


def test_sanitize_legacy_chat_text_removes_inline_think_blocks():
    raw = "<think>hidden</think>你好，解释一下费曼学习法"

    assert _sanitize_legacy_chat_text(raw) == "你好，解释一下费曼学习法"


def test_extract_current_workflow_rename_name():
    assert _maybe_extract_current_workflow_rename(
        "把当前工作流重命名为「Docker 入门」"
    ) == "Docker 入门"
    assert _maybe_extract_current_workflow_rename(
        "rename current workflow to \"Docker Basics\""
    ) == "Docker Basics"
    assert _maybe_extract_current_workflow_rename("帮我列出工作流") is None


@pytest.mark.asyncio
async def test_direct_shortcut_handles_current_workflow_rename(monkeypatch):
    async def fake_handler(_ctx, params):
        return SimpleNamespace(
            ok=True,
            data={"id": params["id"], "new_name": params["new_name"]},
            error=None,
            ui_effect=None,
            canvas_mutation=None,
        )

    monkeypatch.setattr(
        "app.services.ai_chat.agent_loop.get_tool",
        lambda name: SimpleNamespace(handler=fake_handler) if name == "rename_workflow" else None,
    )

    events = await _maybe_run_direct_shortcut(
        AIChatRequest(
            user_input="把当前工作流重命名为「Docker 入门」",
            mode="chat",
            canvas_context=CanvasContextSchema(workflow_id="wf-1", workflow_name="旧名字"),
        ),
        ToolContext(user={"id": "user-1"}, db=object(), service_db=object(), workflow_id="wf-1"),
    )

    assert events is not None
    payloads = [json.loads(item["data"]) for item in events]
    assert any(
        item.get("event") == "tool_call" and item.get("tool") == "rename_workflow"
        for item in payloads
    )
    assert any(
        item.get("event") == "tool_result"
        and item.get("ok") is True
        and item.get("data", {}).get("new_name") == "Docker 入门"
        for item in payloads
    )
