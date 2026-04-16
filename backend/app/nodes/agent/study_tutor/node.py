"""Agent node for tutoring and study guidance tasks."""

from app.nodes.agent.base import BaseAgentNode, build_agent_config_schema


class AgentStudyTutorNode(BaseAgentNode):
    _abstract = False
    node_type = "agent_study_tutor"
    agent_name = "study-tutor"
    display_name = "学习辅导 Agent"
    description = "调用学习辅导子后端，完成讲解、因材施教答疑与学习方案建议。"
    icon = "🎓"
    color = "#7c3aed"
    version = "1.0.0"
    changelog = {"1.0.0": "初始版本"}
    default_task_prompt = "请作为学习导师解释当前主题，并给出循序渐进的学习建议。"
    default_instruction = "优先保证讲解清晰、示例具体，并给出下一步学习路径。"
    config_schema = build_agent_config_schema(default_task_prompt, default_instruction)
    output_capabilities = ["preview", "compact", "guidance"]
