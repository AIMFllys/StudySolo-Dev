"""Tests for BaseNode.build_user_message — upstream fallback_instruction injection.

The web_search node's degraded output must travel via NodeInput.upstream_metadata
into the user message that the downstream LLM node sends to the model.
"""

from __future__ import annotations

from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput


class _ConcreteNode(BaseNode):
    """Minimal concrete subclass for exercising build_user_message.

    `_abstract = True` prevents this test-only class from leaking into the
    global node registry so that the manifest contract tests stay stable
    regardless of test collection order.
    """
    _abstract = True
    node_type = ""
    category = "generation"
    display_name = "test"
    description = "test-only"

    async def execute(
        self,
        node_input: NodeInput,
        llm_caller: Any,
    ) -> AsyncIterator[str]:
        yield ""


def test_no_upstream_metadata_falls_through() -> None:
    node = _ConcreteNode()
    ni = NodeInput(
        user_content="write a summary",
        upstream_outputs={"u1": "content from upstream"},
    )
    msg = node.build_user_message(ni)
    assert "前序节点输出" in msg
    assert "content from upstream" in msg
    assert "基于 AI 自身知识" not in msg


def test_non_degraded_metadata_falls_through() -> None:
    node = _ConcreteNode()
    ni = NodeInput(
        user_content="task",
        upstream_outputs={"u1": "ok"},
        upstream_metadata={"u1": {"degraded": False, "fallback_instruction": "ignore"}},
    )
    msg = node.build_user_message(ni)
    assert "ignore" not in msg


def test_degraded_upstream_injects_fallback_instruction() -> None:
    node = _ConcreteNode()
    ni = NodeInput(
        user_content="生成闪卡",
        upstream_outputs={"web": "## ⚠️ 联网搜索不可用..."},
        upstream_metadata={"web": {
            "degraded": True,
            "degradation_reason": "both engines down",
            "fallback_instruction": "TEST_FALLBACK_INSTRUCTION_MARKER",
            "original_query": "量子计算最新进展",
        }},
    )
    msg = node.build_user_message(ni)

    # The injected instruction must appear before upstream outputs,
    # so that downstream LLM reads the directive first.
    idx_instruction = msg.find("TEST_FALLBACK_INSTRUCTION_MARKER")
    idx_upstream = msg.find("前序节点输出")
    assert idx_instruction >= 0
    assert idx_upstream > idx_instruction
    # Header pieces should be present:
    assert "[web]" in msg
    assert "both engines down" in msg
    assert "量子计算最新进展" in msg


def test_degraded_without_instruction_string_is_ignored() -> None:
    """A degraded entry with empty fallback_instruction is skipped gracefully."""
    node = _ConcreteNode()
    ni = NodeInput(
        user_content="task",
        upstream_outputs={"u1": "ok"},
        upstream_metadata={"u1": {"degraded": True, "fallback_instruction": ""}},
    )
    msg = node.build_user_message(ni)
    # No empty header block leaks into the message
    assert "上游节点" not in msg
    assert "前序节点输出" in msg


def test_multiple_degraded_upstreams_all_injected() -> None:
    node = _ConcreteNode()
    ni = NodeInput(
        user_content="task",
        upstream_metadata={
            "web-1": {
                "degraded": True,
                "fallback_instruction": "FIRST_MARK",
                "degradation_reason": "r1",
            },
            "web-2": {
                "degraded": True,
                "fallback_instruction": "SECOND_MARK",
                "degradation_reason": "r2",
            },
        },
    )
    msg = node.build_user_message(ni)
    assert "FIRST_MARK" in msg
    assert "SECOND_MARK" in msg
