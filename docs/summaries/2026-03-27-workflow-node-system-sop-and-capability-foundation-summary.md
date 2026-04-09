<!-- 编码：UTF-8 -->

# 工作流节点系统基线纠偏、执行链路打通与节点能力底座升级总结

> **日期**：2026-03-27
> **类型**：架构基线纠偏 + AI→画布链路修复 + 执行面板落地 + SOP 重构 + 节点能力底座建设
> **涉及模块**：Workflow Planning / Workflow Runtime / Workflow Canvas / Workflow Execution Trace / Node Manifest / Node Config / Knowledge Node / Docs Summary

---

## 1. 本轮任务目标与完成边界

本轮工作的核心不是继续追加零散修补，而是把此前围绕工作流节点系统的一整串问题，按真实代码基线重新收口，形成一套可以继续演进的统一底座。实际完成内容覆盖了以下几条主线：

1. **纠正文档前提与事实源优先级**  
   将工作流节点系统整改计划重新对齐到真实工程基线，明确实施时必须优先服从 `docs/README.md`、`docs/summary/current-engineering-baseline.md`、项目架构全景与前端工程规范，而不是继续依赖旧草案中的过期假设。

2. **打通 AI→画布 的关键断点**  
   解决 `MODIFY` 模式返回非法文本、`PLAN` 模式只停留在建议层、`BUILD` 模式缺失首个 `trigger_input.user_content` 等问题，避免 AI 生成结果无法稳定落到实际工作流图上。

3. **完成执行面板第一阶段落地**  
   在原有节点纸条与 SSE 执行状态之外，补上统一的 `executionSession` 数据层、右侧 trace drawer 组件树，以及渲染器的 `compact` 展示能力。

4. **建立节点能力元数据与配置底座**  
   以 `/api/nodes/manifest` 为节点能力描述入口，补齐 `config_schema`、`output_capabilities`、`supports_upload`、`supports_preview`、`deprecated_surface` 等字段，并接通前端节点配置抽屉。

5. **完成知识库节点内化的最小闭环**  
   将知识库文件上传、处理状态、文档摘要、分块预览从旧独立页面收回到节点配置层，推进“节点内操作优先”的真实产品形态。

6. **同步 SOP、规格表与阶段性总结文档**  
   让新增 AI 工具的分类判断、A/B 型 SOP、执行面板规划、节点能力补全总则与工作流节点规格表，都回到真实架构而不是继续依赖旧假设。

本总结只记录**已经完成**的内容。未完成项、历史债务与后续残留，已另行归档到项目根目录文档 `WORKFLOW_NODE_LONG_TASK_REMAINING.md`。

---

## 2. 文档基线与事实源纠偏（已完成）

本轮首先完成的是“先修正文档前提，再继续实施”。这是整个整改计划能够成立的前置条件。

### 2.1 主规划文档已回到真实基线

已更新：

- `docs/Plans/daily_plan/workflow_canvas/workflow_node_system_analysis.md`

完成内容：

- 新增“事实源优先级”章节，明确实施时必须服从：
  - `docs/README.md`
  - `docs/summary/current-engineering-baseline.md`
  - `docs/项目规范与框架流程/项目规范/项目架构全景.md`
  - `docs/项目规范与框架流程/项目规范/frontend-engineering-spec.md`
  - `docs/项目规范与框架流程/功能流程/新增AI工具/*.md`
- 修正 `P0A` 的实现前提，明确真实架构不是 `prompt_loader.py + prompts/nodes/*.md`
- 明确当前落地方案是：
  - `backend/app/nodes/_base.py`
  - `backend/app/prompts/identity.md`
  - `backend/app/prompts/nodes/_base_prompt.md`
  - 各节点目录下的 `prompt.md`
- 保留“`P0A` 已完成”的结论，但注明实现路径已经与原草案不同，后续必须基于当前真实代码继续推进

### 2.2 节点能力规格表已建立

已新增：

- `docs/Plans/daily_plan/workflow_canvas/workflow_node_capability_spec.md`

完成内容：

