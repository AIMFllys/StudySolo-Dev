# [基本完成] 功能拓展 + 侧边栏 Pin 系统 — 深度规划（v2）

> 最后更新：2026-03-27
> 编码要求：UTF-8 (无BOM) + LF
> 状态：**[基本完成] 深度分析完成，架构决策锁定，主体方案已收敛**

---

## 0. 名词统一

| 旧名词 | 新名词 | 英文标识 |
|--------|--------|---------|
| 插件商店 | 功能拓展 | Extensions |
| 安装 / 已安装 | 固定 / 取消固定 | Pin / Unpin |
| 插件 | 拓展 | Extension |

前端所有 `plugins` → `extensions`，数据库新表用 `extensions` 前缀。

---

## 1. 核心产品逻辑

### 1.1 概念

- **功能拓展**（Extensions）：官方开发的独立功能模块（文档预览、Anki 导出等）
- 用户可以将某个拓展**固定 (Pin)** 到左侧 Activity Bar，获得一级入口
- 未固定的拓展统一收纳在"功能拓展"面板的列表中
- 部分核心面板**不可移动**（永远在 Activity Bar）

### 1.2 不可移动项（IMMOVABLE）

以下面板始终固定在 Activity Bar，用户不可 pin/unpin：

| 面板 | SidebarPanel 值 | 位置区域 | 原因 |
|------|----------------|----------|------|
| 用户头像 | `user-panel` | 顶部 | 全局身份入口 |
| AI 对话 | `ai-chat` | 上区 | 核心交互入口 |
| 节点商店 | `node-store` | 上区 | 工作流核心入口 |
| 执行面板 | `execution` | 条件显示 | 运行时必需（Docked 时才渲染） |
| 功能拓展 | `extensions` | 上区底部 | 自身不可移走 |

### 1.3 可移动项（PINNABLE）— 区域决策：统一上移（VSCode 策略）

> 🏛️ **架构决策（已锁定）**：采用 VSCode 风格的 Activity Bar 布局。
>
> **原则**：所有用户可配置的 Pinnable 面板，Pin 后统一聚合在上区中（`user-panel` 和 `ai-chat` 之后）。底部绝对区域（Bottom Zone）**仅保留不受任何 pin 逻辑影响的全局工具**（升级会员、使用手册、退出登录）。
>
> **原因**：
> 1. 原先 `wallet`、`settings` 硬编码在 `LOWER_PANELS`，一旦引入 `pinnedPanels.map()` 覆盖，不做区域过滤会导致它们在下移后重新 Pin 时出现在错误的中间区域。
> 2. VSCode 风格的上区动态增减（个性化）+ 底部固定工具（不变），是用户最熟悉的 IDE 心智模型。
> 3. 实现最简：`UPPER_PINNABLES` 数组动态过滤 `pinnedPanels`，底部区域不参与动态逻辑。

以下面板默认 Pin 在 Activity Bar 上区，但用户可以 Unpin 到功能拓展面板：

| 面板 | SidebarPanel 值 | 默认状态 | 默认渲染位置 |
|------|----------------|---------|----|
| 工作流列表 | `workflows` | Pinned | 上区 |
| 工作流样例 | `workflow-examples` | Pinned | 上区 |
| 仪表盘 | `dashboard` | Pinned | 上区 |
| 钱包设置 | `wallet` | Pinned | 上区（迁移自 LOWER_PANELS） |
| 设置 | `settings` | Pinned | 上区（迁移自 LOWER_PANELS） |

> ⚠️ **迁移说明**：`wallet` 和 `settings` 从原 `LOWER_PANELS` 迁移到 `pinnedPanels` 动态系统管理。底部工具区域（`BOTTOM_ABSOLUTE` 区）的按钮保持不变（升级、手册、退出），仅通过 `renderActivityButton` 直接渲染，不参与 pin 逻辑。

### 1.4 官方拓展（通过功能拓展面板安装/Pin 到侧边栏）

首批官方拓展（P1 阶段）：

| 拓展 ID | 名称 | 图标 (lucide) | 描述 | Tier |
|---------|------|-------------|------|------|
| `doc_preview` | 文档预览 | `FileText` | 浏览器内预览 Word/PDF | free |
| `anki_export` | Anki 导出 | `GraduationCap` | 闪卡导出为 .apkg | pro |
| `study_report` | 学习报表 | `BarChart3` | 工作流历史可视化 | pro |

后续扩展（P2）：Notion 同步、Zotero 导入、知识图谱……

---

## 2. 数据库设计

