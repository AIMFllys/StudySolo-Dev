<!-- 编码：UTF-8 -->

# 2026-03-26 Workflow Canvas Control-Flow 收口总结

## 基本信息

- 时间：2026-03-26
- 关联提交：`e40de1d59438ae19c0e227caa721f145192ed61b`
- 主题：Workflow Canvas Edge / Control-Flow 收口
- 目标：把工作流画布中的控制流语义从“多种 edge 类型”彻底收口到
  - 唯一顺序边 `sequential`
  - 条件分支节点 `logic_switch`
  - 循环容器节点 `loop_group`

本次工作同时覆盖前端交互、类型契约、后端 SSE/执行器行为、legacy graph 兼容、自动化测试与文档同步，不是单点补丁。

---

## 一、完成了什么

### 1. 前端类型与兼容入口收口

- `frontend/src/types/workflow.ts`
  - `NodeStatus` 扩展为真实运行态全集：`pending | running | waiting | done | error | skipped | paused`
  - `LoopGroupNodeData` 增加运行期字段：`status`、`currentIteration`、`totalIterations`
  - 新增 `WorkflowNodeData`
  - `WorkflowEdgeData` 继续收口为 `{ note?, waitSeconds?, branch? }`
  - 新增 `isLegacyLoopRegionNode()`
- `frontend/src/types/workflow-events.ts`
  - SSE 联合类型新增 `loop_iteration`
- `frontend/src/stores/use-workflow-store.ts`
  - `setCurrentWorkflow()` 改为统一走 `normalizeEdge()`
  - 旧 `loop_region` 节点在进入 store 前直接过滤
  - legacy edge 统一迁移为 `sequential`

### 2. 控制流交互闭环补齐

- `frontend/src/features/workflow/hooks/use-loop-group-drop.ts`
  - 新增循环容器拖入/拖出 hook
- `frontend/src/features/workflow/utils/loop-group-drop.ts`
  - 新增纯算法层，负责
    - 命中 loop_group 包围盒
    - 绝对坐标与父容器相对坐标换算
    - `parentId` / `extent: 'parent'` 绑定与解绑
- `frontend/src/features/workflow/components/canvas/WorkflowCanvas.tsx`
  - 接入 `onNodeDragStop` → loop-group 绑定逻辑

### 3. Edge 行为统一收口

- `frontend/src/features/workflow/utils/edge-actions.ts`
  - 新增统一边更新入口，收口以下动作：
    - 编辑备注
    - 设置等待时间
    - 编辑分支标签
    - 反转方向
    - 删除边
- `frontend/src/features/workflow/utils/edge-display.ts`
  - 新增边显示规则
  - 统一处理 note / branch / waitSeconds 的显示优先级与格式化
- `frontend/src/features/workflow/components/canvas/EdgeContextMenu.tsx`
  - 新增“设置等待时间”
  - 改为调用统一 edge action
- `frontend/src/features/workflow/components/canvas/edges/SequentialEdge.tsx`
  - `logic_switch` 出边优先显示 `branch`
  - 普通顺序边显示 `note`
  - 支持并列显示等待标识 `⏱ Ns`
  - 点击等待标识可直接修改 `waitSeconds`

### 4. 控制流视觉强化

- `frontend/src/features/workflow/constants/workflow-meta.ts`
  - `logic_switch` 从泛化 CONTROL_FLOW 主题中拆出来，单独使用更强的 amber 分支视觉
  - 状态元数据增加 `waiting` / `skipped`
- `frontend/src/features/workflow/components/nodes/AIStepNode.tsx`
  - `logic_switch` 节点增加 `BRANCH` 标识和“从右侧或底部拖出分支”提示
  - 节点运行态新增 `waiting` / `skipped` 文案与展示
- `frontend/src/features/workflow/components/nodes/LoopGroupNode.tsx`
  - 运行时显示当前迭代进度 `第 x/y 轮`
  - 增加容器内拖拽提示
- `frontend/src/styles/workflow.css`
  - 新增等待标签与运行中 loop_group 容器样式

### 5. SSE 与后端执行器对齐

- `frontend/src/features/workflow/hooks/use-workflow-execution.ts`
  - 新增 `loop_iteration` 事件消费
  - 将循环块运行轮次写回节点 data
- `backend/app/engine/executor.py`
  - 修正 skipped 分支的事件发射逻辑
  - 保证即使同层仍有活跃节点，也会对被跳过节点发出 `node_status: skipped`

### 6. 文档同步

- `docs/Plans/daily_plan/workflow_canvas/edge-connection-system.md`
  - 根据真实代码重写状态标记
  - 清除“NodeResizer 丢失”“等待 UI 丢失”等过期结论
  - 标注当前仍未完成的只剩手工冒烟验证
- `docs/项目规范与框架流程/项目规范/api.md`
  - SSE 事件表补齐 `loop_iteration`
  - `node_status.status` 当前允许值补齐 `waiting` / `skipped`
  - `node_done` 字段说明改为 `full_output`

---

## 二、这次实际修复/优化了什么功能