- 首次把节点按 A1 / A2 / B-Tool / B-Search / 控制流节点做了清单化整理
- 为 `trigger_input`、`ai_analyzer`、`ai_planner`、`flashcard`、`compare`、`mind_map`、`knowledge_base`、`web_search`、`export_file`、`write_db`、`logic_switch`、`loop_map`、`loop_group` 等节点补上“当前实现基线 / 当前短板 / 下一步”的审计框架
- 为 Phase 4 的逐节点补全建立统一入口，避免后续再用“边做边猜”的方式扩写节点功能

### 2.3 新建根目录残留项归档文档

已新增：

- `WORKFLOW_NODE_LONG_TASK_REMAINING.md`

完成内容：

- 把这次长任务中仍未完成的部分，与项目原有历史残留分开整理
- 为后续继续补节点能力、清质量债务、补后端测试环境提供单独追踪入口

---

## 3. AI→画布链路关键断点修复（已完成）

这一部分是本轮最关键的运行链路修复，目标是让 AI 生成、规划和修改工作流时，不再停留在“能吐文本但落不到图上”的半成品状态。

### 3.1 `MODIFY / create` 模式已加固

涉及文件：

- `backend/app/api/ai_chat_stream.py`
- `backend/app/prompts/mode_create.md`
- `frontend/src/features/workflow/hooks/use-stream-chat.ts`

完成内容：

- 后端 `mode=create` 增加了 JSON 格式纠错重试包装
- 在 `_extract_json_obj` 首次失败后，不再直接把自然语言结果透传前端，而是走严格 JSON-only 的纠错重试路径
- `mode_create.md` 已增强：
  - 强制裸 JSON 输出
  - 禁止 Markdown fence
  - 禁止解释性前缀与尾注
  - 补充 few-shot 与负例约束
- 前端 `handleModifyIntent()` 不再把 parse 失败的原始大模型文本直接展示给用户
- 当模型输出不合法时，前端现在会回落到结构化错误提示，而不是在聊天面板里裸露“一行原始文本”

### 3.2 `PLAN` 模式已从“只解析不执行”升级为“可转画布动作”

涉及文件：

- `frontend/src/features/workflow/utils/parse-plan-xml.ts`
- `frontend/src/features/workflow/utils/plan-executor.ts`
- `frontend/src/components/layout/sidebar/PlanCard.tsx`

完成内容：

- 保留 `parse-plan-xml.ts` 的纯解析职责，不再让其承担执行逻辑
- 新增 `plan-executor.ts`，负责将 `PlanStep[]` 转换为实际 `CanvasAction[]`
- Plan UI 不再在 `PlanCard` 内部直接硬编码拼装画布动作
- Plan 执行桥梁已经下沉到 workflow feature 层，后续继续演进时可以统一复用 `use-action-executor`

### 3.3 `BUILD` 模式首个输入节点已补齐 `user_content`

涉及文件：

- `backend/app/api/ai.py`
- `frontend/src/features/workflow/hooks/use-stream-chat.ts`
- `backend/app/engine/executor.py`
- `backend/app/nodes/input/trigger_input/node.py`

完成内容：

- 后端自动注入 `trigger_input` 时，已确保首个输入节点能拿到真实用户输入
- 前端在 `replaceWorkflowGraph` 之后增加了兜底同步，避免历史响应结构或旧数据漏掉 `user_content`
- 执行引擎新增了对 `trigger_input` 配置模板的输入兜底解析，允许 `config.input_template` 参与输入构造
- `trigger_input` 已能稳定承担“工作流实际首输入节点”的角色，而不再只是一个显示标签

---

## 4. 执行面板第一阶段与节点输出链路（已完成）

本轮不是只修“能不能执行”，而是把执行过程本身的可视化链路补齐，让运行态、节点纸条、右侧面板不再互相脱节。

### 4.1 新执行 trace 数据层已建立

涉及文件：

- `frontend/src/types/workflow.ts`
- `frontend/src/stores/use-workflow-store.ts`
- `frontend/src/features/workflow/utils/trace-helpers.ts`

完成内容：

- 新增 `NodeExecutionTrace`
- 新增 `WorkflowExecutionSession`
- Store 层新增：
  - `executionSession`
  - `startExecutionSession`
  - `registerNodeTrace`
  - `updateNodeTrace`
  - `appendNodeTraceToken`
  - `finalizeExecutionSession`
  - `clearExecutionSession`
