# StudySolo 项目地图

> 最后更新：2026-02-28
> 这份文件解决 AI "不知道自己在哪里"的问题。每次开新对话，先喂这份文件。

## 技术栈选型

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|---------|
| 前端框架 | Next.js (App Router) | 16.1 | SSR + Turbopack，端口 2037 |
| UI 框架 | React | 19.2 | View Transitions + Activity |
| 类型系统 | TypeScript | 5.x | 全端类型安全 |
| 样式方案 | Tailwind CSS v4.1 + Shadcn/UI | 4.1 | Oxide 引擎，CSS-first 配置 |
| 画布引擎 | @xyflow/react | 12.x | 工作流可视化，React 19 支持 |
| 状态管理 | Zustand | 5.x | 轻量，单 Store 管理工作流状态 |
| 后端框架 | FastAPI | 0.115+ | ASGI 异步，自动 OpenAPI 文档，端口 2038 |
| 数据验证 | Pydantic V2 | 2.10+ | 请求/响应自动验证 |
| 数据库 | Supabase Pro (PostgreSQL) | - | Auth + RLS + Realtime |
| AI SDK | openai Python SDK | 1.60+ | 统一调用所有 AI 平台 |
| 流式输出 | sse-starlette | 2.2+ | SSE 协议推送 AI token |
| 本地缓存 | localforage (IndexedDB) | 1.10 | 三层防抖同步的中间层 |
| 部署 | 阿里云 ECS 2核4G + 宝塔 | - | Nginx + PM2 + Gunicorn |

## 模块划分与职责边界

### 前端模块

| 模块 | 职责 | 禁止跨界 |
|------|------|---------|
| `app/(auth)/` | 登录、注册页面 | 不允许直接调用 Supabase，必须走后端 API |
| `app/(dashboard)/` | 三栏布局 Shell、工作流列表、画布页 | 不允许包含业务逻辑，只做布局和数据传递 |
| `components/layout/` | Sidebar、Navbar、MobileNav、RightPanel | 不允许直接 fetch API，通过 props 或 Store 获取数据 |
| `components/business/workflow/` | WorkflowCanvas、WorkflowPromptInput、AIStepNode、NodeMarkdownOutput | 不允许直接操作 IndexedDB，通过 sync hook |
| `stores/` | Zustand Store（唯一数据源） | 不允许在 Store 内发起网络请求 |
| `hooks/` | use-workflow-sync、use-workflow-execution | 不允许直接操作 DOM |
| `services/` | auth.service.ts（认证服务层） | 不允许存储状态，纯函数式 |
| `utils/supabase/` | client.ts、server.ts、middleware.ts | 仅供认证使用，业务数据走后端 API |

### 后端模块

| 模块 | 职责 | 禁止跨界 |
|------|------|---------|
| `api/` | 路由层，参数校验 + 调用 service | 不允许包含业务逻辑 |
| `services/` | 业务逻辑（AI 路由、工作流引擎） | 不允许直接操作数据库，通过 deps 注入 |
| `models/` | Pydantic 数据模型定义 | 不允许包含任何逻辑代码 |
| `core/` | 配置加载、数据库初始化、依赖注入 | 不允许引用 api/ 或 services/ |
| `middleware/` | JWT 验证、CORS、限流 | 不允许修改请求体 |

## 数据流向

```
用户输入学习目标
  ↓
前端 WorkflowPromptInput → POST /api/ai/generate-workflow
  ↓
后端 AI_Analyzer (qwen3-turbo) → 结构化需求 JSON
  ↓
后端 AI_Planner (qwen3-turbo) → { nodes[], edges[] }
  ↓
前端 Zustand Store ← setNodes/setEdges
  ↓
用户点击"▶ 运行全部"
  ↓
前端 EventSource → GET /api/workflow/{id}/execute (SSE)
  ↓
后端 workflow_engine 拓扑排序 → 逐节点调用 AI
  ↓
SSE 事件流: node_status → node_token → node_done → workflow_done
  ↓
前端 Zustand Store 实时更新节点 status + output
  ↓
三层防抖同步: UI(0ms) → IndexedDB(500ms) → Supabase(4s)
```

### 认证数据流

```
登录: POST /api/auth/login → Set-Cookie (HttpOnly access_token + refresh_token)
鉴权: Cookie 自动携带 → JWT 中间件验证 → get_current_user 依赖注入
刷新: POST /api/auth/refresh → 从 Cookie 读 refresh_token → 写新 Cookie
前端守卫: middleware.ts 检查 access_token Cookie → 无则重定向 /login
```

### AI 模型路由数据流

```
节点类型 → config.yaml node_routes 查表 → 确定 platform + model + route_chain
  ↓
ai_router.py → openai SDK 统一调用 (base_url + api_key 区分平台)
  ↓
超时/错误 → fallback.chains 降级链自动切换备用平台
  ↓
链 A (格式严格) 禁止路由到代理聚合平台 (siliconflow/youyun/qiniu)
```

## 目录结构

```
StudySolo/
├── frontend/                    # Next.js 16.1 前端
│   ├── src/
│   │   ├── app/                 # App Router 页面
│   │   │   ├── (auth)/          # 登录、注册
│   │   │   ├── (dashboard)/     # 三栏布局 + 工作流
│   │   │   └── page.tsx         # Landing 首页
│   │   ├── components/
│   │   │   ├── ui/              # Shadcn/UI 基础组件
│   │   │   ├── layout/          # Sidebar, Navbar, MobileNav
│   │   │   └── business/        # 工作流画布、节点、输入
│   │   ├── hooks/               # use-workflow-sync, use-workflow-execution
│   │   ├── stores/              # Zustand Store
│   │   ├── services/            # auth.service.ts
│   │   ├── utils/supabase/      # Supabase SSR 客户端
│   │   └── types/               # 公共类型定义
│   └── package.json
│
├── backend/                     # FastAPI 后端
│   ├── app/
│   │   ├── api/                 # auth.py, workflow.py, ai.py, router.py
│   │   ├── services/            # ai_router.py, workflow_engine.py
│   │   ├── models/              # user.py, workflow.py, ai.py
│   │   ├── core/                # config.py, config_loader.py, database.py, deps.py
│   │   ├── middleware/          # auth.py, security.py
│   │   └── main.py
│   ├── config.yaml              # AI 模型/节点/容灾配置中心
│   └── requirements.txt
│
├── scripts/                     # 部署脚本 + nginx.conf
├── docs/                        # 项目文档 + 设计参考图
└── .kiro/specs/                 # Kiro 规范文档
```

## 核心数据库表

| 表名 | 用途 | RLS |
|------|------|-----|
| users | 用户信息 | ✅ 只能读写自己 |
| workflows | 工作流（含 nodes_json/edges_json JSONB） | ✅ user_id 隔离 |
| workflow_runs | 执行记录 | ✅ user_id 隔离 |

## 端口约定

| 服务 | 端口 | 说明 |
|------|------|------|
| Next.js 前端 | 2037 | PM2 管理 |
| FastAPI 后端 | 2038 | Gunicorn 2 workers |
| Nginx | 443/80 | 反向代理，/ → 2037，/api/ → 2038 |
