# 子 Agent 现状与迁移计划

> 创建时间：2026-04-12
> 目的：汇总所有 6 个 Agent 的真实状态、独立性模型和后续计划
> 负责人：小李（Agent 迁移/开发）+ 羽升（Gateway 接入）

---

## 1. Agent 独立子后端架构模型

### 1.1 核心设计原则

每个 Agent 都是完全独立的微服务：

- **独立进程**：各自的 FastAPI + uvicorn 实例
- **独立端口**：8001-8099 范围内分配
- **独立 `.env`**：各自管理环境变量
- **独立 API Key**：Gateway 调用 Agent 时的认证凭证
- **独立 AI Provider 调用**：Agent 自己管理 upstream API Key，不经过主后端
- **独立虚拟环境**：各自的 `requirements.txt` 和 `.venv`
- **独立 Dockerfile**：各自的容器化配置

### 1.2 `.env` 配置模式

所有 Agent 遵循统一的环境变量前缀 `AGENT_`：

```bash
# 身份标识
AGENT_NAME=code-review          # Agent 名称
AGENT_VERSION=0.1.0             # 语义化版本
AGENT_MODEL_ID=code-review-v1   # 对外暴露的模型 ID

# 服务配置
AGENT_API_KEY=xxx               # Gateway 调用时的认证 Key
AGENT_HOST=127.0.0.1            # 监听地址
AGENT_PORT=8001                 # 监听端口

# AI Provider 配置（可选，Agent 自己管理）
AGENT_UPSTREAM_MODEL=           # 上游模型名
AGENT_UPSTREAM_BASE_URL=        # 上游 API 地址
AGENT_UPSTREAM_API_KEY=         # 上游 API Key
AGENT_UPSTREAM_TIMEOUT_SECONDS= # 上游超时
```

### 1.3 与主后端的关系

```
主后端 (port 2038)                    子后端 Agent (port 8001-8099)
├── services/llm/router.py            ├── 独立的 AI Provider 调用
│   └── 服务于工作流节点执行            │   └── AGENT_UPSTREAM_* 配置
├── services/agent_gateway/            ├── 独立的 .env 管理
│   └── 只做路由转发 + 治理             │   └── AGENT_API_KEY 认证
└── 不管理 Agent 的 upstream           └── 不访问主后端的 Supabase
```

**关键结论**：Gateway 不需要代理 AI 调用，不需要管理 Agent 的 upstream 配置。Gateway 只需要知道 Agent 的 `url` 和 `api_key_env`。

---

## 2. 各 Agent 真实状态

### 2.1 `_template`（模板）

| 维度 | 状态 |
|------|------|
| 端口 | 8000 |
| 代码量 | 最小骨架 |
| 功能 | deterministic stub（echo 响应） |
| 测试 | `test_contract.py` 通过 |
| `.env.example` | ✅ 存在 |
| Dockerfile | ❌ 不存在（目标有） |
| 用途 | 复制即用的模板，不直接运行 |

### 2.2 `code-review-agent`（代码审查）

| 维度 | 状态 |
|------|------|
| 端口 | 8001 |
| 负责人 | 小李 |
| 代码量 | ~1500 行核心（`agent.py`）|
| 功能完成度 | 90%+（规则审查 + upstream 治理 + repo-aware） |
| 测试基线 | **177 passed** |
| `.env.example` | ✅ 存在（含 `AGENT_UPSTREAM_*` 配置） |
| Dockerfile | ❌ 不存在 |
| 来源 | 原创 |

**已具备能力**：
- 四层协议完整实现（health/ready/models/completions）
- non-stream + SSE stream
- 7 类固定规则审查
- 多文件 unified diff 感知
- 结构化 repo-aware 前置输入
- 真实 OpenAI-compatible upstream 调用
- live upstream findings 治理（evidence anchoring、metadata canonicalization、groundedness）
- repo-context forwarding governance
- repo-aware utilization hints

**明确不做**：
- 不读取本地仓库文件
- 不做 embedding / AST / 跨文件推理
- 不透传 provider usage / model

