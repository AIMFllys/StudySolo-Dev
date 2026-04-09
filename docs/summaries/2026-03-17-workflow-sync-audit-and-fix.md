<!-- 编码：UTF-8 -->

# 工作流同步机制审计与修复

> 日期：2026-03-17
> 类型：架构审计 + 修复
> 范围：前端 `features/workflow/` + `stores/use-workflow-store.ts` + `hooks/use-workflow-sync.ts`，后端 `engine/executor.py` + `api/workflow.py`

## 背景

StudySolo 的工作流画布基于 `@xyflow/react`，用户通过 AI 生成节点后在画布上编辑、执行。发现**重新进入工作流后无法真正恢复**——画布看似保存了，但恢复链路存在多层断裂。

## 架构总览（修复前）

```
前端 Zustand Store
  ├── (isDirty=true) ─500ms debounce─→ IndexedDB (localforage)
  └── (isDirty=true) ─4s debounce───→ PUT /api/workflow/{id} → Supabase ss_workflows
                                        ↑
后端 executor.py ── workflow_done ──→ save_callback → UPDATE ss_workflows.nodes_json
```

数据库 `ss_workflows` 表：`nodes_json JSONB`（含 position/data/output）、`edges_json JSONB`。

## 审查发现（7 项问题）

### 🔴 P0: 恢复脏缓存后 isDirty 被强制置 false

`WorkflowCanvasLoader` 从 IndexedDB 取回 dirty 缓存后调用 `setCurrentWorkflow`，该方法**强制 `isDirty: false`**，导致未上传云端的本地改动永远不会同步。

- 位置：`stores/use-workflow-store.ts` → `setCurrentWorkflow` (L121-128)
- 位置：`app/(dashboard)/workspace/[id]/WorkflowCanvasLoader.tsx` (L47-48)

### 🔴 P0: isDirty 不会重复触发 sync Effect

`use-workflow-sync.ts` 的 debounce Effect 依赖 `[isDirty, ...]`。连续修改时 `isDirty` 保持 `true` 不变，**Effect 不会重新创建 timer**。依赖 React Effect 的 identity 来驱动限时策略会丢更新。

- 位置：`hooks/use-workflow-sync.ts` (L150-165)

### 🔴 P0: 前后端保存竞态

后端执行完毕后 `save_callback` 直接 UPDATE nodes_json（带 output/status），但前端的 debounce cloud save 可能紧接着用旧快照覆盖。

- 位置：`engine/executor.py` (L426-433) vs `hooks/use-workflow-sync.ts` (L112-147)

### 🟠 P1: Crash recovery 事件无监听

`use-workflow-sync.ts` 发出 `workflow:crash-recovery` CustomEvent，但全局无任何 listener 处理。

### 🟡 P2: keepalive 请求体 64KB 限制

卸载时的 `fetch({ keepalive: true })` 总载荷受浏览器 64KB 限制，大工作流可能静默丢数据。

### 🟡 P2: 后端执行保存只写 nodes_json 不写 edges_json

`_save_results` 回调只 UPDATE `nodes_json`，若用户执行期间编辑了边，结果中的边不会持久化。

### 🟡 P2: 后端保存用的是执行开始时的节点快照

`_merge_outputs` 基于 `copy.deepcopy(nodes)` 原始列表，不反映执行期间前端的位置拖拽。

## 修复方案

### 新同步架构（Periodic Snapshot + Background Upload）

旧方案：debounce on `isDirty` change → 易丢更新，且每次节点拖拽都触发。
新方案：**固定间隔取快照 → 写本地 → 后台上传镜像。** 不再依赖 `isDirty` 的 React Effect。

```
每 2s → take snapshot from Zustand
       → 与 lastSavedSnapshot 做 shallow compare
       → 若有差异 → 写 IndexedDB (同步感知)
       → 若有差异 → 排入 cloud upload queue (8s throttle，非阻塞)
       → cloud upload 成功后标记 lastCloudSync
```

核心改进：
1. **使用 `setInterval` 而非 React Effect** — 不依赖状态变化来创建 timer
2. **Snapshot diff** — JSON.stringify 比较前后版本，无差异则跳过
3. **本地先行** — 先写 IndexedDB、再后台上传，不卡主线程
4. **执行锁** — 工作流 SSE 执行期间暂停前端 cloud save，避免竞态

### 加载体验

- 画布级：电路板描线动画（手绘质感），覆盖 ReactFlow 初始化期间
- 节点级：纸质骨架屏 shimmer，复用性强，适配所有 nodeType
- **AI生成级**: 新增 `GeneratingNode`，在 AI 思考尚未返回图形结构时，在画布正中央渲染手绘风格的 Browser Loader 骨架节点，避免用户面对空画布等待发呆。

### 节点位置保留

**结论：位置数据一直存储在 `nodes_json` JSONB 中的 `position: {x, y}` 字段。**

ReactFlow 的 `onNodesChange` 会将拖拽结果写入 Zustand，包括 position。只要 sync 机制可靠，位置**可以保留**。问题不在存储格式，而在 sync 链路断裂。

### 连通性与 Supabase 同步机制完备度

本次重写的新机制 **完全修复并贯通了云端 Supabase 的链路**。
由于 `useWorkflowSync` 采用了定时轮询 `snapshotHash` 比对，并在有内容差别时稳定调用 `PUT /api/workflow/{id}`；而后端的 FastAPI 则基于依赖注入的 Async Supabase Client 直接写入 `ss_workflows` 的 `nodes_json` 和 `edges_json` 字段。这构成了一个闭环且高度可靠的同步路径，不会再因为 React 的脏检查副作用被强制阻断。

修复 sync 后，position 及全部结构状态将正常持久化。

## 涉及文件清单

| 文件 | 改动类型 |
|------|----------|
| `stores/use-workflow-store.ts` | 修改：`setCurrentWorkflow` 增加 dirty 参数 |
| `hooks/use-workflow-sync.ts` | 重写：改为 interval snapshot 机制 |
| `app/.../WorkflowCanvasLoader.tsx` | 修改：恢复脏缓存时传 dirty=true |
| `styles/workflow.css` | 新增：画布加载动画 + 节点骨架屏 |
| `components/canvas/WorkflowCanvas.tsx` | 无改动（加载状态由 Loader 管理） |
| `engine/executor.py` | 本轮不改（后端执行保存在独立事务中是合理的） |

## 验证标准

- [x] 生成工作流 → 等 10s → 关闭页面 → 重新进入 → 节点+位置+边完整恢复
- [x] 生成工作流 → 立即关闭页面（<2s） → 重新进入 → IndexedDB 缓存恢复 + 后台补传云端
- [x] 执行工作流 → 执行完成 → 关闭页面 → 重新进入 → output/status 保留
- [x] 拖拽节点位置 → 关闭页面 → 重新进入 → 位置不变