### 2.1 用户 Activity Bar PIN 配置

**方案：扩展现有 `use-panel-store`（Zustand persist → localStorage）**

- PIN 配置是纯 UI 偏好，存 `localStorage` 即可（与现有 `use-panel-store` 的 `persist` 机制一致）
- `pinnedPanels: SidebarPanel[]` 持久化在 `studysolo-panel-layout` key 中
- 未来如需跨设备同步，可加列到 `ss_user_preferences`，MVP 不需要

> ⚠️ **Persist 兼容性风险**（已锁定方案）：
>
> 老用户 localStorage 中可能存有 `activeSidebarPanel: 'plugins'` 且无 `pinnedPanels` 字段。
> **解决方案**：使用 Zustand persist 的 `migrate` 函数进行版本号控制的状态迁移：
> ```typescript
> migrate: (persistedState: unknown, version: number) => {
>   const state = persistedState as Partial<PanelState>;
>   // v0 → v1: 'plugins' 重命名为 'extensions'
>   if (version < 1) {
>     if (state.activeSidebarPanel === 'plugins') {
>       state.activeSidebarPanel = 'extensions';
>     }
>     // 为老用户注入默认 pinnedPanels
>     if (!state.pinnedPanels) {
>       state.pinnedPanels = DEFAULT_PINNED_PANELS;
>     }
>   }
>   return state as PanelState;
> },
> version: 1,
> ```

### 2.2 官方拓展注册表（新表）

```sql
-- supabase/migrations/20260327_add_extensions.sql

-- ① 拓展注册表（官方维护，不由用户创建）
CREATE TABLE IF NOT EXISTS ss_extensions (
    id              TEXT PRIMARY KEY,              -- 'doc_preview', 'anki_export'
    name            TEXT NOT NULL,                 -- '文档预览'
    description     TEXT NOT NULL DEFAULT '',
    icon            TEXT NOT NULL DEFAULT 'Puzzle', -- lucide icon 名
    version         TEXT NOT NULL DEFAULT '1.0.0',
    tier_required   TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'max'
    is_active       BOOLEAN NOT NULL DEFAULT true, -- 官方可以下架
    display_order   INTEGER NOT NULL DEFAULT 0,    -- 排序权重
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ② 用户拓展安装记录
CREATE TABLE IF NOT EXISTS ss_user_extensions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    extension_id    TEXT NOT NULL REFERENCES ss_extensions(id) ON DELETE CASCADE,
    is_pinned       BOOLEAN NOT NULL DEFAULT false, -- true = 固定到 Activity Bar
    pin_order       INTEGER NOT NULL DEFAULT 99,     -- 在 Activity Bar 中的位置
    installed_at    TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ss_user_extensions_unique UNIQUE (user_id, extension_id)
);

-- ③ 索引
CREATE INDEX IF NOT EXISTS ss_user_extensions_user_idx ON ss_user_extensions(user_id);

-- ④ RLS
ALTER TABLE ss_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_user_extensions ENABLE ROW LEVEL SECURITY;

-- 拓展表：所有人都能读（公开目录）
CREATE POLICY "所有人可查看拓展列表"
    ON ss_extensions FOR SELECT USING (true);

-- 用户拓展表：只能操作自己的
CREATE POLICY "用户可查看自己的拓展"
    ON ss_user_extensions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "用户可安装拓展"
    ON ss_user_extensions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可更新自己的拓展"
    ON ss_user_extensions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "用户可卸载拓展"
    ON ss_user_extensions FOR DELETE
    USING (auth.uid() = user_id);
```

### 2.3 初始数据（Seed）

> ⚠️ **种子策略（已锁定）**：使用 `DO UPDATE` 替代 `DO NOTHING`，确保官方维护的字段在每次迁移运行时强制对齐代码库定义版本（`version`、`description`、`icon` 可随需更新）。仅 `created_at` / `display_order` 不覆盖已有自定义值。

```sql
-- 在同一迁移文件末尾

INSERT INTO ss_extensions (id, name, description, icon, version, tier_required, display_order)
VALUES
  ('doc_preview',  '文档预览', '在浏览器内直接预览 Word/PDF 文件', 'FileText',      '1.0.0', 'free', 1),
  ('anki_export',  'Anki 导出',  '将闪卡导出为 Anki 卡组格式',       'GraduationCap', '0.9.0', 'pro',  2),
  ('study_report', '学习报表', '工作流历史数据可视化分析',          'BarChart3',     '0.5.0', 'pro',  3)
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  version     = EXCLUDED.version,
  updated_at  = NOW();
```

