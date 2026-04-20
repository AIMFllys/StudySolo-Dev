---
name: agent-branch-handoff
description: StudySolo 子 Agent 并行开发与交接技能。用于指导“仅提交 Agent 相关代码 + README 对接说明 + 审核 Merge 后由负责人补主后端与更新日志”的标准流程。
triggers:
  - "agent分支提交"
  - "子agent提交"
  - "只提交agent代码"
  - "agent pr流程"
  - "agent对接主后端"
  - "agent README交接"
---

# Agent Branch Handoff Skill

## 激活后第一句话（必须）

激活本技能后，第一句话必须包含：

`使用 Agent 分支交接 SOP 处理本次提交`

## 必读文档（按顺序）

1. `docs/项目规范与框架流程/功能流程/团队协作/Agent分支提交SOP.md`
2. `docs/项目规范与框架流程/项目规范/10-Git与协作规范.md`
3. `docs/项目规范与框架流程/项目规范/10-Git与协作规范.md`
4. `docs/项目规范与框架流程/项目规范/02-模块边界规范.md`
5. `docs/issues/TeamRefactor/contracts/agent-gateway-contract.md`

## 核心执行规则

1. 先判断分支状态：
   - 若目标分支不存在：从 `main` 创建 `feat/subagent-*`
   - 若分支已存在：先切换并同步，不重复创建
2. 严控提交范围：
   - 默认只 `git add agents/<agent-name>/`
   - 不允许默认 `git add .`
3. 强制 README 交接：
   - 必须写清主后端对接方式（含 `agents.yaml` 建议片段）
   - 明确本 PR 是否改主后端注册表
4. PR 接力边界必须写清：
   - 开发者负责 Agent 代码 + README
   - 审核负责人负责 PR 分析、Merge 后补主后端、更新 `docs/Updates`

## 输出模板（建议）

当用户问“这次怎么提 Agent PR”时，输出应包含以下 4 段：

1. 当前分支状态与创建/切换建议
2. `git add` 精确范围
3. README 必填字段清单
4. Merge 后负责人收尾事项（主后端 + `docs/Updates`）

## 严禁行为

- 在错误分支直接提交
- 未检查暂存区文件就 commit
- README 无主后端对接信息
- 将主后端接入责任写成“无人负责”
- 漏掉 `docs/Updates` 更新

