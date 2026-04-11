# Phase 4: 节点系统单一事实源 + 子后端样板

> 预估时间：10 天
> 前置依赖：Phase 1 全部冻结
> 负责人：羽升（节点）+ 小李（子后端样板）
> 可并行：Phase 2 + Phase 3

---

## 目标

1. **节点系统**：消除 7 处重复定义，实现后端 manifest 作为唯一事实源
2. **子后端样板**：让小李 能拿着模板独立开发 Agent

---

## 当前真实状态（2026-04-11）

### Part A：工程主线已完成

- 节点自动发现机制已真实存在，当前落在 `backend/app/nodes/__init__.py`，不是文档初稿中的 `_registry.py`
- `backend/app/nodes/_base.py` 已具备：
  - `display_name`
  - `renderer`
  - `version`
- `changelog`
- `/api/nodes/manifest` 已真实返回 `display_name / renderer / version / changelog`
- 前端输出 renderer 已接入 manifest `renderer`
- `NodeStoreDefaultView.tsx` 已按 manifest 驱动动态分组渲染，并保留静态 fallback
- 19 个官方节点已显式声明 `version / changelog`，形成第一版治理基线；`community_node` 继续排除在官方治理基线外
- `workflow-meta.ts` 仍继续承担部分结构性元数据职责，但当前属于后续 deprecate 长尾，不再作为本阶段主线 blocker

### Part B：前两个闭环已完成

- `agents/_template/` 已从“不存在”推进为最小可运行模板
- `agents/code-review-agent/` 已从“只有 README”推进为可运行实例，并已从 deterministic stub 升级为规则型本地真实审查 Agent
- 当前 `agents/_template/` 与 `agents/code-review-agent/` 都已具备：
  - `GET /health`
  - `GET /v1/models`
  - `POST /v1/chat/completions`
  - non-stream / SSE stream
  - API Key 校验
  - `test_contract.py`
- 当前 `code-review-agent` 额外已具备：
  - 最新一条 `user` 消息的输入解析（`unified_diff / code_snippet / plain_text`）
  - 结构化 repo-aware 前置输入：`review_target / repo_context` 封装、context 文件计数、review target path 感知
  - 7 类固定规则审查：`hardcoded_secret / dangerous_eval_or_exec / unsafe_html_sink / shell_command_execution / tls_verification_disabled / debug_artifact / broad_exception_swallow`
  - 多文件 unified diff 感知：文件路径、目标新增行号、以及同规则同文件去重
  - 稳定的 `Summary + Findings + Limitations` 输出格式
  - `heuristic / upstream_reserved / upstream_openai_compatible` 三种 review backend seam
  - 真实 OpenAI-compatible non-stream upstream 调用，以及配置缺失、超时、HTTP 异常、空内容、非法 JSON、非法 findings 的严格回退
  - 真实 provider streaming：`stream=True + upstream_openai_compatible` 已接通，但仍坚持“稳定模板优先”，会先在服务端完整消费并校验上游 JSON findings，再按当前 SSE 外壳输出内容 chunk
  - live upstream findings 治理已落地：会丢弃 `repo_context` findings、将 single-target foreign `file_path` 收口到 `review_target`、丢弃 multi-file diff foreign 文件、清空越界 `line_number`、去重重复 findings，并在治理后全丢弃时严格回退到 `heuristic`
  - repo-context forwarding 治理已落地：会先对 `repo_context` 做路径归一化、丢弃与 `review_target` 重复的 context、按路径去重、按 `same_dir / same_top_level / same_extension / other` 排序，并按 `4` 文件 / 单文件 `80` 行 / 总计 `200` 行预算裁剪；超限内容会以 `... [truncated]` 标记后再 forward 给 upstream
  - repo-aware utilization hints 已落地：upstream system prompt 已明确“findings 只能针对 `review_target`、`repo_context` 只能辅助解释 review target 风险”；upstream user prompt 也已补入 `review scope hint`、逐 context 的 `shared identifiers`、`usage priority`，并继续保留 `relationship / truncated` 提示
  - 定向规则逻辑测试闭环

