---
name: project-context
description: StudySolo 项目主上下文技能。用于快速理解当前仓库的真实架构、技术栈、端口、API 分组、工作流节点体系、AI catalog / usage / admin / collaboration / feedback 域，以及 shared 子模块与 Platform subtree 的边界。每次进入本项目都应优先参考它。
allowed-tools: Read, Write, Edit
version: 3.0
priority: CRITICAL
auto-load: true
---

# StudySolo Project Context

> 最后更新：2026-03-26
> 文档编码：UTF-8（无 BOM） / LF

## 1. 一句话说明

StudySolo 是一个 AI 学习工作流平台：用户在画布上组织节点，后端执行 DAG，结果通过 SSE 回流到前端，并由知识库、AI 路由、模型目录、usage 账本和后台管理模块共同支撑。

## 2. 仓库地图

```text
frontend/                 Next.js 16.1.6 前端，端口 2037
backend/                  FastAPI 后端，端口 2038
supabase/migrations/      Supabase 结构与迁移
shared/                   共享子模块（Git submodule）
docs/                     项目规范与技术文档
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

## 4. 前端结构

主要入口：

- `frontend/src/app/`：路由层
- `frontend/src/features/`：按领域组织业务
- `frontend/src/services/`：API 服务
- `frontend/src/stores/`：Zustand store
- `frontend/src/types/`：领域类型
- `frontend/src/styles/`：全局样式

重要领域：

- `features/workflow/`：工作流画布、节点、工具栏、执行、AI 面板联动
- `features/admin/`：后台子域
- `features/knowledge/`：知识库
- `features/auth/`：登录注册验证码
- `features/settings/`：个人设置页

## 5. 后端结构

主要入口：

- `backend/app/main.py`
- `backend/app/api/router.py`

主要分层：

- `api/`：HTTP 路由
- `models/`：Pydantic 契约
- `engine/`：执行引擎和 SSE
- `nodes/`：插件化节点
- `services/`：AI、knowledge、usage、audit 等服务
- `prompts/`：AI prompt 模板
- `core/`：配置、数据库、依赖注入

## 6. API 分组速查

真实路由以 `backend/app/api/*` 为准。

- `/api/auth/*`
- `/api/workflow/*`
- `/api/ai/*`
- `/api/nodes/*`
- `/api/knowledge/*`
- `/api/exports/*`
- `/api/feedback/*`
- `/api/usage/*`
- `/api/admin/*`
- `/api/health`

扩展域已存在，不要在文档里漏掉：

- `workflow_social`
- `workflow_collaboration`
- `ai_catalog`
- `admin_models`
- `usage`
- `feedback`

## 7. 工作流节点体系

权威来源：

- `frontend/src/types/workflow.ts`
- `frontend/src/features/workflow/constants/workflow-meta.ts`

当前节点：

- 输入：`trigger_input`、`knowledge_base`、`web_search`
- 分析：`ai_analyzer`、`ai_planner`、`logic_switch`、`loop_map`
- 生成：`outline_gen`、`content_extract`、`summary`、`flashcard`、`compare`、`mind_map`、`quiz_gen`、`merge_polish`
- 交互：`chat_response`
- 输出：`export_file`、`write_db`
- 结构：`loop_group`

当前边类型：

- 仅 `sequential`

当前节点状态：

- `pending`
- `running`
- `waiting`
- `done`
- `error`
- `skipped`
- `paused`

## 8. AI 域规则

权威来源：

- `backend/config.yaml`
- `backend/app/models/ai_catalog.py`
- `backend/app/models/usage.py`
- `backend/app/models/ai_chat.py`

关键概念：

- `selected_model_key`：正式主入口，值来自 `ai_model_skus.id`
- `provider`：实际调用平台
- `vendor`：原始模型厂商
- `family_id`：模型族
- `sku_id`：可计费、可路由的具体模型条目
- `routing_policy`：`native_first` / `proxy_first` / `capability_fixed`
- 正式计费字段统一使用 `*_cny`

## 9. 数据库与共享边界

表名前缀：

- 无前缀：共享层
- `ss_`：StudySolo
- `pt_`：Platform
- `fm_`：Forum
- `_`：系统元数据

注意区分两种同步关系：

- `shared/` 在本仓库中是 Git submodule，事实来源是 `.gitmodules`
- `StudySolo/` 作为 subtree 出现在 Platform Monorepo 中，相关流程由 `shared/docs/guides/subtree-sync.md` 说明

不要把 submodule 和 subtree 写混。

## 10. 文档维护规则

- 规范文档和 README 只能以代码、Pydantic 模型、迁移文件、配置文件为准
- 中文文档统一 UTF-8（无 BOM）与 LF
- 涉及 API、AI 目录、usage、工作流状态、节点类型时，必须回看真实源码

## 11. 高价值事实源

优先阅读：

- `frontend/package.json`
- `backend/requirements.txt`
- `backend/app/api/router.py`
- `frontend/src/types/workflow.ts`
- `frontend/src/types/workflow-events.ts`
- `backend/app/models/workflow.py`
- `backend/app/models/ai_catalog.py`
- `backend/app/models/usage.py`
- `backend/app/models/ai_chat.py`
- `backend/config.yaml`
- `supabase/migrations/README.sql`
- `.gitmodules`

## 12. 典型任务映射

- 改 API 文档：看 `backend/app/api/*` + `backend/app/models/*`
- 改工作流架构说明：看 `frontend/src/types/workflow.ts` + `workflow-meta.ts` + `backend/app/engine/*`
- 改 AI 命名或 catalog 文档：看 `ai_catalog.py`、`usage.py`、`config.yaml`、AI 迁移
- 改 shared 文档：同时确认 `.gitmodules`、`shared/docs/*`、Platform subtree 语义
