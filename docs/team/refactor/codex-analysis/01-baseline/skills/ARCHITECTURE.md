# StudySolo Workspace Architecture

> 最后更新：2026-03-26
> 文档编码：UTF-8（无 BOM） / LF

## 1. 定位

StudySolo 是 1037Solo 生态中的 AI 学习工作流平台。

- 前端：`frontend/`，Next.js 16.1.6 + React 19.2.3 + TypeScript 5
- 后端：`backend/`，FastAPI + Pydantic 2 + Supabase Python
- 共享层：`shared/`，Git submodule，承载共享类型与跨项目规范
- 数据层：Supabase PostgreSQL + Auth + RLS + pgvector

本文件只描述当前工作区的真实架构，不再维护通用 agent / skill 清单。

## 2. 仓库拓扑

```text
StudySolo/
├─ frontend/                 # Next.js App Router，默认端口 2037
├─ backend/                  # FastAPI，默认端口 2038
├─ supabase/migrations/      # 数据库结构与迁移基线
├─ shared/                   # 共享子模块（Git submodule）
├─ docs/                     # 项目规范、技术指导、设计资料
├─ scripts/                  # 启动与部署脚本
└─ .agent/                   # 项目级 skills / rules / workflows
```

## 3. 运行时架构

```text
Browser
  -> Next.js frontend
  -> /api/* requests
  -> FastAPI backend
  -> Supabase / AI providers / email provider
```

### 前端

- 路由层在 `frontend/src/app/`
- 业务主干在 `frontend/src/features/`
- 工作流核心在 `frontend/src/features/workflow/`
- 全局状态在 `frontend/src/stores/`
- API 调用在 `frontend/src/services/`
- 类型定义在 `frontend/src/types/`

### 后端

- `backend/app/api/`：HTTP 路由聚合
- `backend/app/models/`：Pydantic 契约
- `backend/app/engine/`：工作流执行引擎与 SSE 事件
- `backend/app/nodes/`：插件化工作流节点
- `backend/app/services/`：AI 路由、知识库、usage、审计等服务
- `backend/app/prompts/`：AI chat / plan / create prompt 模块

## 4. 工作流域

### 节点体系

前端权威来源：

- `frontend/src/types/workflow.ts`
- `frontend/src/features/workflow/constants/workflow-meta.ts`

当前节点类型：

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

当前 SSE 事件：

- `node_status`
- `node_input`
- `node_token`
- `node_done`
- `loop_iteration`
- `workflow_done`
- `save_error`

## 5. API 分组

权威来源：

- `backend/app/api/router.py`
- `backend/app/api/*`

当前 API 域：

- `auth`：登录、注册、验证码、密码重置、会话同步
- `workflow`：CRUD、执行、公开页、市场、收藏/点赞、协作邀请
- `ai`：工作流生成、聊天、聊天流式接口、模型目录
- `knowledge`：知识库上传、查询、删除
- `exports`：文件下载
- `feedback`：用户反馈与奖励
- `usage`：用户 usage 总览、实时、时序
- `admin`：登录、仪表盘、用户、工作流、通知、评分、会员、配置、模型目录、审计
- `nodes`：节点清单

## 6. AI 目录与计费

权威来源：

- `backend/config.yaml`
- `backend/app/models/ai_catalog.py`
- `backend/app/models/usage.py`
- `supabase/migrations/20260326120000_add_ai_usage_ledger.sql`
- `supabase/migrations/20260326162000_upgrade_ai_catalog_and_cny_billing.sql`

核心规则：

- 运行时路由策略在 `backend/config.yaml`
- 目录权威表是 `ai_model_families` + `ai_model_skus`
- 正式选型字段是 `selected_model_key`
- 正式计费字段是 `*_cny`
- `ai_models` 仍保留为兼容层，不是新的权威目录

## 7. 数据库与共享层

- `shared/` 在本仓库中是 Git submodule，不是 subtree
- `StudySolo/` 作为 subtree 出现在 Platform Monorepo 中，这和当前仓库里的 `shared/` 不是同一件事
- 表名前缀：
  - 无前缀：共享层
  - `ss_`：StudySolo
  - `pt_`：Platform
  - `fm_`：Forum
  - `_`：系统元数据

## 8. 文档与维护约束

- 项目规范、README、skills 必须以代码和迁移为准，不接受手写想象架构
- 中文文档统一 UTF-8（无 BOM）与 LF
- `shared` 文档需要同时说明：
  - 共享数据库边界
  - `shared` submodule 事实
  - Platform 中 StudySolo subtree 的同步流程

## 9. 变更核对清单

修改架构文档或项目级 skill 前，至少核对以下文件：

- `frontend/package.json`
- `backend/requirements.txt`
- `backend/app/api/router.py`
- `frontend/src/types/workflow.ts`
- `frontend/src/types/workflow-events.ts`
- `backend/app/models/ai_catalog.py`
- `backend/app/models/usage.py`
- `backend/config.yaml`
- `.gitmodules`
- `supabase/migrations/README.sql`
