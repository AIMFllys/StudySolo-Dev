# 第三波：Agent Gateway 设计与实现

> 预估时间：3-5 天
> 对应任务：Task 5.1（Agent Gateway 实现）
> 前置依赖：第二波（治理基础设施）完成
> 产出：可运行的 Agent Gateway + code-review-agent 端到端集成

---

## 1. Gateway 架构定位

### 1.1 Gateway 是什么

Agent Gateway 是主后端中的一个服务层模块，负责统一管理所有子后端 Agent 的注册、发现、调用和治理。它是主前端与子后端 Agent 之间的唯一通道。

### 1.2 Gateway 不是什么

- 不是 AI Provider 路由器（那是 `services/llm/router.py` 的职责）
- 不是 Agent 的 AI 调用代理（每个 Agent 独立管理自己的 upstream API Key）
- 不是独立部署的微服务（它是主后端的一部分）

### 1.3 职责边界

```
主后端 services/llm/router.py     Agent Gateway
├── 服务于工作流节点执行            ├── 服务于 Agent 调用
├── 管理 AI Provider 路由          ├── 管理 Agent 注册/发现
├── 处理 config.yaml 中的模型配置   ├── 处理 agents.yaml 中的 Agent 配置
└── 与 Agent 无关                  └── 与 AI Provider 无关
```

---

## 2. 数据流设计

### 2.1 完整调用链

```
前端                    主后端                      Gateway                    子后端 Agent
  │                       │                           │                           │
  │ POST /api/agents/     │                           │                           │
  │   code-review/chat    │                           │                           │
  │ ─────────────────────>│                           │                           │
  │   (JWT + body)        │                           │                           │
  │                       │ 1. JWT 认证               │                           │
  │                       │ 2. 用户配额检查            │                           │
  │                       │ 3. 调用 Gateway            │                           │
  │                       │ ─────────────────────────>│                           │
  │                       │   (agent_name, messages,   │                           │
  │                       │    stream, user_id)        │                           │
  │                       │                           │ 4. 查注册表               │
  │                       │                           │ 5. 健康检查（可选缓存）    │
  │                       │                           │ 6. 注入 Headers            │
  │                       │                           │    X-Request-Id            │
  │                       │                           │    X-User-Id               │
  │                       │                           │    Authorization           │
  │                       │                           │ 7. 转发请求                │
  │                       │                           │ ─────────────────────────>│
  │                       │                           │   POST /v1/chat/completions│
  │                       │                           │                           │
  │                       │                           │ 8. 接收响应（或 SSE 流）   │
  │                       │                           │ <─────────────────────────│
  │                       │                           │                           │
  │                       │ 9. 审计日志               │                           │
  │                       │ <─────────────────────────│                           │
  │                       │                           │                           │
  │ 10. 返回响应          │                           │                           │
  │ <─────────────────────│                           │                           │
```

### 2.2 SSE 透传流程

```
前端 ←── SSE ←── 主后端 API ←── Gateway ←── SSE ←── Agent

Gateway 必须流式转发 Agent 的 SSE 响应，不能 buffer 整个响应。
具体实现：使用 httpx 的 stream 模式读取 Agent 响应，逐 chunk 转发给主后端 API，
主后端 API 再通过 StreamingResponse 转发给前端。
```

### 2.3 超时链

```
AI Provider timeout  <  Agent 内部 timeout  <  Gateway timeout  <  主后端 API timeout
     (30s)                  (45s)                  (60s)               (90s)
```

---

## 3. 模块设计

### 3.1 目录结构

```
backend/app/services/agent_gateway/
├── __init__.py
├── gateway.py            # AgentGateway 主类（统一入口）
├── registry.py           # AgentRegistry（从 agents.yaml 加载）
├── caller.py             # AgentCaller（HTTP 调用 + SSE 透传）
├── health.py             # HealthChecker（健康检查 + 缓存）
└── models.py             # AgentMeta, AgentCallResult 等数据模型

backend/config/
└── agents.yaml           # Agent 注册表

backend/app/api/
└── agents.py             # /api/agents/* 路由（新增）
```

### 3.2 核心类设计

#### AgentRegistry