这一节从“开发者视角的可观察行为”出发，明确这次改动不是抽象重构，而是补齐了哪些真实功能。

### 1. 旧工作流打开时的兼容问题被修复

修复前：

- 历史工作流里的旧 edge 类型可能继续带着 `conditional` / `loop`
- 旧 `loop_region` 节点仍可能混进当前画布状态
- 前端实际装载逻辑与类型文档不一致，后续开发时难以判断“哪里才是真正入口”

修复后：

- 所有旧 edge 在 `setCurrentWorkflow()` 装载时统一迁移为 `sequential`
- 缺失的 `sourceHandle` / `targetHandle` / `data` 自动补默认值
- 旧 `loop_region` 节点在进入 store 前被过滤，不再参与当前画布渲染与交互

对应收益：

- 老数据打开更稳定
- 后续开发不需要在多个组件里各自处理 legacy case
- 兼容迁移收口到 store 单点，定位问题更容易

### 2. 循环块真正具备“容器”语义了

修复前：

- `loop_group` 虽然存在，但“拖进去就属于循环块”的交互没有真正闭环
- 子节点是否属于循环块，前端和后端语义容易脱节
- 拖出容器时没有稳定的解绑与坐标恢复逻辑

修复后：

- 节点拖入 `loop_group` 包围盒时会自动设置 `parentId` + `extent: 'parent'`
- 节点拖出容器时会自动清除绑定，并恢复绝对坐标
- 绑定判定、坐标换算、容器边界裁剪都下沉到纯算法层 `loop-group-drop.ts`

对应收益：

- `loop_group` 不再只是“视觉框”，而是正式参与数据模型
- 前端拖拽结果与后端 `_execute_loop_group()` 的子图语义一致
- 后续如果要做循环块参数面板或批量拖拽，已有明确算法边界可以复用

### 3. 顺序边的等待时间功能前后端真正打通了

修复前：

- 后端 executor 已支持 `waitSeconds`
- 前端没有设置入口，也没有线上可见反馈
- 用户无法知道某条边为什么会延迟执行

修复后：

- 右键边菜单新增“设置等待时间”
- 边标签区域可直接显示 `⏱ Ns`
- 点击等待标识可直接修改等待时间

对应收益：

- `waitSeconds` 从“后端隐藏能力”变成“用户可操作能力”
- 排查执行延迟时，不必再反查 JSON 数据
- 开发者在调试工作流时能直接看见 delay 是否配置生效

### 4. logic_switch 的分支表达更清晰了

修复前：

- `logic_switch` 已有执行语义，但画布视觉与普通节点区分不够明显
- 对用户来说，“这是普通 AI 节点还是控制流节点”不够一眼可辨
- 出边虽然可带 branch 标签，但节点本体对“从这里分支”提示不强

修复后：

- `logic_switch` 采用独立 amber 分支视觉，而不是继续复用泛化 CONTROL_FLOW 主题
- 节点头部新增 `BRANCH` 标识
- 节点正文增加“从右侧或底部拖出分支”的提示
- 出边显示规则正式固定为：`logic_switch` 出边优先显示 `branch`

对应收益：

- 画布结构更容易读懂
- 分支节点与普通处理节点职责分离更清楚
- 后续做分支面板 UI 时，不需要再先补视觉语义

### 5. 前端开始真正理解后端 SSE 的真实状态

修复前：

- 后端已发出 `waiting`、`skipped`、`loop_iteration`
- 前端类型和事件消费未完全覆盖这些状态
- 文档中 SSE 事件列表落后于执行器实际行为

修复后：

- `NodeStatus` 补齐 `waiting` / `skipped`
- `WorkflowSSEEvent` 补齐 `loop_iteration`
- `use-workflow-execution.ts` 已消费 `loop_iteration`
- `executor.py` 修正了 skipped 事件在同层混合执行时不稳定的问题

对应收益：

- 前端状态、后端行为、接口文档三方一致
- 节点运行中的“等待”“跳过”“循环第几轮”不再是隐藏状态
- 后续开发执行面板、运行日志、时间轴时可以直接复用这些状态

### 6. Edge 修改逻辑不再散落在多个组件里

修复前：

- `SequentialEdge.tsx`、`EdgeContextMenu.tsx` 等处各自直接 map `edges`
- 同一个 edge 字段在不同组件里写入方式不同
- 修改一项边能力时，容易漏掉别的入口

修复后：

- 所有边数据写入统一走 `edge-actions.ts`
- note / branch / waitSeconds / reverse / delete 都有明确 action
- 显示规则统一走 `edge-display.ts`

对应收益：

- 维护成本显著下降
- 后续新增“边属性面板”时可以直接复用 action
- 测试能围绕动作层与显示层写，而不是绑定到具体组件实现

### 7. 文档状态与真实代码不一致的问题被修复

修复前：

- `edge-connection-system.md` 中存在“NodeResizer 丢失”“等待 UI 丢失”等过期描述
- 开发者如果只看文档，容易得出错误结论并重复开发