---

## 3. 后端 API

### 3.1 路由文件

```
backend/app/api/extensions.py  ← 新增
backend/app/models/extensions.py ← 新增
backend/app/services/extensions_service.py ← 新增（业务层）
```

### 3.2 API 端点

| Method | Path | 功能 | 鉴权 |
|--------|------|------|------|
| `GET` | `/api/extensions/` | 获取所有拓展列表（公开） | ✅ |
| `GET` | `/api/extensions/installed` | 获取当前用户已安装拓展 | ✅ |
| `POST` | `/api/extensions/{id}/install` | 安装拓展（含 Tier 校验） | ✅ 🔒 |
| `DELETE` | `/api/extensions/{id}/uninstall` | 卸载拓展 | ✅ |
| `PATCH` | `/api/extensions/{id}/pin` | 固定/取消固定到侧边栏 | ✅ |

### 3.3 API 注册

```python
# backend/app/api/router.py 新增：
from app.api.extensions import router as extensions_router
router.include_router(extensions_router, prefix="/extensions", tags=["extensions"])
```

### 3.4 Pydantic 模型

```python
# backend/app/models/extensions.py

from datetime import datetime
from pydantic import BaseModel


class ExtensionInfo(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    version: str
    tier_required: str  # 'free' | 'pro' | 'max'
    is_active: bool
    display_order: int


class UserExtension(BaseModel):
    extension_id: str
    is_pinned: bool
    pin_order: int
    installed_at: datetime


class UserExtensionDetail(UserExtension):
    """用户已安装拓展 + 拓展详情（联合视图）"""
    extension: ExtensionInfo


class PinRequest(BaseModel):
    is_pinned: bool
    pin_order: int | None = None


class InstallResponse(BaseModel):
    success: bool
    message: str
```

### 3.5 🔒 Tier 安全校验（红线）

> ⚠️ **安全架构决策（已锁定）**：
>
> **不能**仅靠 RLS 或前端按钮屏蔽来防止 free 用户为自己破解安装 pro 级拓展。
> 因为 RLS `WITH CHECK (auth.uid() = user_id)` 只校验用户 ID 匹配，无法校验 tier。
>
> **方案**：在 `extensions_service.py` 的 `install_extension()` 函数中强制获取该用户的 `tier`（从 `auth.users` metadata 或 `ss_user_preferences` 表），与 `ss_extensions.tier_required` 进行比较，不满足则 `raise HTTPException(status_code=403, detail="此拓展需要 Pro 订阅")`。

```python
# backend/app/api/extensions.py（关键路由示例）

@router.post("/{extension_id}/install")
async def install_extension(
    extension_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db),
):
    """安装拓展 — 包含 Tier 硬校验"""
    result = await extensions_service.install(
        db=db,
        user_id=current_user["id"],
        user_tier=current_user.get("tier", "free"),  # 从用户上下文获取
        extension_id=extension_id,
    )
    return result
```

---

## 4. 前端改动明细

### 4.1 名称重构（机械替换 + Persist 版本升级）

| 文件 | 改动 |
|------|------|
| `use-panel-store.ts` | `SidebarPanel` union `'plugins'` → `'extensions'`；`version: 1`；`migrate` 函数 |
| `Sidebar.tsx` | 移除 `UPPER_PANELS`/`LOWER_PANELS` 硬编码；改为动态 `pinnedPanels`；重构 `BOTTOM_ABSOLUTE` |
| `PluginsPanel.tsx` | 文件重命名为 `ExtensionsPanel.tsx` + 完整重写 |
| `Sidebar.tsx` L35 | `import PluginsPanel` → `import ExtensionsPanel` |
| `Sidebar.tsx` L274 | `activeSidebarPanel === 'plugins'` → `'extensions'` |
| `PANEL_LABELS` | `'plugins': '插件'` → `'extensions': '功能拓展'` |

### 4.2 `use-panel-store.ts` — 完整重写方案

