# StudySolo 项目整体规划方案 v3

> 📅 规划日期：2026-02-23
> 🎯 项目：StudySolo — 基于自然语言的 AI 学习赋能工作流平台
> 🌐 目标域名：studyflow.1037solo.com
> 🏗️ 部署方案：阿里云 ECS + 宝塔面板

---

## 一、基础设施总览

### 1.1 服务器配置（已有）

| 配置项 | 详情 |
|--------|------|
| **地域** | 华中1（武汉） |
| **实例规格** | ecs.e-c1m2.large |
| **CPU** | 2 核 (vCPU) |
| **内存** | 4 GiB |
| **操作系统** | Alibaba Cloud Linux 3.2104 LTS 64位 |
| **公网带宽** | 100 Mbps（峰值），按使用流量计费 |
| **到期时间** | 2026-11-18 23:59:59 |
| **管理面板** | 宝塔面板 |

### 1.2 云服务组合

| 服务 | 用途 | 状态 |
|------|------|------|
| 阿里云 ECS | 应用服务器 | ✅ 已有 |
| 阿里云域名 | studyflow.1037solo.com | ✅ 已有 |
| 阿里云邮件推送 (DirectMail) | 用户注册/通知邮件 | 待配置 |
| 宝塔面板 | 服务器管理 | ✅ 已部署 |
| Supabase | 云数据库 + Auth | 待接入 |

---

## 二、技术架构设计

### 2.1 整体架构图

```
用户浏览器
    │
    ▼
阿里云域名 (studyflow.1037solo.com)
    │
    ▼ DNS 解析
阿里云 ECS (2核4G, 宝塔面板)
    │
    ├── Nginx (宝塔自动管理)
    │     ├── 反向代理前端 → localhost:2037
    │     └── 反向代理后端 → localhost:2038
    │
    ├── 【宝塔 PM2 项目 - 前端】
    │     └── Next.js 16.1 应用 (port 2037)
    │           ├── App Router (页面渲染)
    │           ├── Server Components (服务端组件)
    │           └── 静态资源 (自动优化)
    │
    ├── 【宝塔 Python 项目 - 后端】
    │     └── FastAPI + Gunicorn (port 2038)
    │           ├── /api/workflow/*   工作流引擎
    │           ├── /api/ai/*         AI API 代理 + SSE 流式
    │           ├── /api/auth/*       JWT + Supabase Auth
    │           ├── /api/prompts/*    提示词管理
    │           └── /api/email/*      DirectMail 邮件推送
    │
    └── 外部服务
          ├── Supabase (数据库 + Auth + 实时)
          ├── 阿里云 DirectMail (邮件推送)
          ├── 包含八大 AI 原生与代理平台
          └── ⚠️ 【注意：此处的平台架构已升级为八平台，具体路由请参考最新最权威 [API 统一路由规划](../daily_plan/API/README.md)】
```

### 2.2 为什么前后端分离部署

| 优势 | 说明 |
|------|------|
| **独立管理** | 前后端可独立重启、更新、扩展 |
| **宝塔友好** | 宝塔 Node 项目管理天然支持多项目 |
| **故障隔离** | 后端 API 崩溃不影响前端页面展示 |
| **性能优化** | Nginx 直接处理静态资源，减轻 Node 压力 |
| **安全性** | 后端端口不对外暴露，仅通过 Nginx 反代访问 |

### 2.3 技术栈选型

#### 前端

| 层级 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| **前端框架** | Next.js | `16.1` | App Router · Turbopack 文件缓存（稳定） |
| **UI 框架** | React | `19.2` | View Transitions · Activity 组件 |
| **语言** | TypeScript | `5.x` | 全端类型安全 |
| **包管理** | pnpm | `10.x` | 快速、节省磁盘，前端专用 |
| **运行时** | Node.js | `20.18.0 LTS` | 宝塔原生支持 |
| **样式** | Tailwind CSS | `4.1` | Oxide 引擎（Rust）· CSS-first |
| **UI 组件** | Shadcn/UI | Latest | 全面支持 Tailwind v4 + React 19 |
| **动画** | Framer Motion | `12.x` | 流畅交互 |
| **工作流画布** | @xyflow/react | `12.10.0` | React 19 + Tailwind v4 专项支持 |
| **状态管理** | Zustand | `5.x` | 轻量全局状态 |
| **Markdown 渲染** | react-markdown + remark-gfm + shiki + streamdown | Latest | AI 节点输出渲染 · SSE 增量解析 · 代码高亮 · 数学公式 |

