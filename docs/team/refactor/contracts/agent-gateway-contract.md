# Agent Gateway 契约（冻结契约）

> 版本：v1.0 | 冻结日期：2026-04-10
> 状态：🔒 已冻结 — 修改需三人 Sync + 版本号升级
> 关联 Phase：Phase 1 Task 1.5
> 实现计划：Phase 4B + Phase 5
> 协议详细参考：[agent-architecture.md](../final-plan/agent-architecture.md)

---

## 概述

本契约定义 **主后端 AgentGateway** 与 **子后端 Agent** 之间的标准通信协议。采用 **OpenAI Chat Completions API 兼容格式**，确保所有 Agent 使用统一接口对接。

---

## 1. 子后端必须实现的端点

### 1.1 健康检查

```
GET /health
```

```json
{
  "status": "ok",
  "agent": "code-review",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "models": ["code-review-v1"]
}
```

### 1.2 就绪检查

```
GET /health/ready
```

```json
{
  "ready": true
}
```

> Gateway 在转发请求前会先调用 `/health/ready`，返回 `false` 时不转发。

### 1.3 模型列表

```
GET /v1/models
```

```json
{
  "object": "list",
  "data": [
    {
      "id": "code-review-v1",
      "object": "model",
      "created": 1712700000,
      "owned_by": "studysolo-agent"
    }
  ]
}
```

### 1.4 对话补全

```
POST /v1/chat/completions
```

**请求体**（OpenAI 兼容）：

```json
{
  "model": "code-review-v1",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": false,
  "temperature": 0.7,
  "max_tokens": null
}
```

---

## 2. 四层兼容性要求

### Layer 1: 请求兼容

| 字段 | 必须 | 类型 | 验证方式 |
|------|------|------|---------|
| `model` | ✅ | `string` | Schema 校验 |
| `messages` | ✅ | `list[{role, content}]` | Schema 校验 |
| `stream` | ❌ | `bool` (default: `false`) | Schema 校验 |
| `temperature` | ❌ | `float` (default: 由 Agent 决定) | Schema 校验 |
| `max_tokens` | ❌ | `int \| null` | Schema 校验 |

**必须的请求头**：

| Header | 用途 |
|--------|------|
| `Authorization: Bearer <key>` | Agent API Key 验证 |
| `X-Request-Id` | UUID v4，Gateway 生成，链路追踪 |
| `X-User-Id` | 主系统用户 ID（可选，Gateway 注入） |

### Layer 2: 响应兼容

**非流式**：

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1712700000,
  "model": "code-review-v1",
  "choices": [{
    "index": 0,
    "message": { "role": "assistant", "content": "..." },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 80,
    "total_tokens": 230
  }
}
```

**流式 SSE**：

```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":"text"},"finish_reason":null}]}\n\n
...
data: [DONE]\n\n
```

**错误格式**：

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

**标准错误码表**：

| HTTP | type | code | 何时返回 |
|------|------|------|---------|
| 401 | `authentication_error` | `invalid_api_key` | API Key 无效 |
| 400 | `invalid_request_error` | `missing_model` | 缺少 model |
| 400 | `invalid_request_error` | `empty_messages` | messages 为空 |
| 404 | `not_found_error` | `model_not_found` | model 不存在 |
| 429 | `rate_limit_error` | `rate_limit_exceeded` | 内部限流 |
| 500 | `internal_error` | `upstream_error` | AI Provider 出错 |
| 503 | `service_unavailable` | `agent_overloaded` | 过载 |

### Layer 3: 运行时兼容

| 约束 | 值 | 说明 |
|------|-----|------|
| AI Provider timeout | 30s | Agent 内部调用上游的超时 |
| Agent 内部 timeout | 45s | 包含重试的总超时 |
| Gateway timeout | 60s | Gateway → Agent 的总超时 |
| 重试策略 | Agent 不自动重试 | 由 Gateway 按配置重试 |
| 幂等性 | 同一 `X-Request-Id` 安全重试 | Agent 需保证 |

### Layer 4: 平台治理兼容

| 要求 | 验证方式 |
|------|---------|
| `X-Request-Id` 传播要求 | Gateway 检查 header 回传 |
| `usage.total_tokens` 必返 | 响应 Schema 校验 |
| `version` 字段（/health） | 契约测试 |
| JSON 日志到 stdout | 部署审核 |
| API Key 环境变量注入 | `.env.example` 模板存在性检查 |

---

## 3. Gateway 层接口

### AgentGateway 类

```python
class AgentGateway:
    """主后端 Agent 网关 — 管理子后端 Agent 的发现、调用和治理。"""

    async def discover(self) -> list[AgentMeta]:
        """返回所有已注册且 ready 的 Agent 元数据。"""

    async def call(
        self,
        agent_name: str,
        messages: list[dict],
        *,
        model: str | None = None,
        stream: bool = False,
        temperature: float | None = None,
        max_tokens: int | None = None,
        user_id: str | None = None,
    ) -> AgentResponse | AsyncIterator[str]:
        """
        调用指定 Agent。

        流程：
        1. 查注册表获取 Agent URL + API Key
        2. 调用 /health/ready 确认可用
        3. 注入 X-Request-Id + X-User-Id header
        4. 转发请求到 /v1/chat/completions
        5. 超时管理 + 错误转换
        6. 记录审计日志
        """

    async def health_check(self, agent_name: str) -> AgentHealth:
        """检查 Agent 健康状态。"""
