<!-- 编码：UTF-8 -->

# ✅ #05 use-workflow-store.ts 拆分方案（453 行 → 目标每文件 < 250 行）

> **状态：已完成** | 完成日期：2026-03-30 | 453 行 → 185 行，Zustand slice 模式

## 当前问题

单个 Zustand store 包含 5 个不同职责域：

1. **Graph 状态**（nodes/edges/setNodes/setEdges/onNodesChange/onEdgesChange/onConnect）~120 行
2. **Execution Session**（executionSession + 5 个 action）~120 行
3. **History（Undo/Redo）**（past/future/takeSnapshot/undo/redo）~50 行
4. **Click-to-Connect**（clickConnectState + 3 个 action）~50 行
5. **Workflow 元数据**（currentWorkflowId/Name/isDirty/selectedNodeId/lastPrompt 等）~60 行
6. **辅助函数**（resolveSelectedNodeId、deduplicateNodes、buildEdgeData）~50 行

## 拆分策略

使用 Zustand slice pattern，将 store 拆分为多个 slice 文件，在主 store 中组合。

| Slice 文件 | 职责 | 预估行数 |
|------------|------|----------|
| `slices/graph-slice.ts` | nodes/edges CRUD + onNodesChange/onEdgesChange/onConnect | ~130 |
| `slices/execution-slice.ts` | executionSession + 所有 trace 操作 | ~130 |
| `slices/history-slice.ts` | past/future/takeSnapshot/undo/redo | ~60 |
| `slices/connect-slice.ts` | clickConnectState + start/complete/cancel | ~50 |
| `workflow-store-helpers.ts` | resolveSelectedNodeId + deduplicateNodes + buildEdgeData | ~50 |
| `use-workflow-store.ts` | 组合所有 slice + 元数据字段 | ~80 |

## 拆分后 Tree

```
frontend/src/stores/
├── use-workflow-store.ts              # ~80 行：组合入口
├── workflow-store-helpers.ts          # ~50 行：纯函数
├── slices/
│   ├── graph-slice.ts                 # ~130 行：图数据 CRUD
│   ├── execution-slice.ts            # ~130 行：执行会话管理
│   ├── history-slice.ts              # ~60 行：撤销/重做
│   └── connect-slice.ts             # ~50 行：点击连线
├── use-admin-store.ts                 # 已有，保持
├── use-ai-chat-store.ts              # 已有，保持
├── use-conversation-store.ts          # 已有，保持
├── use-panel-store.ts                 # 已有，保持
└── use-settings-store.ts             # 已有，保持
```

## Zustand Slice 组合模式

```ts
// use-workflow-store.ts
import { create } from 'zustand';
import { createGraphSlice, type GraphSlice } from './slices/graph-slice';
import { createExecutionSlice, type ExecutionSlice } from './slices/execution-slice';
import { createHistorySlice, type HistorySlice } from './slices/history-slice';
import { createConnectSlice, type ConnectSlice } from './slices/connect-slice';

type WorkflowStore = GraphSlice & ExecutionSlice & HistorySlice & ConnectSlice & {
  // 元数据字段
  currentWorkflowId: string | null;
  // ...
};

export const useWorkflowStore = create<WorkflowStore>()((...a) => ({
  ...createGraphSlice(...a),
  ...createExecutionSlice(...a),
  ...createHistorySlice(...a),
  ...createConnectSlice(...a),
  // 元数据
  currentWorkflowId: null,
  // ...
}));
```

## 可复用识别

- `workflow-store-helpers.ts` 中的 `deduplicateNodes` 和 `resolveSelectedNodeId` 是纯函数，可被测试直接引用
- `execution-slice.ts` 的 trace 管理逻辑可被未来的 replay/debug 功能复用
- `history-slice.ts` 的 undo/redo 模式可抽象为通用 `createHistoryMiddleware`

## 符合 Next.js 架构

- Zustand slice pattern 是官方推荐的大型 store 拆分方式
- `slices/` 子目录在 `stores/` 下，符合 feature colocation 原则
- 外部消费者 import 路径不变：`import { useWorkflowStore } from '@/stores/use-workflow-store'`

## 预估工作量

~2 小时（slice 提取 + 类型调整 + 验证所有消费者正常）
