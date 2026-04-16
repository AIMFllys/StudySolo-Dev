"""Agent node for time-sensitive news tasks."""

from app.nodes.agent.base import BaseAgentNode, build_agent_config_schema


class AgentNewsNode(BaseAgentNode):
    _abstract = False
    node_type = "agent_news"
    agent_name = "news"
    display_name = "新闻追踪 Agent"
    description = "调用新闻子后端，完成时效话题追踪、摘要整理与最新进展分析。"
    icon = "📰"
    color = "#b45309"
    version = "1.0.0"
    changelog = {"1.0.0": "初始版本"}
    default_task_prompt = "请围绕当前主题追踪最新新闻、事件进展和关键变化，并整理时间线。"
    default_instruction = "优先突出时间、来源、事件影响和仍未确认的信息。"
    config_schema = build_agent_config_schema(default_task_prompt, default_instruction)
    output_capabilities = ["preview", "compact", "citations"]
