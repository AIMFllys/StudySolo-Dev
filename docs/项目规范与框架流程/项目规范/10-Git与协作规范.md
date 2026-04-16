# Git 与协作规范

> 文档版本：1.0.0
> 创建时间：2026-04-16
> 最后更新：2026-04-16
> 融合来源：`docs/team/commit-conventions.md`、`docs/team/pr-workflow.md`、`docs/team/issue-management.md`

---

## 1. 分支规范

### 1.1 分支命名

统一使用 `<type>/<description>`，英文小写与连字符：

```text
main
feat/<feature-name>
fix/<bug-description>
refactor/<target>
docs/<topic>
chore/<task>
security/<issue>
hotfix/<issue>
experiment/<idea>
```

### 1.2 分支保护

- `main` 禁止 force push
- 合并到 `main` 必须通过 Pull Request
- PR 必须通过 CI，且至少 1 位 reviewer 通过
- 禁止直接 commit 到 `main`

## 2. Commit 规范

### 2.1 格式

遵循 Conventional Commits：

```text
<type>(<scope>): <subject>
```

### 2.2 Type

`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`chore`、`ci`、`security`、`revert`

### 2.3 Scope 参考

`workflow`、`ai-chat`、`auth`、`wiki`、`agent`、`nodes`、`engine`、`admin`、`frontend`、`backend`、`db`、`deps`、`ci`、`scripts`

## 3. Pull Request 与 Code Review

### 3.1 PR 标题

与 commit 一致：`<type>(<scope>): <subject>`

### 3.2 合并策略

- 常规 feature：`Squash and Merge`
- 需保留完整演进历史的重构：`Merge Commit`
- 紧急安全修复：`Squash and Merge`

### 3.3 审查重点

- 功能正确、边界覆盖、异常处理
- 命名清晰、重复可控、结构可读
- 无密钥泄漏，输入验证与权限控制到位
- 关键路径测试可重复执行

## 4. Issue 管理与安全上报

### 4.1 标签

- `🟠 bug`（P1）
- `🟡 enhancement`（P2）
- `🔵 docs`（P3）
- `⚪ question`

### 4.2 安全问题

安全漏洞必须私密上报，禁止公开 issue 披露细节：

1. GitHub Security Advisory
2. 直接联系项目负责人

### 4.3 Bug 模板

```markdown
## 🟠 Bug 报告

**问题描述：**

**复现步骤：**
1.
2.

**预期行为：**

**实际行为：**

**环境：**
- OS:
- Browser:
- 后端版本:
```
