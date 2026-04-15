# 2026-04-15 更新日志（Agent 协作 SOP 重写）

## 1. 重写 Agent 分支提交 SOP（人话版）

已重写：

- `docs/项目规范与框架流程/功能流程/团队协作/Agent分支提交SOP.md`

本次重写重点：

- 明确“在主仓开发 Agent，但提交范围默认只限 `agents/<agent-name>/`”
- 新增“分支已存在时先切换再开发”的标准步骤
- 强化 `git add` 范围控制，明确禁止默认 `git add .`
- 新增 Agent README 交接清单（主后端对接所需信息）
- 明确 PR 接力：开发者提交 Agent 代码 + README，审核负责人完成分析、Merge、主后端接入和收尾
- 新增 Merge 后负责人必做项：更新 `docs/Updates` + 在 PR 中补充闭环说明

## 2. 新增团队 Skill：Agent 分支交接

新增：

- `.agent/skills/agent-branch-handoff/SKILL.md`

目标：

- 将 Agent 分支提交流程从文档规则转为可被 AI 复用的执行技能
- 固化四件事：分支切换、`git add` 范围、README 交接、Merge 后接力

## 3. README 导航更新

已更新 `README.md`：

- 文档导航新增 `Agent 分支提交 SOP` 入口
- AI Skills 清单新增 `agent-branch-handoff` 条目

# 2026-04-15 更新日志（Agent 协作 SOP 重写）

## 1. 重写 Agent 分支提交 SOP（人话版）

已重写：

- `docs/项目规范与框架流程/功能流程/团队协作/Agent分支提交SOP.md`

本次重写重点：

- 明确“在主仓开发 Agent，但提交范围默认只限 `agents/<agent-name>/`”
- 新增“分支已存在时先切换再开发”的标准步骤
- 强化 `git add` 范围控制，明确禁止默认 `git add .`
- 新增 Agent README 交接清单（主后端对接所需信息）
- 明确 PR 接力：开发者提交 Agent 代码 + README，审核负责人完成分析、Merge、主后端接入和收尾
- 新增 Merge 后负责人必做项：更新 `docs/Updates` + 在 PR 中补充闭环说明

## 2. 新增团队 Skill：Agent 分支交接

新增：

- `.agent/skills/agent-branch-handoff/SKILL.md`

目标：

- 将 Agent 分支提交流程从文档规则转为可被 AI 复用的执行技能
- 固化四件事：分支切换、`git add` 范围、README 交接、Merge 后接力

## 3. README 导航更新

已更新 `README.md`：

- 文档导航新增 `Agent 分支提交 SOP` 入口
- AI Skills 清单新增 `agent-branch-handoff` 条目

