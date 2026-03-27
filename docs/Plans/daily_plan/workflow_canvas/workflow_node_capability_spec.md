# 工作流节点功能规格表（首版）

> 创建时间：2026-03-27
> 编码要求：UTF-8
> 依据：[`00-节点与插件分类判断.md`](/D:/project/Study_1037Solo/StudySolo/docs/项目规范与框架流程/功能流程/新增AI工具/00-节点与插件分类判断.md)、[`A型-LLM提示词节点-SOP.md`](/D:/project/Study_1037Solo/StudySolo/docs/项目规范与框架流程/功能流程/新增AI工具/A型-LLM提示词节点-SOP.md)、[`B型-外部工具节点-SOP.md`](/D:/project/Study_1037Solo/StudySolo/docs/项目规范与框架流程/功能流程/新增AI工具/B型-外部工具节点-SOP.md)

## 说明

本表用于承接 `workflow_node_system_analysis.md` 的 Phase 4。
目标不是一次性重做所有节点，而是先明确每个节点的分类、当前实现状态和下一步最小补齐方向，避免后续混做“大一统”。

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

## 审计顺序建议

1. `knowledge_base`
2. `flashcard`
3. `compare`
4. `mind_map`
5. `web_search`
6. `export_file`
7. `write_db`
8. `logic_switch`
9. `loop_map`

## 审计输出要求

每个节点后续补齐时都必须给出以下结论：

- 分类：A1 / A2 / B-Tool / B-Search / B-Augmented / C
- 后端是否闭环
- 前端是否闭环
- renderer 是否实现 `compact`
- 是否涉及新环境变量、`services/*`、`config.yaml`、数据库表
- 最小可交付版本是什么
- 验收步骤是什么
