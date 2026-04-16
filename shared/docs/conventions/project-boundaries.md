# 项目边界规范

> 最后更新：2026-04-12
> 文档编码：UTF-8（无 BOM） / LF

本文档用于避免把 Platform、StudySolo、`shared` 三者的边界写混。

## 1. 项目对照

| 维度 | Platform | StudySolo |
| --- | --- | --- |
| 前端 | React + Vite | Next.js 16.1.6 + React 19.2.3 |
| 后端 | Node / Express 体系 | FastAPI |
| 认证 | 遗留 session / bcrypt 体系 | Supabase Auth + JWT |
| 用户业务表 | Platform legacy 表 | `user_profiles` |
| 默认前端端口 | 3037 | 2037 |
| 默认后端端口 | 3038 | 2038 |

## 2. shared 与 subtree 的边界

### 当前 StudySolo 仓库

- `shared/` 是 **Git Submodule**
- 通过 `.gitmodules` 管理
- 事实来源：`.gitmodules` 文件

### Platform Monorepo

- `StudySolo/` 是 **Git Subtree**
- 用于把 StudySolo 主仓库代码同步进 Platform Monorepo

## 3. StudySolo 侧禁止事项

- 使用 Platform legacy 用户表作为正式用户模型
- 把 `shared/` 写成 subtree
- 把 `selected_platform + selected_model` 写成新的主选型字段
- 把 `*_usd` 写成新的正式金额字段

## 4. 共享文档规则

- 共享文档只能写跨项目稳定事实
- 单项目运行时实现细节应放回项目文档
- 边界文档必须同时指出：
  - `shared` 在当前仓库中的 submodule 身份
  - Platform 中 StudySolo 的 subtree 身份

## 5. 文档路径规范

### 废弃路径（不要使用）

以下路径已废弃，统一迁移到 `docs/issues/TeamRefactor/`：

- `docs/plan/TeamNewRefactor/*` → `docs/issues/TeamRefactor/*`
- `docs/Plans/TNRCodex/*` → `docs/issues/TeamRefactor/codex-analysis/*`

### 当前规范文档结构

```
docs/
├── team/                        # L0 权威：团队协作铁规
│   ├── README.md
│   ├── roles.md
│   ├── commit-conventions.md
│   ├── issue-management.md
│   ├── interface-sync.md
│   ├── pr-workflow.md
│   └── refactor/                # 重构计划与实施
│       ├── final-plan/          # Phase 0-5 实施计划
│       │   ├── 00-索引.md
│       │   ├── phase-0-foundation.md
│       │   ├── phase-1-contract-freeze.md
│       │   ├── phase-2-backend-refactor.md
│       │   ├── phase-3-frontend-refactor.md
│       │   ├── phase-4-nodes-and-agents.md
│       │   ├── phase-5-integration.md
│       │   └── agent-architecture.md
│       ├── contracts/           # Phase 1 冻结契约
│       │   ├── backend-deps.md
│       │   ├── frontend-deps.md
│       │   ├── ai-chat-contract.md
│       │   ├── usage-tracker-contract.md
│       │   ├── agent-gateway-contract.md
│       │   └── node-manifest-contract.md
│       ├── snapshot/            # Phase 0 快照
│       ├── claude-analysis/     # 历史分析
│       └── codex-analysis/      # 历史分析
│
└── 项目规范与框架流程/           # 功能 SOP
    ├── 项目规范/
    │   ├── 01-项目架构全景.md
    │   ├── 04-API规范.md
    │   ├── 08-前端工程规范.md
    │   ├── 02-模块边界规范.md
    │   ├── 06-节点开发规范.md
    │   └── 07-子后端Agent规范.md
    ├── 功能流程/
    └── 经验教训/
```

### 文档权威层级

| 优先级 | 文档位置 | 说明 |
|--------|---------|------|
| **L0（最高）** | `docs/项目规范与框架流程/项目规范/*.md` | 团队协作铁规 |
| **L0** | `.github/CODEOWNERS` | 代码所有权，GitHub 系统强制 |
| **L0** | `shared/docs/conventions/` | 共享层事实，跨项目稳定 |
| **L1** | `docs/issues/TeamRefactor/final-plan/` | 重构实施方案 |
| **L1** | `docs/项目规范与框架流程/` | 功能 SOP |
| **L2** | `agents/README.md` | Agent 开发指南 |
| **L3（参考）** | `docs/issues/TeamRefactor/claude-analysis/` | 历史分析，只读 |
| **L3（参考）** | `docs/issues/TeamRefactor/codex-analysis/` | 历史分析，只读 |

## 6. 重构状态（2026-04-12）

| Phase | 状态 | 完成日期 |
|-------|------|----------|
| Phase 0 | ✅ 完成 | 2026-04-09 |
| Phase 1 | ✅ 完成（契约已签字） | 2026-04-09 |
| Phase 2 | ✅ 完成 | 2026-04-10 |
| Phase 3 | ✅ 完成（工程主线） | 2026-04-10 |
| Phase 4A | ✅ 完成 | 2026-04-11 |
| Phase 4B | ✅ 完成（Agent 样板） | 2026-04-11 |
| Phase 5 | ⏳ 待启动 | — |