```typescript
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarPanel =
  | 'workflows'
  | 'ai-chat'
  | 'node-store'
  | 'workflow-examples'
  | 'dashboard'
  | 'wallet'
  | 'extensions'          // ← 由 'plugins' 改名
  | 'user-panel'
  | 'settings'
  | 'execution';

/** 不可移动的面板（永远显示在 Activity Bar，不参与 pinnedPanels 管理） */
export const IMMOVABLE_PANELS: SidebarPanel[] = [
  'user-panel', 'ai-chat', 'node-store', 'extensions',
];

/**
 * 可被 pin/unpin 的面板集合（含原 LOWER_PANELS 的 wallet/settings）
 * 顺序即 Activity Bar 上的默认排列顺序
 */
export const PINNABLE_PANELS: SidebarPanel[] = [
  'workflows', 'workflow-examples', 'dashboard', 'wallet', 'settings',
];

const DEFAULT_PINNED_PANELS: SidebarPanel[] = [
  'workflows', 'workflow-examples', 'dashboard', 'wallet', 'settings',
];

// ... 尺寸常量（不变）
const LEFT_PANEL_MIN = 200;
const LEFT_PANEL_MAX = 480;
const LEFT_PANEL_DEFAULT = 240;
const RIGHT_PANEL_MIN = 240;
const RIGHT_PANEL_MAX = 520;
const RIGHT_PANEL_DEFAULT = 320;

interface PanelState {
  activeSidebarPanel: SidebarPanel | null;
  leftPanelWidth: number;
  rightPanelWidth: number;
  rightPanelCollapsed: boolean;
  collapsedSections: Record<string, boolean>;
  rightPanelDockedToSidebar: boolean;
  marketplaceVersion: number;

  /** 用户固定在 Activity Bar 的可移动面板（顺序即渲染顺序） */
  pinnedPanels: SidebarPanel[];

  toggleSidebarPanel: (panel: SidebarPanel) => void;
  setActiveSidebarPanel: (panel: SidebarPanel | null) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  toggleRightPanel: () => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  toggleSection: (sectionId: string) => void;
  isSectionCollapsed: (sectionId: string) => boolean;
  toggleRightPanelDock: () => void;
  bumpMarketplaceVersion: () => void;

  /** 将面板固定到 Activity Bar（幂等） */
  pinPanel: (panel: SidebarPanel) => void;
  /**
   * 将面板从 Activity Bar 移除
   * — 若正在查看该面板，自动切换到 'extensions'
   */
  unpinPanel: (panel: SidebarPanel) => void;
}

export const usePanelStore = create<PanelState>()(
  persist(
    (set, get) => ({
      activeSidebarPanel: 'workflows' as SidebarPanel | null,
      leftPanelWidth: LEFT_PANEL_DEFAULT,
      rightPanelWidth: RIGHT_PANEL_DEFAULT,
      rightPanelCollapsed: false,
      collapsedSections: {},
      rightPanelDockedToSidebar: false,
      marketplaceVersion: 0,
      pinnedPanels: DEFAULT_PINNED_PANELS,

      toggleSidebarPanel: (panel) =>
        set((state) => ({
          activeSidebarPanel: state.activeSidebarPanel === panel ? null : panel,
        })),

      setActiveSidebarPanel: (panel) => set({ activeSidebarPanel: panel }),

      setLeftPanelWidth: (width) =>
        set({ leftPanelWidth: Math.min(LEFT_PANEL_MAX, Math.max(LEFT_PANEL_MIN, width)) }),

      setRightPanelWidth: (width) =>
        set({ rightPanelWidth: Math.min(RIGHT_PANEL_MAX, Math.max(RIGHT_PANEL_MIN, width)) }),

      toggleRightPanel: () => set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
      setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),

      toggleSection: (sectionId) =>
        set((state) => ({
          collapsedSections: {
            ...state.collapsedSections,
            [sectionId]: !state.collapsedSections[sectionId],
          },
        })),

      isSectionCollapsed: (sectionId) => !!get().collapsedSections[sectionId],

      toggleRightPanelDock: () =>
        set((state) => {
          const docking = !state.rightPanelDockedToSidebar;
          return {
            rightPanelDockedToSidebar: docking,
            activeSidebarPanel: docking
              ? ('execution' as SidebarPanel)
              : ('node-store' as SidebarPanel),
          };
        }),

      bumpMarketplaceVersion: () =>
        set((state) => ({ marketplaceVersion: state.marketplaceVersion + 1 })),

      pinPanel: (panel) =>
        set((state) => ({
          pinnedPanels: state.pinnedPanels.includes(panel)
            ? state.pinnedPanels
            : [...state.pinnedPanels, panel],
        })),

      unpinPanel: (panel) =>
        set((state) => ({
          pinnedPanels: state.pinnedPanels.filter((p) => p !== panel),
          activeSidebarPanel:
            state.activeSidebarPanel === panel ? 'extensions' : state.activeSidebarPanel,
        })),
    }),
    {
      name: 'studysolo-panel-layout',
      version: 1, // ← 版本号，触发 migrate
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<PanelState>;
        if (version < 1) {
          // 兼容：'plugins' → 'extensions'
          if ((state.activeSidebarPanel as string) === 'plugins') {
            state.activeSidebarPanel = 'extensions';
          }
          // 兼容：注入 pinnedPanels 默认值
          if (!state.pinnedPanels) {
            state.pinnedPanels = [...DEFAULT_PINNED_PANELS];
          }
        }
        return state as PanelState;
      },
      partialize: (state) => ({
        activeSidebarPanel: state.activeSidebarPanel,
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
        rightPanelCollapsed: state.rightPanelCollapsed,
        collapsedSections: state.collapsedSections,
        rightPanelDockedToSidebar: state.rightPanelDockedToSidebar,
        pinnedPanels: state.pinnedPanels, // ← 新增持久化
      }),
    }
  )
);

export { LEFT_PANEL_MIN, LEFT_PANEL_MAX, RIGHT_PANEL_MIN, RIGHT_PANEL_MAX };
```

