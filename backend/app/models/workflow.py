from datetime import datetime
from pydantic import BaseModel


class WorkflowCreate(BaseModel):
    name: str
    description: str | None = None


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    nodes_json: list[dict] | None = None
    edges_json: list[dict] | None = None
    status: str | None = None


class WorkflowMeta(BaseModel):
    id: str
    name: str
    description: str | None
    status: str
    created_at: datetime
    updated_at: datetime


class WorkflowContent(BaseModel):
    id: str
    name: str
    description: str | None
    nodes_json: list[dict]
    edges_json: list[dict]
    status: str
    created_at: datetime
    updated_at: datetime