**Phase 5 角色**：Gateway 的首个接入对象，不需要任何修改即可接入。

### 2.3 `deep-research-agent`（深度研究）

| 维度 | 状态 |
|------|------|
| 端口 | 8002 |
| 负责人 | 主系统 → 小李 |
| 当前代码 | **0 行**（仅 README + MIGRATION.md） |
| 源项目 | `D:\project\Agents\ResearchAgents` |
| 源项目功能完成度 | **10%**（Chat 端点是 mock） |
| 迁移难度 | 低（~2h） |
| 迁移计划 | ✅ 已写好（`MIGRATION.md`） |

**源项目兼容性**：
- ✅ FastAPI 框架
- ✅ Pydantic V2 OpenAI 兼容 Schema
- ✅ SSE 格式合规
- ✅ API Key 中间件
- ⚠️ 缺 `/health` 和 `/health/ready`
- ⚠️ Chat 端点是 mock，核心研究管线未实现

**迁移步骤摘要**：
1. `app/` → `src/`（目录重命名）
2. 补充 `/health` + `/health/ready`
3. 添加 `test_contract.py`
4. 更新 `pyproject.toml`

**迁移后状态**：可运行但功能仍是 mock。核心研究管线需要独立开发。

### 2.4 `news-agent`（新闻抓取）

| 维度 | 状态 |
|------|------|
| 端口 | 8003 |
| 负责人 | 主系统 → 小李 |
| 当前代码 | **0 行**（仅 README + MIGRATION.md） |
| 源项目 | `D:\project\Agents\newsAgents\NewsAgents` |
| 源项目功能完成度 | **90%+**（生产可用，41 个数据源） |
| 迁移难度 | 中（~4-6h） |
| 迁移计划 | ✅ 已写好（`MIGRATION.md`） |

**源项目兼容性**：
- ✅ FastAPI 框架
- ✅ 三端点全有（health/models/completions）
- ✅ SSE 格式合规
- ✅ API Key 中间件
- 💡 额外支持 OpenAI Responses API（`/v1/responses`）
- ⚠️ 缺 `/health/ready`，health 缺 `agent` + `version` 字段
- ⚠️ 目录结构 `server/` 而非 `src/`
- ⚠️ ~60 文件，含 84KB 的 `last30days.py`

**迁移步骤摘要**：
1. `server/app.py` 拆分为 `main.py` + `router.py` + endpoints
2. `lib/` → `src/lib/`（整体搬迁，不拆分内部）
3. `server/pipeline.py` + `progress_sse.py` → `src/core/`
4. 修复所有 import 路径（最耗时）
5. 补充 health 字段 + `/health/ready`
6. 添加 `test_contract.py`

**迁移后状态**：功能基本完整，41 个数据源可用。

**风险点**：
- `lib/` 内部 41 个文件交叉引用复杂
- `last30days.py`（84KB）是核心入口
- Cookie 相关模块在服务器环境可能不可用

### 2.5 `study-tutor-agent`（学习专家）

| 维度 | 状态 |
|------|------|
| 端口 | 8004 |
| 负责人 | 待定 |
| 当前代码 | **0 行**（仅 README） |
| 来源 | 从零新建 |
| 开发难度 | 高 |

**规划能力**：
- 知识点深度解析
- 学习路径推荐
- 薄弱环节诊断
- 互动式 Q&A 辅导

**开发路径**：从 `_template` 复制，实现 `src/core/agent.py`。需要设计 system prompt 和学习辅导逻辑。

### 2.6 `visual-site-agent`（可视化网站生成）

| 维度 | 状态 |
|------|------|
| 端口 | 8005 |
| 负责人 | 待定 |
| 当前代码 | **0 行**（仅 README） |
| 来源 | 从零新建 |
| 开发难度 | 高 |

**规划能力**：
- 从文本/思维导图生成静态网页
- 学习报告可视化
- 知识图谱可视化
- 导出为 HTML/PDF

**开发路径**：从 `_template` 复制，实现 `src/core/agent.py`。需要集成 HTML 生成能力。

