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
    created_at: datetime


class InteractionToggleResponse(BaseModel):
    """Response for like/favorite toggle."""
    toggled: bool
    count: int
