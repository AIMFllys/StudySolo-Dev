# 子后端 Agent 规范

> 文档版本：3.0.0
> 创建时间：2026-04-09
> 最后更新：2026-04-16
> 权威来源：`agents/README.md` + `docs/issues/TeamRefactor/final-plan/agent-architecture.md`

---

## 1. 概述

子后端 Agent 是独立部署的 HTTP 服务，封装特定功能域的 AI 能力，通过 **OpenAI Chat Completions 兼容协议**与主后端通信。

> **重要**：Agent 目录位于项目根级 `agents/`（**不是** `backend/app/services/`）。这是 Phase 4B 确立的新结构。

### 1.1 Agent 与主后端的关系

```
用户请求 → 主前端 → 主后端 (AgentGateway) → 子后端 Agent → AI Provider
                                         ↑
                                    你在这里开发
```

### 1.2 目录结构（Phase 4B 确立）

```
StudySolo/
├── agents/                                  ← Agent 根目录
│   ├── README.md                            ← 开发总指南（权威）
│   │
│   ├── _template/                           ← 模板（复制即用）
│   │   ├── src/
│   │   │   ├── main.py                     ← FastAPI 入口
│   │   │   ├── config.py                   ← pydantic-settings 配置
│   │   │   ├── router.py                   ← 路由注册
│   │   │   ├── endpoints/
│   │   │   │   ├── health.py              ← GET /health
│   │   │   │   ├── models.py              ← GET /v1/models
│   │   │   │   └── completions.py         ← POST /v1/chat/completions
│   │   │   ├── core/
│   │   │   │   ├── agent.py               ← Agent 核心逻辑
│   │   │   │   └── prompts.py             ← Prompt 模板
│   │   │   ├── schemas/
│   │   │   │   ├── request.py
│   │   │   │   └── response.py
│   │   │   └── middleware/
│   │   │       └── auth.py                ← API Key 验证
│   │   ├── tests/
│   │   │   ├── conftest.py
│   │   │   └── test_contract.py           ← 四层兼容性测试
│   │   ├── .env.example
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── pyproject.toml
│   │   ├── requirements.txt
│   │   └── README.md
│   │
│   ├── code-review-agent/                  ← 小李 开发中
│   ├── deep-research-agent/                ← 已迁移，已注册 Gateway（8002）
│   ├── news-agent/                         ← 已迁移，已注册 Gateway（8003）
│   ├── study-tutor-agent/                  ← 阶段版已落地，未注册 Gateway（8004）
│   └── visual-site-agent/                  ← 阶段版已落地，未注册 Gateway（8005）
│
└── backend/
    └── config/
        └── agents.yaml                     ← Gateway 注册表
```

---

## 2. 四层兼容性协议

> **权威定义**：[agent-architecture.md](../../issues/TeamRefactor/final-plan/agent-architecture.md)
>
> 四层协议的完整 Pydantic Schema、错误码、超时链规则、日志格式和安全要求均以上述冻结文档为准。本节仅提供速查摘要。

| 层级 | 关键要求 | 验证方式 |
|------|---------|---------|
| **Layer 1: Request** | `POST /v1/chat/completions`，Header 认证 + Body 为 OpenAI 格式 | Schema 校验 |
| **Layer 2: Response** | 非流式 JSON + 流式 SSE（`data: {json}\n\n` + `[DONE]`）+ 统一错误码 | 契约测试 |
| **Layer 3: Runtime** | `GET /health` + `GET /health/ready` + `GET /v1/models` + 超时链 | 集成测试 |
| **Layer 4: Governance** | `agents.yaml` 注册 + 端口分配 + stdout JSON 日志 + API Key 中间件 | Gateway 检查 |

端口分配表和 `agents.yaml` 注册格式见 [agents/README.md](../../../agents/README.md)。

---

## 3. 新增 Agent 流程

> **详细指南**：`agents/README.md`

### Step 1：复制模板

```bash
cp -r agents/_template agents/my-new-agent
```

### Step 2：实现核心逻辑

编辑 `agents/my-new-agent/src/core/agent.py`：

```python
class MyNewAgent:
    async def generate(self, messages: list[dict], stream: bool = False):
        """处理用户消息，返回 AI 响应"""
        system_prompt = build_system_prompt()
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        if stream:
            return self._stream_response(full_messages)
        else:
            return await self._sync_response(full_messages)
```

### Step 3：注册到 Gateway

在 `backend/config/agents.yaml` 中添加配置。

### Step 3.1：接入 Agent 节点专区

> 团队协作、PR Merge 后验收、以及“是否已完成工作流节点产品化交付”的口径，以 [Agent 分支提交 SOP](../功能流程/团队协作/Agent分支提交SOP.md) 为准。

如果该 Agent 需要直接暴露到工作流画布，还必须同步新增固定 Agent 节点：

- 后端：`backend/app/nodes/agent/<node_type>/node.py`
- 前端：`frontend/src/types/workflow.ts`、`workflow-meta.ts`、Node Store 分组、NodeModelSelector
- 提示词：`backend/app/prompts/*`、`backend/app/nodes/analysis/ai_planner/prompt.md`

约束：

