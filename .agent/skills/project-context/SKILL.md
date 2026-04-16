---
name: project-context
description: StudySolo 项目主上下文技能。用于快速理解当前仓库的真实架构、技术栈、端口、API 分组、工作流节点体系、AI catalog / usage / admin / collaboration / feedback 域，以及 shared 子模块与 Platform subtree 的边界。每次进入本项目都应优先参考它。
allowed-tools: Read, Write, Edit
version: 6.0
priority: CRITICAL
auto-load: true
---

# StudySolo Project Context

> 最后更新：2026-04-12
> 文档编码：UTF-8（无 BOM） / LF
> 版本：v6.0（反映 Phase 5 规范整合 + Gateway 规划起点）

## 1. 一句话说明

StudySolo 是一个 AI 学习工作流平台：用户在画布上组织节点，后端执行 DAG，结果通过 SSE 回流到前端，并由知识库、AI 路由、模型目录、usage 账本和后台管理模块共同支撑。

## 2. 仓库地图

```text
frontend/                 Next.js 16.1.6 前端，端口 2037
backend/                  FastAPI 后端，端口 2038
agents/                   子后端 Agent（独立 FastAPI 服务）
  ├── _template/          Agent 模板（复制即用）
  ├── code-review-agent/   代码审查 Agent（小李）
  ├── deep-research-agent/ 深度研究 Agent
  ├── news-agent/         新闻抓取 Agent
  ├── study-tutor-agent/  学习专家 Agent（规划中）
  └── visual-site-agent/  可视化网站生成 Agent（规划中）
supabase/migrations/      Supabase 结构与迁移
shared/                   共享子模块（Git submodule）
docs/                     项目规范与技术文档
  └── team/refactor/     重构计划与实施文档（L0 权威）
    ├── final-plan/       Phase 0-5 实施计划
    └── contracts/        Phase 1 冻结契约
scripts/                  启动 / 部署脚本
.agent/                   项目级 skills、rules、workflows
```

## 3. 技术栈

### 前端

- Next.js `16.1.6`
- React `19.2.3`
- TypeScript `5`
- Tailwind CSS `v4`
- Zustand `5.0.11`
- `@xyflow/react` `12.10.1`
- Framer Motion `12.38.0`
- Supabase SSR `0.8.0`
- Vitest `4.0.18`

### 后端

- FastAPI `>=0.115`
- Pydantic `>=2.10`
- Supabase Python `>=2.11`
- OpenAI SDK `>=1.60`
- SSE-Starlette `>=2.2`
- SlowAPI `>=0.1.9`

### 子后端 Agent

- Python `3.11+`
- FastAPI + uvicorn
- pydantic-settings
- openai `>=1.60`
- pytest + httpx

## 4. 前端结构

### 4.1 目录架构（Phase 3 重构后）

```
frontend/src/
├── app/                        # Next.js App Router 路由层
├── features/                   # 按领域组织业务
│   ├── workflow/                # 工作流编辑器完整域
│   ├── admin/                  # 后台管理域
│   ├── auth/                   # 认证域
│   ├── knowledge/              # 知识库域
│   └── settings/               # 用户设置域
├── components/                 # 跨域通用组件
│   ├── layout/                 # 布局组件
│   └── ui/                     # shadcn/ui 基础组件
├── hooks/                      # 通用跨域 Hooks
├── stores/                     # Zustand 状态层（Phase 3 重组后）
│   ├── workflow/               # 工作流状态（含 compat shim）
│   ├── chat/                  # AI 聊天状态
│   ├── ui/                    # 面板/设置状态
│   ├── admin/                 # 后台状态
│   └── *.ts                   # 根级 compat shim（向后兼容）
├── services/                   # 统一 API 服务层
├── types/                      # 领域类型定义
├── lib/                        # 第三方库配置
│   └── events/event-bus.ts    # TypedEventBus（Phase 3 新增）
├── styles/                     # 全局样式
└── utils/                      # 工具函数
```

### 4.2 重要领域

