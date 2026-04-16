# StudySolo 子后端 Agent 开发指南

> 状态：Phase 4B（小李 主导）+ Phase 5（Gateway 集成）
> 技术栈：Python 3.11+ / FastAPI / uvicorn
> 协议：OpenAI Chat Completions 兼容
> 详细接口规范：[agent-architecture.md](../docs/issues/TeamRefactor/final-plan/agent-architecture.md)

---

## 什么是子后端 Agent？

子后端 Agent 是独立部署的 FastAPI 微服务，负责特定 AI 任务。每个 Agent 独立开发、独立部署、独立运行，通过主后端的 **Agent Gateway** 统一接入平台。

```
用户请求 → 主前端 → 主后端 (Gateway) → 子后端 Agent → AI Provider
                                         ↑
                                    你在这里开发
```

---

## Agent 目录（规划）

| Agent | 用途 | 端口 | 负责人 | 来源 | 状态 |
|-------|------|------|--------|------|------|
| `_template` | 模板（复制即用） | 8000 | 主系统 | 新建 | ✅ 规划完成 |
| `code-review-agent` | 代码审查 | 8001 | 小李 | 新建 | 🔨 Phase 4B |
| `deep-research-agent` | 深度研究 | 8002 | 主系统 | 迁移自 `ResearchAgents` | ⚠️ 待迁移 |
| `news-agent` | 新闻抓取与分析 | 8003 | 主系统 | 迁移自 `NewsAgents` | ⚠️ 待迁移 |
| `study-tutor-agent` | 学习专家辅导 | 8004 | 待定 | 新建 | 📋 规划中 |
| `visual-site-agent` | 可视化网站生成 | 8005 | 待定 | 新建 | 📋 规划中 |

### 已有外部 Agent 迁移分析

#### `ResearchAgents`（深度研究）→ `deep-research-agent`

**源路径**：`D:\project\Agents\ResearchAgents`

| 维度 | 兼容性 | 说明 |
|------|--------|------|
| 框架 | ✅ FastAPI | 完全匹配 |
| 目录 | ✅ `app/api/routes/` + `schemas/` + `middleware/` | 几乎 1:1 对应模板 |
| 核心协议端点 | ⚠️ 缺 `/health` / `/health/ready` | 需补充 `agent` + `version` 字段，并补 readiness |
| Schema | ✅ Pydantic V2 OpenAI 兼容 | 直接可用 |
| SSE | ✅ `data: {json}\n\n` + `[DONE]` | 合规 |
| Auth | ✅ API Key 中间件 | 匹配 |
| Config | ✅ pydantic-settings | 匹配 |
| 功能 | ⚠️ Chat 端点是 mock | 核心研究管线待实现 |

**迁移步骤**（~2 小时）：
1. `app/` → `src/`（目录重命名）
2. 补充 `/health` 返回 `{"status":"ok","agent":"deep-research","version":"0.1.0"}`
3. 添加 `test_contract.py`
4. 更新 `pyproject.toml` 项目名

#### `NewsAgents`（新闻抓取）→ `news-agent`

**源路径**：`D:\project\Agents\newsAgents\NewsAgents`

| 维度 | 兼容性 | 说明 |
|------|--------|------|
| 框架 | ✅ FastAPI | 完全匹配 |
| 核心协议端点 | ⚠️ 缺 `/health/ready`（其余已具备，且额外支持 `/v1/responses`） | 迁移时需补 readiness |
| SSE | ✅ 完全合规 | 双换行 + `[DONE]` |
| Auth | ✅ `verify_auth` | 匹配 |
| 功能 | ✅ **生产可用**（41 个 lib，覆盖 Reddit/X/YouTube/HN/小红书/Brave 等） | 最完整 |
| 体积 | ⚠️ ~60 文件，含 84KB 的 `last30days.py` | 较大 |
| 结构 | ⚠️ `server/` 而非 `src/`，lib 无子目录 | 需重构 |
| Health | ⚠️ 缺少 `agent` + `version` 字段 | 需补充 |

**迁移步骤**（~4-6 小时）：
1. `server/app.py` 拆分：路由 → `src/router.py`，入口 → `src/main.py`
2. `server/endpoints/` 提取 health/models/completions
3. `lib/` → `src/lib/`（保持不动，内容太多不值得大改）
4. `server/pipeline.py` + `server/progress_sse.py` → `src/core/`
5. Health 补充 `agent` + `version` 字段
6. 添加 `test_contract.py`

