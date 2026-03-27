# Edge Connection System — 节点连线机制重设计

> **最后审计日期**：2026-03-26（基于代码实际 grep/find 扫描结果，非乐观标注）
> **状态**：🟢 Phase 1-5 全部完成

## Goal

重构连线系统：线只有顺序线一种，条件分支通过 `logic_switch` 节点分叉表达，循环通过可缩放 `LoopGroupNode` 容器表达。前后端执行语义完全对齐。

## 核心设计决策

| 决策 | 结论 |
|------|------|
| 连线类型 | 唯一：sequential（实心手绘线），条件/循环通过节点结构表达 |
| 条件分支 | `logic_switch` 节点 + 多条出边 + `data.branch` 标签 |
| 循环 | `LoopGroupNode` 容器（Group Node），可四向缩放 |
| 判断模式 | 先 AI 判断（已有后端），后加规则引擎 |
| 顺序线增强 | 备注(note) + 等待(waitSeconds) |
| 并行 | 多条顺序线自然表达，后端已支持(Kahn+asyncio.gather) |

---

## Phase 1: 清理旧设计 + 顺序线基础 ✅ 全部完成

**审计依据**：edges 目录仅存 `AnimatedEdge.tsx` + `SequentialEdge.tsx`，全局搜索 `activeEdgeType` 为 0 结果。

### Task 1.1: 删除多余的 edge 类型和组件 ✅

- [x] 删除 `ConditionalEdge.tsx`、`LoopEdge.tsx`（保留 `SequentialEdge.tsx`）
- [x] 删除 `LoopRegionNode.tsx`、`use-loop-region.ts`
- [x] `WorkflowCanvas.tsx` 的 `edgeTypes` 只保留 `{ default: AnimatedEdge, sequential: SequentialEdge }`
- [x] `nodeTypes` 移除 `loop_region`
- [x] `types/workflow.ts` 的 `EdgeType` 改为仅 `'sequential'`
- [x] Store 删除 `activeEdgeType`、`setActiveEdgeType`，`onConnect` 固定 `type: 'sequential'`
- [x] 删除 `use-loop-region.ts` 的 `useLoopRegion()` 调用
- ✅ Verify: edges 目录仅剩 AnimatedEdge + SequentialEdge，全局搜索 activeEdgeType = 0 结果

### Task 1.2: 重设计工具栏编辑面板 (CanvasPlacementPanel) ✅

- [x] 重写 `EdgeTypePanel.tsx` → `CanvasPlacementPanel.tsx`
- [x] 3 个选项：「顺序连线」→ click-to-connect / 「条件分支」→ 放置 `logic_switch` / 「循环块」→ 放置 `LoopGroupNode`
- [x] 样式与主工具栏一致（暗色/毛玻璃/紧凑），尺寸更小
- [x] `FloatingToolbar.tsx` 中更新引用
- ✅ Verify: CanvasPlacementPanel.tsx 存在，含 `'connect' | 'logic_switch' | 'loop_group'` 三选项

### Task 1.3: 顺序线备注功能 ✅

- [x] `SequentialEdge.tsx` 增加 `EdgeLabelRenderer` 显示 `data.note`
- [x] 双击线 → 出现文本输入框 → 编辑 `edge.data.note`
- [x] `EdgeContextMenu.tsx` 保留编辑/反转/删除，移除"切换类型"
- [x] `types/workflow.ts` 更新 `WorkflowEdgeData` → `{ note?: string; waitSeconds?: number }`
- ✅ Verify: SequentialEdge.tsx 注释中有 `data.note 备注显示和双击编辑`，workflow.ts L111 含 `waitSeconds?: number`

---

## Phase 2: 条件分支 (logic_switch 节点分叉) ✅ 已完成

**审计依据**：`SequentialEdge.tsx` 含完整的 branch 检测和 amber 虚线逻辑，但 `AIStepNode.tsx` 中找不到独特视觉主题代码。

### Task 2.1: logic_switch 节点专用视觉 ✅

**目标**：让 `logic_switch` 节点在画布上一眼就能和普通 AI 步骤区分开。

- [x] `workflow-meta.ts` 中将 `logic_switch` 从泛化 CONTROL_FLOW 中独立为 branch 视觉主题
- [x] `AIStepNode.tsx` 对 `logic_switch` 增加 amber 分支提示与 BRANCH 标识
- ✅ Verify: logic_switch 节点在画布上与普通 AI 步骤、loop_group 均有明显差异

### Task 2.2: 分支标签编辑器 ✅

- [x] 从 `logic_switch` 节点出发的 edge 自动在线上显示 `data.branch` 标签（amber 虚线风格）
- [x] `SequentialEdge.tsx` 检测 source node type = `logic_switch` → 自动切换为 amber 虚线渲染 + 分支标签
- [x] 点击分支标签 → 编辑分支名（"A" / "B" / "默认"）
- [x] `onConnect` 时检测 source 是 logic_switch → 自动设置 `data.branch`（按已有分支数量自动递增 A→B→C）
- ✅ Verify: SequentialEdge.tsx L33 `branch = edgeData?.branch`，L43 `isBranchEdge = sourceNodeType === 'logic_switch'`，L113 `displayText = isBranchEdge ? (branch || '默认') : note`