- `trace-helpers.ts` 承担输入摘要、并行组标识、耗时格式化等辅助逻辑

### 4.2 SSE 执行 hook 已叠加 trace 更新

涉及文件：

- `frontend/src/features/workflow/hooks/use-workflow-execution.ts`

完成内容：

- 在不推翻原有执行状态更新逻辑的前提下，把 `node_input`、`node_status`、`node_token`、`node_done`、`workflow_done` 等事件同步写入 `executionSession`
- 让节点状态、流式 token、最终输出、工作流完成态，统一沉淀到右侧执行面板可消费的数据结构中

### 4.3 右侧执行面板组件树已落地

涉及文件：

- `frontend/src/features/workflow/components/execution/ExecutionTraceDrawer.tsx`
- `frontend/src/features/workflow/components/execution/ExecutionProgressHeader.tsx`
- `frontend/src/features/workflow/components/execution/ExecutionTraceList.tsx`
- `frontend/src/features/workflow/components/execution/TraceStepItem.tsx`
- `frontend/src/features/workflow/components/execution/TraceStepInput.tsx`
- `frontend/src/features/workflow/components/execution/TraceStepOutput.tsx`
- `frontend/src/features/workflow/components/execution/TraceParallelGroup.tsx`
- `frontend/src/features/workflow/components/canvas/WorkflowCanvas.tsx`

完成内容：

- 旧 `BottomDrawer` 的主执行视图职责已被新 trace drawer 取代
- `WorkflowCanvas` 已挂载新的执行面板
- 支持显示全局进度、步骤列表、输入摘要、输出摘要、并行组信息与流式状态
- 为后续进一步扩展“下载、局部重试、输入编辑”等能力预留了结构基础

### 4.4 节点纸条与渲染器 `compact` 规范已接通

涉及文件：

- `frontend/src/features/workflow/components/nodes/NodeResultSlip.tsx`
- `frontend/src/features/workflow/components/nodes/index.ts`
- 多个 renderer 组件

完成内容：

- `NodeResultSlip` 已支持：
  - 运行时自动展开
  - `done` 后保持展开
  - 上游 ID 到节点名映射
  - `input_snapshot` 失败时原始文本兜底
  - `pending` 文案改为更可读的等待态
- `NodeRendererProps` 已正式增加 `compact?: boolean`
- 执行面板中的结果卡与节点纸条已不再完全脱节，而是开始共享同一套节点输出事实

---

## 5. 节点 manifest 与统一配置底座（已完成）

这一部分是后续所有简单节点补全能否持续推进的真正基座。

### 5.1 后端 manifest 已从“静态标签”升级为“能力元数据入口”

涉及文件：

- `backend/app/nodes/_base.py`
- `backend/app/api/nodes.py`
- `backend/app/models/ai.py`
- `backend/app/nodes/_mixins.py`
- `backend/app/prompts/nodes/_base_prompt.md`

完成内容：

- `BaseNode` 增加能力元字段：
  - `config_schema`
  - `output_capabilities`
  - `supports_upload`
  - `supports_preview`
  - `deprecated_surface`
- `/api/nodes/manifest` 返回结构同步扩展，前端可以正式读取上述字段
- `NodeData` 已支持 `config`
- 节点执行输入中已显式纳入 `node_config`
- 通用节点 prompt 基线已把配置语义纳入统一约束，避免“前端有配置、模型完全无感知”的断层

### 5.2 前端 manifest 拉取层与类型系统已补齐

涉及文件：

- `frontend/src/services/node-manifest.service.ts`
- `frontend/src/features/workflow/hooks/use-node-manifest.ts`
- `frontend/src/types/workflow.ts`

完成内容：

- 新增 manifest service 与 hook，前端可在 workflow feature 内统一拉取节点能力描述
- 新增类型：
  - `NodeConfigFieldSchemaOption`
  - `NodeConfigFieldSchema`
  - `NodeManifestItem`
- `AIStepNodeData` 已正式支持 `config?: Record<string, unknown>`

