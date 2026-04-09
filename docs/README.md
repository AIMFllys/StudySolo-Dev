<!-- 编码：UTF-8 -->

# StudySolo 文档入口

> 最后更新：2026-04-09
> 当前状态：文档基于真实代码审查全面更新，团队协作规范已建立

## 先看什么

1. [项目规范与框架流程/项目规范/项目架构全景.md](项目规范与框架流程/项目规范/项目架构全景.md)
   唯一可信的架构全景文档，包含前后端完整结构、技术栈、部署架构、边界约束。
2. [summaries/current-engineering-baseline.md](summaries/current-engineering-baseline.md)
   当前工程基线，只写已经落地的真实状态、门禁命令和事实源优先级。
3. [项目规范与框架流程/项目规范/progress.md](项目规范与框架流程/项目规范/progress.md)
   当前开发进度、已完成项和下一阶段待办。
4. [项目规范与框架流程/项目规范/frontend-engineering-spec.md](项目规范与框架流程/项目规范/frontend-engineering-spec.md)
   前端工程约束，已按 `features/workflow`、`features/knowledge` 等新结构更新。

## 当前可信事实

- 后端执行入口统一到 `backend/app/engine/executor.py`
- 用户认证路由已经拆分为 `backend/app/api/auth/` 包（login/register/captcha/_helpers）
- 知识库处理已经下沉到 `services/document_service.py` 与 `services/knowledge_service.py`
- 前端 workflow、knowledge、admin、auth、settings 已完成 feature 化
- `components/business/` 已退出当前前端结构
- 前端图标以 Lucide React 为主，Material Symbols 为辅（本地静态字体）
- SSE 本轮只做内部标准化，外部兼容事件名保持不变
- Supabase 现状以实时项目和 MCP 核验结果为准

## 文档分层

| 目录 | 说明 |
|------|------|
| `项目规范与框架流程/项目规范/` | 项目规范文件：架构全景、API 契约、设计规范、命名规范、前端工程规范、开发进度 |
| `项目规范与框架流程/项目介绍/` | 面向项目理解的介绍型文档（产品概述、节点体系） |
| `项目规范与框架流程/功能流程/` | 功能流程规范：双仓库协作流程、新增 AI 工具 SOP 等 |
| **`team/`** | **团队协作中心**：团队分工、Commit 规范、分支策略、PR 流程、Issue 规范、接口同步 |
| `team/refactor/` | 代码重构计划：Codex 分析 + Claude 分析 + 对比 + 最终综合方案 |
| `plans/` | 规划与专题方案：日常计划、阶段积累计划、Prompt 分析 |
| `summaries/` | 工程基线和历史阶段总结（历史总结仅用于追溯） |
| `updates/` | 每日更新日志（只记录当时做了什么，不代表当前结构） |
| `issues/` | Issue 专项分析文档 |
| `技术指导/` | 概念图与深度技术指导文档 |

## 团队协作速查

- **团队协作总纲**：[team/README.md](team/README.md) — 包含分工、Commit 规范、分支策略、SOP 流程
- **代码重构计划**：[team/refactor/README.md](team/refactor/README.md) — 重构分析与最终方案导航
- **双仓库协作流程**：[项目规范与框架流程/功能流程/双仓库协作流程.md](项目规范与框架流程/功能流程/双仓库协作流程.md)

## 文档治理规则

- 与当前架构直接冲突、会误导开发的旧文档，不删除，只重命名为 `已过期-*`
- 历史总结和更新日志可以保留，但默认不高于代码、测试和当前入口文档
- 涉及数据库现状、RLS、迁移数量、共享表结构的描述，必须以实时核验结果为准

## 共享规范

- 跨项目 Supabase/Auth/命名约束：[../shared/AGENTS.md](../shared/AGENTS.md)
- 共享数据库规范：[../shared/docs/conventions/database.md](../shared/docs/conventions/database.md)
- 跨项目决策记录：[../shared/docs/decisions/log.md](../shared/docs/decisions/log.md)
