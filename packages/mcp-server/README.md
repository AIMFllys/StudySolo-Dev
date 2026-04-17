# studysolo-mcp

StudySolo 官方 [Model Context Protocol](https://modelcontextprotocol.io/) 服务器。让 Claude Desktop / Cursor 等 MCP Host 通过标准工具调用查询 StudySolo 账户、AI 使用数据，以及触发 / 监控工作流。

It also exposes canvas editing tools for creating and updating real workflow node and edge instances.

本服务只实现 **stdio transport**，无 HTTP/SSE；本地进程由 MCP Host 启动，进程间以 JSON-RPC 通信。

## 安装

```bash
pip install -e packages/mcp-server   # 开发
pip install studysolo-mcp            # 发布后（暂未上架）
```

## 配置 PAT

1. 前往 StudySolo 前端 → **设置 / 开发者 / API Token** 新建一个 Token。
2. 一次性复制明文 `sk_studysolo_xxx`，粘贴到下方配置的 `STUDYSOLO_TOKEN`。
3. 若你在本机跑自建后端，将 `STUDYSOLO_API_BASE` 指向它；否则默认 `https://studyflow.1037solo.com`（占位，按实际部署修改）。

## Claude Desktop 配置示例

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）或
`%APPDATA%\Claude\claude_desktop_config.json`（Windows）：

```json
{
  "mcpServers": {
    "studysolo": {
      "command": "studysolo-mcp",
      "env": {
        "STUDYSOLO_API_BASE": "http://127.0.0.1:2038",
        "STUDYSOLO_TOKEN": "sk_studysolo_xxxxxx"
      }
    }
  }
}
```

## Cursor 配置示例

在项目根目录的 `.cursor/mcp.json`（或全局配置）里：

```json
{
  "mcpServers": {
    "studysolo": {
      "command": "studysolo-mcp",
      "env": {
        "STUDYSOLO_API_BASE": "http://127.0.0.1:2038",
        "STUDYSOLO_TOKEN": "sk_studysolo_xxxxxx"
      }
    }
  }
}
```

## 工具清单（当前共 18 个）

| 工具 | 对应 REST | 说明 |
| --- | --- | --- |
| `get_me` | GET `/api/auth/me` | 当前账户、邮箱、会员 tier |
| `get_quota` | GET `/api/usage/quota` | 工作流额度与每日执行配额 |
| `get_usage_overview` | GET `/api/usage/overview` | 指定时间窗口的调用总览 |
| `get_usage_timeseries` | GET `/api/usage/timeseries` | 时间桶聚合数据 |
| `get_usage_live` | GET `/api/usage/live` | 最近 N 分钟实时数据 |
| `list_workflows` | GET `/api/workflow` | 工作流列表 |
| `get_workflow` | GET `/api/workflow/{id}/content` | 画布节点 / 边元信息 |
| `get_nodes_manifest` | GET `/api/nodes/manifest` | 节点类型清单 |
| `create_workflow` | POST `/api/workflow` | Create an empty workflow |
| `get_workflow_canvas` | GET `/api/workflow/{id}/canvas` | Read real canvas JSON and updated_at |
| `get_workflow_node` | GET `/api/workflow/{id}/canvas` + local filter | Read one real node plus incoming/outgoing edges |
| `apply_workflow_canvas_patch` | POST `/api/workflow/{id}/canvas/apply` | Batch create/update/delete real nodes and edges |
| `validate_workflow_canvas` | POST `/api/workflow/{id}/canvas/validate` | Validate canvas or proposed ops |
| `get_node_config_options` | GET `/api/nodes/config-options/{type}/{field}` | Read dynamic config options |
| `start_workflow_run` | POST `/api/workflow/{id}/runs` | 异步启动一个 run，返回 run_id |
| `get_run_progress` | GET `/api/workflow-runs/{id}/progress` | 聚合进度快照 |
| `get_run_events` | GET `/api/workflow-runs/{id}/events` | 节点级事件增量 |
| `run_workflow_and_wait` | 上述组合 | 端到端「启动 + 轮询 + 终态返回」单工具 |

## Real Canvas Editing

MCP creates real React Flow node instances in `nodes_json`, not labels or names. Use `apply_workflow_canvas_patch` with `op=create_node` and `node_type`; `label` is display text only. For complex edits, run with `dry_run=true` first, then apply the same ops with `dry_run=false`. JSON strings, including non-English labels and prompts, are sent as UTF-8.

## 错误语义

所有工具失败都返回 MCP 的 `isError: true` 文本，并以结构化 JSON 写明 HTTP 状态码与后端 detail：

```json
{
  "error": {
    "code": "HTTP_403",
    "message": "节点使用了当前会员等级（free）无权访问的模型：…",
    "status": 403
  }
}
```