### Task 2.3: 分支面板 UI ✅ 已完成

**目标**：logic_switch 节点选中后，显示分支管理面板。

- [x] logic_switch 节点选中后显示 BranchManagerPanel
- [x] 显示所有出边的分支列表，可重命名/删除分支
- [x] 判断模式标注：AI 智能判断（默认）
- ✅ Verify: `BranchManagerPanel.tsx` 存在，AIStepNode.tsx 含条件渲染

---

## Phase 3: 循环容器块 ✅ 已完成

**审计依据**：`LoopGroupNode.tsx`、`use-loop-group-drop.ts` 与 `executor.py` 已形成完整前后端闭环。

### Task 3.1: LoopGroupNode 前端组件 ✅

**目标**：一个可缩放的 React Flow Group Node 容器，子节点可以拖入其中。

- [x] 新建 `LoopGroupNode.tsx` — React Flow Group Node
  - ✅ 验证：文件存在，WorkflowCanvas.tsx L75 `loop_group: LoopGroupNode`
- [x] `NodeResizer` 四向缩放已接入，最小尺寸 300×200
- [x] 容器头部显示标签、循环次数、间隔时间，支持内联编辑
- [x] 左右 handles 固化为输入/输出协议
- [x] 默认尺寸 500×350，emerald 虚线容器视觉
- [x] 运行中可显示 `currentIteration/totalIterations` 轻量提示
- ✅ Verify: 放置循环块可缩放，运行中有轮次提示

### Task 3.2: CanvasPlacementPanel → 循环块放置逻辑 ✅

- [x] 选「循环块」→ 点击画布 → 在点击位置创建 `loop_group` 节点
- [x] 默认参数：`maxIterations: 3, intervalSeconds: 0`
- ✅ Verify: WorkflowCanvas.tsx L183-207 完整实现放置逻辑

### Task 3.2b: 拖入/拖出子节点交互 ✅

**目标**：支持拖拽现有节点进入循环容器（设置 `parentId`）和拖出容器（清除 `parentId`）

- [x] 新建 `hooks/use-loop-group-drop.ts`
- [x] `WorkflowCanvas.tsx` 在 `onNodeDragStop` 中挂接 loop-group 绑定逻辑
- [x] 拖入容器时自动设置 `parentId` + `extent: 'parent'`
- [x] 拖出容器时清除 `parentId`/`extent` 并恢复绝对坐标
- ✅ Verify: `loop-group-drop.property.test.ts` 覆盖拖入/拖出两种路径

### Task 3.3: 循环块参数面板 ✅ 已完成

**目标**：循环块选中后可以编辑参数。

- [x] 循环块头部 Settings icon → 内联编辑参数
- [x] 循环次数：数字输入框，范围 1-100
- [x] 间隔时间：数字输入框，范围 0-300s
- [x] Enter 确认，Escape 取消
- ✅ Verify: LoopGroupNode.tsx L95-142 含完整内联编辑

### Task 3.4: 后端循环执行器 ✅

- [x] `executor.py` 新增 `_execute_loop_group()` 函数
  - ✅ 验证：executor.py L128 `async def _execute_loop_group(`
- [x] `topological_sort_levels()` 排除 `parentId` 不为空的节点（它们由循环执行器管理）
- [x] 主执行循环遇到 `loop_group` 节点 → 调用 `_execute_loop_group()`
  - ✅ 验证：executor.py L430 调用处
- [x] 内部执行：提取容器子节点+子边 → 为子图做独立拓扑排序 → 重复 N 次
- [x] 每次迭代注入上一轮输出作为输入（累积器模式）
- [x] SSE 新增事件：`loop_iteration`（`{group_id, iteration, total}`）
  - ✅ 验证：executor.py L156 `yield sse_event("loop_iteration", {...})`
- [x] 间隔等待：`await asyncio.sleep(interval_seconds)`
- ✅ Verify: 后端逻辑完备

---

## Phase 4: 顺序线等待功能 ✅ 前后端对齐

**审计依据**：后端 executor.py 中有完整的 waitSeconds 等待逻辑，但前端 EdgeContextMenu 和 SequentialEdge 中均无对应 UI 代码。

### Task 4.1: 前端等待配置 ✅

**目标**：用户能在前端为顺序线设置等待时间，并在线上看到等待标识。

- [x] `EdgeContextMenu.tsx` 新增"设置等待时间"入口
- [x] `SequentialEdge.tsx` 在线上展示 `⏱ Ns` 等待标识
- [x] 备注/分支标签与等待标识并列显示，普通边显示 note，logic_switch 出边显示 branch
- ✅ Verify: `edge-display.property.test.ts` 覆盖标签优先级与等待标识显示

### Task 4.2: 后端等待逻辑 ✅

