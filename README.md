<div align="center">
  <h1>📚 StudySolo</h1>
  <p><strong>AI-Powered Learning Workflow Platform</strong></p>
  <p>用自然语言描述学习目标，AI 自动拆解任务、生成个性化学习工作流，从大纲到知识精炼、输出归档，形成完整的学习闭环。</p>

  <p>
    <a href="https://studysolo.1037solo.com">🌐 在线体验</a> ·
    <a href="./docs/项目规范与框架流程/项目介绍/项目介绍.md">📖 产品介绍</a> ·
    <a href="./docs/项目规范与框架流程/项目规范/项目架构全景.md">🏗️ 架构文档</a> ·
    <a href="./backend/app/nodes/CONTRIBUTING.md">🔌 节点开发</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-16.1-black?logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react" alt="React" />
    <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi" alt="FastAPI" />
    <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase" alt="Supabase" />
    <img src="https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?logo=tailwindcss" alt="Tailwind" />
  </p>
</div>

---

## ✨ 核心特性

🎯 **自然语言驱动** — 输入"帮我学习机器学习基础"，AI 自动拆解为结构化学习步骤

🔀 **可视化工作流** — 基于 XY Flow 的交互式画布，拖拽连线自定义学习路径

🧠 **多模型 AI 路由** — 接入 8 家 AI 平台（百炼、DeepSeek、月之暗面等），自动选择最优模型 + 容灾降级

⚡ **实时流式输出** — SSE 驱动的 token-by-token 实时反馈，AI 生成过程所见即所得

📦 **插件化节点系统** — 5 大类 10+ 节点（输入 → 分析 → 生成 → 交互 → 输出），继承 `BaseNode` 即可扩展

📚 **知识库管理** — 上传文档、语义搜索、与工作流深度集成

📊 **管理后台** — 用户管理、工作流审计、AI 模型配置、数据分析面板

🔒 **企业级安全** — JWT + RLS 行级安全 + 拼图验证码 + IP 锁定 + Nginx WAF

---

## 🏗 系统架构

```
┌─────────────────────────────────────────────────────┐
│  浏览器 (React 19 + Next.js 16 App Router)          │
│  ┌──────────┐ ┌──────────┐ ┌──────┐ ┌───────────┐  │
│  │ 工作流    │ │ 知识库    │ │ 设置 │ │ 管理后台   │  │
│  │ 画布编辑器│ │ 文档管理  │ │      │ │ 数据面板   │  │
│  └────┬─────┘ └────┬─────┘ └──┬───┘ └─────┬─────┘  │
│       └────────────┴──────────┴───────────┘         │
│              Zustand Store + SSE Stream              │
└──────────────────────┬──────────────────────────────┘
                       │ REST API / SSE
┌──────────────────────┴──────────────────────────────┐
│  FastAPI 后端                                        │
│  ┌─────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ Auth    │ │ Workflow      │ │ Knowledge        │  │
│  │ 认证鉴权│ │ Engine        │ │ Service          │  │
│  │         │ │ DAG 执行引擎  │ │ 文档解析+语义搜索│  │
│  └─────────┘ └──────┬───────┘ └──────────────────┘  │
│                     │                                │
│  ┌──────────────────┴───────────────────────────┐   │
│  │  插件化节点系统 (BaseNode)                     │   │
│  │  input/ → analysis/ → generation/ →           │   │
│  │  interaction/ → output/                        │   │
│  └──────────────────┬───────────────────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │
        ┌─────────────┼──────────────┐
        ▼             ▼              ▼
   Supabase      AI 多模型路由     DirectMail
   PostgreSQL    (8 家平台)        邮件推送
   Auth + RLS    容灾降级
```

---

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| **前端** | Next.js 16.1 · React 19.2 · TypeScript 5 · Tailwind CSS v4 · shadcn/ui |
| **工作流画布** | @xyflow/react 12.10 · Zustand 5 · Framer Motion 12 |
| **图标 & 渲染** | Lucide React · react-markdown · Shiki · KaTeX |
| **后端** | FastAPI · Python 3.11+ · Pydantic 2 · Gunicorn + Uvicorn |
| **数据库** | Supabase (PostgreSQL 15 · Auth · pgvector · Realtime) |
| **AI** | OpenAI SDK (百炼 · DeepSeek · 月之暗面 · 火山引擎 · 智谱等 8 家) |
| **部署** | Aliyun ECS · Nginx · PM2 · Let's Encrypt SSL |

---

## 🚀 快速开始

### 前置条件