- `features/workflow/`：工作流画布、节点、工具栏、执行、AI 面板联动
- `features/admin/`：后台子域
- `features/knowledge/`：知识库
- `features/auth/`：登录注册验证码
- `features/settings/`：个人设置页

### 4.3 前端事件通信

**TypedEventBus**（`frontend/src/lib/events/event-bus.ts`）：
- 新代码必须使用 TypedEventBus
- 旧 CustomEvent 在涉及该文件的 PR 中逐步替换
- 事件类型定义在 `EventMap` 中

### 4.4 前端 Store 组织（Phase 3 重组后）

| Store 目录 | 文件 | 职责 |
|-----------|------|------|
| `stores/workflow/` | `use-workflow-store.ts` 等 | 工作流状态 + 执行 + 历史 |
| `stores/chat/` | `use-ai-chat-store.ts`, `use-conversation-store.ts` | AI 聊天状态 |
| `stores/ui/` | `use-panel-store.ts`, `use-settings-store.ts` | 面板/主题状态 |
| `stores/admin/` | `use-admin-store.ts` | 后台状态 |
| 根级 `*.ts` | compat shim | 向后兼容导出 |

**Store 解耦原则（Phase 3 完成）**：
- `useAIChatStore` 不再直接调用 `useConversationStore`
- 跨 store 同步在调用方（hook 或组件）显式处理

## 5. 后端结构

### 5.1 目录架构（Phase 2 重构后）

```
backend/app/
├── main.py                     # FastAPI 入口 & 中间件注册
├── api/                        # HTTP 路由层（Phase 2 重组后）
│   ├── router.py               # 统一路由注册中心
│   ├── auth/                   # 认证路由包
│   │   ├── login.py
│   │   ├── register.py
│   │   ├── captcha.py
│   │   ├── me.py
│   │   ├── password.py
│   │   ├── consent.py
│   │   └── _helpers.py
│   ├── workflow/               # 工作流路由包（Phase 2 新增）
│   │   ├── crud.py            # ← 由 workflow.py 拆分
│   │   ├── execute.py          # ← 由 workflow_execute.py 拆分
│   │   ├── social.py           # ← 由 workflow_social.py 拆分
│   │   ├── collaboration.py    # ← 由 workflow_collaboration.py 拆分
│   │   ├── runs.py
│   │   └── __init__.py
│   ├── ai/                     # AI 路由包（Phase 2 新增）
│   │   ├── chat.py             # ← 合并后的 ai_chat + ai_chat_stream
│   │   ├── generate.py         # ← 由 ai.py 拆分
│   │   ├── catalog.py          # ← 由 ai_catalog.py 拆分
│   │   ├── models.py
│   │   └── __init__.py
│   ├── nodes.py                 # 节点元数据 API
│   ├── knowledge.py             # 知识库 CRUD & 查询
│   ├── exports.py               # 文件导出
│   ├── feedback.py              # 用户反馈
│   ├── usage.py                 # Usage 统计
│   ├── community_nodes.py       # 社区节点
│   ├── discounts.py
│   └── admin/                   # 管理后台路由
│       ├── dashboard.py
│       ├── users.py
│       ├── workflows.py
│       ├── notices.py
│       ├── ratings.py
│       ├── members.py
│       ├── models.py
│       ├── config.py
│       ├── audit.py
│       └── auth.py
├── models/                      # Pydantic 数据契约
├── engine/                      # 工作流执行引擎
│   ├── executor.py
│   ├── context.py
│   ├── events.py
│   └── sse.py
├── nodes/                       # 插件化节点
│   ├── _base.py
│   ├── _categories.py
│   ├── _mixins.py
│   └── [category]/[node_type]/node.py
├── services/                    # 横向业务服务层
│   ├── llm/                    # LLM 服务（Phase 2 重构后）
│   │   ├── router.py
│   │   ├── caller.py
│   │   ├── provider.py
│   │   └── generators/
│   ├── ai_chat/                # AI 聊天服务（Phase 2 新增）
│   │   ├── helpers.py
│   │   ├── intent.py
│   │   ├── validators.py
│   │   └── generators/
│   ├── usage_ledger.py
│   ├── usage_analytics.py
│   └── [其他服务]
├── prompts/                     # AI Prompt 模板库
├── core/                        # 基础设施层
│   ├── config.py
│   ├── config_loader.py
│   ├── database.py
│   └── deps.py
├── middleware/                  # 全局中间件守卫
│   ├── auth.py
│   ├── admin_auth.py
│   └── security.py
└── utils/
```

