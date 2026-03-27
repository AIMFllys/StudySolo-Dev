"""Pydantic models for workflow CRUD & social features."""

from datetime import datetime
from pydantic import BaseModel, Field


class WorkflowCreate(BaseModel):
    name: str
    description: str | None = None


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    nodes_json: list[dict] | None = None
    edges_json: list[dict] | None = None
    annotations_json: list[dict] | None = None
    status: str | None = None
    tags: list[str] | None = None
    is_public: bool | None = None


class WorkflowExecuteRequest(BaseModel):
    nodes_json: list[dict] | None = None
    edges_json: list[dict] | None = None


# Fields computed/injected at runtime — NOT stored in the ss_workflows table.
# Must be excluded when generating Supabase select columns via WorkflowMeta.select_cols().
_WF_META_VIRTUAL_FIELDS: frozenset[str] = frozenset({"owner_name", "is_liked", "is_favorited"})


class WorkflowMeta(BaseModel):
    """Metadata returned in list endpoints."""
    id: str
    name: str
    description: str | None = None
    status: str
    tags: list[str] = Field(default_factory=list)
    is_public: bool = False
    is_featured: bool = False
    is_official: bool = False
    likes_count: int = 0
    favorites_count: int = 0
    owner_name: str | None = None
    is_liked: bool = False
    is_favorited: bool = False
    created_at: datetime
    updated_at: datetime

    @classmethod
    def select_cols(cls) -> str:
        """Return a comma-separated Supabase select string from model fields.

        Excludes virtual fields that are computed/injected at runtime, not
        stored in the database. Using this as the single source of truth
        prevents field-drift bugs (e.g., forgetting to add 'status').

        Example usage::

            query = db.from_("ss_workflows").select(WorkflowMeta.select_cols())
        """
        return ",".join(
            f for f in cls.model_fields if f not in _WF_META_VIRTUAL_FIELDS
        )


class WorkflowContent(BaseModel):
    """Full content for canvas editing."""
    id: str
    name: str
    description: str | None = None
    nodes_json: list[dict]
    edges_json: list[dict]
    annotations_json: list[dict] = Field(default_factory=list)
    status: str
    tags: list[str] = Field(default_factory=list)
    is_public: bool = False
    created_at: datetime
    updated_at: datetime


class WorkflowPublicView(BaseModel):
    """Public-facing read-only view."""
    id: str
    name: str
    description: str | None = None
    nodes_json: list[dict]
    edges_json: list[dict]
    tags: list[str] = Field(default_factory=list)
    is_featured: bool = False
    is_official: bool = False
    likes_count: int = 0
    favorites_count: int = 0
    owner_name: str | None = None
    is_liked: bool = False
    is_favorited: bool = False
    is_owner: bool = False
    created_at: datetime


class InteractionToggleResponse(BaseModel):
    """Response for like/favorite toggle."""
    toggled: bool
    count: int
