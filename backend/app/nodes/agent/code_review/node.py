"""Agent node for code review tasks."""

from app.nodes.agent.base import BaseAgentNode, build_agent_config_schema


class AgentCodeReviewNode(BaseAgentNode):
    _abstract = False
    node_type = "agent_code_review"
    agent_name = "code-review"
    display_name = "代码审查 Agent"
    description = "调用代码审查子后端，完成补丁评估、问题定位与审查结论整理。"
    icon = "🧪"
    color = "#0f766e"
    version = "1.0.0"
    changelog = {"1.0.0": "初始版本"}
    default_task_prompt = "请对输入代码、补丁或方案进行严格代码审查，优先指出高风险问题与修复建议。"
    default_instruction = "优先输出高风险问题、影响范围、复现条件和可操作的修复建议。"
    config_schema = build_agent_config_schema(default_task_prompt, default_instruction)
    output_capabilities = ["preview", "compact", "review"]
