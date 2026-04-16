# 贡献指南 · StudySolo

感谢你对 StudySolo 项目的贡献！请在提交代码前阅读本指南。

---

## 开发流程

### 1. 找到或创建 Issue

- 所有工作都应该有对应的 Issue
- 查看 [Issues](https://github.com/AIMFllys/StudySolo/issues) 是否已有相关 Issue
- 如果没有，请先创建一个（选择合适的模板）
- 在 Issue 下评论 "我来做"，让团队知道你在做

### 2. 创建分支

```bash
git checkout main
git pull origin main
git checkout -b <type>/<issue-number>-<description>

# 示例
git checkout -b feat/42-quiz-gen-node
git checkout -b fix/38-sse-disconnect
```

**分支命名规范：**

| 前缀 | 用途 |
|------|------|
| `feat/` | 新功能 |
| `fix/` | Bug 修复 |
| `refactor/` | 重构 |
| `docs/` | 文档 |
| `chore/` | 工具/构建 |
| `hotfix/` | 紧急线上修复 |
| `security/` | 安全修复 |
| `experiment/` | 实验性开发 |

### 3. 编写代码

- 遵循项目现有的代码风格
- 必要时添加注释
- 新功能必须有对应测试

### 4. 提交代码

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>
```

**Type 类型：**

| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更 |
| `style` | 代码格式（不影响逻辑） |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 测试 |
| `chore` | 构建/工具变更 |
| `ci` | CI/CD 配置 |
| `revert` | 回滚 |

**Scope 范围（可选）：** 详见 [Scope 参考表](docs/项目规范与框架流程/项目规范/10-Git与协作规范.md#23-scope-参考)

**示例：**
```bash
git commit -m "feat(workflow): add quiz_gen node"
git commit -m "fix(frontend): resolve sidebar collapse on mobile"
git commit -m "docs: update API documentation"
git commit -m "test(admin): add property tests for audit API"
```

**注意事项：**
- 英文小写开头，不加句号
- 使用祈使语气（`add` 而非 `added`）
- 一个 commit 只做一件事
- 关联 Issue：`feat(workflow): add quiz_gen node (#42)`

### 5. 提交 Pull Request

```bash
git push origin feat/42-quiz-gen-node
```

在 GitHub 上创建 PR：
- 标题格式与 commit 一致：`feat(workflow): add quiz_gen node (#42)`
- 填写 PR 模板中的所有必要信息
- 关联 Issue：描述中写 `Closes #42`

### 6. Code Review

- 至少需要 **1 位团队成员** Approve
- 及时回复 Reviewer 的评论
- 根据反馈修改代码后 push 更新

### 7. 合并

- PR 获得 Approve 且 CI 通过后合并
- 推荐使用 **Squash Merge**，保持 main 历史整洁
- 合并后分支会自动删除

---

## 项目结构

```
StudySolo/
├── backend/                  # Python FastAPI 后端
│   ├── app/
│   │   ├── api/              # API 路由
│   │   ├── core/             # 核心配置（数据库、依赖注入）
│   │   ├── engine/           # 工作流执行引擎
│   │   ├── middleware/       # 中间件
│   │   ├── models/           # Pydantic 数据模型
│   │   ├── nodes/            # 工作流节点（插件架构）
│   │   ├── services/         # 业务服务层
│   │   └── utils/            # 工具函数
│   ├── config/               # 运行时配置（agents.yaml 等）
│   └── tests/                # 后端测试
├── frontend/                 # Next.js 前端
│   └── src/
│       ├── app/              # 页面路由
│       ├── components/       # UI 组件
│       ├── hooks/            # 自定义 Hooks
│       ├── services/         # API 调用服务
│       ├── stores/           # Zustand 状态管理
│       └── types/            # TypeScript 类型定义
├── agents/                   # 子后端 Agent 微服务（小李主要工作区）
├── docs/                     # 项目文档
├── scripts/                  # 开发工具脚本
├── supabase/                 # 数据库 Migrations
└── shared/                   # 跨项目共享代码（Git Submodule）
```

---

## 开发环境设置

### 后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1    # Windows
source .venv/bin/activate      # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 2038
```

### 前端

```bash
cd frontend
pnpm install
pnpm dev    # 启动在 http://localhost:2037
```

### 一键启动

```powershell
powershell -ExecutionPolicy Bypass -File "scripts\start-studysolo.ps1"
```

---

## 代码规范

### 后端 (Python)

- 使用 **Ruff** 进行格式化和 Lint
- 类型注解：所有函数参数和返回值需要类型注解
- 文件行数限制：单文件不超过 300 行
- 异步优先：所有 I/O 操作使用 `async/await`

### 前端 (TypeScript)

- 使用 **ESLint + Prettier**
- 组件使用函数式组件 + Hooks
- 状态管理使用 Zustand
- 文件行数限制：单文件不超过 300 行

---

## 测试要求

- 新功能必须有对应的测试
- Bug 修复需要添加回归测试
- 后端使用 `pytest` + `hypothesis`（Property-based Testing）
- 前端使用 `vitest`

---

## Review 评论约定

详细规范见 [Git 与协作规范](docs/项目规范与框架流程/项目规范/10-Git与协作规范.md)。快速参考：

| 前缀 | 含义 | 是否阻塞合并 |
|------|------|:----------:|
| `blocker:` | 必须修改 | ✅ 是 |
| `suggestion:` | 建议改进 | ❌ 否 |
| `nit:` | 小细节 | ❌ 否 |
| `question:` | 有疑问 | ❌ 否 |
| `praise:` | 写得好！ | ❌ 否 |

