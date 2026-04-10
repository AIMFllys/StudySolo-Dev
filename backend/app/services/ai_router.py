"""Backward-compat shim — canonical location is app.services.llm.router."""
from app.services.llm.router import *  # noqa: F401,F403
from app.services.llm.router import __all__  # noqa: F401