### 5.2 Phase 2 重构关键变更

**AI Chat 合并**：
- `ai_chat.py` + `ai_chat_stream.py` → 合并为 `api/ai/chat.py`
- 共享逻辑提取到 `services/ai_chat/`（helpers.py, intent.py, validators.py, generators/）

**路由重组**：
- Workflow 路由：4 个散文件 → `api/workflow/` 子目录
- AI 路由：5 个散文件 → `api/ai/` 子目录

**LLM 服务重构**：
- `services/ai_router.py` → `services/llm/router.py`（路由选择）
- 新增 `services/llm/generators/streaming.py`（流式生成器）

## 6. API 分组速查

真实路由以 `backend/app/api/*` 为准。

### 6.1 Phase 2 重组后的路由结构

| 前缀 | 路由包 | 说明 |
|------|--------|------|
| `/api/auth/*` | `api/auth/` | 认证路由包 |
| `/api/workflow/*` | `api/workflow/` | 工作流路由包（Phase 2 新增子目录） |
| `/api/ai/*` | `api/ai/` | AI 路由包（Phase 2 新增子目录） |
| `/api/nodes/*` | `api/nodes.py` | 节点元数据 |
| `/api/knowledge/*` | `api/knowledge.py` | 知识库 |
| `/api/exports/*` | `api/exports.py` | 文件导出 |
| `/api/feedback/*` | `api/feedback.py` | 反馈 |
| `/api/usage/*` | `api/usage.py` | Usage 统计 |
| `/api/admin/*` | `api/admin/` | 管理后台路由包 |
| `/api/health` | - | 健康检查 |

### 6.2 扩展域（已存在，不要漏掉）

- `workflow_social` → `api/workflow/social.py`
- `workflow_collaboration` → `api/workflow/collaboration.py`
- `ai_catalog` → `api/ai/catalog.py`
- `admin_models` → `api/admin/models.py`
- `usage` → `api/usage.py`
- `feedback` → `api/feedback.py`

## 7. 工作流节点体系

### 7.1 权威来源

- **运行时权威**：`backend/app/nodes/_base.py`（BaseNode 类）
- **前端类型**：`frontend/src/types/workflow.ts`
- **前端元数据**：`frontend/src/features/workflow/constants/workflow-meta.ts`（Phase 3 确认继续承担结构职责）
- **Manifest API**：`api/nodes.py` → `/api/nodes/manifest`

### 7.2 节点分类（19 种节点）

| 类别 | 节点类型 | 说明 |
|------|---------|------|
| 输入 | `trigger_input`, `knowledge_base`, `web_search` | 3 种 |
| 分析/控制 | `ai_analyzer`, `ai_planner`, `logic_switch` **(P2)**, `loop_map` **(P2)** | 4 种（P2 为 Phase 2） |
| 内容生成 | `outline_gen`, `content_extract`, `summary`, `flashcard`, `quiz_gen`, `mind_map`, `compare`, `merge_polish` | 8 种 |
| 交互 | `chat_response` | 1 种 |
| 输出 | `export_file`, `write_db` | 2 种 |
| 结构 | `loop_group` | 前端虚拟容器 |

### 7.3 节点状态

- `pending` / `running` / `waiting` / `done` / `error` / `skipped` / `paused`

### 7.4 Manifest-First（Phase 3 完成）

- 后端 manifest 是节点定义的唯一事实源
- 前端 `RENDERER_REGISTRY` 从 manifest 动态读取
- `workflow-meta.ts` 仍承担 `status / icon / theme / inputs / outputs` 结构职责

