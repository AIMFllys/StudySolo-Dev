"""Token counting utility.

Fixes the old bug of using split() for Chinese text by using
tiktoken for accurate BPE token counting.
Falls back to a character-based estimate if tiktoken is unavailable.
"""

import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_encoding():
    """Lazily load tiktoken encoder (cached)."""
    try:
        import tiktoken
        return tiktoken.encoding_for_model("gpt-4")
    except ImportError:
        logger.warning("tiktoken not installed — using character-based estimate")
        return None
    except Exception as e:
        logger.warning("tiktoken encoding failed — using fallback")
        return None


def count_tokens(text: str) -> int:
    """Count the number of tokens in a text string.

    Uses tiktoken for accurate BPE counting.
    Falls back to len(text) / 2 as a rough estimate for CJK text.
    """
    encoding = _get_encoding()
    if encoding is not None:
        return len(encoding.encode(text))
    # Fallback: ~2 chars per token for Chinese
    return max(1, len(text) // 2)
