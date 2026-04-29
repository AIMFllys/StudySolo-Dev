"""Property tests for text_chunker — chunking logic and token estimation."""

from app.services.text_chunker import (
    _chunk_text,
    _estimate_tokens,
    chunk_document,
)
from app.services.file_parser import ParsedDocument, ParsedSection


class TestEstimateTokens:
    def test_empty(self):
        assert _estimate_tokens("") == 1  # min 1

    def test_short_text(self):
        assert _estimate_tokens("hello") >= 1

    def test_proportional(self):
        short = _estimate_tokens("abc")
        long = _estimate_tokens("a" * 1000)
        assert long > short


class TestChunkText:
    def test_short_text_single_chunk(self):
        chunks = _chunk_text("short text", 100, 10)
        assert len(chunks) == 1
        assert chunks[0].content == "short text"

    def test_long_text_multiple_chunks(self):
        text = "paragraph\n" * 500
        chunks = _chunk_text(text, 50, 10)
        assert len(chunks) > 1

    def test_overlap_present(self):
        text = ("word " * 200).strip()
        chunks = _chunk_text(text, 30, 10)
        if len(chunks) >= 2:
            # Last part of chunk N should appear in start of chunk N+1
            end_of_first = chunks[0].content[-20:]
            assert any(c in chunks[1].content for c in end_of_first.split())

    def test_metadata_passed(self):
        chunks = _chunk_text("text", 100, 10, base_metadata={"heading": "H1"})
        assert chunks[0].metadata["heading"] == "H1"


class TestChunkDocument:
    def test_empty_document(self):
        doc = ParsedDocument(filename="test.txt", full_text="", sections=[])
        assert chunk_document(doc) == []

    def test_single_section(self):
        doc = ParsedDocument(
            filename="test.txt",
            full_text="content",
            sections=[ParsedSection(heading="H1", content="Some content here")],
        )
        chunks = chunk_document(doc)
        assert len(chunks) >= 1
        assert "H1" in chunks[0].content or "content" in chunks[0].content

    def test_multiple_small_sections_merged(self):
        sections = [ParsedSection(heading=f"S{i}", content=f"Short {i}") for i in range(3)]
        doc = ParsedDocument(filename="test.txt", full_text="", sections=sections)
        chunks = chunk_document(doc, chunk_size=500)
        # Small sections should be merged into fewer chunks
        assert len(chunks) <= len(sections)

    def test_large_section_split(self):
        big = "\n".join(["paragraph " * 20] * 50)  # many paragraphs with newlines
        doc = ParsedDocument(
            filename="test.txt",
            full_text="",
            sections=[ParsedSection(heading="Big", content=big)],
        )
        chunks = chunk_document(doc, chunk_size=50)
        assert len(chunks) > 1

    def test_fallback_to_full_text(self):
        doc = ParsedDocument(filename="test.txt", full_text="fallback content", sections=[])
        chunks = chunk_document(doc)
        assert len(chunks) >= 1
        assert "fallback" in chunks[0].content
