"""Property tests for ai_chat validators and thinking helpers."""

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services.ai_chat.validators import resolve_assistant_subtype, resolve_source_subtype
from app.services.ai_chat.thinking import resolve_effective_thinking_level, should_force_reasoning_model


def _body(**kw):
    defaults = {"mode": "chat", "intent_hint": None, "selected_model_key": None,
                "selected_platform": None, "selected_model": None}
    defaults.update(kw)
    return SimpleNamespace(**defaults)


class TestResolveSourceSubtype:
    def test_plan_mode(self):
        assert resolve_source_subtype(_body(mode="plan")) == "plan"

    def test_create_mode(self):
        assert resolve_source_subtype(_body(mode="create")) == "modify"

    def test_modify_intent(self):
        assert resolve_source_subtype(_body(intent_hint="MODIFY")) == "modify"

    def test_default_chat(self):
        assert resolve_source_subtype(_body()) == "chat"


class TestResolveAssistantSubtype:
    def test_modify(self):
        assert resolve_assistant_subtype(_body(intent_hint="MODIFY")) == "modify"

    def test_default(self):
        assert resolve_assistant_subtype(_body()) == "chat"


class TestResolveEffectiveThinkingLevel:
    def test_deep_with_thinking_sku(self):
        sku = MagicMock(supports_thinking=True)
        assert resolve_effective_thinking_level("deep", sku) == "deep"

    def test_deep_with_non_thinking_sku_downgraded(self):
        sku = MagicMock(supports_thinking=False)
        assert resolve_effective_thinking_level("deep", sku) == "balanced"

    def test_fast_unchanged(self):
        sku = MagicMock(supports_thinking=False)
        assert resolve_effective_thinking_level("fast", sku) == "fast"

    def test_no_sku_passthrough(self):
        assert resolve_effective_thinking_level("deep", None) == "deep"

    def test_balanced_unchanged(self):
        assert resolve_effective_thinking_level("balanced", None) == "balanced"


class TestShouldForceReasoningModel:
    def test_no_sku_deep(self):
        assert should_force_reasoning_model(None, "deep") is True

    def test_no_sku_balanced(self):
        assert should_force_reasoning_model(None, "balanced") is False

    def test_with_sku_deep(self):
        assert should_force_reasoning_model(MagicMock(), "deep") is False

    def test_with_sku_fast(self):
        assert should_force_reasoning_model(MagicMock(), "fast") is False
