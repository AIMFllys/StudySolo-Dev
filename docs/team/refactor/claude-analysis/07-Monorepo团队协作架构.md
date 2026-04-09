# Monorepo 团队协作架构

> 目标：设计支持多人并行开发的 Monorepo 结构

---

## 1. 当前 Monorepo 结构评估

### 1.1 现有结构
```
StudySolo/
├── frontend/                 # Next.js (port 2037)
├── backend/                  # FastAPI (port 2038)
├── supabase/                # Database migrations
├── shared/                  # Git Submodule (shared types)
├── docs/                    # Documentation
├── wiki/                    # Reserved (未实现)
├── scripts/                 # Deployment scripts
├── introduce/               # Landing page
├── .agent/                  # AI agent skills
├── .github/                 # GitHub workflows
└── .kiro/                   # Specs
```

### 1.2 评估

**优势：**
- 技术栈统一（Next.js + FastAPI）
- 共享类型通过 submodule
- CI/CD 已配置

**问题：**
- frontend 和 backend 紧耦合
- 没有清晰的模块边界
- wiki/ 目录存在但未实现
- 团队成员无法独立开发"功能模块"

---

## 2. 目标架构

### 2.1 目录结构

```
StudySolo/
├── apps/
│   ├── frontend/             # 主应用 (port 2037)
│   │   ├── src/
│   │   ├── app/            # Next.js App Router
│   │   ├── features/       # Feature modules
│   │   ├── wiki/           # Wiki 子项目
│   │   └── plugins/        # 前端插件
│   ├── backend/             # 主后端 (port 2038)
│   │   ├── app/
│   │   ├── api/
│   │   ├── services/
│   │   ├── nodes/           # 核心节点
│   │   └── plugins/         # 后端插件（子后端）
│   └── admin-panel/         # 可选：admin 独立部署
│
├── packages/                 # 共享包
│   ├── shared/               # Git Submodule (shared types)
│   │   ├── types/          # TypeScript + Python 类型
│   │   └── constants/
│   ├── ui/                  # 共享 UI 组件
│   └── config/              # 共享配置
│
├── services/                 # 独立服务（子后端 Agent）
│   ├── code-review-agent/   # 代码审查 Agent
│   ├── doc-generator-agent/ # 文档生成 Agent
│   └── custom-agent-template/
│
├── tools/                   # 开发工具
│   └── supabase/           # Database migrations
│
├── docs/                    # 项目文档
├── scripts/                 # 部署脚本
├── .github/                 # GitHub configs
└── .agent/                  # AI agent skills
```

### 2.2 模块分类

| 模块 | 类型 | 说明 |
|------|------|------|
| `apps/frontend/` | 应用 | Next.js 主应用 |
| `apps/backend/` | 应用 | FastAPI 主应用 |
| `packages/shared/` | 库 | 共享类型定义 |
| `packages/ui/` | 库 | 共享 UI 组件 |
| `services/*/` | 应用 | 独立部署的子后端 Agent |

---

## 3. 模块边界定义

### 3.1 前端 Feature Modules

每个 feature 是独立的开发单元：

```
features/
├── workflow/               # Owner: Team Member A
├── admin/                  # Owner: Team Member B
├── auth/                   # Owner: Team Member A
├── knowledge/              # Owner: Team Member C
└── community-nodes/        # Owner: Team Member C
```

**规则：**
1. Feature 之间的通信通过 public API（services/）
2. 不直接导入其他 feature 的内部组件
3. 共享组件移到 `packages/ui/`

### 3.2 后端模块

```
app/
├── api/                    # HTTP 接口（按 domain 分组）
├── services/               # 业务逻辑
│   ├── llm/              # LLM 相关
│   ├── usage/             # 使用量追踪
│   └── ...
├── nodes/                 # 核心节点
│   ├── nodes/             # 官方节点
│   └── plugins/           # 社区插件
└── engine/                # 执行引擎（稳定，较少修改）
```

**规则：**
1. Service 之间通过接口通信，不直接调用内部实现
2. 新增 service 需要在 `__init__.py` 导出 public 接口
3. 核心引擎（engine/）的改动需要额外 review

### 3.3 子后端 Agent

每个子后端是独立的 HTTP 服务：

```
services/
├── code-review-agent/     # 代码审查 Agent
│   ├── src/
│   │   ├── main.py       # FastAPI 入口
│   │   ├── agent.py       # Agent 逻辑
│   │   └── prompts.py
│   ├── tests/
│   ├── Dockerfile
│   └── README.md
│
├── doc-generator-agent/   # 文档生成 Agent
│   ├── src/
│   ├── tests/
│   ├── Dockerfile
│   └── README.md
│
└── custom-agent-template/ # 模板
    ├── src/
    ├── Dockerfile
    └── README.md
```

---

## 4. 接口协议

### 4.1 模块间通信

