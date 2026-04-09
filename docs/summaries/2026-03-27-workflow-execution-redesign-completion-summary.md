# 工作流执行面板重构完成总结

> **日期**：2026-03-27  
> **类型**：执行链路重构 + 配置交互重构 + 运行面板收口 + 链路筛选补完  
> **涉及模块**：`backend/app/api/workflow_execute.py`、Workflow Store、Execution Drawer、Node Config Popover、SSE 执行链路、测试体系与规划文档

---

## 1. 背景与问题来源

这次重构不是单点修补，而是一次围绕“工作流执行一致性”的系统性收口。起点问题来自以下几类长期耦合缺陷：

1. **执行接口设计不匹配编辑器行为**
   前端在画布上修改节点配置后，执行仍然走 `GET + EventSource`，后端主要从数据库读图，导致“刚改的配置没有参与本次执行”。

2. **执行期间暂停云同步属于错误修复方向**
   旧实现依赖 `workflow:execution-start / workflow:execution-end` 在执行时暂停同步，试图绕过竞态；但这只是掩盖症状，并没有让“执行读取的图”和“用户眼前的图”保持一致。

3. **节点配置面板交互成本过高**
   旧模型是右侧抽屉 + 草稿态 + 手动保存，位置远、切换重，而且与执行面板同时出现时会形成双侧信息竞争。

4. **执行面板信息不完整**
   执行 session 仅按节点顺序展示，没有工作流名称、没有 root-to-leaf 链路语义、没有线路筛选，分支和汇聚工作流在运行时难以阅读。

5. **规划文档和真实代码状态脱节**
   主干能力完成后，`docs/Plans/daily_plan/workflow-execution-redesign.md` 仍停留在待办草案，无法作为后续交接依据。

---

## 2. 本次重构的总体目标

围绕上述问题，这次工作按“两批推进、最后收尾”的方式完成了完整闭环：

### Batch 1：执行一致性 + 配置弹窗 + 面板收口

- 把执行入口从 `GET + EventSource` 改成 `POST + fetch + SSE parser`
- 让前端执行时直接携带当前内存中的 `nodes / edges`
- 删除“执行时暂停云同步”的锁机制
- 把节点配置从抽屉改成锚点弹窗，并改为即时生效
- 执行开始时自动关闭配置弹窗，统一右侧运行入口
- 执行面板显示真实 `workflowName`

### Batch 2：链路计算 + Tab 筛选 + 线段化展示

- 基于当前图结构计算 root-to-leaf `chains`
- 把 `chains / chainIds` 注入 `executionSession`
- 运行面板支持 `全部 / 线路 N` Tab 筛选
- 汇聚节点支持同时归属多条线路
- Trace 项增强链路线视觉，不重做布局

### 收尾阶段：文档回写 + 视觉补全 + 测试补齐

- 把规划文档回写成“已落地状态文档”
- 为执行抽屉补进入动画
- 为 Trace 项补 `running / done / skipped / error` 的明确状态视觉
- 把执行事件处理抽成独立 helper，补齐逻辑级验证

---

## 3. 已完成的核心架构改动

## 3.1 后端执行接口改造

### 已完成

- 在 `backend/app/api/workflow_execute.py` 新增 `POST /api/workflow/{workflow_id}/execute`
- 在 `backend/app/models/workflow.py` 新增 `WorkflowExecuteRequest`
- 保留原 `GET /execute` 作为兼容入口，并标记 deprecated

### 已固定的请求语义

- 同时提供 `nodes_json + edges_json`：优先使用请求体中的图执行
- 两者都不提供：回退到数据库图结构
- 只提供一个：直接 `422`

### 结果

前端执行不再依赖“云同步是否已经落库”，而是直接对当前内存图执行，根本性解决了“刚修改配置就执行但后端拿到旧配置”的问题。

---

## 3.2 前端执行链路改造

### 已完成

- `frontend/src/features/workflow/hooks/use-workflow-execution.ts`
  - 执行入口由 `EventSource` 切换为 `fetch POST`
  - 读取当前 store 中的 `nodes / edges`
  - 使用 `ReadableStreamDefaultReader + TextDecoder` 解析 SSE
  - 新增 `AbortController`
  - `stop()` 改为中断 fetch 流

- `frontend/src/features/workflow/utils/parse-sse.ts`
  - 负责拆分 chunked SSE 文本流

- `frontend/src/features/workflow/utils/execution-state.ts`
  - 负责构造执行请求体
  - 负责统一执行异常文案
  - 负责判断流中断是否应标记为 interrupted/error

- `frontend/src/features/workflow/utils/workflow-execution-events.ts`
  - 负责把 `node_input / node_status / node_token / node_done / loop_iteration / workflow_done / save_error`
    映射成 store / trace 更新

### 已固定的执行语义

- **不自动重试**
  原因是 `POST /execute` 有副作用，自动重试可能重复执行工作流。

- **流异常中断时直接标记 error**
  避免 session 卡死在 running。