```python
class AgentMeta(BaseModel):
    name: str
    url: str
    timeout: int = 45
    max_retries: int = 2
    api_key_env: str
    models: list[str]
    enabled: bool = True
    description: str = ""
    owner: str = ""

class AgentRegistry:
    """从 agents.yaml 加载 Agent 注册信息"""

    def __init__(self, config_path: str):
        self._agents: dict[str, AgentMeta] = {}
        self._load(config_path)

    def get(self, name: str) -> AgentMeta | None: ...
    def list_all(self) -> list[AgentMeta]: ...
    def list_enabled(self) -> list[AgentMeta]: ...
```

#### AgentCaller

```python
class AgentCallResult(BaseModel):
    status_code: int
    body: dict | None = None
    error: str | None = None
    duration_ms: int = 0
    request_id: str = ""

class AgentCaller:
    """执行对子后端 Agent 的 HTTP 调用"""

    async def call(
        self,
        url: str,
        messages: list[dict],
        stream: bool,
        timeout: int,
        headers: dict,
    ) -> AgentCallResult: ...

    async def call_stream(
        self,
        url: str,
        messages: list[dict],
        timeout: int,
        headers: dict,
    ) -> AsyncIterator[bytes]: ...
```

#### HealthChecker

```python
class HealthChecker:
    """Agent 健康检查，带缓存和熔断"""

    def __init__(self, cache_ttl: int = 30):
        self._cache: dict[str, tuple[bool, float]] = {}
        self._cache_ttl = cache_ttl

    async def is_healthy(self, agent: AgentMeta) -> bool: ...
    async def check_all(self, agents: list[AgentMeta]) -> dict[str, bool]: ...
```

#### AgentGateway

```python
class AgentGateway:
    """主入口：注册 → 发现 → 调用 → 审计"""

    def __init__(self, registry: AgentRegistry):
        self.registry = registry
        self.caller = AgentCaller()
        self.health = HealthChecker()

    async def discover(self) -> list[AgentMeta]:
        """返回所有已注册且健康的 Agent"""
        ...

    async def call(
        self,
        agent_name: str,
        messages: list[dict],
        stream: bool = False,
        user_id: str | None = None,
    ) -> AgentCallResult:
        """统一调用入口"""
        ...

    async def call_stream(
        self,
        agent_name: str,
        messages: list[dict],
        user_id: str | None = None,
    ) -> AsyncIterator[bytes]:
        """流式调用入口"""
        ...
```

### 3.3 agents.yaml 格式

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
    owner: "小李"

  # 后续 Agent 迁移完成后添加
  # deep-research:
  #   url: http://127.0.0.1:8002
  #   ...
```

### 3.4 API 路由设计

```python
# backend/app/api/agents.py

# GET /api/agents
# 返回所有可用 Agent 列表（已注册 + 健康）
async def list_agents() -> list[AgentMeta]: ...

# POST /api/agents/{name}/chat
# 调用指定 Agent（代理模式，支持 stream/non-stream）
async def chat_with_agent(
    name: str,
    request: AgentChatRequest,
    user = Depends(get_current_user),
) -> Response: ...

# GET /api/agents/{name}/health
# 查询指定 Agent 的健康状态
async def agent_health(name: str) -> dict: ...
```

---

## 4. 实现步骤

### S3.1 Gateway 详细设计文档（0.5 天）

- 确认上述设计无遗漏
- 与 `agent-architecture.md` 中的协议对齐
- 确认 `agents.yaml` 格式与 `code-review-agent` 的 `.env` 配置匹配

### S3.2 agents.yaml + registry（0.5 天）

1. 创建 `backend/config/agents.yaml`
2. 实现 `AgentRegistry` 类
3. 实现 `AgentMeta` 数据模型
4. 编写 registry 单元测试

### S3.3 agent_gateway 核心实现（1.5-2 天）

1. 实现 `AgentCaller`（non-stream + stream）
2. 实现 `HealthChecker`（带缓存）
3. 实现 `AgentGateway` 主类
4. 编写核心逻辑单元测试
5. 重点：SSE 透传的正确实现

### S3.4 /api/agents/* 路由（0.5 天）

1. 创建 `backend/app/api/agents.py`
2. 实现三个路由端点
3. 在 `router.py` 中注册
4. 添加 JWT 认证和配额检查
5. 编写路由集成测试

### S3.5 code-review-agent 端到端集成（0.5-1 天）

1. 启动 `code-review-agent`（端口 8001）
2. 通过 Gateway 调用 `code-review-agent`
3. 验证 non-stream 调用
4. 验证 SSE stream 调用
5. 验证健康检查
6. 验证超时和错误处理
7. 验证审计日志记录

---

## 5. 测试方案

### 5.1 单元测试

```python
# tests/test_agent_registry.py
def test_load_agents_yaml(): ...
def test_get_existing_agent(): ...
def test_get_nonexistent_agent(): ...
def test_list_enabled_only(): ...

