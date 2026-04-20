"""Node category definitions."""

from enum import Enum


class NodeCategory(str, Enum):
    """Logical grouping for node types — maps to subdirectory names."""
    input = "input"
    analysis = "analysis"
    generation = "generation"
    interaction = "interaction"
    output = "output"
    structure = "structure"
    community = "community"
    agent = "agent"