- **Node.js** 20.18.0 LTS + **pnpm** 10.x
- **Python** 3.11+
- **Supabase** 项目（[创建免费项目](https://supabase.com/dashboard)）

### 1. 克隆仓库

```bash
git clone https://github.com/AIMFllys/StudySolo.git
cd StudySolo
```

### 2. 启动前端

```bash
cd frontend
pnpm install
cp .env.example .env.local    # 配置 Supabase URL/Key
pnpm dev                      # → http://localhost:2037
```

### 3. 启动后端

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env           # 配置 Supabase + AI API Keys
uvicorn app.main:app --reload --port 2038
# Swagger 文档 → http://localhost:2038/docs
```

---

## 📁 项目结构

```
StudySolo/
├── frontend/                # Next.js 16.1 前端
│   └── src/
│       ├── app/             # App Router 路由
│       │   ├── (auth)/      #   登录 · 注册 · 密码找回
│       │   ├── (dashboard)/ #   工作流 · 知识库 · 设置
│       │   └── (admin)/     #   管理后台
│       ├── features/        # 业务域模块
│       │   ├── workflow/    #   画布 · 节点 · 面板 · 工具栏
│       │   ├── admin/       #   管理后台 (10 子模块)
│       │   ├── knowledge/   #   知识库
│       │   ├── auth/        #   认证
│       │   └── settings/    #   用户设置
│       ├── components/      # 通用 UI + 布局组件
│       ├── stores/          # Zustand 状态管理
│       ├── services/        # API 请求层
│       └── types/           # TypeScript 类型
│
├── backend/                 # FastAPI 后端
│   └── app/
│       ├── api/             # 路由 (auth/ · workflow · ai · admin)
│       ├── nodes/           # 🔌 插件化节点 (继承 BaseNode)
│       │   ├── input/       #   触发类节点
│       │   ├── analysis/    #   分析类节点
│       │   ├── generation/  #   生成类节点
│       │   ├── interaction/ #   交互类节点
│       │   └── output/      #   输出类节点
│       ├── engine/          # 工作流执行引擎 (DAG + SSE)
│       ├── services/        # 业务服务层
│       ├── models/          # Pydantic 数据模型
│       └── core/            # 配置 + Supabase + 依赖注入
│
├── shared/                  # 跨项目共享 (git subtree)
│   └── src/types/           #   Supabase 数据库类型
├── docs/                    # 项目文档
└── scripts/                 # 部署脚本
```

---

## 🔌 节点系统

StudySolo 采用插件化架构，新建节点只需继承 `BaseNode` 并放入对应目录即可自动注册：

| 分类 | 节点 | 功能 |
|------|------|------|
| **输入** | TriggerInput | 工作流触发入口，接收用户自然语言 |
| **分析** | AIAnalyzer | 提取学习目标、难度、偏好等结构化数据 |
| **生成** | OutlineGen · ContentRefine · SummaryGen · FlashcardGen | 大纲 · 知识精炼 · 总结 · 闪卡生成 |
| **交互** | ChatResponse | AI 对话式交互，答疑解惑 |
| **输出** | ExportFile | 导出为 Markdown / DOCX / PDF |

> 📖 详细开发指南见 [backend/app/nodes/CONTRIBUTING.md](./backend/app/nodes/CONTRIBUTING.md)

---

## 🔀 AI 多模型路由

通过 `config.yaml` 统一管理 8 家 AI 平台，全部兼容 OpenAI API 格式：

```
用户请求 → 节点类型 → config.yaml 查表 → 选择最优模型

  链 A (格式严格): 百炼 qwen3-turbo → DeepSeek V3 → Moonshot
  链 B (深度推理): DeepSeek R1 → 百炼 qwen3-plus → 火山引擎 doubao-pro

  ⚡ 任一平台 timeout / rate limit 时自动降级切换
```

---

## 🧪 测试

```bash
# 前端
cd frontend
pnpm test              # Vitest 单元测试
pnpm lint              # ESLint 检查

# 后端
cd backend
pytest tests/          # 156 passed
```

---

## 📄 文档

| 文档 | 说明 |
|------|------|
| [项目架构全景](./docs/项目规范与框架流程/项目规范/项目架构全景.md) | 完整架构、技术栈、边界约束 |
| [产品介绍](./docs/项目规范与框架流程/项目介绍/项目介绍.md) | 产品定位、核心功能、典型工作流示例 |
| [API 契约](./docs/项目规范与框架流程/项目规范/api.md) | 接口规范、请求/响应格式、认证方式 |
| [设计规范](./docs/项目规范与框架流程/项目规范/design.md) | 颜色、排版、组件库、图标库规范 |
| [节点开发指南](./backend/app/nodes/CONTRIBUTING.md) | 如何新增自定义工作流节点 |
| [数据库规范](./shared/docs/conventions/database.md) | 跨项目数据库命名与隔离策略 |

---

## 📜 License

本项目为个人学习项目，暂未选择开源许可证。

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/AIMFllys">1037Solo</a> · Next.js + FastAPI · Powered by Multi-Model AI</sub>
</div>