- **执行开始时自动关闭配置弹窗**
  避免配置面板与执行面板重叠。

---

## 3.3 云同步行为收口

### 已完成

- 删除 `workflow:execution-start / workflow:execution-end` 事件派发
- `frontend/src/features/workflow/hooks/use-workflow-sync.ts` 移除执行锁与 `executionLockRef`
- 保留本地快照与云端节流保存

### 设计结论

旧实现是“执行时冻结同步”，新实现是“执行读当前图”。这意味着执行一致性的来源已经从“锁”切换为“请求体明确传图”，架构方向正确且更稳定。

---

## 3.4 节点配置交互重构

### 已完成

- `NodeConfigDrawer.tsx` 虽保留原文件名，但语义已转为 **Popover**
- `AIStepNode.tsx` 点击配置按钮时读取 `event.currentTarget.getBoundingClientRect()`
- 通过 `workflow:open-node-config` 传递 `nodeId + anchorRect`
- `WorkflowCanvas.tsx` 接收并管理配置弹窗状态

### 定位规则已落实

- 默认显示在按钮右侧
- 超出右边界则翻到左侧
- 超出下边界则向上回收
- 点击外部关闭
- `Escape` 关闭
- 开始执行时关闭

### 配置写回模型已落实

- 普通节点：字段改动直接写 `node.data.config`
- `loop_group`：直接写顶层 `maxIterations / intervalSeconds / description`
- 移除 `draftConfig` 和“保存配置”按钮
- 保留“恢复默认”，恢复后立刻写回 store

### 新增辅助模块

- `frontend/src/features/workflow/components/node-config/popover-position.ts`
- `frontend/src/features/workflow/components/node-config/config-patch.ts`

这些 helper 把定位与配置 patch 从组件视图中拆出来，便于逻辑测试。

---

## 3.5 执行面板统一与工作流标题收口

### 已完成

- `ExecutionTraceDrawer.tsx` 继续采用“有 session 才渲染”的条件渲染模式
- `ExecutionProgressHeader.tsx` 改为显示 `workflowName`
- `use-workflow-store.ts` 新增 `currentWorkflowName`
- `WorkflowCanvasLoader.tsx` 与 `/c/[id]/page.tsx` 初始化工作流时同时注入名称

### 当前设计选择

- 没有引入“隐藏态 DOM + translate-x-full”常驻抽屉
- 保持条件渲染，减少多余节点与状态分支
- 收尾阶段补充了轻量进入动画，不把简单面板做成复杂状态机

---

## 3.6 链路计算与线路筛选

### 已完成

- `frontend/src/features/workflow/utils/compute-chains.ts`
  - 基于顶层可执行节点图计算每条 root-to-leaf 路径
  - 排除 `annotation`
  - 排除 `generating`
  - 排除 `parentId` 非空的 `loop_group` 子节点

- `frontend/src/types/workflow.ts`
  - 新增 `WorkflowChain`
  - 新增 `NodeExecutionTrace.chainIds`
  - 新增 `WorkflowExecutionSession.workflowName`
  - 新增 `WorkflowExecutionSession.chains`

- `frontend/src/stores/use-workflow-store.ts`
  - `startExecutionSession(workflowId, workflowName)` 在启动时计算 `chains`
  - 为每个 trace 注入所属 `chainIds`

- `frontend/src/features/workflow/components/execution/ExecutionTraceList.tsx`
  - 支持 `全部 / 线路 1 / 线路 2 ...` Tab

- `frontend/src/features/workflow/components/execution/trace-list-utils.ts`
  - 负责线路过滤、Tab 显示判断、过滤后的 parallel grouping

### 设计结果

- 单链图不显示线路 Tab
- 多链图支持切换线路
- 汇聚节点可同时出现在多条线路
- 过滤发生在并行组聚合前，因此不会破坏现有 parallel display

---

## 3.7 执行面板视觉收尾

### 已完成

- `ExecutionTraceDrawer.tsx`
  - 增加轻量 `animate-in + slide-in-from-right + fade-in`

- `TraceStepItem.tsx`
  - 保留现有纵向时间线结构
  - `running`：脉冲点 + 更强连接线强调
  - `done`：连接线改实线
  - `skipped`：灰显并对标题/摘要加删除线
  - `error`：保留错误 badge
  - 标题区增加轻量链路箭头提示

### 设计边界

这次只做“线段感强化”，没有引入全新复杂布局或额外箭头组件，目的是降低回归面积。

---

## 4. 本次涉及的主要文件

