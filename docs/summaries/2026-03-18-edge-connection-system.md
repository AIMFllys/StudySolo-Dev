<!-- 编码：UTF-8 -->

# 工作流连线系统完整实现

> 日期：2026-03-18
> 类型：功能实现（Phase 1-6 完整交付）
> 范围：前端 `features/workflow/` + `stores/use-workflow-store.ts` + `types/workflow.ts` + `styles/workflow.css`

## 背景

StudySolo 的工作流画布基于 `@xyflow/react`，允许用户通过 AI 生成节点并在画布上编排执行流程。在此之前：

- 节点间只有一种默认连线（`AnimatedEdge`），无类型区分
- 节点只有 2 个 Handle（左入右出），无法从任意方位连接
- 没有"编辑按钮"的实际功能，仅弹出"敬请期待"弹窗
- 不支持连线右键菜单、标签编辑、端点重连
- 没有 click-to-connect（点击建连）交互模式
- 缺少循环区域的视觉表达

本次实现了**完整的连线系统**，覆盖 3 种线型、2 种建连方式、端点重连、右键菜单、键盘交互、循环区域自动管理。

## 架构概览

```
用户操作层
├── 拖拽建连: Handle → onConnect → addEdge(activeEdgeType)
├── 点击建连: Source Handle click → 状态机 → Target Handle click → completeClickConnect
├── 端点重连: 拖拽端点 → reconnectEdge(25px 磁吸)
├── 右键菜单: onEdgeContextMenu → EdgeContextMenu(编辑/改类型/反转/删除)
└── 键盘操作: Delete(原生) / Escape(取消 click-connect)

数据层 (Zustand Store)
├── activeEdgeType: EdgeType          ← EdgeTypePanel 设置
├── clickConnectState: ClickConnectState  ← 点击建连状态机
├── edges: Edge[]                     ← 带 type/sourceHandle/targetHandle/data
├── onConnect()                       ← 自动注入 activeEdgeType + handle ID
├── startClickConnect()               ← 记录源节点/handle
├── completeClickConnect()            ← 创建 edge + 重置
└── cancelClickConnect()              ← Escape/paneClick 重置

渲染层 (React Flow)
├── SequentialEdge   ← type="sequential"  实心手绘线
├── ConditionalEdge  ← type="conditional" 虚线 amber + 可编辑标签
├── LoopEdge         ← type="loop"        正弦波浪 emerald
├── LoopRegionNode   ← type="loop_region" 循环区域虚线块
└── EdgeTypePanel    ← 连线类型选择面板 (工具栏编辑按钮触发)

自动管理层
└── useLoopRegion hook: edges 变化 → 检测 loop edge 增减 → 自动创建/删除 LoopRegionNode
```

## 三种连线类型

### 1. 顺序流 (Sequential Edge)

**视觉**：实心手绘线 + pencil SVG filter + 标准箭头
**颜色**：`#78716c`（石灰色，笔记风格）
**含义**：做完 A → 接着做 B，最基础的流程串联
**标签**：可选，默认不显示

```
节点 A ════════▶ 节点 B
```

### 2. 条件分支 (Conditional Edge)

**视觉**：虚线 (dash: 8 5) + pencil filter + amber 色系
**颜色**：`#d97706`（琥珀色，警示感）
**含义**：满足某条件时走此路径，常用于 if/else 分流
**标签**：强制显示（默认 "条件"），支持双击内联编辑
**编辑**：双击标签 → input 框 → Enter 保存 / Escape 取消

```
节点 A ─ ─ ─ ─ ▷ 节点 B
         ⑂ 条件
```

### 3. 循环迭代 (Loop Edge)

**视觉**：正弦波浪路径 + pencil filter + emerald 色系
**颜色**：`#059669`（翡翠绿，生长感）
**含义**：对集合中每项重复执行，或按次数循环
**标签**：强制显示（默认 "循环"）
**特殊**：创建后自动生成 LoopRegionNode（虚线围合区域）

