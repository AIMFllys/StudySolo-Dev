"""Admin AI catalog management routes."""

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from supabase._async.client import AsyncClient

from app.core.database import get_db
from app.models.ai_catalog import (
    AdminCatalogResponse,
    AdminCatalogUpdateRequest,
    AdminCatalogUpdateResponse,
)
from app.services.ai_catalog_service import list_catalog_items, update_catalog_sku
from app.services.audit_logger import get_client_info, queue_audit_log

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin-models"])


@router.get("/models/catalog", response_model=AdminCatalogResponse)
async def get_admin_model_catalog() -> AdminCatalogResponse:
    items = await list_catalog_items(
        include_hidden=True,
        include_disabled=True,
        include_non_selectable=True,
        tier="ultra",
    )
    return AdminCatalogResponse(items=items)


@router.put("/models/{sku_id}", response_model=AdminCatalogUpdateResponse)
async def update_admin_model_catalog_item(
    sku_id: str,
    body: AdminCatalogUpdateRequest,
    request: Request,
    db: AsyncClient = Depends(get_db),
) -> AdminCatalogUpdateResponse:
    admin_id: str | None = getattr(request.state, "admin_id", None)
    ip_address, user_agent = get_client_info(request)

    payload: dict[str, Any] = body.model_dump(exclude_none=True)
    if "pricing_verified_at" not in payload:
        payload["pricing_verified_at"] = datetime.now(timezone.utc).isoformat()

    try:
        await update_catalog_sku(sku_id, payload)
    except Exception as exc:
        logger.exception("Catalog update failed for %s: %s", sku_id, exc)
        raise HTTPException(status_code=500, detail="更新模型目录失败")

    queue_audit_log(
        db,
        admin_id=admin_id,
        action="model_catalog_update",
        target_type="ai_model_sku",
        target_id=sku_id,
        details={"sku_id": sku_id, "changes": payload},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    return AdminCatalogUpdateResponse(success=True, sku_id=sku_id)
