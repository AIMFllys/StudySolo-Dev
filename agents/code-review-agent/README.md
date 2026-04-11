# Code Review Agent

> 状态：🔨 规则型本地审查 Agent 已落地（含 repo-aware 前置输入、forwarding governance 与 utilization hints）
> 负责人：小李
> 端口：8001
> 来源：新建

---

## 用途

自动化代码审查 Agent。当前版本已经具备 Phase 4B 所需的最小 OpenAI-compatible 协议、规则型本地审查能力，以及单条 `user` 消息内的结构化 repo context 前置输入、forwarding governance 与 repo-aware utilization hints 能力。

## 当前能力

- `GET /health`
- `GET /health/ready`
- `GET /v1/models`
- `POST /v1/chat/completions`
- non-stream JSON 响应
- SSE stream 响应
- API Key 校验
- 输入识别：`unified_diff / code_snippet / plain_text`
- 7 条固定规则：硬编码密钥、危险动态执行、危险 HTML sink、Shell 命令执行、关闭 TLS 校验、调试遗留、宽泛吞错
- 多文件 unified diff 感知：文件路径、目标新增行号、同规则同文件去重
- 结构化 repo-aware 前置输入：
  - `<review_target path="...">...</review_target>`
  - `<repo_context path="...">...</repo_context>`
  - 仍只对 `review_target` 出 findings；`repo_context` 在 live upstream 路径下只作为经过治理后的辅助上下文
  - forwarded context 会做路径归一化、去重、关系排序与预算裁剪，并在超限时追加 `... [truncated]`
- repo-aware utilization hints：
  - upstream system prompt 会明确 findings 只能针对 `review_target`
  - upstream user prompt 会显式带上 `review scope hint`
  - 每个 forwarded context 会补入 `shared identifiers`、`usage priority`
  - 既有的 `relationship / truncated` 提示继续保留

## 运行

```bash
cd agents/code-review-agent
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -m src.main
```

## 验证

```bash
pytest tests -q
```

## 结构化输入示例

````text
<review_target path="frontend/app.tsx">
```tsx
console.log('debug');
```
</review_target>

<repo_context path="frontend/lib/logger.ts">
```ts
export function debugLog(message: string) {
  return console.log(message);
}
```
</repo_context>
````

说明：

- 继续只读取最后一条 `user` 消息
- 若不存在 `<review_target>`，会回退到 legacy 行为：整条 `user` 消息都作为 review target
- `repo_context` 不单独产生 findings
- `heuristic` 仍只审查 `review_target`
- live upstream 路径下，`repo_context` 会先做 forwarded context 治理，再进入上游 prompt

## Review Backend

当前内部 review backend 已拆出明确 seam：

- `heuristic`
  - 默认后端
  - 直接执行本地规则审查
- `upstream_reserved`
  - 预留给后续真实外部 LLM 接入
  - 当前只构建 upstream request payload，然后立即回退到 `heuristic`
  - 本轮不会发真实网络请求，也不会改变对外 HTTP 契约
- `upstream_openai_compatible`
  - 真实 OpenAI-compatible 上游调用
  - 仅在 `AGENT_UPSTREAM_MODEL / BASE_URL / API_KEY` 完整时才尝试调用
  - `stream=False` 时走真实 non-stream 上游调用
  - `stream=True` 时走真实 provider stream，但会先在服务端完整消费并校验 JSON findings，再向客户端发出内容 chunk
  - 配置缺失、超时、HTTP 异常、空内容或 JSON / findings 不合规都会严格回退到 `heuristic`
  - 上游成功后只消费内部 JSON findings，并归一化回当前稳定文本模板
  - 上游 prompt 中的 `repo_context` 会先经过 forwarding governance：归一化路径、丢弃与 `review_target` 重复的 context、按 `same_dir / same_top_level / same_extension / other` 排序，并按 `4` 文件 / 单文件 `80` 行 / 总计 `200` 行预算裁剪
  - 在 forward 之后，upstream prompt 还会进一步补入 `review scope hint`、逐 context 的 `shared identifiers`、`usage priority`，并继续保留 `relationship / truncated`

