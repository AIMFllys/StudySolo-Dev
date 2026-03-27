"""Node manifest API — /api/nodes/*

Provides the frontend with metadata about all registered node types.
The frontend reads this to populate the node palette and choose renderers,
eliminating the need to hardcode node types on the client side.

Also provides dynamic config options endpoints for fields that require
runtime data (e.g. a user's document list for knowledge_base filtering).
"""

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.core.database import get_db
from app.nodes._base import BaseNode

router = APIRouter()


@router.get("/manifest")
async def get_node_manifest():
    """Return metadata for all registered node types.

    Response format:
    [
        {
            "type": "flashcard",
            "category": "generation",
            "description": "根据知识点生成问答闪卡",
            "is_llm_node": true,
            "output_format": "json",
            "icon": "🃏",
            "color": "#f59e0b",
            "config_schema": [],
            "output_capabilities": ["preview", "compact"],
            "supports_upload": false,
            "supports_preview": true,
            "deprecated_surface": null
        },
        ...
    ]
    """
    return BaseNode.get_manifest()


@router.get("/config-options/{node_type}/{field_key}")
async def get_config_field_options(
    node_type: str,
    field_key: str,
    current_user: dict = Depends(get_current_user),
):
    """Return dynamic options for a node config field.

    Used by the frontend NodeConfigDrawer for multi_select fields
    that need runtime data (e.g. user's document list).

    Currently supported:
    - knowledge_base / document_ids: returns the user's document list
    """
    user_id = current_user.get("id") or current_user.get("user_id")
    if not user_id:
        return {"options": []}

    if node_type == "knowledge_base" and field_key == "document_ids":
        return await _get_kb_document_options(user_id)

    return {"options": []}


async def _get_kb_document_options(user_id: str) -> dict:
    """Return the user's knowledge base documents as select options."""
    try:
        db = await get_db()
        response = await (
            db.from_("ss_kb_documents")
            .select("id, filename, status")
            .eq("user_id", user_id)
            .eq("status", "ready")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        docs = response.data or []
        options = [
            {
                "label": doc.get("filename", doc["id"]),
                "value": doc["id"],
            }
            for doc in docs
        ]
        return {"options": options}
    except Exception:
        return {"options": []}