### 4.3 `Sidebar.tsx` — Activity Bar 重构逻辑

```typescript
// 移除原有的静态 UPPER_PANELS / LOWER_PANELS 数组后，改为：

// ─── 不可移动面板配置（上区固定部分）───
const IMMOVABLE_UPPER_CONFIG: { panel: SidebarPanel; icon: LucideIcon; label: string }[] = [
  { panel: 'ai-chat', icon: MessageSquareCode, label: 'AI 对话' },
  { panel: 'node-store', icon: Store, label: '节点商店' },
];

// ─── Extensions 永远是上区最后一个不可移动项 ───
const EXTENSIONS_CONFIG = { panel: 'extensions' as SidebarPanel, icon: Puzzle, label: '功能拓展' };

// ─── 全部可 Pin 面板的图标字典（供动态渲染查找）───
const PANEL_ICON_MAP: Record<SidebarPanel, { icon: LucideIcon; label: string }> = {
  'workflows':         { icon: LayoutList,    label: '工作流' },
  'workflow-examples': { icon: BookTemplate,  label: '工作流样例' },
  'dashboard':         { icon: LayoutDashboard, label: '仪表盘' },
  'wallet':            { icon: Wallet,        label: '钱包设置' },
  'settings':          { icon: Settings,      label: '设置' },
  'ai-chat':           { icon: MessageSquareCode, label: 'AI 对话' },
  'node-store':        { icon: Store,         label: '节点商店' },
  'extensions':        { icon: Puzzle,        label: '功能拓展' },
  'user-panel':        { icon: UserCircle,    label: '用户面板' },
  'execution':         { icon: PanelRightDashed, label: '执行面板' },
};

// ─── 在组件内部：渲染 Activity Bar ───
// 1. Execution（条件，Docked 时才显示）
// 2. User Panel（永远第一）
// 3. 分隔线
// 4. 不可移动上区：IMMOVABLE_UPPER_CONFIG
// 5. 动态 Pinned 面板（来自 pinnedPanels state）
// 6. 功能拓展（永远在动态区最后）
// 7. Flex-1 Spacer（推开底部）
// 8. BOTTOM_ABSOLUTE：升级会员 + 使用手册 + 退出登录（不参与任何 pin 逻辑）
```

**Activity Bar 渲染示意（组件内逻辑）：**

```tsx
const { pinnedPanels, pinPanel, unpinPanel } = usePanelStore();

// 上区动态 Pinned 面板（排除已被 IMMOVABLE 包含的）
const dynamicPinned = pinnedPanels.filter(
  (p) => !IMMOVABLE_PANELS.includes(p)
);

// Activity Bar 渲染顺序：
// [execution?] [user-panel] [---] [ai-chat] [node-store]
// [dynamicPinned...] [extensions]
// [flex-1]
// [upgrade] [docs] [logout]
```

### 4.4 右键菜单（Activity Bar 图标右键）

> 🚨 **Portal 策略（已锁定）**：
>
> 由于 `Sidebar.tsx` 存在 `overflow-hidden` 的父级，且左右侧边栏切换（`isRight`）会改变边界框，Context Menu 必须使用 **`createPortal(menu, document.body)`** 渲染到 `body` 层级，并监听 `scroll`/`resize` 更新菜单位置。同时必须 **`e.preventDefault(); e.stopPropagation();`** 阻断浏览器原生右键菜单和事件冒泡。

