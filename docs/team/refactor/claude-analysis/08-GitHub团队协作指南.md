# GitHub 团队协作指南

> 目标：为团队成员提供 GitHub 协作的最佳实践

---

## 1. 分支策略

### 1.1 分支命名

```
main                    # 主分支，始终可部署
├── feat/功能名          # 新功能开发
├── fix/问题描述         # Bug 修复
├── refactor/重构目标    # 代码重构
├── docs/文档更新        # 文档更新
├── chore/杂项          # 工具、CI 等
└── experiment/实验     # 实验性开发
```

**示例：**
```
feat/wiki-setup
feat/subagent-code-review
fix/workflow-execution-timeout
refactor/ai-chat-consolidation
docs/api-reference
```

### 1.2 保护分支

```yaml
# .github/workflows/protect-main.yml
name: Protect Main Branch

on:
  pull_request:
    branches: [main]

jobs:
  protect:
    runs-on: ubuntu-latest
    steps:
      - name: Check branch name
        run: |
          if [[ "${{ github.head_ref }}" =~ ^(feat|fix|refactor|docs|chore|experiment)/ ]]; then
            echo "Branch name valid"
          else
            echo "Branch name must follow pattern: type/description"
            exit 1
          fi
```

**保护规则：**
- `main` 不能 force push
- PR 必须通过 CI
- PR 必须有至少 1 个 reviewer
- 不能直接 commit 到 main

---

## 2. Pull Request 工作流

### 2.1 创建 PR

```bash
# 1. 确保 main 最新
git checkout main
git pull origin main

# 2. 创建 feature 分支
git checkout -b feat/my-feature

# 3. 开发... commit...

# 4. 推送
git push -u origin feat/my-feature

# 5. 在 GitHub 创建 PR
```

### 2.2 PR 模板

```markdown
<!-- .github/pull_request_template.md -->

## 描述
<!-- 简要说明这个 PR 做什么 -->

## 类型
- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 重构 (refactor)
- [ ] 文档 (docs)
- [ ] CI/CD
- [ ] 其他

## 影响的模块
<!-- 列出受影响的目录或文件 -->
- `backend/app/api/`
- `frontend/src/features/`

## 测试
- [ ] 单元测试通过
- [ ] 手动测试通过
- [ ] 不需要测试

## 截图（如果是 UI 改动）

## 检查清单
- [ ] 代码遵循项目规范
- [ ] 没有 console.log 或 debugger
- [ ] 注释已更新（如需要）
```

### 2.3 Code Review

**Reviewer 检查项：**
1. 功能是否按预期工作
2. 代码是否清晰、可维护
3. 是否有潜在的安全问题
4. 测试是否充分
5. 是否遵循项目规范

**Review 注释规范：**
```
<!-- 示例 -->
👍 很好
💡 建议：可以考虑用...
❌ 问题：这个实现有 bug...
🔴 阻塞：这个改动需要讨论...
```

### 2.4 合并策略

```yaml
# .github/CODEOWNERS
# 默认 owner
*       @main-owner

# 特定目录
/apps/frontend/    @frontend-owner
/apps/backend/      @backend-owner
/services/         @agent-owner
/docs/             @docs-owner
```

**Merge 方式：**
- Squash and merge（推荐用于 feature 分支）
- Merge commit（用于需要保留完整历史的改动）

---

## 3. Commit 规范

### 3.1 Commit 信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type：**
| Type | 说明 |
|------|------|
| feat | 新功能 |
| fix | Bug 修复 |
| docs | 文档 |
| style | 格式（不影响代码） |
| refactor | 重构 |
| perf | 性能优化 |
| test | 测试 |
| chore | 工具、构建 |

**示例：**
```
feat(ai-chat): 合并 ai_chat 和 ai_chat_stream 路由

- 提取共享辅助函数到 services/ai_chat/helpers.py
- 统一 intent 分类逻辑
- 保持 /ai/chat 和 /ai/chat/stream API 兼容

Closes #123
```

### 3.2 Commit Hook

```yaml
# .commitlintrc.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'chore', 'revert'
    ]],
  },
};
```

---

## 4. Issue 管理

### 4.1 Issue 模板

```markdown
<!-- .github/ISSUE_TEMPLATE/bug_report.md -->

**描述**
<!-- 简要描述问题 -->

**复现步骤**
1.
2.
3.

**预期行为**
<!-- 描述预期 -->

**实际行为**
<!-- 描述实际 -->

**环境**
- OS:
- Browser:
- Version:

**截图**

---

<!-- .github/ISSUE_TEMPLATE/feature_request.md -->

**功能描述**
<!-- 描述想要的功能 -->

**使用场景**
<!-- 描述使用场景 -->

**验收标准**
- [ ]
- [ ]

**附加信息**
```

