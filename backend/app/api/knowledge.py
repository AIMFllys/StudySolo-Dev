"""Knowledge base API routes: /api/knowledge/*

Handles document upload, processing pipeline, listing, querying, and deletion.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from pydantic import BaseModel
from supabase import AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user, get_supabase_client
from app.services.file_parser import parse_file
from app.services.text_chunker import chunk_document
from app.services.embedding_service import embed_texts, embed_text
from app.services.knowledge_retriever import retrieve_chunks, format_retrieval_context

logger = logging.getLogger(__name__)

router = APIRouter()

# Max file size: 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {"pdf", "docx", "md", "txt"}


# ── Pydantic models ─────────────────────────────────────────────────────────

class DocumentMeta(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size_bytes: int
    status: str
    total_chunks: int
    total_tokens: int
    created_at: str | None = None
    updated_at: str | None = None
    error_message: str | None = None


class QueryRequest(BaseModel):
    query: str
    top_k: int = 5
    threshold: float = 0.7


class QueryResult(BaseModel):
    content: str
    similarity: float
    document_id: str
    metadata: dict = {}


class QueryResponse(BaseModel):
    results: list[QueryResult]
    context: str  # formatted context string for LLM


# ── Upload endpoint ──────────────────────────────────────────────────────────

@router.post("/upload", response_model=DocumentMeta, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Upload a document to the knowledge base.

    Triggers the processing pipeline: parse → chunk → embed → store.
    """
    user_id = current_user["id"]

    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式 .{ext}，支持: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过 10MB")

    # Create document record with 'processing' status
    doc_id = str(uuid.uuid4())
    try:
        insert_result = await db.from_("ss_kb_documents").insert({
            "id": doc_id,
            "user_id": user_id,
            "filename": file.filename,
            "file_type": ext,
            "file_size_bytes": len(content),
            "status": "processing",
        }).execute()
    except Exception as e:
        logger.error("Failed to create document record: %s", e)
        raise HTTPException(status_code=500, detail=f"创建文档记录失败: {e}")

    # Process pipeline: parse → chunk → embed → store
    try:
        # Step 1: Parse
        parsed = parse_file(file.filename, content)

        # Step 2: Chunk
        chunks = chunk_document(parsed)
        if not chunks:
            raise ValueError("文档解析后无有效内容")

        total_tokens = sum(c.token_count for c in chunks)

        # Step 3: Store chunks
        chunk_records = []
        for chunk in chunks:
            chunk_id = str(uuid.uuid4())
            chunk_records.append({
                "id": chunk_id,
                "document_id": doc_id,
                "chunk_index": chunk.index,
                "content": chunk.content,
                "token_count": chunk.token_count,
                "metadata": chunk.metadata,
            })

        await db.from_("ss_kb_document_chunks").insert(chunk_records).execute()

        # Step 4: Generate embeddings
        chunk_texts = [c.content for c in chunks]
        embeddings = await embed_texts(chunk_texts)

        # Step 5: Store embeddings
        embedding_records = []
        for chunk_record, embedding in zip(chunk_records, embeddings):
            if embedding:  # Skip failed embeddings
                embedding_records.append({
                    "chunk_id": chunk_record["id"],
                    "document_id": doc_id,
                    "embedding": embedding,
                })

        if embedding_records:
            await db.from_("ss_kb_chunk_embeddings").insert(embedding_records).execute()

        # Step 6: Generate document summary
        summary_text = parsed.full_text[:2000]  # Use first 2000 chars for summary
        summary_embedding = await embed_text(summary_text)

        await db.from_("ss_kb_document_summaries").insert({
            "document_id": doc_id,
            "summary": summary_text[:500],
            "key_concepts": [],
        }).execute()

        if summary_embedding:
            await db.from_("ss_kb_summary_embeddings").insert({
                "document_id": doc_id,
                "embedding": summary_embedding,
            }).execute()

        # Step 7: Update document status to 'ready'
        await db.from_("ss_kb_documents").update({
            "status": "ready",
            "total_chunks": len(chunks),
            "total_tokens": total_tokens,
        }).eq("id", doc_id).execute()

        logger.info(
            "Document '%s' processed: %d chunks, %d tokens",
            file.filename, len(chunks), total_tokens,
        )

    except Exception as e:
        logger.error("Document processing failed for %s: %s", doc_id, e)
        # Update status to error
        await db.from_("ss_kb_documents").update({
            "status": "error",
            "error_message": str(e)[:500],
        }).eq("id", doc_id).execute()
        raise HTTPException(status_code=500, detail=f"文档处理失败: {e}")

    # Return the created document
    result = await db.from_("ss_kb_documents").select("*").eq("id", doc_id).single().execute()
    return result.data


# ── List documents ───────────────────────────────────────────────────────────

@router.get("", response_model=list[DocumentMeta])
@router.get("/", response_model=list[DocumentMeta], include_in_schema=False)
async def list_documents(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """List all documents in the user's knowledge base."""
    result = (
        await db.from_("ss_kb_documents")
        .select("id,filename,file_type,file_size_bytes,status,total_chunks,total_tokens,created_at,updated_at,error_message")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


# ── Get document details ─────────────────────────────────────────────────────

@router.get("/{document_id}")
async def get_document_detail(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Get document details including summary and chunk preview."""
    # Get document
    doc_result = (
        await db.from_("ss_kb_documents")
        .select("*")
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .single()
        .execute()
    )
    if not doc_result.data:
        raise HTTPException(status_code=404, detail="文档不存在")

    # Get summary
    summary_result = (
        await db.from_("ss_kb_document_summaries")
        .select("summary,key_concepts,table_of_contents")
        .eq("document_id", document_id)
        .execute()
    )

    # Get first 5 chunks as preview
    chunks_result = (
        await db.from_("ss_kb_document_chunks")
        .select("chunk_index,content,token_count,metadata")
        .eq("document_id", document_id)
        .order("chunk_index")
        .limit(5)
        .execute()
    )

    return {
        "document": doc_result.data,
        "summary": summary_result.data[0] if summary_result.data else None,
        "chunk_preview": chunks_result.data or [],
    }


# ── Query knowledge base ────────────────────────────────────────────────────

@router.post("/query", response_model=QueryResponse)
async def query_knowledge_base(
    body: QueryRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Search the user's knowledge base for relevant content."""
    results = await retrieve_chunks(
        query=body.query,
        user_id=current_user["id"],
        db=db,
        top_k=body.top_k,
        threshold=body.threshold,
    )

    query_results = [
        QueryResult(
            content=r.content,
            similarity=r.similarity,
            document_id=r.document_id,
            metadata=r.metadata,
        )
        for r in results
    ]

    context = format_retrieval_context(results)

    return QueryResponse(results=query_results, context=context)


# ── Delete document ──────────────────────────────────────────────────────────

@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
):
    """Delete a document and all related chunks/embeddings (CASCADE)."""
    result = (
        await db.from_("ss_kb_documents")
        .delete()
        .eq("id", document_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if result.data is not None and len(result.data) == 0:
        raise HTTPException(status_code=404, detail="文档不存在")
    return {"success": True}
