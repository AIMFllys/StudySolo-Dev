"""AI route aggregation — Task 2.1 + Task 2.4 result.

Replaces the 5 separate AI route imports in router.py with a single:
    from app.api.ai import router as ai_router
"""

from fastapi import APIRouter

from app.api.ai.catalog import router as catalog_router
from app.api.ai.chat import router as chat_router
from app.api.ai.generate import router as generate_router
from app.api.ai.models import router as models_router

router = APIRouter()
router.include_router(chat_router, tags=["ai-chat"])
router.include_router(generate_router, tags=["ai"])
router.include_router(catalog_router)  # already has tags=["ai-catalog"]
router.include_router(models_router)   # already has tags=["ai-chat-models"]
