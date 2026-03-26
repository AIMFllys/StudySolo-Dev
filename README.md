<div align="center">
  <h1>StudySolo</h1>
  <p>一个由 AI 驱动的新型智能学习工作流平台 (An AI-Powered Learning Workflow Platform)</p>

  <!-- Badges -->
  <p>
    <a href="#license"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/framework-Next.js_16-black?style=flat-square&logo=next.js" alt="Next.js" /></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/backend-FastAPI-009688?style=flat-square&logo=fastapi" alt="FastAPI" /></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/database-Supabase-3ECF8E?style=flat-square&logo=supabase" alt="Supabase" /></a>
  </p>
</div>

---

> 最后更新：2026-03-27
> 
> 文档编码：UTF-8（无 BOM） / LF

StudySolo 是一个基于前后端分离架构的 AI 学习工作流编排平台。它允许用户在直观的前端画布中自由组织学习节点，后端通过 DAG（有向无环图）引擎执行复杂的工作流，并依赖 SSE 技术将多轨 AI 大模型的输出实时流式返回给终端用户。

## ✨ 核心特性 (Features)

- 🎨 **可视化工作流画布**：基于 `@xyflow/react` 的沉浸式拖拽编辑，轻松构建你的学习、分析、生成管线。
- 🧠 **高度灵活的节点体系**：内置输入、分析、生成、交互与输出等多类插件化节点（详见引擎架构）。
- 🚀 **多轨 AI 模型选型与容灾**：深度集成了供应商、大模型家族与 SKU 两级路由机制，自带高可用 Fallback 策略。
- ⚡ **实时响应流式返回**：基于 FastAPI 与 SSE-Starlette 构建的高性能后端引擎。
- 🛡️ **严密的访问控制**：采用 Supabase Row Level Security (RLS) 提供行级数据安全与完整的鉴权闭环。

## 🛠️ 技术栈 (Tech Stack)

### 前端 (Frontend)
- **核心框架**：Next.js `16.1.6` (App Router) / React `19.2.3`
- **语言与样式**：TypeScript `5` / Tailwind CSS `v4` / Framer Motion
- **状态与组件**：Zustand `5.0.11` / `@xyflow/react` / Supabase SSR

### 后端 (Backend)
- **核心框架**：FastAPI `>=0.115` / Python 3.10+
- **数据与流**：Pydantic `>=2.10` / SSE-Starlette / OpenAI SDK
- **安全与限流**：SlowAPI

### 基础架构层 (Infrastructure)
- **数据库**：Supabase PostgreSQL + Auth + pgvector
- **代码复用**：标准化的本地 `shared/` 统一维护共享层与跨项目规范

## 📂 仓库结构 (Repository Structure)

```text
StudySolo/
├── frontend/                 # 基于 Next.js 的前端服务 (Port: 2037)
├── backend/                  # 基于 FastAPI 的后端服务 (Port: 2038)
├── supabase/migrations/      # Supabase 数据库结构与迁移脚本
├── shared/                   # 项目间通用共享模块 (Git Submodule)
├── docs/                     # 架构设计标准与产品规范文档
├── scripts/                  # 运行启动、环境检测辅助脚本
└── .agent/                   # 适用于构建环节的专有 AI Agent 规则与技能
```

## 🚀 快速开始 (Quick Start)

### 1. 启动前端服务

```bash
cd frontend
pnpm install
pnpm dev
```
> 前端默认热更新地址：`http://localhost:2037`

### 2. 启动后端服务

```bash
cd backend
python -m venv .venv
# 激活环境后安装依赖（Windows 示例）：
.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 2038
```
> 后端 Swagger 接口测试面板：`http://localhost:2038/docs`

### 3. 一键完整启动 (Windows PowerShell)

在 Windows 平台下，您可以通过提供的脚本同时拉起所有的开发服务面板：

```powershell
powershell scripts/start-studysolo.ps1
```

## 🧪 代码检查与测试 (Testing & Linting)

保持高质量的项目工程化迭代，需要稳定的检查环节约束。

**前端校验指令：**
```bash
cd frontend
pnpm lint        # 执行 ESLint 等代码静态语法检查
pnpm lint:lines  # 关键文件行数超限检测
pnpm test        # 执行 Vitest 单元与组件交互测试
```

**后端校验指令：**
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests
```

## 📖 核心文档导航 (Documentation)

对项目的深入扩展和共建，强烈建议您在改动之前查阅如下核心设计文档：

- [🗺️ 项目架构全景概览](./docs/项目规范与框架流程/项目规范/项目架构全景.md)
- [📝 命名与代码书写规范](./docs/项目规范与框架流程/项目规范/naming.md)
- [🔗 后端 API 协同规范](./docs/项目规范与框架流程/项目规范/api.md)
- [🧩 核心节点插件化开发指南](./backend/app/nodes/CONTRIBUTING.md)
- [🗃️ Shared 子模块参考手册](./shared/README.md)
- [🤖 Agent 与 Workflow 协作机制说明](./shared/AGENTS.md)

>⚠️ **特别说明 (`shared` 边界)：**  
>当前仓库中的 `shared/` 为 Git submodule。在后续若与 Platform Monorepo 同步时使用 subtree 操作时，切勿混淆两套流程策略结构（具体参照 `shared/docs/guides/subtree-sync.md`）。

## 🤝 参与贡献 (Contributing)

欢迎通过提交 Issue 错误报告或是提交 Pull Request 来帮助本平台变得更好！参与研发前请务必仔细阅读官方的规范并遵守现有项目的架构。

## 📄 开源协议 (License)

StudySolo 项目基于 [MIT License](./LICENSE) 发布。
