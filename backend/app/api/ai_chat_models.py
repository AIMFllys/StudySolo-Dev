"""AI chat model catalog routes — Track A (curated chat panel).

Serves the fixed 8-model list for the Chat sidebar panel.
Decoupled from the workflow catalog (/api/ai/models/catalog).
Source of truth: config.yaml → chat_models block.
"""

import logging

from fastapi import APIRouter, Depends

from app.core.config_loader import get_config
from app.core.deps import get_current_user
from app.services.ai_catalog_service import get_sku_by_id

logger = logging.getLogger(__name__)
router = APIRouter(tags=["ai-chat-models"])

# Vendor brand colors exposed to the frontend
_VENDOR_BRAND_COLORS: dict[str, str] = {
    "deepseek": "#4D6BFE",
    "qwen": "#F97316",
    "zhipu": "#2563EB",
    "doubao": "#3370FF",
    "moonshot": "#111827",
    "openai_oss": "#10B981",
}

# Short descriptions per chat model key
_MODEL_DESCRIPTIONS: dict[str, str] = {
    "deepseek_r1": "强悍推理，思维链透明可见",
    "qwen35_flash": "极速响应，日常对话首选",
    "qwen3_max": "通义千问旗舰，智能体编程专项",
    "glm45": "GLM 轻量快速，免费畅用",
    "glm47": "智谱旗舰，Agentic Engineering 推荐",
    "doubao_seed": "豆包 Seed 旗舰，Seeds of Insight",
    "kimi_k2": "月之暗面推理模型，深度思考模式",
    "gpt_oss_120b": "GPT 开源量化旗舰，120B 参数",
}


@router.get("/chat/models")
async def get_chat_models(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Return the curated chat panel model list with tier access info."""
    config = get_config()
    chat_models_cfg: list[dict] = config.get("chat_models", [])
    user_tier = current_user.get("tier", "free")

    tier_order: dict[str, int] = {"free": 0, "pro": 1, "pro_plus": 2, "ultra": 3}
    user_tier_level = tier_order.get(user_tier, 0)

    models = []
    for entry in sorted(chat_models_cfg, key=lambda x: x.get("sort_order", 99)):
        key = entry.get("key", "")
        required_tier = entry.get("required_tier", "free")
        required_level = tier_order.get(required_tier, 0)
        sku_ids: list[str] = entry.get("sku_ids", [])
        is_recommended = entry.get("is_recommended", False)

        # Determine vendor from the primary SKU
        vendor = "deepseek"
        primary_sku = None
        if sku_ids:
            try:
                primary_sku = await get_sku_by_id(sku_ids[0])
                vendor = primary_sku.vendor if primary_sku else "deepseek"
            except Exception:
                pass

        models.append({
            "key": key,
            "displayName": entry.get("display_name", key),
            "requiredTier": required_tier,
            "sortOrder": entry.get("sort_order", 99),
            "brandColor": _VENDOR_BRAND_COLORS.get(vendor, "#4B5563"),
            "description": _MODEL_DESCRIPTIONS.get(key, ""),
            "hasFallback": len(sku_ids) > 1,
            "isRecommended": is_recommended,
            "isPremium": required_tier != "free",
            "isAccessible": user_tier_level >= required_level,
            "skuId": sku_ids[0] if sku_ids else None,
        })

    return {"models": models}
