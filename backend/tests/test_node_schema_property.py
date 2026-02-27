"""
Property 19: 节点类型 Schema 与 Prompt 完整性
Feature: studysolo-mvp, Property 19: 节点类型 Schema 与 Prompt 完整性

For all 9 MVP node types, valid JSON Schema must exist.
For all LLM node types, a non-empty System Prompt template must exist.

Validates: Requirements 7.1, 7.2
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.models.ai import (
    NodeType,
    LLM_NODE_TYPES,
    NON_LLM_NODE_TYPES,
    SYSTEM_PROMPTS,
    WorkflowNodeSchema,
    NodePosition,
    NodeData,
)

ALL_NODE_TYPES = list(NodeType)
MVP_NODE_COUNT = 9


def test_all_9_node_types_defined():
    """Exactly 9 MVP node types must be defined."""
    assert len(ALL_NODE_TYPES) == MVP_NODE_COUNT, (
        f"Expected {MVP_NODE_COUNT} node types, got {len(ALL_NODE_TYPES)}"
    )


def test_llm_and_non_llm_cover_all_types():
    """LLM + non-LLM node types must cover all 9 types without overlap."""
    all_types = set(NodeType)
    union = LLM_NODE_TYPES | NON_LLM_NODE_TYPES
    assert union == all_types, f"Missing types: {all_types - union}"
    assert LLM_NODE_TYPES.isdisjoint(NON_LLM_NODE_TYPES), "Overlap between LLM and non-LLM types"


@given(st.sampled_from(list(LLM_NODE_TYPES)))
@settings(max_examples=100)
def test_llm_nodes_have_non_empty_system_prompt(node_type: NodeType):
    """Every LLM node type must have a non-empty system prompt."""
    assert node_type in SYSTEM_PROMPTS, f"Missing system prompt for LLM node type: {node_type}"
    prompt = SYSTEM_PROMPTS[node_type]
    assert isinstance(prompt, str) and len(prompt.strip()) > 0, (
        f"System prompt for {node_type} is empty"
    )


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
            system_prompt=SYSTEM_PROMPTS.get(node_type, ""),
            model_route="dashscope/qwen3-turbo",
            status="pending",
            output="",
        ),
    )
    assert node.type == node_type.value
    assert node.data.status == "pending"


def test_non_llm_nodes_may_lack_system_prompt():
    """Non-LLM nodes (trigger_input, write_db) don't require system prompts."""
    for node_type in NON_LLM_NODE_TYPES:
        # They may or may not have prompts — no assertion required
        # But if present, must be a string
        if node_type in SYSTEM_PROMPTS:
            assert isinstance(SYSTEM_PROMPTS[node_type], str)
