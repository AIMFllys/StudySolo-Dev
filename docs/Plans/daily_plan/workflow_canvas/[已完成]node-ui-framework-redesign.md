# Node UI 框架重设计 — 可复用节点壳 + 悬挂纸条系统

> **创建日期**：2026-03-26
> **状态**：✅ 全部完成
> **范围限制**：🚫 不触碰 AI 路由相关代码 (`ai_router.py`, `config.yaml`, `ai-models.ts` 逻辑)，不对接真实 AI

---

## ✅ 已完成（2026-03-26 补完）：NodeModelSelector 接入真实 AI Catalog

- **方案**：新建 `use-workflow-catalog.ts` hook，调用 `/api/ai/models/catalog`，过滤 `is_enabled && is_user_selectable`。
  - 结果缓存在模块级变量（`_cachedModels`），整个工作流 session 内只发起一次请求。
  - 加载中用 pulse 动画点代替品牌色圆点；加载完成后自动切换到真实颜色。
- **Tier 灰显**：调用 `canAccessModel(userTier, model)` 过滤，高级模型显示 PRO 徽标 + 灰色，不可点击。
- **当前选中模型**：在列表中用绿色小点标记，方便用户识别。
- [x] `NodeModelSelector` 通过 `useWorkflowCatalog` hook 获取完整模型列表
- [x] 按 `providerName` 分组渲染全量模型列表
- [x] 根据用户 tier 对 `isPremium` 模型做灰显处理

---

## Goal

将 `AIStepNode.tsx` 从"把所有东西塞进一个卡片"的单体结构，重构为**3层插槽壳 + 1悬挂纸条**的可复用组件架构。确保新增任何节点类型时，UI 层代码量为零——只需在注册表填写配置即可。

## 核心设计决策

| 决策项 | 结论 |
|--------|------|
| `input_snapshot` 来源 | 路径A: 后端 `executor.py` 新增 `node_input` SSE 事件推送 |
| 模型选择器数据源 | 复用现有 `ai-models.ts` 的 `AI_MODEL_OPTIONS` |
| `model_route` 存储格式 | 纯 model ID（如 `deepseek-chat`），不含平台前缀 |
| 输出渲染器 | 100% 复用现有 `RENDERER_REGISTRY`，不新建 |
| 动画库 | 纸条展开/收折使用 `Framer Motion` `AnimatePresence` |
| AI 路由 | 🚫 完全不碰。`NodeModelSelector` 只写 `model_route` 到 store |
| 美学风格 | 延续 Ink & Parchment 纸张笔记蓝图风，不引入现代渐变 |

---

## Phase 1: 数据基础设施（类型 + SSE 管道）

### Task 1.1: TypeScript 类型扩展

- [x] `types/workflow.ts` → `AIStepNodeData` 新增 2 个可选字段:
  - `input_snapshot?: string` — 运行时输入快照
  - `execution_time_ms?: number` — 执行耗时
- [x] `types/workflow-events.ts` → `WorkflowSSEEvent` Union 新增:
  - `| { type: 'node_input'; node_id: string; input_snapshot: string }`
- → Verify: `tsc --noEmit` 无报错

### Task 1.2: `workflow-meta.ts` 注册表元数据扩展

- [x] 新增 `NodePortSpec` 类型: `{ key: string; description: string; required: boolean }`
- [x] `NodeTypeMeta` 新增 `inputs: NodePortSpec[]` 和 `outputs: NodePortSpec[]`
- [x] 为 **全部 19 种节点类型** 补充 inputs/outputs 定义（表格化填写）

参考数据模板（示例 3 个节点）:

```
trigger_input:
  inputs: []  (根节点，无上游)
  outputs: [{ key: "用户目标", desc: "用户输入的学习目标文本" }]

ai_analyzer:
  inputs: [{ key: "用户输入", desc: "来自触发节点的目标文本", required: true }]
  outputs: [{ key: "分析结果", desc: "结构化的需求分析 JSON" }]

summary:
  inputs: [{ key: "源内容", desc: "需要总结的上游文本", required: true }]
  outputs: [{ key: "总结文稿", desc: "精炼的总结内容" }]
```

- → Verify: 每个 `NODE_TYPE_META[x]` 都有 `inputs` 和 `outputs` 数组，`tsc` 无报错

