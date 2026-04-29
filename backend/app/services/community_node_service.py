"""Community node write operations — create, update, delete, like/unlike."""

from __future__ import annotations

import logging

from fastapi import HTTPException, status
from supabase import AsyncClient

from app.models.community_nodes import CommunityNodeCreate, CommunityNodeMine
from app.services.community_node_queries import (
    MINE_COLS,
    load_liked_ids,  # noqa: F401 — re-exported for test compatibility
    serialize_mine,
    # Re-export query functions so existing imports from this module still work
    list_public_nodes as list_public_nodes,
    list_my_nodes as list_my_nodes,
    get_my_node as get_my_node,
    get_public_node as get_public_node,
    get_node_with_prompt as get_node_with_prompt,
    # Re-export serializers for test compatibility
    serialize_public as _serialize_public,  # noqa: F401
    serialize_mine as _serialize_mine,  # noqa: F401
)

logger = logging.getLogger(__name__)


async def create_node(
    db: AsyncClient,
    *,
    author_id: str,
    payload: CommunityNodeCreate,
    knowledge_file_path: str | None = None,
    knowledge_file_name: str | None = None,
    knowledge_file_size: int = 0,
    knowledge_text: str | None = None,
) -> CommunityNodeMine:
    insert_payload = {
        "author_id": author_id,
        "name": payload.name,
        "description": payload.description,
        "icon": payload.icon,
        "category": payload.category,
        "prompt": payload.prompt,
        "input_hint": payload.input_hint,
        "output_format": payload.output_format,
        "output_schema": payload.output_schema,
        "model_preference": payload.model_preference,
        "status": "approved",
        "is_public": True,
        "knowledge_file_path": knowledge_file_path,
        "knowledge_file_name": knowledge_file_name,
        "knowledge_file_size": knowledge_file_size,
        "knowledge_text": knowledge_text,
    }
    result = await db.from_("ss_community_nodes").insert(insert_payload).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="发布社区节点失败")
    return serialize_mine(result.data[0], author_name="我", is_liked=False)


async def update_node(
    db: AsyncClient, *, node_id: str, author_id: str, updates: dict,
) -> CommunityNodeMine:
    result = (
        await db.from_("ss_community_nodes").update(updates)
        .eq("id", node_id).eq("author_id", author_id).execute()
    )
    if result.data is not None and len(result.data) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="社区节点不存在或无权修改")
    fetch = (
        await db.from_("ss_community_nodes").select(MINE_COLS)
        .eq("id", node_id).eq("author_id", author_id).maybe_single().execute()
    )
    if not fetch.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="社区节点不存在或无权修改")
    return serialize_mine(fetch.data, author_name="我", is_liked=False)


async def delete_node(db: AsyncClient, *, node_id: str, author_id: str) -> None:
    existing = (
        await db.from_("ss_community_nodes").select("knowledge_file_path")
        .eq("id", node_id).eq("author_id", author_id).maybe_single().execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="社区节点不存在或无权删除")

    result = (
        await db.from_("ss_community_nodes").delete()
        .eq("id", node_id).eq("author_id", author_id).execute()
    )
    if result.data is not None and len(result.data) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="社区节点不存在或无权删除")

    knowledge_file_path = existing.data.get("knowledge_file_path")
    if knowledge_file_path:
        try:
            await db.storage.from_("community-node-files").remove([knowledge_file_path])
        except Exception as exc:
            logger.warning("Failed to remove knowledge file for node %s: %s", node_id, exc)


async def like_node(db: AsyncClient, *, node_id: str, user_id: str) -> int:
    exists = (
        await db.from_("ss_community_node_likes").select("node_id")
        .eq("node_id", node_id).eq("user_id", user_id).maybe_single().execute()
    )
    if not exists.data:
        await db.from_("ss_community_node_likes").insert({"node_id": node_id, "user_id": user_id}).execute()
    row = (
        await db.from_("ss_community_nodes").select("likes_count")
        .eq("id", node_id).maybe_single().execute()
    )
    if not row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="社区节点不存在")
    return int(row.data.get("likes_count") or 0)


async def unlike_node(db: AsyncClient, *, node_id: str, user_id: str) -> int:
    await (
        db.from_("ss_community_node_likes").delete()
        .eq("node_id", node_id).eq("user_id", user_id).execute()
    )
    row = (
        await db.from_("ss_community_nodes").select("likes_count")
        .eq("id", node_id).maybe_single().execute()
    )
    if not row.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="社区节点不存在")
    return int(row.data.get("likes_count") or 0)
