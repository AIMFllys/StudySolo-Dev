# 子后端 Agent 架构设计

> 负责人：队友 B
> 目标：定义子后端 Agent 的开发规范和运行架构

---

## 1. 子后端 Agent 定位

### 1.1 什么是子后端 Agent

子后端 Agent 是一个独立部署的 HTTP 服务，封装特定功能域的 AI 能力，通过 OpenAI 兼容的 API 接口与主后端通信。

### 1.2 与主后端的关系

```
┌─────────────────────────────────────────────────────┐
│                    主后端 (Backend)                  │
│                                                     │
│  workflow_execute.py                                │
│      │                                             │
│      │ POST /v1/chat/completions                   │
│      ▼                                             │
│  ┌─────────────────────────────────────────────┐   │
│  │           子后端 Agent                        │   │
│  │  ┌─────────────────────────────────────┐    │   │
│  │  │  Agent Logic (prompt + tools)       │    │   │
│  │  └─────────────────────────────────────┘    │   │
│  │                                             │   │
│  │  独立 API Key、独立模型、独立部署            │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 1.3 为什么独立部署

| 优势 | 说明 |
|------|------|
| 独立扩展 | 代码审查 Agent 和文档生成 Agent 负载不同 |
| 独立版本 | 可以单独发布、单独回滚 |
| 独立密钥 | 每个 Agent 用自己的 API Key |
| 团队自治 | 队友 B 可以独立开发部署自己的 Agent |
| 故障隔离 | 一个 Agent 挂了不影响其他 |

---

## 2. OpenAI 兼容接口

### 2.1 必须实现的端点

```
POST /v1/chat/completions     # 必须：Chat Completions
GET  /v1/models               # 必须：模型列表
GET  /health                  # 必须：健康检查
```

### 2.2 Chat Completions 请求/响应

**请求：**
```json
POST /v1/chat/completions
{
  "model": "code-review-agent",
  "messages": [
    {"role": "system", "content": "You are a code review assistant..."},
    {"role": "user", "content": "Review this code:\n\ndef foo():\n    pass"}
  ],
  "temperature": 0.7,
  "max_tokens": 2000,
  "stream": false
}
```

**响应：**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "code-review-agent",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "## Code Review\n\n### Issues Found\n\n1. **Missing docstring**: Function `foo` should have a docstring..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 150,
    "total_tokens": 200
  }
}
```

**流式响应（SSE）：**
```json
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"##"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" Code"},"finish_reason":null}]}

data: [DONE]
```

---

## 3. Agent 模板结构

### 3.1 目录结构

```
services/
└── code-review-agent/                 # 示例：代码审查 Agent
    ├── src/
    │   ├── __init__.py
    │   ├── main.py                   # FastAPI 入口
    │   ├── agent.py                   # Agent 核心逻辑
    │   ├── prompts.py                 # Prompt 模板
    │   ├── tools/                     # 工具定义
    │   │   ├── __init__.py
    │   │   ├── search_code.py         # 代码搜索工具
    │   │   └── explain_error.py       # 错误解释工具
    │   ├── schemas.py                 # 请求/响应模型
    │   └── config.py                  # 配置
    ├── tests/
    │   ├── __init__.py
    │   ├── test_agent.py
    │   └── test_tools.py
    ├── Dockerfile
    ├── docker-compose.yml
    ├── .env.example
    ├── requirements.txt
    ├── pyproject.toml
    └── README.md
```

### 3.2 核心代码示例

**main.py：**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .agent import CodeReviewAgent
from .schemas import ChatCompletionRequest, ChatCompletionResponse

app = FastAPI(title="Code Review Agent")

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = CodeReviewAgent()

@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "code-review-agent"}

@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [{
            "id": "code-review-agent",
            "object": "model",
            "created": 1234567890,
            "owned_by": "studysolo",
        }]
    }

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    if request.stream:
        return agent.astream(request.messages)
    return await agent.acomplete(request.messages)
```

**agent.py：**
```python
from openai import OpenAI
from .prompts import SYSTEM_PROMPT, USER_TEMPLATE
from .config import settings

class CodeReviewAgent:
    def __init__(self):
        self.client = OpenAI(
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_API_BASE,  # 可选的自定义端点
        )
        self.model = settings.MODEL_NAME

    async def acomplete(self, messages: list[dict]) -> dict:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.3,
            max_tokens=2000,
        )
        return response.model_dump()

    async def astream(self, messages: list[dict]):
        stream = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.3,
            max_tokens=2000,
            stream=True,
        )
        for chunk in stream:
            yield chunk.model_dump_json()
```

---

## 4. API Key 管理

### 4.1 设计原则

1. **每个 Agent 独立 Key** - 不同 Agent 可以用不同提供商的 Key
2. **主后端不存储子 Agent Key** - Agent 自己的环境变量
3. **主后端只存储调用地址** - `http://code-review-agent:8000`

### 4.2 配置方式

**Agent 自己的 `.env`：**
```bash
# services/code-review-agent/.env
OPENAI_API_KEY=sk-xxxx
OPENAI_API_BASE=https://api.openai.com/v1
MODEL_NAME=gpt-4o
PORT=8001
```

**主后端的 `config.yaml`：**
```yaml
# backend/config.yaml
subagents:
  code_review:
    url: http://localhost:8001
    timeout: 60
  doc_generator:
    url: http://localhost:8002
    timeout: 120
```

