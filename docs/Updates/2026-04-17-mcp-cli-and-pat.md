# 2026-04-17 更新日志（MCP Server + CLI 初版 · PAT 认证 · Run API v2）

## 1. 背景

为让 StudySolo 既能被 Claude Desktop / Cursor / Claude Code 等 MCP Host 调用，也能在终端直接使用，本次同步推出 **两套客户端 + 一套认证机制 + 一套规范化工作流 REST**：

- `packages/mcp-server/`（`studysolo-mcp`）：stdio transport 的 MCP Server，11 个工具。
- `packages/cli/`（`studysolo`）：Typer + Rich 命令行。
- `ss_api_tokens`：新表，承载 Personal Access Token（PAT）。
- `ss_workflow_run_events` + 3 个新 REST：让非浏览器客户端能启动 / 监控工作流。

## 2. 数据库

新增迁移：`supabase/migrations/20260417120000_add_api_tokens_and_run_events.sql`

- `ss_api_tokens(id, user_id, name, token_hash UNIQUE, token_prefix, scopes, created_at, expires_at, last_used_at, revoked_at)`
  - 存储 SHA-256 hash（不存明文），`scopes` 初版固定 `["*"]`
  - RLS：`user_id = auth.uid()` 全 CRUD
- `ss_workflow_run_events(run_id, seq, event_type, payload, created_at)`
  - 主键 `(run_id, seq)`，`seq` 由后端单调分配
  - RLS：owner 可读 + shared run 公开读 + service_role 可写

## 3. 后端

| 模块 | 变更 |
| --- | --- |
| `backend/app/models/api_token.py` | 新增 `ApiTokenCreate / ApiTokenListItem / ApiTokenCreated` |
| `backend/app/services/api_token_service.py` | 新增 `generate_token / hash_token / create_token / list_tokens / revoke_token / verify_bearer` |
| `backend/app/middleware/auth.py` | 增加 `_resolve_user`：`sk_studysolo_` 前缀走 PAT，其余走 Supabase JWT；PAT 分支把 `tier` 透传到 `request.state` |
| `backend/app/api/tokens.py` | 新增 `GET / POST / DELETE /api/tokens` |
| `backend/app/api/router.py` | 挂载 `tokens_router` |
| `backend/app/api/workflow/execute.py` | 新增 `POST /api/workflow/{id}/runs` — 202 返回 `run_id`，`asyncio.create_task(run_to_db)` |
| `backend/app/api/workflow/runs.py` | 新增 `GET /{run_id}/progress` + `GET /{run_id}/events` |
| `backend/app/engine/run_worker.py` | 新增后台执行内核：`run_to_db / EventSink / summarise_progress` |

## 4. 前端

| 模块 | 变更 |
| --- | --- |
| `frontend/src/services/tokens.service.ts` | 新增 `listApiTokens / createApiToken / deleteApiToken` |
| `frontend/src/features/settings/components/DeveloperTokens.tsx` | 新增「开发者 / API Token」子页：列表 + 新建抽屉 + 一次性明文弹窗 + 撤销确认 |
| `frontend/src/features/settings/SettingsPageView.tsx` | 注册新 section |

## 5. 客户端（`packages/`）

```
packages/
├── cli/
│   ├── pyproject.toml
│   ├── README.md
│   └── src/studysolo_cli/
│       ├── __main__.py / app.py / config.py / client.py / auth.py
│       └── commands/: _common.py, me.py, usage.py, workflow.py, run.py
└── mcp-server/
    ├── pyproject.toml
    ├── README.md
    └── src/studysolo_mcp/
        ├── __main__.py / server.py / config.py / client.py
        └── tools/: profile.py, usage.py, workflows.py, runs.py
```

**CLI 命令面**：`login / logout / me / quota / usage {overview,timeseries,live} / wf {list,show,manifest,run --stream|--poll}`。

**MCP 工具面（11）**：`get_me / get_quota / get_usage_overview / get_usage_timeseries / get_usage_live / list_workflows / get_workflow / get_nodes_manifest / start_workflow_run / get_run_progress / get_run_events / run_workflow_and_wait`。

## 6. Skill 与文档

- `.agent/skills/studysolo-mcp/SKILL.md`：在 MCP Host 里如何选工具、错误处理、安全边界。
- `.agent/skills/studysolo-cli/SKILL.md`：`--stream` vs `--poll` 决策、退出码语义、常用命令。
- `docs/项目规范与框架流程/项目规范/04-API规范.md`：新增 §2.3「PAT」 与 §3.5「Run API v2」。
- `docs/项目规范与框架流程/项目规范/02-模块边界规范.md`：登记 `/api/tokens` 与 `packages/` 边界。
- `docs/项目规范与框架流程/功能流程/MCP与CLI/README.md`：总览 + 配置示例 + 常见问题。

## 7. 兼容性

- 既有 `POST /api/workflow/{id}/execute`（SSE）保持不变，浏览器前端继续使用。
- 新增的 REST 路由对旧客户端完全透明；未启用 PAT 的用户不受影响。
- `ss_workflow_runs` 新增事件是通过独立表 `ss_workflow_run_events` 存储，无 schema 变更。

## 8. 下一步

- HTTP / SSE transport 的 MCP Server（当前仅 stdio）
- 细粒度 `scopes`（`profile:read / usage:read / workflow:read / workflow:run` 等）
- 工作流 run 的 `pause / resume / cancel` REST
- 用户自有模型 API Key（另一条路线图）
