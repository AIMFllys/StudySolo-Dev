<!-- 编码：UTF-8 -->

# StudySolo 2026-04-11 阶段总结：Phase 4B Agent 最小可运行样板首个闭环

**完成日期**：2026-04-11  
**状态**：Phase 4 当前唯一活跃主线中的首个 4B 闭环已落地；`agents/_template/` 与 `agents/code-review-agent/` 现已具备最小可运行、最小可测试、最小可复制的骨架  
**覆盖范围**：Phase 4B 子后端 Agent 样板的首次真实落地，包括 `_template`、`code-review-agent`、最小 OpenAI-compatible 协议、契约测试、运行入口与本轮明确不做的边界

## 1. 执行摘要

截至 2026-04-11，这一轮的真实成果不是“补 README”或“继续画计划图”，而是把 Phase 4B 从纯文档规划推进到了首个可执行闭环：

1. `agents/_template/` 已从不存在，推进为一个可直接复制的新 Agent 最小样板
2. `agents/code-review-agent/` 已从“只有 README”推进为一个可运行的 deterministic stub Agent
3. 两者都已经跑通：
   - `GET /health`
   - `GET /v1/models`
   - `POST /v1/chat/completions`
   - non-stream JSON 响应
   - SSE stream 响应
   - API Key 校验
   - 最小契约测试
4. 这次闭环刻意没有把 Phase 5 Gateway 集成、Docker、真实上游 LLM、其他 agent 迁移混进来

换句话说，Phase 4B 现在不再只是“将来要做的目录设计”，而是已经有了两个真实可运行、可验证、可复制的本地基线。

## 2. 改动前的真实状态

本轮开始前，`agents/` 目录的真实状态是：

1. `agents/_template/` 不存在
2. `agents/code-review-agent/` 只有 README，没有 `src/`、没有测试、没有入口、没有配置
3. `agents/deep-research-agent/` 与 `agents/news-agent/` 只有 README 与迁移说明，没有落地骨架
4. 仓库内不存在：
   - `backend/config/agents.yaml`
   - Agent Gateway 主后端接线
   - `/api/agents/*` 转发入口

因此，这一轮的正确边界不是“顺手做完整 Agent 平台”，而是先把 **最小样板** 和 **首个实例 Agent** 做出来，锁住协议与测试基线。

## 3. `_template` 已完成的完整改动

`agents/_template/` 本轮新增了完整最小骨架。

### 3.1 运行与配置入口

新增文件：

- `agents/_template/src/main.py`
- `agents/_template/src/config.py`
- `agents/_template/src/router.py`
- `agents/_template/src/__init__.py`

实际落地内容：

1. 入口固定为 `python -m src.main`
2. `config.py` 使用 `pydantic-settings`
3. 通过环境变量统一提供：
   - `AGENT_NAME`
   - `AGENT_VERSION`
   - `AGENT_MODEL_ID`
   - `AGENT_API_KEY`
   - `AGENT_HOST`
   - `AGENT_PORT`
4. `main.py` 提供：
   - `create_app()`
   - 应用启动时间记录
   - `X-Request-Id` 透传中间件
   - 统一错误响应处理
5. `router.py` 负责统一挂载标准三端点

### 3.2 标准三端点已落地

新增文件：

- `agents/_template/src/endpoints/health.py`
- `agents/_template/src/endpoints/models.py`
- `agents/_template/src/endpoints/completions.py`

实际落地内容：

1. `GET /health`
   - 返回 `status`
   - 返回 `agent`
   - 返回 `version`
   - 返回 `uptime_seconds`
   - 返回 `models`
2. `GET /v1/models`
   - 返回 OpenAI-compatible `object=list`
   - 返回最小 `model card`
3. `POST /v1/chat/completions`
   - 支持 non-stream
   - 支持 stream
   - 缺 `model` 时返回 `400 / missing_model`
   - `messages` 为空时返回 `400 / empty_messages`
   - API Key 错误时返回 `401 / invalid_api_key`
   - `model` 不匹配时返回 `404 / model_not_found`

### 3.3 协议模型与错误模型已落地

新增文件：

- `agents/_template/src/schemas/request.py`
- `agents/_template/src/schemas/response.py`

实际落地内容：

1. 请求层：
   - `ChatMessage`
   - `ChatCompletionRequest`
2. 响应层：
   - `ChatCompletionResponse`
   - `ChatCompletionChunk`
   - `UsageInfo`
   - `ModelListResponse`
   - `HealthResponse`
3. 错误层：
   - `AgentError`
   - `ErrorResponse`
   - `AgentHTTPError`

### 3.4 认证与 stub agent 已落地

