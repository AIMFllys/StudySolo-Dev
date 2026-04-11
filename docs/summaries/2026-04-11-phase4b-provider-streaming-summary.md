# 2026-04-11 Phase 4B Provider Streaming Summary

## 背景

在 `code-review-agent` 已经具备真实 upstream non-stream 调用与严格回退之后，`stream=True` 仍然只是“先拿最终文本，再按本地 SSE 外壳切块”。这意味着 live backend 虽然已经接通，但在流式请求下还没有真实使用 provider streaming。

## 本轮目标

本轮继续沿着既有 seam 深化，只做一个边界清晰的闭环：

1. 保持 `POST /v1/chat/completions` 协议不变
2. 保持当前 SSE shape 不变
3. 让 `upstream_openai_compatible` 在 `stream=True` 下真实走 provider stream
4. 继续坚持稳定模板优先与严格回退

## 已完成内容

核心代码路径：

- `agents/code-review-agent/src/core/upstream_review.py`
- `agents/code-review-agent/src/core/agent.py`
- `agents/code-review-agent/src/endpoints/completions.py`

本轮已落地：

1. 新增真实 provider stream 消费路径
   - 通过 `AsyncOpenAI(...).chat.completions.create(..., stream=True)` 读取上游流
   - 逐块收集 `choices[].delta.content`
2. 保持稳定模板优先
   - 服务端会先完整消费并校验上游 JSON findings
   - 只有确认能安全归一化后，才开始向客户端发 content chunk
3. 对外 SSE 协议保持不变
   - 继续输出 role chunk、content chunk、stop chunk 和 `[DONE]`
4. 严格回退继续有效
   - 配置缺失、超时、上游异常、空内容、非法 JSON、非法 findings
   - 都会在首个 content chunk 前回退到本地 `heuristic`
5. non-stream 路径保持不变
   - `stream=False` 下仍继续走上一轮已落地的 live non-stream 调用

## 测试与结果

本轮重点测试文件：

- `agents/code-review-agent/tests/test_review_logic.py`
- `agents/code-review-agent/tests/test_contract.py`

本轮新增并锁定：

1. `stream=True + upstream_openai_compatible` 会真实以 `stream=True` 调用上游 provider
2. live stream 成功时，最终文本与 live non-stream 保持一致
3. stream 中途异常会在首个 content chunk 前回退到 `heuristic`
4. stream 非法 JSON 会严格回退
5. SSE shape 继续保持当前契约

已验证：

- `pytest agents/code-review-agent/tests -q`
  - 结果：`49 passed`

## 当前边界

本轮仍未进入：

1. 公共 API schema 变更
2. provider usage 透传
3. provider model 暴露
4. 本地仓库读取
5. 完整 repo-aware 推理
6. Gateway / `agents.yaml` / `/api/agents/*`

## 提交

- `2aec440 feat(code-review-agent): stream live upstream reviews`