### Part B：仍未完成

- `code-review-agent` 当前仍不读取本地仓库文件，也没有完整跨文件 / 全仓库推理
- `code-review-agent` 当前仍不透传 provider usage，也不暴露 provider model；live upstream 已覆盖 non-stream 与 streaming，但公共响应继续保持稳定文本模板与现有 SSE 外壳
- `backend/config/agents.yaml`、Agent Gateway、`/api/agents/*` 尚未开始
- 其他 agent 目录仍未迁移成真实可运行骨架
- Docker / compose / pyproject 等外圈基础设施本轮未纳入

> [!NOTE]
> 当前默认下一步不再是“补 `_template` 与 `code-review-agent` 最小骨架”，也不再是“先做 repo-aware 利用层深化”，而是：
> 1. 继续推进 **Phase 4B 深化**（首选更进一步的 repo-aware 利用效果评估 / 治理，其次 Gateway 前置设计准备；若继续做治理，应是更进一步的上游治理细化）
> 2. `workflow-meta.ts` 的 deprecate 收口继续保留在 **Phase 4A 长尾** 中，但不再作为当前 blocker

---

## Part A：节点系统单一事实源（主系统）

### Task 4A.1：实现动态节点发现

> [!NOTE]
> **当前真实状态**：自动发现机制已实现，当前落在 `backend/app/nodes/__init__.py`。后续是否独立抽为 `_registry.py`，属于代码组织层优化，不再是“从零开始实现动态发现”。

**替换当前的静态导入**：

```python
# 当前 nodes/__init__.py：手动 import 每个节点
from app.nodes.generation.quiz_gen.node import QuizGenNode
# ... 重复 20+ 行

# 目标 nodes/_registry.py：动态发现
import importlib
import pkgutil
from pathlib import Path
from app.nodes._base import BaseNode

_NODE_REGISTRY: dict[str, type[BaseNode]] = {}

def discover_nodes():
    """扫描 nodes/ 下所有模块，自动注册 BaseNode 子类"""
    nodes_dir = Path(__file__).parent
    for category_dir in nodes_dir.iterdir():
        if not category_dir.is_dir() or category_dir.name.startswith('_'):
            continue
        for node_dir in category_dir.iterdir():
            if not node_dir.is_dir() or node_dir.name.startswith('_'):
                continue
            try:
                module = importlib.import_module(
                    f"app.nodes.{category_dir.name}.{node_dir.name}.node"
                )
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if (isinstance(attr, type) 
                        and issubclass(attr, BaseNode) 
                        and attr is not BaseNode
                        and hasattr(attr, 'node_type')):
                        _NODE_REGISTRY[attr.node_type] = attr
            except ImportError:
                pass

def get_registry():
    if not _NODE_REGISTRY:
        discover_nodes()
    return _NODE_REGISTRY
```

### AI 编程易出问题的点

> [!WARNING]
> 1. **`__pycache__` 干扰**：`iterdir()` 会包含 `__pycache__`，必须过滤
> 2. **`community/node.py`**：社区节点的加载机制不同于标准节点，需要特殊处理
> 3. **启动性能**：动态发现比静态导入慢 ~50ms，但只在启动时执行一次，可接受
> 4. **热重载**：开发模式下 uvicorn reload 会触发重新发现，要确保 registry 被正确清空

---

### Task 4A.2：扩展 Manifest API

> [!NOTE]
> **当前真实状态**：已完成。`display_name / renderer / version` 已在 `backend/app/nodes/_base.py::BaseNode.get_manifest()` 中真实返回。

在 `/api/nodes/manifest` 返回的每个节点增加 `renderer` 字段：

```python
# nodes/_base.py 增加
class BaseNode(ABC):
    node_type: str
    category: str 
    description: str = ""
    renderer: str = "default"  # 新增：告诉前端用哪个渲染器
    version: str = "1.0.0"     # 新增：节点版本
```

