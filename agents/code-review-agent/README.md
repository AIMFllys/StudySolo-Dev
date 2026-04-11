# Code Review Agent

> 状态：🔨 规则型本地审查 Agent 已落地（含 repo-aware 前置输入能力）
> 负责人：小李
> 端口：8001
> 来源：新建

---

## 用途

自动化代码审查 Agent。当前版本已经具备 Phase 4B 所需的最小 OpenAI-compatible 协议、规则型本地审查能力，以及单条 `user` 消息内的结构化 repo context 前置输入能力。

## 当前能力

- `GET /health`
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
  - 仍只对 `review_target` 出 findings，`repo_context` 只做辅助上下文

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
- `repo_context` 不单独产生 findings，只用于补充上下文计数与后续 repo-aware 演进入口

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
  - 真实 non-stream OpenAI-compatible 上游调用
  - 仅在 `AGENT_UPSTREAM_MODEL / BASE_URL / API_KEY` 完整时才尝试调用
  - 配置缺失、超时、HTTP 异常、空内容或 JSON 不合规都会严格回退到 `heuristic`
  - 上游成功后只消费内部 JSON findings，并归一化回当前稳定文本模板

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
- `repo_context` 仍然只影响 `Summary` 中的上下文计数，不会单独产出 findings。
- findings 排序已固定为：`severity -> file_path -> line_number -> position -> rule_id`。
- 没有文件路径时，`File:` 行固定输出 `<none>`，避免模板分支漂移。
- 即使成功走 `upstream_openai_compatible`，最终返回给客户端的仍是同一套稳定纯文本模板。

## 说明

- 当前 `src/core/agent.py` 已可选接入外部 OpenAI-compatible 上游，但默认仍是本地启发式规则审查
- 当前不读取本地仓库文件；repo context 仍必须由调用方显式放进最后一条 `user` 消息
- 输出保持 `Summary + Findings + Limitations`
- 后续如果接真实仓库分析或上游 LLM，仍以 `src/core/agent.py` 为主扩展点

## 参考

- [Agent 开发指南](../README.md)
- [接口协议规范](../../docs/team/refactor/final-plan/agent-architecture.md)
