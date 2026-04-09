<!-- 编码：UTF-8 -->

# StudySolo 前端工程规范

> 最后更新：2026-03-25
> 适用范围：`StudySolo/frontend/src/**`

## 当前目录约束

```text
src/
├── app/                # 路由入口层
├── features/           # 业务域模块
│   ├── workflow/
│   ├── admin/          # 含 shared/ 共享组件库
│   ├── auth/
│   ├── knowledge/      # 知识库（组件 + hooks + types + utils）
│   └── settings/
├── components/         # 仅通用 UI 与 layout
├── hooks/              # 仅全局通用 hook
├── stores/             # Zustand 状态层
├── services/           # 请求层
├── types/              # 领域类型
├── styles/             # 全局样式 (tokens.css, paper.css, base.css, workflow.css)
└── utils/
```

## 强制规则

### 1. 页面与布局职责

- `app/**/page.tsx` 只负责路由参数、页面装配和页面级布局。
- `components/layout/**` 不直接持有 workflow/admin 的专属业务副作用。
- 长表单、执行链、副作用和上下文菜单逻辑必须下沉到 feature hooks 或 services。

### 2. Feature 边界

- workflow 相关组件、常量、hooks 必须放在 `features/workflow/`。
- admin 专属 hooks 必须放在 `features/admin/hooks/`。
- admin 共享组件（PageHeader, KpiCard, Pagination 等）统一放 `features/admin/shared/`。
- knowledge 相关组件、hooks、types 必须放在 `features/knowledge/`。
- 全局 `hooks/` 只保留真正跨域复用的通用 hook。
- `components/business/` 不再作为新代码落点。

### 3. 状态与副作用

- `stores/*` 只负责状态和纯更新函数。
- 禁止在 store 内直接执行网络请求、路由跳转、定时器或 DOM 操作。
- 网络请求统一经由 `services/*` 或 feature hooks 发起。

### 4. 类型约束

- 领域类型统一放在 `src/types/*` 或 feature 局部类型文件中。
- SSE 联合类型统一放在 `src/types/workflow-events.ts`。
- 不在页面中长期维护大段内联类型。

## 行数治理

### 当前策略

- 长期目标仍是 `src/**/*.ts|tsx|css <= 300` 行。
- 但当前仓库仍存在历史超限文件，因此执行策略以 `ratchet` 为主：
  - 禁止新增超限文件
  - 禁止历史超限文件继续变大
- 页面默认目标仍为 `app/**/page.tsx <= 220` 行。

### PR 最低要求

1. `npm run lint`
2. 与改动域相关的测试通过
3. 不新增超限文件
4. 不把 feature 专属代码重新放回全局目录

## 当前 workflow 结构

```text
features/workflow/
├── components/
│   ├── canvas/
│   ├── nodes/
│   ├── panel/
│   └── toolbar/
├── hooks/
│   ├── use-create-workflow-action.ts
│   ├── use-workflow-context-menu.ts
│   ├── use-workflow-execution.ts
│   ├── use-workflow-sidebar-actions.ts
│   └── use-workflow-sync.ts
├── constants/
│   └── workflow-meta.ts
└── index.ts
```

## 迁移后约定

- 新增 workflow 组件时，优先放到 `features/workflow/components/` 对应子目录。
- 新增 workflow 行为逻辑时，优先放到 `features/workflow/hooks/`。
- 布局层只能 import feature 对外导出的组件或 hook，不反向把逻辑写回 layout。
- 如果未来继续拆大文件，先拆逻辑，再拆视觉，不要在同一个提交里同时改结构和行为。
