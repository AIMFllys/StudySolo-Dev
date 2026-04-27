"""Property tests for ai_catalog_service — tier ranking and provider normalization."""

from app.services.ai_catalog_service import _tier_rank, is_tier_allowed, normalize_provider_key
from unittest.mock import patch


class TestTierRank:
    def test_order(self):
        assert _tier_rank("free") < _tier_rank("pro") < _tier_rank("pro_plus") < _tier_rank("ultra")

    def test_none_defaults_to_free(self):
        assert _tier_rank(None) == _tier_rank("free")

    def test_unknown_defaults_to_free(self):
        assert _tier_rank("nonexistent") == 0


class TestIsTierAllowed:
    def test_same_tier(self):
        assert is_tier_allowed("pro", "pro") is True

    def test_higher_tier(self):
        assert is_tier_allowed("ultra", "free") is True

    def test_lower_tier(self):
        assert is_tier_allowed("free", "pro") is False

    def test_none_user_tier(self):
        assert is_tier_allowed(None, "free") is True

    def test_none_required_tier(self):
        assert is_tier_allowed("free", None) is True

    def test_both_none(self):
        assert is_tier_allowed(None, None) is True


class TestNormalizeProviderKey:
    @patch("app.services.ai_catalog_service.get_config", return_value={
        "compatibility": {"provider_aliases": {"gpt": "openai"}}
    })
    def test_alias(self, _):
        assert normalize_provider_key("gpt") == "openai"

    @patch("app.services.ai_catalog_service.get_config", return_value={
        "compatibility": {"provider_aliases": {}}
    })
    def test_no_alias(self, _):
        assert normalize_provider_key("openai") == "openai"

    @patch("app.services.ai_catalog_service.get_config", return_value={})
    def test_empty_config(self, _):
        assert normalize_provider_key("test") == "test"

    def test_none_input(self):
        assert normalize_provider_key(None) == ""

    def test_empty_input(self):
        assert normalize_provider_key("") == ""

    def test_whitespace_stripped(self):
        assert normalize_provider_key("  ") == ""