**主后端调用：**
```python
# backend/app/services/subagent_caller.py
import httpx

class SubAgentCaller:
    def __init__(self, config: dict):
        self.agents = {
            name: {"url": cfg["url"], "timeout": cfg["timeout"]}
            for name, cfg in config["subagents"].items()
        }

    async def call(self, agent_name: str, messages: list[dict]) -> dict:
        agent = self.agents[agent_name]
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{agent['url']}/v1/chat/completions",
                json={"model": agent_name, "messages": messages},
                timeout=agent["timeout"],
            )
            return response.json()
```

---

## 5. 服务发现与健康检查

### 5.1 健康检查

```python
# 每个 Agent 必须实现
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": "code-review-agent",
        "version": "1.0.0",
    }

@app.get("/health/ready")
async def ready():
    # 检查外部依赖（API Key 是否有效等）
    try:
        await check_openai_connection()
        return {"ready": True}
    except:
        return {"ready": False}
```

### 5.2 主后端的健康监控

```python
# backend/app/services/agent_registry.py
import httpx

class AgentRegistry:
    def __init__(self):
        self.agents: dict[str, dict] = {}

    async def check_health(self, name: str, url: str) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{url}/health", timeout=5)
                return response.status_code == 200
        except:
            return False

    async def get_healthy_agents(self) -> list[str]:
        healthy = []
        for name, config in self.agents.items():
            if await self.check_health(name, config["url"]):
                healthy.append(name)
        return healthy
```

---

## 6. 日志与监控

### 6.1 结构化日志

```python
import structlog

logger = structlog.get_logger()

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    logger.info(
        "agent_request_started",
        agent="code-review-agent",
        model=request.model,
        message_count=len(request.messages),
    )
    # ...
    logger.info(
        "agent_request_completed",
        agent="code-review-agent",
        tokens_used=response["usage"]["total_tokens"],
    )
```

### 6.2 调用日志（主后端）

```python
# 主后端记录每个 Agent 调用
@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    # ...
    try:
        start = time.time()
        result = await subagent_caller.call("code_review", messages)
        duration = time.time() - start

        logger.info(
            "subagent_call",
            agent="code_review",
            status="success",
            duration_ms=int(duration * 1000),
            tokens=result.get("usage", {}).get("total_tokens", 0),
        )
        return result
    except Exception as e:
        logger.error(
            "subagent_call",
            agent="code_review",
            status="error",
            error=str(e),
        )
        raise
```

---

## 7. 部署方案

### 7.1 Docker Compose（开发环境）

```yaml
# services/docker-compose.yml
version: '3.8'

services:
  code-review-agent:
    build: ./code-review-agent
    ports:
      - "8001:8000"
    env_file:
      - ./code-review-agent/.env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  doc-generator-agent:
    build: ./doc-generator-agent
    ports:
      - "8002:8000"
    env_file:
      - ./doc-generator-agent/.env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 7.2 Dockerfile

```dockerfile
# services/code-review-agent/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY src/ ./src/

# 运行
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 8. 开发流程

### 8.1 创建新 Agent

```bash
# 1. 使用模板创建
cp -r services/custom-agent-template services/my-new-agent

# 2. 修改配置
cd services/my-new-agent
# 编辑 src/prompts.py, src/agent.py 等

# 3. 本地测试
docker-compose up my-new-agent
curl -X POST http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"my-new-agent","messages":[{"role":"user","content":"Hello"}]}'

# 4. 提交
git add services/my-new-agent
git commit -m "feat(agent): add my-new-agent"
git push

# 5. 合并后，CI 自动构建 Docker 镜像
```

### 8.2 测试

```python
# tests/test_agent.py
import pytest
from src.agent import CodeReviewAgent

@pytest.fixture
def agent():
    return CodeReviewAgent()

def test_review_simple_code(agent):
    messages = [
        {"role": "user", "content": "Review this:\ndef hello():\n    print('hi')"}
    ]
    result = agent.complete(messages)
    assert "issue" in result.lower() or "suggest" in result.lower()

def test_health_check():
    import httpx
    response = httpx.get("http://localhost:8000/health")
    assert response.status_code == 200
```

---

## 9. 错误处理与熔断

### 9.1 重试机制

```python
# 主后端调用子 Agent 时的重试
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def call_agent_with_retry(agent_name: str, messages: list[dict]) -> dict:
    return await subagent_caller.call(agent_name, messages)
```

### 9.2 熔断器

```python
# 使用 pybreaker
import pybreaker

breaker = pybreaker.CircuitBreaker(
    fail_max=5,
    reset_timeout=60,
)

async def call_agent_circuit_breaker(agent_name: str, messages: list[dict]):
    try:
        return await breaker.call(subagent_caller.call, agent_name, messages)
    except pybreaker.CircuitBreakerError:
        raise AIRouterError(f"Agent {agent_name} circuit open")
```

---

## 10. 未来扩展

### 10.1 支持的 Agent 类型

| Agent | 功能 | 使用的模型 |
|-------|------|-----------|
| code-review-agent | 代码审查 | GPT-4o |
| doc-generator-agent | 文档生成 | GPT-4o |
| test-generator-agent | 测试生成 | GPT-4o |
| translator-agent | 翻译 | Claude |
| summarizer-agent | 摘要 | GPT-4o-mini |

### 10.2 多模型路由

```python
# 子后端内部可以根据任务类型选择不同模型
async def complete(self, messages: list[dict], task_type: str = "general"):
    model = self.route_model(task_type)
    return self.client.chat.completions.create(model=model, messages=messages)
```
