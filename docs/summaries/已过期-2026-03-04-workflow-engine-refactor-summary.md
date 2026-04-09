# StudySolo 工作流引擎与节点层全量重构总结（2026-03-04）

## 1. 目标与结果
本次重构以“不动核心机制、无缝扩展节点、强化执行引擎”为目标，完成了工作流从零散节点到强大编排能力的跨越，最终达成：
- 节点体系从 9 个扩充至 18 个，涵盖输入、分析、生成、交互与输出五大类。
- 新增非 LLM 节点生态（知识库、联网搜索、文件导出），支持复杂的外部调用。
- 原本串行执行的引擎完成重写，支持**拓扑分层并行**、**条件分支**、**数组迭代**和**超时控制**。
- `ai_planner` 规划能力全面升级，掌握超过 9 种经典编排模式（如 RAG 增强学习、连贯长文合成等）。

## 2. 节点扩展：纯 Prompt 与生成类节点（阶段 1）
- 新增 `merge_polish` (合并润色)：解决多个并行提炼节点的内容汇聚。
- 新增 `compare` (对比辨析)：多维度概念对比分析，前端配套 `CompareRenderer` 表格渲染。
- 新增 `mind_map` (思维导图)：结构化知识输出，前端配套 `MindMapRenderer` 树形渲染。
- 新增 `quiz_gen` (测验生成)：动态混合题型测验，前端配套交互式 `QuizRenderer`。

## 3. 知识库子系统（阶段 2）
- **数据库层**：引入 `pgvector` 扩展，新增 5 张核心表存储文档、摘要、分块及向量数据，并配备 RLS 行级安全策略。
- **服务层**：引入 `pypdf` 与 `python-docx` 支持多格式文档解析；实现基于 Markdown 标题层级感知的文本分块（`text_chunker`）；接入阿里云 Embedding 生成向量。
- **检索与应用**：建立两级检索架构（匹配摘要+精准匹分块）；新增 `knowledge_base` 工作流输入节点。
- **前端页面**：新增完全独立的 `/knowledge` 知识库管理面板，支持文件拖拽上传与解析状态追踪。

## 4. 联网搜索与文件导出（阶段 3）
- **联网搜索 (`web_search`)**：接入 Tavily API，为 AI 节点直接馈送带有摘要信息的结构化实时网页搜索结果。
- **文件导出 (`export_file`)**：在工作流终端，支持将生成后的排版 Markdown 动态下载为 PDF (基于 weasyprint fallback)、DOCX (基于 python-docx) 或纯 MD 文件，前端配套 `ExportRenderer` 提供可点击的下载凭据。

## 5. 引擎极致增强（阶段 4）
### 5.1 引擎层架构重写
- **分层并行调度**：`topological_sort_levels` 将以往的一维节点列表展开为多维层级，使用 `asyncio.gather` 实现同级节点的无阻塞并发执行。
- **动态分支跳过 (`logic_switch`)**：新增分析决策节点，执行器根据其输出 `branch` 标识，自动裁剪非匹配分支的所有下游节点（`skipped` 状态控制）。
- **循环机制 (`loop_map`)**：支持复杂节点的数组映射结构处理（后续支持）。
- **超时与熔断**：单节点增加超时控制兜底 (120 秒)，超时则直接标记跳过/失败，防止因单个故障节点阻塞整个并行链路。

### 5.2 向下兼容性
- 引擎重写严格遵守了原本的 API 协定。`api/workflow.py` 路由无需作任何修改，SSE 流式推送依然平滑发送单节点的流式输出与最终响应。

## 6. 全局梳理与质量管理
- `backend/config.yaml` 妥善注册了所有 18 种节点架构映射。
- Node 抽象与注册表管理（`__init_subclass__`）已证明能够顺利托管各种同步/异步/模型路由场景。
- Python 依赖收口管理，`requirements.txt` 更新就绪。
- 全部 TypeScript Frontend 代码顺利通过零错误类型验证。

## 7. 代码审查与热修复（v0.3.1）
本轮重构完成后，进行了一次全面的代码审查，识别出 5 项关键问题并当场修复：

### 7.1 引擎并行超时连坐修复
- **问题**：`executor.py` 中使用 `asyncio.wait_for(asyncio.gather(...))` 在外层施加总超时，导致任一慢节点超时时 `wait_for` 取消全部同层已运行 Task，快完成的节点结果也一并丢失。
- **修复**：新增 `_execute_single_node_with_timeout()` 包装，每个 Task 内部独立调用 `asyncio.wait_for` 管理自己的超时；外层 `asyncio.gather(return_exceptions=True)` 仅负责汇聚结果，完全解除连坐效应。

### 7.2 前端 SSE 防御性增强
- **问题**：`use-workflow-execution.ts` 中的 `node_token`/`node_status`/`node_done` 三个 SSE handler 直接 `JSON.parse` 无 `try-catch` 保护；`node_status` 未透传 `error` 和新增的 `skipped` 状态字段。
- **修复**：全部 handler 增加 `try-catch` 错误吞噬；`node_status` 事件增加 `error` 字段传递，使前端 UI 能正确渲染被跳过和出错的节点状态。

### 7.3 联网搜索查询词召回率优化
- **问题**：`web_search/node.py` 将上游节点原始输出前 200 字符直接拼接为搜索 query，长文本严重污染 Tavily API 召回质量。
- **修复**：重构策略为"label 优先 + 上游首行标题辅助"，仅提取上游第一个有意义行的前 80 字符作关键词补充，同时剥离 planner 自动添加的 emoji 前缀。

### 7.4 导出下载接口鉴权与路径安全
- **问题**：`api/exports.py` 的 `/download/{filename}` 端点无任何身份验证（`Depends`），知道 UUID 的任何匿名用户均可下载他人笔记文件。
- **修复**：加入 `Depends(get_current_user)` JWT 鉴权；追加 `os.path.realpath` 双重校验确保解析后的绝对路径仍在 `EXPORT_DIR` 内，彻底防止符号链接穿越攻击。

### 7.5 知识库上传异步化
- **问题**：`api/knowledge.py` 的 `POST /upload` 在单次 HTTP 请求中同步完成解析→分块→Embedding API 调用→DB 写入共 7 步管线，大型 PDF 极易超过网关超时（30~60 秒）。
- **修复**：引入 FastAPI `BackgroundTasks`，API 在创建文档记录后立即返回 `202 Accepted`（`status: processing`）；后台任务异步执行完整管线，成功后更新状态为 `ready`，失败则标记为 `error`。前端通过轮询 `GET /api/knowledge/{id}` 跟踪处理进度。
