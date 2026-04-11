# StudySolo 2026-04-11 阶段总结：Stores 目录重组兼容层

**完成日期**：2026-04-11  
**状态**：已完成本轮最小闭环  
**覆盖范围**：Phase 3 / D2 / Task 3.2a，stores 物理归类、旧路径兼容 shim、barrel 导出、兼容回归测试

## 1. 执行摘要

本轮没有继续扩散前端行为重构，而是把 `frontend/src/stores/` 先整理成可持续演进的目录结构，并保留完整兼容层，确保已有业务代码无需立即改 import。

这一步的目标不是“完成 stores 全量迁移”，而是为后续 `3.2b import 切换` 提供一个低风险基座：

1. 新目录已存在，可承接后续按域迁移
2. 旧路径仍可用，不打断现有调用面
3. store 行为、持久化 key、类型契约全部不变

## 2. 本轮完成内容

### 2.1 目录与文件归类

已建立以下新目录：

- `frontend/src/stores/chat/`
- `frontend/src/stores/workflow/`
- `frontend/src/stores/ui/`
- `frontend/src/stores/admin/`

已迁移的文件：

- chat
  - `use-ai-chat-store.ts`
  - `use-conversation-store.ts`
- workflow
  - `use-workflow-store.ts`
  - `execution-slice.ts`
  - `history-slice.ts`
- ui
  - `use-panel-store.ts`
  - `use-settings-store.ts`
- admin
  - `use-admin-store.ts`

### 2.2 兼容层策略

根层旧入口文件全部保留，但内容改为显式转发：

- `frontend/src/stores/use-ai-chat-store.ts`
- `frontend/src/stores/use-conversation-store.ts`
- `frontend/src/stores/use-workflow-store.ts`
- `frontend/src/stores/use-panel-store.ts`
- `frontend/src/stores/use-settings-store.ts`
- `frontend/src/stores/use-admin-store.ts`

兼容层约束如下：

- 只使用 `export { ... }` / `export type { ... }`
- 不使用 `export *`
- 继续保证旧路径与新路径指向同一 store 引用

### 2.3 新增 barrel

新增：

- `frontend/src/stores/index.ts`

用途：

- 为后续渐进式 import 收敛提供统一出口
- 本轮不强制业务代码改用 barrel，避免把“结构重组”和“调用面替换”耦合到同一次交付

### 2.4 有意不做的事项

本轮明确没有做以下事情：

- 没有批量替换业务层 import
- 没有迁移 `workflow-store-helpers.ts`
- 没有修改任何 store 行为
- 没有改动持久化 key
- 没有引入 EventBus、manifest-first 或 service consolidation

## 3. 验证

### 测试

执行：

```bash
pnpm --dir frontend test -- \
  src/__tests__/store-path-compat.property.test.ts \
  src/__tests__/ai-chat-store.property.test.ts \
  src/__tests__/chat-conversation-sync.property.test.ts \
  src/__tests__/workflow-store.property.test.ts
```

结果：

- `14 passed`

### 静态检查

执行：

```bash
pnpm --dir frontend exec eslint \
  src/stores/index.ts \
  src/stores/use-admin-store.ts \
  src/stores/use-ai-chat-store.ts \
  src/stores/use-conversation-store.ts \
  src/stores/use-panel-store.ts \
  src/stores/use-settings-store.ts \
  src/stores/use-workflow-store.ts \
  src/stores/admin/use-admin-store.ts \
  src/stores/chat/use-ai-chat-store.ts \
  src/stores/chat/use-conversation-store.ts \
  src/stores/ui/use-panel-store.ts \
  src/stores/ui/use-settings-store.ts \
  src/stores/workflow/use-workflow-store.ts \
  src/stores/workflow/execution-slice.ts \
  src/stores/workflow/history-slice.ts \
  src/__tests__/store-path-compat.property.test.ts
```

结果：

- 通过

## 4. 当前状态与下一步

截至本轮结束，`Task 3.2 stores 重组` 已完成第一段最小闭环，但还没有触碰业务调用点。

最合理的下一小步是：

- `3.2b import 切换`

建议范围：

- 只替换一批确定无行为差异的调用方 import
- 优先从 tests、hooks、layout 层开始
- 保留根层 shim，直到调用面切换完成并经过一轮回归后再考虑删除