#### 后端

| 层级 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| **后端语言** | Python | `3.11+` | AI 生态最佳宿主语言 · Vibe Coding 友好 |
| **后端框架** | FastAPI | `0.115+` | ASGI 异步 · 自动 OpenAPI 文档 · Pydantic V2 |
| **ASGI 服务器** | Uvicorn | `0.34+` | 高性能异步服务器 |
| **进程守护** | Gunicorn | `23+` | 多 worker · 替代 PM2（Python 侧） |
| **数据验证** | Pydantic | `2.10+` | 自动请求/响应验证 |
| **包管理** | pip / uv | Latest | 后端专用 |
| **配置管理** | PyYAML + pydantic-settings | Latest | config.yaml 集中配置 · 环境变量自动解析 |

#### 数据库 & 服务

| 服务 | 套餐 | 说明 |
|------|------|------|
| **数据库** | Supabase Pro | PostgreSQL 15 · Auth · pgvector · Realtime · **永不暂停** |
| **邮件** | 阿里云 DirectMail | — |
| **AI 模型 A** | 火山引擎 doubao-2.0-pro | 简单任务 · 200W Token/日免费 |
| **AI 模型 B** | 阿里云百炼 qwen3-turbo | 复杂任务 · 高质量 |
| **AI SDK** | openai Python SDK | 两家均兼容 OpenAI 格式，一个 SDK 通吃 |
| **Web 服务器** | Nginx | 宝塔托管 · 反向代理 + SSL |

### 2.4 AI API 双模型路由策略

根据业务特性，采用 **火山引擎模型 + 阿里云百炼模型** 双路设计：

```text
用户请求输入 (Proxy /api/ai)
  │
  ├─ 简单任务（意图识别、环节拆解、短文本分类）
  │    └── 路由至：火山引擎（豆包·通用类模型） 
  │    └── 优势：并发高，极低成本 / 每日 200W Token 免费池
  │
  ├─ 复杂任务（大纲生成、知识点总结、长文润色）
  │    └── 路由至：阿里云百炼（通义千问 3 系列）
  │    └── 优势：高质量长文本，复杂逻辑推理能力更强
  │
  └─ 容灾降级（High Availability）
       └── 当一侧 API 出现 timeout、rate limit 时，自动降级至备用提供商，保障可用性。
```

---

## 三、项目目录结构

