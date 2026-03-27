# 工作流节点功能规格表（完整审计版）

> 创建时间：2026-03-27
> 最后更新：2026-03-27 16:40
> 编码要求：UTF-8
> 依据：[`00-节点与插件分类判断.md`](/D:/project/Study_1037Solo/StudySolo/docs/项目规范与框架流程/功能流程/新增AI工具/00-节点与插件分类判断.md)、[`A型-LLM提示词节点-SOP.md`](/D:/project/Study_1037Solo/StudySolo/docs/项目规范与框架流程/功能流程/新增AI工具/A型-LLM提示词节点-SOP.md)、[`B型-外部工具节点-SOP.md`](/D:/project/Study_1037Solo/StudySolo/docs/项目规范与框架流程/功能流程/新增AI工具/B型-外部工具节点-SOP.md)

## 说明

本表用于承接 `workflow_node_system_analysis.md` 的 Phase 4。
目标不是一次性重做所有节点，而是先明确每个节点的分类、当前实现状态和下一步最小补齐方向，避免后续混做"大一统"。

## 节点分类总表

| 节点 | 分类 | 当前实现基线 | 当前短板 | 下一步 |
|------|------|-------------|---------|-------|
| `trigger_input` | 输入节点 | 前后端已可传递 `user_content` | 无独立规格文档 | 维持基线 |
| `ai_analyzer` | A2 | `prompt.md + BaseNode` 闭环 | 主要依赖输出格式稳定性 | 保持 |
| `ai_planner` | A2 | `prompt.md + BaseNode` 闭环 | Plan 建议到执行桥梁此前缺失 | 已接入 `plan-executor` |
| `outline_gen` | A1 | 前后端闭环 | compact 只做摘要 | 维持 |
| `content_extract` | A1 | 前后端闭环 | compact 只做摘要 | 维持 |
| `summary` | A1 | 前后端闭环 | compact 只做摘要 | 维持 |
| `flashcard` | A1 | 基础翻卡可用 | 无导出、无学习进度、无持久化 | 先拆前端增强与导出 |
| `chat_response` | A1 | 前后端闭环 | 执行面板仅摘要 | 维持 |
| `compare` | A1 | 渲染器和 prompt 存在 | 后端实际能力需复核 | 做闭环审计 |
| `mind_map` | A1 | 渲染器和 prompt 存在 | 后端实际能力需复核 | 做闭环审计 |
| `quiz_gen` | A1 | 基础交互作答可用 | 评分/持久化能力不足 | 保持当前闭环，后续拆增强 |
| `merge_polish` | A1 | 前后端闭环 | compact 只做摘要 | 维持 |
| `knowledge_base` | B-Search / 可能升级 C | 有检索基础链路 | 文件上传、解析、索引管理不足 | 先补 B 型最小链路，再评估插件化 |
| `web_search` | B-Search / B-Augmented | 节点与渲染器存在 | 服务封装与结果整合需复核 | 做闭环审计 |
| `export_file` | B-Tool | 基础导出渲染存在 | 实际生成与下载链路需复核 | 做闭环审计 |
| `write_db` | B-Tool | 有节点壳 | 写库路径需复核 | 做闭环审计 |
| `logic_switch` | 控制流节点 | 连线与前端视觉已完成 | 条件判定能力需按执行语义复核 | 做闭环审计 |
| `loop_map` | 控制流节点 | 基础类型与 prompt 存在 | 实际执行能力需复核 | 做闭环审计 |
| `loop_group` | 结构节点 | 前后端循环容器已完成 | 执行 trace 细节后续可增强 | 保持 |

---

## 逐节点闭环审计结论

### 1. `knowledge_base`

- **分类**: B-Search
- **后端闭环**: ⚠️ 部分 — 有 `KnowledgeBaseNode`，`is_llm_node = False`，通过 `knowledge_service` 执行检索。支持上传/处理/分块，但节点级文档绑定还不够
- **前端闭环**: ✅ 有 MarkdownRenderer + compact
- **renderer compact**: ✅ 已实现
- **涉及外部依赖**: Supabase pgvector, file_parser
- **config_schema**: ✅ 有 (`top_k`, `similarity_threshold`)
- **最小可交付版本**: 当前基于用户维度的全量检索已可用
- **下一步**: 补节点级文档选择/绑定

