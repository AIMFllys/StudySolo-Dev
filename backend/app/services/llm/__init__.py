"""LLM service package — unified model routing, calling, and provider management.

Public API re-exports for backward compatibility:
    from app.services.llm import call_llm, call_llm_direct, AIRouterError
"""

from app.services.llm.caller import (  # noqa: F401
    LLMCallResult,
    LLMStreamResult,
    empty_stream,
)
from app.services.llm.provider import AIRouterError  # noqa: F401
from app.services.llm.router import (  # noqa: F401
    call_llm,
    call_llm_direct,
    call_llm_direct_structured,
    call_llm_structured,
)
