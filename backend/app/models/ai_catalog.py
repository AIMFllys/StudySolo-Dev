from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


TierType = Literal["free", "pro", "pro_plus", "ultra"]
BillingChannel = Literal["native", "proxy", "tool_service"]
RoutingPolicy = Literal["native_first", "proxy_first", "capability_fixed"]


class CatalogSku(BaseModel):
    sku_id: str
    family_id: str
    family_name: str
    provider: str
    vendor: str
    model_id: str
    display_name: str
    billing_channel: BillingChannel
    task_family: str
    routing_policy: RoutingPolicy
    required_tier: TierType = "free"
    is_enabled: bool = True
    is_visible: bool = True
    is_user_selectable: bool = True
    is_fallback_only: bool = False
    supports_thinking: bool = False
    max_context_tokens: int | None = None
    input_price_cny_per_million: float = 0.0
    output_price_cny_per_million: float = 0.0
    price_source: str | None = None
    pricing_verified_at: datetime | None = None
    sort_order: int = 0


class UserCatalogResponse(BaseModel):
    items: list[CatalogSku] = Field(default_factory=list)


class AdminCatalogResponse(BaseModel):
    items: list[CatalogSku] = Field(default_factory=list)


class AdminCatalogUpdateRequest(BaseModel):
    display_name: str | None = None
    required_tier: TierType | None = None
    is_enabled: bool | None = None
    is_visible: bool | None = None
    is_user_selectable: bool | None = None
    is_fallback_only: bool | None = None
    price_source: str | None = None
    input_price_cny_per_million: float | None = None
    output_price_cny_per_million: float | None = None
    sort_order: int | None = None


class AdminCatalogUpdateResponse(BaseModel):
    success: bool
    sku_id: str
