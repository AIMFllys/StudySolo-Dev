<!-- 编码：UTF-8 -->

# StudySolo MVP 任务规划

> 📅 规划日期：2026-02-25  
> 🎯 截止日期：**2026-03-10（共 13 天）**  
> 🏆 目标：完成 MVP 核心功能——用户输入一句自然语言，自动生成并运行完整学习工作流  
> 👤 开发者：独立 Vibe Coding（AI 辅助全程）

---

## 🎯 MVP 核心定义

> **MVP = 输入一句话 → AI 自动拆解为工作流节点 → 逐节点执行 AI → 流式展示结果**

### MVP 必须包含（P0）

| # | 功能 | 说明 |
|---|------|------|
| 1 | **用户认证** | 注册/登录（Supabase Auth + 邮箱验证码），Cookie HttpOnly 会话 |
| 2 | **工作流画布** | 基于 @xyflow/react，可视化展示节点和连线 |
| 3 | **自然语言→工作流生成** | 用户输入学习目标 → AI 分析拆解为多个步骤节点 |
| 4 | **工作流顺序执行** | 逐节点调用 AI，SSE 流式输出到画布节点内 |
| 5 | **工作流保存/加载** | 自动保存到 Supabase，支持继续编辑 |
| 6 | **基础安全** | CORS + Pydantic 验证 + JWT 鉴权（不做复杂限流） |

### MVP 不包含（P1/P2 后延）

- ❌ 模板广场（P1）
- ❌ 提示词管理系统（P1）
- ❌ 管理后台（P2）
- ❌ Wiki 文档页（P2）
- ❌ 归档记忆系统（P2）
- ❌ 数据分析面板（P2）
- ❌ 复杂安全限流（P1）

---

## 📅 开发时间线（13天倒计时）

```
2026-02-25（今天）→ 2026-03-10（截止）

Day 01-02（02-25 ~ 02-26）：Phase 0 — 脚手架初始化
Day 03-05（02-27 ~ 03-01）：Phase 1 — 用户认证系统
Day 06-09（03-02 ~ 03-05）：Phase 2 — 核心工作流引擎
Day 10-12（03-06 ~ 03-08）：Phase 3 — AI 执行 + 流式输出
Day 13（03-09 ~ 03-10）：Phase 4 — 联调 + 收尾 + 部署
```

---

## Phase 0：脚手架初始化（Day 01-02）

### 任务清单

- [ ] **T0-1** 初始化前端 Next.js 16.1 项目
  - `cd frontend && pnpm create next-app@latest . --typescript --tailwind --app --src-dir`
  - 升级到 Next.js 16.1, React 19.2
  - 验证：`pnpm dev` → `http://localhost:2037`
  
- [ ] **T0-2** 前端依赖安装
  - Shadcn/UI 初始化 + 常用组件安装
  - `@xyflow/react`, `framer-motion`, `zustand`, `@tanstack/react-query`
  - `localforage`, `@supabase/ssr`, `@supabase/supabase-js`
  - **Markdown 渲染全家桶**（AI 节点输出渲染）：`react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `rehype-raw`, `shiki`, `streamdown`, `katex`

- [ ] **T0-3** 迁移设计令牌
  - 将 `docs/Source/学长分享-核心规范/globals.css` 覆盖到 `frontend/src/app/globals.css`
  - 验证：Tailwind v4 OKLCH 变量正常工作

- [ ] **T0-4** 初始化后端 FastAPI 项目
  - 创建 `backend/` 目录结构（`app/main.py`, `app/api/`, `app/services/`, `app/models/`, `app/core/`, `app/middleware/`）
  - 创建虚拟环境：`python -m venv venv`
  - 安装依赖：`pip install fastapi uvicorn gunicorn pydantic supabase openai sse-starlette slowapi pydantic-settings pyyaml`
  - 验证：`uvicorn app.main:app --reload --port 2038` → `http://localhost:2038/docs`