**前端 → 后端：** REST API
```
POST /api/workflow/execute
GET  /api/nodes/manifest
```

**后端 → 子后端 Agent：** HTTP（OpenAI 兼容格式）
```
POST http://code-review-agent/v1/chat/completions
POST http://doc-generator-agent/v1/chat/completions
```

### 4.2 共享类型定义

**`packages/shared/types/workflow.ts`**
```typescript
export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

export type NodeType =
  | 'trigger_input'
  | 'knowledge_base'
  | 'ai_analyzer'
  // ...
```

**`packages/shared/types/workflow.py`**
```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class Workflow(BaseModel):
    id: str
    name: str
    nodes: list["WorkflowNode"]
    edges: list["WorkflowEdge"]
    created_at: datetime
    updated_at: datetime

# 使用前向引用避免循环导入
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .node import WorkflowNode
```

---

## 5. 依赖管理

### 5.1 前端依赖

```json
// apps/frontend/package.json
{
  "name": "@studysolo/frontend",
  "workspaces": [
    "../../packages/*"
  ],
  "dependencies": {
    "@studysolo/shared": "*",
    "@studysolo/ui": "*"
  }
}
```

### 5.2 后端依赖

```toml
# apps/backend/pyproject.toml
[project]
name = "studysolo-backend"
dependencies = [
    "studysolo-shared @ file:///${PROJECT_ROOT}/packages/shared",
]

# packages/shared/pyproject.toml
[project]
name = "studysolo-shared"
build-system = { requires = ["hatchling"] }
```

---

## 6. 构建与部署

### 6.1 开发模式

```bash
# 启动所有服务
pnpm -w dev

# 或单独启动
pnpm --filter @studysolo/frontend dev
pnpm --filter @studysolo/backend dev
```

### 6.2 构建

```bash
# 构建所有
pnpm -w build

# 单独构建
pnpm --filter @studysolo/frontend build
pnpm --filter @studysolo/backend build
pnpm --filter @studysolo/code-review-agent build
```

### 6.3 部署架构

```
                    ┌─────────────────┐
Browser ──────────►│   Frontend      │  Next.js (Vercel/self-hosted)
                    │   (Port 2037)   │
                    └────────┬────────┘
                             │ HTTP
                    ┌────────▼────────┐
                    │   Backend       │  FastAPI (Gunicorn)
                    │   (Port 2038)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼────┐ ┌───────▼────┐ ┌──────▼──────┐
     │ Sub-Agent 1 │ │ Sub-Agent 2│ │  Sub-Agent N│
     │ Code Review │ │ Doc Gen    │ │  Custom     │
     └─────────────┘ └────────────┘ └─────────────┘
```

---

## 7. 团队分工建议

### 7.1 初期分工

| 成员 | 负责模块 |
|------|---------|
| 你（主开发者） | 整体架构、核心引擎、API 路由、CI/CD |
| 队友 A | Wiki 子项目、文档、教程 |
| 队友 B | 子后端 Agent 开发、API 集成 |

### 7.2 开发流程

```
1. 从 main 创建 feature 分支
   git checkout -b feat/wiki-setup

2. 在分配的目录内开发
   # 队友 A: apps/frontend/wiki/
   # 队友 B: services/code-review-agent/

3. 定期 rebase main
   git fetch origin
   git rebase origin/main

4. PR 合并
   # 需要至少 1 个 reviewer
   # CI 必须通过
```

---

## 8. CI/CD 配置

### 8.1 GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm -w lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm -w test

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm -w build
```

### 8.2 子后端 CI

```yaml
# services/code-review-agent/.github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
    paths: ['services/code-review-agent/**']

jobs:
  test:
    runs-on: ubuntu-latest
    container: python:3.11
    steps:
      - uses: actions/checkout@v4
      - run: pip install -e .
      - run: pytest tests/

  docker:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          context: services/code-review-agent
          push: ${{ github.ref == 'refs/heads/main' }}
```

---

## 9. 迁移计划

### Phase 1: 创建目录结构（1天）
1. 创建 `apps/`、`packages/`、`services/` 目录
2. 移动现有代码到 `apps/frontend/` 和 `apps/backend/`
3. 设置 `packages/shared/` 为 git submodule

### Phase 2: 配置 Workspace（1天）
1. 配置 `pnpm-workspace.yaml`
2. 配置共享依赖
3. 验证构建

### Phase 3: 子后端模板（2天）
1. 创建子后端 Agent 模板
2. 配置 Docker 构建
3. 编写使用文档

### Phase 4: Wiki 初始化（3-5天）
1. 分配给队友 A
2. 搭建 Wiki 基础结构
3. 编写初始文档

---

## 10. 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 子模块同步复杂 | 使用 submodule 的 CI 检查 |
| 子后端版本冲突 | Docker 镜像版本锁定 |
| 多人冲突 | 清晰的模块边界 + PR review |
| 构建时间增加 | CI 缓存 + 按需构建 |