> [!TIP]
> NewsAgents 额外支持 OpenAI **Responses API**（`/v1/responses`）——这是加分项，迁移时保留。

---

## 目标 Tree 结构（完整）

> [!IMPORTANT]
> 以下是 agents 目录的完整目标结构。所有后续 AI 对齐以此为准。

```
StudySolo/
│
├── agents/                                  ← 子后端 Agent 根目录
│   │
│   ├── README.md                            ← 本文件（开发总指南）
│   │
│   ├── _template/                           ← 模板（复制即用，不直接运行）
│   │   ├── src/
│   │   │   ├── __init__.py
│   │   │   ├── main.py                      ← FastAPI 入口 + uvicorn.run()
│   │   │   ├── config.py                    ← pydantic-settings 配置
│   │   │   ├── router.py                    ← 路由注册（统一挂载 health/ready/models/completions）
│   │   │   ├── endpoints/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── health.py                ← GET /health + GET /health/ready（必须实现）
│   │   │   │   ├── models.py                ← GET /v1/models（必须实现）
│   │   │   │   └── completions.py           ← POST /v1/chat/completions（必须实现）
│   │   │   ├── core/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── agent.py                 ← Agent 核心逻辑（开发者填充）
│   │   │   │   └── prompts.py               ← Prompt 模板
│   │   │   ├── schemas/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── request.py               ← ChatCompletionRequest（Pydantic）
│   │   │   │   └── response.py              ← ChatCompletionResponse / Chunk
│   │   │   └── middleware/
│   │   │       ├── __init__.py
│   │   │       └── auth.py                  ← API Key 验证中间件
│   │   ├── tests/
│   │   │   ├── __init__.py
│   │   │   ├── conftest.py                  ← pytest fixtures（TestClient）
│   │   │   ├── test_health.py               ← 健康检查测试
│   │   │   ├── test_models.py               ← 模型列表测试
│   │   │   ├── test_completions.py          ← Chat Completions 测试
│   │   │   └── test_contract.py             ← 四层兼容性契约测试
│   │   ├── .env.example                     ← 环境变量模板
│   │   ├── Dockerfile                       ← 生产部署
│   │   ├── docker-compose.yml               ← 本地开发
│   │   ├── pyproject.toml                   ← Python 项目配置
│   │   ├── requirements.txt                 ← 依赖锁定
│   │   └── README.md                        ← 模板使用说明
│   │
│   ├── code-review-agent/                   ← 代码审查（小李 新建）
│   │   └── ...（同 _template 结构）
│   │
│   ├── deep-research-agent/                 ← 深度研究（迁移自 ResearchAgents）
│   │   └── ...（同 _template 结构）
│   │
│   ├── news-agent/                          ← 新闻抓取（迁移自 NewsAgents）
│   │   ├── src/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── router.py
│   │   │   ├── endpoints/                   ← 标准 readiness-aware 协议端点
│   │   │   ├── core/
│   │   │   │   ├── pipeline.py              ← 研究管线（迁移自 server/pipeline.py）
│   │   │   │   ├── progress_sse.py          ← 进度 SSE
│   │   │   │   └── prompts.py
│   │   │   ├── lib/                         ← 数据源集合（迁移自 lib/，保持不动）
│   │   │   │   ├── brave_search.py
│   │   │   │   ├── reddit.py
│   │   │   │   ├── hackernews.py
│   │   │   │   ├── youtube_yt.py
│   │   │   │   └── ...（41 个源文件）
│   │   │   ├── schemas/
│   │   │   └── middleware/
│   │   ├── tests/
│   │   ├── .env.example
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   │
│   ├── study-tutor-agent/                   ← 学习专家（规划中）
│   │   └── ...（同 _template 结构）
│   │
│   └── visual-site-agent/                   ← 可视化网站生成（规划中）
│       └── ...（同 _template 结构）
│
├── backend/
│   └── config/
│       └── agents.yaml                      ← ✨ Gateway Agent 注册表（Phase 5）
│
└── ...
```

---

## 三步创建新 Agent

### Step 1：复制模板

```bash
cp -r agents/_template agents/my-new-agent
```

### Step 2：实现核心逻辑

编辑 `agents/my-new-agent/src/core/agent.py`：

