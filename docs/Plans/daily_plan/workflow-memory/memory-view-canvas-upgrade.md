<!-- 编码：UTF-8 -->

# `/m/[id]` 运行记忆页面升级规划 — 画布化完整执行回放

> **创建日期**: 2026-04-01
> **目标**: 将 `/m/[id]` 从纯列表卡片视图升级为 1:1 模拟 `/s/[id]` 的全屏画布视图，完整展示工作流执行过程
> **事实源**: 基于 `frontend/src/app/s/[id]/`、`frontend/src/app/m/[id]/`、`backend/app/api/workflow_runs.py` 的代码审查

---

## 一、背景与目标

### 1.1 现状

| 维度 | `/s/[id]` (公开分享) | `/m/[id]` (运行记忆) |
|------|---------------------|---------------------|
| 数据源 | `ss_workflows.nodes_json + edges_json` | `ss_workflow_runs + ss_workflow_run_traces` |
| 核心数据 | 完整画布图（节点坐标 + 连线 + 输出） | 节点级执行记录列表（无画布图） |
| 渲染方式 | `ReadOnlyCanvas`（XY Flow 全画布） | 纯文档流卡片列表（`TraceCard`） |
| 布局 | 全屏画布 + 浮动信息面板 | `max-w-4xl` 居中卡片列表 |
| 节点输出 | `AIStepNode` → `NodeResultSlip` 画布内渲染 | `SimpleMarkdown` 简易渲染 |

### 1.2 目标

将 `/m/[id]` 升级为与 `/s/[id]` 视觉一致的全屏画布视图：

- 复用 `ReadOnlyCanvas` 渲染完整工作流画布
- 将 trace 执行数据注入到节点 data 中，通过 `AIStepNode` → `NodeResultSlip` 展示每个节点的输入/输出/状态/耗时
- 保留 `/m/[id]` 特有的运行摘要信息（总耗时、Token 消耗、节点统计）
- 保留分享开关功能

### 1.3 与 `/s/[id]` 的差异

升级后的 `/m/[id]` 不是 `/s/[id]` 的简单复制，而是"执行回放视图"：

| 功能 | `/s/[id]` | `/m/[id]` 升级后 |
|------|-----------|-----------------|
| 画布渲染 | ✅ ReadOnlyCanvas | ✅ ReadOnlyCanvas（注入 trace 数据） |
| 节点输出 | 静态快照（最后保存状态） | 执行记录数据（该次运行的真实输出） |
| 左侧浮动面板 | 工作流名称/描述/作者/节点数 | 运行摘要（时间/耗时/Token/状态/节点统计） |
| 右侧浮动按钮 | 点赞/收藏/Fork/分享 | 分享开关 + 复制链接 + 进入编辑 |
| 顶部标签 | "公开预览 · Public View" | "运行记忆 · Memory View" |
| 社交功能 | 点赞/收藏/Fork | 无（这是执行记录，不是工作流） |

---

## 二、技术方案

### 2.1 核心问题：`/m/[id]` 缺少画布数据

当前 `WorkflowRunDetail` 只包含 run 元数据 + traces 列表，**不包含 `nodes_json` 和 `edges_json`**。

**选定方案：后端 API 扩展（路径 A）**

在 `workflow_runs.py` 的 run detail 端点中，额外查询关联 workflow 的 `nodes_json` 和 `edges_json`，一次请求返回所有数据。

理由：
- run 记录已关联 `workflow_id`，后端一次查询即可
- 避免前端双请求的复杂度和竞态问题
- `nodes_json` 通常 10~50KB，在可接受范围内

### 2.2 trace → 节点 data 映射

从后端拿到 `nodes_json` 后，需要将 traces 数据注入到对应节点的 `data` 字段中，使 `AIStepNode` → `NodeResultSlip` 能正确渲染执行结果。

映射逻辑（纯函数，前端实现）：

