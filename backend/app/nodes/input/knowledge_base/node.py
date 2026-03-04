"""KnowledgeBase node — retrieves relevant content from user's knowledge base.

This is a '封装功能型' NON-LLM node. Instead of calling an LLM, it calls
the knowledge_retriever service to find relevant chunks from the user's
uploaded documents.

Flow B (in-workflow retrieval):
  [trigger_input] → [knowledge_base] → [content_extract]
                           |
                     Calls retriever service, not LLM
                     Outputs relevant chunks + citations
"""

import logging
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput, NodeOutput

logger = logging.getLogger(__name__)


class KnowledgeBaseNode(BaseNode):
    node_type = "knowledge_base"
    category = "input"
    description = "从用户知识库中检索相关内容"
    is_llm_node = False  # This node does NOT call LLM
    output_format = "markdown"
    icon = "📚"
    color = "#8b5cf6"

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        """Execute knowledge base retrieval.

        This node does NOT use llm_caller. Instead, it directly calls
        the knowledge_retriever service.

        The query is built from:
        1. node_input.user_content (the label, describing what to search)
        2. Upstream outputs (for context-aware retrieval)
        """
        # Lazy imports — avoid registration-time dependency on supabase
        from app.core.database import get_db
        from app.services.knowledge_retriever import retrieve_chunks, format_retrieval_context

        # Build query from user content + upstream context
        query_parts: list[str] = []
        if node_input.user_content:
            query_parts.append(node_input.user_content)
        if node_input.upstream_outputs:
            for uid, out in node_input.upstream_outputs.items():
                # Take first 200 chars of each upstream as context
                query_parts.append(out[:200])

        query = " ".join(query_parts)
        if not query.strip():
            yield "⚠️ 没有提供搜索查询内容"
            return

        # Get user_id from implicit_context
        user_id = None
        if node_input.implicit_context:
            user_id = node_input.implicit_context.get("user_id")

        if not user_id:
            yield "⚠️ 无法确定用户身份，无法检索知识库"
            return

        # Get retrieval config
        top_k = 5
        threshold = 0.7
        if node_input.node_config:
            top_k = node_input.node_config.get("top_k", 5)
            threshold = node_input.node_config.get("threshold", 0.7)

        # Perform retrieval
        try:
            db = await get_db()
            results = await retrieve_chunks(
                query=query,
                user_id=user_id,
                db=db,
                top_k=top_k,
                threshold=threshold,
            )

            if not results:
                yield "📚 未在知识库中找到与当前主题相关的内容。\n\n建议：请先在知识库管理页面上传相关学习材料。"
                return

            # Format and yield results
            context = format_retrieval_context(results)
            yield context

        except Exception as e:
            logger.error("Knowledge base retrieval failed: %s", e)
            yield f"⚠️ 知识库检索出错: {e}"

    async def post_process(self, raw_output: str) -> NodeOutput:
        """Return retrieval results as markdown."""
        return NodeOutput(
            content=raw_output,
            format="markdown",
            metadata={"source": "knowledge_base"},
        )
