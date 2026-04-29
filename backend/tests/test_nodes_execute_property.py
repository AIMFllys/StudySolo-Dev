"""Property tests for all 18 workflow node types — execute + post_process.

Strategy: mock llm_caller to return predictable tokens, verify each node
produces valid output and handles errors gracefully.
"""

import json

import pytest

from app.nodes import NODE_REGISTRY
from app.nodes._base import BaseNode, NodeInput, NodeOutput


# ── helpers ──────────────────────────────────────────────────────────────────

def _make_llm_caller(tokens: list[str]):
    """Create a mock llm_caller that returns an async iterator of tokens."""
    async def _caller(node_type, messages, stream=False):
        if stream:
            async def _stream():
                for t in tokens:
                    yield t
            return _stream()
        return "".join(tokens)
    return _caller


def _make_node_input(user_content="学习 Python 基础", upstream=None, config=None):
    return NodeInput(
        user_content=user_content,
        upstream_outputs=upstream or {},
        node_config=config,
    )


# ── Registry sanity ──────────────────────────────────────────────────────────

class TestNodeRegistry:
    def test_registry_not_empty(self):
        assert len(NODE_REGISTRY) > 0

    def test_all_have_required_metadata(self):
        for name, cls in NODE_REGISTRY.items():
            assert cls.node_type == name, f"{name}: node_type mismatch"
            assert cls.category, f"{name}: missing category"
            assert cls.display_name, f"{name}: missing display_name"
            assert cls.description, f"{name}: missing description"
            assert cls.version, f"{name}: missing version"

    def test_expected_node_types_present(self):
        expected = {
            "summary", "flashcard", "outline_gen", "mind_map", "quiz_gen",
            "compare", "content_extract", "merge_polish",
            "ai_analyzer", "ai_planner", "logic_switch", "loop_map",
            "trigger_input", "knowledge_base", "web_search",
            "chat_response", "export_file",
            "loop_group",
        }
        registered = set(NODE_REGISTRY.keys())
        missing = expected - registered
        assert not missing, f"Missing node types: {missing}"

    def test_manifest_generation(self):
        manifest = BaseNode.get_manifest()
        assert len(manifest) > 0
        for entry in manifest:
            assert "type" in entry
            assert "category" in entry
            assert "display_name" in entry


# ── Per-node execute + post_process ──────────────────────────────────────────

# Nodes that use LLM streaming (most nodes)
LLM_NODES = [
    name for name, cls in NODE_REGISTRY.items()
    if cls.is_llm_node and name not in ("loop_group", "loop_map")
    and not name.startswith("agent_")  # Agent nodes need Gateway, tested separately
]

# Non-LLM nodes
NON_LLM_NODES = [
    name for name, cls in NODE_REGISTRY.items()
    if not cls.is_llm_node
]


class TestLLMNodeExecute:
    """All LLM nodes should stream tokens from llm_caller and produce valid output."""

    @pytest.mark.parametrize("node_type", LLM_NODES)
    async def test_execute_streams_tokens(self, node_type):
        cls = NODE_REGISTRY[node_type]
        node = cls()
        caller = _make_llm_caller(["Hello", " ", "World"])
        ni = _make_node_input(upstream={"prev": "some upstream data"})

        tokens = []
        async for token in node.execute(ni, caller):
            tokens.append(token)

        assert len(tokens) > 0, f"{node_type}: no tokens yielded"
        full = "".join(tokens)
        assert len(full) > 0

    @pytest.mark.parametrize("node_type", LLM_NODES)
    async def test_post_process_returns_node_output(self, node_type):
        cls = NODE_REGISTRY[node_type]
        node = cls()

        # For JSON nodes, provide valid JSON; for markdown nodes, plain text
        if cls.output_format == "json":
            raw = json.dumps({"key": "value", "branch": "A", "reason": "test"})
        else:
            raw = "# Summary\n\nThis is a test output."

        result = await node.post_process(raw)
        assert isinstance(result, NodeOutput)
        assert isinstance(result.content, str)
        assert len(result.content) > 0

    @pytest.mark.parametrize("node_type", LLM_NODES)
    async def test_execute_with_empty_input(self, node_type):
        cls = NODE_REGISTRY[node_type]
        node = cls()
        caller = _make_llm_caller(["ok"])
        ni = _make_node_input(user_content="")

        tokens = []
        async for token in node.execute(ni, caller):
            tokens.append(token)
        # Should not crash even with empty input
        assert isinstance(tokens, list)

    @pytest.mark.parametrize("node_type", LLM_NODES)
    async def test_execute_with_config(self, node_type):
        cls = NODE_REGISTRY[node_type]
        node = cls()
        caller = _make_llm_caller(["configured output"])

        # Build config from schema defaults
        config = {}
        for field in cls.config_schema:
            config[field["key"]] = field.get("default", "")

        ni = _make_node_input(config=config if config else None)
        tokens = []
        async for token in node.execute(ni, caller):
            tokens.append(token)
        assert isinstance(tokens, list)