### Task 1.3: 后端 `executor.py` 新增 `node_input` SSE 事件

> **范围**: 仅在 `executor.py` 增加 1 个纯函数 + 2 处 yield 调用

- [x] 新增 `_build_input_snapshot(node_id, node_data, upstream_outputs) -> str`
  - 截断单条上游输出最多 2000 字符
  - 拼接格式: `任务描述: {label}\n\n[上游 {uid[:6]}]: {output}`
- [x] **单节点路径** (L449): 在 `yield sse_event("node_status", {"status": "running"})` 前插入:
  ```python
  input_text = _build_input_snapshot(node_id, node_data, upstream_outputs)
  yield sse_event("node_input", {"node_id": node_id, "input_snapshot": input_text})
  ```
- [x] **并行节点路径** (L511-512): 在 `for nid in active_nodes: yield node_status running` 循环中同步补充 `node_input` 推送
- → Verify: 后端测试 `pytest tests/ -k executor` 通过；手动 SSE 调试看到 `node_input` 事件

### Task 1.4: 前端 `use-workflow-execution.ts` 消费新事件

- [x] 新增 `node_input` 事件监听:
  ```typescript
  es.addEventListener('node_input', (e) => {
    const data = JSON.parse(e.data);
    updateNodeData(data.node_id, { input_snapshot: data.input_snapshot });
  });
  ```
- [x] 新增 `nodeStartTimes` ref 记录执行开始时间
- [x] `node_status → running` 时记录时间戳
- [x] `node_done` 时计算差值写入 `execution_time_ms`
- [x] 在 `workflow:execution-start` 派发后，清空所有节点的 `input_snapshot` 和 `execution_time_ms`
- → Verify: 在浏览器 DevTools Network → EventStream 中能看到 `node_input` 事件被消费

---

## Phase 2: 新建 3 个 UI 子组件

### Task 2.1: `NodeModelSelector.tsx` — 可交互模型选择器

- [x] 新建 `features/workflow/components/nodes/NodeModelSelector.tsx`
- [x] Props: `{ nodeId: string; currentModel: string; nodeThemeColor: string }`
- [x] 内部使用 shadcn `DropdownMenu` + `DropdownMenuGroup`
- [x] 数据源: 导入 `groupModelsByProvider()` 按供应商分组渲染
- [x] 选择后调用 `useWorkflowStore.getState().updateNodeData(nodeId, { model_route: model.model })`
- [x] 美学: 触发器为邮戳/印章风格
  - 默认态: `bg-transparent border-none opacity-60 font-mono text-[9px] uppercase`
  - Hover态: `border border-dashed border-current/20 opacity-100`
  - 下拉菜单: `node-paper-bg` 纸质背景，供应商名用衬线体
- [x] 在触发器左侧显示供应商 `brandColor` 小圆点 (4px)
- → Verify: 在画布上点击节点右上角模型名 → 下拉列表出现 → 选中后 `model_route` 更新（DevTools 检查 store）

### Task 2.2: `NodeInputBadges.tsx` — 输入端口标签组件

- [x] 新建 `features/workflow/components/nodes/NodeInputBadges.tsx`
- [x] Props: `{ nodeType: string }`
- [x] 逻辑: `const meta = getNodeTypeMeta(nodeType); if (!meta.inputs?.length) return null;`
- [x] 渲染: 水平排列的小标签列表
  - 每个标签: `📥 {key}` (required 的加 `*`)
  - 字体: `font-mono text-[10px] tracking-wider text-black/40`
  - 容器: `flex flex-wrap gap-1.5 mt-2`
- [x] 如果 outputs 也有定义，渲染 `📤 {key}` (双色区分)
- → Verify: `ai_analyzer` 节点显示至少 1 个输入标签; `trigger_input` 无标签（inputs=[]）

### Task 2.3: `NodeResultSlip.tsx` — 底部悬挂纸条

- [x] 新建 `features/workflow/components/nodes/NodeResultSlip.tsx`
- [x] Props 接口:
  ```typescript
  interface NodeResultSlipProps {
    nodeId: string;
    status: NodeStatus;
    output: string;
    error?: string;
    inputSnapshot?: string;
    nodeType: string;
    outputFormat?: string;
    executionTimeMs?: number;
    nodeTheme: ReturnType<typeof getNodeTheme>;
  }
  ```