### 2. `flashcard`

- **分类**: A1 (LLM 专一型)
- **后端闭环**: ✅ — `FlashcardNode` 继承 `BaseNode + LLMStreamMixin + JsonOutputMixin`，输出 `[{question, answer}]` JSON
- **前端闭环**: ✅ — `FlashcardRenderer.tsx` 翻转动画 + JSON 解析
- **renderer compact**: ✅ 已实现 (显示卡片数量摘要)
- **config_schema**: ✅ 有 (`card_count`, `difficulty`)
- **不涉及新环境变量/数据库表**
- **最小可交付版本**: 当前基础翻卡已可用
- **下一步**: 间隔重复、 Anki 导出 (属功能增强，非闭环缺失)

### 3. `compare`

- **分类**: A1 (LLM 专一型)
- **后端闭环**: ✅ — `CompareNode` 继承 `BaseNode + LLMStreamMixin + JsonOutputMixin`，输出含 `concepts` + `dimensions` 的 JSON，`post_process` 有结构校验
- **前端闭环**: ✅ — `CompareRenderer.tsx` 渲染对比表
- **renderer compact**: ✅ 已实现 (显示概念数 × 维度数)
- **config_schema**: ✅ 有 (`dimensions` textarea, `summary_style` select)
- **不涉及新环境变量/数据库表**
- **最小可交付版本**: 已闭环
- **验收步骤**: 构造一个含 compare 节点的工作流 → 执行 → 验证 JSON 对比表渲染正确

### 4. `mind_map`

- **分类**: A1 (LLM 专一型)
- **后端闭环**: ✅ — `MindMapNode` 继承 `BaseNode + LLMStreamMixin + JsonOutputMixin`，输出层级 JSON 树 `{root, children}`，`post_process` 有节点计数
- **前端闭环**: ✅ — `MindMapRenderer.tsx` 可折叠树状渲染
- **renderer compact**: ✅ 已实现 (显示总节点数)
- **config_schema**: ✅ 有 (`max_depth`, `branch_style`)
- **不涉及新环境变量/数据库表**
- **最小可交付版本**: 已闭环
- **验收步骤**: 构造含 mind_map 的工作流 → 验证树状图渲染

### 5. `web_search`

- **分类**: B-Search
- **后端闭环**: ✅ — `WebSearchNode` 通过 `search_service.search_web()` 调用 Tavily API，返回格式化 Markdown
- **前端闭环**: ✅ — MarkdownRenderer + compact
- **renderer compact**: ✅ 已实现
- **config_schema**: ✅ 有 (`max_results`, `search_depth`)
- **涉及环境变量**: `TAVILY_API_KEY`
- **不涉及新数据库表**
- **最小可交付版本**: 已闭环（需配置 Tavily key 才能使用）
- **验收步骤**: 设置 TAVILY_API_KEY → 执行 web_search 节点 → 验证搜索结果 Markdown 渲染

### 6. `export_file`

- **分类**: B-Tool
- **后端闭环**: ✅ — `ExportFileNode` 通过 `document_service.convert_document()` 生成文件(DOCX/PDF/MD)，已连接 `/api/exports/download/{filename}` 下载端点
- **前端闭环**: ✅ — `ExportRenderer.tsx` + compact
- **renderer compact**: ✅ 已实现 (显示文件名和格式)
- **config_schema**: ✅ 有 (`format`, `filename`)
- **涉及环境变量**: `EXPORT_DIR` (可选)
- **涉及外部依赖**: python-docx (DOCX), weasyprint (PDF, 可选)
- **最小可交付版本**: 已闭环
- **验收步骤**: 执行 export_file → 验证生成文件 → 点击下载链接

### 7. `write_db`

