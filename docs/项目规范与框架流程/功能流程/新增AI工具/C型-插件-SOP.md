# C 型 — 插件（Plugin）SOP

> 最后更新：2026-03-27
> 编码要求：UTF-8
> 前置：必须先完成 [00-节点与插件分类判断.md](./00-节点与插件分类判断.md) 的分类确认

适用场景：功能独立、改动文件超过 10 个、需要左侧导航栏独立入口的完整功能单元。

---

## 0. 插件 vs 节点的核心区别

| 维度 | 节点（A/B 型） | 插件（C 型） |
|------|-------------|-----------|
| **功能边界** | 工作流画布中的一个处理步骤 | 独立功能模块，不依附于特定工作流 |
| **前端入口** | 无导航栏入口，只在画布里 | 左侧导航栏独立入口 |
| **前端 UI** | 节点渲染器（小面板） | 完整 Feature 页面 / 面板 |
| **数据存储** | 使用现有工作流表 | 通常需要独立的 Supabase 表 |
| **后端 API** | 使用现有节点执行接口 | 需要新的 REST API 路由文件 |
| **文件数量** | ≤ 8 个 | 10~30+ 个 |

工作流节点是插件的一个可选"触发入口"，不是全部。

---

## 1. 插件立项：定义边界

在写任何代码前，必须回答以下问题。答案不清晰不允许开始实现。

### 1.1 功能描述

- **这个插件解决什么问题？**（用一句话描述，面向用户的价值）
- **核心功能是什么？**（3 条以内）
- **不做什么？**（明确边界，防止范围蔓延）

### 1.2 架构定义

| 定义项 | 内容 |
|-------|------|
| **插件标识名** | `snake_case`，如 `anki_export`、`notion_sync` |
| **左侧导航图标** | 从 lucide-react 选一个，如 `FileDown` |
| **导航标签** | 中文，如 "Anki 导出" |
| **是否包含工作流节点** | 是 / 否（若是，节点走哪个 A/B 型 SOP）|
| **Supabase 新表** | 表名列表（无则写"无"）|
| **后端 API 路由** | 路由前缀，如 `/api/anki/` |

### 1.3 权限与 Tier 控制

- 哪些 Tier 用户可以访问？
- 是否使用已有的 RLS 策略，还是需要新策略？

---

## 2. 文件结构规划

在创建任何文件前，先画出完整的文件树，经过 review 确认无遗漏。

### 2.1 标准插件目录结构

```
插件目录结构（以 anki_export 为例）

后端
─────────────────────────────────────────────────
backend/app/
├── api/
│   └── anki.py                  ← 新增：API 路由文件
├── services/
│   └── anki_service.py          ← 新增：业务逻辑层
├── models/
│   └── anki.py                  ← 新增：Pydantic 请求/响应模型
└── nodes/                       ← 可选：如果插件包含工作流节点
    └── output/
        └── anki_export/
            ├── __init__.py
            ├── node.py
            └── prompt.md

数据库
─────────────────────────────────────────────────
supabase/migrations/
└── YYYYMMDD_add_anki_tables.sql  ← 新增：数据库迁移

前端
─────────────────────────────────────────────────
frontend/src/
├── features/
│   └── anki/                    ← 新增：完整 feature 目录
│       ├── components/          ← UI 组件（页面/面板/卡片）
│       │   ├── AnkiPanel.tsx
│       │   └── ExportHistory.tsx
│       ├── hooks/               ← 组件级数据 hooks
│       │   └── use-anki-export.ts
│       ├── services/            ← API 调用层
│       │   └── anki.service.ts
│       └── index.ts             ← feature 公开接口（桶文件）
├── stores/                      ← 仅当需要全局状态时新增
│   └── use-anki-store.ts        ← 可选
└── types/
    └── anki.ts                  ← 新增：TypeScript 类型定义（若较多）

导航栏
─────────────────────────────────────────────────
frontend/src/components/layout/sidebar/
└── Sidebar.tsx                  ← 修改：加入导航入口
```

---

## 3. 数据库设计

### 3.1 迁移文件规范

