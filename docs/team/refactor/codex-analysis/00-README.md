# TNRCodex 总览

> 目录用途：为 StudySolo 的超大型重构提供一组可持续迭代的分析文档。
> 当前阶段：只做分析与规划，不改业务代码。
> 编码要求：全部 Markdown 使用 UTF-8（无 BOM）+ LF。

## 1. 本目录解决什么问题

当前仓库已经具备较强功能密度，但团队协作边界仍不清晰：

- 仓库是事实上的 Polyglot Monorepo，但缺少根级治理层。
- 节点、插件、社区节点、子 Agent、Wiki 这些概念有交叉，但没有形成统一的模块化体系。
- 前后端已经出现多处“同一事实被多处重复定义”的情况，未来多人协作时会进一步放大。

因此，TNRCodex 目录的目标不是立即给出“唯一正确答案”，而是先把以下事情做扎实：

- 冻结当前事实源。
- 明确现有问题是“结构问题”还是“实现问题”。
- 输出可分配给不同队友的未来模块边界。
- 为后续正式重构提供统一语言、统一术语、统一路线图。

## 2. 当前已确认的事实源

本轮分析主要以以下真实文件为准：

- 根仓：`README.md`、`.gitmodules`、`.github/*`
- 前端：`frontend/package.json`、`frontend/README.md`、`frontend/src/**/*`
- 后端：`backend/requirements.txt`、`backend/README.md`、`backend/app/**/*`
- 数据库：`supabase/migrations/*`
- 共享层：`shared/README.md`、`shared/docs/*`
- 项目上下文：`.agent/ARCHITECTURE.md`、`.agent/skills/project-context/SKILL.md`
- 节点/插件 SOP：`docs/项目规范与框架流程/功能流程/新增AI工具/*`

## 3. 当前目录结构

- `01-baseline/`
  - 复制现有项目规范与关键 skills，作为本轮分析的基线快照。
- `02-repo-current-state.md`
  - 当前仓库真实结构与运行关系。
- `03-architecture-debt.md`
  - 当前架构债务、重复定义、职责断层。
- `04-monorepo-target.md`
  - 目标 monorepo 形态与根级治理设计。
- `05-node-plugin-strategy.md`
  - 节点、插件、社区节点、SOP 的重构方向。
- `06-sub-backend-agent-architecture.md`
  - 多 Agent 子后端与 OpenAI 兼容子后端架构。
- `07-team-collaboration-and-github.md`
  - GitHub 协作、模块 ownership、PR 规则。
- `08-wiki-main-project-interface.md`
  - Wiki 子项目与主项目接口、同步边界。
- `09-future-direction.md`
  - 未来方向、阶段性重构原则、优先级。
- `10-analysis-roadmap.md`
  - 后续正式分析和重构执行顺序。

## 4. 本目录的使用规则

1. 所有结论都要回到真实代码与真实文档，不接受“想象中的已实现架构”。
2. 讨论“未来方向”时，必须先说明“当前痛点”。
3. 讨论“团队协作”时，必须先落实模块边界，再谈流程。
4. 讨论“插件”和“子后端”时，必须区分：
   - 运行时扩展点
   - 仓库内独立模块
   - 可独立开发的前后端单元
   - 可独立部署的服务
5. Wiki 不视为主系统代码的一部分，但视为主项目文档架构的一部分。

## 5. 本轮分析的硬约束

- 不修改 `frontend/`、`backend/`、`shared/`、`supabase/` 的业务代码。
- 不修改现有项目规范原文，只复制到 `01-baseline/` 作为分析快照。
- 所有判断优先服务于“未来多人协作可拆分开发”，而不是单人继续堆功能。

