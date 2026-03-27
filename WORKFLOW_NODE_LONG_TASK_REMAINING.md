# 工作流节点系统长任务未完成项与历史遗留汇总

更新时间：2026-03-27 16:40 (第三轮更新)

本文档用于汇总这次"工作流节点系统 / SOP 重构 / 简单节点能力补全"长任务中仍未完成的内容，以及在该长任务开始前项目里就已经存在、目前仍未解决的残留任务。本文档仅做事实归档与后续执行参考，不替代正式 SOP、架构文档和阶段计划。

编码要求：
- 本文件必须保持 UTF-8
- 无 BOM
- LF 换行
- 禁止中文转义
- 禁止乱码提交

## 1. 本轮已经完成的主线内容

### 1.1 SOP 与规范层

- 已按真实代码基线修正 `docs/项目规范与框架流程/功能流程/新增AI工具/00-节点与插件分类判断.md`
- 已按真实代码基线修正 `docs/项目规范与框架流程/功能流程/新增AI工具/A型-LLM提示词节点-SOP.md`
- 已按真实代码基线修正 `docs/项目规范与框架流程/功能流程/新增AI工具/B型-外部工具节点-SOP.md`
- 已更新 `docs/项目规范与框架流程/功能流程/新增AI工具/执行面板升级规划.md` 的当前落地状态
- 已新增 `docs/项目规范与框架流程/功能流程/新增AI工具/01-现有节点功能补全总则.md`
- 已把真实 Prompt 装配基线统一到 `backend/app/nodes/_base.py` 三段式拼接方案，不再沿用旧草案中的 `prompt_loader.py`

### 1.2 后端底座

- `/api/nodes/manifest` 已扩展，节点 manifest 已支持：
  - `config_schema`
  - `output_capabilities`
  - `supports_upload`
  - `supports_preview`
  - `deprecated_surface`
- `NodeData` 已新增 `config`
- 执行上下文已补充 `user_id`、`workflow_id`、`workflow_run_id`
- `write_db` 已从占位节点升级为真实写入 `ss_workflow_runs.output.saved_results`
- `trigger_input` 已支持从 `config.input_template` 提供输入模板兜底
- 多个简单节点已补齐 `config_schema` 与基础能力元数据

### 1.3 前端底座

- 已新增节点 manifest 拉取层
- 已新增统一节点配置抽屉
- 已开放节点右键菜单"节点配置"入口
- 已在节点头部增加配置入口按钮
- `AIStepNodeData` 已支持 `config`
- 工作流同步哈希已纳入 `config`
- `write_db` 前端渲染已改为 JSON 展示

### 1.4 知识库节点内化

- 独立知识库页面入口已退役：
  - `frontend/src/app/(dashboard)/knowledge/page.tsx`
  - `frontend/src/features/knowledge/components/KnowledgePageView.tsx`
- 知识库上传、文档列表、处理状态、简单摘要、分块预览已接入节点配置面板
- 上传入口已从独立页面转入节点内

### 1.5 第二轮完成的架构重构内容

- 提示词系统统一（`identity.md` + `_base_prompt.md` + 节点级 `prompt.md`）
- AI-画布链路加固（MODIFY JSON 重试、BUILD trigger_input 传递、Plan 执行桥梁）
- 执行追踪基础设施（`NodeExecutionTrace`、`WorkflowExecutionSession`、推理链组件）
- 执行面板升级（BottomDrawer → 推理链抽屉，10 渲染器均适配 compact）
- Git Commit（48 文件）

### 1.6 第三轮完成的闭环审计内容 ✅ NEW

- **`loop_group` 注册修复**: 新建 `backend/app/nodes/structure/loop_group/node.py`，补齐 `config_schema`（maxIterations、intervalSeconds），注册到 NODE_REGISTRY（19/19 节点全部在册）
- **`export_file` 下载链路连通**: 移除 filepath 暴露，改为 `/api/exports/download/{filename}` 下载链接
- **`knowledge_base` 节点级文档绑定**: 新增 `document_ids` multi_select 配置项，service 层支持 document_ids 过滤
- **逐节点闭环审计**: 完成 `workflow_node_capability_spec.md` 全部 10 个待审计节点的闭环结论
- **前后端 `requiresModel` / `is_llm_node` 对齐**: 修复 `logic_switch`、`loop_map` 的 `requiresModel` 为 `true`

