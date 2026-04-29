"""LLM provider configuration, client factory, and usage recording helpers."""

import logging
from typing import Any

from openai import AsyncOpenAI

from app.core.config_loader import get_config
from app.models.ai_catalog import CatalogSku
from app.services.ai_catalog_service import normalize_provider_key
from app.services.usage_ledger import UsageNumbers, UsagePricing, record_usage_event, utcnow  # noqa: F401 — utcnow re-exported for test monkeypatching

logger = logging.getLogger(__name__)


class AIRouterError(Exception):
    """Raised when all route options are exhausted."""


def get_provider_config(provider_name: str) -> dict[str, Any]:
    normalized = normalize_provider_key(provider_name)
    config = get_config().get("providers", {})
    provider = config.get(normalized)
    if not provider:
        raise AIRouterError(f"Unknown provider: {provider_name}")
    return provider


def get_client(provider_name: str) -> AsyncOpenAI:
    provider = get_provider_config(provider_name)
    return AsyncOpenAI(
        base_url=provider["base_url"],
        api_key=provider["api_key"],
        timeout=float(get_config().get("engine", {}).get("timeout_ms", 30000)) / 1000,
    )


def is_provider_configured(provider_name: str) -> bool:
    provider = get_provider_config(provider_name)
    base_url = str(provider.get("base_url", "")).strip()
    api_key = str(provider.get("api_key", "")).strip()
    return bool(base_url and api_key and not base_url.startswith("$") and not api_key.startswith("$"))


def pricing_from_sku(sku: CatalogSku | None) -> UsagePricing:
    if sku is None:
        return UsagePricing()
    return UsagePricing(
        input_price_cny_per_million=sku.input_price_cny_per_million,
        output_price_cny_per_million=sku.output_price_cny_per_million,
    )


async def record_error_attempt(
    *,
    attempt_index: int,
    is_fallback: bool,
    started_at,
    finished_at,
    sku: CatalogSku | None,
    provider_name: str,
    model_name: str,
) -> None:
    await record_usage_event(
        provider=provider_name,
        model=model_name,
        status="error",
        usage=UsageNumbers(),
        pricing=pricing_from_sku(sku),
        attempt_index=attempt_index,
        is_fallback=is_fallback,
        started_at=started_at,
        finished_at=finished_at,
        sku_id=sku.sku_id if sku else None,
        family_id=sku.family_id if sku else None,
        vendor=sku.vendor if sku else None,
        billing_channel=sku.billing_channel if sku else None,
    )