新增文件：

- `agents/_template/src/middleware/auth.py`
- `agents/_template/src/core/agent.py`

实际落地内容：

1. `auth.py`
   - 统一从 `Authorization: Bearer ...` 读取 token
   - 与 `AGENT_API_KEY` 比对
   - 校验失败时返回标准化 `401`
2. `core/agent.py`
   - 提供 deterministic stub agent
   - 不调用网络
   - 不依赖外部 LLM
   - 提供简单 token 估算
   - 提供流式 chunk 切分

### 3.5 测试与最小运行资料已落地

新增文件：

- `agents/_template/tests/conftest.py`
- `agents/_template/tests/test_contract.py`
- `agents/_template/.env.example`
- `agents/_template/requirements.txt`
- `agents/_template/README.md`

实际落地内容：

1. `conftest.py`
   - 构造 `TestClient`
   - 注入最小环境变量
   - 允许在 agent 目录内独立执行 pytest
2. `test_contract.py`
   - 覆盖健康检查
   - 覆盖模型列表
   - 覆盖 API Key 拒绝
   - 覆盖缺 `model`
   - 覆盖空 `messages`
   - 覆盖 non-stream 响应 shape
   - 覆盖 SSE 格式与 `[DONE]`
3. `.env.example`
   - 固定了模板环境变量键名
4. `requirements.txt`
   - 锁定 FastAPI / uvicorn / pydantic / pydantic-settings / httpx / pytest 最小依赖
5. `README.md`
   - 写清运行方式
   - 写清验证方式
   - 写清当前范围

## 4. `code-review-agent` 已完成的完整改动

`agents/code-review-agent/` 本轮从纯说明文档推进为真实骨架实例。

### 4.1 新增同构最小目录

本轮新增：

- `agents/code-review-agent/src/__init__.py`
- `agents/code-review-agent/src/main.py`
- `agents/code-review-agent/src/config.py`
- `agents/code-review-agent/src/router.py`
- `agents/code-review-agent/src/endpoints/health.py`
- `agents/code-review-agent/src/endpoints/models.py`
- `agents/code-review-agent/src/endpoints/completions.py`
- `agents/code-review-agent/src/middleware/auth.py`
- `agents/code-review-agent/src/schemas/request.py`
- `agents/code-review-agent/src/schemas/response.py`
- `agents/code-review-agent/src/core/agent.py`
- `agents/code-review-agent/tests/conftest.py`
- `agents/code-review-agent/tests/test_contract.py`
- `agents/code-review-agent/.env.example`
- `agents/code-review-agent/requirements.txt`

这意味着 `code-review-agent` 不再依赖“以后从模板复制”，而是已经是一个真实实例。

### 4.2 `code-review-agent` 的定制点

相对 `_template`，`code-review-agent` 额外完成了三类定制：

1. 默认配置改为 code review 语义
   - `agent_name = code-review`
   - `model_id = code-review-v1`
   - `port = 8001`
2. `src/core/agent.py`
   - 返回 deterministic code review stub 文本
   - 输出中显式说明当前仍是本地 stub
   - 保留后续替换真实逻辑的清晰入口
3. `README.md`
   - 从“待 Phase 4B 实现”更新为“最小可运行样板已落地”
   - 补齐运行方式
   - 补齐验证方式
   - 补齐当前能力边界

## 5. 本轮实际协议行为

这次闭环不是只有目录结构，而是已经锁住了最小协议行为。

### 5.1 Runtime 层

`GET /health` 当前实际返回：

- `status`
- `agent`
- `version`
- `uptime_seconds`
- `models`

`GET /v1/models` 当前实际返回：

- `object = list`
- 至少一条 `model card`

### 5.2 Request / Response 层

`POST /v1/chat/completions` 当前支持：

1. non-stream
   - 返回 `chat.completion`
   - 返回 `choices`
   - 返回 `usage`
2. stream
   - 返回 `text/event-stream`
   - 首个 chunk 会注入 assistant role
   - 中间 chunk 按内容切片返回
   - 结束前补一个 `finish_reason=stop` chunk
   - 最后固定输出 `data: [DONE]\n\n`

### 5.3 错误层

当前已实现的显式错误分支：

1. `invalid_api_key`
2. `missing_model`
3. `empty_messages`
4. `model_not_found`

### 5.4 治理层里已经补上的最小能力

1. `X-Request-Id` 透传已经落地
2. 两个目录都能独立跑本地 pytest
3. 两个目录都能独立通过 `python -m src.main` 导入应用

## 6. 验证结果

### 6.1 pytest

本轮已明确通过：

- `pytest agents/_template/tests -q`
  - 结果：`7 passed`
