---
title: Agent Skills（.agent/skills）
description: 本仓库 .agent/skills 目录下的技能说明：面向 Cursor / Claude 等 AI 宿主的指令包，与 MCP、CLI 的关系，以及各 SKILL 的用途索引。
lastUpdated: 2026-04-17
---

# Agent Skills（`.agent/skills`）

在 StudySolo **本仓库**中，**Agent Skills** 是一组给 **AI 编程助手** 读的 Markdown 说明（`SKILL.md`），用于在 Cursor、Claude Code 等环境里约束「何时读哪些文档、如何调工具、有哪些安全边界」。它们 **不是** Web 应用里用户点击即可运行的产品功能。

## 与 StudySolo 应用的关系

当前 **Web 工作流画布**里，部分 Agent 相关 UI 可能展示 **skills / MCP 是否就绪** 等状态，用于产品信息与后续能力铺垫；**执行引擎并不会根据这些开关去自动运行仓库里的 SKILL 文件**。若你在应用内搭建工作流，请以界面与官方用户文档为准；本页主要服务 **开发者与仓库贡献者**。

## 与 MCP、CLI 的关系

| 能力 | 作用对象 | 说明 |
| --- | --- | --- |
| **MCP（studysolo-mcp）** | MCP Host 里的模型 | 通过标准工具调用后端 API，可查询账户、编辑画布、启动运行等。 |
| **CLI（studysolo）** | 终端用户 / 脚本 | 同后端 REST + PAT，适合自动化与运维。 |
| **Skills（本目录）** | 编辑器里的 AI | 教模型 **如何** 选择 MCP 工具、如何跑 CLI、如何遵守项目 SOP，不替代 MCP/CLI 本身。 |

三者配合方式可以理解为：**Skills 给 AI 读；MCP/CLI 给程序与 Host 用**。

## 仓库内技能索引

下列路径相对于仓库根目录。具体触发词与流程以各文件 frontmatter 为准。

| 目录 | 用途摘要 |
| --- | --- |
| `.agent/skills/studysolo-mcp` | 在 MCP Host 中如何选用 `studysolo-mcp` 工具链、处理错误、避免泄露 PAT。 |
| `.agent/skills/studysolo-cli` | 终端下 `studysolo` 的登录、`--stream` / `--poll` 选择、退出码与脚本约定。 |
| `.agent/skills/studysolo-workflow-canvas` | 通过 MCP **编辑真实画布节点/边**：`get_workflow_canvas`、`apply_workflow_canvas_patch`、先 dry run 再提交等。 |
| `.agent/skills/project-context` | 仓库架构、端口、模块边界、节点体系等 **总览**；进入本项目时优先阅读。 |
| `.agent/skills/workflow-node-builder` | **新增工作流节点类型 / 对接新 AI API / 新模型** 时的 SOP 与强制检查项。 |
| `.agent/skills/agent-branch-handoff` | 子 Agent 仓库并行开发、仅提交 Agent 代码时的 PR 与交接流程。 |
| `.agent/skills/system-diagnostics` | 全量或分域 **健康检查 / 诊断**，配合 `scripts/diagnostics/` 等路径落盘日志。 |

## 使用建议（给人类开发者）

1. **在 Cursor 等工具中**：若任务涉及 MCP 调 StudySolo，可提示助手参考 `studysolo-mcp` 与 `studysolo-workflow-canvas` 技能。
2. **在终端自动化中**：优先直接使用 **`studysolo` CLI** 或调用 REST，不必经过 Skill 文件。
3. **修改技能时**：保持 frontmatter（`name`、`description`、`triggers` 等）与正文同步，避免模型误触发或漏触发。

## 延伸阅读

- Wiki：**MCP（studysolo-mcp）**、**命令行（studysolo CLI）** 两篇。
- 仓库：`docs/项目规范与框架流程/功能流程/MCP与CLI/README.md`、`docs/项目规范与框架流程/项目规范/04-API规范.md`。
