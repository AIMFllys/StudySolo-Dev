import re

from src.core.types import GENERIC_PAGE_TOPIC_FALLBACK, PageUnderstanding


class VisualSiteUnderstanding:
    def understand(self, latest_user_message: str) -> PageUnderstanding:
        page_topic = self.extract_page_topic(latest_user_message)
        page_type = self.detect_page_type(latest_user_message)
        style_direction = self.detect_style_direction(latest_user_message, page_type)
        page_goal = self.build_page_goal(latest_user_message, page_topic, page_type)
        return PageUnderstanding(
            page_topic=page_topic,
            page_goal=page_goal,
            page_type=page_type,
            style_direction=style_direction,
        )

    def extract_page_topic(self, latest_user_message: str) -> str:
        text = " ".join(latest_user_message.split()).strip()
        if not text:
            return GENERIC_PAGE_TOPIC_FALLBACK

        cleaned = re.sub(
            r"^(?:帮我做一个|帮我做个|帮我设计一个|帮我设计个|生成一个|生成个|做一个|做个|我想做一个|我想做个)",
            "",
            text,
        ).strip()
        cleaned = re.sub(r"(?:网页|页面|网站|单页网站)$", "", cleaned).strip()

        patterns = (
            r"(?:展示|介绍|讲解|说明|呈现)(?P<topic>[^，。！？?！]+)",
            r"(?P<topic>[^，。！？?！]+?)(?:的网页|的页面|的网站)$",
        )
        for pattern in patterns:
            match = re.search(pattern, cleaned)
            if not match:
                continue
            topic = match.group("topic").strip()
            topic = re.sub(r"(?:一个|一种)$", "", topic).strip()
            topic = re.sub(r"(?:的教学|的介绍|的展示|的总结)$", "", topic).strip()
            topic = re.sub(r"的$", "", topic).strip()
            if topic:
                return topic

        cleaned = re.sub(r"(?:网页|页面|网站|单页网站)", "", cleaned).strip("，。！？?!. ")
        cleaned = re.sub(r"(?:的教学|的介绍|的展示|的总结)$", "", cleaned).strip()
        cleaned = re.sub(r"的$", "", cleaned).strip()
        return cleaned or GENERIC_PAGE_TOPIC_FALLBACK

    def detect_page_type(self, latest_user_message: str) -> str:
        text = latest_user_message
        if any(keyword in text for keyword in ("教学", "讲解", "知识点", "介绍", "解释")):
            return "teaching_page"
        if any(keyword in text for keyword in ("总结", "复习", "梳理")):
            return "summary_page"
        if any(keyword in text for keyword in ("展示", "汇报", "报告", "成果")):
            return "report_page"
        if any(keyword in text for keyword in ("宣传", "作品", "落地页")):
            return "landing_page"
        return "report_page"

    def detect_style_direction(self, latest_user_message: str, page_type: str) -> str:
        text = latest_user_message
        if "学术" in text:
            return "academic"
        if any(keyword in text for keyword in ("展示感", "强视觉", "作品感")):
            return "showcase"
        if any(keyword in text for keyword in ("轻松", "友好", "活泼")):
            return "friendly"
        if "简洁" in text:
            return "clean"

        defaults = {
            "report_page": "clean",
            "teaching_page": "academic",
            "summary_page": "clean",
            "landing_page": "showcase",
        }
        return defaults.get(page_type, "clean")

    def build_page_goal(self, latest_user_message: str, topic: str, page_type: str) -> str:
        text = latest_user_message
        if topic == GENERIC_PAGE_TOPIC_FALLBACK:
            return "先确认这次页面到底要展示什么内容，再决定结构和风格方向。"
        if page_type == "teaching_page":
            return f"帮助读者快速理解 {topic} 的核心概念和结构。"
        if page_type == "summary_page":
            return f"梳理 {topic} 的重点内容并方便快速回顾。"
        if page_type == "landing_page":
            return f"突出展示 {topic} 的亮点，让页面更有吸引力和记忆点。"
        if any(keyword in text for keyword in ("报告", "成果", "展示", "汇报")):
            return f"清晰展示 {topic} 的核心信息、成果或阶段总结。"
        return f"让用户快速了解 {topic} 的主要内容和展示重点。"