- `pytest agents/code-review-agent/tests -q`
  - 结果：`7 passed`

### 6.2 入口导入 smoke

已确认：

1. `_template`
   - `from src.main import app` 可成功导入
2. `code-review-agent`
   - `from src.main import app` 可成功导入

### 6.3 警告说明

pytest 执行时出现过 workspace 根目录 `.pytest_cache` 写入权限 warning。  
该 warning 不来自 agent 代码逻辑，也没有导致测试失败；当前两套契约测试均实际通过。

## 7. 本轮明确没有做的事

为了保持 Phase 4B 的首个闭环边界清晰，这一轮明确没有做以下内容：

1. 不做 `backend/config/agents.yaml`
2. 不做主后端 Agent Gateway
3. 不做 `/api/agents/*` 转发链路
4. 不做 Docker / `docker-compose.yml`
5. 不做 `pyproject.toml`
6. 不接真实 OpenAI 或其他 Provider
7. 不改 `deep-research-agent`、`news-agent`、`study-tutor-agent`、`visual-site-agent`
8. 不碰 Phase 3 冻结边界
9. 不回头继续处理 Phase 4A 的 NodeStore 动态分组

这些都不是“忘了做”，而是本轮为了把 `_template + code-review-agent` 做成一个单独可提交、可验证、可回退的闭环而刻意保留的范围控制。

## 8. 本轮提交与当前判断

### 提交

- `29c4151 feat(agents): scaffold minimal runnable agent template`

### 当前判断

截至本轮完成后，Phase 4B 的状态应从：

- “只有 README 和目标结构文档”

更新为：

- “已经存在最小可运行样板 `_template`”
- “已经存在首个真实实例 `code-review-agent`”
- “协议、测试、运行入口、最小配置均已有本地基线”

这意味着后续继续推进 Phase 4B 时，不需要再从零设计目录，而应直接在现有 `_template` 基线之上扩展。

## 9. 下一步建议

在不混入新主题的前提下，下一步最合理的候选方向只有两类：

1. **继续沿 4B 前进**
   - 把 `code-review-agent` 的 deterministic stub 换成真实代码审查逻辑
   - 仍然不碰 Gateway
2. **补轻量文档同步**
   - 把 Phase 4 官方计划文档中的 4B 状态口径更新为“最小样板已落地，后续进入能力填充”

无论走哪条，当前都不应回头把这个闭环扩成“大而全 Agent 平台重构”。

## 10. 后续补充闭环：`code-review-agent` 规则集深化

在最小样板闭环完成并提交后，随后又补了一个严格受控的小闭环，但仍然只停留在 Phase 4B 内部，不进入 repo-aware、Gateway 或外部模型。

### 10.1 本轮新增能力

`agents/code-review-agent/src/core/agent.py` 进一步从“5 条固定规则”扩展为更实用的一版本地启发式审查器：

1. **新增命令执行面风险识别**
   - `subprocess(..., shell=True)`
   - `os.system(...)`
   - `child_process.exec(...)` / `execSync(...)`
2. **新增 TLS 校验关闭识别**
   - `verify=False`
   - `rejectUnauthorized: false`
   - `ssl._create_unverified_context(...)`
3. **增强宽泛吞错识别**
   - 不再只是匹配单独一行 `except Exception:`
   - 现可识别：
     - `except:`
     - `except Exception as e:`
     - 后续缩进行中的 `pass` / `continue` / `return None`
4. **保持原有边界不变**
   - 仍只分析最新一条 `user` 消息
   - 仍只对 unified diff 的新增行做检查
   - 仍保持“同一规则在同一文件只报首次命中”的去重策略
   - 仍输出 `Summary + Findings + Limitations` 文本，不引入 JSON findings

### 10.2 新增验证

`agents/code-review-agent/tests/test_review_logic.py` 已补齐针对性测试，覆盖：

1. snippet 命中新规则
2. multi-file unified diff 命中新规则并保留正确 `File: path:line`
3. bare `except` + nested `continue` 的宽泛吞错识别
4. 同文件同规则只报一次
5. 安全用法不误报（如 `shell=False`、`verify=True`）

### 10.3 回归结果

- `pytest agents/code-review-agent/tests -q`
  - 结果：`25 passed`

### 10.4 当前 4B 正确口径

截至这一补充闭环后，Phase 4B 对 `code-review-agent` 的正确描述应更新为：

1. 最小 OpenAI-compatible 协议已落地
2. 首个规则型本地真实能力已落地
3. 多文件 diff 感知已落地
4. 第二轮规则集深化已落地
5. 但仍然**不是 repo-aware**，也**没有接外部 LLM**