### 1.7 已完成验证

- `frontend` 下 `npx tsc --noEmit` 已通过
- `python -m compileall backend/app` 已通过（含第三轮新增文件）
- 已跑通一组前端定向 Vitest
- 已跑通一组本次改动文件的定向 ESLint

## 2. 本轮仍未完成的内容

这一部分指的是：本次长任务目标里明确提出过，但目前只完成了部分，或者尚未真正落代码的内容。

### 2.1 简单节点"逐个补全" — 已大幅收窄 ✅ UPDATED

~~目前完成的是"统一底座 + 配置通路 + 知识库节点内上传 + 一部分节点 schema/manifest 接入"~~

**当前状态**：所有 19 个节点均已完成 config_schema + manifest + prompt.md + compact 渲染器。逐节点闭环审计结论见 `workflow_node_capability_spec.md`。

仍可增强但非闭环阻塞：

- `flashcard` — 间隔重复、Anki 导出（属功能增强）
- `quiz_gen` — 评分持久化、难度自适应（属功能增强）
- `knowledge_base` — 知识片段引用可视化（属 UX 增强）

### 2.2 控制流节点的体验补全 — 已基本闭环 ✅ UPDATED

- `logic_switch` — ✅ 已闭环（分支执行 + 配置 + JSON 渲染 + compact + executor 集成）
- `loop_map` — ✅ 基本闭环（拆分 + JSON 输出），⚠️ executor 迭代下发待增强
- `loop_group` — ✅ 已闭环（注册 + config_schema + executor 编排）

### 2.3 B 型工具节点 — 已全部闭环 ✅ UPDATED

- `web_search` — ✅ 闭环（Tavily API + Markdown 渲染 + compact + config 驱动）
- `export_file` — ✅ 闭环（文件生成 + 下载 API + 下载链接输出）
- `write_db` — ✅ 闭环（真实写入 + JSON 渲染 + compact）

### 2.4 知识库节点 — 已达最小增强 ✅ UPDATED

- ✅ 节点内上传 + 文档处理状态 + 简单摘要/分块预览
- ✅ 节点级文档选择过滤（document_ids config + service 层过滤）
- ⚠️ 仍可增强：检索参数持久化的前端 UI、知识片段引用高亮

### 2.5 节点配置框架还只是第一阶段

- 目前配置抽屉已经可用
- 但还没有把所有字段类型和所有节点的配置体验做到完全统一
- 还缺：
  - 更丰富的 schema 控件类型（如 multi_select 的前端渲染）
  - 配置默认值回填规则完善
  - 节点内快捷动作与配置抽屉之间的统一动作层

### 2.6 执行面板和节点输出的一致性还没有做最终收口

- 当前已经有 trace drawer 的第一阶段实现
- 所有 10 个渲染器均已适配 compact 模式
- 仍可提升：错误双视图的一致性、全局执行进度条

## 3. 这次长任务开始前就已经存在、现在仍未解决的遗留任务

这一部分不是本次改动新引入的问题，而是项目原本就存在、此次任务中没有一起清掉的历史残留。

### 3.1 全仓前端 lint 债务仍然存在

当前仍未达到"全仓 `npm run lint` 通过"的状态。已有问题包括但不限于：

- React hooks 相关规则问题
- `set-state-in-effect`
- `refs` 在 render 中被直接读写
- `Date.now()` 的纯度警告
- `static-components` 相关问题
- Next.js 路由中 `<a>` 与 `<Link>` 的规范问题

这些问题分布在多个老文件中，不是本轮单独引入，但仍阻塞"全仓 lint 绿灯"。

### 3.2 前端文件体积与页面体积债务仍然存在

当前仍未达到：

