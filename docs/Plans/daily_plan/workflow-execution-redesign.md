# 工作流执行面板重构 — 落地状态与剩余验证

> **创建**：2026-03-27 18:35
> **最后回写**：2026-03-27
> **目标**：彻底修复节点配置、执行面板和链路筛选三大核心问题
> **编码要求**：UTF-8（无 BOM）/ LF / 禁止中文转义 / 禁止乱码提交

---

## 全局状态

- [x] **P0 已完成** — 节点配置真实生效（GET→POST 执行接口竞争条件已修复）
- [x] **P1 已完成** — 节点配置改为就近弹窗（锚点 Popover 替代全屏抽屉）
- [x] **P1 已完成** — 运行面板统一（执行开始会关闭配置弹窗，避免叠加）
- [x] **P2 已完成** — 运行链路筛选（从 edges 计算多线路 + Tab 筛选）
- [~] **视觉收口已完成到可用态** — Trace 线段感与进入动画已补齐，但仍需真实页面肉眼确认
- [~] **最终回归部分受阻** — 后端 `pytest` 运行环境缺少依赖，当前只能完成语法级与前端定向验证

---

## Phase 1：P0 — 配置真实生效（执行接口改造）

### 当前落地状态

- `backend/app/api/workflow_execute.py` 已新增 `POST /api/workflow/{workflow_id}/execute`
- 已新增 `WorkflowExecuteRequest`
- 解析规则已固定：
  - 同时提供 `nodes_json + edges_json`：优先使用 body
  - 两者都不提供：回退 DB
  - 只提供一个：直接 `422`
- 原 `GET /execute` 仍保留，代码中已标注为兼容旧前端的 deprecated 入口
- 前端 `use-workflow-execution.ts` 已改为 `fetch + ReadableStream + SSE parser`
- 执行流不自动重试，避免重复执行工作流
- 执行开始/结束不再派发 `workflow:execution-start / workflow:execution-end`
- `use-workflow-sync.ts` 已移除执行锁，云同步继续按本地快照与节流机制运行

### 与原草案不同的实现决策

- SSE 解析采用独立工具 `parse-sse.ts`，不是直接在 hook 内逐行字符串拆分
- 断流后直接把 session 标记为 error，由用户手动重跑
- 不再依赖“暂停云同步”规避竞态，而是依赖 POST body 传入即时图

---

## Phase 2：P1a — 节点配置改为就近弹窗

### 当前落地状态

- `NodeConfigDrawer.tsx` 已具备 Popover 行为，文件名保留但语义已不再是右侧抽屉
- 打开配置时通过 `workflow:open-node-config` 传递 `nodeId + anchorRect`
- 实际定位依据是按钮的 `getBoundingClientRect()`，不是 `flowToScreenPosition`
- 已支持：
  - 默认在按钮右侧弹出
  - 超右边界翻到左侧
  - 超下边界上移回 viewport
  - 点击外部关闭
  - `Escape` 关闭
- 配置已改为即时生效：
  - 普通节点直接写 `node.data.config`
  - `loop_group` 直接写顶层 `maxIterations / intervalSeconds / description`
  - “保存配置”按钮已删除
  - “恢复默认”保留并立即写回

### 验证现状

- 纯逻辑定位与配置 patch 已有测试覆盖
- 真实画布上的右下角翻转、缩放后位置体验仍需手工确认

---

## Phase 3：P1b — 运行面板统一（消除叠加）

### 当前落地状态

- 执行开始时，`use-workflow-execution.ts` 会派发 `workflow:close-node-config`，配置弹窗自动关闭
- `ExecutionTraceDrawer.tsx` 继续保持“有 session 才渲染”，没有引入隐藏态 DOM
- `ExecutionProgressHeader.tsx` 已显示 `workflowName`，不再显示 UUID
- 执行抽屉已补轻量进入动画：
  - `animate-in`
  - `slide-in-from-right-6`
  - `fade-in-0`

### 与原草案不同的实现决策

- 没有实现“无 session 时保留 translate-x-full 占位节点”
- 采用条件渲染 + 进入动画，逻辑更简单，避免残留 DOM 干扰布局

---

## Phase 4：P2 — 链路计算与筛选 Tab

### 当前落地状态

- 已新增 `frontend/src/features/workflow/utils/compute-chains.ts`
- 链路语义为：**顶层可执行节点图中的每条 root-to-leaf 完整路径**
- 计算时已排除：
  - `annotation`
  - `generating`
  - `parentId` 非空的 `loop_group` 子节点
