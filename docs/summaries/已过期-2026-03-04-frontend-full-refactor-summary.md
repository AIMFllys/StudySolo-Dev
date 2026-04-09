# StudySolo 前端全量重构总结（2026-03-04）

## 1. 目标与结果
本次重构以“全量范围、分阶段收敛、严格门禁”为目标，最终达成：
- `frontend/src/**/*.{ts,tsx,css}` 全部 `<= 300` 行。
- `frontend/src/app/**/page.tsx` 默认全部 `<= 220` 行。
- 页面层（含 layout）不再散落业务请求，统一下沉到 `services/*` 与 feature hooks。
- Store 约束落地为“纯状态 + 同步更新”，副作用下沉到 hooks/services。
- 测试与构建门禁全绿：`lint + test + lint:lines + build`。

## 2. 结构重构总览
### 2.1 路由层瘦身
- 大量 `app/**/page.tsx` 改为薄壳入口，仅负责参数与页面装配。
- 业务逻辑统一迁移到 `src/features/*`。

### 2.2 Feature 模块化
新增/完善：
- `src/features/auth/*`
- `src/features/admin/*`（含 `shared`）
- `src/features/settings/*`

关键页面能力已分层为：
- 容器页（page）
- 业务视图（PageView）
- 子组件（components）
- hooks
- types

### 2.3 类型治理
新增领域类型并外置：
- `src/types/auth.ts`
- `src/types/settings.ts`
- `src/types/workflow.ts`
- `src/types/async.ts`
- `src/types/admin/*`

`src/types/index.ts` 已统一导出。

### 2.4 样式治理
- `app/globals.css` 改为聚合入口。
- 样式拆分为：
  - `src/styles/tokens.css`
  - `src/styles/base.css`
  - `src/styles/glass.css`
  - `src/styles/workflow.css`

## 3. 服务层与 Hook 治理
### 3.1 API 访问统一
新增/完善：
- `src/services/workflow.service.ts`
- `src/services/workflow.server.service.ts`
- `src/services/admin.service.ts`
- `src/services/auth.service.ts`

结果：页面层不直接实现业务 `fetch` 流程。

### 3.2 副作用下沉
新增/完善 hooks：
- `useCreateWorkflowAction`
- `useAdminLogoutAction`
- `useAdminSidebarNavigation`
- `useSidebarNavigation`
- `useWorkflowSidebarActions`
- `useVerificationCountdown`
- `useAdminListQuery`
- `useToastQueue`
- `useWorkflowContextMenu`

## 4. 导航与布局重构
### 4.1 用户侧 Sidebar
- 拆分为渲染层 + 子组件 + helper/hook。
- 实现右键菜单真实能力（不再占位）：
  - 重命名工作流（PUT `/api/workflow/:id`）
  - 删除工作流（DELETE `/api/workflow/:id`）
  - 操作后自动刷新列表并处理当前页跳转。

### 4.2 Admin Sidebar
- 导航常量外置到 `features/admin/shared/constants/admin-nav-items.ts`。
- active 判定与移动端收起逻辑抽离为纯函数与 hook。

## 5. 质量门禁升级
### 5.1 行数门禁脚本
新增：
- `frontend/scripts/check-max-lines.mjs`（strict/ratchet）
- `frontend/scripts/check-page-lines.mjs`（page 默认 220）
- `frontend/scripts/max-lines-baseline.json`
- `frontend/scripts/page-lines-exceptions.json`

`package.json` 门禁命令已升级：
- `lint:lines`
- `lint:lines:strict`
- `lint:lines:ratchet`
- `lint:lines:baseline`
- `lint:pages`

### 5.2 Next 中间件迁移
- `src/middleware.ts` 迁移至 `src/proxy.ts`（Next 16 规范）。

## 6. 测试重构与新增
### 6.1 大测试文件拆分
- `integration-fixes.property.test.ts` 拆分为 4 个文件。
- `admin-markdown-preview.property.test.ts` 拆分为 2 个文件。

### 6.2 新增属性测试
新增：
- `admin-sidebar-navigation.property.test.ts`
- `sidebar-navigation.property.test.ts`

当前测试状态：
- 14 test files
- 62 tests
- 全部通过

## 7. 文档与规范更新
已同步更新：
- `frontend/README.md`
- `docs/frontend-engineering-spec.md`

新增并固化规范：
- 页面层职责
- 行数双门禁（300/220）
- Store 禁副作用约束
- 副作用统一归属 hooks/services

## 8. 最终验收状态
- `pnpm lint`：通过
- `pnpm test`：通过
- `pnpm lint:lines`：通过
- `pnpm build`：通过

本次前端重构已完成从“页面耦合实现”到“可持续模块化工程结构”的收口。
