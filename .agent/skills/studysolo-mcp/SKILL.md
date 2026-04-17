---
name: studysolo-mcp
description: StudySolo 官方 MCP Server（studysolo-mcp）的使用指南。当 AI 需要在 Claude Desktop / Cursor / Claude Code 等 MCP Host 中，通过结构化工具查询 StudySolo 账户、AI 使用数据、工作流元信息，或触发并等待工作流执行时，必须参考此技能。
triggers:
  - "studysolo-mcp"
  - "StudySolo MCP"
  - "MCP 调用 StudySolo"
  - "用 MCP.*工作流"
  - "Claude Desktop.*StudySolo"
  - "Cursor.*StudySolo.*工具"
allowed-tools: Read
version: 1.0
priority: HIGH
---

# studysolo-mcp — StudySolo MCP Server 使用技能

## 1. 技能目标

告诉 AI：在任意 MCP Host 内，如何通过 `studysolo-mcp` 安全、正确地使用 11 个工具，覆盖四类用户意图：

1. **账户 / 会员 / 额度** — 「我是谁」「我是什么会员」「我还能跑几次」
2. **AI 使用数据** — 「最近用量」「每天调用量」「实时有没有在跑」
3. **工作流清单与元信息** — 「我有哪些工作流」「这张图里有哪些节点」
4. **启动 / 监控工作流** — 「跑一下 xxx 工作流」「这个 run 现在到哪一步了」

## 2. 必读物

| 顺序 | 路径 | 为什么必读 |
| --- | --- | --- |
| 1 | `packages/mcp-server/README.md` | Claude Desktop / Cursor 配置示例 + 工具清单 |
| 2 | `docs/项目规范与框架流程/功能流程/MCP与CLI/README.md` | MCP / CLI 总览、PAT 流程、安全边界 |
| 3 | `docs/项目规范与框架流程/项目规范/04-API规范.md` | PAT 认证与 Run API v2 权威定义 |

## 3. 工具选择决策树

```text
用户意图
 ├─ 问「我是谁/会员/额度」────── get_me + get_quota
 ├─ 问「最近用量/趋势/实时」──── get_usage_overview / timeseries / live
 ├─ 问「有哪些工作流/节点配置」── list_workflows → get_workflow → get_nodes_manifest
 └─ 想要「跑一下工作流」
      ├─ 只需触发，马上返回 ─── start_workflow_run（拿 run_id）
      ├─ 想要实时节点事件 ──── run_workflow_and_wait(mode="stream")
      ├─ 想要定时聚合进度 ──── run_workflow_and_wait(mode="poll", poll_interval_s=N)
      └─ 需要自行观察 ─────── 手动循环 get_run_progress / get_run_events
```

## 4. 关键约束（MUST / MUST NOT）

- **MUST**：所有工具调用都会走 PAT 认证。若后端返回 `HTTP_401`，说明 `STUDYSOLO_TOKEN` 没配或已撤销，必须提示用户在前端「设置 / 开发者 / API Token」重新生成。
- **MUST**：调用 `start_workflow_run` 或 `run_workflow_and_wait` 前，先用 `get_workflow` 或 `list_workflows` 确认工作流确实存在、`trigger_input` 节点配置合理。
- **MUST**：`get_run_events` 必须传递上一次返回的 `next_seq` 作为 `after_seq`，直到 `is_terminal=true`，否则会重复读取全量事件或漏事件。
- **MUST NOT**：不要把 PAT 明文写进用户可见的回复里，也不要当作工具参数传来传去 —— 凭证只应存在于 MCP Host env。
- **MUST NOT**：不要对同一个工作流在同一秒内反复 `start_workflow_run`，后端有 rate-limit（429）。

## 5. 典型工具链示例

**例 1：用户问「帮我把『每日早报』工作流跑一下并告诉我结果」**

```text
1) list_workflows                                   // 找 id
2) get_workflow(workflow_id=…)                      // 确认 trigger_input 配置
3) run_workflow_and_wait(workflow_id=…, mode="stream", timeout_s=600)
4) 从返回的 workflow_done.payload 抽取最终输出给用户
```

**例 2：用户问「最近 7 天 AI 调用量怎么样？还剩多少额度？」**

```text
1) get_usage_overview(range="7d")
2) get_usage_timeseries(range="7d", source="all")
3) get_quota()
4) 用表格 / 文字综合呈现
```

## 6. 错误处理

工具失败时会返回 `{"error": {"code": "HTTP_XXX", "status": ..., "message": ...}}`：

- `HTTP_401` → 提示用户重新配置 PAT。
- `HTTP_403` + `MODEL_TIER_FORBIDDEN` → 告知用户某节点模型超出当前会员等级，建议升级或改模型。
- `HTTP_404` → 工作流 / run 不存在或不属于当前用户（PAT 只能访问自己的资源）。
- `HTTP_429` → 触发速率或每日配额限制，稍后再试。
- `HTTP_5xx` → 后端问题，提示用户稍后重试并保留 run_id。

## 7. 边界

- 本 MCP Server **只读 + 只触发 run**，不支持修改工作流、删除资源、管理员操作。
- 只有 **stdio transport**；HTTP / SSE 版在后续迭代。
- 目前 `scopes` 固定为 `["*"]`，无细粒度授权。