**Manifest 输出示例**：

```json
[
  {
    "type": "quiz_gen",
    "category": "generation",
    "display_name": "测验生成",
    "description": "根据学习内容自动生成测验题",
    "renderer": "QuizRenderer",
    "version": "1.0.0",
    "config_schema": { ... }
  }
]
```

### AI 编程易出问题的点

> [!WARNING]
> 1. **向后兼容**：`renderer` 必须有默认值，不能 break 现有 manifest 消费方
> 2. **前端 renderer 名不等于组件文件名**：需要维护一个 `RENDERER_NAME → Component` 的映射表

---

### Task 4A.3：消除前端冗余节点定义

> [!NOTE]
> **当前真实状态**：主线已完成。前端 renderer 选择、多处 UI 文案与 `NodeStoreDefaultView.tsx` 动态分组均已切到 manifest-first，并保留静态 fallback；`workflow-meta.ts` 的结构职责收缩仍待后续 deprecate 收口。

按 Phase 3 Task 3.5 的准备工作，让前端逐步转向 manifest-first：

1. `frontend/src/types/workflow.ts` 中的 `NodeType` 改为从 manifest 动态获取或作为 fallback
2. `workflow-meta.ts` 中的节点元数据（display_name, description, icon）改为从 manifest 读取
3. `NodeStoreDefaultView.tsx` 中的分组从 manifest 的 `category` 字段动态生成
4. `renderers/index.ts` 的 RENDERER_REGISTRY 改用动态 registry（带静态兜底）

### 剩余迁移顺序

```
Step 1-3: 已完成（manifest 扩展 + manifest 缓存层 + NodeStoreDefaultView 动态接线）
Step 4: workflow-meta.ts 标记为 deprecated
Step 5: 6 个月后删除 workflow-meta.ts
```

> [!CAUTION]
> 不要一次性删除所有前端定义！必须有过渡期，前端保留静态定义作为 fallback。

---

### Task 4A.4：节点版本管理基础设施

> [!NOTE]
> **当前真实状态**：第一版治理基线已完成。19 个官方节点已显式声明 `version / changelog`，manifest 契约已返回 `changelog`；`community_node` 继续排除在官方治理基线外。当前仍未进入版本升级策略、比较工具和前端展示阶段。

为每个节点增加版本字段：

```python
class QuizGenNode(BaseNode):
    node_type = "quiz_gen"
    version = "1.2.0"
    
    # 可选：迁移历史
    changelog = {
        "1.0.0": "初始版本",
        "1.1.0": "增加 difficulty 参数",
        "1.2.0": "支持多语言",
    }
```

---

## Part B：子后端 Agent 样板（小李）

> 📄 **详细协议规范**：[agent-architecture.md](agent-architecture.md)（四层接口协议完整 Schema）
> 📄 **开发指南**：[agents/README.md](../../../../agents/README.md)（三步创建 + 端口分配 + FAQ）

### Task 4B.1：创建模板仓库结构

> [!NOTE]
> **当前真实状态**：最小模板结构已落地，但当前范围刻意只覆盖最小运行骨架；`prompts.py`、`Dockerfile`、`docker-compose.yml`、`pyproject.toml` 仍未纳入。

> [!IMPORTANT]
> Agent 目录位于项目根级 `agents/`（不是 `services/`），每个 Agent 独立。