修复后：

- 文档状态已按当前实现重写
- 已完成项、真实缺口、仅剩人工验证项被重新整理

对应收益：

- 文档重新成为可靠的开发入口
- 后续不容易出现“代码和计划互相背离”的情况

---

## 三、自动化验证结果

### 前端

已通过：

```bash
cmd /c pnpm.cmd exec tsc --noEmit
cmd /c pnpm.cmd test workflow-store.property.test.ts loop-group-drop.property.test.ts edge-display.property.test.ts sse-store-update.property.test.ts
```

新增或更新的前端测试覆盖：

- `frontend/src/__tests__/workflow-store.property.test.ts`
  - `setCurrentWorkflow()` legacy 迁移
  - `logic_switch` 出边自动分支命名
- `frontend/src/__tests__/loop-group-drop.property.test.ts`
  - 节点拖入 loop_group
  - 节点拖出 loop_group
- `frontend/src/__tests__/edge-display.property.test.ts`
  - branch / note / waitSeconds 显示规则

### 后端

为执行测试，已补装 backend 虚拟环境中的开发依赖：

- `pytest`
- `hypothesis`
- `pytest-asyncio`

已通过：

```bash
backend\.venv\Scripts\python.exe -m pytest backend/tests/test_sse_events_property.py backend/tests/test_workflow_control_flow_property.py -q
```

新增或更新的后端测试覆盖：

- `backend/tests/test_sse_events_property.py`
  - SSE 合法事件集更新为
    - `node_status`
    - `node_token`
    - `node_done`
    - `loop_iteration`
    - `workflow_done`
    - `save_error`
- `backend/tests/test_workflow_control_flow_property.py`
  - 非选中分支会发出 `skipped`
  - `loop_group` 会发出多轮 `loop_iteration`
  - `waitSeconds` 取最大入边并做上限裁剪

---

## 四、这次实现解决的核心问题

### 1. 语义统一

之前画布编辑、类型定义、后端执行器、文档描述之间存在轻度分裂：

- 文档认为部分前端能力“缺失”，但代码已局部存在
- 执行器已支持 `waiting` / `skipped` / `loop_iteration`，前端类型与文档未同步
- edge 数据修改散落在多个组件内，后续容易继续漂移

本次改动把这些边界统一到了“一个真实实现版本”。

### 2. 维护性提升

本次没有继续把新增逻辑塞进 `WorkflowCanvas.tsx`，而是新增了：

- `use-loop-group-drop.ts`
- `loop-group-drop.ts`
- `edge-actions.ts`
- `edge-display.ts`

这样后续继续补右侧属性面板、规则分支、循环块参数面板时，不需要再从组件里反向拆逻辑。

### 3. 前后端契约一致

现在前端、后端、文档三方对以下事实已经一致：

- 只有 `sequential` 这一种 edge type
- `logic_switch` 通过 `data.branch` 表达分支
- `loop_group` 通过 parent-child 容器表达循环
- `waitSeconds` 是 edge 级语义
- `loop_iteration` 是正式 SSE 事件，不再是“后端内部事件”

---

## 五、面向开发者的直接结论

如果后续开发者只需要抓住这次改动的核心落点，可以直接记住下面几条：

1. 现在 edge 只有一种：`sequential`。不要再新增 `conditional edge` / `loop edge` 这一类分化设计。
2. 分支语义属于 `logic_switch + edge.data.branch`，不是 edge type。
3. 循环语义属于 `loop_group + child nodes(parentId)`，不是 edge type。
4. 旧图兼容统一在 `setCurrentWorkflow()`，不要再在页面或组件里临时 patch legacy graph。
5. 修改边数据请走 `edge-actions.ts`，不要在组件里直接 `setEdges(map(...))`。
6. 修改边显示请走 `edge-display.ts`，不要把 note/branch/wait 规则再次写散。
7. 新增运行态时，必须同步更新：
   - `types/workflow.ts`
   - `types/workflow-events.ts`
   - `use-workflow-execution.ts`
   - `docs/项目规范与框架流程/项目规范/api.md`

---

## 六、剩余未完成项

本轮剩余的是人工端到端验证，不是代码骨架问题。

建议按以下顺序做手工冒烟：

1. 两节点顺序边 + note + waitSeconds
2. `logic_switch` 三分支（A/B/默认）
3. `loop_group` 内 2 个子节点循环 3 次
4. 打开历史工作流，确认旧 edge / `loop_region` 自动迁移

如果这些手工场景通过，这一轮 control-flow 收口可以认为完成。

---

## 七、建议的下一步

如果继续推进，优先级建议如下：

1. `logic_switch` 的右侧属性面板分支管理 UI
2. `loop_group` 的右侧参数面板，而不是只靠节点头部内联编辑
3. 手工冒烟结果沉淀为更稳定的 UI/integration 测试
4. 继续拆分 `WorkflowCanvas.tsx` 历史大文件

本次实现已经把“控制流语义混乱”这个核心问题解决，后续应以增强配置体验为主，而不是再回头修基础契约。