- [ ] **T0-5** 创建 `.env.example` 和 `.env` 文件
  - 前端：`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - 后端：`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VOLCENGINE_API_KEY`, `DASHSCOPE_API_KEY`, `JWT_SECRET`

- [ ] **T0-6** Supabase 数据库初始化
  - 执行数据库建表 SQL（从 PROJECT_PLAN.md 第十一章复制）
  - 验证：6张表创建成功，RLS 开启

- [ ] **T0-7** 建立前端目录结构
  - 按 `frontend-specialist.md` SS-2 创建 `src/` 完整目录骨架

**✅ Phase 0 验收标准：**
- 前端 `pnpm dev` 正常运行在 2037 端口，Tailwind v4 样式生效
- 后端 `uvicorn` 正常运行在 2038 端口，Swagger 文档可访问
- Supabase 6张表正常创建

---

## Phase 1：用户认证系统（Day 03-05）

> 参考：`docs/Plans/daily_plan/user_auth/01-auth-and-guard-strategy.md`

### 任务清单

- [ ] **T1-1** 后端：Supabase AsyncClient 初始化
  - `backend/app/core/database.py`：创建 Supabase 异步客户端
  - `backend/app/core/config.py`：pydantic-settings 配置加载

- [ ] **T1-2** 后端：FastAPI 认证路由（`/api/auth/*`）
  - `/api/auth/register` — 注册（邮箱+密码，触发 DirectMail 验证码）
  - `/api/auth/login` — 登录（返回 access_token + refresh_token）
  - `/api/auth/logout` — 退出
  - `/api/auth/refresh` — 无感刷新 Token
  - `/api/auth/me` — 获取当前用户信息（JWT 鉴权）

- [ ] **T1-3** 后端：JWT 中间件
  - `backend/app/middleware/auth.py`：验证 Bearer Token
  - 使用 Supabase JWT 验证（无需自己签发，用 Supabase 的）

- [ ] **T1-4** 前端：Supabase SSR 配置
  - `src/utils/supabase/client.ts` — 客户端实例
  - `src/utils/supabase/server.ts` — 服务端实例
  - `src/utils/supabase/middleware.ts` — updateSession

- [ ] **T1-5** 前端：Next.js Middleware 路由守卫
  - `src/middleware.ts`：保护 `/workspace`, `/settings`, `/history`
  - 未登录 → 重定向到 `/login?next={pathname}`

- [ ] **T1-6** 前端：认证页面
  - `app/(auth)/login/page.tsx` — 登录页
  - `app/(auth)/register/page.tsx` — 注册页（含邮箱验证码输入）

- [ ] **T1-7** 前端：认证服务层
  - `src/services/auth.service.ts`：login / register / logout / getUser

- [ ] **T1-8** 前端：用户状态与跨 Tab 同步
  - `supabase.auth.onAuthStateChange` 监听登出事件
  - 跨 Tab 同步：`localStorage` 事件监听

**✅ Phase 1 验收标准：**
- 注册→收到邮件→验证→登录→JWT Cookie 写入
- 未登录访问 `/workspace` → 自动跳转 `/login`
- 登录后可获取 `me` 信息
- 跨 Tab 退出后其他 Tab 也同步跳转

---

## Phase 2：工作流画布（Day 06-07）

### 任务清单

- [ ] **T2-1** 后端：工作流 CRUD 路由（`/api/workflow/*`）
  - `GET /api/workflow/` — 获取当前用户工作流列表（元数据，不含 nodes/edges）
  - `POST /api/workflow/` — 新建工作流
  - `GET /api/workflow/{id}/content` — 获取工作流完整 nodes/edges JSON
  - `PUT /api/workflow/{id}` — 更新工作流（自动保存）
  - `DELETE /api/workflow/{id}` — 删除

- [ ] **T2-2** 后端：Pydantic 数据模型
  - `backend/app/models/workflow.py`：WorkflowCreate, WorkflowUpdate, WorkflowMeta, WorkflowContent

- [ ] **T2-3** 前端：Dashboard Shell 布局
  - `app/(dashboard)/layout.tsx`：Sidebar + Navbar 共享布局
  - `components/layout/Sidebar.tsx`：工作流列表导航（元数据，SSR 首屏渲染）
  - `components/layout/Navbar.tsx`：顶栏（用户头像 + 新建工作流按钮）

- [ ] **T2-4** 前端：工作流 Zustand Store
  - `stores/use-workflow-store.ts`：nodes / edges / isDirty / currentWorkflowId

- [ ] **T2-5** 前端：画布页面
  - `app/(dashboard)/workspace/page.tsx`：Server Component，SSR 获取工作流列表
  - `app/(dashboard)/workspace/[id]/page.tsx`：指定工作流画布页

- [ ] **T2-6** 前端：@xyflow/react 画布组件
  - `components/business/workflow/WorkflowCanvas.tsx`：React Flow 主画布
  - 支持：添加节点（手动）、连线、拖拽、缩放

- [ ] **T2-7** 前端：画布自动保存
  - `hooks/use-workflow-sync.ts`：实现 SS-7 的三层防抖同步策略
  - IndexedDB（localforage）500ms 防抖 + 云端 3s 防抖
  - 崩溃恢复检测逻辑

**✅ Phase 2 验收标准：**
- 登录后可见工作流列表
- 点击工作流 → 画布加载对应 nodes/edges
- 拖拽节点 → 3s 后自动保存到 Supabase
- 刷新页面 → 画布恢复

---

## Phase 3：AI 引擎 + 工作流执行（Day 08-10）

> 这是整个 MVP 的核心价值所在

### 任务清单

- [ ] **T3-1** 后端：AI 双模型路由服务（YAML 配置驱动）
  > ⚠️ **【API 路由规划已过时警告】**  
  > 下方描述的基于“豆包+千问”的双模型硬路由机制现已废弃。  
  > 实际开发时，请**严格基于最新最权威的 [API 统一路由规划 · 权威索引](./daily_plan/API/README.md) 中定义的八大平台与十路路由**来实现此任务！
  - 创建 `config.yaml`（项目根目录）：集中管理模型配置、节点配置、执行引擎参数、容灾策略
  - 创建 `backend/app/core/config_loader.py`（约 40 行）：YAML 加载器 + 环境变量自动解析
  - `backend/app/services/ai_router.py`：
    - 从 config.yaml 读取模型配置，代码零硬编码
    ~~- 简单任务（意图识别、节点拆解） → 火山引擎 doubao-2.0-pro（免费池）~~
    ~~- 复杂任务（大纲生成、知识总结） → 阿里云百炼 qwen3-turbo~~
    ~~- 容灾降级：任一侧超时自动切换（由 YAML fallback 配置驱动）~~
  - 使用 `openai` Python SDK 统一调用（所有平台均兼容 OpenAI 格式）
  - 📌 详细方案参考最新架构及 `daily_plan/core/02-yaml-config-and-markdown-rendering.md`

- [ ] **T3-2** 后端：自然语言→工作流生成接口（`/api/ai/generate-workflow`）
  - 接收用户输入的学习目标（自然语言）
  - 调用 AI 分析拆解为 3-8 个步骤
  - 返回结构化 JSON：`{ nodes: [], edges: [] }`（直接可用于 React Flow）
  - Prompt 设计：系统 Prompt 要求 AI 输出固定 JSON 格式

- [ ] **T3-3** 后端：工作流执行引擎（`/api/workflow/{id}/execute`）
  - `backend/app/services/workflow_engine.py`：
    - 按 edges 顺序遍历节点
    - 逐节点调用对应 AI（根据节点类型路由）
    - 使用 SSE（`sse-starlette`）逐 token 流式推送结果
  - 接口：`GET /api/workflow/{id}/execute`（SSE 流式响应）

- [ ] **T3-4** 后端：AI 生成的节点类型定义
  - 节点类型：`outline_gen`（大纲生成）、`content_extract`（知识提炼）、`summary`（总结）、`flashcard`（卡片生成）等
  - 每个节点有独立的 System Prompt 模板

- [ ] **T3-5** 前端：自然语言输入组件
  - `components/business/ai/WorkflowPromptInput.tsx`：
    - 一个大的文本框 + "生成工作流" 按钮
    - 调用 `/api/ai/generate-workflow`
    - 将返回的 nodes/edges 注入 Zustand store → 画布自动渲染

- [ ] **T3-6** 前端：SSE 流式接收
  - `hooks/use-workflow-sync.ts` 或新 Hook：
    - 调用 `/api/workflow/{id}/execute`
    - 用 `EventSource` 接收 SSE 流
    - 逐 token 更新对应节点的 `data.output`（Zustand + React Flow 实时重绘）

- [ ] **T3-7** 前端：工作流节点自定义 UI（Markdown 渲染增强）
  - `components/business/workflow/nodes/NodeMarkdownOutput.tsx`：Markdown 渲染组件
    - 集成：react-markdown + remark-gfm + remark-math + rehype-katex + rehype-raw
    - 支持：标题层级、表格、代码高亮（shiki）、数学公式（KaTeX）、流式光标
  - `components/business/workflow/nodes/AIStepNode.tsx`：自定义节点组件
    - 显示：节点标题、执行状态（Pending/Running/Done/Error）、**Markdown 格式 AI 输出**
    - 执行中：增量 Markdown 渲染 + 闪烁光标动画（streamdown 驱动，无闪烁）
    - 完成：输出内容可复制
  - 📌 详细方案见 `daily_plan/core/02-yaml-config-and-markdown-rendering.md`

- [ ] **T3-8** 前端：执行控制
  - "▶ 运行全部" 按钮 → 触发整个工作流顺序执行
  - 执行状态全局管理（Zustand）

**✅ Phase 3 验收标准：**
- 输入"学习 React Hooks 的知识体系" → AI 生成 5 个节点的工作流 + 自动展示在画布
- 点击"运行" → 逐节点流式执行，节点内内容实时更新
- 全部完成后，工作流状态变为 "Completed"

---

## Phase 4：联调 + 收尾 + 部署（Day 11-13）

### 任务清单

- [ ] **T4-1** 联调：前后端端到端测试
  - 完整走一遍：注册 → 登录 → 新建工作流 → 输入学习目标 → 生成节点 → 运行 → 查看结果

- [ ] **T4-2** UI 精修
  - Landing 首页（简洁的介绍页 + "开始使用"入口）
  - 错误状态处理（网络失败 / AI 超时 / Token 不足）
  - Loading 骨架屏

- [ ] **T4-3** 部署到阿里云 ECS（宝塔）
  - 前端：构建 `pnpm build` → PM2 管理
  - 后端：创建 Python 虚拟环境 → Gunicorn 运行
  - Nginx 反向代理配置
  - SSL 证书（Let's Encrypt）

- [ ] **T4-4** 生产环境验证
  - `studyflow.1037solo.com` 可正常访问
  - 认证流程可用
  - AI 生成工作流可用

- [ ] **T4-5** 创建 `scripts/` 部署脚本
  - `scripts/deploy-frontend.sh`
  - `scripts/deploy-backend.sh`

- [ ] **T4-6** Supabase GitHub Actions 保活（防止免费版 7 天休眠）
  - `.github/workflows/supabase-keepalive.yml`

**✅ Phase 4 验收标准（最终验收）：**
- 公网域名可访问，HTTPS 证书有效
- 完整流程端到端可用
- AI 工作流生成 + 执行功能正常

---

## 🗄️ 数据库核心表（优先建立）

> 完整 SQL 在 `PROJECT_PLAN.md` 第十一章

| 表名 | MVP 是否必须 | 说明 |
|------|-------------|------|
| `auth.users` / `user_profiles` | ✅ 必须 | auth.users 由 Supabase Auth 管理（user_profiles 需手动建） |
| `ss_workflows` | ✅ 必须 | 工作流元数据 + nodes/edges |
| `ss_workflow_runs` | ✅ 必须 | 执行历史记录 |
| `prompts` | ❌ P1 | 提示词管理（MVP 硬编码即可） |
| `prompt_versions` | ❌ P1 | — |
| `workflow_templates` | ❌ P1 | 模板广场 |
| `memories` | ❌ P2 | 归档记忆 + pgvector |

---

## ⚠️ 关键风险与应对

| 风险 | 概率 | 应对方案 |
|------|------|---------|
| AI API 返回格式不稳定 | 高 | 后端强制 JSON Schema 验证 + 重试 3 次 |
| Supabase 7 天休眠 | 中 | 立即配置 GitHub Actions 保活 |
| Next.js 16 + React 19 某依赖不兼容 | 中 | 严格锁定版本，提前测试 |
| SSE 在 Nginx 被缓冲导致不实时 | 高 | 已配置 `proxy_buffering off` + `proxy_cache off` |
| ECS 内存不足 | 低 | 配置 2GB Swap，Gunicorn 仅 2 workers |
| AI 生成的 nodes JSON 无效 | 中 | 前端做 JSON 解析错误边界，显示 fallback |

---

## 🔗 相关文档引用

| 文档 | 用途 |
|------|------|
| `PROJECT_PLAN.md` | 技术架构 · 数据库设计 · 部署详情 |
| `daily_plan/user_auth/01-auth-and-guard-strategy.md` | 认证策略详细设计 |
| `daily_plan/workflow_canvas/01-editor-autosave-sync-strategy.md` | 画布同步策略详细设计 |
| `.agent/agents/frontend-specialist.md` → SS-* 章节 | 前端编码规范（含学长规范整合版） |
| `docs/Source/学长分享-核心规范/globals.css` | 迁移到 `frontend/src/app/globals.css` |

---

> 🚀 **下一步**：执行 Phase 0，初始化前端和后端脚手架。  
> 随时说 `/create` 或 `开始 T0-1` 即可进入实施阶段。