```
StudySolo/
├── frontend/                       # Next.js 16.1 前端（pnpm 管理）
│   ├── src/
│   │   ├── app/                    # App Router 页面
│   │   │   ├── (auth)/             # 认证页面组
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   └── forgot-password/
│   │   │   ├── (dashboard)/        # 主面板页面组
│   │   │   │   ├── workspace/      # 工作流画布
│   │   │   │   ├── templates/      # 模板广场
│   │   │   │   ├── history/        # 执行历史
│   │   │   │   └── settings/       # 用户设置
│   │   │   ├── docs/               # 使用文档 (SSG)
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx            # 首页 Landing
│   │   ├── components/             # 共享组件
│   │   │   ├── ui/                 # 基础 UI（Shadcn）
│   │   │   ├── workflow/           # 工作流相关
│   │   │   ├── ai/                 # AI 交互组件
│   │   │   └── layout/             # 导航/布局
│   │   ├── hooks/                  # 自定义 Hooks
│   │   ├── lib/                    # 工具函数 + fetch 封装
│   │   ├── stores/                 # Zustand 状态
│   │   ├── types/
│   │   │   ├── index.ts            # 手写公共类型
│   │   │   └── api.ts              # 自动生成（openapi-typescript）
│   │   └── styles/                 # 全局样式
│   ├── public/
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                        # FastAPI Python 后端（pip/uv 管理）
│   ├── app/
│   │   ├── main.py                 # FastAPI 入口 + 路由注册
│   │   ├── api/                    # 路由模块
│   │   │   ├── __init__.py
│   │   │   ├── router.py           # 统一路由聚合
│   │   │   ├── workflow.py         # 工作流 CRUD + 执行
│   │   │   ├── ai.py               # 双模型路由 + SSE 流式
│   │   │   ├── auth.py             # JWT + Supabase Auth
│   │   │   ├── prompts.py          # 提示词管理
│   │   │   ├── email.py            # DirectMail 邮件
│   │   │   └── admin.py            # 管理后台
│   │   ├── services/               # 业务逻辑层
│   │   │   ├── workflow_engine.py
│   │   │   ├── ai_router.py        # 双 API 智能路由 + 降级
│   │   │   └── email_service.py    # DirectMail 封装
│   │   ├── models/                 # Pydantic 数据模型
│   │   │   ├── workflow.py
│   │   │   ├── user.py
│   │   │   ├── prompt.py
│   │   │   └── ai.py
│   │   ├── core/                   # 核心配置
│   │   │   ├── config.py           # pydantic-settings 配置
│   │   │   ├── database.py         # Supabase AsyncClient 初始化
│   │   │   └── deps.py             # 依赖注入
│   │   └── middleware/             # 中间件
│   │       ├── auth.py             # JWT 验证
│   │       ├── rate_limit.py       # slowapi 限流
│   │       └── security.py        # CORS 配置
│   ├── tests/
│   │   ├── test_workflow.py
│   │   ├── test_ai.py
│   │   └── conftest.py
│   ├── requirements.txt            # 宝塔 pip install 用
│   ├── pyproject.toml              # PEP 621 项目配置
│   └── gunicorn.conf.py            # Gunicorn 生产配置
│
├── scripts/                        # 部署/运维脚本
│   ├── deploy-frontend.sh
│   ├── deploy-backend.sh
│   └── setup-server.sh
│
├── docs/                           # 项目文档
├── .env.example
├── .gitignore
└── README.md
```

> ⚠️ **注意**：不使用 `pnpm-workspace.yaml`。前端（pnpm）和后端（pip）各自独立管理依赖，无法合并为 JS monorepo。

---

## 四、宝塔部署方案详解

### 4.1 Nginx 反向代理配置

```nginx
# studyflow.1037solo.com 站点配置
server {
    listen 80;
    listen 443 ssl http2;
    server_name studyflow.1037solo.com;

    # SSL 证书 (宝塔一键申请 Let's Encrypt)
    ssl_certificate    /www/server/panel/vhost/cert/studyflow.1037solo.com/fullchain.pem;
    ssl_certificate_key /www/server/panel/vhost/cert/studyflow.1037solo.com/privkey.pem;

    # 强制 HTTPS
    if ($server_port !~ 443) {
        rewrite ^(/.*)$ https://$host$1 permanent;
    }

    # 前端 Next.js (主站)
    location / {
        proxy_pass http://127.0.0.1:2037;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # WebSocket 支持 (热更新/实时功能)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:2038/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # SSE 流式响应支持 (AI 对话)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    # 静态资源缓存
    location /_next/static/ {
        proxy_pass http://127.0.0.1:2037;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1024;

    # 限制请求体大小
    client_max_body_size 10m;
}
```

### 4.2 宝塔 Node 项目配置

#### 前端项目（Next.js）

| 配置项 | 值 |
|--------|-----|
| **项目名称** | StudySolo-Frontend |
| **项目目录** | /www/wwwroot/studysolo/frontend |
| **启动命令** | `pnpm start` |
| **端口** | 2037 |
| **Node 版本** | 20.18.0 LTS |
| **PM2 管理** | ✅ 开启 |
| **开机启动** | ✅ 开启 |

#### 后端项目（Python FastAPI）

| 配置项 | 值 |
|--------|-----|
| **项目名称** | StudySolo-Backend |
| **项目目录** | /www/wwwroot/studysolo/backend |
| **启动方式** | `ASGI（FastAPI/Starlette）` |
| **启动命令** | `gunicorn app.main:app -c gunicorn.conf.py` |
| **端口** | 2038 |
| **Python 版本** | `3.11+` |
| **虚拟环境** | `venv-studysolo`（在 Python 管理器内创建） |
| **开机启动** | ✅ 开启 |