| 文件 | 作用 |
|------|------|
| `backend/app/api/workflow_execute.py` | 新增 POST 执行接口并兼容旧 GET |
| `backend/app/models/workflow.py` | 新增 `WorkflowExecuteRequest` |
| `frontend/src/features/workflow/hooks/use-workflow-execution.ts` | 执行 transport 与 session 收尾 |
| `frontend/src/features/workflow/hooks/use-workflow-sync.ts` | 删除执行锁 |
| `frontend/src/features/workflow/utils/parse-sse.ts` | SSE 文本流解析 |
| `frontend/src/features/workflow/utils/execution-state.ts` | 执行请求和异常状态 helper |
| `frontend/src/features/workflow/utils/workflow-execution-events.ts` | SSE 事件到 store/trace 的映射 |
| `frontend/src/features/workflow/utils/compute-chains.ts` | root-to-leaf 链路计算 |
| `frontend/src/stores/use-workflow-store.ts` | session、workflowName、chains 注入 |
| `frontend/src/types/workflow.ts` | 扩展执行与链路类型 |
| `frontend/src/features/workflow/components/canvas/WorkflowCanvas.tsx` | 配置弹窗锚点状态管理 |
| `frontend/src/features/workflow/components/nodes/AIStepNode.tsx` | 发送 `anchorRect` 打开事件 |
| `frontend/src/features/workflow/components/node-config/NodeConfigDrawer.tsx` | 已转为 Popover 语义 |
| `frontend/src/features/workflow/components/node-config/popover-position.ts` | Popover 位置计算 |
| `frontend/src/features/workflow/components/node-config/config-patch.ts` | 配置 patch helper |
| `frontend/src/features/workflow/components/execution/ExecutionProgressHeader.tsx` | 显示工作流名称 |
| `frontend/src/features/workflow/components/execution/ExecutionTraceDrawer.tsx` | 条件渲染 + 进入动画 |
| `frontend/src/features/workflow/components/execution/ExecutionTraceList.tsx` | 线路 Tab 筛选 |
| `frontend/src/features/workflow/components/execution/TraceStepItem.tsx` | 执行步骤线段视觉 |
| `frontend/src/features/workflow/components/execution/trace-list-utils.ts` | Trace 过滤与分组 |
| `docs/Plans/daily_plan/workflow-execution-redesign.md` | 已从草案回写为落地状态文档 |

---

## 5. 测试与验证结果

## 5.1 前端验证

以下验证已完成并通过：

- `pnpm exec tsc --noEmit`
- `pnpm exec vitest run src/__tests__/workflow-store.property.test.ts`
- `pnpm exec vitest run src/__tests__/workflow-execution-utils.property.test.ts`
- `pnpm exec vitest run src/__tests__/workflow-execution-closure.property.test.ts`
- `pnpm exec vitest run src/__tests__/workflow-sync.property.test.ts`
- `pnpm exec vitest run src/__tests__/sse-store-update.property.test.ts`
- `pnpm exec vitest run src/__tests__/workflow-grouping.property.test.ts`

### 已覆盖的能力

- store 中的 `workflowName / chains / chainIds` 注入
- SSE 文本解析
- execution request body 构造
- 中断与异常收尾判断
- execution event handler 对 `node_input / node_status / node_token / node_done / workflow_done` 的更新逻辑
- config patch helper
- trace filtering / grouping helper
- sync 行为回归

## 5.2 后端验证

以下验证已完成：

- `python -m compileall backend/app backend/tests`

以下测试文件已补齐，但未能在本机实际运行：

- `backend/tests/test_workflow_execute_route_property.py`
- `backend/tests/test_workflow_control_flow_property.py`
- `backend/tests/test_sse_events_property.py`

### 阻塞原因

当前 Python 环境缺少 `pytest` 模块，因此不能宣称后端完整回归已经跑通。

---

## 6. 文档回写与交付结果

这次不仅完成了代码改造，也完成了交接文档收口：

- `docs/Plans/daily_plan/workflow-execution-redesign.md`
  已不再是“未来计划”，而是“当前落地状态 + 阻塞说明 + Done When 校验”文档。

- 本文档
  作为 `docs/summary` 中的阶段性总结，负责串联这次工作的完整上下文，供后续开发者快速恢复现场。

---

## 7. 编码与中文文件安全

本次所有涉及中文说明和总结的文件，均按以下要求处理：

- 保持 UTF-8
- 无 BOM
- LF 换行
- 不做批量重写
- 不做中文转义
- 不改无关中文段落

收尾阶段对本次新增和更新的核心 `.md/.ts/.tsx` 文件进行了 BOM 检查，结果均为 `NO_BOM`。

---

## 8. 当前结论

本轮“工作流执行面板重构”已经完成核心目标：

1. **执行一致性问题已被根因级修复**
   前端执行直接提交当前图，配置变更能即时参与执行。

2. **配置交互已明显收敛**
   配置弹窗从远端抽屉变为节点就近弹窗，且改为即时生效。

3. **执行面板已具备可读的线路语义**
   多分支工作流现在可以按 root-to-leaf 路径筛选和阅读执行情况。

4. **文档、代码、测试三者已基本对齐**
   当前唯一未闭环项不是代码缺失，而是后端 `pytest` 运行环境未满足。

如果只从代码和前端验证角度看，这个重构已经进入“可交付、可维护、可继续迭代”的状态。