```
新增组件：SidebarActivityContextMenu.tsx

Props:
  anchorRef: RefObject<HTMLButtonElement>
  panel: SidebarPanel
  onClose: () => void
  onUnpin?: () => void  // 仅 PINNABLE_PANELS 中的才传

触发条件：右键 Activity Bar 中 PINNABLE_PANELS 的图标
菜单内容：
  ┌──────────────────────────────┐
  │  📌 取消固定（移至功能拓展列表）  │
  └──────────────────────────────┘

实现方式：
  在 renderActivityButton 中加入 onContextMenu handler
  用 createPortal 渲染到 body
  调用 unpinPanel(panel)
  触发 toast
```

**`SidebarActivityContextMenu.tsx` 关键逻辑：**

```typescript
// 触发位置计算（基于 getBoundingClientRect 而非静态偏移）
function getMenuPosition(anchorRect: DOMRect) {
  return {
    top: anchorRect.bottom + 4,
    left: anchorRect.left,
  };
}

// 全局点击关闭
useEffect(() => {
  const handler = (e: MouseEvent) => {
    if (!menuRef.current?.contains(e.target as Node)) onClose();
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [onClose]);
```

### 4.5 `ExtensionsPanel.tsx`（原 PluginsPanel）重构

```
结构：
  ├── 标题区（"功能拓展 管理区"）
  ├── [Section A] 被 Unpin 的内置面板
  │   └── 各面板卡片：pinPanel(panel) 按钮 → "固定到侧边栏"
  ├── [Section B] 已安装官方拓展
  │   └── 卡片：icon + name + version
  │       └── [固定/取消固定] 按钮（PATCH /api/extensions/{id}/pin）
  └── [Section C] 可安装拓展（未安装）
      └── 卡片：[安装] 按钮、Tier Badge（Pro 标识）

数据来源：
  Section A：pinnedPanels 差集（纯前端 — 比对 PINNABLE_PANELS）
  Section B：GET /api/extensions/installed（Phase 2）
  Section C：GET /api/extensions/（Phase 2）
  Phase 1：B/C 使用本地 Mock 静态数据
```

### 4.6 拓展面板组件的动态加载

```typescript
// Sidebar.tsx — 当用户点击 Activity Bar 上的拓展图标时的动态组件映射

const EXTENSION_PANELS: Record<string, React.LazyExoticComponent<React.FC>> = {
  doc_preview: lazy(() => import('@/features/doc-preview/components/DocPreviewPanel')),
  anki_export: lazy(() => import('@/features/anki/components/AnkiPanel')),
  study_report: lazy(() => import('@/features/study-report/components/ReportPanel')),
};

// 渲染时：
if (activeSidebarPanel && activeSidebarPanel in EXTENSION_PANELS) {
  const ExtPanel = EXTENSION_PANELS[activeSidebarPanel];
  return <Suspense fallback={<div className="p-4 text-xs text-muted-foreground">加载中…</div>}><ExtPanel /></Suspense>;
}
```

### 4.7 前端新增/修改文件清单

```
新增：
├── components/layout/sidebar/ExtensionsPanel.tsx        ← 完整重写（替换 PluginsPanel）
├── components/layout/sidebar/SidebarActivityContextMenu.tsx  ← 右键菜单 + Portal
├── features/extensions/
│   ├── hooks/use-extensions.ts       ← 拉取拓展列表（SWR / useEffect）
│   ├── services/extensions.service.ts ← API 调用封装
│   └── index.ts
└── types/extensions.ts               ← 前端类型定义（镜像 Pydantic 模型）

修改：
├── stores/use-panel-store.ts          ← 版本升级 + migrate + pinnedPanels
├── components/layout/Sidebar.tsx      ← 动态渲染 + Portal 右键
└── components/layout/sidebar/PluginsPanel.tsx  ← 删除

删除：
└── components/layout/sidebar/PluginsPanel.tsx
```

---

## 5. 交互 Spec

### 5.1 Activity Bar 右键

```
用户行为：右键点击 Activity Bar 上的可移动图标（仅 PINNABLE_PANELS 响应）
系统响应：弹出右键菜单（Portal 渲染至 body，防止 overflow 裁切）
  ┌──────────────────────────────┐
  │  📌 取消固定                  │
  └──────────────────────────────┘
用户点击：
  → store.unpinPanel(panel)
  → 该图标从 Activity Bar 消失
  → 该面板出现在 Extensions Panel 的 "被 Unpin 的面板" 列表中
  → toast.success('仪表盘已移至功能拓展')
```

### 5.2 功能拓展面板内的固定按钮

