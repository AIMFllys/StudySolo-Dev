import asyncio

from src.core.agent import StudyTutorAgent
from src.core.types import GENERIC_TOPIC_FALLBACK


def create_agent() -> StudyTutorAgent:
    return StudyTutorAgent(agent_name="study-tutor")


def test_extract_topic_from_explanation_prompt():
    agent = create_agent()

    topic = agent._extract_topic("解释一下什么是二叉树")

    assert topic == "二叉树"


def test_extract_topic_from_what_is_prompt_for_unknown_topic():
    agent = create_agent()

    topic = agent._extract_topic("解释一下什么是哈夫曼森林")

    assert topic == "哈夫曼森林"


def test_extract_topic_from_colloquial_what_is_prompt():
    agent = create_agent()

    topic = agent._extract_topic("哈夫曼森林是什么东西")

    assert topic == "哈夫曼森林"


def test_extract_topic_from_confusion_prompt():
    agent = create_agent()

    topic = agent._extract_topic("我总是搞不懂前序遍历和中序遍历")

    assert topic == "前序遍历和中序遍历"


def test_extract_topic_from_soft_confusion_prompt():
    agent = create_agent()

    topic = agent._extract_topic("我不太清楚格雷码")

    assert topic == "格雷码"


def test_extract_topic_falls_back_when_request_is_too_generic():
    agent = create_agent()

    topic = agent._extract_topic("帮帮我")

    assert topic == GENERIC_TOPIC_FALLBACK


def test_focus_prioritizes_confusion_resolution():
    agent = create_agent()

    understanding = asyncio.run(agent._understand_request("我总是搞不懂前序遍历和中序遍历"))

    assert understanding.topic == "前序遍历和中序遍历"
    assert understanding.user_intent == "clarify_confusion"
    assert understanding.difficulty_state == "confused"
    assert "容易混淆" in understanding.focus


def test_focus_prioritizes_review_when_user_wants_review():
    agent = create_agent()

    understanding = asyncio.run(agent._understand_request("请帮我复习牛顿第二定律"))

    assert understanding.topic == "牛顿第二定律"
    assert understanding.user_intent == "review"
    assert understanding.difficulty_state == "reviewing"
    assert "快速回顾" in understanding.focus
    assert "容易考" in understanding.focus


def test_understanding_result_for_soft_confusion_prompt():
    agent = create_agent()

    understanding = asyncio.run(agent._understand_request("我不太清楚格雷码"))

    assert understanding.topic == "格雷码"
    assert understanding.user_intent == "clarify_confusion"
    assert understanding.difficulty_state == "confused"
    assert "核心概念" in understanding.focus


def test_understanding_splits_primary_and_related_topics():
    agent = create_agent()

    understanding = asyncio.run(
        agent._understand_request("最近我学时序电路的时候总觉得它有点绕，和汉明码一样，我现在脑子里还是糊的")
    )

    assert understanding.primary_topic == "时序电路"
    assert understanding.related_topics == ("汉明码",)
    assert understanding.user_intent == "clarify_confusion"
    assert "时序电路" in understanding.focus
    assert "汉明码" in understanding.focus


def test_build_tutor_plan_uses_knowledge_card_for_gray_code():
    agent = create_agent()

    plan = asyncio.run(agent._build_tutor_plan("我不太清楚格雷码"))

    assert plan.topic == "格雷码"
    assert "相邻编码只相差 1 位" in plan.definition
    assert "普通二进制" in plan.common_confusion
    assert "状态切换" in plan.practice_understanding


def test_build_tutor_plan_falls_back_to_generic_template_for_unknown_topic():
    agent = create_agent()

    plan = asyncio.run(agent._build_tutor_plan("解释一下什么是哈夫曼森林"))

    assert plan.topic == "哈夫曼森林"
    assert "定义、作用和一个直观例子" in plan.definition
    assert "机械记忆结论" in plan.core_idea


def test_build_tutor_plan_for_unknown_review_topic_uses_review_flavored_guidance():
    agent = create_agent()

    plan = asyncio.run(agent._build_tutor_plan("请帮我复习一下哈夫曼森林"))

    assert plan.topic == "哈夫曼森林"
    assert "重新梳理" in plan.definition
    assert "核心框架" in plan.core_idea
    assert "快速列出" in plan.first_step


def test_build_tutor_plan_for_unknown_confused_topic_uses_clarify_guidance():
    agent = create_agent()

    plan = asyncio.run(agent._build_tutor_plan("我不太清楚哈夫曼森林"))

    assert plan.topic == "哈夫曼森林"
    assert "理解还不够稳" in plan.definition
    assert "真正卡住的核心概念" in plan.core_idea
    assert "关键区别" in plan.practice_understanding


def test_build_tutor_plan_mentions_related_topics_in_confusion_guidance():
    agent = create_agent()

    plan = asyncio.run(
        agent._build_tutor_plan("最近我学时序电路的时候总觉得它有点绕，和汉明码一样，我现在脑子里还是糊的")
    )

    assert plan.topic == "时序电路"
    assert "汉明码" in plan.focus
    assert "不要把 时序电路 和 汉明码 混成一团" in plan.common_confusion
    assert "时序电路 和 汉明码" in plan.practice_understanding
