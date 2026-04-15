import asyncio

from src.core.agent import VisualSiteAgent


def create_agent() -> VisualSiteAgent:
    return VisualSiteAgent(agent_name="visual-site")


def test_extract_page_topic_removes_trailing_de():
    agent = create_agent()

    topic = agent._extract_page_topic("请帮我做一个展示学习报告的网页")

    assert topic == "学习报告"


def test_extract_page_topic_for_teaching_page():
    agent = create_agent()

    topic = agent._extract_page_topic("生成一个介绍二叉树知识点的教学页面")

    assert topic == "二叉树知识点"


def test_extract_page_topic_for_summary_page():
    agent = create_agent()

    topic = agent._extract_page_topic("我想做一个展示课程总结的单页网站")

    assert topic == "课程总结"


def test_detect_page_type_for_report_page():
    agent = create_agent()

    page_type = agent._detect_page_type("请帮我做一个展示学习报告的网页")

    assert page_type == "report_page"


def test_detect_page_type_for_teaching_page():
    agent = create_agent()

    page_type = agent._detect_page_type("生成一个介绍二叉树知识点的教学页面")

    assert page_type == "teaching_page"


def test_detect_page_type_for_summary_page():
    agent = create_agent()

    page_type = agent._detect_page_type("我想做一个展示课程总结的单页网站")

    assert page_type == "summary_page"


def test_detect_style_direction_defaults_to_clean_for_report_page():
    agent = create_agent()

    style = agent._detect_style_direction("请帮我做一个展示学习报告的网页", "report_page")

    assert style == "clean"


def test_detect_style_direction_defaults_to_academic_for_teaching_page():
    agent = create_agent()

    style = agent._detect_style_direction("生成一个介绍二叉树知识点的教学页面", "teaching_page")

    assert style == "academic"


def test_build_response_contains_visual_site_sections():
    agent = create_agent()

    content = asyncio.run(agent._build_response("请帮我做一个展示学习报告的网页"))

    assert "Page Summary" in content
    assert "Page Structure" in content
    assert "Design Notes" in content
    assert "Starter HTML" in content
    assert "- Topic: 学习报告" in content


def test_understand_request_builds_structured_page_understanding():
    agent = create_agent()

    understanding = asyncio.run(agent._understand_request("生成一个介绍二叉树知识点的教学页面"))

    assert understanding.page_topic == "二叉树知识点"
    assert understanding.page_type == "teaching_page"
    assert understanding.style_direction == "academic"
    assert "帮助读者快速理解" in understanding.page_goal
