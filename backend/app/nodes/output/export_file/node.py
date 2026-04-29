"""ExportFile node — exports upstream content as downloadable files.

This is a NON-LLM node. It collects all upstream Markdown output and
converts it to the user's requested format.

Supported formats:
- Markdown (.md)
- Plain Text (.txt)
- DOCX / Word (.docx)
- Copy (returns content directly for frontend clipboard copy)

Typical flows:
  [content_extract] → [merge_polish] → [export_file]
  [summary] → [export_file]
"""

import logging
import os
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput, NodeOutput

logger = logging.getLogger(__name__)


class ExportFileNode(BaseNode):
    node_type = "export_file"
    category = "output"
    display_name = "文件导出"
    description = "将学习成果导出为文件（Markdown/TXT/Word/复制）"
    is_llm_node = False
    output_format = "markdown"
    icon = "📥"
    color = "#10b981"
    version = "1.0.0"
    changelog = {"1.0.0": "初始版本"}
    config_schema = [
        {
            "key": "format",
            "type": "select",
            "label": "导出格式",
            "default": "md",
            "options": [
                {"label": "Markdown (.md)", "value": "md"},
                {"label": "纯文本 (.txt)", "value": "txt"},
                {"label": "Word (.docx)", "value": "docx"},
                {"label": "复制到剪贴板", "value": "copy"},
            ],
            "description": "要生成的文件格式。选择「复制」将直接输出原文供前端复制。",
        },
        {
            "key": "filename",
            "type": "text",
            "label": "文件名",
            "default": "学习笔记",
            "description": "不含扩展名的导出文件名。",
        },
    ]
    output_capabilities = ["preview", "compact", "download", "copy"]

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        """Export upstream content to file.

        Collects all upstream outputs as the content to export.
        The export format is determined by node_config.
        """
        # Collect upstream content
        content_parts: list[str] = []
        if node_input.upstream_outputs:
            for uid, out in node_input.upstream_outputs.items():
                if out and out.strip():
                    content_parts.append(out)

        if not content_parts:
            yield "⚠️ 没有可导出的内容（上游节点无输出）"
            return

        content = "\n\n---\n\n".join(content_parts)

        # Determine export format
        export_format = "md"
        filename = "学习笔记"
        if node_input.node_config:
            export_format = node_input.node_config.get("format", "md")
            filename = node_input.node_config.get("filename", "学习笔记")

        # Label hints override config
        label = (node_input.user_content or "").lower()
        if "docx" in label or "word" in label:
            export_format = "docx"
        elif "txt" in label:
            export_format = "txt"
        elif "copy" in label or "复制" in label:
            export_format = "copy"
        elif "md" in label or "markdown" in label:
            export_format = "md"

        # ── Copy mode: return content directly for frontend clipboard ──
        if export_format == "copy":
            yield "📋 **内容已就绪，可复制到剪贴板**\n\n"
            yield "```\n"
            yield content
            yield "\n```\n\n"
            yield f"<!-- COPY_CONTENT_START -->\n{content}\n<!-- COPY_CONTENT_END -->"
            return

        # ── TXT mode: strip markdown formatting ──
        if export_format == "txt":
            from app.services.file_converter import export_txt
            yield "📥 正在导出 TXT 文件...\n\n"
            try:
                result = await export_txt(content=content, filename=filename)
                if result.error:
                    yield f"⚠️ {result.error}\n\n"
                if result.filepath and os.path.exists(result.filepath):
                    size_kb = result.size_bytes / 1024
                    download_url = f"/api/exports/download/{result.filename}"
                    yield "✅ 文件已生成\n\n"
                    yield f"- **文件名**: {result.filename}\n"
                    yield "- **格式**: TXT\n"
                    yield f"- **大小**: {size_kb:.1f} KB\n"
                    yield f"- **下载**: [📥 点击下载]({download_url})\n\n"
                else:
                    yield "⚠️ 文件生成失败"
            except Exception as e:
                logger.error("TXT export failed: %s", e)
                yield f"⚠️ 导出出错: {e}"
            return

        # ── MD / DOCX mode: use existing converter ──
        from app.services.document_service import convert_document

        yield f"📥 正在导出 {export_format.upper()} 文件...\n\n"

        try:
            result = await convert_document(
                content=content,
                format=export_format,
                filename=filename,
            )

            if result.error:
                yield f"⚠️ {result.error}\n\n"

            if result.filepath and os.path.exists(result.filepath):
                size_kb = result.size_bytes / 1024
                download_url = f"/api/exports/download/{result.filename}"
                yield "✅ 文件已生成\n\n"
                yield f"- **文件名**: {result.filename}\n"
                yield f"- **格式**: {result.format.upper()}\n"
                yield f"- **大小**: {size_kb:.1f} KB\n"
                yield f"- **下载**: [📥 点击下载]({download_url})\n\n"
            else:
                yield "⚠️ 文件生成失败"

        except Exception as e:
            logger.error("Export file node failed: %s", e)
            yield f"⚠️ 导出出错: {e}"

    async def post_process(self, raw_output: str) -> NodeOutput:
        """Return export results as markdown."""
        content = raw_output
        search_prefixes = [
            "📥 正在导出",
            "📋 **内容已就绪",
        ]
        for prefix in search_prefixes:
            if content.startswith(prefix):
                parts = content.split("\n\n", 1)
                if len(parts) > 1:
                    content = parts[1]
                break

        return NodeOutput(
            content=content,
            format="markdown",
            metadata={"source": "export_file"},
        )
