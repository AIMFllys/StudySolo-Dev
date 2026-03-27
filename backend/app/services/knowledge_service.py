"""Facade for knowledge-base retrieval and document processing."""

import logging
import uuid

from supabase import AsyncClient

from app.models.knowledge import QueryResponse, QueryResult
from app.services.document_service import parse_document
from app.services.embedding_service import embed_text, embed_texts
from app.services.knowledge_retriever import (
    RetrievalResult,
    format_retrieval_context,
    retrieve_chunks,
)
from app.services.text_chunker import chunk_document

logger = logging.getLogger(__name__)


async def process_document_pipeline(
    doc_id: str,
    filename: str,
    file_content: bytes,
    db: AsyncClient,
) -> None:
    """Background task: parse -> chunk -> embed -> store."""
    try:
        parsed = parse_document(filename, file_content)
        chunks = chunk_document(parsed)
        if not chunks:
            raise ValueError("文档解析后无有效内容")

        total_tokens = sum(chunk.token_count for chunk in chunks)
        chunk_records = []
        for chunk in chunks:
            chunk_id = str(uuid.uuid4())
            chunk_records.append(
                {
                    "id": chunk_id,
                    "document_id": doc_id,
                    "chunk_index": chunk.index,
                    "content": chunk.content,
                    "token_count": chunk.token_count,
                    "metadata": chunk.metadata,
                }
            )

        await db.from_("ss_kb_document_chunks").insert(chunk_records).execute()

        embeddings = await embed_texts([chunk.content for chunk in chunks])
        embedding_records = []
        for chunk_record, embedding in zip(chunk_records, embeddings):
            if embedding:
                embedding_records.append(
                    {
                        "chunk_id": chunk_record["id"],
                        "document_id": doc_id,
                        "embedding": embedding,
                    }
                )

        if embedding_records:
            await db.from_("ss_kb_chunk_embeddings").insert(embedding_records).execute()

        summary_text = parsed.full_text[:2000]
        summary_embedding = await embed_text(summary_text)

        await db.from_("ss_kb_document_summaries").insert(
            {
                "document_id": doc_id,
                "summary": summary_text[:500],
                "key_concepts": [],
            }
        ).execute()

        if summary_embedding:
            await db.from_("ss_kb_summary_embeddings").insert(
                {
                    "document_id": doc_id,
                    "embedding": summary_embedding,
                }
            ).execute()

        await db.from_("ss_kb_documents").update(
            {
                "status": "ready",
                "total_chunks": len(chunks),
                "total_tokens": total_tokens,
            }
        ).eq("id", doc_id).execute()

        logger.info(
            "Document '%s' processed: %d chunks, %d tokens",
            filename,
            len(chunks),
            total_tokens,
        )
    except Exception as exc:
        logger.error("Document processing failed for %s: %s", doc_id, exc)
        try:
            await db.from_("ss_kb_documents").update(
                {
                    "status": "error",
                    "error_message": str(exc)[:500],
                }
            ).eq("id", doc_id).execute()
        except Exception as update_err:
            logger.error("Failed to update error status: %s", update_err)


async def retrieve_knowledge_chunks(
    query: str,
    user_id: str,
    db: AsyncClient,
    top_k: int = 5,
    threshold: float = 0.7,
    document_ids: list[str] | None = None,
) -> list[RetrievalResult]:
    """Retrieve relevant chunks from the user's knowledge base.

    Args:
        document_ids: Optional list of document IDs to restrict the search to.
                      When provided, only chunks from these documents are returned.
                      When None or empty, all user documents are searched.
    """
    results = await retrieve_chunks(
        query=query,
        user_id=user_id,
        db=db,
        top_k=top_k,
        threshold=threshold,
    )
    # Filter by document_ids if specified
    if document_ids:
        doc_id_set = set(document_ids)
        results = [r for r in results if r.document_id in doc_id_set]
    return results


async def query_knowledge_base(
    query: str,
    user_id: str,
    db: AsyncClient,
    top_k: int = 5,
    threshold: float = 0.7,
) -> QueryResponse:
    """Search the user's knowledge base and return API-ready payloads."""
    results = await retrieve_knowledge_chunks(
        query=query,
        user_id=user_id,
        db=db,
        top_k=top_k,
        threshold=threshold,
    )
    query_results = [
        QueryResult(
            content=result.content,
            similarity=result.similarity,
            document_id=result.document_id,
            metadata=result.metadata,
        )
        for result in results
    ]
    return QueryResponse(
        results=query_results,
        context=format_retrieval_context(results),
    )


__all__ = [
    "QueryResponse",
    "RetrievalResult",
    "format_retrieval_context",
    "process_document_pipeline",
    "query_knowledge_base",
    "retrieve_knowledge_chunks",
]
