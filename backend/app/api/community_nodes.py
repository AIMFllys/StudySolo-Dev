"""Community shared node routes."""

from __future__ import annotations

import json
import re
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from supabase import AsyncClient

from app.core.deps import get_current_user, get_optional_user, get_supabase_client
from app.models.community_nodes import (
    CommunityNodeCreate,
    CommunityNodeListResponse,
    CommunityNodeMine,
    CommunityNodePublic,
    CommunityNodeUpdate,
    SchemaGenRequest,
    SchemaGenResponse,
)
from app.models.workflow import InteractionToggleResponse
from app.services.llm.router import call_llm_direct
from app.services.community_node_service import (
    create_node,
    delete_node,
    get_my_node,
    get_public_node,
    like_node,
    list_my_nodes,
    list_public_nodes,
    unlike_node,
    update_node,
)
from app.services.file_parser import parse_file

router = APIRouter()

MAX_KNOWLEDGE_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_KNOWLEDGE_EXTENSIONS = {"pdf", "docx", "md", "txt"}
# Using DB-backed rate limit via auth_rate_limit_events table
# Rate limits for AI-powered schema generation
SCHEMA_GEN_RATE_LIMIT = 20
SCHEMA_GEN_WINDOW_SECONDS = 3600

SCHEMA_GEN_SYSTEM_PROMPT = """你是一个 JSON Schema 生成专家。

用户正在创建一个 AI 节点，需要你根据节点信息生成合适的 JSON Schema。

要求：
1. 输出一个标准的 JSON Schema（draft-07 风格即可）
2. 包含 type、properties、required 字段
3. 每个 property 都要有 type 和 description
4. 同时生成一个符合 Schema 的 example
5. 只输出 JSON，不要额外解释

输出格式：
{
  "schema": { ... },
  "example": { ... }
}"""


def _parse_json_text(value: str | None, *, field_name: str) -> dict | None:
    if value is None:
        return None
    text = value.strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} 不是合法 JSON：{exc.msg}",
        ) from exc
    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_name} 必须是 JSON 对象",
        )
    return parsed


async def _enforce_schema_rate_limit(db: AsyncClient, user_id: str) -> None:
    from app.api.auth._helpers import is_rate_limited, record_rate_limit_failure

    bucket = f"schema_gen:{user_id}"
    event_type = "ai_generation"

    if await is_rate_limited(db, bucket, event_type, SCHEMA_GEN_RATE_LIMIT, SCHEMA_GEN_WINDOW_SECONDS):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Schema 生成请求过于频繁，请一小时后再试",
        )

    await record_rate_limit_failure(db, bucket, event_type, SCHEMA_GEN_WINDOW_SECONDS)


async def _maybe_store_knowledge_file(
    *,
    db: AsyncClient,
    user_id: str,
    knowledge_file: UploadFile | None,
) -> tuple[str | None, str | None, int, str | None]:
    if knowledge_file is None or not knowledge_file.filename:
        return None, None, 0, None

    ext = knowledge_file.filename.rsplit(".", 1)[-1].lower() if "." in knowledge_file.filename else ""
    if ext not in ALLOWED_KNOWLEDGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"知识文件格式不支持 .{ext}，仅支持 {', '.join(sorted(ALLOWED_KNOWLEDGE_EXTENSIONS))}",
        )

    content = await knowledge_file.read()
    if len(content) > MAX_KNOWLEDGE_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="知识文件大小不能超过 10MB",
        )

    parsed = parse_file(knowledge_file.filename, content)
    knowledge_text = parsed.full_text.strip()[:8000] or None
    storage_path = f"{user_id}/{uuid.uuid4()}.{ext}"
    await db.storage.from_("community-node-files").upload(
        path=storage_path,
        file=content,
        file_options={"content-type": knowledge_file.content_type or "application/octet-stream"},
    )
    return storage_path, knowledge_file.filename, len(content), knowledge_text


# Next.js dev rewrites can normalize a trailing slash away before proxying.
# Keep both root variants stable so authenticated requests do not fall through
# to a 404 when the browser ultimately sends /api/community-nodes.
@router.get("", response_model=CommunityNodeListResponse, include_in_schema=False)
@router.get("/", response_model=CommunityNodeListResponse)
async def get_public_nodes(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=20),
    sort: str = Query("likes", pattern="^(likes|newest)$"),
    category: str | None = Query(None),
    search: str | None = Query(None, max_length=100),
    db: AsyncClient = Depends(get_supabase_client),
    current_user: dict | None = Depends(get_optional_user),
) -> CommunityNodeListResponse:
    return await list_public_nodes(
        db,
        page=page,
        per_page=per_page,
        sort=sort,
        category=category,
        search=search,
        current_user_id=current_user["id"] if current_user else None,
    )