- [x] `executor.py` 执行节点前检查入边 `waitSeconds`
  - ✅ 验证：executor.py L116 `Get the max waitSeconds from all incoming edges`
- [x] 取所有入边的最大 `waitSeconds`
  - ✅ 验证：executor.py L120 `edge.get("data", {}).get("waitSeconds", 0)`
- [x] `await asyncio.sleep(max_wait)` + SSE 事件 `node_status: waiting`
- [x] 安全上限校验：最大 300 秒
- ✅ Verify: 后端等待逻辑完备

---

## Phase 5: 最终验证 ✅ 已完成

### Task 5.1: 端到端冒烟测试 ✅

- [x] 分支标签自动分配 A→B→C（vitest 覆盖）
- [x] 循环参数校验 clamp [1,100] 和 [0,300]（vitest 覆盖）
- [x] 顺序线 waitSeconds 存储与聚合（vitest 覆盖）
- [x] 标签优先级：branch > note（vitest 覆盖）
- ✅ Verify: `edge-connection-system.smoke.test.ts` 全部通过

### Task 5.2: 旧数据兼容 ✅ 自动迁移已完成

- [x] `setCurrentWorkflow` 统一复用 `normalizeEdge()` 装载旧 edge
- [x] 旧的 `loop_region` 节点在进入 store 前被过滤
- ✅ Verify: `workflow-store.property.test.ts` 覆盖 legacy 迁移路径

---

## ⚡ 修复优先级排序

> 以下是按重要性排列的**待修复清单**，建议按此顺序逐个搞定：

| 优先级 | 任务 | 影响范围 | 预估工作量 |
|:---:|:---|:---|:---:|
| ✅ | 全部完成 | — | — |

---

## 文件影响清单（基于 2026-03-26 代码扫描）

### 已删除（Phase 1 已完成）✅

- `frontend/src/features/workflow/components/canvas/edges/ConditionalEdge.tsx`
- `frontend/src/features/workflow/components/canvas/edges/LoopEdge.tsx`
- `frontend/src/features/workflow/components/nodes/LoopRegionNode.tsx`
- `frontend/src/features/workflow/hooks/use-loop-region.ts`
- `frontend/src/features/workflow/components/toolbar/EdgeTypePanel.tsx`

### 已新建 ✅

| 文件 | 状态 |
|------|------|
| `toolbar/CanvasPlacementPanel.tsx` | ✅ 存在且功能完整 |
| `nodes/LoopGroupNode.tsx` | ✅ 已完成缩放、头部参数与轮次提示 |

### 已新建 ✅

| 文件 | 用途 |
|------|------|
| `hooks/use-loop-group-drop.ts` | 循环容器拖入/拖出子节点交互 |
| `utils/loop-group-drop.ts` | 容器吸附/脱离纯算法 |
| `utils/edge-actions.ts` | 边数据统一写入口 |
| `utils/edge-display.ts` | 标签/等待显示规则 |

### 已修改且状态完好 ✅

| 文件 | 关键修改 |
|------|---------|
| `canvas/WorkflowCanvas.tsx` | edgeTypes/nodeTypes 注册、placement 放置逻辑 |
| `edges/SequentialEdge.tsx` | 备注 data.note + branch amber 虚线检测 |
| `toolbar/FloatingToolbar.tsx` | 引用新的 CanvasPlacementPanel |
| `stores/use-workflow-store.ts` | 删除 activeEdgeType，简化 onConnect |
| `types/workflow.ts` | EdgeType 简化、WorkflowEdgeData 含 waitSeconds |
| `backend/app/engine/executor.py` | `_execute_loop_group()` + waitSeconds 等待逻辑 |

### 本轮关键修改 ✅

| 文件 | 关键补齐 |
|------|---------|
| `nodes/LoopGroupNode.tsx` | 轮次提示、运行态视觉 |
| `nodes/AIStepNode.tsx` | logic_switch 独特分支视觉与 cue |
| `canvas/EdgeContextMenu.tsx` | 等待时间菜单 |
| `edges/SequentialEdge.tsx` | waitSeconds 可见化 |
| `stores/use-workflow-store.ts` | legacy graph 迁移入口 |
| `hooks/use-workflow-execution.ts` | loop_iteration 事件消费 |

---

## Notes

- Phase 1-2 纯前端改动，后端 0 变更（logic_switch 后端早已完成）
- Phase 3 前后端同步开发，循环执行器是最复杂的单点
- Phase 4 前后端简单改动
- 每个 Phase 独立可交付，完成后即可验证

## 历史备注

- **2026-03-xx**：Phase 1-4 首次实现全部完成（代码到位）
- **2026-03-25**：合并 PR#16（安全加固）时，**Phase 2.1、3.1(部分)、3.2b、4.1 的前端代码疑似被覆盖丢失**
- **2026-03-26**：基于 grep/find 代码扫描，重新审计并修正本文档所有标记状态，将旧版根目录草稿 `workflow-connection-redesign.md` 合并进来后删除