```
agents/
├── README.md                     # 开发总指南
│
├── _template/                    # 模板（复制即用）
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI 入口 + uvicorn.run()
│   │   ├── config.py             # pydantic-settings 配置
│   │   ├── router.py             # 路由注册
│   │   ├── endpoints/
│   │   │   ├── __init__.py
│   │   │   ├── health.py         # GET /health
│   │   │   ├── models.py         # GET /v1/models
│   │   │   └── completions.py    # POST /v1/chat/completions
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── agent.py          # Agent 核心逻辑（开发者填充）
│   │   │   └── prompts.py        # Prompt 模板
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── request.py        # ChatCompletionRequest
│   │   │   └── response.py       # ChatCompletionResponse / Chunk
│   │   └── middleware/
│   │       ├── __init__.py
│   │       └── auth.py           # API Key 验证中间件
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py           # pytest fixtures（TestClient）
│   │   ├── test_health.py
│   │   ├── test_models.py
│   │   ├── test_completions.py
│   │   └── test_contract.py      # 四层兼容性契约测试
│   ├── .env.example
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── pyproject.toml
│   ├── requirements.txt
│   └── README.md
│
└── code-review-agent/            # 第一个实际 Agent（小李）
    └── ...（同 _template 结构）
```

### Task 4B.2：实现一个最小 Agent 样板

> [!NOTE]
> **当前真实状态**：最小三端点样板已完成，且 `code-review-agent` 已进一步从 deterministic stub 推进为规则型真实审查 Agent。当前已具备结构化 repo-aware 前置输入、稳定纯文本 findings 模板、真实 OpenAI-compatible non-stream + streaming upstream、live upstream findings 治理、repo-context forwarding governance、repo-aware utilization hints 与严格回退；但仍不读取本地仓库文件，也未进入完整跨文件 / 全仓库推理。

以 `code-review-agent` 为例，实际实现 3 个必要端点：

1. `GET /health` → 健康检查（返回 status, agent, version）
2. `GET /v1/models` → 模型列表（OpenAI 兼容格式）
3. `POST /v1/chat/completions` → Chat Completions（支持 stream/non-stream）

当前 `src/core/agent.py` 已额外具备：

1. 输入类型识别：`unified_diff / code_snippet / plain_text`
2. 结构化 repo-aware 前置输入：`review_target / repo_context`、context 计数、review target path 感知
3. 7 类固定规则审查：硬编码密钥、危险动态执行、危险 HTML sink、Shell 命令执行、关闭 TLS 校验、调试遗留、宽泛吞错
4. 稳定文本输出：`Summary + Findings + Limitations`
5. 多文件 unified diff 感知：仅分析新增行，并输出目标文件路径与行号
6. `heuristic / upstream_reserved / upstream_openai_compatible` 三种内部 review backend
7. 真实 OpenAI-compatible non-stream upstream 调用与严格回退
8. `stream=True + upstream_openai_compatible` 时会真实消费 provider stream，但继续先在服务端归一化 findings，再按现有 SSE 外壳输出
9. live upstream findings 治理：过滤 `repo_context` findings、收口或丢弃 foreign `file_path`、清空越界 `line_number`、去重重复 findings，并在治理后全丢弃时严格回退
10. repo-context forwarding 治理：对 forwarded context 做归一化、去重、关系排序与预算裁剪，并显式标记 `truncated`
11. repo-aware utilization hints：在 upstream prompt 中显式注入 `review scope hint`、逐 context 的 `shared identifiers`、`usage priority`，并继续保留 `relationship / truncated`
12. 只分析最新一条 `user` 消息；历史消息仅参与 prompt token 统计

### Task 4B.3：编写四层契约测试

> [!NOTE]
> **当前真实状态**：已完成“协议 + 规则逻辑”双层测试闭环。`agents/_template/tests/test_contract.py` 与 `agents/code-review-agent/tests/test_contract.py` 已通过；`agents/code-review-agent/tests/test_review_logic.py` 已覆盖 7 类规则命中、clean case、最新 user 消息边界、多文件 diff 路径/行号、unified diff 仅检查新增行、结构化 repo-aware 输入边界、稳定文本输出模板、live upstream non-stream / streaming 成功与 strict fallback 路径、findings 治理场景，以及 prompt forwarding + utilization hints 场景。当前测试基线已推进到 `66 passed`。