- [x] 本地 State: `const [isExpanded, setIsExpanded] = useState(false)`
- [x] **折叠态** (status !== 'pending' 时才显示):
  - running: `⏳ 执行中...` + 脉冲动画
  - done: `✓ 运行成功  {(executionTimeMs/1000).toFixed(1)}s` + 点击展开箭头
  - error: `✗ 执行失败` + 红色文字
  - 交互: 点击切换 `isExpanded`
- [x] **展开态** (AnimatePresence + motion.div):
  - 上区块「输入」: `input_snapshot` 用 `font-mono text-xs` 等宽渲染, max-h-32 可滚动
  - 分隔虚线: `border-t border-dashed border-black/10 my-3`
  - 下区块「输出」: 调用现有 `getRenderer(nodeType)` 渲染器
  - error 时: 显示红色错误信息代替输出区
- [x] **CSS 美学** (纸条物理隐喻):
  - 容器: `mt-1 rounded-b-md overflow-hidden`
  - 背景: `bg-black/[0.03] dark:bg-white/[0.03]` (极淡)
  - 顶部内嵌阴影: `shadow-[inset_0_3px_8px_-4px_rgba(0,0,0,0.06)]`
  - 左右与主卡片对齐，上边缘有 `border-t border-dashed`
- [x] pending 时整个纸条不渲染（干净的初始态）
- → Verify: 执行工作流后，done 节点下方出现纸条; 点击可展开; 内容包含输入和输出

---

## Phase 3: AIStepNode 壳重构

### Task 3.1: 重构 `AIStepNode.tsx` 为组合壳

- [x] **保留**: Handle 逻辑、click-to-connect 逻辑、`node-paper-bg` 主卡片样式
- [x] **替换**: 右上角静态 `<span>{model_route}</span>` → `<NodeModelSelector />`
- [x] **新增**: 在 title+desc 下方插入 `<NodeInputBadges nodeType={nodeType} />`
- [x] **剥离**: 将现有的 "Dynamic Content Area" (L141-178) + Footer (L182-198) + Error (L200-204) 全部移除
- [x] **追加**: 在主卡片 `</div>` 关闭后、Source Handle 前，插入 `<NodeResultSlip />`
- [x] **确保**: Handle 组件保持在最外层 `<div>` 内部，不被 flex 破坏位置
- [x] 最终壳结构 (伪代码):
  ```
  <div> ← 最外层容器（包含 handle）
    <Handle target-left />
    <Handle target-top />
    
    <div className="node-paper-bg"> ← 主卡片
      [A] 顶部: NodeTypeLabel + NodeModelSelector
      [B] 主体: Label + Description + NodeInputBadges
      [C] 特殊: BranchManagerPanel (仅 logic_switch)
    </div>
    
    <NodeResultSlip /> ← 底部纸条
    
    <Handle source-right />
    <Handle source-bottom />
  </div>
  ```
- → Verify: 画布上节点正常渲染; 主卡片精简; 底部纸条独立存在; 所有连线 Handle 正常工作

---

## Phase 4: CSS 细节 + 最终验证

### Task 4.1: `workflow.css` 补充纸条样式

- [x] 新增 `.node-result-slip` 基础样式（纸条背景、内嵌阴影、圆角）
- [x] 新增 `.node-result-slip-expanded` 展开态动画微调
- [x] 新增 `.node-model-selector-trigger` 邮戳触发器样式
- [x] light/dark 双主题适配
- → Verify: light 和 dark 模式下纸条视觉一致性合格

### Task 4.2: 端到端功能验证

- [x] 1. `pnpm dev` 启动前端，`uvicorn` 启动后端
- [x] 2. 创建工作流 → 节点正常渲染 → 模型选择器可点击切换
- [x] 3. 运行工作流 → 节点底部纸条出现 → 折叠态显示状态
- [x] 4. 点击纸条 → 展开 → 显示输入快照 + 输出结果
- [x] 5. 错误节点 → 纸条显示红色错误
- [x] 6. 所有 Handle 连线功能正常

### Task 4.3: 文件行数守卫

- [x] `AIStepNode.tsx` 重构后应 ≤ 150 行（从 221 行精简）
- [x] `NodeResultSlip.tsx` 应 ≤ 120 行
- [x] `NodeModelSelector.tsx` 应 ≤ 80 行
- [x] `NodeInputBadges.tsx` 应 ≤ 40 行
- → Verify: 所有文件 `wc -l` 在限值内