### 5.3 节点配置抽屉与入口已打通

涉及文件：

- `frontend/src/features/workflow/components/node-config/NodeConfigField.tsx`
- `frontend/src/features/workflow/components/node-config/NodeConfigDrawer.tsx`
- `frontend/src/features/workflow/components/canvas/NodeContextMenu.tsx`
- `frontend/src/features/workflow/components/nodes/AIStepNode.tsx`
- `frontend/src/features/workflow/components/canvas/WorkflowCanvas.tsx`

完成内容：

- 节点右键菜单里的“节点配置”已不再长期 disabled
- 节点头部已增加设置入口按钮
- `WorkflowCanvas` 已接入统一配置抽屉
- 当前配置 UI 已由 manifest 的 `config_schema` 驱动，而不是继续扩写一套前端硬编码表单系统
- 后续所有简单节点能力补全，都已经有统一入口可以落配置项，不再需要继续依赖临时面板或特殊页面

### 5.4 工作流同步与数据结构已纳入 `config`

涉及文件：

- `frontend/src/features/workflow/hooks/use-workflow-sync.ts`
- `frontend/src/features/workflow/hooks/use-stream-chat.ts`
- `frontend/src/features/workflow/components/canvas/WorkflowCanvas.tsx`

完成内容：

- 节点默认数据结构已统一带上 `config: {}`
- `snapshotHash` 已纳入 `config`、`label`、`model_route`，避免节点配置变更不同步
- AI 生成并 hydrate 节点时也会补齐 `config` 基础结构

---

## 6. 简单节点能力元数据补全与运行链路增强（已完成）

本轮没有一次性把所有节点都做成“完整产品态”，但已经把多类节点的能力描述、配置约束和关键运行闭环补齐到可持续扩展的程度。

### 6.1 多类节点已补齐 `config_schema` 与能力元信息

涉及目录：

- `backend/app/nodes/input/*`
- `backend/app/nodes/analysis/*`
- `backend/app/nodes/generation/*`
- `backend/app/nodes/interaction/*`
- `backend/app/nodes/output/*`

已纳入能力元信息的代表节点包括：

- 输入类：
  - `trigger_input`
  - `knowledge_base`
  - `web_search`
- 分析/规划/控制类：
  - `ai_analyzer`
  - `ai_planner`
  - `logic_switch`
  - `loop_map`
- 生成/输出类：
  - `compare`
  - `content_extract`
  - `flashcard`
  - `merge_polish`
  - `mind_map`
  - `outline_gen`
  - `quiz_gen`
  - `summary`
  - `chat_response`
  - `export_file`
  - `write_db`

完成效果：

- 节点不再只是 `label / icon / description` 层面的展示实体
- 每个节点已经开始具备“配置字段、上传能力、预览能力、输出能力”的结构化声明

### 6.2 `write_db` 已从占位输出升级为真实写入

涉及文件：

- `backend/app/nodes/output/write_db/node.py`
- `backend/app/api/workflow_execute.py`
- `frontend/src/features/workflow/components/nodes/index.ts`

完成内容：

- `write_db` 不再只是 passthrough 占位节点
- 当前第一版真实能力已落地为：
  - 将节点结果写入 `ss_workflow_runs.output.saved_results`
- 支持基础配置：
  - `target_key`
  - `append`
  - `include_raw_output`
- 工作流执行完成时，`workflow_done` 的最终结果与写入结果会一起合并回运行记录
- 前端渲染已切换为更适合结构化数据的 JSON 展示

### 6.3 `knowledge_base` 已完成节点内最小闭环

涉及文件：

- `backend/app/nodes/input/knowledge_base/node.py`
- `frontend/src/features/workflow/components/node-config/KnowledgeNodeLibrary.tsx`
- `frontend/src/features/knowledge/hooks/use-knowledge-documents.ts`
- `frontend/src/features/knowledge/components/KnowledgeDocumentList.tsx`

完成内容：

- `knowledge_base` 已声明：
  - `supports_upload = True`
  - `deprecated_surface = "knowledge_page"`
- 节点内已支持：
  - 文件上传
  - 上传后处理状态查看
  - 文档列表选择
  - 文档摘要展示
  - 分块预览