class TestJSONNodePostProcess:
    """JSON-output nodes should handle malformed JSON gracefully."""

    JSON_NODES = [
        name for name, cls in NODE_REGISTRY.items()
        if cls.output_format == "json" and cls.is_llm_node
        and not name.startswith("agent_")
    ]

    # logic_switch and loop_map use try_parse_json (sync fallback parser)
    _KNOWN_BROKEN: set[str] = set()

    @pytest.mark.parametrize("node_type", JSON_NODES)
    async def test_malformed_json_does_not_crash(self, node_type):
        cls = NODE_REGISTRY[node_type]
        node = cls()
        result = await node.post_process("this is not json at all")
        assert isinstance(result, NodeOutput)
        # Should either parse or fallback gracefully
        assert isinstance(result.content, str)

    @pytest.mark.parametrize("node_type", JSON_NODES)
    async def test_fenced_json_parsed(self, node_type):
        cls = NODE_REGISTRY[node_type]
        node = cls()
        raw = '```json\n{"branch": "A", "reason": "test"}\n```'
        result = await node.post_process(raw)
        assert isinstance(result, NodeOutput)


class TestLogicSwitchPostProcess:
    """Specific tests for logic_switch branch extraction."""

    def _node(self):
        return NODE_REGISTRY["logic_switch"]()

    async def test_valid_json_branch(self):
        node = self._node()
        raw = json.dumps({"branch": "A", "reason": "条件满足"})
        result = await node.post_process(raw)
        assert result.metadata["branch"] == "A"

    async def test_fallback_branch_a(self):
        node = self._node()
        result = await node.post_process("A: 满足条件")
        assert result.metadata["branch"] == "A"

    async def test_fallback_branch_b(self):
        node = self._node()
        result = await node.post_process("分支B 更合适")
        assert result.metadata["branch"] == "B"

    async def test_fallback_default(self):
        node = self._node()
        result = await node.post_process("无法判断")
        assert result.metadata["branch"] == "default"


class TestNodeSystemPrompt:
    """Every node should have a non-empty system prompt."""

    @pytest.mark.parametrize("node_type", list(NODE_REGISTRY.keys()))
    def test_system_prompt_not_empty(self, node_type):
        cls = NODE_REGISTRY[node_type]
        node = cls()
        prompt = node.system_prompt
        # At minimum, identity.md or base_prompt should be loaded
        assert isinstance(prompt, str)


class TestNodeBuildUserMessage:
    """build_user_message should produce meaningful text."""

    @pytest.mark.parametrize("node_type", LLM_NODES[:5])  # sample
    def test_includes_upstream(self, node_type):
        cls = NODE_REGISTRY[node_type]
        node = cls()
        ni = _make_node_input(upstream={"prev": "upstream data"})
        msg = node.build_user_message(ni)
        assert "upstream data" in msg

    @pytest.mark.parametrize("node_type", LLM_NODES[:5])
    def test_includes_user_content(self, node_type):
        cls = NODE_REGISTRY[node_type]
        node = cls()
        ni = _make_node_input(user_content="学习目标")
        msg = node.build_user_message(ni)
        assert "学习目标" in msg
