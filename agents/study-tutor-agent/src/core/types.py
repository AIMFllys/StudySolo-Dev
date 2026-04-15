from dataclasses import dataclass
from math import ceil


def estimate_tokens(text: str) -> int:
    return max(1, ceil(len(text.strip()) / 4)) if text.strip() else 0


def iter_text_chunks(text: str, chunk_size: int = 48) -> list[str]:
    if not text:
        return []
    return [text[index:index + chunk_size] for index in range(0, len(text), chunk_size)]


GENERIC_TOPIC_FALLBACK = "学习主题待确认"


@dataclass(slots=True)
class CompletionResult:
    content: str
    prompt_tokens: int
    completion_tokens: int

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


@dataclass(slots=True)
class UnderstandingResult:
    primary_topic: str
    related_topics: tuple[str, ...]
    user_intent: str
    difficulty_state: str
    focus: str

    @property
    def topic(self) -> str:
        return self.primary_topic


@dataclass(slots=True)
class TutorPlan:
    topic: str
    focus: str
    definition: str
    core_idea: str
    common_confusion: str
    first_step: str
    next_step: str
    checkpoint: str
    practice_basic: str
    practice_understanding: str
    practice_application: str


@dataclass(frozen=True, slots=True)
class KnowledgeCard:
    aliases: tuple[str, ...]
    definition: str
    core_idea: str
    common_confusion: str
    first_step: str
    next_step: str
    checkpoint: str
    practice_basic: str
    practice_understanding: str
    practice_application: str
