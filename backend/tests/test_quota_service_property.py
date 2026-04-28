"""Property tests for quota_service — tier limits and daily quota helpers."""

from app.services.quota_service import (
    TIER_DAILY_CHAT_LIMITS,
    TIER_DAILY_EXECUTION_LIMITS,
    TIER_LOOP_ITERATION_LIMITS,
    TIER_WORKFLOW_LIMITS,
    _get_cst_today_start_utc,
)


class TestTierLimits:
    def test_all_tiers_defined(self):
        for tier in ("free", "pro", "pro_plus", "ultra"):
            assert tier in TIER_WORKFLOW_LIMITS
            assert tier in TIER_DAILY_CHAT_LIMITS
            assert tier in TIER_DAILY_EXECUTION_LIMITS
            assert tier in TIER_LOOP_ITERATION_LIMITS

    def test_limits_increase_with_tier(self):
        order = ["free", "pro", "pro_plus", "ultra"]
        for limits in (TIER_WORKFLOW_LIMITS, TIER_DAILY_CHAT_LIMITS, TIER_DAILY_EXECUTION_LIMITS):
            for i in range(len(order) - 1):
                assert limits[order[i]] <= limits[order[i + 1]], f"{order[i]} > {order[i+1]}"

    def test_free_tier_has_reasonable_limits(self):
        assert TIER_WORKFLOW_LIMITS["free"] >= 1
        assert TIER_DAILY_CHAT_LIMITS["free"] >= 1
        assert TIER_DAILY_EXECUTION_LIMITS["free"] >= 1

    def test_ultra_effectively_unlimited(self):
        assert TIER_WORKFLOW_LIMITS["ultra"] > 1_000_000
        assert TIER_LOOP_ITERATION_LIMITS["ultra"] > 1_000_000


class TestCstTodayStart:
    def test_returns_iso_string(self):
        result = _get_cst_today_start_utc()
        assert isinstance(result, str)
        assert "T" in result

    def test_contains_utc_offset(self):
        result = _get_cst_today_start_utc()
        assert "+" in result or "Z" in result or "00:00" in result
