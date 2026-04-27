"""Property tests for llm/provider.py — provider config and pricing helpers."""

from unittest.mock import patch, MagicMock

import pytest

from app.services.llm.provider import (
    AIRouterError,
    get_provider_config,
    is_provider_configured,
    pricing_from_sku,
)
from app.services.usage_ledger import UsagePricing


class TestGetProviderConfig:
    @patch("app.services.llm.provider.get_config", return_value={
        "providers": {"openai": {"base_url": "https://api.openai.com", "api_key": "sk-test"}}
    })
    def test_known_provider(self, _):
        cfg = get_provider_config("openai")
        assert cfg["base_url"] == "https://api.openai.com"

    @patch("app.services.llm.provider.get_config", return_value={"providers": {}})
    def test_unknown_provider_raises(self, _):
        with pytest.raises(AIRouterError, match="Unknown"):
            get_provider_config("nonexistent")


class TestIsProviderConfigured:
    @patch("app.services.llm.provider.get_provider_config", return_value={
        "base_url": "https://api.example.com", "api_key": "real-key"
    })
    def test_configured(self, _):
        assert is_provider_configured("test") is True

    @patch("app.services.llm.provider.get_provider_config", return_value={
        "base_url": "$PLACEHOLDER", "api_key": "real-key"
    })
    def test_placeholder_url(self, _):
        assert is_provider_configured("test") is False

    @patch("app.services.llm.provider.get_provider_config", return_value={
        "base_url": "https://api.example.com", "api_key": ""
    })
    def test_empty_key(self, _):
        assert is_provider_configured("test") is False

    @patch("app.services.llm.provider.get_provider_config", return_value={
        "base_url": "", "api_key": "key"
    })
    def test_empty_url(self, _):
        assert is_provider_configured("test") is False


class TestPricingFromSku:
    def test_none_sku(self):
        p = pricing_from_sku(None)
        assert isinstance(p, UsagePricing)

    def test_with_sku(self):
        sku = MagicMock()
        sku.input_price_cny_per_million = 10.0
        sku.output_price_cny_per_million = 20.0
        p = pricing_from_sku(sku)
        assert p.input_price_cny_per_million == 10.0
        assert p.output_price_cny_per_million == 20.0