```
节点 A ∿∿∿∿∿∿▶ 节点 B
       🔄 循环
   ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
   │   循环区域          │
   │  [节点A]  [节点B]   │
   └─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

## 连线方式

### 方式一：拖拽建连（Drag-to-Connect）

经典 React Flow 交互：从 Source Handle 拖出 → 拖到 Target Handle 松开。

**流程**：
1. 鼠标 hover 节点 → 8 个 Handle 淡入显示
2. 从任意 Source Handle 开始拖拽 → 画布上所有节点 Handle 0.7 透明度亮起
3. 拖拽至目标 Target Handle → 松开鼠标
4. `onConnect` 自动使用 `activeEdgeType` 创建带类型的 edge
5. 带快照 → 支持 Undo

### 方式二：点击建连（Click-to-Connect）

无需拖拽，适合触屏和精确操作场景。

**状态机**：
```
idle ──[点击 Source Handle]──▶ waiting-target
                                  │
                    ┌──────────────┼──────────────┐
                    │              │              │
              [点击 Target]  [点击相同 Source] [Escape/paneClick]
                    │              │              │
                    ▼              ▼              ▼
              创建 edge          idle           idle
              回到 idle
```

**视觉反馈**：
- 源 Handle 被点击后：放大 + 发光脉冲动画 (`handlePulse`)
- 其他节点的 Target Handle：浮现 + 绿色呼吸光 (`targetGlow`)
- 点击目标 Handle 后，两端动画消失，edge 创建完成

### 端点重连（Edge Reconnection）

已有 edge 的端点可以拖拽到其他 Handle：
- `edgesReconnectable={true}` + `reconnectRadius={25}`（25px 磁吸范围）
- 拖拽端点到空白处松开 → 自动删除该 edge
- 拖拽端点到另一个 Handle → 更新 edge 的 source/target
- 重连操作带快照 → 支持 Undo

## Handle 系统

### 8 Handle 布局

每个 AIStepNode 有 8 个 Handle，覆盖 4 个方位 × 2 个角色：

```
            target-top    source-top
                ●            ●
                │            │
target-left ●──┤  NODE  ├──● source-right
                │            │
                ●            ●
         target-bottom  source-bottom
```

- **Target (输入)**：target-left, target-top, target-right, target-bottom
- **Source (输出)**：source-right, source-bottom, source-left, source-top

### 智能显隐

```
默认状态        → 完全隐藏 (opacity: 0, scale: 0.4)
鼠标 hover 节点 → 渐显 (opacity: 1, scale: 1)
节点被选中      → 保持显示
拖拽连线中      → 全局 0.7 透明度显示
已连接 Handle   → 始终显示
click-connect 激活 → 源 Handle 脉冲, 目标 Handle 绿光
```

## 连线交互

### 选中

点击连线 → React Flow 原生选中 → 加粗 + 发光效果：
- Sequential: 加粗至 3px + 光晕
- Conditional: 加粗至 3px + amber 光晕
- Loop: 加粗至 3px + emerald 光晕

### 右键菜单 (EdgeContextMenu)

右键点击连线弹出上下文菜单：

| 操作 | 说明 |
|------|------|
| **编辑标签** | `prompt()` 输入新标签文本 |
| **顺序流 / 条件分支 / 循环迭代** | 切换 edge 类型（当前类型显示 ✓） |
| **反转方向** | 交换 source ↔ target，同时翻转 handle ID |
| **删除连线** | 从 edges 数组中移除，带快照 |

### 双击编辑（条件线专属）

双击 ConditionalEdge 的标签 → 出现 inline input 框：
- Enter → 保存修改到 store
- Escape → 取消编辑
- 点击外部 (blur) → 保存

### 键盘操作

| 按键 | 操作 |
|------|------|
| `Delete` / `Backspace` | 删除选中的 edge（React Flow 原生） |
| `Escape` | 取消 click-to-connect 模式 |
| `Ctrl+Z` | 撤销上一步连线操作 |
| `Ctrl+Shift+Z` / `Ctrl+Y` | 重做 |

## 循环区域 (Loop Region)

### 自动生成逻辑

由 `useLoopRegion` hook 管理，监听 `edges` 数组变化：

```typescript
// 伪代码
loop edges 新增 → 计算 source/target 节点的 bounding box → 外扩 40px → 创建 LoopRegionNode
loop edges 删除 → 找到对应 loop-region-{edgeId} 节点 → 删除
```

**防无限循环**：使用 `useRef<Set<string>>` 跟踪上一次的 loop edge ID 集合，仅在集合产生差集时触发 `setNodes`。effect 仅依赖 `edges`，不依赖 `nodes`，避免 setNodes → nodes 变化 → effect 再次触发的循环。

### LoopRegionNode 特性

| 特性 | 说明 |
|------|------|
| **外观** | 翡翠绿虚线边框 + 半透明背景 |
| **头部** | 循环图标 + "循环区域" 标签 |
| **可操作** | 可拖拽、可选中、可 resize、可删除 |
| **层级** | `zIndex: -1`，位于节点下方 |
| **执行意义** | 暂无执行语义，仅作视觉辅助 |

## 编辑按钮 → 连线面板

### 之前

工具栏编辑按钮（Pencil 图标）点击后弹出 "敬请期待" 弹窗。

### 之后

点击编辑按钮 → toggle 显示 `EdgeTypePanel`：

```
┌─────────────────────┐
│  连线类型            ×│
│                      │
│  → 顺序流            ●│  ← active 指示器
│    ════════▶          │
│                      │
│  ⑂ 条件分支           │
│    ─ ─ ─ ─ ▷         │
│                      │
│  🔄 循环迭代          │
│    ∿∿∿∿∿∿▶           │
│                      │
│  选择类型后，拖拽或    │
│  点击 Handle 建连     │
└─────────────────────┘
```

**面板行为**：
- 仅通过 × 按钮或再次点击编辑按钮关闭
- 点击画布**不能**关闭面板（`stopPropagation`）
- 选择类型后立即生效，后续建连使用选中类型
- 面板出现时有 glass morphism + 弹入动画

## 数据模型

### Edge 类型定义

```typescript
// types/workflow.ts
export type EdgeType = 'sequential' | 'conditional' | 'loop';

