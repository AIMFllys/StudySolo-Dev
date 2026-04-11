# 子后端 Agent 接口协议规范

> 版本：v1.0 | 2026-04-10
> 状态：协议已冻结；Phase 4B 最小样板已落地
> 负责人：羽升（协议设计） + 小李（实现验证）
> 依赖：[agents/README.md](../../../../agents/README.md)（开发指南）

---

## 概述

本文档定义 StudySolo 平台中 **子后端 Agent** 与 **主后端 Agent Gateway** 之间的通信协议。所有子后端 Agent 必须严格遵守此规范，否则无法通过 Gateway 接入平台。

协议采用 **OpenAI Chat Completions API 兼容格式**，确保：
- 开发者可以直接使用 OpenAI SDK 进行测试
- 主系统无需为每个 Agent 编写定制的适配代码
- Agent 可以在不修改接口的情况下替换底层 AI Provider

---

## 四层协议架构

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: REQUEST（请求层）                              │
│  定义：客户端→Agent 的请求格式                           │
│  关键：Header 认证 + Body 为 OpenAI 格式                 │
├─────────────────────────────────────────────────────────┤
│  Layer 2: RESPONSE（响应层）                             │
│  定义：Agent→客户端 的响应格式                           │
│  关键：非流式 JSON + 流式 SSE + 统一错误码               │
├─────────────────────────────────────────────────────────┤
│  Layer 3: RUNTIME（运行层）                              │
│  定义：Agent 的运行时行为约束                            │
│  关键：健康检查 + 模型列表 + 超时链                      │
├─────────────────────────────────────────────────────────┤
│  Layer 4: GOVERNANCE（治理层）                           │
│  定义：Agent 在平台中的注册与管理                        │
│  关键：注册配置 + 端口分配 + 日志格式 + 安全要求          │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: REQUEST（请求层）

### 1.1 端点

```
POST /v1/chat/completions
```

### 1.2 请求头

| Header | 必须 | 说明 |
|--------|------|------|
| `Content-Type` | ✅ | `application/json` |
| `Authorization` | ✅ | `Bearer <api-key>`，Agent 自行验证 |
| `X-Request-Id` | ✅ | UUID v4，Gateway 生成，用于链路追踪 |
| `X-User-Id` | ⚠️ | 主系统用户 ID（可选，Gateway 注入） |
| `X-Agent-Version` | ❌ | 客户端期望的 Agent 版本（保留字段） |

### 1.3 请求体 Schema

```json
{
  "model": "string",           // 必须。Agent 提供的模型 ID
  "messages": [                // 必须。消息列表
    {
      "role": "system | user | assistant",
      "content": "string"
    }
  ],
  "stream": false,             // 可选。默认 false
  "temperature": 0.7,          // 可选。默认由 Agent 决定
  "max_tokens": null,          // 可选。null 表示不限制
  "top_p": 1.0,               // 可选
  "frequency_penalty": 0.0,    // 可选
  "presence_penalty": 0.0,     // 可选
  "stop": null                 // 可选。停止序列
}
```

### 1.4 Pydantic 模型

```python
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: str = Field(..., pattern=r"^(system|user|assistant)$")
    content: str

class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    stream: bool = False
    temperature: float | None = None
    max_tokens: int | None = None
    top_p: float | None = None
    frequency_penalty: float | None = None
    presence_penalty: float | None = None
    stop: str | list[str] | None = None
```

---

## Layer 2: RESPONSE（响应层）

### 2.1 非流式响应

**HTTP Status**: `200 OK`

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1712700000,
  "model": "code-review-v1",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "这段代码有以下几个问题..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 80,
    "total_tokens": 230
  }
}
```

### 2.2 流式响应（SSE）

**HTTP Status**: `200 OK`  
**Content-Type**: `text/event-stream`

每个 chunk：

```
data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1712700000,"model":"code-review-v1","choices":[{"index":0,"delta":{"role":"assistant","content":"这段"},"finish_reason":null}]}\n\n
```

结束信号：

```
data: [DONE]\n\n
```

> [!WARNING]
> **SSE 格式严格要求**：
> - 每行必须以 `data: ` 开头（注意空格）
> - 每个事件必须以 `\n\n`（双换行）结尾
> - 最后一个事件必须是 `data: [DONE]\n\n`
> - AI 经常忘记 `\n\n`，这会导致 Gateway 无法正确解析

### 2.3 Pydantic 模型

```python
import time
import uuid

