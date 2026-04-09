# 子后端 Agent 规范

> 文档版本：1.0.0
> 创建时间：2026-04-09
> 基于：docs/plan/TeamNewRefactor/10-子后端Agent架构设计.md

---

## 1. 概述

子后端 Agent 是独立部署的 HTTP 服务，封装特定功能域的 AI 能力，通过 OpenAI 兼容的 API 接口与主后端通信。

---

## 2. 必须实现的接口

### 2.1 健康检查

```
GET /health
```

**响应：**
```json
{
  "status": "healthy",
  "agent": "agent-name",
  "version": "1.0.0"
}
```

### 2.2 模型列表

```
GET /v1/models
```

**响应：**
```json
{
  "object": "list",
  "data": [{
    "id": "agent-name",
    "object": "model",
    "created": 1234567890,
    "owned_by": "studysolo"
  }]
}
```

### 2.3 Chat Completions

```
POST /v1/chat/completions
Content-Type: application/json
```

**请求：**
```json
{
  "model": "agent-name",
  "messages": [
    {"role": "system", "content": "You are..."},
    {"role": "user", "content": "..."}
  ],
  "temperature": 0.7,
  "max_tokens": 2000,
  "stream": false
}
```

**响应（非流式）：**
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "agent-name",
  "choices": [{
    "index": 0,
    "message": {"role": "assistant", "content": "..."},
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 150,
    "total_tokens": 200
  }
}
```

**响应（流式）：**
```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"..."},"finish_reason":null}]}

data: [DONE]
```

---

## 3. 配置管理

### 3.1 环境变量

```bash
# .env.example
OPENAI_API_KEY=sk-xxxx
OPENAI_API_BASE=https://api.openai.com/v1
MODEL_NAME=gpt-4o
PORT=8001
LOG_LEVEL=INFO
```

### 3.2 主后端配置

```yaml
# backend/config.yaml
subagents:
  code_review:
    url: ${CODE_REVIEW_AGENT_URL}
    timeout: 60
  doc_generator:
    url: ${DOC_GENERATOR_AGENT_URL}
    timeout: 120
```

---

## 4. 日志规范

### 4.1 结构化日志

```python
import structlog

logger = structlog.get_logger()

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    logger.info(
        "agent_request_started",
        agent="my-agent",
        model=request.model,
        message_count=len(request.messages),
    )
```

### 4.2 主后端调用日志

主后端记录每个 Agent 调用的：
- 调用时间
- 耗时
- Token 消耗
- 成功/失败状态

---

## 5. 错误处理

### 5.1 Agent 内部错误

```python
@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    try:
        result = await agent.complete(request.messages)
        return result
    except AgentError as e:
        logger.error("agent_error", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
```

### 5.2 主后端调用失败

主后端实现：
- 重试机制（最多 3 次）
- 熔断器（5 次失败后熔断 60 秒）
- 超时控制

---

## 6. 部署要求

### 6.1 Docker

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 6.2 Docker Compose（开发）

```yaml
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
```

---

## 7. 新增 Agent 流程

1. 复制 `services/custom-agent-template/` 为新目录
2. 实现 `src/agent.py` 的 Agent 逻辑
3. 配置 `.env` 和 `docker-compose.yml`
4. 本地测试：`docker-compose up`
5. 推送代码，创建 PR
6. CI 构建 Docker 镜像
7. 合并后，更新主后端配置

---

## 8. 参考文档

- `docs/plan/TeamNewRefactor/10-子后端Agent架构设计.md`
- `docs/plan/TeamNewRefactor/11-前端Agent接口规范.md`