export type HandlePosition =
  | 'source-top' | 'source-right' | 'source-bottom' | 'source-left'
  | 'target-top' | 'target-right' | 'target-bottom' | 'target-left';

export interface WorkflowEdgeData {
  label?: string;           // 显示在连线上的文本
  branch?: string;          // 条件分支标识符
  maxIterations?: number;   // 循环最大次数
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: HandlePosition;  // 新增
  targetHandle?: HandlePosition;  // 新增
  type?: EdgeType;                // 新增
  data?: WorkflowEdgeData;        // 新增
}
```

### Store 状态

```typescript
// stores/use-workflow-store.ts (新增字段)
interface WorkflowStore {
  activeEdgeType: EdgeType;              // 当前选中的连线类型
  clickConnectState: ClickConnectState;  // 点击建连状态机

  setActiveEdgeType: (type: EdgeType) => void;
  startClickConnect: (nodeId: string, handleId: string) => void;
  completeClickConnect: (nodeId: string, handleId: string) => void;
  cancelClickConnect: () => void;
}

interface ClickConnectState {
  phase: 'idle' | 'waiting-target';
  sourceNodeId?: string;
  sourceHandleId?: string;
}
```

### 旧数据兼容

`setCurrentWorkflow` 在加载工作流时自动补全缺失字段：

```typescript
edges: edges.map((e) => ({
  ...e,
  type: e.type || 'sequential',           // 默认顺序流
  sourceHandle: e.sourceHandle || 'source-right',  // 默认右出
  targetHandle: e.targetHandle || 'target-left',   // 默认左入
  data: e.data || {},
}))
```

## 手绘视觉效果

所有 edge 共享 **pencil-style SVG filter**（基于 feTurbulence + feDisplacementMap），使连线呈现手绘笔触效果，与项目整体的笔记手绘美学一致：

```xml
<filter id="pencil-{type}-{id}">
  <feTurbulence type="turbulence" baseFrequency="0.02~0.03"
                numOctaves="2~3" seed="{hash}" />
  <feDisplacementMap in="SourceGraphic" in2="noise"
                     scale="0.8~1.2" />
