---
title: MCP（studysolo-mcp）
description: 在 Claude Desktop、Cursor 等 MCP Host 中通过 studysolo-mcp 使用 Personal Access Token 调用 StudySolo：账户与用量、工作流与画布编辑、启动与监控运行。
lastUpdated: 2026-04-17
---

# MCP（studysolo-mcp）

StudySolo 提供官方 [Model Context Protocol](https://modelcontextprotocol.io/) 服务器 **`studysolo-mcp`**：由 MCP Host 在本地启动子进程，通过 **stdio**（标准输入输出）与 Host 交换 JSON-RPC；服务端再使用 **HTTPS + `Authorization: Bearer`** 访问 StudySolo 后端。

> **传输方式**：当前仅支持 **stdio**，不提供 HTTP/SSE 形态的 MCP 端点。

## 前置条件

1. 已安装 Python 环境，并可执行包入口 `studysolo-mcp`（开发克隆仓库后通常使用 `pip install -e packages/mcp-server`）。
2. 在 StudySolo 前端 **设置 → 开发者 / API Token** 创建 **Personal Access Token（PAT）**，前缀一般为 `sk_studysolo_`。明文仅在创建成功时返回一次。
3. 若连接自建后端，准备后端根地址（例如 `http://127.0.0.1:2038`）；否则使用你环境对应的线上 API 基址。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `STUDYSOLO_TOKEN` | PAT，必填（除非你的 Host 以其他方式注入等价配置）。 |
| `STUDYSOLO_API_BASE` | API 根 URL，默认随部署而定；自建时请指向实际 FastAPI 地址。 |

**安全**：不要把 PAT 粘贴到聊天、Issue 或仓库中；只放在 Host 配置文件或本机环境变量里。

## Claude Desktop 配置示例

编辑 macOS 上的 `~/Library/Application Support/Claude/claude_desktop_config.json`，或 Windows 上的 `%APPDATA%\Claude\claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "studysolo": {
      "command": "studysolo-mcp",
      "env": {
        "STUDYSOLO_API_BASE": "http://127.0.0.1:2038",
        "STUDYSOLO_TOKEN": "sk_studysolo_你的令牌"
      }
    }
  }
}
```

## Cursor 配置示例

在仓库或本机的 MCP 配置（例如 `.cursor/mcp.json`）中增加同名块，字段与上表一致：`command` 为 `studysolo-mcp`，`env` 中填写 `STUDYSOLO_API_BASE` 与 `STUDYSOLO_TOKEN`。

## 工具一览（与当前服务端实现一致）

下列 **18** 个工具在 `studysolo-mcp` 中注册（按用途分组）。失败时工具结果会带结构化错误对象（如 HTTP 状态码与 `message`），便于模型与用户排查。

### 账户与额度

| 工具 | 说明 |
| --- | --- |
| `get_me` | 当前账户基础信息（如邮箱、会员 tier）。 |
| `get_quota` | 工作流与执行相关配额。 |

### AI 使用数据

| 工具 | 说明 |
| --- | --- |
| `get_usage_overview` | 指定时间窗口内的调用总览。 |
| `get_usage_timeseries` | 按时间桶聚合的用量序列。 |
| `get_usage_live` | 最近一段时间的实时用量快照。 |

### 工作流清单与节点目录

| 工具 | 说明 |
| --- | --- |
| `list_workflows` | 工作流列表。 |
| `get_workflow` | 指定工作流内容/画布元信息（节点与边摘要，具体字段以后端为准）。 |
| `get_nodes_manifest` | 可配置的节点类型及字段说明（编辑画布前应先查阅）。 |

### 画布（真实节点与边）

以下工具操作的是持久化在 **`nodes_json` / `edges_json`** 中的 **真实 React Flow 实例**，而不是仅显示名称或标签：

| 工具 | 说明 |
| --- | --- |
| `create_workflow` | 创建空工作流，返回 `workflow_id` 等。 |
| `get_workflow_canvas` | 读取完整画布 JSON 与 `updated_at`（并发修改时用于 `base_updated_at`）。 |
| `get_workflow_node` | 读取单个节点及其入边/出边。 |
| `apply_workflow_canvas_patch` | 批量创建/更新/删除节点与边；复杂变更建议先 `dry_run=true`。 |
| `validate_workflow_canvas` | 校验当前画布或拟议操作（未知节点类型、断边、环等）。 |
| `get_node_config_options` | 读取某节点类型某配置字段的动态可选项（如知识库列表）。 |

**重要语义**：

- `node_type` 来自 `get_nodes_manifest`，表示可执行节点类型；**`label` 仅为展示文案**，不能代替节点实例。
- 复杂编辑请 **先 `dry_run=true` 预览，再 `dry_run=false` 提交**；非 ASCII 的文案与 JSON 配置按 UTF-8 传递。

### 运行（Run API v2）

| 工具 | 说明 |
| --- | --- |
| `start_workflow_run` | 异步启动一次运行，返回 `run_id`。 |
| `get_run_progress` | 聚合进度（阶段、完成度等）。 |
| `get_run_events` | 节点级事件增量；轮询时应使用返回的 **`next_seq` 作为 `after_seq`**，直到 `is_terminal`。 |
| `run_workflow_and_wait` | 组合「启动 + 轮询/流式等待 + 终态」的端到端工具；`mode` 可选 `stream`（高频事件）与 `poll`（按间隔看进度）。 |

> **stdio 与「流式」**：MCP stdio 本身不是浏览器 SSE；`mode="stream"` 在实现上通过短间隔轮询 `/events` **模拟**流式输出。浏览器内仍可使用既有 SSE 执行接口。

## 典型调用顺序

**仅查询「我是谁、还剩多少额度」**  
`get_me` → `get_quota`。

**列出并确认工作流后执行**  
`list_workflows` → `get_workflow`（确认触发与输入）→ `run_workflow_and_wait` 或 `start_workflow_run` + 自行轮询 `get_run_progress` / `get_run_events`。

**用 MCP 改画布**  
`get_nodes_manifest` →（若无 id）`create_workflow` → `get_workflow_canvas` → `apply_workflow_canvas_patch`（先 dry run）→ 再读 `get_workflow_canvas` 确认 → 需要时再 `run_workflow_and_wait`。

## 错误与排查

| 现象 | 建议 |
| --- | --- |
| `401` / 认证失败 | 检查 PAT 是否过期、是否在前端被撤销；更新 Host 配置中的 `STUDYSOLO_TOKEN`。 |
| `403` 与模型/会员相关文案 | 工作流中某节点模型超出当前会员等级，需升级或更换模型。 |
| `429` | 触发频率或日配额限制，稍后重试或调整用量。 |
| 事件重复或遗漏 | 确认 `get_run_events` 始终传入上次响应的 `after_seq`。 |

更完整的 PAT 生命周期、Run API 路径与安全边界见仓库内《MCP 与 CLI 功能流程》与《API 规范》文档；本页面向 Wiki 读者保持与当前 `studysolo-mcp` 实现一致。