- 文档轮询机制已加入，处理中的文件会自动刷新状态
- 当前最小目标“只要求上传文件并简单浓缩文件信息”已经完成

### 6.4 知识库旧页面已退役

涉及文件：

- 删除 `frontend/src/app/(dashboard)/knowledge/page.tsx`
- 删除 `frontend/src/features/knowledge/components/KnowledgePageView.tsx`
- 更新 `frontend/src/features/knowledge/index.ts`

完成内容：

- 知识库不再以旧独立页面作为主入口
- 上传入口已迁移到节点内
- `features/knowledge` 保留 hooks、types、utils 和可复用列表组件，服务节点内化后的能力，而不是继续维持老页面壳

### 6.5 节点配置动态化与高级表单能力

涉及文件：

- `backend/app/api/nodes.py`
- `types/workflow.ts`
- `frontend/src/features/workflow/components/node-config/NodeConfigDrawer.tsx`
- `frontend/src/features/workflow/components/node-config/NodeConfigField.tsx`

完成内容：

- 新增 `GET /api/nodes/config-options/{node_type}/{field_key}` 后端接口，提供基于当前用户上下文的动态选项获取能力
- 前端 `NodeConfigFieldSchema` 新增 `multi_select` 类型和 `dynamic_options` 标记
- 节点配置抽屉（`NodeConfigDrawer`）正式解耦旧硬编码（如 `loop_group` 特判），完全由 manifest 驱动，并在渲染时异步拉取动态上下文
- 落地 `MultiSelectField` 药丸式多选组件
- 彻底清理了 `node-config` 目录的 React Hooks 历史 Lint 债务（消除所有的 `set-state-in-effect` 等，达成 0 errors）

### 6.6 末端节点运行闭环（Loop 与 Export）

涉及文件：

- `backend/app/nodes/structure/loop_group/*`
- `backend/app/nodes/output/export_file/*`
- `frontend/src/features/workflow/constants/workflow-meta.ts`

完成内容：

- **`loop_group`（循环组）**：完成 `BaseNode` 体系注册，补齐 `config_schema`（`maxIterations`, `intervalSeconds`），移除前端针对循环节点的特殊硬编码表单
- **`export_file`（导出文件）**：文件生成后由返回系统绝对路径，升级为通过 `/api/exports/download/{filename}` 吐出标准的、受校验的下载链接
- **元数据对齐**：修复 `logic_switch` 与 `loop_map` 在前端的 `requiresModel` 标记缺失问题，与后端 `is_llm_node` 能力严格对齐
- **`knowledge_base`（知识库）补充**：基于新增的动态配置表单能力，完成了运行时基于 `document_ids` 的细粒度文档过滤闭环

---

## 7. SOP 重构与项目规范同步（已完成）

本轮不是只改代码，还把“以后该怎么新增节点、补全节点、做执行面板”写回正式流程文档，避免重复返工。

### 7.1 分类判断文档已补“新增 / 补全”双入口

已更新：

- `docs/项目规范与框架流程/功能流程/新增AI工具/00-节点与插件分类判断.md`

完成内容：

- 增加“先判断是新增还是补全”
- 增加“真实代码基线”说明
- 把 `write_db`、知识库节点内化等新现实纳入分类判断示例
- 补入 UTF-8 / 无 BOM / LF / 禁止中文转义等编码门禁

### 7.2 A 型节点 SOP 已补齐真实基线与补全规则

已更新：

- `docs/项目规范与框架流程/功能流程/新增AI工具/A型-LLM提示词节点-SOP.md`

完成内容：

- 明确真实 Prompt 基线来自 `_base.py + prompt.md`
- 模板中纳入 `output_capabilities = ["preview", "compact"]`
- 增加“现有 A 型节点补全时的额外要求”
- 明确 `node_config` 需要进入节点输入与输出语义链

### 7.3 B 型节点 SOP 已补齐节点内操作优先规则

已更新：

- `docs/项目规范与框架流程/功能流程/新增AI工具/B型-外部工具节点-SOP.md`

完成内容：