```

### AgentMeta 模型

```python
@dataclass
class AgentMeta:
    name: str
    url: str
    models: list[str]
    enabled: bool
    description: str
    owner: str
    timeout: int
    max_retries: int
```

### AgentResponse 模型

```python
@dataclass
class AgentResponse:
    content: str
    model: str
    usage: UsageInfo
    request_id: str
    latency_ms: int
```

---

## 4. 注册表配置

```yaml
# backend/config/agents.yaml
agents:
  code-review:
    url: http://127.0.0.1:8001
    timeout: 45
    max_retries: 2
    api_key_env: AGENT_CODE_REVIEW_KEY
    models:
      - code-review-v1
    enabled: true
    description: "代码审查 Agent"
    owner: "teammate-b"

  deep-research:
    url: http://127.0.0.1:8002
    timeout: 60
    max_retries: 1
    api_key_env: AGENT_DEEP_RESEARCH_KEY
    models:
      - deep-research-v1
    enabled: false
    description: "深度研究 Agent"
    owner: "teammate-b"

  news:
    url: http://127.0.0.1:8003
    timeout: 30
    max_retries: 2
    api_key_env: AGENT_NEWS_KEY
    models:
      - news-v1
    enabled: false
    description: "新闻资讯 Agent"
    owner: "teammate-b"

  study-tutor:
    url: http://127.0.0.1:8004
    timeout: 45
    max_retries: 2
    api_key_env: AGENT_STUDY_TUTOR_KEY
    models:
      - study-tutor-v1
    enabled: false
    description: "学习辅导 Agent"
    owner: "teammate-b"

  visual-site:
    url: http://127.0.0.1:8005
    timeout: 90
    max_retries: 1
    api_key_env: AGENT_VISUAL_SITE_KEY
    models:
      - visual-site-v1
    enabled: false
    description: "可视化建站 Agent"
    owner: "teammate-b"
```

---

## 5. 端口分配（冻结）

| 端口 | 服务 |
|------|------|
| 2037 | 前端 (Next.js) |
| 2038 | 主后端 (FastAPI) |
| 8001 | code-review-agent |
| 8002 | deep-research-agent |
| 8003 | news-agent |
| 8004 | study-tutor-agent |
| 8005 | visual-site-agent |
| 8006-8010 | 保留（未来 Agent） |

---

## 签字确认

| 角色 | 姓名 | 签字 | 日期 |
|------|------|------|------|
| 主系统负责人 | | ☐ | |
| 队友 B | | ☐ | |
| 队友 C | | ☐ | |