```typescript
// 文件: frontend/src/app/m/[id]/inject-traces.ts

import type { Node } from '@xyflow/react';
import type { RunTrace } from '@/types/memory';

/**
 * 将 trace 执行数据注入到 nodes_json 的节点 data 中。
 *
 * 映射规则:
 *   trace.final_output   → node.data.output
 *   trace.status          → node.data.status (done/error/skipped → 对应 NodeStatus)
 *   trace.input_snapshot  → node.data.input_snapshot
 *   trace.duration_ms     → node.data.execution_time_ms
 *   trace.model_route     → node.data.model_route
 *   trace.error_message   → node.data.error
 *
 * 未匹配到 trace 的节点保持 status='pending'。
 */
export function injectTracesIntoNodes(
  nodes: Node[],
  traces: RunTrace[],
): Node[] {
  const traceMap = new Map(traces.map(t => [t.node_id, t]));

  return nodes.map(node => {
    const trace = traceMap.get(node.id);
    if (!trace) return node;

    return {
      ...node,
      data: {
        ...node.data,
        output: trace.final_output ?? '',
        status: mapTraceStatus(trace.status),
        input_snapshot: trace.input_snapshot ?? undefined,
        execution_time_ms: trace.duration_ms ?? undefined,
        model_route: trace.model_route ?? undefined,
        error: trace.error_message ?? undefined,
      },
    };
  });
}

function mapTraceStatus(traceStatus: string): string {
  // trace 表中的 status 值与前端 NodeStatus 基本一致
  const validStatuses = ['pending', 'running', 'done', 'error', 'skipped', 'waiting'];
  return validStatuses.includes(traceStatus) ? traceStatus : 'pending';
}
```

### 2.3 `showAllNodeSlips` 初始化问题

`AIStepNode` 内部通过 `useWorkflowStore.showAllNodeSlips` 控制 `NodeResultSlip` 的显示。在 `/m/[id]` 这个独立路由中，Zustand Store 没有被初始化。

**方案：在 MemoryView 挂载时初始化 Store**

```typescript
// MemoryView.tsx 挂载时
useEffect(() => {
  // 注入节点数据到 Store，使 AIStepNode 内部的 useWorkflowStore 读取正常
  useWorkflowStore.getState().setCurrentWorkflow(
    run.workflow_id,
    run.workflow_name,
    injectedNodes,
    edges,
  );
  // 强制显示所有 NodeResultSlip
  if (!useWorkflowStore.getState().showAllNodeSlips) {
    useWorkflowStore.getState().toggleGlobalNodeSlips();
  }
}, []);
```

注意：这里不需要启用 `useWorkflowSync`（双缓冲同步），因为这是只读视图。

### 2.4 节点 ID 不匹配的 Fallback

用户执行后可能修改了画布（增删节点），导致 trace 中的 `node_id` 在当前 `nodes_json` 中找不到。

处理策略：
- 匹配到的节点：正常注入 trace 数据
- 未匹配到的节点（在 nodes_json 中但无 trace）：保持 `status='pending'`，不显示输出
- 孤立的 trace（有 trace 但 nodes_json 中无对应节点）：在浮动面板底部以简化列表展示（fallback 到当前 TraceCard 样式）

---

## 三、文件变更清单

### 3.1 后端（1 个文件修改）

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/app/api/workflow_runs.py` | 修改 | `get_run_detail` 和 `_build_public_run_response` 中追加查询 `nodes_json, edges_json` |

具体改动：

```python
# get_run_detail 和 _build_public_run_response 中，查询 workflow 时追加字段：
wf = (
    await db.from_("ss_workflows")
    .select("name, nodes_json, edges_json")  # 原来只查 name
    .eq("id", run_data["workflow_id"])
    .maybe_single()
    .execute()
)

# 返回值中追加：
return {
    **run_data,
    "workflow_name": wf.data["name"] if wf.data else "未知工作流",
    "nodes_json": wf.data.get("nodes_json", []) if wf.data else [],
    "edges_json": wf.data.get("edges_json", []) if wf.data else [],
    "traces": traces.data or [],
}
```

### 3.2 前端类型（1 个文件修改）

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/types/memory.ts` | 修改 | `WorkflowRunDetail` 追加 `nodes_json` + `edges_json` 字段 |

```typescript
import type { Node, Edge } from '@xyflow/react';

export interface WorkflowRunDetail extends WorkflowRunMeta {
  workflow_name: string;
  nodes_json?: Node[];   // 新增：关联工作流的画布节点
  edges_json?: Edge[];   // 新增：关联工作流的画布连线
  traces: RunTrace[];
}
```

使用可选字段（`?`），兼容 workflow 已被删除的情况。

### 3.3 前端路由（3 个文件重写 + 1 个新建）

| 文件 | 操作 | 说明 |
|------|------|------|
| `frontend/src/app/m/[id]/layout.tsx` | 重写 | 从文档流布局改为全屏画布布局 |
| `frontend/src/app/m/[id]/MemoryView.tsx` | 重写 | 画布 + 浮动面板模式 |
| `frontend/src/app/m/[id]/page.tsx` | 微调 | SSR 数据获取逻辑不变 |
| `frontend/src/app/m/[id]/inject-traces.ts` | 新建 | trace → node data 映射纯函数 |

