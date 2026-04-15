from dataclasses import dataclass
from math import ceil


def estimate_tokens(text: str) -> int:
    return max(1, ceil(len(text.strip()) / 4)) if text.strip() else 0


def iter_text_chunks(text: str, chunk_size: int = 48) -> list[str]:
    if not text:
        return []
    return [text[index:index + chunk_size] for index in range(0, len(text), chunk_size)]


GENERIC_PAGE_TOPIC_FALLBACK = "页面主题待确认"


@dataclass(slots=True)
class CompletionResult:
    content: str
    prompt_tokens: int
    completion_tokens: int

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


@dataclass(slots=True)
class PageUnderstanding:
    page_topic: str
    page_goal: str
    page_type: str
    style_direction: str


@dataclass(slots=True)
class PagePlan:
    page_topic: str
    page_goal: str
    hero: str
    main_sections: str
    supporting_elements: str
    visual_direction: str
    layout_advice: str
    interaction_hint: str
    starter_html: str