- 明确 B 型节点补全也必须先分类
- 明确“节点内上传 / 节点内工具操作”优先
- 明确旧独立页面可以退役，不能因为历史页面存在就继续把能力挂在页面上

### 7.4 执行面板规划文档已同步为“第一阶段已落地”

已更新：

- `docs/项目规范与框架流程/功能流程/新增AI工具/执行面板升级规划.md`

完成内容：

- 补入“当前落地基线”
- 将规划状态从纯设计稿推进为“部分已实现、可继续迭代”的文档

### 7.5 现有节点补全总则已建立

已新增：

- `docs/项目规范与框架流程/功能流程/新增AI工具/01-现有节点功能补全总则.md`

完成内容：

- 正式区分“新增节点流程”和“现有节点补全流程”
- 确立简单节点补全最低标准：
  - 有真实执行能力
  - 有 `config_schema`
  - 有节点内配置入口
  - 有画布预览
  - 有执行面板 `compact`
  - 有错误双视图

---

## 8. 与此前工作流系统建设的衔接结果

本轮工作不是孤立提交，而是把此前已经启动的工作流系统改造继续往前推进了一整段。

### 8.1 与工作流生成修复的衔接

延续并实质巩固了：

- `BUILD` 自动注入 `trigger_input`
- 画布节点生成与替换流程
- AI 生成节点的基础类型校验

在此基础上，本轮进一步解决了：

- `user_content` 丢失
- `MODIFY` 输出结构不稳
- `PLAN` 无执行桥梁

### 8.2 与工作流执行与 trace 体系的衔接

此前工作流执行已经具备 SSE 与节点状态更新基础，本轮完成的是：

- `executionSession` 统一追踪层
- Trace drawer 组件体系
- `compact` 渲染接口
- 节点纸条与执行面板的事实对齐

### 8.3 与节点体系和连线体系的衔接

此前已经建立了较完整的节点类型目录、控制流节点和边连接约束。本轮在这个基础上补的是：

- 节点的配置语义
- 节点的能力元数据
- 节点的实际产品入口
- 节点的文档分类和 SOP 执行方式

---

## 9. 验证结果与当前阶段结论

### 9.1 已完成验证

本轮已确认通过的验证包括：

- `frontend` 下 `npx tsc --noEmit`
- `python -m compileall backend/app`
- 一组 workflow 相关定向 Vitest
- 一组本次改动文件的定向 ESLint

### 9.2 当前阶段性结论

截至本次总结，工作流节点系统已经完成了以下阶段性收口：

1. **P0A 文档基线纠偏** 已完成  
   真实 Prompt 架构、事实源优先级和后续实施基线已经统一。

2. **P0B AI→画布关键断点修复** 已完成  
   `BUILD / MODIFY / PLAN` 的核心断点已经被接通，不再停留在只会吐文本的半成品状态。

3. **Phase 1-3 执行面板第一阶段** 已完成  
   执行数据层、trace drawer 组件树、节点 slip 与 `compact` 渲染规范已经落地。

4. **SOP 重构与节点能力底座** 已完成  
   manifest、config schema（支持动态选项）、节点配置入口、知识库动态过滤、节点文件导出下载以及现有节点补全总则已经建立。

更准确地说，本轮已经把“工作流节点系统整改”从分散修补，推进到了一个可持续迭代的新起点：

- 文档前提统一了
- AI 到画布的关键链路通了
- 执行面板不是纸面规划了
- 节点能力不再只有静态标签，表单配置具备了动态化能力
- 知识库开始以节点而不是旧页面为中心
- 后续逐节点补全已经有了统一 SOP 和能力规格表

---

## 10. 总结

这次工作完成的不是单点功能，而是一轮真正意义上的“工作流节点系统地基重浇”。此前系统里最明显的断层，集中在三个地方：

- 文档说的是旧架构，代码已经是新架构
- AI 能生成建议，但落不到真实画布动作
- 节点名义上很多，真正可配置、可预览、可追踪的能力底座不足

本轮已经把这三类断层同时补上，并且把结果写回了正式 SOP、规格表和阶段总结文档。到这里为止，工作流节点系统已经具备继续做“逐节点能力补全”的稳定基础，而不是继续在不稳定地基上堆功能。