### 3.4 不需要修改的文件（直接复用）

| 组件 | 路径 | 复用方式 |
|------|------|---------|
| `ReadOnlyCanvas` | `components/workflow/ReadOnlyCanvas.tsx` | 直接导入，传入注入后的 nodes + edges |
| `AIStepNode` | `features/workflow/components/nodes/AIStepNode.tsx` | 由 ReadOnlyCanvas 内部注册，自动复用 |
| `NodeResultSlip` | `features/workflow/components/nodes/NodeResultSlip.tsx` | 由 AIStepNode 内部渲染，自动复用 |
| 所有节点渲染器 | `features/workflow/components/nodes/renderers/` | 由 NodeResultSlip 内部调用，自动复用 |
| `SequentialEdge` / `AnimatedEdge` | `features/workflow/components/canvas/edges/` | 由 ReadOnlyCanvas 内部注册，自动复用 |
| `SessionRefresher` | `app/s/[id]/SessionRefresher.tsx` | 已在 `/m/[id]` 复用 |
| `NODE_TYPE_META` | `features/workflow/constants/workflow-meta.ts` | 节点图标/颜色/描述元数据 |

---

## 四、详细实现规划

### 4.1 Phase 1：后端 API 扩展

**文件**: `backend/app/api/workflow_runs.py`

**改动点 1**: `get_run_detail` 端点（authenticated）

```python
# 当前：只查 name
wf = (
    await db.from_("ss_workflows")
    .select("name")
    .eq("id", run.data["workflow_id"])
    .maybe_single()
    .execute()
)

# 改为：追加 nodes_json, edges_json
wf = (
    await db.from_("ss_workflows")
    .select("name, nodes_json, edges_json")
    .eq("id", run.data["workflow_id"])
    .maybe_single()
    .execute()
)

# 返回值追加
return {
    **run.data,
    "workflow_name": wf.data["name"] if wf.data else "未知工作流",
    "nodes_json": wf.data.get("nodes_json", []) if wf.data else [],
    "edges_json": wf.data.get("edges_json", []) if wf.data else [],
    "traces": traces.data or [],
}
```

**改动点 2**: `_build_public_run_response` 辅助函数（public）

同样的改动，追加 `nodes_json, edges_json` 查询和返回。

**验证**: 后端 `python -m pytest tests` 通过。

### 4.2 Phase 2：前端类型 + 映射函数

**文件 1**: `frontend/src/types/memory.ts`

`WorkflowRunDetail` 追加两个可选字段：`nodes_json?: Node[]` 和 `edges_json?: Edge[]`。

**文件 2**: `frontend/src/app/m/[id]/inject-traces.ts`（新建）

纯函数，将 traces 数据注入到 nodes 的 data 中。同时导出一个辅助函数 `findOrphanTraces` 用于识别孤立 trace（有 trace 但 nodes_json 中无对应节点）。

### 4.3 Phase 3：Layout 重写

**文件**: `frontend/src/app/m/[id]/layout.tsx`

从当前的文档流布局：
```
<div className="relative min-h-screen w-screen bg-background">
  <header>粘性顶栏</header>
  <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
</div>
```

改为全屏画布布局（参考 `/s/[id]/layout.tsx`）：
```
<div className="relative h-screen w-screen overflow-hidden bg-background">
  <SessionRefresher />
  <header>浮动顶栏（absolute, pointer-events-none）</header>
  <main className="absolute inset-0 block h-full w-full">{children}</main>
</div>
```

顶部标签改为 "运行记忆 · Memory View"。

### 4.4 Phase 4：MemoryView 重写

**文件**: `frontend/src/app/m/[id]/MemoryView.tsx`

整体结构参考 `PublicWorkflowView.tsx`，但替换社交功能为运行摘要：

