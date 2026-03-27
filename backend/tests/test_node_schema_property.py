"""
Property 19: 节点类型 Schema 与 Prompt 完整性
Feature: studysolo-mvp, Property 19: 节点类型 Schema 与 Prompt 完整性

For all LLM node types, a non-empty System Prompt must exist (loaded from prompt.md).
Unified prompt assembly is validated via BaseNode.get_system_prompt_for_type().

Validates: Requirements 7.1, 7.2
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.models.ai import (
    NodeType,
    LLM_NODE_TYPES,
    NON_LLM_NODE_TYPES,
    WorkflowNodeSchema,
    NodePosition,
    NodeData,
)
from app.nodes._base import BaseNode

ALL_NODE_TYPES = list(NodeType)


def test_llm_and_non_llm_cover_all_types():
    """LLM + non-LLM node types must cover all types without overlap."""
    all_types = set(NodeType)
    union = LLM_NODE_TYPES | NON_LLM_NODE_TYPES
    assert union == all_types, f"Missing types: {all_types - union}"
    assert LLM_NODE_TYPES.isdisjoint(NON_LLM_NODE_TYPES), "Overlap between LLM and non-LLM types"


@given(st.sampled_from(list(LLM_NODE_TYPES)))
@settings(max_examples=100)
def test_llm_nodes_have_non_empty_system_prompt(node_type: NodeType):
    """Every LLM node type must have a non-empty unified system prompt."""
    prompt = BaseNode.get_system_prompt_for_type(node_type.value)
    assert isinstance(prompt, str) and len(prompt.strip()) > 0, (
        f"System prompt for {node_type} is empty"
    )


def test_unified_prompt_contains_identity():
    """Unified prompt must include identity segment for LLM nodes."""
    prompt = BaseNode.get_system_prompt_for_type("ai_analyzer")
    assert "StudySolo" in prompt, "Identity segment missing from unified prompt"
    assert "安全规则" in prompt, "Safety rules missing from unified prompt"


@given(st.sampled_from(ALL_NODE_TYPES))
@settings(max_examples=100)
def test_node_schema_validates_valid_node(node_type: NodeType):
    """WorkflowNodeSchema must accept a valid node for every node type."""
    node = WorkflowNodeSchema(
        id="test-node-id",
        type=node_type.value,
        position=NodePosition(x=100.0, y=200.0),
        data=NodeData(
            label=f"Test {node_type.value}",
            system_prompt=BaseNode.get_system_prompt_for_type(node_type.value),
            model_route="dashscope/qwen3-turbo",
            status="pending",
            output="",
        ),
    )
    assert node.type == node_type.value
    assert node.data.status == "pending"


def test_non_llm_nodes_may_lack_system_prompt():
    """Non-LLM nodes may or may not have prompts."""
    for node_type in NON_LLM_NODE_TYPES:
        prompt = BaseNode.get_system_prompt_for_type(node_type.value)
        # May be empty or non-empty — no strict requirement
        assert isinstance(prompt, str)
