&lt;!-- 编码：UTF-8 --&gt;

# StudySolo

> **基于自然语言的 AI 学习赋能工作流平台**  
> 🌐 [studyflow.1037solo.com](https://studyflow.1037solo.com) · 🏗️ 阿里云 ECS + 宝塔面板 · 📅 2026-02-24

---

## 📋 项目简介

StudySolo 是一个 AI 驱动的学习工作流平台。用户通过自然语言描述学习目标，平台自动拆解任务、生成结构化工作流节点，依次调用 AI 完成各个学习环节——从大纲生成、知识精炼到输出归档，形成完整的学习记忆闭环。

---

## 🛠 技术栈总览

### 核心运行时

| 技术 | 版本 | 用途 |
|------|------|------|
| **Node.js** | `20.18.0 LTS` | 前端 Next.js 运行时 |
| **Python** | `3.11+` | 后端 FastAPI 运行时 |
| **pnpm** | `10.x` | 前端包管理 |
| **pip / uv** | Latest | 后端包管理 |

### 前端（Next.js 应用）

| 技术 | 版本 | 说明 |
|------|------|------|
| **Next.js** | `16.1` | App Router · Turbopack 文件缓存（稳定） |
| **React** | `19.2` | View Transitions · Activity 组件 |
| **TypeScript** | `5.x` | 全端类型安全 |
| **Tailwind CSS** | `4.1` | Oxide 引擎（Rust 重写）· CSS-first 配置 |
| **Shadcn/UI** | Latest | 全面支持 Tailwind v4 + React 19 |
| **@xyflow/react** | `12.10.0` | 工作流可视化画布 · React 19 + Tailwind v4 专项支持 |
| **Framer Motion** | `12.x` | 动画库 |
| **Zustand** | `5.x` | 轻量状态管理 |

### 后端（Python FastAPI 应用）

| 技术 | 版本 | 说明 |
|------|------|------|
| **FastAPI** | `0.115+` | ASGI 异步框架 · 自动 OpenAPI 文档 |
| **Uvicorn** | `0.34+` | ASGI 服务器（异步高性能） |
| **Gunicorn** | `23+` | 多进程守护 · 替代 PM2 的 Python 解法 |
| **Pydantic** | `2.10+` | 数据验证 · 类型安全 · 自动 Docs |
| **supabase-py** | `2.12+` | Supabase 异步客户端（AsyncClient） |
| **openai** SDK | `1.60+` | 统一调用百炼 + 火山引擎（均兼容 OpenAI 格式） |
| **sse-starlette** | `2.2+` | AI 流式输出（Server-Sent Events） |

### 数据库 & 云服务

| 服务 | 套餐 | 说明 |
|------|------|------|
| **Supabase** | **Pro $25/月** | PostgreSQL 15 · Auth · pgvector · Realtime · 永不暂停 |
| **阿里云 DirectMail** | 按量 | 邮件推送（注册/通知） |
| **火山引擎 doubao-2.0-pro** | 200W Token/日免费 | 简单任务路由 |
| **阿里云百炼 qwen3-turbo** | 按 Token | 复杂任务路由 |

---

## 🏗 系统架构

```
用户浏览器
    │
    ▼
阿里云域名 (studyflow.1037solo.com)
    │ DNS → ECS 公网 IP
    ▼
阿里云 ECS【2核4G · Alibaba Cloud Linux 3 · 宝塔面板】
    │
    ├── Nginx（宝塔托管 · HTTPS · 反向代理）
    │     ├── /          → 127.0.0.1:2037  (Next.js)
    │     └── /api/      → 127.0.0.1:2038  (FastAPI)
    │
    ├── 🖥  Next.js 16.1【PM2 · port 2037】
    │     ├── App Router + Turbopack
    │     ├── React 19.2 + Shadcn/UI + Tailwind v4.1
    │     └── @xyflow/react 12.x (工作流画布)
    │
    ├── 🐍  FastAPI【Gunicorn+Uvicorn · port 2038】
    │     ├── /api/workflow/*   工作流引擎 (CRUD + 执行)
    │     ├── /api/ai/*         双模型路由 + SSE 流式
    │     ├── /api/auth/*       JWT 验证 + Supabase Auth
    │     ├── /api/prompts/*    提示词管理
    │     └── /api/email/*      DirectMail 推送
    │
    └── 外部服务
          ├── Supabase Pro（PostgreSQL + Auth + pgvector + Realtime）
          ├── 阿里云 DirectMail
          ├── 火山引擎 doubao-2.0-pro（简单任务）
          └── 阿里云百炼 qwen3-turbo（复杂任务）
```

---

## 🔀 AI 双模型路由策略

两家 AI 平台均兼容 **OpenAI API 格式**，用一个 `openai` SDK 统一调用：

```
用户输入
  │
  ├─ 简单任务（意图识别 · 短文分类 · 环节拆解）
  │    └──► 火山引擎 doubao-2.0-pro
  │          · 200W Token/日免费池 · 高并发
  │
  ├─ 复杂任务（大纲生成 · 知识总结 · 长文润色）
  │    └──► 阿里云百炼 qwen3-turbo
  │          · 高质量输出 · 复杂逻辑推理
  │
  └─ 容灾降级（任一侧 timeout / rate limit 时自动切换）
```

---

## 📁 项目结构

```
StudySolo/
├── frontend/               # Next.js 16.1 前端（pnpm 管理）
│   ├── src/
│   │   ├── app/            # App Router 路由页面
│   │   ├── components/     # UI + 工作流 + AI 组件
│   │   ├── hooks/          # 自定义 React Hooks
│   │   ├── stores/         # Zustand 状态
│   │   ├── lib/            # 工具函数
│   │   └── types/          # TypeScript 类型（含自动生成的 api.ts）
│   ├── public/
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                # FastAPI 后端（pip/uv 管理）
│   ├── app/
│   │   ├── main.py         # FastAPI 入口
│   │   ├── api/            # 路由模块
│   │   │   ├── workflow.py
│   │   │   ├── ai.py       # SSE 流式
│   │   │   ├── auth.py
│   │   │   ├── prompts.py
│   │   │   └── email.py
│   │   ├── services/       # 业务逻辑
│   │   │   ├── ai_router.py       # 双模型路由 + 降级
│   │   │   ├── workflow_engine.py
│   │   │   └── email_service.py
│   │   ├── models/         # Pydantic 数据模型
│   │   ├── core/           # 配置 + Supabase 初始化 + 依赖注入
│   │   └── middleware/     # CORS + JWT + 限流
│   ├── tests/
│   ├── requirements.txt    # 宝塔 pip 安装用
│   ├── pyproject.toml
│   └── gunicorn.conf.py    # Gunicorn 生产配置
│
├── scripts/                # 部署脚本
│   ├── deploy-frontend.sh
│   ├── deploy-backend.sh
│   └── setup-server.sh
│
├── docs/                   # 项目文档
├── .env.example
├── .gitignore
└── README.md
```

---

## 🚀 快速开始（本地开发）

### 前端

```bash
cd frontend
pnpm install
cp .env.example .env.local
pnpm dev          # → http://localhost:2037
```

### 后端

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 2038
# Swagger 文档 → http://localhost:2038/docs
```

### 自动生成前端 API 类型（可选）

```bash
# 后端运行时执行，将 FastAPI OpenAPI 规范转为 TS 类型
npx openapi-typescript http://localhost:2038/openapi.json \
  -o frontend/src/types/api.ts
```

---

## 🌍 宝塔面板部署

### 宝塔环境准备

#### 必装软件（软件商店）

| 插件 / 软件 | 版本 | 用途 |
|------------|------|------|
| **Nginx** | 最新稳定版 | 反向代理 + SSL |
| **PM2 管理器** | 内置 | Next.js 前端进程守护 |
| **Python 项目管理器** | 最新版 | FastAPI 环境管理 |
| Node.js（PM2 内置管理） | `20.18.0 LTS` | Next.js 运行时 |
| Python | `3.11+` | FastAPI 运行时 |

#### 前端配置（PM2）

| 配置项 | 值 |
|--------|-----|
| 项目目录 | `/www/wwwroot/studysolo/frontend` |
| 启动命令 | `pnpm start` |
| 端口 | `2037` |
| Node 版本 | `20.18.0 LTS` |

#### 后端配置（Python 项目管理器）

| 配置项 | 值 |
|--------|-----|
| 项目目录 | `/www/wwwroot/studysolo/backend` |
| 启动方式 | `ASGI（FastAPI/Starlette）` |
| 启动命令 | `gunicorn app.main:app -c gunicorn.conf.py` |
| Python 版本 | `3.11+` |
| 端口 | `2038` |
| 虚拟环境 | `venv-studysolo`（在管理器内创建） |

### Gunicorn 生产配置

```python
# backend/gunicorn.conf.py
bind = "127.0.0.1:2038"
workers = 2                               # 2核 ECS 使用 2 workers
worker_class = "uvicorn.workers.UvicornWorker"
timeout = 300                             # AI 接口最长 5 分钟
graceful_timeout = 120
accesslog = "/www/wwwlogs/studysolo-backend-access.log"
errorlog  = "/www/wwwlogs/studysolo-backend-error.log"
preload_app = True
max_requests = 1000
max_requests_jitter = 50
```

### Nginx 反向代理配置

```nginx
server {
    listen 443 ssl http2;
    server_name studyflow.1037solo.com;

    # SSL（宝塔一键 Let's Encrypt）
    ssl_certificate     /www/server/panel/vhost/cert/studyflow.1037solo.com/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/studyflow.1037solo.com/privkey.pem;

    # 前端 Next.js
    location / {
        proxy_pass http://127.0.0.1:2037;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";   # WebSocket 支持
    }

    # 后端 FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:2038/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;       # SSE 流式必须关闭
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    # Next.js 静态资源长缓存
    location /_next/static/ {
        proxy_pass http://127.0.0.1:2037;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    client_max_body_size 10m;
}

# HTTP 强制跳转 HTTPS
server {
    listen 80;
    server_name studyflow.1037solo.com;
    return 301 https://$host$request_uri;
}
```

---

## 🔒 安全体系

```
第1层：阿里云安全组  → 仅开放 80 / 443 / 22 / 宝塔端口
第2层：宝塔 Nginx WAF → 防 CC / SQL注入 / XSS（免费版可用）
第3层：Nginx 限流     → API: 10r/s · AI: 2r/s · 登录: 5r/m
第4层：FastAPI 中间件 → JWT + Pydantic 验证 + CORS + 提示词注入防护
```

---

## 💰 月度成本

| 服务 | 费用 | 说明 |
|------|------|------|
| 阿里云 ECS | ¥0（已有至2026-11） | 无额外费用 |
| 阿里云域名 | ~¥5/月 | 续费约 ¥60/年 |
| **Supabase Pro** | **$25/月 ≈ ¥180** | 永不暂停 · 8GB DB · 每日备份 |
| 阿里云 DirectMail | ~¥1-5/月 | 按量 |
| 火山引擎 AI | ¥0 | 200W Token/日免费池 |
| 阿里云百炼 AI | 按量 | 复杂任务按 Token |
| **月度总计** | **~¥190-200** | — |

---

## 📅 开发里程碑

| 阶段 | 周期 | 目标 |
|------|------|------|
| **P0 核心** | 第 1-4 周 | 脚手架 · 认证 · 工作流画布 · AI 引擎 · 安全 |
| **P1 重要** | 第 5-8 周 | 导航 · 设置 · 模板广场 · 提示词管理 |
| **P2 增强** | 第 9-12 周 | 文档页 · 归档记忆 · 管理后台 · 数据分析 |

---

## 🧪 API 测试（Postman + Supabase MCP）

### Postman API 测试集成

项目已集成 Postman Power 用于 API 自动化测试，配置信息存储在 `.postman.json`。

#### 测试环境

- **工作空间**: StudySolo API Testing
- **本地环境**: http://localhost:2038
- **生产环境**: https://studyflow.1037solo.com

#### 已配置的测试集合

1. **认证接口**
   - 用户注册 (POST /api/auth/register)
   - 用户登录 (POST /api/auth/login)

2. **AI 接口**
   - AI 对话流式输出 (POST /api/ai/chat)
   - 工作流生成 (POST /api/workflow/generate)

3. **健康检查**
   - 服务状态 (GET /api/health)

#### 免费版使用策略 ⚠️

Postman 免费版限制：
- **Collection Run**: 25次/月
- **API 调用**: 10000次/月

**推荐使用方式**：

✅ **用 Postman Power（消耗配额）**：
- 部署前完整测试（1-2次/部署）
- 重大功能完成后验证（2-3次/功能）
- Bug 修复后回归测试（按需）
- **预计每月使用：10-15 次**

✅ **用 FastAPI 内置测试（免费无限）**：
```bash
cd backend
pytest tests/
```

✅ **用 Newman CLI（免费无限）**：
```bash
# 导出 Postman 集合后本地运行
npx newman run .postman-collection.json -e .postman-environment.json
```

#### 手动运行测试

在 Postman 网页中访问：
```
https://go.postman.co/workspace/9a3b2b4e-1361-4a93-9a97-b89456cd3cf9
```

或通过 Kiro 运行（消耗配额）：
```
让 Kiro 运行 Postman 测试集合
```

### Supabase MCP 集成

项目已集成 Supabase MCP，可通过 Kiro 直接操作数据库：

- 查询表数据
- 插入/更新/删除记录
- 执行 SQL 查询
- 管理数据库迁移

**数据库项目**: StudySolo (hofcaclztjazoytmckup)

---

## 📄 相关文档

- [📋 PROJECT_PLAN.md](./PROJECT_PLAN.md) — 完整项目规划（架构 · 部署 · 数据库设计）

---

<div align="center">
  <sub>Built with ❤️ by 1037Solo · Python + Next.js · Deployed on Alibaba Cloud ECS</sub>
</div>