from dataclasses import dataclass
from math import ceil


def estimate_tokens(text: str) -> int:
    return max(1, ceil(len(text.strip()) / 4)) if text.strip() else 0


def iter_text_chunks(text: str, chunk_size: int = 48) -> list[str]:
    if not text:
        return []
    return [text[index:index + chunk_size] for index in range(0, len(text), chunk_size)]


@dataclass(slots=True)
class CompletionResult:
    content: str
    prompt_tokens: int
    completion_tokens: int

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


class DeepResearchAgent:
    def __init__(self, agent_name: str) -> None:
        self.agent_name = agent_name

    async def complete(self, messages: list[dict[str, str]]) -> CompletionResult:
        prompt_text = "\n".join(message.get("content", "") for message in messages)
        latest_user_message = self._latest_user_message(messages)
        content = self._build_response(messages, latest_user_message)
        return CompletionResult(
            content=content,
            prompt_tokens=estimate_tokens(prompt_text),
            completion_tokens=estimate_tokens(content),
        )

    def stream_chunks(self, content: str) -> list[str]:
        return iter_text_chunks(content)

    def _latest_user_message(self, messages: list[dict[str, str]]) -> str:
        for message in reversed(messages):
            if message.get("role") == "user":
                return " ".join(message.get("content", "").split())
        return ""

    def _build_response(self, messages: list[dict[str, str]], latest_user_message: str) -> str:
        preview = latest_user_message[:180] if latest_user_message else "No user content provided."
        return (
            "## Research Summary\n\n"
            f"- Agent: {self.agent_name}\n"
            f"- Messages received: {len(messages)}\n"
            f"- Research topic: {preview}\n\n"
            "## Next Actions\n\n"
            "1. Clarify objective and success criteria.\n"
            "2. Collect primary sources and categorize claims.\n"
            "3. Cross-check sources and provide confidence notes."
        )