```sql
-- supabase/migrations/20260327_add_anki_tables.sql
-- 命名格式：YYYYMMDD_<action>_<table>.sql

-- 1. 主数据表
CREATE TABLE IF NOT EXISTS ss_anki_exports (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workflow_id  UUID REFERENCES ss_workflows(id) ON DELETE SET NULL,
    file_url     TEXT NOT NULL,
    card_count   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 索引
CREATE INDEX IF NOT EXISTS ss_anki_exports_user_id_idx ON ss_anki_exports(user_id);
CREATE INDEX IF NOT EXISTS ss_anki_exports_created_at_idx ON ss_anki_exports(created_at DESC);

-- 3. RLS 策略（必须）
ALTER TABLE ss_anki_exports ENABLE ROW LEVEL SECURITY;

-- 用户只能看自己的数据
CREATE POLICY "用户可查看自己的导出记录"
    ON ss_anki_exports FOR SELECT
    USING (auth.uid() = user_id);

-- 用户只能创建自己的数据
CREATE POLICY "用户可创建自己的导出记录"
    ON ss_anki_exports FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 4. updated_at 自动触发
CREATE OR REPLACE TRIGGER ss_anki_exports_updated_at
    BEFORE UPDATE ON ss_anki_exports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 3.2 表命名规范

- 所有插件表前缀 `ss_`（项目统一前缀）
- 表名用 `snake_case`
- 必须有 `user_id` 外键（RLS 必须）
- 必须有 `created_at` 和 `updated_at`
- 在 Supabase 界面验证安全顾问无红色警告

---

## 4. 后端 API 路由

### 4.1 路由文件结构

```python
# backend/app/api/anki.py

"""Anki Export API router."""

from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID

from app.core.auth import get_current_user
from app.models.anki import AnkiExportRequest, AnkiExportResponse
from app.services.anki_service import AnkiService, AnkiServiceError

router = APIRouter(prefix="/anki", tags=["anki"])


@router.post("/export", response_model=AnkiExportResponse)
async def create_anki_export(
    request: AnkiExportRequest,
    user=Depends(get_current_user),
) -> AnkiExportResponse:
    """Create an Anki export from workflow output."""
    try:
        return await AnkiService.create_export(
            user_id=user.id,
            workflow_id=request.workflow_id,
            flashcard_data=request.flashcard_data,
        )
    except AnkiServiceError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("/exports", response_model=list[AnkiExportResponse])
async def list_exports(
    user=Depends(get_current_user),
) -> list[AnkiExportResponse]:
    """List all Anki exports for the current user."""
    return await AnkiService.list_exports(user_id=user.id)
```

### 4.2 路由注册

将新路由在 `backend/app/api/__init__.py` 或 `main.py` 的路由注册处添加：

```python
# backend/app/main.py 或 app/api/__init__.py
from app.api.anki import router as anki_router

app.include_router(anki_router, prefix="/api")
```

确认路由前缀与插件标识一致：`/api/anki/`。

### 4.3 Pydantic 模型规范

```python
# backend/app/models/anki.py

from pydantic import BaseModel, UUID4
from datetime import datetime


class AnkiExportRequest(BaseModel):
    workflow_id: UUID4 | None = None
    flashcard_data: list[dict]


class AnkiExportResponse(BaseModel):
    id: UUID4
    file_url: str
    card_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
```

### 4.4 Service 层规范

```python
# backend/app/services/anki_service.py

from uuid import UUID
from app.models.anki import AnkiExportRequest, AnkiExportResponse
from app.core.database import get_supabase


class AnkiServiceError(Exception):
    """业务层错误，可直接展示给用户。"""


class AnkiService:

    @staticmethod
    async def create_export(
        user_id: UUID,
        workflow_id: UUID | None,
        flashcard_data: list[dict],
    ) -> AnkiExportResponse:
        # 业务逻辑...
        pass

    @staticmethod
    async def list_exports(user_id: UUID) -> list[AnkiExportResponse]:
        # 查询...
        pass
```

---

## 5. 前端 Feature 目录

### 5.1 Feature 结构规范

遵循 `features/` 下已有模块（如 `workflow/`）的组织方式：

```
features/<plugin_name>/
├── components/          ← 展示组件，不含业务逻辑
│   ├── <PluginPanel>.tsx
│   └── <SubComponent>.tsx
├── hooks/               ← 数据和状态 hooks（业务逻辑）
│   └── use-<plugin>.ts
├── services/            ← API 调用，映射到后端接口
│   └── <plugin>.service.ts
└── index.ts             ← 公开导出（桶文件）
```

### 5.2 Service 层规范（前端）

```typescript
// features/anki/services/anki.service.ts

import { authedFetch } from "@/lib/authed-fetch";

export interface AnkiExportResult {
    id: string;
    file_url: string;
    card_count: number;
    created_at: string;
}

