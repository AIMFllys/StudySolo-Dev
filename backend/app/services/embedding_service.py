"""Embedding service — generates vector embeddings for text chunks.

Uses OpenAI-compatible API to call embedding models (e.g. text-embedding-v4
from Dashscope/Aliyun). Supports batch embedding for efficiency.
"""

import logging
from typing import Sequence

from openai import AsyncOpenAI

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Model configuration
EMBEDDING_MODEL = "text-embedding-v3"  # Aliyun Dashscope text-embedding-v3
EMBEDDING_DIMENSIONS = 1024
MAX_BATCH_SIZE = 25  # Max texts per API call


async def get_embedding_client() -> AsyncOpenAI:
    """Return an OpenAI-compatible client configured for the embedding model."""
    settings = get_settings()
    return AsyncOpenAI(
        base_url=settings.dashscope_base_url,
        api_key=settings.dashscope_api_key,
        timeout=60.0,
    )


async def embed_text(text: str) -> list[float]:
    """Generate embedding vector for a single text string."""
    client = await get_embedding_client()
    response = await client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
        dimensions=EMBEDDING_DIMENSIONS,
    )
    return response.data[0].embedding


async def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    """Generate embeddings for multiple texts in batches.

    Returns a list of embedding vectors, one per input text.
    """
    if not texts:
        return []

    all_embeddings: list[list[float]] = []
    client = await get_embedding_client()

    for i in range(0, len(texts), MAX_BATCH_SIZE):
        batch = texts[i:i + MAX_BATCH_SIZE]

        try:
            response = await client.embeddings.create(
                model=EMBEDDING_MODEL,
                input=list(batch),
                dimensions=EMBEDDING_DIMENSIONS,
            )
            batch_embeddings = [item.embedding for item in response.data]
            all_embeddings.extend(batch_embeddings)
            logger.info("Embedded batch %d-%d (%d texts)", i, i + len(batch), len(batch))

        except Exception as e:
            logger.error("Embedding batch %d-%d failed: %s", i, i + len(batch), e)
            # Fill failed batch with empty vectors
            all_embeddings.extend([[] for _ in batch])

    return all_embeddings
