"""Property tests for config_loader — env var resolution."""

from app.core.config_loader import _resolve_env_vars


class TestResolveEnvVars:
    def test_plain_string_unchanged(self):
        assert _resolve_env_vars("hello") == "hello"

    def test_number_unchanged(self):
        assert _resolve_env_vars(42) == 42

    def test_none_unchanged(self):
        assert _resolve_env_vars(None) is None

    def test_dict_recursive(self):
        result = _resolve_env_vars({"a": "plain", "b": {"c": "nested"}})
        assert result == {"a": "plain", "b": {"c": "nested"}}

    def test_list_recursive(self):
        result = _resolve_env_vars(["a", "b", 1])
        assert result == ["a", "b", 1]

    def test_env_var_pattern_kept_if_not_set(self):
        # $NONEXISTENT_VAR_12345 should stay as-is if not in env
        result = _resolve_env_vars("$NONEXISTENT_VAR_12345")
        assert result == "$NONEXISTENT_VAR_12345"

    def test_non_env_pattern_unchanged(self):
        assert _resolve_env_vars("$lowercase") == "$lowercase"
        assert _resolve_env_vars("not_a_var") == "not_a_var"

    def test_env_var_with_pipe_fallback(self):
        # $A|B pattern — both unset, stays as-is
        result = _resolve_env_vars("$NONEXISTENT_A|NONEXISTENT_B")
        assert "$" in result or "NONEXISTENT" in result