</filter>
```

每条线的 `seed` 由 edge ID 的字符 ASCII 值哈希决定，确保每条线的抖动纹理唯一且稳定。

## 涉及文件清单

### 新增文件 (7)

| 文件 | 行数 | 功能 |
|------|------|------|
| `features/workflow/components/canvas/edges/SequentialEdge.tsx` | 120 | 顺序流 edge 渲染组件 |
| `features/workflow/components/canvas/edges/ConditionalEdge.tsx` | 184 | 条件分支 edge 渲染 + 内联编辑 |
| `features/workflow/components/canvas/edges/LoopEdge.tsx` | 164 | 循环波浪 edge 渲染 |
| `features/workflow/components/toolbar/EdgeTypePanel.tsx` | 129 | 连线类型选择面板 |
| `features/workflow/components/canvas/EdgeContextMenu.tsx` | 168 | edge 右键上下文菜单 |
| `features/workflow/components/nodes/LoopRegionNode.tsx` | 58 | 循环区域标记节点 |
| `features/workflow/hooks/use-loop-region.ts` | 86 | 循环区域自动管理 hook |

### 修改文件 (6)

| 文件 | 改动类型 |
|------|----------|
| `types/workflow.ts` | 新增：`EdgeType`, `HandlePosition`, `WorkflowEdgeData`, `normalizeEdge()` |
| `stores/use-workflow-store.ts` | 新增：`activeEdgeType`, `clickConnectState`, 4 个 action；重写 `onConnect` |
| `features/workflow/components/nodes/AIStepNode.tsx` | 重写：2 Handle → 8 Handle + onClick click-to-connect |
| `features/workflow/components/canvas/WorkflowCanvas.tsx` | 新增：edgeTypes 注册、nodeTypes 注册、reconnect/edge handlers |
| `features/workflow/components/toolbar/FloatingToolbar.tsx` | 重写：编辑按钮 → EdgeTypePanel toggle |
| `styles/workflow.css` | 新增：~234 行（Handle 显隐、Edge 类型样式、面板、循环区域、click-connect 动画） |

## 如何通过线串联节点关系

### 数据流链路

```
用户选择线型 (EdgeTypePanel)
     │
     ▼
activeEdgeType 写入 Store
     │
     ▼
用户拖拽/点击 Handle
     │
     ├──[拖拽] React Flow onConnect(connection) →  Store.onConnect()
     │         自动附加: { type: activeEdgeType, sourceHandle, targetHandle, data }
     │
     └──[点击] AIStepNode Handle onClick()
              └── phase=idle → startClickConnect(nodeId, handleId)
              └── phase=waiting-target → completeClickConnect(nodeId, handleId)
                      自动附加: { type: activeEdgeType, sourceHandle, targetHandle, data }
     │
     ▼
edges[] 更新 → React Flow 重新渲染对应 Edge 组件
     │
     ├── type="sequential"  → SequentialEdge 组件渲染实心线
     ├── type="conditional" → ConditionalEdge 组件渲染虚线
     └── type="loop"        → LoopEdge 组件渲染波浪线
                                └── useLoopRegion 检测 → 生成 LoopRegionNode
     │
     ▼
edges[] 持久化 → useWorkflowSync → IndexedDB + Supabase (edges_json JSONB)
```

### 关系语义

| 线型 | 语义 | 在执行中的含义 |
|------|------|----------------|
| 顺序 (sequential) | A 完成后执行 B | 最基础的 DAG 前驱关系 |
| 条件 (conditional) | A 满足条件后走 B | 分支路由，label 描述条件内容 |
| 循环 (loop) | A 对集合中每项重复执行 B | 批量迭代，maxIterations 限制次数 |

### 多条线策略

- 一个节点可以有**多条出线**（多个 source handle 或同一个 source handle 连多条）
- 多条顺序线 = **并行分发**（类似 Promise.all）
- 多条条件线 = **条件路由**（匹配 label 的路径执行）
- 支持线条交叉、同节点多入多出

## 验证清单

- [x] TypeScript `tsc --noEmit` 编译通过，零错误
- [x] 所有 CSS class 定义完整（11 个新 class）
- [x] Import 链一致性校验通过
- [x] Store 状态管理完整（setEdges/setNodes 已暴露）
- [x] useLoopRegion 无无限循环风险（prevRef guard + 仅依赖 edges）
- [x] SVG defs/filter 在 React Flow SVG 容器内合法
- [x] 旧数据兼容（setCurrentWorkflow 自动补全字段）
- [ ] 浏览器端手动验证（服务器已运行于 localhost:2037）
