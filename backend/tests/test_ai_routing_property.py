"""
Property 10: 节点类型到模型路由正确性
Property 11: 容灾降级链执行
Feature: studysolo-mvp, Property 10 & 11

Property 10: For any valid node type, ai_router must route to the platform/model
defined in config.yaml; chain A nodes must not be routed to proxy aggregator platforms.

Property 11: When a platform call fails, the system must try the next fallback
in the chain until success or all options exhausted.

Validates: Requirements 4.3, 4.5, 4.6
"""

import pytest
from httpx import Request
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from unittest.mock import AsyncMock, patch, MagicMock
from openai import APIConnectionError

pytest.skip(
    "Stale: get_route/get_fallback_chain/is_proxy_aggregator removed in catalog-based routing refactor. "
    "Routing is now tested via resolve_task_route_skus in ai_catalog_service.",
    allow_module_level=True,
)

from app.core.config_loader import get_config
from app.services.ai_router import (
    get_route,
    get_fallback_chain,
    is_proxy_aggregator,
    AIRouterError,
    call_llm,
)

# All valid node types from config.yaml
VALID_NODE_TYPES = [
    "trigger_input", "ai_analyzer", "ai_planner", "outline_gen",
    "content_extract", "summary", "flashcard", "chat_response", "write_db",
]

_node_type_strategy = st.sampled_from(VALID_NODE_TYPES)


# ── Property 10: Routing correctness ────────────────────────────────────────

@given(_node_type_strategy)
@settings(max_examples=100)
def test_route_matches_config(node_type: str):
    """Route result must match config.yaml node_routes entry."""
    cfg = get_config()
    expected = cfg["node_routes"][node_type]
    result = get_route(node_type)

    assert result["platform"] == expected["platform"]
    assert result["default_model"] == expected["default_model"]
    assert result["route_chain"] == expected["route_chain"]


@given(_node_type_strategy)
@settings(max_examples=100)
def test_chain_a_nodes_not_routed_to_proxy_aggregators(node_type: str):
    """Chain A nodes must not use proxy aggregator platforms in their fallback chain."""
    route = get_route(node_type)
    if route["route_chain"] != "A":
        return  # Only applies to chain A

    chain = get_fallback_chain("A")
    for step in chain:
        assert not is_proxy_aggregator(step["platform"]), (
            f"Chain A fallback step uses proxy aggregator: {step['platform']}"
        )


def test_unknown_node_type_raises():
    """Unknown node types must raise AIRouterError."""
    with pytest.raises(AIRouterError, match="Unknown node type"):
        get_route("nonexistent_node_type_xyz")


# ── Property 11: Fallback chain execution ───────────────────────────────────

@given(st.sampled_from(["A", "B"]))
@settings(max_examples=50)
def test_fallback_chain_is_ordered_list(chain_id: str):
    """Fallback chain must be a non-empty ordered list of platform/model dicts."""
    chain = get_fallback_chain(chain_id)
    assert isinstance(chain, list)
    assert len(chain) > 0
    for step in chain:
        assert "platform" in step
        assert "model" in step


@given(st.sampled_from(["A", "B"]))
@settings(max_examples=50)
def test_fallback_chain_platforms_exist_in_config(chain_id: str):
    """Every platform referenced in a fallback chain must exist in platforms config."""
    cfg = get_config()
    chain = get_fallback_chain(chain_id)
    for step in chain:
        assert step["platform"] in cfg["platforms"], (
            f"Platform '{step['platform']}' in chain {chain_id} not found in platforms config"
        )


@pytest.mark.asyncio
async def test_call_llm_uses_safe_reserve_fallback_when_primary_chain_fails():
    """Chain A should continue into verified native reserves before raising AIRouterError."""
    request = Request("POST", "https://example.com/v1/chat/completions")

    failing_client = MagicMock()
    failing_client.chat.completions.create = AsyncMock(
        side_effect=APIConnectionError(request=request)
    )

    reserve_client = MagicMock()
    reserve_client.chat.completions.create = AsyncMock(
        return_value=MagicMock(
            choices=[MagicMock(message=MagicMock(content="reserve-ok"))]
        )
    )

    route = {
        "platform": "dashscope",
        "default_model": "qwen-turbo",
        "route_chain": "A",
    }
    steps = [
        {"platform": "dashscope", "model": "qwen-turbo"},
        {"platform": "deepseek", "model": "deepseek-chat"},
        {"platform": "zhipu", "model": "glm-4"},
    ]

    with (
        patch("app.services.ai_router.get_route", return_value=route),
        patch("app.services.ai_router._build_fallback_steps", return_value=steps),
        patch("app.services.ai_router._is_platform_configured", return_value=True),
        patch(
            "app.services.ai_router._get_client",
            side_effect=[
                (failing_client, "qwen-turbo"),
                (failing_client, "deepseek-chat"),
                (reserve_client, "glm-4"),
            ],
        ),
    ):
        result = await call_llm(
            "ai_analyzer",
            [{"role": "user", "content": "返回 JSON"}],
            stream=False,
        )

    assert result == "reserve-ok"