## 8. AI 域规则

### 8.1 权威来源

- `backend/config.yaml`
- `backend/app/models/ai_catalog.py`
- `backend/app/models/usage.py`
- `backend/app/models/ai_chat.py`
- `backend/app/services/llm/router.py`

### 8.2 关键概念

| 概念 | 说明 |
|------|------|
| `selected_model_key` | **正式主入口**，值来自 `ai_model_skus.id` |
| `provider` | 实际调用平台（dashscope / deepseek / qiniu 等） |
| `vendor` | 原始模型厂商（阿里 / DeepSeek 等） |
| `family_id` | 模型族 |
| `sku_id` | 可计费、可路由的具体模型条目 |
| `routing_policy` | `native_first` / `proxy_first` / `capability_fixed` |

### 8.3 正式计费字段

- `input_price_cny_per_million`
- `output_price_cny_per_million`
- `cost_amount_cny`
- `total_cost_cny`

## 9. 子后端 Agent 体系（Phase 4 当前状态）

### 9.1 Agent 目录（Phase 4B 现状）

```
agents/
├── README.md                    # 开发总指南（权威）
├── _template/                   # 模板（复制即用）✅
├── code-review-agent/           # 代码审查（小李）✅ 可运行
├── deep-research-agent/         # 深度研究（迁移中）
├── news-agent/                  # 新闻抓取（迁移中）
├── study-tutor-agent/           # 学习专家（规划中）
└── visual-site-agent/           # 可视化网站生成（规划中）
```

### 9.2 Agent 协议（权威）

- `docs/issues/TeamRefactor/final-plan/agent-architecture.md`（四层协议 ✅ 已冻结）
- `backend/config/agents.yaml`（注册配置 ⚠️ Phase 5 实现）
- `agents/README.md`（开发指南 ✅ 已完成）

### 9.3 端口分配

| 端口 | Agent | 负责人 | 状态 |
|------|-------|--------|------|
| 2037 | 主前端 | - | 已占用 |
| 2038 | 主后端 | - | 已占用 |
| 8000 | `_template` | - | 仅模板 |
| 8001 | `code-review-agent` | 小李 | ✅ 可运行 |
| 8002 | `deep-research-agent` | - | ⚠️ 待迁移 |
| 8003 | `news-agent` | - | ⚠️ 待迁移 |
| 8004 | `study-tutor-agent` | - | 📋 规划中 |
| 8005 | `visual-site-agent` | - | 📋 规划中 |

### 9.4 当前 owner 范围（2026-04-12）

- `code-review-agent` 已完成当前 owner 侧的 Phase 4B 治理收口，真实测试基线为 `pytest agents/code-review-agent/tests -q -> 177 passed`
- 当前 `code-review-agent` 仍不读取本地仓库文件，不做 embedding / AST / 跨文件推理，也不透传 provider usage / model
- 其他 Agent 扩展、骨架补全和迁移不属于当前 owner 的默认主线；除非出现阻塞 Gateway 的真实缺口，否则不要继续深挖 `code-review-agent` 的 4B 细节
- 当前 owner 的默认下一主线是 Phase 5：`Agent Gateway`、根级治理、文档与代码对齐、CI/CD 增强

## 10. 数据库与共享边界

### 10.1 表名前缀

| 前缀 | 项目 | 说明 |
|------|------|------|
| 无前缀 | Shared | 跨项目共享表 |
| `ss_` | StudySolo | StudySolo 业务表 |
| `pt_` | Platform | Platform 业务表 |
| `fm_` | Forum | Forum 业务表 |
| `_` | System Metadata | 系统元数据 |

### 10.2 共享边界

- `shared/` 在本仓库是 **Git Submodule**（事实源：`.gitmodules`）
- 在 Platform Monorepo 视角，`StudySolo/` 作为 **Git Subtree** 存在
- 两者概念不可混写

## 11. 文档权威层级

> 完整规范索引见 `docs/项目规范与框架流程/项目规范/00-规范索引.md`

