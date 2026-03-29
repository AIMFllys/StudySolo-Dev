<div align="center">
  <h1>StudySolo</h1>
  <p>面向学习场景的 AI 智能体可视化编排平台</p>
  <p><em>An Open Platform for Creating, Running, Sharing and Governing Learning Agents</em></p>

  <p>
    <a href="https://StudyFlow.1037solo.com"><img src="https://img.shields.io/badge/Live%20Demo-StudyFlow.1037solo.com-4F46E5?style=flat-square&logo=googlechrome&logoColor=white" alt="Live Demo" /></a>
    <a href="https://b23.tv/uPd6KUr"><img src="https://img.shields.io/badge/Demo%20Video-Bilibili-00A1D6?style=flat-square&logo=bilibili&logoColor=white" alt="Demo Video" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js" /></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi" alt="FastAPI" /></a>
    <a href="#tech-stack"><img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase" alt="Supabase" /></a>
  </p>
</div>

> [!WARNING]
> **当前仓库为开发版本（Development Branch）**
>
> 本仓库是 StudySolo 的**活跃开发分支**，包含持续迭代中的最新特性，可能存在未经充分测试的功能或不稳定行为，**不建议直接用于生产参考**。
>
> **版本说明（Version History）**
>
> | 版本 | 仓库 | 状态 | 说明 |
> | :--- | :--- | :--- | :--- |
> | **竞赛提交版（Frozen）** | [AIMFllys/StudySolo](https://github.com/AIMFllys/StudySolo) | 🔒 已冻结 | 华科 AI 智能体大赛参赛提报版本，代码已冻结；由于大赛截止日期限制，该版本存在**若干已知缺陷（Known Issues）**，不再向此分支回合补丁 |
> | **当前开发版（Dev）** | 本仓库 | 🚧 活跃开发 | 修复上述已知缺陷，并持续扩展新功能 |

---

**StudySolo** 是一个专注于学习场景的 AI 工作流编排平台。用户通过自然语言描述学习目标，系统自动生成多节点工作流，18 种专业学习节点在 DAG 执行引擎的调度下按依赖顺序运行，执行过程通过 SSE 全程实时可见。

平台同时具备工作流社区共享、用户自建节点、多平台 AI 模型路由与容灾、管理后台等完整的生产级能力，已部署上线：**[StudyFlow.1037solo.com](https://StudyFlow.1037solo.com)**

---

## ✨ 核心特性

- 🗣️ **自然语言驱动**：在侧边栏用自然语言描述学习目标，AI 直接生成/修改画布上的工作流，无需手动连线
- 🎨 **可视化节点画布**：基于 `@xyflow/react` 的拖拽式编辑，支持分组、Undo/Redo、实时画布序列化
- 🧩 **18 种专业学习节点**：涵盖输入、分析、生成、交互、输出、控制流六大类别
- 🔀 **多平台 AI 模型路由**：8 个 AI 平台 / 17+ 模型 SKU，3 种路由策略，单平台宕机自动降级
- ⚡ **流式执行追踪**：SSE 实时推送，节点状态/流式输出/链路血缘全程可视
- 🌐 **社区工作流共享**：发布、收藏、分叉他人工作流，积累社区学习资产
- 🏗️ **开放节点共建**：用户可自定义并发布提示词节点，支持上传知识库文件与 AI 辅助生成 JSON Schema

## 🛠️ 技术栈 <a id="tech-stack"></a>

| 层级 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **前端框架** | Next.js 16 + React 19 + TypeScript | App Router，SSR + CSR 混合渲染 |
| **前端样式** | Tailwind CSS v4 | CSS-first 配置，设计令牌统一管理 |
| **画布引擎** | @xyflow/react (React Flow) | 工业级节点画布，支持拖拽、连线、分组、缩放 |
| **前端状态** | Zustand | 轻量级状态管理，内置 Undo/Redo 快照 |
| **后端框架** | Python 3.11 + FastAPI ≥0.115 | 高性能异步框架，原生支持 SSE 流式推送 |
| **执行引擎** | 自研 DAG Executor | 拓扑排序 + ExecutionContext 黑板模型 |
| **数据库** | Supabase (PostgreSQL) + RLS | 多租户数据隔离，Row Level Security 全覆盖 |
| **认证** | Supabase Auth + JWT | Canvas 拼图验证码 + IP 登录锁定 |
| **实时通信** | Server-Sent Events (SSE) | 节点执行进度流式推送至前端 |
| **介绍页** | Vite 7 + React 19 | 独立静态 SPA，Nginx 直接托管 |
| **生产部署** | 阿里云 ECS + Nginx + PM2 | 已在线运行，域名：StudyFlow.1037solo.com |

## 📂 仓库结构

本项目采用 **Polyglot Monorepo**（多语言单仓）架构，所有子项目统一版本管控。

```text
StudySolo/
├── frontend/                 # 🖥️  Next.js 前端主应用 (Port: 2037)
│   └── src/features/workflow # 工作流核心模块（画布 / 节点 / 执行面板）
├── backend/                  # ⚙️  Python FastAPI 后端 (Port: 2038)
│   ├── app/engine/           # DAG 执行引擎
│   ├── app/nodes/            # 18 种工作流节点
│   ├── app/prompts/          # 模块化 Prompt 文件（Markdown + 模板变量）
│   └── app/api/              # REST API 路由
├── introduce/                # 🎯 产品介绍页 (Vite React SPA, 静态部署)
│   └── dist/                 # 构建产物，Nginx alias 托管于 /introduce/
├── wiki/                     # 📖 官方文档站 (Next.js, 开发中)
├── shared/                   # 🔗 跨项目共享模块 (Git Submodule)
├── supabase/migrations/      # 🗄️  数据库结构迁移脚本
├── docs/                     # 📚 架构文档 / 每日更新 / 功能规划 / SOP
├── .agent/skills/            # 🤖 SOP 化 AI 开发技能
└── scripts/                  # 🚀 一键启动 / 环境检测脚本
```

### 子项目速览

| 子项目 | 技术栈 | 运行方式 | 线上路径 | 详情 |
| :--- | :--- | :--- | :--- | :--- |
| **frontend/** | Next.js 16 | PM2 守护 Node.js 进程 | `studyflow.1037solo.com/` | [frontend/README.md](./frontend/README.md) |
| **backend/** | Python FastAPI | 宝塔 Python 管理器 | `studyflow.1037solo.com/api/` | [backend/README.md](./backend/README.md) |
| **introduce/** | Vite + React SPA | Nginx 静态文件托管 | `studyflow.1037solo.com/introduce/` | [introduce/README.md](./introduce/README.md) |
| **wiki/** | Next.js (开发中) | 预留 PM2 进程 | `studyflow.1037solo.com/wiki/` | [wiki/README.md](./wiki/README.md) |
| **shared/** | TypeScript | Git Submodule | — | [shared/README.md](./shared/README.md) |

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18 / **pnpm** ≥ 8（或 npm）
- **Python** ≥ 3.11
- 已配置 Supabase 项目与环境变量（参考各子项目的 `.env.example`）

### 1. 前端

```bash
cd frontend
pnpm install
cp .env.example .env.local   # 填入 Supabase 真实凭据
pnpm dev
# http://localhost:2037
```

### 2. 后端

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn app.main:app --reload --port 2038

# macOS / Linux
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 2038
# Swagger: http://localhost:2038/docs
```

### 3. 介绍页

```bash
cd introduce
npm install
npm run dev       # 本地开发
npm run build     # 构建产物输出到 dist/
```

### 4. 一键启动（Windows PowerShell）

```powershell
powershell scripts/start-studysolo.ps1
```

## 🧪 测试与检查

**前端：**

```bash
cd frontend
pnpm lint     # ESLint 静态检查
pnpm test     # Vitest 单元测试
```

**后端：**

```bash
cd backend
.venv\Scripts\python -m pytest tests
```

## 📖 文档导航

| 文档 | 内容 |
| :--- | :--- |
| [项目架构全景](./docs/项目规范与框架流程/项目规范/项目架构全景.md) | 整体系统设计与模块边界 |
| [AI 工作流底层原理](./docs/项目规范与框架流程/项目介绍/AI工作流系统底层原理.md) | DAG 执行引擎与节点交互机制 |
| [命名与代码规范](./docs/项目规范与框架流程/项目规范/naming.md) | 文件命名、变量、注释规范 |
| [后端 API 规范](./docs/项目规范与框架流程/项目规范/api.md) | 接口设计标准 |
| [节点新增 SOP](./docs/项目规范与框架流程/功能流程/新增AI工具/) | 标准化节点开发流程（A/B/C 型判断 + Checklist） |
| [部署指南](./docs/技术指导/服务器与宝塔部署完整指南.md) | 服务器部署全流程（宝塔 + Nginx + PM2） |
| [Shared 子模块说明](./shared/README.md) | 共享层使用规范 |

### 🤖 AI 开发技能（`.agent/skills/`）

本项目独创了 **"SOP 文档 + AI Skills 规则"** 驱动开发的理念。以下 2 个核心技能为**本项目专门原创**，也是本项目唯一对外开源并在 GitHub 仓库中托管的 AI 技能配置，实现了"让 AI 在辅助开发时自动遵循项目专有规范"：

| Skill | 路径 | 用途 |
| :--- | :--- | :--- |
| **workflow-node-builder** | [`.agent/skills/workflow-node-builder/SKILL.md`](./.agent/skills/workflow-node-builder/SKILL.md) | **节点开发专属**：新增节点 / 对接 AI 模型 / 对接外部 API 时自动触发，强制 AI 走分类和 Checklist |
| **project-context** | [`.agent/skills/project-context/SKILL.md`](./.agent/skills/project-context/SKILL.md) | **架构认知骨架**：项目全景上下文，涵盖技术栈、端口、API 分组、节点体系、数据库域的完整心智映射 |

> 注：本地开发环境可能使用的其他通用代码规范技能（如 Clean Code、Testing 等）非本项目原创，因此未包含在 GitHub 仓库中。上述 "SOP 文档 → Skills 封装" 的工程化思路是本项目在实践中独立总结形成的，同类思路在工程社区中或有相似探索，欢迎交流。

> **`shared/` 说明**：本仓库中 `shared/` 为 Git Submodule。使用 `git clone --recurse-submodules` 完整克隆，或在克隆后执行 `git submodule update --init`。

## 🌐 生产部署

StudySolo 部署在阿里云 ECS 上，通过 Nginx 统一网关分发请求：

```text
studyflow.1037solo.com
  ├── /              → Next.js 前端 (PM2, port 2037)
  ├── /api/          → Python FastAPI 后端 (port 2038)
  ├── /introduce/    → Vite SPA 静态文件 (Nginx alias)
  └── /wiki/         → Next.js 文档站 (预留, port 2039)
```

详细部署流程请参考 [服务器与宝塔部署完整指南](./docs/技术指导/服务器与宝塔部署完整指南.md)。

## 🔮 开发规划

| 功能 | 状态 |
| :--- | :--- |
| MCP 协议接入 | 🔧 开发中 |
| 外部 API 对接 | 🔧 开发中 |
| Wiki 官方文档站 | 🔧 开发中 |
| 用户自有 API Key 支持 | 📋 规划中 |
| 社区节点内容审核机制 | 📋 规划中 |
| 社区节点安全沙箱 | 📋 规划中 |

## 🤝 贡献

欢迎通过 Issue 提交问题反馈或通过 Pull Request 参与共建。参与前请阅读 [节点新增 SOP](./docs/项目规范与框架流程/功能流程/新增AI工具/) 与 [代码规范](./docs/项目规范与框架流程/项目规范/naming.md)，确保与现有架构对齐。

## 📄 License

[MIT License](./LICENSE) © 2026 1037Solo
