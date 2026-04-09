# 分支与 Commit 规范

> 最后更新：2026-04-09

## 1. 分支规范

### 1.1 分支命名

所有分支必须遵循 `<type>/<description>` 格式，使用**英文小写 + 连字符**：

```text
main                          # 主分支，始终可部署
├── feat/<feature-name>       # 新功能开发
├── fix/<bug-description>     # Bug 修复
├── refactor/<target>         # 代码重构
├── docs/<topic>              # 文档更新
├── chore/<task>              # 工具、CI、依赖等
├── security/<issue>          # 安全修复（优先处理）
└── experiment/<idea>         # 实验性开发（不保证合并）
```

**示例：**
```text
feat/wiki-setup
feat/subagent-code-review
fix/workflow-execution-timeout
refactor/ai-chat-consolidation
docs/api-reference
security/rls-policy-fix
```

### 1.2 分支保护规则

- `main` 分支**严禁 force push**
- 所有合并到 `main` 的变更必须通过 Pull Request
- PR 必须通过 CI 检查
- PR 必须有至少 **1 位 Reviewer** 批准
- 禁止直接 commit 到 `main`

### 1.3 按角色的工作分支

| 成员 | 典型分支 | 工作目录 |
|------|----------|----------|
| 羽升 | `feat/workflow-*`, `fix/*`, `refactor/*` | 全局 |
| 队员 A | `feat/subagent-*`, `feat/agent-gateway-*` | `services/`, `backend/app/api/agents/` |
| 队员 B | `feat/wiki-*`, `docs/*` | `wiki/`, `docs/` |

---

## 2. Commit 规范

### 2.1 格式

所有 Commit Message 必须遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```text
<type>(<scope>): <subject>

<body>       （可选）

<footer>     （可选）
```

### 2.2 Type 定义

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(workflow): 新增循环节点` |
| `fix` | Bug 修复 | `fix(executor): 修复双重赋值问题` |
| `docs` | 文档变更 | `docs(api): 更新 AI Chat 接口文档` |
| `style` | 代码风格（不影响逻辑） | `style(frontend): 统一缩进` |
| `refactor` | 重构（不改变行为） | `refactor(ai-chat): 合并重复路由` |
| `perf` | 性能优化 | `perf(query): 优化 N+1 查询` |
| `test` | 测试代码 | `test(auth): 补充登录测试` |
| `chore` | 工具/构建/依赖 | `chore(deps): 升级 FastAPI` |
| `security` | 安全修复 | `security(rls): 修复权限泄露` |

### 2.3 Scope 参考

| Scope | 涵盖范围 |
|-------|----------|
| `workflow` | 工作流引擎、节点执行 |
| `ai-chat` | AI 聊天路由 |
| `auth` | 认证、鉴权 |
| `wiki` | Wiki 子项目 |
| `agent` | 子后端 Agent |
| `frontend` | 前端整体 |
| `backend` | 后端整体 |
| `db` | 数据库、迁移 |
| `deps` | 依赖管理 |
| `ci` | CI/CD 流水线 |

### 2.4 Commit 示例

```text
# 好的
feat(ai-chat): 合并 ai_chat 和 ai_chat_stream 路由

- 提取共享辅助函数到 services/ai_chat/helpers.py
- 统一 intent 分类逻辑
- 保持 /ai/chat 和 /ai/chat/stream API 兼容

Closes #123

# 好的（简单改动）
fix(executor): 移除 executor.py:41-49 死代码

# 不好的
update files
fix bug
修了一些东西
```