- `npm run lint:lines:strict` 通过
- `npm run lint:pages` 通过

已知问题包括但不限于：

- `frontend/src/styles/workflow.css` 行数过长
- `frontend/src/features/workflow/components/canvas/WorkflowCanvas.tsx` 行数过长
- `frontend/src/stores/use-workflow-store.ts` 行数过长
- 多个 sidebar / page 文件超过项目规定的长度上限

这说明工作流相关模块仍需继续拆分，而不是只补功能。

### 3.3 后端完整测试门禁未跑通

当前未完成：

- `python -m pytest tests`

本次环境里的直接阻塞是：

- 当前 Python 环境缺少 `pytest`

因此现在只能确认：

- 语法级编译通过
- 定向前端测试通过

但不能宣称"后端全量回归通过"。

### 3.4 节点目录与前端元数据 — 双源问题已缩小 ✅ UPDATED

~~manifest 还不是所有节点 UI 的唯一事实源~~

**当前状态**：
- `requiresModel` 已与后端 `is_llm_node` 对齐
- manifest 负责 config_schema / output_capabilities / is_llm_node
- workflow-meta.ts 负责 Lucide 图标 / Tailwind 主题类 / 端口规格 / 状态样式
- 两者职责已明确分离，不再是"重复维护"

剩余优化：后续可考虑从 manifest 自动生成 workflow-meta.ts 的部分字段

### 3.5 旧知识库功能代码还有进一步清理空间

虽然独立页面入口已经删除，但 `frontend/src/features/knowledge` 目录中仍保留了一些为了节点内复用而留下的 hooks、types、utils、列表组件。

这不是错误，但还存在后续工作：

- 继续识别并删除真正只服务旧页面的死代码
- 把"知识库作为独立功能页"的文案与隐式假设清干净

### 3.6 工作流相关大文件的结构治理尚未完成

工作流系统目前仍有若干大文件承担过多职责，尤其是：

- `WorkflowCanvas.tsx`
- `use-workflow-store.ts`
- 若干 sidebar 组件

本轮优先做的是"能力打通"，不是"大规模解耦重构"，所以结构治理还没完成。

## 4. 当前明确存在的环境或流程阻塞

### 4.1 本机缺少 pytest

影响：

- 无法完成后端全量测试
- 无法给出完整回归结论

### 4.2 全仓质量门禁仍被历史问题阻塞

影响：

- 即使本轮改动已经局部通过，也不能宣称全仓质量门禁通过
- 后续需要单独安排"历史债务清理批次"

## 5. 建议的后续执行顺序

### 5.1 功能增强批次（可选，非闭环阻塞）

- `flashcard` 间隔重复 + Anki 导出
- `quiz_gen` 评分持久化
- `knowledge_base` 引用高亮
- `loop_map` executor 迭代下发增强

### 5.2 配置框架第二阶段

- multi_select 前端控件
- 配置默认值回填
- 动态选项 API（如 knowledge_base 的文档列表）

### 5.3 最后单独开债务治理批次

单独处理：

- 全仓 lint 历史问题
- 行数/页面体积超限问题
- 后端测试环境补齐
- 工作流大文件拆分

## 6. 当前状态结论

经过三轮迭代，工作流节点系统已达到以下状态：

- ✅ SOP 已回到真实架构
- ✅ manifest 与节点配置底座已接通
- ✅ 知识库上传已回收到节点内 + 文档级过滤
- ✅ 所有 19 个节点已注册、有 config_schema、有 prompt.md
- ✅ 所有 10 个渲染器已适配 compact
- ✅ 逐节点闭环审计已完成
- ✅ export_file 下载链路已贯通
- ✅ loop_group 已正式注册到 manifest 体系
- ✅ 前后端 requiresModel / is_llm_node 已对齐

残留事项均属"功能增强"或"历史债务"，不影响核心节点的基本可用性。

后续执行时，必须继续遵守以下约束：

- 保持 UTF-8 编码
- 禁止弄坏中文
- 按更新后的 SOP 分类执行
- 不把简单节点补全再次做成无边界的大重构
