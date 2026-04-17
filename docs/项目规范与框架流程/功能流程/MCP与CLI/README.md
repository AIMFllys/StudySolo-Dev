# MCP 与 CLI 功能流程

> 创建时间：2026-04-17
> 编码：UTF-8（无 BOM） / LF
> 权威源：`packages/cli/`、`packages/mcp-server/`、`backend/app/api/tokens.py`、`backend/app/api/workflow/`

本文档是 StudySolo 「命令行 + MCP Host」两个客户端子项目的总览。权威 API 定义请见 [`04-API规范.md`](../../项目规范/04-API规范.md) §2.3（PAT）与 §3.5（Run API v2）。

## 1. 目标与边界

**目标**：让 StudySolo 用户既可以在终端（`studysolo` CLI），也可以在 Claude Desktop / Cursor 等 MCP Host（`studysolo-mcp`）中，完成以下四类任务：

1. 查看账户 / 会员 / 配额
2. 查看 AI 调用数据（等同仪表盘）
3. 查看工作流列表与画布节点元信息
4. 启动工作流并在两种输出方式中选择：
   - **实时流式**：节点级事件逐条打印
   - **定时轮询**：聚合进度 + 终态一次性输出

**本次不在范围**：

- HTTP/SSE transport 的 MCP（仅 stdio）
- 细粒度 `scopes`（字段预留）
- 工作流的暂停 / 恢复 / 取消 REST
- 用户自有模型 API Key（另有路线图）

## 2. 架构总览

```text
┌────────────────────────────────────────────────────────────┐
│  MCP Host                        终端                      │
│  ├── Claude Desktop              │                         │
│  ├── Cursor                      │                         │
│  └── Claude Code                 ▼                         │
│        │                    studysolo (Typer + Rich)       │
│        ▼                         │                         │
│  studysolo-mcp  (mcp SDK, stdio) │                         │
│        │                         │                         │
│        └──────── HTTPS + Bearer PAT ────────┐              │
│                                             ▼              │
│                               ┌──────────────────────┐     │
│                               │  backend / FastAPI   │     │
│                               │   middleware/auth    │     │
│                               │   api/tokens         │     │
│                               │   api/workflow/*     │     │
│                               │   engine/run_worker  │     │
│                               └──────────┬───────────┘     │
│                                          ▼                 │
│                               ┌──────────────────────┐     │
│                               │  Supabase (PG + RLS) │     │
│                               │  ss_api_tokens       │     │
│                               │  ss_workflow_runs    │     │
│                               │  ss_workflow_run_    │     │
│                               │         events       │     │
│                               └──────────────────────┘     │
└────────────────────────────────────────────────────────────┘
```

## 3. PAT 生命周期

1. 用户前端进入 **设置 / 开发者 / API Token** → 点「新建 Token」。
2. 后端 `POST /api/tokens` 生成 `sk_studysolo_xxx`，插入 `ss_api_tokens(token_hash=sha256(plain), token_prefix=plain[:12])`。
3. **明文仅在响应中返回一次**，前端展示 + 复制，关闭后无法再查询。
4. 客户端使用：
   - CLI：`studysolo login` 粘贴 → 存 `~/.studysolo/config.toml`（mode 600）。
   - MCP：Host 配置文件的 `env.STUDYSOLO_TOKEN`。
5. 每次命中后，`last_used_at` 异步（best-effort）更新；用户可随时在前端「撤销」删除行，客户端下次请求即 401。

## 4. Run API v2 协议

```text
POST /api/workflow/{id}/runs   →  202  { run_id, workflow_id, status: "queued",
                                         started_at, progress_url, events_url }

GET  /api/workflow-runs/{id}/progress
   →  { run_id, workflow_id, status, phase, current_node_id, current_node_label,
        total_nodes, done_nodes, percent, elapsed_ms, last_event_at }

GET  /api/workflow-runs/{id}/events?after_seq=N&limit=200
   →  { run_id, run_status, is_terminal, next_seq, events: [...] }
```

**推荐轮询节奏**：

| 模式 | 客户端 | 间隔 | 何时停 |
| --- | --- | --- | --- |
| 实时流式 | CLI `--stream` / MCP `run_workflow_and_wait(mode="stream")` | 500 ms | `is_terminal == true` |
| 定时轮询 | CLI `--poll --interval N` / MCP `run_workflow_and_wait(mode="poll", poll_interval_s=N)` | N 秒 (≥0.5) | `progress.status ∈ {completed, failed}` |

## 5. 错误与退出码

### 5.1 HTTP 错误码

| 状态 | 含义 | 客户端响应 |
| --- | --- | --- |
| 401 | PAT 无效 / 已撤销 / 未配置 | 提示重新 `login` 或生成 Token |
| 403 + `MODEL_TIER_FORBIDDEN` | 工作流某节点模型超出会员 tier | 提示升级或更换模型 |
| 404 | 资源不存在或无权访问 | 检查 ID |
| 429 | rate-limit 或每日配额耗尽 | 稍后重试 / 升级 |
| 5xx | 后端异常 | 保留 `run_id` 稍后用 `progress` 查询 |

### 5.2 CLI 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 / `completed` |
| 1 | 输入或请求错误 |
| 2 | 未登录 / 认证失败 |
| 3 | 工作流 `failed` 或等待超时 |

## 6. 安全与边界

- PAT 仅存 SHA-256 hash；`token_prefix` 仅 12 字符，仅用于 UI 区分。
- `ss_api_tokens` + `ss_workflow_run_events` 均启用 RLS：仅 `user_id = auth.uid()` 可见。
- `packages/*` 客户端 **只能**走 `/api/*` 公共接口，严禁导入 `backend/` 任一符号。
- 明文 PAT 绝不进入仓库、日志、浏览器 localStorage；CLI 配置文件强制 `chmod 600`。
- 客户端失败/异常时返回结构化 `{error:{code,message,status}}`，不泄后端栈。

## 7. 常见问题

**Q：为什么 MCP stdio 下没有「真正的 SSE」？**
A：stdio transport 是 JSON-RPC 请求-响应，没有无请求推送；`run_workflow_and_wait(mode="stream")` 在内部用 500 ms 小步轮询 `/events` 模拟流式效果。真正的 SSE 仅供浏览器 `/execute` 用。

**Q：CLI 的 `wf run --stream` 与 `--poll` 有什么本质区别？**
A：`--stream` 是高频（0.5s）打印节点逐条事件，适合人工调试；`--poll` 是低频（默认 3s）打印聚合进度条 + 终态 JSON，适合 CI 与脚本。

**Q：可以跨用户共享 PAT 吗？**
A：不可以。RLS 保证 PAT 绑定创建者；任何请求仅能访问创建者自己的资源。请为每台机器单独创建 Token 以便单独撤销。