# tests/test_agent_caller.py
async def test_non_stream_call(): ...
async def test_stream_call(): ...
async def test_timeout_handling(): ...
async def test_connection_error(): ...

# tests/test_agent_gateway.py
async def test_discover_healthy_agents(): ...
async def test_call_agent_success(): ...
async def test_call_agent_not_found(): ...
async def test_call_agent_unhealthy(): ...
```

### 5.2 集成测试

```python
# tests/test_agent_api.py
async def test_list_agents_endpoint(): ...
async def test_chat_with_agent_non_stream(): ...
async def test_chat_with_agent_stream(): ...
async def test_agent_health_endpoint(): ...
async def test_unauthorized_access(): ...
```

### 5.3 端到端验证清单

- [ ] `GET /api/agents` 返回 `code-review-agent` 信息
- [ ] `POST /api/agents/code-review/chat` non-stream 返回正确格式
- [ ] `POST /api/agents/code-review/chat` stream 返回正确 SSE 格式
- [ ] `GET /api/agents/code-review/health` 返回健康状态
- [ ] Agent 未启动时，Gateway 正确返回 503
- [ ] 无效 Agent 名称返回 404
- [ ] 无 JWT token 返回 401
- [ ] 超时场景正确处理

---

## 6. 关键实现细节

### 6.1 SSE 透传实现要点

```python
# 使用 httpx 的 stream 模式
async def call_stream(self, url, messages, timeout, headers):
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            f"{url}/v1/chat/completions",
            json={"messages": messages, "stream": True},
            headers=headers,
            timeout=timeout,
        ) as response:
            async for chunk in response.aiter_bytes():
                yield chunk
```

主后端 API 层使用 `StreamingResponse` 转发：

```python
from starlette.responses import StreamingResponse

async def chat_with_agent_stream(name, request, user):
    stream = gateway.call_stream(name, request.messages, user_id=user.id)
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

### 6.2 健康检查缓存

- 缓存 TTL：30 秒
- 缓存 key：Agent name
- 缓存值：`(is_healthy: bool, checked_at: float)`
- 缓存失效后重新检查

### 6.3 审计日志

每次 Agent 调用记录：
- `request_id`（UUID v4）
- `agent_name`
- `user_id`
- `stream`（是否流式）
- `status_code`（Agent 返回的状态码）
- `duration_ms`
- `error`（如有）
- `timestamp`

初期写入 stdout JSON 日志，后续可接入 `audit_logger.py`。

### 6.4 错误处理

| 场景 | Gateway 行为 | 返回给前端 |
|------|-------------|-----------|
| Agent 未注册 | 直接返回 | 404 `{"error": {"message": "Agent not found", "type": "not_found_error"}}` |
| Agent 未启动 | 健康检查失败 | 503 `{"error": {"message": "Agent unavailable", "type": "service_unavailable"}}` |
| Agent 超时 | 记录审计 | 504 `{"error": {"message": "Agent timeout", "type": "gateway_timeout"}}` |
| Agent 返回错误 | 透传错误 | 原样透传 Agent 的错误响应 |
| 配额不足 | 主后端拦截 | 429 `{"error": {"message": "Quota exceeded", "type": "rate_limit_error"}}` |

---

## 7. 验收标准

- [ ] `backend/app/services/agent_gateway/` 目录存在且包含完整实现
- [ ] `backend/config/agents.yaml` 已创建，包含 `code-review-agent` 配置
- [ ] `backend/app/api/agents.py` 已创建并注册到 `router.py`
- [ ] `code-review-agent` 可通过 Gateway 端到端调用（non-stream + stream）
- [ ] 单元测试和集成测试通过
- [ ] 审计日志正确记录
- [ ] 错误场景正确处理
- [ ] `code-review-agent` 的 177 passed 基线未回退