- 一个 Agent 节点只绑定一个 Agent
- Agent 节点模型来源固定为 `/api/agents/{name}/models`
- 如果运行时 `/v1/models` 不可用，则回退 `agents.yaml.models`

### Step 4：运行四层契约测试

```bash
pytest agents/my-new-agent/tests/test_contract.py -v
```

---

## 4. 技术栈要求

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

## 5. 本地开发

```bash
cd agents/code-review-agent

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 OPENAI_API_KEY 等

# 启动
python -m src.main
# → Uvicorn running on http://127.0.0.1:8001

# 测试
pytest tests/ -v
```

---

## 6. 错误响应格式

所有错误必须返回以下格式：

```json
{
  "error": {
    "message": "错误描述",
    "type": "authentication_error | invalid_request_error | not_found_error | rate_limit_error | internal_error | service_unavailable",
    "code": "invalid_api_key | missing_model | empty_messages | model_not_found | rate_limit_exceeded | upstream_error | agent_overloaded"
  }
}
```

---

## 7. 日志规范

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

---

## 8. 安全要求

| 要求 | 说明 |
|------|------|
| API Key 验证 | 必须实现，通过 middleware 拦截 |
| CORS | 开发：`allow_origins=["*"]`；生产：限制为 Gateway IP |
| 环境变量 | API Key 等敏感信息必须通过环境变量注入，禁止硬编码 |
| `.env.example` | 每个 Agent 必须提供环境变量模板 |
| HTTPS | 生产环境通过 Nginx 反代提供 TLS |

---

## 9. FAQ

**Q：Agent 的数据库怎么处理？**
A：Agent 不应该直接操作主系统的 Supabase。如果 Agent 需要持久化，在自己的目录内用 SQLite 或独立数据库。主系统数据通过 Gateway API 传递。

**Q：Agent 如何使用主系统的用户信息？**
A：通过 Gateway 调用时，主后端在 Header 中传递 `X-User-Id`。Agent 不直接访问 Supabase 的 auth 表。

**Q：可以用 JavaScript/TypeScript 写 Agent 吗？**
A：**不可以。** 团队统一使用 Python + FastAPI，降低维护成本。

---

## 10. Phase 4B + Phase 5 完成状态

### 10.1 代码审查 Agent（`code-review-agent`）

**已完成能力**：
- ✅ 最小可运行 FastAPI 服务
- ✅ `GET /health` + `GET /health/ready` + `GET /v1/models` + `POST /v1/chat/completions`
- ✅ non-stream + SSE stream 响应
- ✅ 7 类固定规则审查
- ✅ 多文件 unified diff 感知
- ✅ live upstream findings 治理（evidence anchoring、known-rule metadata canonicalization、unknown-rule groundedness 治理）
- ✅ repo-context forwarding governance（归一化、去重、关系排序、预算裁剪）
- ✅ 四层契约测试通过（**177 passed**，Phase 4B 最终基线）

**仍未实现**：
- ⚠️ 不读取本地仓库文件
- ⚠️ 不透传 provider usage

### 10.2 Phase 5 完成状态

- ✅ `backend/config/agents.yaml` 已注册 5 个 Agent：`code-review`、`deep-research`、`news`、`study-tutor`、`visual-site`
- ✅ Agent Gateway 主后端接入层已实现（`backend/app/services/agent_gateway/`）
- ✅ `/api/agents/*` 路由已接入，支持 Agent 列表、健康状态与模型发现
- ✅ 5 个 Agent 节点已接入画布 Agent 分区，固定映射到对应子后端 Agent
- ✅ Agent 节点模型来源已切换为“运行时 `/v1/models` 优先，`agents.yaml.models` 回退”

### 10.3 Agent 成熟度三维度（代码 / 测试 / Gateway）

| Agent | 代码存在 | 测试状态 | Gateway 注册状态 |
|------|---------|---------|-----------------|
| code-review-agent | ✅ | ✅（177 passed） | ✅ |
| deep-research-agent | ✅ | ✅ | ✅（端口 8002） |
| news-agent | ✅ | ✅ | ✅（端口 8003） |
| study-tutor-agent | ✅ | ✅（35 passed） | ❌（未注册） |
| visual-site-agent | ✅ | ✅（30 passed） | ❌（未注册） |

### 10.4 端口事实源说明

- Gateway 端口事实源以 `backend/config/agents.yaml` 为准。
- 各 Agent README 中的 `AGENT_PORT` 仅作为该 Agent 本地开发默认值，不代表 Gateway 实际注册端口。
- 当前需重点对齐的冲突：
  - `deep-research-agent`：README 为 8005，但 Gateway 已注册 8002。
  - `news-agent`：README 为 8004，但 Gateway 已注册 8003。

## 11. 参考文档

| 文档 | 说明 |
|------|------|
| `agents/README.md` | Agent 开发总指南 |
| `docs/issues/TeamRefactor/final-plan/agent-architecture.md` | 四层协议完整规范 |
| `docs/issues/TeamRefactor/final-plan/phase-4-nodes-and-agents.md` | Phase 4 任务分解 |
| `docs/issues/TeamRefactor/final-plan/phase-5-integration.md` | Phase 5 Gateway 实现计划 |
