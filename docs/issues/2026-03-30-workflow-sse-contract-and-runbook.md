<!-- 编码：UTF-8 -->

# 工作流 SSE 契约与排障手册

## 目标

- 本地 `next dev --turbopack` 与生产 Nginx 的工作流流式行为保持一致。
- 全链路保持 UTF-8，不把中文事件内容回退为 `\uXXXX`。
- 并行层、循环层、长任务阶段都必须持续可感知，不能整段沉默到最后一次性返回。

## 前端入口规则

- 浏览器必须访问 `/api/workflow/{workflowId}/execute`。
- 本地开发禁止依赖 `next.config.ts` 的 `rewrites()` 透传工作流 SSE。
- 工作流与 AI Chat 都通过 App Router route handler 走共享 SSE 代理，绕过 Turbopack dev proxy 的缓冲问题。

## 工作流 SSE 事件

保留事件：

- `node_status`
- `node_input`
- `node_token`
- `node_done`
- `loop_iteration`
- `workflow_done`
- `save_error`

新增事件：

- `workflow_status`
- `node_progress`
- `heartbeat`

节点事件可选元数据：

- `parallel_group_id`
- `loop_group_id`
- `iteration`
- `sequence`
- `phase`

## 行为约束

- 连接建立后必须先发 `workflow_status`，不能等数据库预检、tier 校验、usage 初始化全部结束后才出现首包。
- 心跳固定 5 秒，任何长静默阶段都要持续保活。
- 并行层必须按事件到达顺序交错向前端透传，不能 `gather()` 完整层结果后再统一回放。
- 循环层必须保留 `loop_iteration`，并透传组内子节点事件。
- `node_progress` 只用于状态展示，不写入最终节点 output。
- `workflow_done` 必须是每次执行的终态事件。节点执行失败时，`workflow_done.status` 必须为 `error`。

## Nginx 要求

`/api/` 代理必须满足：

- `proxy_buffering off`
- `proxy_cache off`
- `proxy_http_version 1.1`
- `proxy_set_header Accept-Encoding ""`
- `gzip off`

如果线上还有 CDN、网关或面板扩展代理，同样必须继承这些规则，否则无法保证真正流式。

## 排障清单

出现“本地 pending 很久后一次性刷出”时，优先检查：

1. 请求是否绕过了 App Router workflow SSE 代理，错误落回了 `rewrites()`。
2. 浏览器 Network 里响应头是否还是 `text/event-stream`。
3. Nginx 或上游代理是否重新开启了 buffering / gzip。
4. 后端是否持续发出了 `workflow_status`、`node_progress` 或 `heartbeat`。
5. 前端是否收到 `workflow_done`，还是连接在无终态下提前关闭。

出现“中文乱码”时，优先检查：

1. 后端 SSE JSON 是否仍然 `ensure_ascii=False`。
2. 前端是否仍然使用 `TextDecoder('utf-8')` 且开启 `stream: true`。
3. 乱码是否只是终端码页显示异常，而不是浏览器实际渲染异常。
