// ─── 功能拓展系统类型定义 ─────────────────────────────────────────────────────
// 与 backend/app/models/extensions.py 的 Pydantic 模型完全对齐

/** 订阅等级（与后端 tier_required 字段一致） */
export type ExtensionTier = 'free' | 'pro' | 'max';

/** 拓展注册表中的官方拓展信息 */
export interface ExtensionInfo {
  id: string;
  name: string;
  description: string;
  /** Lucide 图标名称（如 'FileText', 'GraduationCap'） */
  icon: string;
  version: string;
  tier_required: ExtensionTier;
  is_active: boolean;
  display_order: number;
}

/** 用户已安装的拓展记录 */
export interface UserExtension {
  extension_id: string;
  is_pinned: boolean;
  /** Activity Bar 中的位置序号（越小越靠前） */
  pin_order: number;
  installed_at: string; // ISO 8601
}

/** 联合视图：用户已安装记录 + 拓展详情 */
export interface UserExtensionDetail extends UserExtension {
  extension: ExtensionInfo;
}

/** PATCH /api/extensions/{id}/pin 请求体 */
export interface PinRequest {
  is_pinned: boolean;
  pin_order?: number;
}

/** 安装/卸载操作的响应体 */
export interface ExtensionActionResponse {
  success: boolean;
  message: string;
}

// ─── MVP Mock 数据类型（Phase 1 使用，Phase 2 替换为真实 API） ────────────────

/** 本地 Mock 用的扩展内置面板信息 */
export interface BuiltinPanelEntry {
  /** 对应 SidebarPanel 的值 */
  panelId: string;
  name: string;
  description: string;
  icon: string;
}