@router.get("/mine", response_model=list[CommunityNodeMine])
async def get_my_nodes(
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
) -> list[CommunityNodeMine]:
    return await list_my_nodes(db, user_id=current_user["id"])


@router.get("/mine/{node_id}", response_model=CommunityNodeMine)
async def get_my_node_detail(
    node_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
) -> CommunityNodeMine:
    return await get_my_node(
        db,
        node_id=node_id,
        user_id=current_user["id"],
    )


@router.get("/{node_id}", response_model=CommunityNodePublic)
async def get_node_detail(
    node_id: str,
    db: AsyncClient = Depends(get_supabase_client),
    current_user: dict | None = Depends(get_optional_user),
) -> CommunityNodePublic:
    return await get_public_node(
        db,
        node_id=node_id,
        current_user_id=current_user["id"] if current_user else None,
    )


@router.post("", response_model=CommunityNodeMine, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=CommunityNodeMine, status_code=status.HTTP_201_CREATED)
async def publish_community_node(
    name: str = Form(...),
    description: str = Form(...),
    icon: str = Form("Bot"),
    category: str = Form("other"),
    prompt: str = Form(...),
    input_hint: str = Form(""),
    output_format: str = Form("markdown"),
    output_schema: str | None = Form(None),
    model_preference: str = Form("auto"),
    knowledge_file: UploadFile | None = File(None),
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
) -> CommunityNodeMine:
    schema = _parse_json_text(output_schema, field_name="output_schema")
    if output_format == "json" and schema is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="JSON 输出格式必须提供 output_schema",
        )

    knowledge_file_path, knowledge_file_name, knowledge_file_size, knowledge_text = (
        await _maybe_store_knowledge_file(
            db=db,
            user_id=current_user["id"],
            knowledge_file=knowledge_file,
        )
    )

    payload = CommunityNodeCreate(
        name=name,
        description=description,
        icon=icon,
        category=category,  # type: ignore[arg-type]
        prompt=prompt,
        input_hint=input_hint,
        output_format=output_format,  # type: ignore[arg-type]
        output_schema=schema,
        model_preference=model_preference,  # type: ignore[arg-type]
    )
    return await create_node(
        db,
        author_id=current_user["id"],
        payload=payload,
        knowledge_file_path=knowledge_file_path,
        knowledge_file_name=knowledge_file_name,
        knowledge_file_size=knowledge_file_size,
        knowledge_text=knowledge_text,
    )


@router.put("/{node_id}", response_model=CommunityNodeMine)
async def update_community_node(
    node_id: str,
    body: CommunityNodeUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
) -> CommunityNodeMine:
    updates = body.model_dump(exclude_none=True)
    if body.output_format == "json" and "output_schema" not in updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="JSON 输出格式必须提供 output_schema",
        )
    return await update_node(
        db,
        node_id=node_id,
        author_id=current_user["id"],
        updates=updates,
    )


@router.delete("/{node_id}")
async def delete_community_node(
    node_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
) -> dict:
    await delete_node(db, node_id=node_id, author_id=current_user["id"])
    return {"success": True}


@router.post("/{node_id}/like", response_model=InteractionToggleResponse)
async def add_like(
    node_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
) -> InteractionToggleResponse:
    count = await like_node(db, node_id=node_id, user_id=current_user["id"])
    return InteractionToggleResponse(toggled=True, count=count)


@router.delete("/{node_id}/like", response_model=InteractionToggleResponse)
async def remove_like(
    node_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
) -> InteractionToggleResponse:
    count = await unlike_node(db, node_id=node_id, user_id=current_user["id"])
    return InteractionToggleResponse(toggled=False, count=count)


@router.post("/generate-schema", response_model=SchemaGenResponse)
async def generate_schema(
    body: SchemaGenRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
) -> SchemaGenResponse:
    await _enforce_schema_rate_limit(db, current_user["id"])
    user_message = (
        f"节点名称：{body.name}\n"
        f"节点描述：{body.description}\n"
        f"提示词摘要：{body.prompt_snippet[:500]}\n\n"
        "请输出 schema 和 example。"
    )
    content = await call_llm_direct(
        "dashscope",
        "qwen-turbo-latest",
        [
            {"role": "system", "content": SCHEMA_GEN_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        stream=False,
    )
    cleaned = str(content).strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```\\w*\\n?", "", cleaned)
        cleaned = re.sub(r"\\n?```$", "", cleaned)
        cleaned = cleaned.strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI 生成的 Schema 格式异常：{exc.msg}",
        ) from exc
    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI 生成的 Schema 不是对象结构",
        )
    schema = parsed.get("schema") if isinstance(parsed.get("schema"), dict) else {}
    example = parsed.get("example") if isinstance(parsed.get("example"), dict) else {}
    return SchemaGenResponse(schema_=schema, example=example)