---

## 3. 迁移/开发优先级建议

| 优先级 | Agent | 理由 | 负责人 | 预估时间 |
|--------|-------|------|--------|---------|
| 1 | `code-review-agent` | 已完成，Gateway 首个接入对象 | — | 0（已就绪） |
| 2 | `news-agent` | 源项目功能最完整（90%+），迁移后即可用 | 小李 | 4-6h |
| 3 | `deep-research-agent` | 迁移简单但功能是 mock | 小李 | 2h |
| 4 | `study-tutor-agent` | 从零新建，需要设计 | 待定 | 数天 |
| 5 | `visual-site-agent` | 从零新建，需要设计 | 待定 | 数天 |

**建议**：
- 小李在 Gateway 就绪后，优先迁移 `news-agent`（功能最完整，迁移后立即有价值）
- `deep-research-agent` 迁移简单但功能是 mock，可以作为 Gateway 多 Agent 接入的验证
- `study-tutor-agent` 和 `visual-site-agent` 不在 Phase 5 scope 内

---

## 4. Gateway 接入流程（通用）

每个 Agent 迁移/开发完成后，接入 Gateway 的步骤：

### Step 1：确认四层契约

```bash
cd agents/<agent-name>
pytest tests/test_contract.py -v
```

### Step 2：在 agents.yaml 中注册

```yaml
# backend/config/agents.yaml
agents:
  <agent-name>:
    url: http://127.0.0.1:<port>
    timeout: 45
    max_retries: 2
    api_key_env: AGENT_<UPPER_NAME>_KEY
    models:
      - <agent-name>-v1
    enabled: true
    description: "<描述>"
    owner: "<负责人>"
```

### Step 3：在主后端 .env 中添加 Agent API Key

```bash
# backend/.env
AGENT_<UPPER_NAME>_KEY=<与 Agent .env 中 AGENT_API_KEY 一致的值>
```

### Step 4：验证端到端

```bash
# 启动 Agent
cd agents/<agent-name>
python -m src.main

# 通过 Gateway 调用
curl -X POST http://localhost:2038/api/agents/<agent-name>/chat \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "test"}], "stream": false}'
```

### Step 5：更新 CI matrix

```yaml
# .github/workflows/ci-agents.yml
strategy:
  matrix:
    agent: [code-review-agent, <new-agent-name>]
```

---

## 5. 端口分配表（完整）

| 端口 | 用途 | 负责人 | 状态 |
|------|------|--------|------|
| 2037 | 主前端（Next.js） | — | 已占用 |
| 2038 | 主后端（FastAPI） | — | 已占用 |
| 8000 | `_template`（开发测试） | — | 仅模板 |
| 8001 | `code-review-agent` | 小李 | ✅ 可运行 |
| 8002 | `deep-research-agent` | 小李 | ⚠️ 待迁移 |
| 8003 | `news-agent` | 小李 | ⚠️ 待迁移 |
| 8004 | `study-tutor-agent` | 待定 | 📋 规划中 |
| 8005 | `visual-site-agent` | 待定 | 📋 规划中 |
| 8006-8099 | 未来 Agent | — | 按需分配 |

---

## 6. 共同基础设施需求

### 6.1 当前缺失（所有 Agent 共同）

| 缺失项 | 影响 | 建议时机 |
|--------|------|---------|
| Dockerfile | 无法容器化部署 | Agent 迁移时一并补充 |
| docker-compose.yml | 无法一键启动多 Agent | Agent 迁移时一并补充 |
| pyproject.toml | 部分 Agent 缺少 | Agent 迁移时一并补充 |
| 结构化日志 | 日志格式不统一 | Gateway 就绪后统一推进 |

### 6.2 建议的 Dockerfile 模板

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ src/

EXPOSE 800X

CMD ["python", "-m", "src.main"]
```

### 6.3 建议的 docker-compose.yml 模板

```yaml
version: '3.8'
services:
  agent:
    build: .
    ports:
      - "800X:800X"
    env_file:
      - .env
    restart: unless-stopped
```
