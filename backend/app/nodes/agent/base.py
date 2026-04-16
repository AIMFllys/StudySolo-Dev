"""Shared base for fixed Agent-backed workflow nodes."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from functools import lru_cache
from pathlib import Path
from typing import Any, ClassVar

from app.nodes._base import BaseNode, NodeInput, NodeOutput
from app.services.agent_gateway import AgentCallResult, AgentGateway, AgentRegistry

_AGENT_CONFIG_PATH = Path(__file__).resolve().parents[3] / "config" / "agents.yaml"


@lru_cache(maxsize=1)
def get_agent_registry() -> AgentRegistry:
    return AgentRegistry(_AGENT_CONFIG_PATH)


@lru_cache(maxsize=1)
def get_agent_gateway() -> AgentGateway:
    return AgentGateway(get_agent_registry())


def build_agent_config_schema(default_task_prompt: str, default_instruction: str) -> list[dict[str, Any]]:
    return [
        {
            "key": "task_prompt",
            "type": "textarea",
            "label": "任务聚焦",
            "default": default_task_prompt,
            "description": "给子 Agent 的主任务描述。留空则回退到节点默认任务。",
            "placeholder": "补充你希望这个 Agent 完成的核心目标。",
        },
        {
            "key": "instruction",
            "type": "textarea",
            "label": "执行要求",
            "default": default_instruction,
            "description": "额外约束、风格要求或输出偏好。",
            "placeholder": "例如：按条列输出、优先指出高风险项、保留引用来源。",
        },
    ]


class BaseAgentNode(BaseNode):
    """Fixed mapping from workflow node type to a registered sub-backend Agent."""

    _abstract = True

    category = "agent"
    is_llm_node = True
    output_format = "markdown"
    supports_preview = True
    model_source = "agent"
    output_capabilities = ["preview", "compact"]

    agent_name: ClassVar[str] = ""
    default_task_prompt: ClassVar[str] = ""
    default_instruction: ClassVar[str] = ""

    def __init__(self) -> None:
        self._resolved_model_route: str | None = None

    @classmethod
    def is_manifest_available(cls) -> bool:
        agent = get_agent_registry().get(cls.agent_name)
        return bool(agent and agent.enabled)

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        del llm_caller

        selected_model = self._get_selected_model(node_input.node_config)
        self._resolved_model_route = selected_model or self._resolve_default_model()

        system = self.system_prompt + self.build_context_prompt(node_input.implicit_context)
        user_msg = self._build_agent_user_message(node_input)
        gateway = get_agent_gateway()
        user_id = None
        if isinstance(node_input.implicit_context, dict):
            raw_user_id = node_input.implicit_context.get("user_id")
            if raw_user_id:
                user_id = str(raw_user_id)

        result = await gateway.call_stream(
            self.agent_name,
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user_msg},
            ],
            model=selected_model,
            user_id=user_id,
        )

        if isinstance(result, AgentCallResult):
            raise RuntimeError(result.error or f"Agent 调用失败：{self.agent_name}")

        stream_iter, _request_id = result
        async for token in self._consume_agent_stream(stream_iter):
            yield token

    async def post_process(self, raw_output: str) -> NodeOutput:
        metadata = {}
        if self._resolved_model_route:
            metadata["resolved_model_route"] = self._resolved_model_route
        return NodeOutput(content=raw_output, format=self.output_format, metadata=metadata)

    def _build_agent_user_message(self, node_input: NodeInput) -> str:
        config = dict(node_input.node_config or {})
        task_prompt = str(config.pop("task_prompt", self.default_task_prompt) or self.default_task_prompt).strip()
        instruction = str(config.pop("instruction", self.default_instruction) or self.default_instruction).strip()
        config.pop("model_route", None)

        filtered_input = NodeInput(
            user_content=node_input.user_content,
            upstream_outputs=node_input.upstream_outputs,
            implicit_context=node_input.implicit_context,
            node_config=config or None,
        )

        sections: list[str] = []
        if task_prompt:
            sections.append(f"任务聚焦：\n{task_prompt}")
        if instruction:
            sections.append(f"执行要求：\n{instruction}")
        base_message = self.build_user_message(filtered_input)
        if base_message:
            sections.append(base_message)
        return "\n\n".join(section for section in sections if section)

    def _get_selected_model(self, node_config: dict[str, Any] | None) -> str | None:
        if not node_config:
            return None
        model = node_config.get("model_route")
        if isinstance(model, str) and model.strip():
            return model.strip()
        return None

    def _resolve_default_model(self) -> str:
        agent = get_agent_registry().get(self.agent_name)
        if agent and agent.models:
            return agent.models[0]
        return self.agent_name

    async def _consume_agent_stream(self, stream_iter: AsyncIterator[bytes]) -> AsyncIterator[str]:
        buffer = ""
        async for chunk in stream_iter:
            buffer += chunk.decode("utf-8", errors="ignore")
            while "\n\n" in buffer:
                frame, buffer = buffer.split("\n\n", 1)
                for token in self._parse_sse_frame(frame):
                    yield token

        if buffer.strip():
            for token in self._parse_sse_frame(buffer):
                yield token

    def _parse_sse_frame(self, frame: str) -> list[str]:
        tokens: list[str] = []
        for raw_line in frame.splitlines():
            line = raw_line.strip()
            if not line.startswith("data:"):
                continue
            payload_str = line[5:].strip()
            if not payload_str or payload_str == "[DONE]":
                continue
            payload = json.loads(payload_str)
            if isinstance(payload, dict) and isinstance(payload.get("error"), dict):
                error = payload["error"]
                raise RuntimeError(str(error.get("message") or "Agent 流式调用失败"))
            text = self._extract_stream_text(payload)
            if text:
                tokens.append(text)
        return tokens

    def _extract_stream_text(self, payload: Any) -> str:
        texts: list[str] = []
        if isinstance(payload, dict):
            choices = payload.get("choices")
            if isinstance(choices, list):
                for choice in choices:
                    if not isinstance(choice, dict):
                        continue
                    delta = choice.get("delta")
                    if isinstance(delta, dict) and isinstance(delta.get("content"), str):
                        texts.append(delta["content"])
                    message = choice.get("message")
                    if isinstance(message, dict) and isinstance(message.get("content"), str):
                        texts.append(message["content"])
            elif isinstance(payload.get("content"), str):
                texts.append(payload["content"])
        return "".join(texts)
