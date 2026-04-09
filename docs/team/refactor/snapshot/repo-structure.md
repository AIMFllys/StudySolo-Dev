# 仓库结构快照

> 快照时间：2026-04-09T23:40:00+08:00
> 用途：Phase 0 冻结记录，作为重构基线

---

## 1. 顶级目录结构

```
StudySolo/
├── backend/              # FastAPI 主后端
│   ├── app/              # 应用代码
│   │   ├── api/          # 37 files — HTTP 路由层
│   │   ├── core/         #  5 files — 配置、依赖注入
│   │   ├── engine/       #  9 files — 工作流执行引擎
│   │   ├── middleware/   #  4 files — 中间件
│   │   ├── models/       # 11 files — Pydantic 数据模型
│   │   ├── nodes/        # 70 files — 节点实现（7个分类目录）
│   │   ├── prompts/      #  8 files — Prompt 模板
│   │   ├── services/     # 25 files — 业务逻辑层
│   │   └── utils/        #  3 files — 工具函数
│   ├── tests/            # 测试
│   └── venv/             # Python 虚拟环境
├── frontend/             # Next.js 主前端
│   └── src/              # 375 files（不含 node_modules）
│       ├── app/          # 60 files — Next.js App Router 页面
│       ├── components/   # 50 files — 共享 UI 组件
│       ├── features/     # 170 files — Feature 模块（6 个）
│       ├── hooks/        #  3 files — 共享 hooks
│       ├── lib/          #  2 files — 第三方库封装
│       ├── services/     # 15 files — API 调用层
│       ├── stores/       #  9 files — Zustand 状态管理
│       ├── styles/       # 14 files — CSS/样式
│       ├── types/        # 20 files — TypeScript 类型
│       ├── utils/        #  5 files — 工具函数
│       └── __tests__/    # 27 files — 测试
├── supabase/             # 17 files — Database migrations
├── shared/               # 11 files — Git Submodule（跨项目共享）
├── docs/                 # 332 files — 项目文档
├── wiki/                 #  1 file  — 保留目录（未实现）
├── scripts/              # 12 files — 部署/启动脚本
├── introduce/            # 57 files — Landing page（独立 SPA）
├── .kiro/                # 19 files — Specs
└── .agent/               # AI Agent Skills & Workflows
```

---

## 2. 端口分配表

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend (Next.js) | 2037 | 主前端应用 |
| Backend (FastAPI) | 2038 | 主后端 API |
| Supabase (Remote) | N/A | 云数据库，非本地 |

---

## 3. 技术栈

| 层 | 技术 | 版本（约） |
|----|------|-----------|
| 前端框架 | Next.js | 16.x |
| 前端语言 | TypeScript | 5.x |
| UI 组件 | shadcn/ui + Radix | Latest |
| 状态管理 | Zustand | 5.x |
| 后端框架 | FastAPI | 0.115+ |
| 后端语言 | Python | 3.11+ |
| 数据库 | Supabase (PostgreSQL) | N/A |
| 认证 | Supabase Auth (JWT) | N/A |

---

## 4. Frontend Feature 模块

| Feature | 路径 | 文件数（估） | 说明 |
|---------|------|------------|------|
| admin | `features/admin/` | ~50 | 管理面板（dashboard, users, notices, models...） |
| auth | `features/auth/` | ~15 | 认证（登录、注册、验证码） |
| workflow | `features/workflow/` | ~80 | 工作流画布、节点、执行 |
| knowledge | `features/knowledge/` | ~5 | 知识库上传 |
| community-nodes | `features/community-nodes/` | ~10 | 社区节点管理 |
| settings | `features/settings/` | ~10 | 用户设置 |

---

## 5. Backend Node 分类

| 分类目录 | 说明 |
|---------|------|
| `nodes/analysis/` | 分析类节点 |
| `nodes/community/` | 社区类节点 |
| `nodes/generation/` | 生成类节点 |
| `nodes/input/` | 输入类节点 |
| `nodes/interaction/` | 交互类节点 |
| `nodes/output/` | 输出类节点 |
| `nodes/structure/` | 结构类节点 |