---

## Done When

- [x] 节点主卡片只展示"类型 + 模型 + 标题 + 描述 + 输入端口定义"（静态配置层）
- [x] 模型选择器可交互点击并切换 `model_route`
- [x] 运行后节点下方出现悬挂纸条，折叠/展开流畅
- [x] 纸条展开后可看到运行时真实输入和输出
- [x] 新增任何节点类型时，只改注册表（`workflow-meta.ts` + `nodes/index.ts`），UI 零额外代码
- [x] 视觉风格与现有 Ink & Parchment 纸张笔记蓝图美学完全一致

---

## 目标文件树

```
StudySolo/
│
├── frontend/src/
│   ├── types/
│   │   ├── workflow.ts                    ✏️  +input_snapshot +execution_time_ms
│   │   └── workflow-events.ts             ✏️  +node_input 事件 Union
│   │
│   ├── features/workflow/
│   │   ├── constants/
│   │   │   ├── workflow-meta.ts           ✏️  +NodePortSpec 类型
│   │   │   │                                  +NodeTypeMeta.inputs/outputs
│   │   │   │                                  +19 个节点全部补充 I/O 定义
│   │   │   └── ai-models.ts              ✅  不变（仅被引用读取，不修改）
│   │   │
│   │   ├── hooks/
│   │   │   └── use-workflow-execution.ts  ✏️  +node_input 监听
│   │   │                                      +nodeStartTimes ref
│   │   │                                      +execution_time_ms 计算写入
│   │   │                                      +execution-start 时清空旧数据
│   │   │
│   │   └── components/nodes/
│   │       ├── AIStepNode.tsx             ✏️  重构为3层壳 + 组合调用子组件
│   │       ├── NodeModelSelector.tsx      ➕  新建 可交互模型下拉选择器
│   │       ├── NodeInputBadges.tsx        ➕  新建 输入端口标签展示
│   │       ├── NodeResultSlip.tsx         ➕  新建 底部悬挂纸条
│   │       │
│   │       ├── BranchManagerPanel.tsx     ✅  不变
│   │       ├── NodeMarkdownOutput.tsx     ✅  不变
│   │       ├── GeneratingNode.tsx         ✅  不变
│   │       ├── AnnotationNode.tsx         ✅  不变
│   │       ├── LoopGroupNode.tsx          ✅  不变
│   │       ├── NodeSkeleton.tsx           ✅  不变
│   │       ├── ShikiCodeBlock.tsx         ✅  不变
│   │       ├── index.ts                   ✅  不变（RENDERER_REGISTRY 原样复用）
│   │       └── renderers/                 ✅  全部不变（8 个渲染器原样复用）
│   │
│   ├── stores/
│   │   └── use-workflow-store.ts          ✅  不变 (updateNodeData 接口已够用)
│   │
│   └── styles/
│       └── workflow.css                   ✏️  +纸条/选择器 CSS (light/dark)
│
├── backend/app/
│   └── engine/
│       ├── executor.py                    ✏️  +_build_input_snapshot() 纯函数
│       │                                      +2 处 yield node_input (单节点+并行)
│       └── events.py                      ✅  不变 (sse_event 通用)
│
└── 🚫 完全不碰的文件
    ├── backend/app/services/ai_router.py
    ├── backend/config.yaml
    ├── frontend/src/features/workflow/constants/ai-models.ts (逻辑不改,仅引用)
    └── backend/app/nodes/_base.py
```

---

## Notes

- Phase 1 是纯数据层改动，不涉及任何 UI 渲染
- Phase 2 的 3 个新组件完全独立，互不依赖，可并行开发
- Phase 3 是风险最高的步骤（主节点组件重构），必须在 Phase 2 全部完成后再做
- Phase 4 是 CSS 微调 + 验证，不该耗费超过 10 分钟
- `NodeModelSelector` 写入 `model_route` 纯 model ID，后端 AI 路由如何解析这个 ID 完全不关我们的事
- 所有渲染器 (`MarkdownRenderer`, `FlashcardRenderer` 等) 被 `NodeResultSlip` 通过 `getRenderer()` 间接调用，零修改