```
已 unpin 的内置面板：
  按钮文案："固定到侧边栏"
  点击后：
  → store.pinPanel(panel)
  → 该图标回到 Activity Bar
  → 从 Extensions Panel 列表移除
  → toast.success('仪表盘已固定到侧边栏')

官方拓展（如文档预览）：
  未安装状态："安装" 按钮 + Tier Badge
  ↳ free 拓展：直接显示按钮
  ↳ pro 拓展 + free 用户：按钮 disabled + "需要 Pro 订阅" tooltip
  点击安装：
  → POST /api/extensions/doc_preview/install
  → 后端 Tier 硬校验（403 if insufficient tier）
  → 刷新已安装列表
  → 卡片变为"已安装" + "固定到侧边栏"按钮
  点击"固定到侧边栏"：
  → PATCH /api/extensions/doc_preview/pin { is_pinned: true }
  → 该拓展的 icon 出现在 Activity Bar（动态加入 pinnedPanels 机制外的专属拓展列表）
```

### 5.3 IMMOVABLE 面板保护

```
用户行为：右键点击 IMMOVABLE_PANELS 中的图标（如 AI 对话、节点商店）
系统响应：不出现右键菜单（onContextMenu 的 handler 检查 IMMOVABLE_PANELS 后直接 return）
```

---

## 6. 实施阶段

### Phase 1（MVP — 前端核心，约 1 天）

1. `use-panel-store.ts`：版本升级 + `migrate` + `pinnedPanels` state + `pinPanel/unpinPanel`
2. `Sidebar.tsx`：移除硬编码、重构为动态 `pinnedPanels` 渲染 + BOTTOM_ABSOLUTE 区域
3. `SidebarActivityContextMenu.tsx`：右键菜单 + Portal + 事件防穿透
4. `ExtensionsPanel.tsx`（替换 PluginsPanel，Mock 数据）：三个 Section 结构 + 纯前端 pinPanel 联动

### Phase 2（后端 + 真实数据，约 0.5 天）

1. Supabase 迁移：`ss_extensions` + `ss_user_extensions` + RLS + Seed（DO UPDATE 策略）
2. `backend/app/models/extensions.py`：Pydantic 模型
3. `backend/app/services/extensions_service.py`：Tier 硬校验 + CRUD
4. `backend/app/api/extensions.py`：REST 路由
5. `backend/app/api/router.py`：注册 extensions_router
6. 前端 `extensions.service.ts` + `use-extensions.ts` 对接真实 API

### Phase 3（官方拓展功能，逐个按 C-SOP 开发）

每个官方拓展独立开发，参考 `docs/项目规范与框架流程/功能流程/新增AI工具/C型-插件-SOP.md`：
1. `doc_preview`（文档预览）
2. `anki_export`（Anki 导出）
3. `study_report`（学习报表）

---

## 7. 完整 Checklist

