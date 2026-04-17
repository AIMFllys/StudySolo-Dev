# AI Agent Loop P1 与消息渲染统一摘要

**日期**：2026-04-17  
**完成状态**：已完成  
**相关更新**：`docs/Updates/2026-04-17-ai-agent-loop-p1-and-wiki.md`

---

## 一句话总结

本轮把 StudySolo 侧栏 AI 从“能跑 Agent”推进到“默认轻、需要时才启用工具、消息渲染一致、reasoning 不污染历史”的状态，并同步补齐开发者 Token / MCP 入口与 API Wiki 文档。

---

## 关键成果

### 1. 普通聊天默认轻量

- 前端默认 `thinkingDepth` 改为 `fast`。
- 默认模型选择优先挑可访问、非 thinking 的聊天模型。
- 后端只有 `thinking_level === "deep"` 且未显式选择 SKU 时才强制 DeepSeek R1。
- 没有显式 SKU 的非 deep 聊天，优先走非 thinking `chat_response` 模型。

结果：普通聊天不再默认触发 R1，首 token 和输出长度更接近普通助手体验。

### 2. Agent Loop 不再劫持所有 chat

Agent Loop 启用边界收紧：

- `plan` / `create` 固定启用。
- 有 `canvas_context` 的 chat 启用。
- 命中工作流、画布、节点、连线、运行、状态、打开、重命名、新增、修改、删除、列出等关键词的 chat 启用。
- 无画布、无工具意图的纯闲聊走 legacy lightweight stream。

结果：工具 schema 和 XML 协议 prompt 只在真正需要工具能力时加载。

### 3. Reasoning 历史污染被清理

- `llm/caller.py` 继续把 `<think>...</think>` 流给前端，用于 ThinkingCard。
- reasoning 文本和 wrapper 不再进入 `LLMStreamResult.content`。
- `agent_loop.py` 在把 assistant 输出写回多轮 messages 前，二次剥离 `<think>` / `<thinking>` / `<reasoning>` 块。

结果：多轮 ReAct 上下文不再被 R1 reasoning 滚雪球式放大，同时保留前端可见的思考折叠体验。

### 4. Selected SKU reasoning 语义收口

- 后端 `AIChatRequest.thinking_level` 默认改为 `fast`。
- no SKU + `deep` 仍会自动使用 DeepSeek R1。
- selected thinking SKU + `deep` 会直调该 SKU，不切默认 R1。
- selected non-thinking SKU + `deep` 后端降级为 `balanced`，前端发送前降为 `fast`。
- prompt 文案不再要求输出完整推理链或长思考过程。

结果：用户显式选模型时选择权保持稳定，非 reasoning 模型不会收到 deep CoT 指令，也不会被隐藏切到 R1。

### 5. AIMessage 渲染统一

新增 `chat-message-adapter.ts`，把两类输入收敛为统一 render model：

- legacy `content`
- agent `segments`

统一后的外壳负责：

- StudySolo AI header
- streaming loading
- `PlanCard`
- `AgentSegments`
- `[SUGGEST_MODE]` chip
- `summary` 渲染入口

结果：普通聊天、R1 thinking、Agent ToolCall、PlanCard、Summary 和建议模式 chip 不再像两套产品。

### 6. 画布 Agent 兼容性继续补齐

- 未知节点类型兜底到可渲染类型。
- `UPDATE_NODE` 只合并白名单字段，避免整节点覆盖。
- Plan 执行中 label anchor 可反查 node id。

结果：降低“节点变文字块”“UPDATE 误覆盖”“PlanCard 用 label 当 node id”等旧问题复发概率。

### 7. 开发者入口与 Wiki 同步

- 侧栏 WalletPanel 中加入开发者 Token 管理与 MCP 配置示例。
- `DeveloperTokens` 支持 `compact` 模式，适配窄侧栏。
- Wiki 新增 API 参考分组：CLI、MCP Host、Agent Skills。
- Wiki 导航从 emoji 改为 Lucide 图标，页面结构更稳定。

### 8. 稳定性收尾

- workflow sync 失败时不再提前写入 cloud hash，后续仍会重试云端保存。
- 卸载阶段 keepalive fetch 失败会被吞掉，避免 `Failed to fetch` 未处理噪音。
- `/api/debug/log` 使用 cwd 无关日志路径，并支持 `STUDYSOLO_DEBUG_LOG_PATH` 本地覆盖。
- Agent SSE parser 在 `[DONE]` 前会 flush 最后一批 segment / summary 快照。

结果：已知控制台噪音被收口，Agent 工具事件和 summary 渲染有更稳定的回归护栏。

---

## 验证重点

后端：

- 纯闲聊不走 Agent Loop。
- `plan/create`、画布上下文和工具关键词 chat 走 Agent Loop。
- reasoning 可流式展示，但不进入结果 content。
- Agent history append 前会剥离 reasoning，保留 answer/tool/summary XML。
- no SKU / thinking SKU / non-thinking SKU 的 effective thinking 语义都有测试。
- Agent 工具注册表确认 12 个工具完整存在。
- debug log 拒绝错误 session、能写入并读回中文日志、能拒绝超大 payload。

前端：

- 默认聊天状态为 `fast`。
- 默认模型选择优先非 thinking 模型。
- 非 thinking 模型发送前会把 thinking depth 归一到 `fast`。
- legacy content 与 segments 都能提取 `[SUGGEST_MODE]`。
- Agent SSE parser 覆盖 answer 增量、tool_call ok/error、summary changes、canvas_mutation 透传。
- workflow sync helper 覆盖 offline/error 分类、cloud hash 判断、keepalive failure 吞吐。
- 中文样例“工作流 / 节点 / 本轮变更”在 adapter 测试中保持原样。

---

## 已落地提交

- `a84adbe feat: add AI agent loop backend`
- `2c420fe feat: unify AI chat streaming UI`
- `8f51153 feat: surface developer token setup`
- `80fdfeb feat: add API wiki documentation`
- `2bc9bdc test: tighten frontend type coverage`
- `54691c7 fix: align AI thinking capability routing`
- `20fcc3e fix: stabilize workflow sync and debug logging`
- `d0290ae fix: flush final agent stream snapshots`

---

## 后续建议

1. 补一轮 Agent 工具手工回归：工作流列表、打开、重命名、画布 CRUD、后台运行、状态查询。
2. 为 API Wiki 增加错误码、截图和最小可运行示例。
3. MCP / CLI 下一阶段推进 HTTP / SSE transport、细粒度 scopes、run pause / resume / cancel。
4. 若保存失败仍复现，再按具体 HTTP 状态继续查工作流更新接口或会话恢复链路。
