"""
Property 9: YAML 环境变量解析
Feature: studysolo-mvp, Property 9: YAML 环境变量解析

For any config.yaml string value prefixed with $, _resolve_env_vars must
replace it with the corresponding environment variable value.
Non-$ prefixed strings must remain unchanged.

Validates: Requirements 4.2
"""

import os

from hypothesis import given, settings
from hypothesis import strategies as st

from app.core.config_loader import _resolve_env_vars

# Strategy: valid env var names (uppercase letters, digits, underscores)
_env_var_name = st.from_regex(r"[A-Z][A-Z0-9_]{0,19}", fullmatch=True)
_env_var_value = st.text(
    alphabet=st.characters(blacklist_characters="\x00"),
    min_size=0,
    max_size=50,
)

# Strategy: strings that do NOT start with $ (should pass through unchanged)
_plain_string = st.text(min_size=0, max_size=50).filter(lambda s: not s.startswith("$"))


@given(_env_var_name, _env_var_value)
@settings(max_examples=200)
def test_env_var_substitution(var_name: str, var_value: str):
    """$VAR_NAME strings are replaced with the env var value."""
    os.environ[var_name] = var_value
    try:
        result = _resolve_env_vars(f"${var_name}")
        assert result == var_value, (
            f"Expected '{var_value}' for ${var_name}, got '{result}'"
        )
    finally:
        del os.environ[var_name]


@given(_plain_string)
@settings(max_examples=200)
def test_non_env_var_strings_unchanged(s: str):
    """Strings without $ prefix are returned unchanged."""
    result = _resolve_env_vars(s)
    assert result == s, f"Expected '{s}' unchanged, got '{result}'"


@given(st.dictionaries(
    keys=st.text(min_size=1, max_size=10),
    values=st.one_of(_plain_string, st.just("$TEST_NESTED_VAR")),
    max_size=5,
))
@settings(max_examples=100)
def test_nested_dict_resolution(d: dict):
    """Nested dicts are recursively resolved."""
    os.environ["TEST_NESTED_VAR"] = "resolved_value"
    try:
        result = _resolve_env_vars(d)
        for k, v in d.items():
            if v == "$TEST_NESTED_VAR":
                assert result[k] == "resolved_value"
            else:
                assert result[k] == v
    finally:
        os.environ.pop("TEST_NESTED_VAR", None)


@given(st.lists(
    st.one_of(_plain_string, st.just("$TEST_LIST_VAR")),
    max_size=10,
))
@settings(max_examples=100)
def test_list_resolution(lst: list):
    """Lists are recursively resolved."""
    os.environ["TEST_LIST_VAR"] = "list_resolved"
    try:
        result = _resolve_env_vars(lst)
        for orig, res in zip(lst, result):
            if orig == "$TEST_LIST_VAR":
                assert res == "list_resolved"
            else:
                assert res == orig
    finally:
        os.environ.pop("TEST_LIST_VAR", None)
