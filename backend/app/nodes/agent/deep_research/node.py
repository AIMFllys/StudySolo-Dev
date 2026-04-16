"""Agent node for deep research tasks."""

from app.nodes.agent.base import BaseAgentNode, build_agent_config_schema


class AgentDeepResearchNode(BaseAgentNode):
    _abstract = False
    node_type = "agent_deep_research"
    agent_name = "deep-research"
    display_name = "深度研究 Agent"
    description = "调用深度研究子后端，完成长链资料检索、归纳与研究综述生成。"
    icon = "🔎"
    color = "#1d4ed8"
    version = "1.0.0"
    changelog = {"1.0.0": "初始版本"}
    default_task_prompt = "请围绕当前主题进行深度研究，给出结构化综述、关键观点和结论。"
    default_instruction = "优先覆盖核心论点、证据链、来源分歧与结论边界。"
    config_schema = build_agent_config_schema(default_task_prompt, default_instruction)
    output_capabilities = ["preview", "compact", "research"]
