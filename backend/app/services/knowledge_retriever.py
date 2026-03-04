"""Knowledge retriever service — searches user's knowledge base.

Implements a two-layer retrieval funnel:
1. Vector similarity search via pgvector (coarse)
2. Content relevance re-ranking (future enhancement)

This service is called by the knowledge_base node during workflow execution
and by the knowledge API for direct querying.
"""

import json
import logging
from dataclasses import dataclass, field

from supabase import AsyncClient

from app.services.embedding_service import embed_text

logger = logging.getLogger(__name__)


@dataclass
class RetrievalResult:
    """A single retrieval result with source attribution."""
    chunk_id: str
    document_id: str
    content: str
    similarity: float
    metadata: dict = field(default_factory=dict)


async def retrieve_chunks(
    query: str,
    user_id: str,
    db: AsyncClient,
    top_k: int = 5,
    threshold: float = 0.7,
) -> list[RetrievalResult]:
    """Search user's knowledge base for chunks relevant to the query.

    Steps:
    1. Embed the query text
    2. Call match_kb_chunks RPC for vector similarity search
    3. Return ranked results with source attribution
    """
    # Step 1: Embed query
    try:
        query_embedding = await embed_text(query)
    except Exception as e:
        logger.error("Failed to embed query: %s", e)
        return []

    if not query_embedding:
        return []

    # Step 2: Vector similarity search via Supabase RPC
    try:
        result = await db.rpc("match_kb_chunks", {
            "query_embedding": query_embedding,
            "match_count": top_k,
            "match_threshold": threshold,
            "p_user_id": user_id,
        }).execute()
    except Exception as e:
        logger.error("Vector search failed: %s", e)
        return []

    if not result.data:
        logger.info("No relevant chunks found for query: %s", query[:50])
        return []

    # Step 3: Build results
    results: list[RetrievalResult] = []
    for row in result.data:
        results.append(RetrievalResult(
            chunk_id=row["chunk_id"],
            document_id=row["document_id"],
            content=row["content"],
            similarity=row["similarity"],
            metadata=row.get("metadata", {}),
        ))

    logger.info(
        "Retrieved %d chunks for query '%s' (best similarity: %.3f)",
        len(results),
        query[:50],
        results[0].similarity if results else 0,
    )

    return results


def format_retrieval_context(results: list[RetrievalResult]) -> str:
    """Format retrieval results into a context string for LLM consumption."""
    if not results:
        return "未在知识库中找到相关内容。"

    parts: list[str] = []
    parts.append(f"以下是从用户知识库中检索到的 {len(results)} 段相关内容：\n")

    for i, r in enumerate(results, 1):
        heading = r.metadata.get("heading", "")
        source = f"（来源：{heading}）" if heading else ""
        parts.append(f"--- 片段 {i}{source} [相关度: {r.similarity:.2f}] ---")
        parts.append(r.content)
        parts.append("")

    return "\n".join(parts)