| 优先级 | 文档位置 | 说明 |
|--------|---------|------|
| **L0（最高）** | `docs/项目规范与框架流程/项目规范/*.md` | 项目规范统一权威 |
| **L0** | `.github/CODEOWNERS` | GitHub 代码所有权 |
| **L0** | `docs/issues/TeamRefactor/contracts/` | Phase 1 冻结契约（不可修改） |
| **L1** | `docs/项目规范与框架流程/项目规范/` | 技术规范主体（整合后统一入口） |
| **L1** | `docs/issues/TeamRefactor/final-plan/` | 重构执行计划（只记录阶段状态） |
| **L2** | `agents/README.md` | Agent 开发指南 |
| **L2** | 本文档 | AI 编程速查（索引 + 摘要） |
| **L3（参考）** | `docs/issues/TeamRefactor/claude-analysis/` | 历史分析，只读 |
| **L3（参考）** | `docs/issues/TeamRefactor/codex-analysis/` | 历史分析，只读 |

## 12. 重构状态（2026-04-12）

| Phase | 状态 | 说明 |
|-------|------|------|
| Phase 0 | ✅ 完成 | 基础冻结与紧急修复 |
| Phase 1 | ✅ 完成 | 接口契约冻结（已签字） |
| Phase 2 | ✅ 完成 | 后端核心重构（2026-04-10） |
| Phase 3 | ✅ 完成 | 前端架构重构（工程主线；手动 smoke 待补） |
| Phase 4 | 🔨 进行中 | Phase 4A 主线完成；当前 owner 侧 4B 已在责任边界内收口 |
| Phase 5 | 🔨 进行中 | 第一波（规范统一）已启动；Gateway / 治理 / CI 待推进 |

## 13. 高价值事实源

优先阅读（按优先级）：

**规范层**（整合后）：
- `docs/项目规范与框架流程/项目规范/00-规范索引.md` — 规范统一入口
- `docs/issues/TeamRefactor/final-plan/00-索引.md` — 重构总览
- `docs/issues/TeamRefactor/final-plan/agent-architecture.md` — 四层协议（冻结）
- `docs/issues/TeamRefactor/contracts/` — Phase 1 冻结契约
- `docs/issues/phase5-master-plan/00-总览与执行顺序.md` — Phase 5 完整规划

**代码层**：
- `frontend/src/types/workflow.ts` — 节点类型和状态
- `frontend/src/lib/events/event-bus.ts` — TypedEventBus
- `backend/app/api/router.py` — 路由注册
- `backend/app/api/ai/chat.py` — AI Chat 合并后路由
- `backend/app/api/workflow/` — Workflow 路由包
- `backend/app/nodes/_base.py` — 节点基类
- `backend/app/models/ai_catalog.py` — AI Catalog Pydantic 模型
- `backend/app/models/usage.py` — Usage Pydantic 模型
- `backend/config.yaml` — AI 运行时配置
- `agents/code-review-agent/src/core/agent.py` — 首个可运行 Agent

## 14. 典型任务映射

| 任务 | 查看文件 |
|------|----------|
| 改 API 文档 | `backend/app/api/*/` + `backend/app/models/*` |
| 改工作流架构 | `frontend/src/types/workflow.ts` + `workflow-meta.ts` + `backend/app/engine/*` |
| 改 AI 命名/catalog | `ai_catalog.py` + `usage.py` + `config.yaml` |
| 改 shared 文档 | `.gitmodules` + `shared/docs/*` |
| 改 Agent 开发 | `agents/README.md` + `agent-architecture.md` |
| 改节点系统 | `backend/app/nodes/_base.py` + `api/nodes.py` |

## 15. 文档维护规则

- 规范文档和 README 只能以代码、Pydantic 模型、迁移文件、配置文件为准
- 中文文档统一 UTF-8（无 BOM）与 LF
- 涉及 API、AI 目录、usage、工作流状态、节点类型时，必须回看真实源码
- 更新规范后，同步更新本文档版本号和最后更新日期
