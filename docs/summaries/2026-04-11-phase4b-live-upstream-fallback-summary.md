# 2026-04-11 Phase 4B：code-review-agent 真实 upstream non-stream 接入总结

## 1. 背景

在 `Phase 4B` 已经完成：

1. 最小可运行 agent 样板
2. 本地规则型 `code-review-agent`
3. repo-aware 前置输入
4. findings 纯文本模板稳定化
5. 外部 LLM 预留层

之后，最自然的下一步不再是继续只做内部占位，而是沿着已经建立的 seam，把真实上游调用接通第一段。

因此这一轮选择的闭环是：

- 接通 **真实 OpenAI-compatible non-stream 上游调用**
- 但继续保持：
  - 默认行为不变
  - 公共 HTTP 契约不变
  - Gateway 不介入
  - 失败时严格回退到 `heuristic`

## 2. 本轮目标

本轮目标是把 `code-review-agent` 从“可预留”推进到“可真实调用”，同时不让输出格式和对外契约漂移。

核心原则：

1. 默认还是本地 heuristics
2. 真实 live backend 必须显式 opt-in
3. 上游成功也不能把自由文本直接透给客户端
4. 失败路径必须稳定回退

## 3. 已完成的代码闭环

核心文件：

- `agents/code-review-agent/src/core/upstream_review.py`
- `agents/code-review-agent/src/core/agent.py`
- `agents/code-review-agent/src/config.py`
- `agents/code-review-agent/.env.example`
- `agents/code-review-agent/requirements.txt`

### 3.1 新增真实 live backend

`review_backend` 现在支持：

1. `heuristic`
2. `upstream_reserved`
3. `upstream_openai_compatible`

其中：

- `heuristic`：继续本地规则审查
- `upstream_reserved`：继续只建 request，不发真实请求
- `upstream_openai_compatible`：真实发起 non-stream 上游调用

### 3.2 真实 non-stream 上游调用已接通

`upstream_review.py` 现在通过 `AsyncOpenAI(base_url, api_key, timeout)` 发起真实 non-stream 调用。

调用前提：

- `upstream_model`
- `upstream_base_url`
- `upstream_api_key`

三者必须完整，否则不进入 live 路径，直接回退到 `heuristic`。

### 3.3 上游成功后不直接透传文本

这一轮没有让上游直接生成最终用户文本，而是要求上游返回内部专用 JSON：

```json
{
  "findings": [
    {
      "title": "string",
      "rule_id": "string",
      "severity": "high|medium|low",
      "file_path": "string|null",
      "line_number": "integer|null",
      "evidence": "string",
      "fix": "string"
    }
  ]
}
```

agent 只消费这些 findings，并把它们转换回本地 `ReviewFinding`，然后继续走现有：

1. findings 排序
2. no-findings 形态
3. `Summary + Findings + Limitations`

这保证了 live backend 成功后，输出模板仍然稳定。

### 3.4 严格回退已落地

以下情况现在都会直接回退到本地 heuristic：

1. 配置缺失
2. SDK/HTTP 异常
3. 超时
4. 空内容
5. 非法 JSON
6. finding 字段不合法

这意味着 live backend 是“增强路径”，不是“新的单点失败源”。

## 4. 测试与验证

核心测试文件：

- `agents/code-review-agent/tests/test_review_logic.py`
- `agents/code-review-agent/tests/test_contract.py`

本轮新增并锁定：

1. live backend 成功时会真实走上游调用并归一化输出
2. 配置缺失时不会创建上游 client
3. 非法 JSON 会回退
4. 非法 `severity` / `line_number` 会回退
5. 超时异常会回退
6. live backend 下 non-stream 接口仍保持当前 HTTP shape
7. live backend 下 `stream=True` 仍保持当前 SSE shape，内容来自最终归一化文本

验证结果：

- `pytest agents/code-review-agent/tests -q`
  - `46 passed`

## 5. 当前边界

本轮仍然没有进入以下范围：

1. 不做 provider streaming
2. 不改公共 API schema
3. 不透传上游 provider usage
4. 不暴露 provider model 到响应
5. 不接 Gateway
6. 不改 `/api/agents/*`

因此本轮后的正确口径是：

1. `code-review-agent` 已经具备真实 upstream non-stream 调用能力
2. 但对外仍是同一套稳定纯文本 contract
3. 默认仍是本地 heuristics
4. 下一轮最自然的深化方向，是 provider streaming 或更严格的 upstream output governance

## 6. 提交

- `26b92e3 feat(code-review-agent): add live upstream fallback`
