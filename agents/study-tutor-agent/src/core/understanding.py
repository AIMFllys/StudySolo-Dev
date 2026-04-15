import re

from src.core.types import GENERIC_TOPIC_FALLBACK, UnderstandingResult


REQUEST_PREFIXES = (
    "请帮我",
    "帮我",
    "请你",
    "请",
    "我想",
    "我正在",
)

TOPIC_CAPTURE_PATTERNS = (
    r"(?:什么是|关于|有关|学习|复习|理解|掌握|讲解|解释|说明|介绍)(?P<topic>[^，。！？?！]+)",
    r"(?:不会|不懂|搞不懂|弄不清|学不会)(?P<topic>[^，。！？?！]+)",
)

TOPIC_PREFIX_PATTERNS = (
    r"^(?:解释一下什么是|解释一下|解释|说明一下什么是|说明一下|说明|介绍一下|介绍|学习|复习)",
    r"^(?:帮我学习|帮我复习|帮我理解|帮我讲解|想学|想复习|想理解)",
    r"^(?:我不会|我不懂|我总是搞不懂|我搞不懂|我弄不清|我学不会)",
)

TOPIC_SUFFIX_PATTERNS = (
    r"(?:应该怎么学|该怎么学|怎么学|怎么复习|怎么理解|可以吗)[?？]?$",
    r"(?:这一块|这个知识点|这个内容)[?？]?$",
    r"(?:有哪些重点|需要注意什么|总是记不住|总是分不清)[?？]?$",
    r"(?:是什么东西|是什么|指什么)[?？]?$",
)

TOPIC_NOISE_PATTERNS = (
    r"^(?:一下|一下子|这个|这个叫做|这个是|一下这个)",
    r"(?:的定义|的概念|的内容|的重点|的基础)$",
)

GENERIC_REQUEST_PHRASES = {
    "帮帮我",
    "帮我",
    "请帮我",
    "请你帮我",
    "救救我",
    "我不会了",
}


