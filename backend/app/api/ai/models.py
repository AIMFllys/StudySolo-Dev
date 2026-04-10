"""AI chat model catalog routes — relocated from api/ai_chat_models.py.

Track A (curated chat panel): serves the fixed model list for the Chat sidebar.
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
    "openai": "#10B981",
}

# Short descriptions per chat model key
_MODEL_DESCRIPTIONS: dict[str, str] = {
    "deepseek_r1": "强化学习驱动的推理模型，思维链透明可见",
    "qwen35_flash": "MoE 极速响应，多模态理解，日常对话首选",
    "qwen3_max": "通义千问万亿参数旗舰，编程与复杂推理顶尖",
    "glm45": "MoE 高效架构，32B 激活参数，免费畅用",
    "glm47": "Agentic Coding 标杆，200K 上下文，工具协同领先",
    "doubao_seed": "字节旗舰，多模态理解与长链路推理成本最优",
    "kimi_k2": "万亿参数 MoE，128K 上下文，Agent 深度推理",
    "gpt_oss_120b": "GPT 开源量化旗舰，120B 参数通用能力",
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

        # Vendor & capability resolution via primary SKU
        vendor = entry.get("vendor", "")
        supports_thinking = False
        primary_sku = None
        if sku_ids:
            try:
                primary_sku = await get_sku_by_id(sku_ids[0])
                if primary_sku:
                    if not vendor:
                        vendor = primary_sku.vendor
                    supports_thinking = primary_sku.supports_thinking
            except Exception as exc:
                logger.warning(
                    "[chat_models] SKU lookup failed for sku_id=%s key=%s: %s",
                    sku_ids[0], key, exc,
                )
        vendor = vendor or "deepseek"

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
            "supportsThinking": supports_thinking,
        })

    return {"models": models}