- **分类**: B-Tool
- **后端闭环**: ✅ — `WriteDBNode` 写入 `ss_workflow_runs.output.saved_results`
- **前端闭环**: ✅ — Passthrough/JSON 渲染 + compact
- **renderer compact**: ✅ 已实现
- **config_schema**: ✅ 有 (`save_key`, `merge_strategy`)
- **不涉及新环境变量**
- **最小可交付版本**: 第一版已闭环
- **下一步**: 查询展示、键冲突策略验证 (属功能增强)

### 8. `logic_switch`

- **分类**: 控制流节点 (A2 — 使用 LLM 判断分支)
- **后端闭环**: ✅ — `LogicSwitchNode` 输出 `{branch, reason}` JSON，executor 的 `get_branch_filtered_downstream()` 根据 `metadata.branch` 跳过非活跃分支
- **前端闭环**: ✅ — JsonRenderer + compact
- **renderer compact**: ✅ 已实现 (显示选中分支)
- **config_schema**: ✅ 有 (`branch_options` textarea, `default_branch` text)
- **executor 集成**: ✅ — `executor.py` L518-528 处理分支过滤
- **不涉及新环境变量/数据库表**
- **最小可交付版本**: 已闭环
- **验收步骤**: 创建含 logic_switch + 两个分支下游节点的工作流 → 验证只有匹配分支执行

### 9. `loop_map`

- **分类**: 控制流节点 (A2 — 使用 LLM 拆分)
- **后端闭环**: ✅ — `LoopMapNode` 输出 `[{item, label}]` JSON 数组，`post_process` 有 `is_iterable: True` 元数据
- **前端闭环**: ✅ — JsonRenderer + compact
- **renderer compact**: ✅ 已实现 (显示项目数)
- **config_schema**: ✅ 有 (`item_hint`, `max_items`)
- **executor 集成**: ⚠️ 当前 executor 未读取 `is_iterable` 元数据做下游展开。loop_map 的 JSON 数组输出作为普通文本传递给下游，下游节点自行处理
- **不涉及新环境变量/数据库表**
- **最小可交付版本**: 当前拆分+下传已可用
- **下一步**: executor 增强 — 读取 `is_iterable` 后逐项调度下游 (属执行引擎增强)

### 10. `loop_group`

- **分类**: 结构节点
- **后端闭环**: ✅ — `LoopGroupNode` 已注册到 registry，executor `_execute_loop_group()` 处理迭代编排
- **前端闭环**: ✅ — 作为 React Flow group 容器渲染
- **config_schema**: ✅ 有 (`maxIterations`, `intervalSeconds`)，刚补齐
- **executor 集成**: ✅ — `executor.py` L449-461 直接编排
- **最小可交付版本**: 已闭环

---

## 审计总结

| 节点 | 后端 | 前端 | compact | config | 状态 |
|------|------|------|---------|--------|------|
| `knowledge_base` | ⚠️ | ✅ | ✅ | ✅ | 需增强文档绑定 |
| `flashcard` | ✅ | ✅ | ✅ | ✅ | ✅ 闭环 (增强可选) |
| `compare` | ✅ | ✅ | ✅ | ✅ | ✅ 闭环 |
| `mind_map` | ✅ | ✅ | ✅ | ✅ | ✅ 闭环 |
| `web_search` | ✅ | ✅ | ✅ | ✅ | ✅ 闭环 (需 API key) |
| `export_file` | ✅ | ✅ | ✅ | ✅ | ✅ 闭环 |
| `write_db` | ✅ | ✅ | ✅ | ✅ | ✅ 闭环 |
| `logic_switch` | ✅ | ✅ | ✅ | ✅ | ✅ 闭环 |
| `loop_map` | ✅ | ✅ | ✅ | ✅ | ⚠️ 闭环但迭代下发待增强 |
| `loop_group` | ✅ | ✅ | — | ✅ | ✅ 闭环 |

**结论**: 9/10 节点已达到"最小可交付闭环"。唯一的结构性缺口是 `knowledge_base` 的节点级文档绑定和 `loop_map` 的迭代下发增强。这两项属于"功能增强"，不影响基本可用性。