export async function createAnkiExport(
    flashcardData: Record<string, unknown>[],
    workflowId?: string,
): Promise<AnkiExportResult> {
    const response = await authedFetch("/api/anki/export", {
        method: "POST",
        body: JSON.stringify({ flashcard_data: flashcardData, workflow_id: workflowId }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail ?? "导出失败");
    }
    return response.json();
}

export async function listAnkiExports(): Promise<AnkiExportResult[]> {
    const response = await authedFetch("/api/anki/exports");
    if (!response.ok) throw new Error("获取历史记录失败");
    return response.json();
}
```

**规范要求**：
- 所有请求使用 `authedFetch`（不使用裸 `fetch`）
- 函数返回 `Promise`，不在 service 层处理 UI 状态
- 错误统一抛出 `Error`，由 hook 层捕获展示

### 5.3 Store 创建规范（仅当需要全局状态）

仅在以下情况创建新 Store：
- 插件状态需要跨多个页面/组件共享
- 状态需要在路由切换后保持

如果状态只在一个面板内使用，用 `useState` 或 `useReducer` 即可，不要过度 Store 化。

```typescript
// stores/use-anki-store.ts（仅当全局状态必要时创建）

import { create } from "zustand";

interface AnkiState {
    exports: AnkiExportResult[];
    isLoading: boolean;
    fetchExports: () => Promise<void>;
}

export const useAnkiStore = create<AnkiState>((set) => ({
    exports: [],
    isLoading: false,
    fetchExports: async () => {
        set({ isLoading: true });
        try {
            const data = await listAnkiExports();
            set({ exports: data });
        } finally {
            set({ isLoading: false });
        }
    },
}));
```

**Store 规范**：
- Store 中禁止调用其他 Store（无跨 Store 依赖）
- 副作用（fetch）放在 action 内部，不放在初始化
- Store 文件放 `stores/` 目录，不放在 `features/` 内

---

## 6. 左侧导航栏接入

新增导航入口**必须修改以下三处**，缺一不可：

### 6.1 `Sidebar.tsx` — 主导航

```tsx
// frontend/src/components/layout/sidebar/Sidebar.tsx

// 1. 导入图标
import { FileDown } from "lucide-react";

// 2. 在导航配置数组中加入新插件
const navigationItems = [
    // ... 已有导航 ...
    {
        icon: FileDown,
        label: "Anki 导出",
        href: "/app/anki",           // 跳转路径
        pluginId: "anki_export",     // 用于权限控制
    },
];
```

### 6.2 前端路由页面

```
frontend/src/app/(app)/anki/page.tsx  ← 新增路由页面
```

```tsx
// app/(app)/anki/page.tsx

import type { Metadata } from "next";
import { AnkiPanel } from "@/features/anki";

export const metadata: Metadata = {
    title: "Anki 导出 — StudySolo",
    description: "将闪卡导出为 Anki 格式，在 Anki 中继续练习",
};

export default function AnkiPage() {
    return <AnkiPanel />;
}
```

### 6.3 移动端导航（如有）

```tsx
// components/layout/mobile-nav/MobileNav.tsx（如存在）
// 按同样方式加入移动端导航配置
```

---

## 7. 插件内的节点部分

如果插件包含工作流节点（节点是插件的触发入口），按以下顺序处理：

1. 先按 **C 型 SOP** 完成插件骨架（DB、API、前端页面）
2. 再按对应的 **A 型或 B 型 SOP** 完成节点实现
3. 节点的 `execute()` 可以调用插件的 Service 层（如 `anki_service.py`），形成联动

节点与插件 Service 层的联动示例：

```python
# nodes/output/anki_export/node.py

from app.services.anki_service import AnkiService, AnkiServiceError

class AnkiExportNode(BaseNode):
    node_type = "anki_export"
    is_llm_node = False
    output_format = "json"
    config_schema = []

    async def execute(self, node_input: NodeInput, llm_caller: Any) -> AsyncIterator[str]:
        flashcard_json = node_input.upstream_outputs.get("flashcard_node_id", "[]")
        try:
            import json
            data = json.loads(flashcard_json)
            result = await AnkiService.create_export(
                user_id=None,   # 工作流执行时从 implicit_context 取
                flashcard_data=data,
            )
            yield json.dumps({"export_url": result.file_url, "card_count": result.card_count})
        except AnkiServiceError as e:
            yield f"[Anki 导出失败] {e}"
```

---

## 8. 安全检查

### 8.1 RLS 策略检查

对每张新表运行 Supabase 安全顾问检查：

```sql
-- 在 Supabase SQL Editor 中验证
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename LIKE 'ss_anki%';

-- 预期：rowsecurity = true
```

### 8.2 API 鉴权检查

确认每个新 API 路由都有 `Depends(get_current_user)`，无遗漏。

### 8.3 前端权限检查

确认导航入口根据用户 Tier 控制可见性：

```tsx
// Sidebar.tsx 中的权限控制
const filteredNav = navigationItems.filter(item => {
    if (item.pluginId === "anki_export") {
        return userTier !== "free";   // 示例：付费用户才能看到
    }
    return true;
});
```

---

## 9. 联调验收

### Phase 1 — 后端独立验证

```bash
# 1. 数据库迁移
supabase db push  # 或 supabase migration up

# 2. 后端路由测试
curl -X GET http://localhost:2038/api/anki/exports \
    -H "Authorization: Bearer <your_token>"

# 3. 安全顾问
supabase inspect db row-level-security
```

### Phase 2 — 前端独立验证

```bash
cd frontend
npx tsc --noEmit          # TypeScript 0 错误
npm run lint               # Lint 0 错误
```

### Phase 3 — 端到端测试

用真实账户登录，验证：

1. 左侧导航栏出现插件入口，图标和标签正确
2. 插件页面正常加载（无 404、无 hydration 错误）
3. 核心功能正常运行
4. 包含节点的场景：工作流执行链路打通
5. 权限控制有效（无权限用户无法访问）
6. 移动端（如有）导航正常

---

## 10. Checklist（提交前逐项确认）

```
□ 立项
  □ 已完成插件功能描述（一句话价值定位）
  □ 已明确架构定义（标识名、导航、DB 表、API 前缀）
  □ 已明确 Tier 权限控制策略
  □ 已画出完整文件树并确认

□ 数据库
  □ migrations/ 下新增迁移文件（命名 YYYYMMDD_xxx.sql）
  □ 所有新表启用 RLS（ALTER TABLE ... ENABLE ROW LEVEL SECURITY）
  □ 所有新表有 SELECT / INSERT / UPDATE 策略（按需）
  □ supabase inspect db row-level-security 无红色警告
  □ 所有新表有 user_id 外键和 created_at / updated_at 字段

□ 后端 API
  □ 创建 api/<plugin>.py，包含所有必要路由
  □ 每个路由有 Depends(get_current_user)，无遗漏
  □ 在 main.py 或 api/__init__.py 中注册路由
  □ 创建 models/<plugin>.py（Pydantic 请求/响应模型）
  □ 创建 services/<plugin>_service.py（业务逻辑 + 自定义异常）

□ 后端节点（如包含工作流节点）
  □ 参考 A 型 / B 型 SOP 完成节点实现
  □ 节点调用插件 Service 层，不重复实现业务逻辑

□ 前端 Feature
  □ 创建 features/<plugin_name>/ 完整目录
  □ Service 层使用 authedFetch，不使用裸 fetch
  □ Store 层（如需）：无跨 Store 依赖，遵循纯状态容器规范
  □ 创建路由页面 app/(app)/<plugin>/page.tsx
  □ 路由页面包含 metadata（title + description）

□ 左侧导航栏（三处必改）
  □ Sidebar.tsx 加入导航配置
  □ 路由页面存在
  □ 移动端导航更新（如有 MobileNav）
  □ 权限控制：根据 Tier 控制导航可见性

□ TypeScript 与类型安全
  □ 新增 types/ 文件（如类型较多）
  □ npx tsc --noEmit 零错误
  □ 如果包含工作流节点：NodeType union 已更新

□ 安全审查
  □ 后端 API 无未鉴权路由
  □ 前端无硬编码密钥
  □ Supabase RLS 策略全覆盖

□ 端到端测试
  □ Phase 1（后端）通过
  □ Phase 2（前端编译）通过
  □ Phase 3（端到端）完整通过

□ 文档
  □ docs/项目架构全景.md 同步（新表、新路由、新 feature 目录）
  □ 如引入新的外部服务，记录在 docs/项目规范/项目AI调用及计费分析统一规范.md
```

---

## 11. 反模式警告

以下做法会导致维护地狱，执行 SOP 时遇到以下情况应停下来讨论：

| 反模式 | 问题 | 正确做法 |
|--------|------|---------|
| 在 `Sidebar.tsx` 中写业务逻辑 | 导航文件膨胀，难以测试 | 业务逻辑放 Feature 层，导航只做路由配置 |
| Store 直接调另一个 Store | 状态流变成蜘蛛网 | 通过 Hook 层串联多个 Store |
| API 路由跳过 `get_current_user` | 任意用户可访问 | 所有路由强制鉴权 |
| Supabase 表没有 RLS | 数据越权读写 | 建表时同步启用 RLS |
| 在节点 `execute()` 中写数据库操作 | 节点职责不清 | 数据库操作走 Service 层，节点调用 Service |
| 插件逻辑分散在已有文件中 | 无法独立移除插件 | 插件代码内聚在 `features/<plugin>/` |

---

> 📌 **核心原则**：插件 = 独立功能模块。可以被独立添加，也可以被独立移除。
> 每个插件修改的文件应该能被一个 git branch 清晰表达，发现需要改 10 个已有大文件时，重新审视设计。
