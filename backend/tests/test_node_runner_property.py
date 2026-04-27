"""Property tests for app.engine.node_runner — input building, config merging, execution."""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.engine.node_runner import (
    NodeExecutionResult,
    build_input_snapshot,
    build_node_llm_caller,
    build_parallel_group_id,
    build_runtime_config,
    execute_single_node,
    execute_single_node_with_timeout,
    get_node_progress_message,
    resolve_user_content,
)
from app.nodes._base import NodeInput, NodeOutput


# ── build_parallel_group_id ──────────────────────────────────────────────────

class TestBuildParallelGroupId:
    def test_sorted_and_joined(self):
        assert build_parallel_group_id(["c", "a", "b"]) == "a|b|c"

    def test_single(self):
        assert build_parallel_group_id(["x"]) == "x"

    def test_empty(self):
        assert build_parallel_group_id([]) == ""

    def test_stable(self):
        assert build_parallel_group_id(["b", "a"]) == build_parallel_group_id(["a", "b"])


# ── get_node_progress_message ────────────────────────────────────────────────

class TestGetNodeProgressMessage:
    def test_known_types(self):
        assert "知识库" in get_node_progress_message("knowledge_base")
        assert "搜索" in get_node_progress_message("web_search")

    def test_unknown_type_fallback(self):
        msg = get_node_progress_message("nonexistent_type")
        assert isinstance(msg, str) and len(msg) > 0


# ── resolve_user_content ─────────────────────────────────────────────────────

class TestResolveUserContent:
    def test_direct_user_content(self):
        assert resolve_user_content({"user_content": "hello"}) == "hello"

    def test_fallback_to_input_template(self):
        data = {"config": {"input_template": "template text"}}
        assert resolve_user_content(data) == "template text"

    def test_user_content_overrides_template(self):
        data = {"user_content": "user", "config": {"input_template": "tmpl"}}
        assert resolve_user_content(data) == "user"

    def test_fallback_to_label(self):
        data = {"label": "My Node"}
        assert resolve_user_content(data) == "My Node"

    def test_empty_returns_empty(self):
        assert resolve_user_content({}) == ""

    def test_whitespace_template_ignored(self):
        data = {"config": {"input_template": "   "}, "label": "fallback"}
        assert resolve_user_content(data) == "fallback"


# ── build_runtime_config ─────────────────────────────────────────────────────

class TestBuildRuntimeConfig:
    def test_empty_data(self):
        assert build_runtime_config({}) is None

    def test_config_passthrough(self):
        data = {"config": {"key": "val"}}
        assert build_runtime_config(data) == {"key": "val"}

    def test_root_fields_merged(self):
        data = {"config": {"a": 1}, "model_route": "sku-123", "output_format": "json"}
        result = build_runtime_config(data)
        assert result["a"] == 1
        assert result["model_route"] == "sku-123"
        assert result["output_format"] == "json"

    def test_none_values_excluded(self):
        data = {"config": {"a": 1}, "model_route": None}
        result = build_runtime_config(data)
        assert "model_route" not in result

    def test_empty_string_excluded(self):
        data = {"config": {"a": 1}, "model_route": ""}
        result = build_runtime_config(data)
        assert "model_route" not in result

    def test_no_config_but_root_fields(self):
        data = {"model_route": "sku-1"}
        result = build_runtime_config(data)
        assert result == {"model_route": "sku-1"}


# ── build_input_snapshot ─────────────────────────────────────────────────────

class TestBuildInputSnapshot:
    def test_serializes_to_json(self):
        ni = NodeInput(user_content="hi", upstream_outputs={"a": "out"}, node_config={"k": "v"})
        raw = build_input_snapshot(ni)
        parsed = json.loads(raw)
        assert parsed["user_content"] == "hi"
        assert parsed["upstream_outputs"] == {"a": "out"}
        assert parsed["node_config"] == {"k": "v"}

    def test_chinese_not_escaped(self):
        ni = NodeInput(user_content="你好")
        raw = build_input_snapshot(ni)
        assert "你好" in raw


# ── NodeExecutionResult ──────────────────────────────────────────────────────

class TestNodeExecutionResult:
    def test_defaults(self):
        r = NodeExecutionResult(node_id="n1")
        assert r.output is None
        assert r.error is None
        assert r.metadata == {}

    def test_mutable(self):
        r = NodeExecutionResult(node_id="n1")
        r.output = "done"
        r.error = "fail"
        r.metadata["key"] = "val"
        assert r.output == "done"


# ── build_node_llm_caller ───────────────────────────────────────────────────