class ChatCompletionChoice(BaseModel):
    index: int = 0
    message: ChatMessage
    finish_reason: str = "stop"

class UsageInfo(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

class ChatCompletionResponse(BaseModel):
    id: str = Field(default_factory=lambda: f"chatcmpl-{uuid.uuid4().hex[:12]}")
    object: str = "chat.completion"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str
    choices: list[ChatCompletionChoice]
    usage: UsageInfo

# 流式 chunk
class ChatCompletionChunkDelta(BaseModel):
    role: str | None = None
    content: str | None = None

class ChatCompletionChunkChoice(BaseModel):
    index: int = 0
    delta: ChatCompletionChunkDelta
    finish_reason: str | None = None

class ChatCompletionChunk(BaseModel):
    id: str
    object: str = "chat.completion.chunk"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str
    choices: list[ChatCompletionChunkChoice]
```

### 2.4 错误响应

**HTTP Status**: `4xx / 5xx`

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error",
    "code": "invalid_api_key"
  }
}
```

**标准错误码**：

| HTTP Status | type | code | 何时返回 |
|-------------|------|------|---------|
| 401 | `authentication_error` | `invalid_api_key` | API Key 无效 |
| 400 | `invalid_request_error` | `missing_model` | 缺少 model 字段 |
| 400 | `invalid_request_error` | `empty_messages` | messages 为空 |
| 404 | `not_found_error` | `model_not_found` | model 不在该 Agent 模型列表中 |
| 429 | `rate_limit_error` | `rate_limit_exceeded` | Agent 内部限流 |
| 500 | `internal_error` | `upstream_error` | 上游 AI Provider 错误 |
| 503 | `service_unavailable` | `agent_overloaded` | Agent 过载 |

```python
class AgentError(BaseModel):
    message: str
    type: str
    code: str

class ErrorResponse(BaseModel):
    error: AgentError
```

---

## Layer 3: RUNTIME（运行层）

### 3.1 健康检查

```
GET /health
```

响应：

```json
{
  "status": "ok",
  "agent": "code-review",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "models": ["code-review-v1"]
}
```

```python
class HealthResponse(BaseModel):
    status: str = "ok"
    agent: str          # Agent 名称
    version: str        # 语义化版本号
    uptime_seconds: int # 运行时长
    models: list[str]   # 支持的模型列表
```

### 3.2 模型列表

```
GET /v1/models
```

响应（OpenAI 兼容格式）：

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

### 3.3 超时链规则

```
AI Provider timeout  <  Agent 内部 timeout  <  Gateway timeout
     (30s)                  (45s)                  (60s)
```

> [!CAUTION]
> 如果 Gateway timeout < Agent timeout，会出现 Gateway 先超时但 Agent 仍在运行的情况。
> 必须严格遵守：**内层 timeout < 外层 timeout**。

### 3.4 重试策略

- **Agent 内部**：不自动重试上游 AI 调用（由 Gateway 决定是否重试整个 Agent）
- **Gateway**：按 `agents.yaml` 中的 `max_retries` 配置重试
- **幂等性**：Agent 应保证同一 `X-Request-Id` 的请求可以安全重试

---

## Layer 4: GOVERNANCE（治理层）

### 4.1 注册方式

每个 Agent 必须在 Gateway 配置中注册：

```yaml
# backend/config/agents.yaml
agents:
  code-review:
    url: http://127.0.0.1:8001
    timeout: 45                    # Gateway → Agent 超时（秒）
    max_retries: 2                 # 失败重试次数
    api_key_env: AGENT_CODE_REVIEW_KEY  # API Key 环境变量名
    models:                        # 该 Agent 声明的模型列表
      - code-review-v1
    enabled: true                  # false = 不接受请求
    description: "代码审查 Agent"   # 管理界面显示
    owner: "teammate-b"            # 维护人
```

### 4.2 端口分配

见 [agents/README.md](../../../../agents/README.md) 端口分配表。

### 4.3 日志格式

Agent 日志必须输出到 stdout，JSON 格式：

```json
{
  "timestamp": "2026-04-10T12:00:00Z",
  "level": "INFO",
  "message": "Request processed",
  "request_id": "uuid-xxx",
  "agent": "code-review",
  "duration_ms": 1200
}
```

推荐使用 `python-json-logger` 或 `structlog`。

### 4.4 安全要求

| 要求 | 说明 |
|------|------|
| API Key 验证 | 必须实现，通过 middleware 拦截 |
| CORS | 开发：`allow_origins=["*"]`，生产：限制为 Gateway IP |
| 环境变量 | API Key 等敏感信息必须通过环境变量注入，禁止硬编码 |
| `.env.example` | 每个 Agent 必须提供 `.env.example` 模板 |
| HTTPS | 生产环境通过 Nginx 反代提供 TLS |

### 4.5 CODEOWNERS

```
# .github/CODEOWNERS
agents/                    @小李
agents/_template/          @羽升 @小李
backend/config/agents.yaml @羽升
```

---

## Gateway 集成流程图

```
┌──────────┐     ┌─────────────────────┐     ┌──────────────┐     ┌────────────┐
│  用户请求  │────→│  主后端 API          │────→│ AgentGateway │────→│ 子后端Agent │
│ (前端)    │     │ POST /api/agents/   │     │              │     │            │
│           │     │   {name}/chat       │     │ 1. 查注册表   │     │ /v1/chat/  │
│           │     │                     │     │ 2. 健康检查   │     │ completions│
│           │     │ - 认证(JWT)         │     │ 3. 注入Header │     │            │
│           │     │ - 限流(quota)       │     │ 4. 转发请求   │     │ - 验证Key  │
│           │     │ - 审计日志          │     │ 5. 超时管理   │     │ - 调用AI   │
│           │←────│                     │←────│ 6. 记录审计   │←────│ - 返回结果 │
└──────────┘     └─────────────────────┘     └──────────────┘     └────────────┘
```

**数据流细节**：

1. 前端 → 主后端：JWT 认证（Supabase Auth）
2. 主后端：检查用户配额（quota_service）
3. 主后端 → Gateway：查 `agents.yaml` 注册表
4. Gateway → Agent：注入 `Authorization`（Agent API Key）+ `X-Request-Id` + `X-User-Id`
5. Agent → AI Provider：调用 OpenAI/Gemini/DeepSeek 等
6. Agent → Gateway → 主后端 → 前端：原样透传响应

---

## 契约测试清单

每个 Agent 发布前必须通过以下测试（`tests/test_contract.py`）：

```python
"""四层兼容性契约验证"""

# ─── Layer 1: Request ───
def test_accepts_valid_request(client):
    """接受合法的 ChatCompletion 请求"""

def test_rejects_missing_model(client):
    """缺少 model 字段返回 400"""

def test_rejects_empty_messages(client):
    """messages 为空返回 400"""

def test_rejects_invalid_api_key(client):
    """无效 API Key 返回 401"""

# ─── Layer 2: Response ───
def test_non_stream_response_format(client):
    """非流式响应包含 id, object, choices, usage"""

def test_stream_response_sse_format(client):
    """流式响应为合法 SSE 格式，以 [DONE] 结尾"""

def test_error_response_format(client):
    """错误响应包含 error.message, error.type, error.code"""

# ─── Layer 3: Runtime ───
def test_health_endpoint(client):
    """GET /health 返回 status, agent, version"""

def test_models_endpoint(client):
    """GET /v1/models 返回 object=list, data=[...]"""

# ─── Layer 4: Governance ───
def test_request_id_propagation(client):
    """X-Request-Id 被正确记录"""
```

---

## 版本控制

| 字段 | 版本策略 |
|------|---------|
| 协议版本 | 本文档 `v1.0`，大变更升 major |
| Agent 版本 | 语义化版本 `/health` 返回 |
| Model 版本 | `model` 字段，如 `code-review-v1`, `code-review-v2` |
| API 路径版本 | `/v1/...`，路径含版本号 |

---

## 延伸阅读

| 文档 | 说明 |
|------|------|
| [agents/README.md](../../../../agents/README.md) | Agent 开发快速指南（3 步创建） |
| [phase-4-nodes-and-agents.md](phase-4-nodes-and-agents.md) | Phase 4B 任务分解 |
| [phase-5-integration.md](phase-5-integration.md) | Phase 5 Gateway 实现计划 |