- `NodeExecutionTrace` 已增加 `chainIds`
- `WorkflowExecutionSession` 已增加：
  - `workflowName`
  - `chains`
- `startExecutionSession` 已在启动时注入链路信息
- `ExecutionTraceList.tsx` 已支持：
  - 单链不显示 Tab
  - 多链显示 `全部 / 线路 1 / 线路 2 ...`
  - 切换线路后过滤 traces
  - 过滤后再做并行组聚合

### Trace 视觉收口状态

- 保留纵向时间线结构
- 已补：
  - `running` 点位脉冲和外发光
  - `done` 连接线改实线
  - `skipped` 灰显并对标题/摘要加删除线
  - 标题区轻量箭头提示链路方向
- 未再引入复杂箭头组件，避免扩大 CSS 面积

---

## 测试与验证

### 已完成

- [x] `frontend`: `pnpm exec tsc --noEmit`
- [x] `frontend`: 定向 Vitest 已覆盖
  - store
  - sync
  - SSE/store 更新
  - execution utils
  - execution 收尾 helper
  - config patch helper
  - trace filtering / grouping helper
- [x] `backend`: `python -m compileall backend/app backend/tests`
- [x] 后端 `POST /execute` 契约测试文件已补齐

### 当前阻塞

- [ ] `backend`: `pytest` 未运行
  - 原因：本机 Python 环境缺少 `pytest`
  - 结论：不能宣称后端完整回归通过，只能确认语法编译通过、测试文件已补齐

### 仍建议手工验收的场景

- [ ] 修改节点 config 后不等云同步直接执行，确认后端收到最新 `node_config`
- [ ] 打开配置弹窗后点击运行，确认只剩执行面板
- [ ] 含 `logic_switch + 汇聚节点` 的工作流确认线路 Tab 和汇聚节点归属正确
- [ ] 节点靠近右下边界时确认 popover 自动翻转且不出 viewport

---

## 文件清单（已落地）

| 文件 | 状态 | 说明 |
|------|------|------|
| `backend/app/api/workflow_execute.py` | 已完成 | 新增 POST 执行接口并兼容 GET |
| `backend/app/models/workflow.py` | 已完成 | 新增 `WorkflowExecuteRequest` |
| `frontend/src/features/workflow/hooks/use-workflow-execution.ts` | 已完成 | `EventSource` → `fetch POST + SSE parser` |
| `frontend/src/features/workflow/hooks/use-workflow-sync.ts` | 已完成 | 移除执行锁 |
| `frontend/src/features/workflow/components/canvas/WorkflowCanvas.tsx` | 已完成 | 传递 `anchorRect` 并处理关闭互斥 |
| `frontend/src/features/workflow/components/node-config/NodeConfigDrawer.tsx` | 已完成 | 语义已转为 Popover |
| `frontend/src/features/workflow/components/execution/ExecutionTraceDrawer.tsx` | 已完成 | 条件渲染 + 进入动画 |
| `frontend/src/features/workflow/components/execution/ExecutionProgressHeader.tsx` | 已完成 | 显示工作流名称 |
| `frontend/src/features/workflow/components/execution/ExecutionTraceList.tsx` | 已完成 | 链路 Tab 筛选 |
| `frontend/src/features/workflow/components/execution/TraceStepItem.tsx` | 已完成 | 线段视觉强化 |
| `frontend/src/features/workflow/utils/compute-chains.ts` | 已完成 | root-to-leaf 链路计算 |
| `frontend/src/features/workflow/utils/parse-sse.ts` | 已完成 | SSE 文本解析 |
| `frontend/src/features/workflow/utils/execution-state.ts` | 已完成 | 执行收尾 helper |
| `frontend/src/features/workflow/components/node-config/config-patch.ts` | 已完成 | 配置 patch helper |
| `frontend/src/features/workflow/components/execution/trace-list-utils.ts` | 已完成 | trace 筛选与分组 helper |
| `frontend/src/types/workflow.ts` | 已完成 | `workflowName / chains / chainIds` |
| `frontend/src/stores/use-workflow-store.ts` | 已完成 | session 注入链路与名称 |

---

## Done When

- [x] 修改 config → 直接执行 → 后端接口支持接收最新图结构
- [x] 配置弹窗出现在节点旁边（非全屏抽屉）
- [x] 运行时只有一个主面板（执行开始自动关闭配置弹窗）
- [x] 分支工作流运行后出现链路筛选 Tab
- [x] 链路筛选切换后节点列表按线路过滤
- [ ] 后端 `pytest` 定向回归通过
  - 阻塞：当前环境缺少 `pytest`
