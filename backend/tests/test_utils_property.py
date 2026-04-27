"""Property tests for app.utils — output_truncator and token_counter."""

from app.utils.output_truncator import truncate_output
from app.utils.token_counter import count_tokens


class TestTruncateOutput:
    def test_short_text_unchanged(self):
        assert truncate_output("hello", 100) == "hello"

    def test_long_text_truncated(self):
        text = "a" * 10000
        result = truncate_output(text, 100)
        assert len(result) < 10000
        assert "截断" in result

    def test_cuts_at_sentence_boundary(self):
        text = "第一句话。第二句话。" + "填充" * 5000
        result = truncate_output(text, 30)
        assert result.endswith("截断)") or "。" in result

    def test_default_max_chars(self):
        text = "x" * 9000
        result = truncate_output(text)
        assert len(result) <= 8100  # 8000 + marker

    def test_exact_boundary(self):
        text = "a" * 8000
        assert truncate_output(text) == text

    def test_chinese_sentence_boundary(self):
        text = "你好！" + "填" * 8000
        result = truncate_output(text, 20)
        assert "截断" in result


class TestCountTokens:
    def test_empty_string(self):
        assert count_tokens("") >= 0

    def test_english_text(self):
        count = count_tokens("Hello world")
        assert count >= 1

    def test_chinese_text(self):
        count = count_tokens("你好世界")
        assert count >= 1

    def test_longer_text_more_tokens(self):
        short = count_tokens("hi")
        long = count_tokens("hello world this is a longer sentence")
        assert long > short