### 4.3 部署流程

```
本地开发 → Git Push → SSH 到服务器 → 拉取代码 → 构建（仅前端）→ 重启

详细步骤：

1. 本地开发完成，推送到 Git 仓库
   $ git push origin main

2. SSH 连接服务器（或通过宝塔终端）
   $ ssh root@<ECS_IP>

3. 拉取最新代码
   $ cd /www/wwwroot/studysolo
   $ git pull origin main

4. 构建前端（需要编译）
   $ cd frontend
   $ pnpm install
   $ pnpm build
   $ pm2 restart StudySolo-Frontend

5. 更新后端（Python 无需编译，直接重启）
   $ cd ../backend
   $ source venv-studysolo/bin/activate
   $ pip install -r requirements.txt   # 仅依赖有变化时需要
   $ 宝塔面板→ Python 项目管理器→ StudySolo-Backend→ 重启
```

> 💡 **Python 优势**：后端就是普通 Python 脚本，**无需编译构建**。改了一个 py 文件，重启守护进程即可生效，比 Node.js 项目快得多。

---

## 五、阿里云邮件推送 (DirectMail) 集成

### 5.1 功能场景

| 场景 | 邮件类型 | 说明 |
|------|---------|------|
| 用户注册 | 验证码邮件 | 邮箱验证 |
| 密码重置 | 验证码邮件 | 找回密码 |
| 工作流完成通知 | 通知邮件 | 长任务完成提醒 |
| 系统公告 | 群发邮件 | 版本更新通知 |

### 5.2 DirectMail 配置步骤

```
1. 阿里云控制台 → 邮件推送 → 创建发信域名
   发信域名：mail.1037solo.com
   
2. 配置 DNS 记录（阿里云域名控制台）
   - SPF 记录
   - DKIM 记录
   - MX 记录
   
3. 创建发信地址
   noreply@example.com
   
4. 获取 AccessKey（建议使用 RAM 子账号）
   ALIBABA_CLOUD_ACCESS_KEY_ID=xxx
   ALIBABA_CLOUD_ACCESS_KEY_SECRET=xxx
```

### 5.3 后端邮件服务封装（Python 版）

```python
# backend/app/services/email_service.py
import alibabacloud_dm20151123.client as dm_client
import alibabacloud_dm20151123 import models as dm_models
from alibabacloud_tea_openapi import models as open_api_models
from app.core.config import settings

class EmailService:
    def __init__(self):
        config = open_api_models.Config(
            access_key_id=settings.ALIBABA_CLOUD_ACCESS_KEY_ID,
            access_key_secret=settings.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
            endpoint="dm.aliyuncs.com",
        )
        self.client = dm_client.Client(config)

    async def send_verification_code(self, to: str, code: str) -> None:
        request = dm_models.SingleSendMailRequest(
            account_name="noreply@example.com",
            address_type=1,
            reply_to_address=False,
            to_address=to,
            subject="StudySolo 验证码",
            html_body=f"<h2>您的验证码是：{code}</h2><p>5分钟内有效。</p>",
        )
        self.client.single_send_mail(request)

email_service = EmailService()
```

---

## 六、安全架构（ECS 自建方案）

### 6.1 多层安全防护

```
第1层：阿里云安全组
  └── 仅开放 80/443/22/宝塔端口

第2层：宝塔防火墙
  └── Nginx WAF 插件（免费版可用）
  └── 防 CC 攻击、SQL 注入、XSS

第3层：Nginx 配置
  └── 频率限制 (limit_req)
  └── IP 黑名单
  └── 安全响应头

第4层：应用层（FastAPI 中间件）
  └── JWT 认证 (Supabase Auth)
  └── API 频率限制 (slowapi)
  └── 输入验证 (Pydantic V2)
  └── CORS 白名单
  └── 提示词注入防护
```

### 6.2 阿里云安全组规则

