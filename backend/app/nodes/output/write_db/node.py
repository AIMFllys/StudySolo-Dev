"""Write DB node — persist workflow results to ss_workflow_runs."""

import json
import logging
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput

logger = logging.getLogger(__name__)


class WriteDBNode(BaseNode):
    node_type = "write_db"
    category = "output"
    display_name = "数据写入"
    description = "将工作流结果持久化到数据库"
    is_llm_node = False
    output_format = "json"
    icon = "💾"
    color = "#6b7280"
    config_schema = [
        {
            "key": "target_key",
            "type": "text",
            "label": "保存键名",
            "default": "saved_result",
            "description": "写入工作流运行记录 output.saved_results 下的键名。",
        },
        {
            "key": "append",
            "type": "boolean",
            "label": "追加模式",
            "default": False,
            "description": "开启后会把多次写入聚合为数组。",
        },
        {
            "key": "include_raw_output",
            "type": "boolean",
            "label": "保存原始文本",
            "default": True,
            "description": "是否在保存记录中附带原始上游文本。",
        },
    ]
    output_capabilities = ["preview", "compact", "persist"]

    async def execute(
        self,
        node_input: NodeInput,
        llm_caller: Any,
    ) -> AsyncIterator[str]:
        """Persist results to the current workflow run record."""
        from app.core.database import get_db

        config = node_input.node_config or {}
        target_key = str(config.get("target_key", "saved_result")).strip() or "saved_result"
        append_mode = bool(config.get("append", False))
        include_raw_output = bool(config.get("include_raw_output", True))
        workflow_run_id = (node_input.implicit_context or {}).get("workflow_run_id")

        # Collect all upstream outputs as the "result"
        combined = "\n\n".join(
            out for out in node_input.upstream_outputs.values() if out
        )
        if not combined:
            yield "⚠️ 没有可写入的上游输出"
            return

        if not workflow_run_id:
            yield "⚠️ 当前执行缺少 workflow_run_id，无法写入运行记录"
            return

        try:
            db = await get_db()
            existing = (
                await db.from_("ss_workflow_runs")
                .select("output")
                .eq("id", workflow_run_id)
                .single()
                .execute()
            )
            current_output = existing.data.get("output") if existing.data else {}
            if not isinstance(current_output, dict):
                current_output = {}

            saved_results = current_output.get("saved_results")
            if not isinstance(saved_results, dict):
                saved_results = {}

            payload = {
                "content": combined,
                "sources": list(node_input.upstream_outputs.keys()),
            }
            if include_raw_output:
                payload["raw_output"] = node_input.upstream_outputs

            if append_mode and target_key in saved_results:
                existing_value = saved_results[target_key]
                if isinstance(existing_value, list):
                    existing_value.append(payload)
                    saved_results[target_key] = existing_value
                else:
                    saved_results[target_key] = [existing_value, payload]
            else:
                saved_results[target_key] = payload

            current_output["saved_results"] = saved_results

            await db.from_("ss_workflow_runs").update({"output": current_output}).eq(
                "id", workflow_run_id
            ).execute()

            yield json.dumps(
                {
                    "status": "saved",
                    "target_key": target_key,
                    "append": append_mode,
                    "content_preview": combined[:160],
                },
                ensure_ascii=False,
            )
        except Exception as e:
            logger.error("Write DB node failed: %s", e)
            yield f"⚠️ 写入运行记录失败: {e}"