```python
class MyNewAgent:
    """你的 Agent 核心逻辑"""

    async def generate(self, messages: list[dict], stream: bool = False):
        """处理用户消息，返回 AI 响应"""
        # 1. 构建 system prompt
        system_prompt = build_system_prompt()
        
        # 2. 调用上游 AI
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        
        if stream:
            return self._stream_response(full_messages)
        else:
            return await self._sync_response(full_messages)
```

### Step 3：注册到 Gateway

在 `backend/config/agents.yaml` 中添加：

```yaml
my-new-agent:
  url: http://127.0.0.1:800X  # 分配新端口
  timeout: 30
  max_retries: 2
  api_key_env: AGENT_MY_NEW_KEY
  models:
    - my-new-v1
  enabled: true
```

---

## 端口分配表

| 端口 | 用途 | 状态 |
|------|------|------|
| 2037 | 主前端（Next.js） | 已占用 |
| 2038 | 主后端（FastAPI） | 已占用 |
| 2039 | Wiki（预留，已废弃独立部署） | — |
| 8000 | `_template`（开发测试） | 仅模板 |
| 8001 | `code-review-agent` | 小李 |
| 8002 | `deep-research-agent` | 迁移自 ResearchAgents |
| 8003 | `news-agent` | 迁移自 NewsAgents |
| 8004 | `study-tutor-agent` | 规划中 |
| 8005 | `visual-site-agent` | 规划中 |
| 8006-8099 | 未来 Agent | 按需分配 |

> [!WARNING]
> 本地同时运行多个 Agent 时，确保端口不冲突。每个 Agent 的端口在 `.env` 中配置。

---

## 四层兼容性要求（速查）

每个 Agent 必须满足以下四层兼容性。详细规范见 [agent-architecture.md](../docs/issues/TeamRefactor/final-plan/agent-architecture.md)

### Layer 1: Request（请求层）

```
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer <api-key>
X-Request-Id: <uuid>

{
  "model": "agent-name-v1",
  "messages": [{"role": "user", "content": "..."}],
  "stream": false,
  "temperature": 0.7
}
```

### Layer 2: Response（响应层）

**非流式**：
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1712700000,
  "model": "agent-name-v1",
  "choices": [{
    "index": 0,
    "message": {"role": "assistant", "content": "..."},
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

**流式**：
```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hello"},"index":0}]}\n\n
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":" world"},"index":0}]}\n\n
data: [DONE]\n\n
```

### Layer 3: Runtime（运行层）

```
GET /health       → {"status":"ok","agent":"code-review","version":"1.0.0"}
GET /health/ready → {"ready":true}
GET /v1/models    → {"object":"list","data":[{"id":"code-review-v1","object":"model"}]}
```

### Layer 4: Governance（治理层）

- 注册方式：`backend/config/agents.yaml`
- 日志格式：stdout JSON
- 认证：API Key 中间件
- 端口：从 8001 起分配

---

## 技术栈要求

| 维度 | 要求 |
|------|------|
| 语言 | Python 3.11+ |
| 框架 | FastAPI |
| 运行 | uvicorn |
| 配置 | pydantic-settings |
| AI SDK | openai >= 1.60 |
| 测试 | pytest + httpx |
| 类型 | Pydantic V2 |
| 容器 | Dockerfile + docker-compose |

---

## 本地开发

```bash
cd agents/code-review-agent

# 1. 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY 等

# 4. 启动
python -m src.main
# → Uvicorn running on http://127.0.0.1:8001

# 5. 测试
pytest tests/ -v
```

---

## CI 配置（Phase 5）

```yaml
# .github/workflows/ci-agent.yml
on:
  push:
    paths: ['agents/**']
  pull_request:
    paths: ['agents/**']

jobs:
  test-agents:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        agent: [code-review-agent]  # 按需增加
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - name: Install
        run: pip install -r agents/${{ matrix.agent }}/requirements.txt
      - name: Test
        run: pytest agents/${{ matrix.agent }}/tests/ -v
```

---

## FAQ

**Q：子后端 Agent 的数据库怎么处理？**
A：Agent 不应该直接操作主系统的 Supabase。如果 Agent 需要持久化，在自己的目录内用 SQLite 或独立数据库。主系统数据通过 Gateway API 传递。

**Q：Agent 如何使用主系统的用户信息？**
A：通过 Gateway 调用时，主后端在 Header 中传递 `X-User-Id`。Agent 不直接访问 Supabase 的 auth 表。

**Q：可以用 JavaScript/TypeScript 写 Agent 吗？**
A：**不可以。** 团队统一使用 Python + FastAPI，降低维护成本。
