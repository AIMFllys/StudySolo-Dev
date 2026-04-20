"""Agent node for visual site and HTML drafting tasks."""

from app.nodes.agent.base import BaseAgentNode, build_agent_config_schema


class AgentVisualSiteNode(BaseAgentNode):
    _abstract = False
    node_type = "agent_visual_site"
    agent_name = "visual-site"
    display_name = "可视化站点 Agent"
    description = "调用可视化站点子后端，完成页面结构设计、区块草案与 HTML 起稿。"
    icon = "🧱"
    color = "#be123c"
    version = "1.0.0"
    changelog = {"1.0.0": "初始版本"}
    default_task_prompt = "请根据当前需求输出页面结构方案、关键区块描述或 HTML 草案。"
    default_instruction = "优先保证结构清晰、信息层级明确，并说明关键布局决策。"
    config_schema = build_agent_config_schema(default_task_prompt, default_instruction)
    output_capabilities = ["preview", "compact", "html"]
