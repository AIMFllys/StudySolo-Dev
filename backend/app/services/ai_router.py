"""AI model router — zero hardcoding, all config from config.yaml.

Routes node types to the correct platform/model and handles fallback chains.
Uses the openai Python SDK with base_url + api_key to call any OpenAI-compatible API.
"""

import asyncio
import logging
from typing import AsyncIterator

from openai import AsyncOpenAI, APITimeoutError, APIError

from app.core.config_loader import get_config

logger = logging.getLogger(__name__)


class AIRouterError(Exception):
    """Raised when all fallback options are exhausted."""


def _get_client(platform_name: str) -> tuple[AsyncOpenAI, str]:
    """Return (AsyncOpenAI client, default_model) for a platform."""
    cfg = get_config()
    platform = cfg["platforms"][platform_name]
    client = AsyncOpenAI(
        base_url=platform["base_url"],
        api_key=platform["api_key"],
        timeout=cfg["fallback"]["timeout_ms"] / 1000,
    )
    default_model = platform["models"][0]["name"]
    return client, default_model


def get_route(node_type: str) -> dict:
    """Return the routing config for a node type from config.yaml."""
    cfg = get_config()
    routes = cfg.get("node_routes", {})
    if node_type not in routes:
        raise AIRouterError(f"Unknown node type: {node_type}")
    return routes[node_type]


def get_fallback_chain(route_chain: str) -> list[dict]:
    """Return the ordered fallback list for a chain (A or B)."""
    cfg = get_config()
    return cfg["fallback"]["chains"].get(route_chain, [])


def is_proxy_aggregator(platform_name: str) -> bool:
    """Return True if the platform is a proxy aggregator (forbidden for chain A)."""
    cfg = get_config()
    return platform_name in cfg["fallback"].get("proxy_aggregator_platforms", [])


async def call_llm(
    node_type: str,
    messages: list[dict],
    stream: bool = False,
) -> str | AsyncIterator[str]:
    """Route a node_type call through the fallback chain.

    Returns the full response string (stream=False) or an async token iterator (stream=True).
    Raises AIRouterError if all fallback options fail.
    """
    route = get_route(node_type)
    chain_id = route["route_chain"]
    fallback_chain = get_fallback_chain(chain_id)

    last_error: Exception | None = None

    for step in fallback_chain:
        platform_name = step["platform"]
        model_name = step["model"]

        # Chain A: skip proxy aggregator platforms
        if chain_id == "A" and is_proxy_aggregator(platform_name):
            logger.warning("Skipping proxy aggregator platform '%s' for chain A", platform_name)
            continue

        try:
            client, _ = _get_client(platform_name)

            if stream:
                return _stream_tokens(client, model_name, messages)

            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                stream=False,
            )
            return response.choices[0].message.content or ""

        except (APITimeoutError, APIError) as e:
            logger.warning(
                "Platform '%s' model '%s' failed: %s — trying next fallback",
                platform_name, model_name, e,
            )
            last_error = e
            continue

    raise AIRouterError(
        f"All fallback options for chain '{chain_id}' exhausted. Last error: {last_error}"
    )


async def _stream_tokens(
    client: AsyncOpenAI,
    model: str,
    messages: list[dict],
) -> AsyncIterator[str]:
    """Yield tokens from a streaming chat completion."""
    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta
