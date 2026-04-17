# 2026-04-17 更新日志（AI Agent Loop P1 · 消息渲染统一 · API Wiki）

## 1. 背景

本轮工作围绕 StudySolo 侧栏 AI 对话体验做 P1 级稳定化：让普通聊天默认更轻、让 Agent 工具模式只在需要时启用、清理 R1 reasoning 对多轮上下文的污染，并把新旧 AI 消息渲染路径统一到同一套外壳中。同时补齐 API / CLI / MCP Wiki 文档入口，并在侧栏露出开发者 Token 与 MCP 配置示例。

本轮重点不是新增数据库能力，而是把前一阶段 Agent Loop 的可用性、延迟、上下文卫生和前端一致性收口。

## 2. 后端

| 模块 | 变更 |
| --- | --- |
| `backend/app/api/ai/chat.py` | 增加 agent loop 启用启发式：`plan/create` 固定走 Agent；普通 `chat` 仅在有画布上下文或命中工作流 / 工具关键词时走 Agent；纯闲聊回落轻量流。 |
| `backend/app/services/llm/router.py` | 增加轻量 `chat_response` 路由选择，优先选择已配置且不支持 thinking 的聊天模型。 |
| `backend/app/services/llm/caller.py` | R1 reasoning 仍流式输出给前端，但不再写入 `LLMStreamResult.content`，避免历史上下文膨胀。 |
| `backend/app/services/ai_chat/agent_loop.py` | 多轮 Agent history append 前剥离 `<think>` / `<thinking>` / `<reasoning>` reasoning 块，保留 `<answer>`、`<tool_use>`、`<summary>` 等可见协议内容。 |
| `backend/app/services/ai_chat/thinking.py` | 新增 selected SKU 与 thinking depth 的统一语义 helper。 |
| `backend/app/services/ai_chat/xml_stream_parser.py` | 维持 `<think>` / `<reasoning>` 到 `<thinking>` 的别名兼容，继续支撑 R1 reasoning 折叠渲染。 |
| `backend/app/prompts/prompt_loader.py` | 收口 `balanced/deep` 文案，不再要求模型展示完整推理链或长思考过程。 |

### Agent Loop 启用边界

保留以下绕过规则：

- `AGENT_LOOP_DISABLED=1` 时禁用。
- `BUILD` / `ACTION` / `LEGACY` 等既有分支继续回退旧链路。
- `mode=plan`、`mode=create` 必走 Agent Loop。

普通聊天仅在以下情况启用 Agent Loop：

- 请求里存在 `canvas_context`。
- 用户文本明确涉及工作流或工具行为，例如：`workflow`、`工作流`、`canvas`、`画布`、`node`、`节点`、`edge`、`连线`、`run`、`运行`、`执行`、`status`、`状态`、`open`、`打开`、`rename`、`重命名`、`add`、`新增`、`添加`、`update`、`修改`、`delete`、`删除`、`list`、`列出`。

这样普通“你是谁 / 帮我解释一下”类对话不再被大 prompt 和工具 schema 拖慢。

### Selected SKU 与 thinking depth 收口

P1-E 已落地，规则如下：

- `AIChatRequest.thinking_level` 后端默认值改为 `fast`，与前端默认一致。
- 未显式选择 SKU 时，只有 `deep` 会强制使用 DeepSeek R1；`fast/balanced` 走轻量 `chat_response` 路由。
- 显式选择支持 thinking 的 SKU 时，保留用户选择的 `fast/balanced/deep`，并直调该 SKU。
- 显式选择不支持 thinking 的 SKU 时，显式选择仍优先，不切到 R1；后端把 `deep` 降级为 `balanced`，前端发送前统一降为 `fast`。
- 所有 SSE JSON 继续使用 `ensure_ascii=False`，中文不会被转义。

## 3. 前端 AI 对话

| 模块 | 变更 |
| --- | --- |
| `frontend/src/stores/chat/use-conversation-store.ts` | `thinkingDepth` 默认改为 `fast`，保留 `segments` / `summary` / `isStreaming` 字段。 |
| `frontend/src/features/workflow/hooks/use-stream-chat.ts` | 发送请求时默认轻量思考深度；继续接收 `segment_*`、`tool_call`、`tool_result`、`canvas_mutation`、`ui_effect` 等 Agent SSE 事件。 |
| `frontend/src/services/ai-catalog.service.ts` | 默认模型选择优先取可访问、非 thinking 的聊天模型；新增发送前 effective thinking depth helper。 |
| `frontend/src/components/layout/sidebar/chat-message-adapter.ts` | 新增纯适配层，把 legacy `content` 和 agent `segments` 统一成 render model，并集中处理 `[SUGGEST_MODE:xxx]`。 |
| `frontend/src/components/layout/sidebar/AIMessage.tsx` | 重构为单一 AI 消息外壳：统一 header、loading、PlanCard、AgentSegments 和建议模式 chip。 |
| `frontend/src/components/layout/sidebar/agent-segments/AnswerSegment.tsx` | Markdown 渲染前统一清理 suggest marker，避免标记泄漏到正文。 |
| `frontend/src/components/layout/sidebar/agent-segments/AgentSegments.tsx` | 保留 P0 的 `<think>` rescue，继续把误入 answer 的 reasoning 折回 ThinkingCard。 |
| `frontend/src/components/layout/sidebar/PlanCard.tsx` | 保持流式 plan 渲染兼容，接入统一外壳。 |

### 渲染统一后的行为

- 只有 legacy `content` 的历史消息，会即时适配为 `thinking + answer` segments。
- 有结构化 `segments` 的 Agent 消息，继续直接渲染 ToolCall / Summary / Answer。
- `<plan>...</plan>` 内容统一交给 `PlanCard`。
- `[SUGGEST_MODE:plan]` / `[SUGGEST_MODE:create]` 在 legacy 和 segments 两条数据源中都能被提取成外壳层 chip。
- 空内容且 streaming 时统一显示 `MagicWandLoader + 正在思考…`。

## 4. 画布与节点兼容

| 模块 | 变更 |
| --- | --- |
| `frontend/src/features/workflow/components/canvas/canvas-constants.ts` | 为未知节点类型增加 `default / text / note / markdown` 兜底，避免 Agent 新增节点时“节点变文字块”。 |
| `frontend/src/features/workflow/hooks/use-action-executor.ts` | `UPDATE_NODE` 改为白名单字段合并，与后端工具保持一致。 |
| `frontend/src/features/workflow/utils/plan-executor.ts` | 增加 label 到 node id 的锚点反查，修复 PlanCard 用 label 当 node id 的旧问题。 |
| `frontend/src/features/workflow/components/nodes/NodeResultSlipBody.tsx` | 收口 renderer props 类型，减少节点结果渲染类型漂移。 |

## 5. 开发者 Token 与 MCP 入口

| 模块 | 变更 |
| --- | --- |
| `frontend/src/components/layout/sidebar/SettingsPanel.tsx` | 在设置侧栏增加「开发者 / API Token」入口。 |
| `frontend/src/components/layout/sidebar/WalletPanel.tsx` | 集成 Token 管理组件，并展示 Cursor / Claude Desktop 可复制的 MCP 配置示例。 |
| `frontend/src/features/settings/components/DeveloperTokens.tsx` | 增加 `compact` 模式，适配侧栏窄容器。 |
| `.agent/skills/studysolo-mcp/SKILL.md` | 同步 MCP 工具数量与最新工具范围。 |
| `packages/mcp-server/README.md` | 同步 MCP Server 当前工具数量说明。 |

## 6. Wiki / 文档中心

新增 API 文档：

- `docs/wiki-content/api/_meta.json`
- `docs/wiki-content/api/cli.md`
- `docs/wiki-content/api/mcp-host.md`
- `docs/wiki-content/api/agent-skills.md`

前端文档中心同步调整：

- `frontend/src/app/(wiki)/wiki/page.tsx`
- `frontend/src/app/(wiki)/wiki/[...slug]/page.tsx`
- `frontend/src/components/wiki/WikiSidebarClient.tsx`
- `frontend/src/components/wiki/WikiBreadcrumb.tsx`
- `frontend/src/components/wiki/WikiPagination.tsx`
- `frontend/src/lib/wiki-nav-icons.tsx`
- `frontend/src/styles/wiki/*.css`

主要变化：

- 文档中心新增「API 参考」分组。
- 用 Lucide 图标替换 emoji 导航，保证视觉风格更稳定。
- Wiki 首页、侧边栏、分页和正文样式做了 API 文档适配。

## 7. 测试与回归

已覆盖或新增的测试重点：

- `_agent_loop_enabled`：纯闲聊不走 Agent；plan/create、画布上下文、工作流 / 工具关键词走 Agent。
- R1 reasoning：可以继续流给 UI，但不进入 `LLMStreamResult.content`。
- Agent history：append 前剥离 reasoning 块，保留 answer/tool/summary XML。
- XML parser：`<think>` / `<thinking>` 别名场景继续通过。
- `chat-message-adapter`：legacy content、segments、plan、中文样例和 `[SUGGEST_MODE]` 解析。
- `ai-catalog.service`：默认模型优先选择非 thinking 聊天模型。
- selected SKU thinking：no SKU deep 仍走 R1；thinking SKU 保留 deep；非 thinking SKU 不触发 R1。
- Agent 工具注册表：确认 12 个工具仍完整注册。
- workflow sync：云端保存失败不再误标记已同步，卸载 keepalive 失败会静默吞掉并保留本地 dirty。
- debug log：`/api/debug/log` 使用 cwd 无关路径，支持 `STUDYSOLO_DEBUG_LOG_PATH` 覆盖，并保留中文日志。
- Agent SSE：`[DONE]` 到达前会 flush 最后一批 segment / summary 快照，tool_call 状态和 canvas_mutation 事件有纯测试覆盖。
- 前端测试类型收紧：`fetch` mock、`ApiError` 匹配、workflow event status、renderer props。

回归命令：

```bash
cd backend
python -m pytest -k "agent or xml or chat"
```

```bash
cd frontend
npx vitest run src/__tests__/chat-message-adapter.property.test.ts src/__tests__/ai-chat-store.property.test.ts src/__tests__/ai-catalog.service.property.test.ts
npx vitest run src/__tests__/stream-chat-sse.property.test.ts src/__tests__/workflow-sync.property.test.ts
npx tsc --noEmit
```

## 8. 已提交批次

- `a84adbe feat: add AI agent loop backend`
- `2c420fe feat: unify AI chat streaming UI`
- `8f51153 feat: surface developer token setup`
- `80fdfeb feat: add API wiki documentation`
- `2bc9bdc test: tighten frontend type coverage`
- `54691c7 fix: align AI thinking capability routing`
- `20fcc3e fix: stabilize workflow sync and debug logging`
- `d0290ae fix: flush final agent stream snapshots`

## 9. 下一步

- Agent Loop 工具调用手工回归：列工作流、打开工作流、重命名、画布增删改、后台运行状态查询。
- MCP / CLI 下一阶段：HTTP / SSE transport、细粒度 scopes、run pause / resume / cancel。
- Wiki 文档继续补齐真实截图、错误码说明和常见问题。
- 若仍出现保存失败，需要结合具体 HTTP 状态继续查后端工作流更新链路；当前批次已清理前端未处理 rejection 和 debug log 路径 500。