class StudyRequestUnderstanding:
    def understand(self, latest_user_message: str) -> UnderstandingResult:
        topic = self.extract_topic(latest_user_message)
        related_topics = self.extract_related_topics(latest_user_message, topic)
        user_intent = self.detect_user_intent(latest_user_message)
        difficulty_state = self.detect_difficulty_state(latest_user_message, user_intent)
        focus = self.build_focus(topic, related_topics, user_intent, difficulty_state)
        return UnderstandingResult(
            primary_topic=topic,
            related_topics=related_topics,
            user_intent=user_intent,
            difficulty_state=difficulty_state,
            focus=focus,
        )

    def extract_topic(self, latest_user_message: str) -> str:
        text = latest_user_message.strip()
        if not text:
            return GENERIC_TOPIC_FALLBACK

        cleaned = self.normalize_request_text(text)

        extracted_from_pattern = self.extract_topic_from_patterns(cleaned)
        if extracted_from_pattern:
            cleaned = extracted_from_pattern

        cleaned = self.remove_request_shell(cleaned)
        cleaned = self.normalize_topic_text(cleaned)

        if cleaned in GENERIC_REQUEST_PHRASES:
            return GENERIC_TOPIC_FALLBACK
        if not cleaned:
            return GENERIC_TOPIC_FALLBACK

        return cleaned[:80]

    def detect_user_intent(self, latest_user_message: str) -> str:
        text = self.normalize_request_text(latest_user_message)

        if any(keyword in text for keyword in ("总是搞不懂", "分不清", "容易混淆", "老是错", "总出错")):
            return "clarify_confusion"
        if any(keyword in text for keyword in ("不太清楚", "不太理解", "有点模糊", "还是模糊", "有点绕", "脑子里还是糊的", "脑子还是糊的")):
            return "clarify_confusion"
        if any(keyword in text for keyword in ("不会", "不懂", "弄不清", "学不会", "看不懂")):
            return "clarify_confusion"
        if any(keyword in text for keyword in ("怎么学", "如何学", "怎么复习", "学习计划", "复习计划")):
            return "learn_path"
        if any(keyword in text for keyword in ("复习", "回顾", "考前")):
            return "review"
        if any(keyword in text for keyword in ("解释", "什么是", "介绍", "说明", "讲解")):
            return "explain"
        return "explain"

    def detect_difficulty_state(self, latest_user_message: str, user_intent: str) -> str:
        text = self.normalize_request_text(latest_user_message)

        if any(keyword in text for keyword in ("总是搞不懂", "分不清", "容易混淆", "不太清楚", "不太理解", "有点模糊", "有点绕", "脑子里还是糊的", "脑子还是糊的")):
            return "confused"
        if any(keyword in text for keyword in ("不会", "不懂", "弄不清", "学不会", "看不懂")):
            return "confused"
        if user_intent == "review":
            return "reviewing"
        if user_intent in {"learn_path", "explain"}:
            return "beginner"
        return "unknown"

    def build_focus(
        self,
        topic: str,
        related_topics: tuple[str, ...],
        user_intent: str,
        difficulty_state: str,
    ) -> str:
        topic_phrase = topic if topic != GENERIC_TOPIC_FALLBACK else "当前学习主题"
        related_phrase = "、".join(related_topics)

        if GENERIC_TOPIC_FALLBACK == topic:
            return "先帮你确认当前真正要学的主题，再决定应该优先理解概念、补基础还是安排练习。"
        if related_topics and user_intent == "clarify_confusion":
            return (
                f"先帮你理清 {topic_phrase} 的核心逻辑，再把它和 {related_phrase} 的关系、区别或容易串掉的地方拆开。"
            )
        if user_intent == "clarify_confusion" and difficulty_state == "confused":
            return f"先帮你澄清 {topic_phrase} 的核心概念和容易混淆的地方，再用简单例子把理解慢慢拉直。"
        if user_intent == "review":
            return f"先帮你快速回顾 {topic_phrase} 的核心框架，再抓住最容易考、也最容易忘的关键点。"
        if user_intent == "learn_path":
            return f"先帮你明确 {topic_phrase} 的学习顺序、先学什么后学什么，以及最值得优先练的内容。"
        if user_intent == "explain" and difficulty_state == "beginner":
            return f"先帮你建立对 {topic_phrase} 的基础概念理解，再过渡到关键点和简单应用。"
        return f"先帮你快速建立 {topic_phrase} 的基础理解，再给出下一步学习建议和练习方向。"

    def normalize_request_text(self, text: str) -> str:
        return " ".join(text.split()).strip()

    def extract_related_topics(
        self,
        latest_user_message: str,
        primary_topic: str,
    ) -> tuple[str, ...]:
        if primary_topic == GENERIC_TOPIC_FALLBACK:
            return ()

        text = self.normalize_request_text(latest_user_message)
        candidates: list[str] = []
        patterns = (
            r"(?:和|跟|与)(?P<topic>[^，。！？?！]+?)(?:一样|类似|差不多)",
            r"(?:和|跟|与)(?P<topic>[^，。！？?！]+?)(?:对比|比较|放在一起看)",
        )
        for pattern in patterns:
            for match in re.finditer(pattern, text):
                candidate = self.normalize_topic_text(match.group("topic"))
                candidate = re.sub(r"(?:一样|类似|差不多)$", "", candidate).strip()
                candidate = re.sub(r"(?:对比|比较|放在一起看)$", "", candidate).strip()
                if (
                    candidate
                    and candidate != primary_topic
                    and candidate != GENERIC_TOPIC_FALLBACK
                    and candidate not in candidates
                ):
                    candidates.append(candidate)
        return tuple(candidates[:3])

    def extract_topic_from_patterns(self, text: str) -> str | None:
        for pattern in TOPIC_CAPTURE_PATTERNS:
            match = re.search(pattern, text)
            if not match:
                continue
            topic = match.group("topic").strip()
            topic = self.normalize_topic_text(topic)
            if topic:
                return topic
        return None

    def remove_request_shell(self, text: str) -> str:
        cleaned = text
        for prefix in REQUEST_PREFIXES:
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()

        for pattern in TOPIC_PREFIX_PATTERNS:
            cleaned = re.sub(pattern, "", cleaned).strip()

        for pattern in TOPIC_SUFFIX_PATTERNS:
            cleaned = re.sub(pattern, "", cleaned).strip()

        return cleaned

    def normalize_topic_text(self, text: str) -> str:
        cleaned = text.strip("，。！？?!. ")
        for pattern in TOPIC_NOISE_PATTERNS:
            cleaned = re.sub(pattern, "", cleaned).strip()

        cleaned = re.sub(
            r"^(?:什么是|关于|有关|请解释一下|请解释|解释一下|解释|请说明一下|请说明|说明一下|说明|请介绍一下|请介绍|介绍一下|介绍)",
            "",
            cleaned,
        ).strip()
        cleaned = re.sub(r"^(?:最近我学|最近在学|我最近在学|我最近学|我学|我在学)", "", cleaned).strip()
        cleaned = re.sub(
            r"^(?:我不太清楚|我不太理解|我对|我还是不太懂|我还是搞不懂|我还是不清楚)",
            "",
            cleaned,
        ).strip()
        cleaned = re.sub(r"^(?:这个|这个知识点|这部分|这一块)", "", cleaned).strip()
        cleaned = re.sub(r"(?:我不太清楚|我不太理解|还是有点模糊|有点模糊)$", "", cleaned).strip()
        cleaned = re.sub(r"(?:的时候.*)$", "", cleaned).strip()
        cleaned = re.sub(r"(?:，?和[^，。！？?！]+一样.*)$", "", cleaned).strip()

        for separator in ("，", "。", "？", "?", "!", "！", "；", ";"):
            if separator in cleaned:
                cleaned = cleaned.split(separator, 1)[0].strip()

        return re.sub(r"\s+", " ", cleaned).strip()