| 方向 | 协议 | 端口 | 来源 | 用途 |
|------|------|------|------|------|
| 入站 | TCP | 80 | 0.0.0.0/0 | HTTP |
| 入站 | TCP | 443 | 0.0.0.0/0 | HTTPS |
| 入站 | TCP | 22 | 指定IP | SSH |
| 入站 | TCP | 宝塔端口 | 指定IP | 宝塔面板 |
| 入站 | 其他 | 全部 | 拒绝 | 默认拒绝 |

### 6.3 Nginx 频率限制配置

```nginx
# 在 http 块中定义限制区域
http {
    # 通用 API 限制：每秒 10 次请求
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    # AI API 限制：每秒 2 次请求
    limit_req_zone $binary_remote_addr zone=ai_api:10m rate=2r/s;
    # 登录限制：每分钟 5 次
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
}

# 在 location 中应用
location /api/ai/ {
    limit_req zone=ai_api burst=5 nodelay;
    proxy_pass http://127.0.0.1:2038;
}

location /api/auth/login {
    limit_req zone=login burst=3 nodelay;
    proxy_pass http://127.0.0.1:2038;
}
```

---

## 七、环境变量配置

### 7.1 前端 (.env.local)

```env
# 应用配置
NEXT_PUBLIC_APP_URL=https://studyflow.1037solo.com
NEXT_PUBLIC_API_URL=https://studyflow.1037solo.com/api

# Supabase (仅公开密钥)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
```

### 7.2 后端 (.env)

```env
# 服务器配置
PORT=2038
ENVIRONMENT=production

# Supabase Pro
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# AI API - 火山引擎（兼容 OpenAI 格式）
VOLCENGINE_API_KEY=xxx
VOLCENGINE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLCENGINE_MODEL=doubao-2.0-pro

# AI API - 阿里云百炼（兼容 OpenAI 格式）
DASHSCOPE_API_KEY=xxx
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen3-turbo

# 阿里云 DirectMail
ALIBABA_CLOUD_ACCESS_KEY_ID=xxx
ALIBABA_CLOUD_ACCESS_KEY_SECRET=xxx
DIRECTMAIL_SENDER=noreply@example.com

# JWT
JWT_SECRET=xxx
JWT_EXPIRES_HOURS=168    # 7 天

# 安全
CORS_ORIGIN=https://studyflow.1037solo.com
RATE_LIMIT_PER_MINUTE=100
```

---

## 八、性能优化策略

### 8.1 ECS 自建 vs EdgeOne Pages 对比

| 指标 | ECS 自建 | EdgeOne Pages | 结论 |
|------|---------|---------------|------|
| **冷启动** | ✅ 无（PM2 常驻） | ⚠️ 500-1000ms | ECS 更优 |
| **CDN 加速** | ⚠️ 需额外配置 | ✅ 3200+ 节点 | EdgeOne 更优 |
| **SSR 性能** | ✅ 稳定 50-100ms | ⚠️ 首次较慢 | ECS 更优 |
| **API 响应** | ✅ 稳定 10-50ms | ⚠️ 冷启动影响 | ECS 更优 |
| **静态资源** | ⚠️ 单节点 | ✅ 边缘缓存 | EdgeOne 更优 |
| **运维成本** | ⚠️ 需要维护 | ✅ 全托管 | EdgeOne 更优 |
| **自由度** | ✅ 完全控制 | ⚠️ 平台限制 | ECS 更优 |

### 8.2 弥补 CDN 短板

> ECS 最大短板是缺乏 CDN，可通过以下方式弥补：

```
方案 A：阿里云 CDN（推荐）
  └── 静态资源走 CDN 加速
  └── 费用：按流量 ¥0.24/GB（国内）
  └── 适合正式上线后开启

方案 B：Nginx 缓存优化
  └── 静态资源设置长缓存
  └── 开启 Gzip/Brotli 压缩
  └── 零成本，开发阶段使用

方案 C：Next.js 自带优化
  └── next/image 自动优化图片
  └── 静态页面 SSG 预渲染
  └── 增量静态重生成 (ISR)
```

### 8.3 2核4G 资源分配与负载分析