```python
# tests/test_contract.py
"""验证子后端是否符合 Agent Gateway 四层契约"""

# Layer 1: Request
def test_accepts_valid_request(client): ...
def test_rejects_missing_model(client): ...
def test_rejects_empty_messages(client): ...
def test_rejects_invalid_api_key(client): ...

# Layer 2: Response
def test_non_stream_response_format(client):
    r = client.post("/v1/chat/completions", json={
        "model": "test-agent",
        "messages": [{"role": "user", "content": "hello"}],
        "stream": False,
    })
    data = r.json()
    assert data["object"] == "chat.completion"
    assert len(data["choices"]) > 0
    assert "usage" in data

def test_stream_response_sse_format(client):
    r = client.post("/v1/chat/completions", json={
        "model": "test-agent",
        "messages": [{"role": "user", "content": "hello"}],
        "stream": True,
    })
    lines = r.text.strip().split("\n")
    assert any(line.startswith("data: ") for line in lines)
    assert lines[-1] == "data: [DONE]"

def test_error_response_format(client): ...

# Layer 3: Runtime
def test_health_endpoint(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert "status" in data
    assert "agent" in data
    assert "version" in data

def test_models_endpoint(client):
    r = client.get("/v1/models")
    data = r.json()
    assert data["object"] == "list"
    assert len(data["data"]) > 0

# Layer 4: Governance
def test_request_id_propagation(client): ...
```

### Task 4B.4：编写子后端开发文档

已在 `agents/README.md` 中完成，包含：
- 三步创建新 Agent（复制模板 → 实现逻辑 → Gateway 注册）
- 四层兼容性速查
- 端口分配表
- 本地开发流程
- CI 配置
- FAQ

### AI 编程易出问题的点

> [!WARNING]
> 1. **OpenAI SDK 版本**：子后端 Agent 内部使用 OpenAI SDK 调用上游 AI，确保 `openai>=1.60` 的 API 兼容
> 2. **流式 SSE 格式**：必须是 `data: {json}\n\n`，注意双换行。AI 经常忘记 `\n\n`
> 3. **CORS**：子后端的 CORS 在开发阶段设 `allow_origins=["*"]`，生产环境必须限制
> 4. **端口冲突**：多个 Agent 在本地跑时要分配不同端口（8001 起递增）
> 5. **目录位置**：是 `agents/`（项目根级），不是 `backend/app/services/`，不要搞混

---

## Phase 4 完成标志

### Part A（节点系统）

- [x] 节点自动发现机制已实现（当前落在 `nodes/__init__.py`）
- [x] Manifest API 返回 `renderer` 和 `version` 字段
- [x] 前端 NodeStoreDefaultView 可从 manifest 动态分组渲染（带静态兜底）
- [x] 所有官方节点形成独立版本治理（当前为第一版 `version/changelog` 基线，不含升级策略/前端展示）

### Part B（子后端样板）

- [x] `agents/_template/` 模板已可直接复制使用
- [x] `agents/code-review-agent/` 已有 1 个最小可运行 Agent
- [x] 四层契约测试（`test_contract.py`）已通过最小闭环验证
- [x] `code-review-agent` 已完成首个规则型能力闭环（7 条固定审查规则 + 多文件 diff 感知）
- [x] `agents/README.md` 开发指南已编写
- [x] `agent-architecture.md` 接口协议规范已冻结

> [!IMPORTANT]
> **Phase 4 当前最准确的判断**：
> - Part A：工程主线已完成；仅剩 `workflow-meta.ts` 的长期 deprecate 长尾
> - Part B：最小样板已完成，且 `code-review-agent` 已进入规则型真实能力阶段；后续进入 4B 深化阶段
> - Phase 5 的 Agent Gateway / Wiki / 治理层仍未开始，不应混入当前波次

> [!IMPORTANT]
> Part A 和 Part B 完全独立，可同时进行。Part B 由小李 负责，只需遵守 Phase 1 冻结的 Agent Gateway 契约。
> 详细四层协议定义见 [agent-architecture.md](agent-architecture.md)。
