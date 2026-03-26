from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config_loader import get_config
from app.core.database import get_db
from app.models.ai_catalog import CatalogSku, TierType

UTC = timezone.utc
_CATALOG_TTL = timedelta(minutes=5)


@dataclass(slots=True)
class TaskRoute:
    routing_policy: str
    sku_ids: list[str]


_catalog_cache: list[CatalogSku] | None = None
_catalog_cache_expires_at: datetime | None = None


def _utcnow() -> datetime:
    return datetime.now(UTC)


def normalize_provider_key(provider: str | None) -> str:
    raw = (provider or "").strip()
    if not raw:
        return ""
    aliases = get_config().get("compatibility", {}).get("provider_aliases", {})
    return str(aliases.get(raw, raw))


def _tier_rank(tier: TierType | None) -> int:
    order: dict[TierType, int] = {
        "free": 0,
        "pro": 1,
        "pro_plus": 2,
        "ultra": 3,
    }
    return order.get(tier or "free", 0)


def is_tier_allowed(user_tier: TierType | None, required_tier: TierType | None) -> bool:
    return _tier_rank(user_tier) >= _tier_rank(required_tier)


async def _load_catalog_rows() -> list[CatalogSku]:
    global _catalog_cache, _catalog_cache_expires_at
    now = _utcnow()
    if _catalog_cache is not None and _catalog_cache_expires_at and _catalog_cache_expires_at > now:
        return _catalog_cache

    db = await get_db()
    family_result = (
        await db.table("ai_model_families")
        .select("id, vendor, family_name, task_family, routing_policy, description, is_enabled")
        .execute()
    )
    families = {
        str(row["id"]): row
        for row in (family_result.data or [])
    }
    sku_result = (
        await db.table("ai_model_skus")
        .select(
            "id, family_id, provider, model_id, display_name, billing_channel, required_tier, "
            "is_enabled, is_visible, is_user_selectable, is_fallback_only, supports_thinking, "
            "max_context_tokens, input_price_cny_per_million, output_price_cny_per_million, "
            "price_source, pricing_verified_at, sort_order"
        )
        .order("sort_order", desc=False)
        .execute()
    )
    rows: list[CatalogSku] = []
    for row in sku_result.data or []:
        family = families.get(str(row["family_id"]))
        if not family:
            continue
        rows.append(
            CatalogSku(
                sku_id=str(row["id"]),
                family_id=str(row["family_id"]),
                family_name=str(family["family_name"]),
                provider=normalize_provider_key(row.get("provider")),
                vendor=str(family["vendor"]),
                model_id=str(row["model_id"]),
                display_name=str(row["display_name"]),
                billing_channel=str(row["billing_channel"]),
                task_family=str(family["task_family"]),
                routing_policy=str(family["routing_policy"]),
                required_tier=str(row.get("required_tier") or "free"),
                is_enabled=bool(row.get("is_enabled", True)) and bool(family.get("is_enabled", True)),
                is_visible=bool(row.get("is_visible", True)),
                is_user_selectable=bool(row.get("is_user_selectable", True)),
                is_fallback_only=bool(row.get("is_fallback_only", False)),
                supports_thinking=bool(row.get("supports_thinking", False)),
                max_context_tokens=int(row["max_context_tokens"]) if row.get("max_context_tokens") is not None else None,
                input_price_cny_per_million=float(row.get("input_price_cny_per_million") or 0.0),
                output_price_cny_per_million=float(row.get("output_price_cny_per_million") or 0.0),
                price_source=row.get("price_source"),
                pricing_verified_at=datetime.fromisoformat(str(row["pricing_verified_at"]).replace("Z", "+00:00"))
                if row.get("pricing_verified_at")
                else None,
                sort_order=int(row.get("sort_order") or 0),
            )
        )

    _catalog_cache = rows
    _catalog_cache_expires_at = now + _CATALOG_TTL
    return rows


async def refresh_catalog_cache() -> list[CatalogSku]:
    global _catalog_cache, _catalog_cache_expires_at
    _catalog_cache = None
    _catalog_cache_expires_at = None
    return await _load_catalog_rows()


async def list_catalog_items(
    *,
    include_hidden: bool = False,
    include_disabled: bool = False,
    include_non_selectable: bool = False,
    tier: TierType | None = None,
) -> list[CatalogSku]:
    rows = await _load_catalog_rows()
    visible_rows: list[CatalogSku] = []
    user_rank = _tier_rank(tier)
    for item in rows:
        if not include_disabled and not item.is_enabled:
            continue
        if not include_hidden and not item.is_visible:
            continue
        if not include_non_selectable and not item.is_user_selectable:
            continue
        if user_rank < _tier_rank(item.required_tier):
            continue
        visible_rows.append(item)
    return visible_rows


async def get_sku_by_id(sku_id: str) -> CatalogSku | None:
    rows = await _load_catalog_rows()
    return next((row for row in rows if row.sku_id == sku_id), None)


async def get_sku_by_provider_model(provider: str, model_id: str) -> CatalogSku | None:
    normalized_provider = normalize_provider_key(provider)
    rows = await _load_catalog_rows()
    return next(
        (
            row
            for row in rows
            if row.provider == normalized_provider and row.model_id == model_id
        ),
        None,
    )


async def resolve_selected_sku(
    *,
    selected_model_key: str | None = None,
    selected_platform: str | None = None,
    selected_model: str | None = None,
) -> CatalogSku | None:
    if selected_model_key:
        return await get_sku_by_id(selected_model_key)
    if selected_platform and selected_model:
        return await get_sku_by_provider_model(selected_platform, selected_model)
    return None


def get_task_route(task_name: str) -> TaskRoute:
    config = get_config()
    task_route = config.get("task_routes", {}).get(task_name)
    if not task_route:
        raise KeyError(f"Unknown task route: {task_name}")
    return TaskRoute(
        routing_policy=str(task_route["routing_policy"]),
        sku_ids=[str(item) for item in task_route.get("sku_ids", [])],
    )


async def resolve_task_route_skus(task_name: str) -> list[CatalogSku]:
    route = get_task_route(task_name)
    rows = await _load_catalog_rows()
    row_map = {row.sku_id: row for row in rows}
    return [row_map[sku_id] for sku_id in route.sku_ids if sku_id in row_map and row_map[sku_id].is_enabled]


async def update_catalog_sku(sku_id: str, payload: dict[str, Any]) -> None:
    db = await get_db()
    await db.table("ai_model_skus").update(payload).eq("id", sku_id).execute()
    await refresh_catalog_cache()
