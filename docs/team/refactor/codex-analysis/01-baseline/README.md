# 基线快照说明

本目录只做一件事：

> 在 TNRCodex 分析启动时，把当前与项目架构最相关的规范和 skills 复制一份，作为静态分析基线。

## 1. 为什么要复制

原因不是为了制造重复文档，而是为了避免后续出现以下情况：

- 原始规范继续更新，导致分析过程失去固定参照面。
- 同名 `SKILL.md` 在分析资料中互相覆盖。
- 后续重构时不知道某条结论基于哪个版本的规范。

## 2. 当前快照内容

### 项目规范快照

来源：`docs/项目规范与框架流程/项目规范/`

复制到：`01-baseline/项目规范/`

### 技能与上下文快照

来源：

- `.agent/ARCHITECTURE.md`
- `.agent/skills/architecture/SKILL.md`
- `.agent/skills/project-context/SKILL.md`
- `.agent/skills/workflow-node-builder/SKILL.md`
- `.agent/skills/parallel-agents/SKILL.md`
- `.agent/skills/intelligent-routing/SKILL.md`

复制到：`01-baseline/skills/`

其中：

- `ARCHITECTURE.md` 直接放在 `skills/` 根目录。
- 各个 `SKILL.md` 按技能名分目录保存，避免覆盖。

## 3. 使用规则

- 本目录内容不作为新的规范源，只作为分析参考快照。
- 若后续原始文档更新，需要明确写明“快照版本”和“最新版本”的差异，而不是默默替换快照。

