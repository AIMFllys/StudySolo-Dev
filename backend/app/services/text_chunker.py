"""Text chunker service — splits parsed documents into overlapping chunks.

Uses heading-aware chunking: respects document structure by preferring to split
at section boundaries rather than in the middle of paragraphs.
"""

import logging
from dataclasses import dataclass, field

from app.services.file_parser import ParsedDocument, ParsedSection  # noqa: F401 — ParsedSection re-exported for test compatibility

logger = logging.getLogger(__name__)

# Chunk configuration
DEFAULT_CHUNK_SIZE = 512       # target tokens per chunk
DEFAULT_CHUNK_OVERLAP = 64     # overlap tokens between chunks
APPROX_CHARS_PER_TOKEN = 1.5   # rough estimate for Chinese text


@dataclass
class TextChunk:
    """A chunk of text ready for embedding."""
    index: int
    content: str
    token_count: int
    metadata: dict = field(default_factory=dict)  # {heading, section_index, page}


def chunk_document(
    doc: ParsedDocument,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[TextChunk]:
    """Split a parsed document into overlapping chunks.

    Strategy:
    1. First try to keep each section as a self-contained chunk
    2. If a section exceeds chunk_size, split it into smaller chunks with overlap
    3. If a section is too small, merge it with the next section
    """
    if not doc.sections:
        # Fallback: chunk the full text directly
        if doc.full_text:
            return _chunk_text(doc.full_text, chunk_size, chunk_overlap)
        return []

    chunks: list[TextChunk] = []
    buffer_text = ""
    buffer_heading = ""
    buffer_page = None

    for section_idx, section in enumerate(doc.sections):
        section_text = section.content.strip()
        if not section_text:
            continue

        heading_prefix = f"[{section.heading}] " if section.heading else ""
        full_section = heading_prefix + section_text
        section_tokens = _estimate_tokens(full_section)

        # Case 1: section fits in a chunk → buffer it
        if section_tokens <= chunk_size:
            if buffer_text:
                combined = buffer_text + "\n\n" + full_section
                combined_tokens = _estimate_tokens(combined)

                if combined_tokens <= chunk_size:
                    # Merge with buffer
                    buffer_text = combined
                else:
                    # Flush buffer, start new one
                    chunks.append(TextChunk(
                        index=len(chunks),
                        content=buffer_text.strip(),
                        token_count=_estimate_tokens(buffer_text),
                        metadata={
                            "heading": buffer_heading,
                            "page": buffer_page,
                        },
                    ))
                    buffer_text = full_section
                    buffer_heading = section.heading
                    buffer_page = section.page
            else:
                buffer_text = full_section
                buffer_heading = section.heading
                buffer_page = section.page

        # Case 2: section too large → split it
        else:
            # Flush any buffer first
            if buffer_text:
                chunks.append(TextChunk(
                    index=len(chunks),
                    content=buffer_text.strip(),
                    token_count=_estimate_tokens(buffer_text),
                    metadata={
                        "heading": buffer_heading,
                        "page": buffer_page,
                    },
                ))
                buffer_text = ""

            # Split the large section
            sub_chunks = _chunk_text(
                full_section, chunk_size, chunk_overlap,
                base_metadata={
                    "heading": section.heading,
                    "page": section.page,
                },
            )
            for sc in sub_chunks:
                sc.index = len(chunks)
                chunks.append(sc)

    # Flush remaining buffer
    if buffer_text:
        chunks.append(TextChunk(
            index=len(chunks),
            content=buffer_text.strip(),
            token_count=_estimate_tokens(buffer_text),
            metadata={
                "heading": buffer_heading,
                "page": buffer_page,
            },
        ))

    logger.info(
        "Chunked document '%s' into %d chunks (avg %d tokens/chunk)",
        doc.filename,
        len(chunks),
        sum(c.token_count for c in chunks) // max(len(chunks), 1),
    )

    return chunks


def _chunk_text(
    text: str,
    chunk_size: int,
    chunk_overlap: int,
    base_metadata: dict | None = None,
) -> list[TextChunk]:
    """Split a long text into fixed-size overlapping chunks."""
    chunks: list[TextChunk] = []
    max_chars = int(chunk_size * APPROX_CHARS_PER_TOKEN)
    overlap_chars = int(chunk_overlap * APPROX_CHARS_PER_TOKEN)

    # Split by paragraphs first
    paragraphs = text.split("\n")
    current_chunk = ""

    for para in paragraphs:
        if len(current_chunk) + len(para) + 1 > max_chars and current_chunk:
            chunks.append(TextChunk(
                index=len(chunks),
                content=current_chunk.strip(),
                token_count=_estimate_tokens(current_chunk),
                metadata=dict(base_metadata) if base_metadata else {},
            ))
            # Keep overlap from end of current chunk
            if overlap_chars > 0:
                current_chunk = current_chunk[-overlap_chars:] + "\n" + para
            else:
                current_chunk = para
        else:
            current_chunk = (current_chunk + "\n" + para) if current_chunk else para

    # Last chunk
    if current_chunk.strip():
        chunks.append(TextChunk(
            index=len(chunks),
            content=current_chunk.strip(),
            token_count=_estimate_tokens(current_chunk),
            metadata=dict(base_metadata) if base_metadata else {},
        ))

    return chunks


def _estimate_tokens(text: str) -> int:
    """Roughly estimate token count for Chinese/English mixed text."""
    return max(1, int(len(text) / APPROX_CHARS_PER_TOKEN))