**内存分配规划（4 GiB 总量）：**
```text
系统 + 宝塔面板      ~800 MB
Nginx                ~50 MB
Next.js 前端 (PM2)   ~800 MB - 1.2 GB
Node.js 后端 (PM2)   ~300 MB - 500 MB
系统缓存/Buffer      ~1 GB
预留                  ~500 MB
─────────────────────────────
总计                  ~3.5 GB (有余量)
```

**CPU 负载分析（2核优势解读）：**
- **Next.js 渲染**：单线程处理 SSR 构建请求。
- **Node.js API 后端**：主要做 AI API 转发和数据库读写，这两者均为 **I/O 密集型任务**，极少消耗 CPU 计算资源。
- **结论**：2核 CPU 即可应对 200+ 并发流量，因为核心瓶颈在于 AI 接口的响应时间而非本地计算。

⚠️ **建议：**
  - PM2 前端只开 1 个实例（Next.js 单线程够用）
  - PM2 后端可开 2 个实例（cluster 模式，利用双核进行 I/O 调度）
  - 不要在服务器上自建 MySQL/PostgreSQL（使用 Supabase 云数据库释放运算资源）
  - 设置 swap 分区 2GB 作为内存兜底

---

## 九、域名与 SSL 配置

### 9.1 DNS 解析配置

| 记录类型 | 主机记录 | 记录值 | 用途 |
|---------|---------|--------|------|
| A | study | ECS 公网 IP | 主站 |
| A | @ | ECS 公网 IP | 根域名（可选） |
| CNAME | mail | DirectMail 要求的值 | 邮件推送域名 |
| TXT | @ | SPF 记录 | 邮件安全验证 |
| TXT | default._domainkey | DKIM 记录 | 邮件安全验证 |

### 9.2 SSL 证书

```
宝塔面板 → 网站 → studyflow.1037solo.com → SSL
  └── 选择 "Let's Encrypt" 免费证书
  └── 勾选 "强制HTTPS"
  └── 自动续期 ✅
```

---

## 十、功能模块与开发优先级

### P0 - 核心必须（第1-4周）