```
┌─────────────────────────────────────────────────────────┐
│ ← StudySolo                    运行记忆 · Memory View    │  ← 浮动顶栏
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────┐                    ┌──────────────┐   │
│  │ 运行摘要面板  │                    │ 操作按钮组    │   │
│  │              │                    │              │   │
│  │ 工作流名称    │                    │ [分享开关]    │   │
│  │ 执行时间      │                    │ [复制链接]    │   │
│  │ 总耗时        │    ReadOnlyCanvas  │ [进入编辑]    │   │
│  │ Token 消耗    │    (全屏画布背景)   │              │   │
│  │ 节点统计      │                    └──────────────┘   │
│  │ (完成/错误)   │                                       │
│  └──────────────┘                                       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 孤立 Trace 列表（仅当存在不匹配节点时显示）       │   │  ← 底部浮动
│  └──────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**核心逻辑**:

1. 从 props 接收 `WorkflowRunDetail`（含 `nodes_json`, `edges_json`, `traces`）
2. 调用 `injectTracesIntoNodes()` 将 trace 数据注入节点
3. 初始化 `useWorkflowStore`（`setCurrentWorkflow` + 强制 `showAllNodeSlips`）
4. 渲染 `ReadOnlyCanvas`（传入注入后的 nodes + edges）
5. 渲染浮动运行摘要面板（左侧）
6. 渲染操作按钮组（右侧）
7. 如有孤立 trace，底部浮动展示简化列表

**无画布数据的 Fallback**:

如果 `nodes_json` 为空（workflow 已被删除），降级为当前的卡片列表视图（保留现有 `TraceCard` 组件作为 fallback）。

### 4.5 Phase 5：验证

- `npm run lint` 通过
- `npm run lint:lines:strict` 通过
- Next.js 构建 `✓ Compiled successfully`
- `/m/[id]` 路由正常注册
- 后端 `python -m pytest tests` 通过

---

## 五、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `nodes_json` 体积大（50KB+）增加传输成本 | 页面加载变慢 | 可接受：与 `/s/[id]` 相同量级，且只在详情页加载 |
| workflow 已删除，`nodes_json` 为空 | 画布无法渲染 | Fallback 到当前卡片列表视图 |
| 用户执行后修改了画布，trace node_id 不匹配 | 部分节点无执行数据 | 未匹配节点显示 pending，孤立 trace 底部列表展示 |
| `NodeResultSlip` 依赖 `useWorkflowStore.showAllNodeSlips` | 执行结果不显示 | 挂载时初始化 Store 并强制开启 |
| `AIStepNode` 内部的编辑功能（配置按钮、click-to-connect） | 只读页面出现编辑入口 | ReadOnlyCanvas 已设置 `nodesDraggable=false` 等，配置按钮点击无效（无画布上下文），可接受；如需完美隐藏，后续可给 AIStepNode 加 `readOnly` prop |

---

## 六、后续优化（不在本次范围）

1. **执行回放动画**: 按 trace 的 `execution_order` 逐步高亮节点，模拟执行过程的时间线回放
2. **AIStepNode readOnly prop**: 在只读场景下隐藏配置按钮、模型选择器等编辑入口
3. **trace 快照版本化**: 在执行时保存当时的 `nodes_json` 快照到 `ss_workflow_runs`，避免后续编辑导致的不匹配问题
4. **执行对比视图**: 同一工作流的多次运行结果对比

---

## 七、实施顺序与预估

| 阶段 | 内容 | 预估工作量 |
|------|------|-----------|
| Phase 1 | 后端 API 扩展（追加 nodes_json/edges_json） | 小（~15 分钟） |
| Phase 2 | 前端类型 + inject-traces 映射函数 | 小（~20 分钟） |
| Phase 3 | Layout 重写（全屏画布布局） | 小（~10 分钟） |
| Phase 4 | MemoryView 重写（画布 + 浮动面板） | 中（~45 分钟） |
| Phase 5 | 验证 + 边界情况处理 | 小（~15 分钟） |
| **合计** | | **~1.5~2 小时** |

---

## 八、关键文件依赖图

```
后端:
  workflow_runs.py ──查询──→ ss_workflows (nodes_json, edges_json)
                   ──查询──→ ss_workflow_run_traces (traces)
                   ──返回──→ WorkflowRunDetail (含画布 + traces)

前端 SSR:
  m/[id]/page.tsx ──调用──→ memory.server.service.ts
                  ──传递──→ MemoryView (props: WorkflowRunDetail)

前端渲染:
  MemoryView.tsx
    ├── inject-traces.ts ──映射──→ 注入后的 nodes[]
    ├── useWorkflowStore.setCurrentWorkflow() ──初始化──→ Store
    ├── ReadOnlyCanvas (nodes, edges)
    │     ├── AIStepNode (自动复用)
    │     │     └── NodeResultSlip (自动复用)
    │     │           └── getRenderer() → 各节点渲染器 (自动复用)
    │     ├── SequentialEdge (自动复用)
    │     └── AnimatedEdge (自动复用)
    ├── RunSummaryPanel (新建，浮动左侧)
    └── ActionButtons (新建，浮动右侧)
         ├── ShareToggle (从现有 MemoryView 提取)
         └── 进入编辑按钮
```
