"""Pydantic validation models for quiz_gen output.

Ensures LLM-generated quiz questions conform to the expected schema.
Invalid questions are repaired or filtered out gracefully.
"""

import logging
from typing import Any

from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)


class QuizQuestion(BaseModel):
    """Schema for a single quiz question."""

    type: str = Field(
        default="choice",
        description="Question type: choice | true_false | fill_blank"
    )
    question: str = Field(
        default="",
        description="The question text"
    )
    options: list[str] = Field(
        default_factory=list,
        description="Answer options (for choice type)"
    )
    answer: str = Field(
        default="",
        description="The correct answer"
    )
    explanation: str = Field(
        default="",
        description="Explanation of the correct answer"
    )
    difficulty: str = Field(
        default="medium",
        description="Difficulty level: easy | medium | hard"
    )
    source_concept: str = Field(
        default="",
        description="The source concept this question tests"
    )

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        valid_types = {"choice", "true_false", "fill_blank"}
        if v not in valid_types:
            return "choice"  # Default to choice
        return v

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, v: str) -> str:
        valid_levels = {"easy", "medium", "hard"}
        if v not in valid_levels:
            return "medium"  # Default to medium
        return v

    @field_validator("options")
    @classmethod
    def validate_options(cls, v: list[str], info) -> list[str]:
        # Options are only required for choice type
        return v


def validate_quiz_output(raw_questions: list[Any]) -> list[dict]:
    """Validate and repair a list of quiz questions.

    Returns a list of validated question dicts.
    Invalid questions are logged and skipped.
    """
    validated: list[dict] = []

    for i, q in enumerate(raw_questions):
        if not isinstance(q, dict):
            logger.warning("Question %d is not a dict, skipping", i)
            continue

        try:
            question = QuizQuestion(**q)

            # Extra validation: choice type should have options
            if question.type == "choice" and len(question.options) < 2:
                logger.warning("Choice question %d has insufficient options", i)
                continue

            # Extra validation: question text must not be empty
            if not question.question.strip():
                logger.warning("Question %d has empty text, skipping", i)
                continue

            validated.append(question.model_dump())

        except Exception as e:
            logger.warning("Question %d validation failed: %s", i, e)
            continue

    if not validated:
        raise ValueError("No valid quiz questions could be extracted")

    return validated