当前预留配置项均沿用 `AGENT_` 前缀环境变量：

- `AGENT_REVIEW_BACKEND`
- `AGENT_UPSTREAM_MODEL`
- `AGENT_UPSTREAM_BASE_URL`
- `AGENT_UPSTREAM_API_KEY`
- `AGENT_UPSTREAM_TIMEOUT_SECONDS`

## 输出格式

当前 assistant 内容保持为纯文本三段式：

1. `Summary`
   - 固定字段顺序：
     - `- Input type: ...`
     - `- Files reviewed: N`
     - `- Reviewed lines: N`
     - `- Context files supplied: N`
     - `- Findings found: N`
   - 如果结构化输入里提供了 `review_target path`，会额外输出：
     - `- Review target path: ...`
2. `Findings`
   - 有命中时，每条 finding 固定输出：
     - `1. Title: ...`
     - `   Rule ID: ...`
     - `   Severity: ...`
     - `   File: ...`
     - `   Evidence: ...`
     - `   Fix: ...`
   - 无命中时，固定输出：
     - `- None`
     - `  Note: No deterministic findings...`
3. `Limitations`
   - 继续说明启发式边界、repo context 的作用范围，以及 clean result 不等于安全

补充说明：
- `repo_context` 不会单独产出 findings；但在 live upstream 路径下，会以治理后的 forwarded context 形式进入上游 prompt。
- forwarded context 会显式标记 `relationship` 与 `truncated` 状态，并补入 `shared identifiers` 与 `usage priority`，帮助上游更稳定利用上下文，而不是无上限原样透传。
- live upstream findings 现在还会做最小 evidence anchoring 治理：只有当 `evidence` 能被 `review_target` 的目标文本真实支撑时，finding 才会被保留。
- live upstream findings 对已知 `rule_id` 还会做 metadata canonicalization：`title / severity / fix` 会收口到本地规则表，不再直接信任上游漂移文案。
- findings 排序已固定为：`severity -> file_path -> line_number -> position -> rule_id`。
- 没有文件路径时，`File:` 行固定输出 `<none>`，避免模板分支漂移。
- 即使成功走 `upstream_openai_compatible`，最终返回给客户端的仍是同一套稳定纯文本模板。
- 即使 `stream=True` 且成功走 live provider stream，客户端看到的也仍是同一套 SSE 外壳；只是首个 content chunk 会等到服务端完成本地校验与归一化。

## 说明

- 当前 `src/core/agent.py` 已可选接入外部 OpenAI-compatible 上游，但默认仍是本地启发式规则审查
- 当前 `stream=True + upstream_openai_compatible` 已接通真实 provider streaming，但继续采用“稳定模板优先”的本地归一化策略
- 当前不读取本地仓库文件；repo context 仍必须由调用方显式放进最后一条 `user` 消息，并只会以治理后的 forwarded context 形式进入上游
- 当前 upstream prompt 已显式具备 `review scope hint`、`shared identifiers`、`usage priority`，用于约束和提升 repo-aware 利用质量
- 当前 live upstream findings 还会校验 `evidence` 是否能锚定到 `review_target`；不能被目标文本支撑的 finding 会被治理丢弃，并在全丢弃时继续严格回退到 `heuristic`
- 当前 live upstream findings 若命中本地已知 `rule_id`，其 `title / severity / fix` 会强制收口到本地 `RuleSpec`；unknown rule 才继续保留上游元数据
- 输出保持 `Summary + Findings + Limitations`
- 后续如果接真实仓库分析或上游 LLM，仍以 `src/core/agent.py` 为主扩展点

## 当前测试基线

- `pytest tests -q`
- 最新真实结果：`75 passed`

## 参考

- [Agent 开发指南](../README.md)
- [接口协议规范](../../docs/team/refactor/final-plan/agent-architecture.md)