class TestBuildNodeLlmCaller:
    @pytest.mark.asyncio
    async def test_no_model_route_uses_call_llm(self):
        with patch("app.engine.node_runner.call_llm", new_callable=AsyncMock, return_value="resp") as mock_llm:
            caller = build_node_llm_caller(None)
            result = await caller("summary", [{"role": "user", "content": "hi"}])
            mock_llm.assert_awaited_once()
            assert result == "resp"

    @pytest.mark.asyncio
    async def test_model_route_uses_direct(self):
        fake_sku = MagicMock()
        fake_sku.provider = "openai"
        fake_sku.model_id = "gpt-4"
        with (
            patch("app.engine.node_runner.get_sku_by_id", new_callable=AsyncMock, return_value=fake_sku),
            patch("app.engine.node_runner.call_llm_direct", new_callable=AsyncMock, return_value="direct") as mock_direct,
        ):
            caller = build_node_llm_caller({"model_route": "sku-123"})
            result = await caller("summary", [])
            mock_direct.assert_awaited_once_with("openai", "gpt-4", [], stream=False)
            assert result == "direct"

    @pytest.mark.asyncio
    async def test_model_route_sku_not_found_fallback(self):
        with (
            patch("app.engine.node_runner.get_sku_by_id", new_callable=AsyncMock, return_value=None),
            patch("app.engine.node_runner.call_llm", new_callable=AsyncMock, return_value="fallback") as mock_llm,
        ):
            caller = build_node_llm_caller({"model_route": "bad-sku"})
            result = await caller("summary", [])
            mock_llm.assert_awaited_once()
            assert result == "fallback"


# ── execute_single_node ──────────────────────────────────────────────────────

class TestExecuteSingleNode:
    def _noop_bind(self, **kw):
        from contextlib import contextmanager

        @contextmanager
        def _cm(**kw):
            yield
        return _cm

    @pytest.mark.asyncio
    async def test_success(self):
        async def _fake_execute(node_input, llm_caller):
            yield "hello "
            yield "world"

        fake_node = MagicMock()
        fake_node.return_value.execute = _fake_execute
        fake_node.return_value.post_process = AsyncMock(
            return_value=NodeOutput(content="hello world")
        )

        from contextlib import contextmanager

        @contextmanager
        def _noop_bind(**kw):
            yield

        with (
            patch("app.engine.node_runner.NODE_REGISTRY", {"summary": fake_node}),
            patch("app.engine.node_runner.bind_usage_call", _noop_bind),
        ):
            nid, output, error = await execute_single_node(
                "n1", {"type": "summary", "data": {"user_content": "test"}}, {}, None,
            )
            assert nid == "n1"
            assert output == "hello world"
            assert error is None

    @pytest.mark.asyncio
    async def test_unknown_type_fallback_to_chat_response(self):
        async def _fake_execute(node_input, llm_caller):
            yield "ok"

        fake_node = MagicMock()
        fake_node.return_value.execute = _fake_execute
        fake_node.return_value.post_process = AsyncMock(
            return_value=NodeOutput(content="ok")
        )

        from contextlib import contextmanager

        @contextmanager
        def _noop_bind(**kw):
            yield

        with (
            patch("app.engine.node_runner.NODE_REGISTRY", {"chat_response": fake_node}),
            patch("app.engine.node_runner.bind_usage_call", _noop_bind),
        ):
            nid, output, error = await execute_single_node(
                "n1", {"type": "nonexistent", "data": {}}, {}, None,
            )
            assert output == "ok"

    @pytest.mark.asyncio
    async def test_completely_unknown_type_returns_error(self):
        with patch("app.engine.node_runner.NODE_REGISTRY", {}):
            nid, output, error = await execute_single_node(
                "n1", {"type": "bad", "data": {}}, {}, None,
            )
            assert error is not None
            assert "Unknown" in error

    @pytest.mark.asyncio
    async def test_execution_exception_returns_error(self):
        async def _fail(node_input, llm_caller):
            if False:
                yield  # makes this an async generator
            raise RuntimeError("boom")

        fake_node = MagicMock()
        fake_node.return_value.execute = _fail
        fake_node.return_value.post_process = AsyncMock(return_value=NodeOutput(content=""))

        from contextlib import contextmanager

        @contextmanager
        def _noop_bind(**kw):
            yield

        with (
            patch("app.engine.node_runner.NODE_REGISTRY", {"summary": fake_node}),
            patch("app.engine.node_runner.bind_usage_call", _noop_bind),
        ):
            nid, output, error = await execute_single_node(
                "n1", {"type": "summary", "data": {}}, {}, None,
            )
            assert error is not None
            assert "boom" in error


# ── execute_single_node_with_timeout ─────────────────────────────────────────

class TestExecuteSingleNodeWithTimeout:
    @pytest.mark.asyncio
    async def test_timeout_returns_error(self):
        async def _slow(node_input, llm_caller):
            await asyncio.sleep(100)
            yield "never"

        fake_node = MagicMock()
        fake_node.return_value.execute = _slow
        fake_node.return_value.post_process = AsyncMock(return_value=NodeOutput(content=""))

        from contextlib import contextmanager

        @contextmanager
        def _noop_bind(**kw):
            yield

        with (
            patch("app.engine.node_runner.NODE_REGISTRY", {"summary": fake_node}),
            patch("app.engine.node_runner.bind_usage_call", _noop_bind),
        ):
            nid, output, error = await execute_single_node_with_timeout(
                "n1", {"type": "summary", "data": {}}, {}, None, timeout_seconds=0.05,
            )
            assert nid == "n1"
            assert error is not None
            assert "超时" in error