| 模块 | 技术实现 | 复杂度 |
|------|---------|--------|
| 项目脚手架搭建 | Next.js 前端 + FastAPI 后端（各自独立） | ⭐⭐ |
| 身份验证系统 | Supabase Auth + DirectMail 验证码 | ⭐⭐⭐ |
| 工作流画布 | @xyflow/react 12.x | ⭐⭐⭐⭐⭐ |
| AI 自然语言拆解引擎 | FastAPI /api/ai/* + 双模型路由 | ⭐⭐⭐⭐ |
| 工作流执行引擎 | FastAPI 链式调用 + SSE 流式输出 | ⭐⭐⭐⭐ |
| 安全防护体系（基础版） | Nginx 限流 + Pydantic + CORS | ⭐⭐⭐ |

### P1 - 重要功能（第5-8周）

| 模块 | 技术实现 | 复杂度 |
|------|---------|--------|
| 功能导航栏 | Next.js Layout + 响应式 | ⭐ |
| 用户设置页面 | Server + Client Components | ⭐⭐ |
| 工作流模板共享广场 | SSG + ISR + Supabase | ⭐⭐⭐ |
| 提示词管理系统 | CRUD + 版本控制 | ⭐⭐⭐ |

### P2 - 增强功能（第9-12周）

| 模块 | 技术实现 | 复杂度 |
|------|---------|--------|
| 使用文档页面 | MDX + SSG | ⭐⭐ |
| 归档记忆系统 | Supabase + pgvector | ⭐⭐⭐ |
| 管理后台 | 独立路由组 | ⭐⭐⭐ |
| 数据分析面板 | 统计图表 | ⭐⭐ |

---

## 十一、数据库设计（Supabase PostgreSQL）

```sql
-- 用户表 (使用共享的 user_profiles)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- 通常引用 auth.users(id)
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  tier TEXT DEFAULT 'free',
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ
);

-- 工作流表
CREATE TABLE ss_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  nodes_json JSONB DEFAULT '[]',
  edges_json JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 工作流执行记录
CREATE TABLE ss_workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES ss_workflows(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  input TEXT,
  output JSONB,
  status TEXT DEFAULT 'running',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  tokens_used INTEGER DEFAULT 0
);

-- 提示词表
CREATE TABLE ss_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  version INTEGER DEFAULT 1,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  model_provider TEXT,
  model_name TEXT,
  temperature FLOAT DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 提示词版本历史 (支持版本回滚)
CREATE TABLE ss_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES ss_prompts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  changed_by UUID REFERENCES user_profiles(id),
  change_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 工作流模板（共享广场）
CREATE TABLE ss_workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES user_profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  nodes_json JSONB,
  edges_json JSONB,
  use_count INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 归档记忆 (配合 pgvector 实现语义搜索)
CREATE TABLE ss_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  workflow_run_id UUID REFERENCES ss_workflow_runs(id),
  summary TEXT NOT NULL,
  tags TEXT[],
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 启用 RLS
ALTER TABLE ss_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ss_memories ENABLE ROW LEVEL SECURITY;
```

---

## 十二、服务器初始化脚本

```bash
#!/bin/bash
# scripts/setup-server.sh
# 在宝塔终端中执行

echo "=== StudySolo 服务器初始化 ==="

# 1. 创建项目目录
mkdir -p /www/wwwroot/studysolo
cd /www/wwwroot/studysolo

# 2. 克隆代码仓库
git clone <your-repo-url> .

# 3. 安装 pnpm（如果宝塔 Node 环境没有）
npm install -g pnpm

# 4. 安装前端依赖并构建
cd frontend
pnpm install
pnpm build

# 5. 安装后端依赖（Python FastAPI，无需编译）
cd ../backend
python3 -m venv venv-studysolo
source venv-studysolo/bin/activate
pip install -r requirements.txt

# 6. 设置 Swap（4G 内存建议设 2G swap）
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap 设置完成"
fi

echo "=== 初始化完成 ==="
echo "接下来请在宝塔面板中："
echo "1. 添加 Node 项目：前端 (port 2037)"
echo "2. 添加 Node 项目：后端 (port 2038)"
echo "3. 配置 Nginx 反向代理"
echo "4. 申请 SSL 证书"
```

---

## 十三、成本分析

### 月度费用

| 项目 | 费用 | 说明 |
|------|------|------|
| 阿里云 ECS | 已有（到期 2026-11） | 无额外费用 |
| 阿里云域名 | ~¥50-70/年 | 约 ¥5/月 |
| 阿里云 DirectMail | 免费额度内 | 每日 200 封免费 |
| ECS 流量费 | ~¥10-30/月 | 按流量 ¥0.8/GB |
| Supabase 免费版 | ¥0 | 开发阶段 |
| Supabase Pro 版 | ~¥180/月 | 比赛阶段（强烈推荐升级） |
| SSL 证书 | ¥0 | Let's Encrypt 免费 |
| **总计（开发期）** | **~¥15-35/月** | — |
| **总计（比赛期）** | **~¥195-215/月** | — |

### 13.2 阶段性 Supabase 运营策略

**开发阶段（现在 → 比赛前 2 个月）**
- 使用 Supabase 免费版（0 成本）。
- 🔴 **关键风险**：免费版有 7 天不活跃自动暂停数据库的限制。
- 💡 **解决方案**：配置 GitHub Actions Cron Job 每 5 天调取一次健康检查 API，防止数据库休眠。

**比赛冲刺及展示期（比赛前 2 个月 → 结束）**
- 强烈建议升至 Supabase Pro 版（~$25/月）。
- ✅ **核心收益**：永不暂停（避免比赛演示期间突然宕机）；开启每日自动备份防数据丢失；解锁 8GB 数据库存储和 250GB 流量出站限制。

### 13.3 与原 EdgeOne 方案对比

| 对比项 | EdgeOne Pages 方案 | ECS 宝塔方案 | 优劣 |
|--------|-------------------|-------------|------|
| 月成本（开发期） | ¥9.9 | ~¥15-35 | EdgeOne 略低 |
| 月成本（比赛期） | ~¥190 | ~¥200 | 基本持平 |
| 性能稳定性 | ⚠️ 有冷启动 | ✅ PM2 常驻 | **ECS 更优** |
| CDN 加速 | ✅ 3200+ 节点 | ⚠️ 需额外配 | EdgeOne 更优 |
| 运维负担 | ✅ 全托管 | ⚠️ 需维护 | EdgeOne 更优 |
| 自由度 | ⚠️ 受限 | ✅ 完全控制 | **ECS 更优** |
| 学习价值 | 一般 | ✅ 全栈运维 | **ECS 更优** |

---

## 十四、开发路线图

```
Week 1-2: 基础搭建
  ├── 初始化 monorepo 项目结构
  ├── 配置 Next.js 前端 + Express 后端
  ├── 宝塔部署 + Nginx 配置
  ├── SSL 证书 + 域名解析
  └── Supabase 数据库初始化

Week 3-4: 核心功能
  ├── 用户注册/登录 (Supabase Auth + DirectMail)
  ├── 工作流画布基础版 (React Flow)
  ├── AI API 集成 (双路由策略)
  └── 安全防护体系搭建

Week 5-6: 工作流引擎
  ├── 工作流执行引擎 (链式调用)
  ├── 流式输出 (SSE)
  ├── 提示词管理系统
  └── 执行历史记录

Week 7-8: 功能完善
  ├── 模板共享广场
  ├── 用户设置页面
  ├── 导航栏 + 布局优化
  └── 响应式适配

Week 9-10: 优化打磨
  ├── 性能优化 (SSG/ISR)
  ├── 安全加固
  ├── 错误处理 + 日志
  └── 管理后台

Week 11-12: 上线准备
  ├── 文档编写
  ├── 测试 + Bug 修复
  ├── 部署流程自动化
  └── 比赛材料准备
```

---

## 十五、关键决策总结

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 部署平台 | 阿里云 ECS + 宝塔 | 完全控制、无冷启动、学习价值高 |
| 前端框架 | Next.js 16.1 | SSR/SSG/App Router + Turbopack 稳定 |
| **后端语言** | **Python 3.11+** | **AI 生态最佳実践语言、Vibe Coding 极友好** |
| **后端框架** | **FastAPI** | **ASGI 异步、Pydantic 自动验证、自动 OpenAPI 文档** |
| **数据库** | **Supabase Pro** | **永不暂停、pgvector、每日备份** |
| AI SDK | openai Python SDK | 百炼 + 火山均兼容 OpenAI 格式，一个 SDK 省去两套 |
| 邮件服务 | 阿里云 DirectMail | 与域名同平台、配置简单 |
| 进程管理 | PM2 (前端) + Gunicorn (后端) | 各司其职，分别适配 JS/Python 运行时 |
| SSL | Let's Encrypt （宝塔） | 免费、自动续期 |

---

## 十六、关键风险与避坑指南

| 潜在风险项 | 严重程度 | 应对解决方案 |
|---------|--------|-----------|
| **Supabase 7 天休眠机制** | 🔴 离线致命 | 开发阶段通过 GitHub Actions CRON 定时调度 / 比赛期升级 Pro 版。 |
| **API Key 前端暴露风险** | 🔴 资产泄露 | 所有第三方 API 调用封装于 `backend/src/routes` 内，使用 Server Components 或服务端接口控制，密钥只留在服务端环境变量内。 |
| **工作流链式调用冷启动叠加** | 🟡 体验降级 | AI API 耗时长，需全面应用 Server-Sent Events (SSE) 流式传输，让用户实时看到分步推理过程。 |
| **提示词注入攻击 (Prompt Injection)** | 🔴 安全事故 | 对用户输入做严格转义，并在提示词内部设计沙箱机制或利用大模型 System Prompt 防护指令体系防御。 |
| **免费版 500MB 数据爆仓** | 🟡 数据受限 | 优化 `node_json` 存储结构，定时 TTL 脚本清理/归档无用的历史 `workflow_runs`。 |

---

> ⚡ **下一步行动**：按照 `StudySolo-MVP.md` 任务计划，初始化前端 Next.js 脚手架与后端 FastAPI 脚手架（各自独立管理，非 monorepo），优先完成 MVP 核心工作流功能。