### 4.2 Project 看板

建议使用 GitHub Projects（Kanban）：

```
待办 (Backlog)
├── 设计 Wiki 子项目结构
├── 实现子后端 Agent 模板
└── 优化 AI 路由

进行中 (In Progress)
└── 重构 ai_chat 和 ai_chat_stream

已完成 (Done)
├── 修复 loop_runner.py bug
└── 文档化 API 规范
```

---

## 5. 子模块管理

### 5.1 shared/ Submodule

```bash
# 克隆包含 submodule
git clone --recurse-submodules https://github.com/user/StudySolo.git

# 更新 submodule
git submodule update --remote shared

# 在 submodule 内工作
cd shared
git checkout -b feat/add-types
# ... 工作 ...
git push

# 在主仓库更新引用
cd ..
git add shared
git commit -m "chore: update shared submodule"
```

### 5.2 Submodule CI

```yaml
# .github/workflows/submodule.yml
- name: Check submodule
  run: |
    if [ "$(git submodule status)" != "$(cat .gitmodules)" ]; then
      echo "Submodule not up to date"
      exit 1
    fi
```

---

## 6. 团队成员工作流

### 6.1 队友 A：Wiki 开发

```bash
# 1. 创建 Wiki 分支
git checkout -b feat/wiki-setup

# 2. 在 wiki/ 目录开发
# apps/frontend/wiki/
# apps/frontend/src/app/wiki/

# 3. 提交
git add .
git commit -m "feat(wiki): 初始化 Wiki 基础结构"

# 4. PR 到 main
git push -u origin feat/wiki-setup
# 在 GitHub 创建 PR
```

### 6.2 队友 B：子后端 Agent 开发

```bash
# 1. 创建 Agent 分支
git checkout -b feat/code-review-agent

# 2. 在 services/ 目录开发
# services/code-review-agent/

# 3. 独立测试
cd services/code-review-agent
docker build -t code-review-agent .
docker run -p 8001:8000 code-review-agent

# 4. 提交（注意只提交自己负责的目录）
git add services/code-review-agent/
git commit -m "feat(agent): 添加代码审查 Agent"

# 5. PR
git push -u origin feat/code-review-agent
```

### 6.3 避免冲突

**规则：**
1. 每人负责自己的目录，不碰他人目录
2. 共享代码通过 `packages/` 或 `apps/backend/` 公共接口
3. 改动前先 rebase main
4. PR 前先 fetch + rebase

---

## 7. 代码审查检查清单

### 7.1 功能审查

- [ ] 功能按需求实现了吗
- [ ] 边界情况处理了吗
- [ ] 错误处理合理吗
- [ ] 日志是否充分

### 7.2 代码质量

- [ ] 代码清晰易读
- [ ] 函数长度合理（< 100 行）
- [ ] 没有重复代码
- [ ] 变量/函数命名有意义

### 7.3 安全

- [ ] 没有硬编码凭证
- [ ] 输入验证
- [ ] SQL 注入防护
- [ ] XSS 防护

### 7.4 测试

- [ ] 有必要的单元测试
- [ ] 测试覆盖关键路径
- [ ] 测试可重复执行

### 7.5 性能

- [ ] 没有 N+1 查询
- [ ] 没有不必要的循环
- [ ] 缓存使用合理

---

## 8. 常见问题处理

### 8.1 合并冲突

```bash
# 1. 确保 main 最新
git fetch origin
git checkout main
git pull origin main

# 2. 切回 feature 分支
git checkout feat/my-feature

# 3. 合并 main（触发冲突）
git merge main

# 4. 解决冲突
# 编辑冲突文件
git add <resolved-files>
git commit

# 5. 推送
git push
```

### 8.2 回滚 PR

```bash
# 通过 GitHub UI
# PR 页面 → Close → 提供回滚说明

# 或通过命令行
git revert <commit-hash>
git push
```

### 8.3 大文件处理

```bash
# 检查大文件
git lfs track "*.psd"
git lfs track "*.zip"

# 或使用 GitHub LFS
# https://git-lfs.github.com/
```

---

## 9. 推荐工具

| 工具 | 用途 |
|------|------|
| GitHub Desktop | GUI 客户端 |
| GitLens | VS Code Git 扩展 |
| GitHub Copilot | AI 辅助编码 |
| GitHub Actions | CI/CD |
| GitHub Projects | 项目管理 |

---

## 10. 快速参考

### 常用命令

```bash
# 创建分支
git checkout -b feat/my-feature

# 查看状态
git status

# 添加文件
git add <file>
git add .  # 添加所有

# 提交
git commit -m "type(scope): description"

# 推送
git push -u origin <branch>

# 更新 main
git fetch origin
git rebase origin/main

# 查看提交历史
git log --oneline --graph

# 查看远程
git remote -v
```