```
□ Phase 1 · 名称重构 & Store 升级
  □ SidebarPanel union: 'plugins' → 'extensions'
  □ PANEL_LABELS: 'plugins' → 'extensions': '功能拓展'
  □ persist version: 1 + migrate 函数（兼容旧用户 localStorage）
  □ 新增 pinnedPanels / pinPanel / unpinPanel
  □ pinnedPanels 加入 partialize 持久化
  □ 导出 IMMOVABLE_PANELS / PINNABLE_PANELS 常量

□ Phase 1 · Sidebar.tsx 重构
  □ 移除 UPPER_PANELS / LOWER_PANELS 静态配置
  □ 引入 IMMOVABLE_UPPER_CONFIG / PANEL_ICON_MAP / EXTENSIONS_CONFIG
  □ Activity Bar 动态渲染 pinnedPanels
  □ BOTTOM_ABSOLUTE 区域：升级、文档、退出——不参与 pin 逻辑
  □ renderActivityButton 接受 onContextMenu 参数
  □ 不可移动面板右键：handler 检查 IMMOVABLE_PANELS 后 return（无菜单）
  □ import PluginsPanel → import ExtensionsPanel
  □ activeSidebarPanel === 'plugins' → 'extensions'（渲染判断）

□ Phase 1 · SidebarActivityContextMenu.tsx（新建）
  □ createPortal 至 document.body
  □ e.preventDefault() + e.stopPropagation() 防止原生菜单
  □ getBoundingClientRect 动态定位
  □ useEffect 全局 mousedown 点击外关闭
  □ onUnpin 回调 → unpinPanel + toast

□ Phase 1 · ExtensionsPanel.tsx（替换 PluginsPanel）
  □ Section A: 被 unpin 的内置面板（纯前端，PINNABLE_PANELS diff pinnedPanels）
  □ Section B: 已安装官方拓展（Phase 1 用 Mock，Phase 2 换真实 API）
  □ Section C: 可安装拓展（Phase 1 用 Mock）
  □ 固定/取消固定按钮接通 store.pinPanel / store.unpinPanel
  □ Pro 拓展在 free 用户下 disabled 按钮 + tooltip

□ Phase 2 · 数据库
  □ ss_extensions 表 + RLS（SELECT 公开）
  □ ss_user_extensions 表 + RLS（限定 user_id）
  □ Seed 数据（DO UPDATE SET 策略）
  □ 索引：ss_user_extensions_user_idx

□ Phase 2 · 后端 API
  □ models/extensions.py：ExtensionInfo / UserExtension / PinRequest / InstallResponse
  □ services/extensions_service.py：install（含 Tier 硬校验）/ uninstall / pin / list / list_installed
  □ api/extensions.py：5 个路由（GET / GET installed / POST install / DELETE / PATCH pin）
  □ router.py：include_router(extensions_router, prefix="/extensions")
  □ 所有路由 Depends(get_current_user) 鉴权
  □ install 路由：403 if user_tier < tier_required
  
□ Phase 2 · 前端真实 API 对接
  □ types/extensions.ts：镜像 Pydantic 模型
  □ features/extensions/services/extensions.service.ts
  □ features/extensions/hooks/use-extensions.ts（SWR 或 useEffect + refresh）
  □ ExtensionsPanel.tsx：Section B/C 换接真实 API

□ 安全
  □ 所有 API 有 Depends(get_current_user)
  □ RLS 全覆盖（ss_extensions SELECT ALL；ss_user_extensions 限 user_id）
  □ install 服务层 Tier 硬校验（不信任前端屏蔽）
  □ pin PATCH 接口校验  extension 已安装才可以 pin
```

---

## 8. 关键代码位置参考

| 内容 | 文件路径 |
|------|---------| 
| 面板状态 Store | `frontend/src/stores/use-panel-store.ts` |
| 主侧边栏 | `frontend/src/components/layout/Sidebar.tsx` |
| 旧插件面板（待删） | `frontend/src/components/layout/sidebar/PluginsPanel.tsx` |
| 新拓展面板（新建） | `frontend/src/components/layout/sidebar/ExtensionsPanel.tsx` |
| 右键菜单（新建） | `frontend/src/components/layout/sidebar/SidebarActivityContextMenu.tsx` |
| 前端拓展服务 | `frontend/src/features/extensions/services/extensions.service.ts` |
| 前端拓展 Hook | `frontend/src/features/extensions/hooks/use-extensions.ts` |
| 前端类型 | `frontend/src/types/extensions.ts` |
| 后端路由注册 | `backend/app/api/router.py` |
| 后端路由 | `backend/app/api/extensions.py` |
| 后端服务层 | `backend/app/services/extensions_service.py` |
| 后端 Pydantic 模型 | `backend/app/models/extensions.py` |
| 数据库迁移 | `supabase/migrations/20260327_add_extensions.sql` |
| C型插件 SOP | `docs/项目规范与框架流程/功能流程/新增AI工具/C型-插件-SOP.md` |

---

## 9. 架构决策汇总表（ADR 快照）

| 决策点 | 选定方案 | 原因 |
|--------|---------|------|
| Activity Bar 分区策略 | VSCode 风格：所有 Pinnable 统一上移，底部仅保留绝对工具 | 最符合用户心智，实现最简，避免区域过滤复杂度 |
| Persist 版本兼容 | `migrate` 函数 + `version: 1`，修正 `'plugins'→'extensions'` 并注入 `pinnedPanels` 默认值 | 零用户感知的无损升级，防白屏/状态丢失 |
| 数据库种子策略 | `ON CONFLICT DO UPDATE SET`（覆盖官方字段） | 官方主数据需随代码版本强制更新，不能因 `DO NOTHING` 固化 |
| Tier 安全校验位置 | API 服务层硬校验，而非仅靠 RLS 或前端屏蔽 | RLS 无法校验业务字段（tier），前端可绕过，服务层是唯一可信边界 |
| 右键菜单渲染策略 | `createPortal(menu, document.body)` + 动态定位（`getBoundingClientRect`） | 规避父级 `overflow-hidden` 裁切 + 侧边栏左右切换时坐标正确 |
