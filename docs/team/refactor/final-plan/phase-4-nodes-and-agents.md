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

### Part A：已部分落地

- 节点自动发现机制已真实存在，当前落在 `backend/app/nodes/__init__.py`，不是文档初稿中的 `_registry.py`
- `backend/app/nodes/_base.py` 已具备：
  - `display_name`
  - `renderer`
  - `version`
- `/api/nodes/manifest` 已真实返回 `display_name / renderer / version`
- 前端输出 renderer 已接入 manifest `renderer`

### Part A：仍未完成

- `NodeStoreDefaultView.tsx` 仍保留静态 `NODE_CATEGORIES`，尚未切到按 manifest `category` 动态分组
- `workflow-meta.ts` 仍继续承担大量结构性元数据职责，尚未进入 deprecate 阶段
- 节点 `version` 当前只是字段已存在，尚未形成独立版本治理 / changelog 机制

### Part B：首个闭环已完成

- `agents/_template/` 已从“不存在”推进为最小可运行模板
- `agents/code-review-agent/` 已从“只有 README”推进为最小可运行实例
- 两者都已具备：
  - `GET /health`
  - `GET /v1/models`
  - `POST /v1/chat/completions`
  - non-stream / SSE stream
  - API Key 校验
  - `test_contract.py`

### Part B：仍未完成

- `code-review-agent` 当前仍是 deterministic stub，不是完整代码审查能力
- `backend/config/agents.yaml`、Agent Gateway、`/api/agents/*` 尚未开始
- 其他 agent 目录仍未迁移成真实可运行骨架
- Docker / compose / pyproject 等外圈基础设施本轮未纳入

> [!NOTE]
> 当前默认下一步不再是“补 `_template` 与 `code-review-agent` 最小骨架”，而是：
> 1. 继续推进 **Phase 4B 能力填充**
> 2. 或单独推进 **Phase 4A NodeStore / workflow-meta manifest-first 收口**

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
> **当前真实状态**：已完成前半段。前端 renderer 选择与多处 UI 文案已切到 manifest-first，但 `NodeStoreDefaultView.tsx` 的动态分组、`NodeType` 的进一步动态化，以及 `workflow-meta.ts` 的结构职责收缩尚未完成。

按 Phase 3 Task 3.5 的准备工作，让前端逐步转向 manifest-first：

1. `frontend/src/types/workflow.ts` 中的 `NodeType` 改为从 manifest 动态获取或作为 fallback
2. `workflow-meta.ts` 中的节点元数据（display_name, description, icon）改为从 manifest 读取
3. `NodeStoreDefaultView.tsx` 中的分组从 manifest 的 `category` 字段动态生成
4. `renderers/index.ts` 的 RENDERER_REGISTRY 改用动态 registry（带静态兜底）

### 迁移顺序

```
Step 1: 后端 manifest 添加字段（Task 4A.2）
Step 2: 前端创建 manifest 缓存层
Step 3: NodeStoreDefaultView 改用 manifest 数据
Step 4: workflow-meta.ts 标记为 deprecated
Step 5: 6 个月后删除 workflow-meta.ts
```

> [!CAUTION]
> 不要一次性删除所有前端定义！必须有过渡期，前端保留静态定义作为 fallback。

---

### Task 4A.4：节点版本管理基础设施

> [!NOTE]
> **当前真实状态**：仅字段已落地。`version` 当前统一存在，但仍固定为 `1.0.0`，尚未形成节点级版本演进和 changelog 治理。

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
> **当前真实状态**：已完成最小三端点样板。`code-review-agent` 已可运行，但当前仍是 deterministic stub，未接真实代码审查能力或外部 LLM。

以 `code-review-agent` 为例，实际实现 3 个必要端点：

1. `GET /health` → 健康检查（返回 status, agent, version）
2. `GET /v1/models` → 模型列表（OpenAI 兼容格式）
3. `POST /v1/chat/completions` → Chat Completions（支持 stream/non-stream）

### Task 4B.3：编写四层契约测试

> [!NOTE]
> **当前真实状态**：已完成最小契约测试闭环。`agents/_template/tests/test_contract.py` 与 `agents/code-review-agent/tests/test_contract.py` 均已通过。

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
- [ ] 前端 NodeStoreDefaultView 可从 manifest 动态分组渲染（带静态兜底）
- [ ] 所有官方节点形成独立版本治理（当前仅统一字段存在）

### Part B（子后端样板）

- [x] `agents/_template/` 模板已可直接复制使用
- [x] `agents/code-review-agent/` 已有 1 个最小可运行 Agent
- [x] 四层契约测试（`test_contract.py`）已通过最小闭环验证
- [x] `agents/README.md` 开发指南已编写
- [x] `agent-architecture.md` 接口协议规范已冻结

> [!IMPORTANT]
> **Phase 4 当前最准确的判断**：
> - Part A：底座已搭起，但真正的 manifest-first 收口还没完成
> - Part B：最小样板已完成，后续进入能力填充阶段
> - Phase 5 的 Agent Gateway / Wiki / 治理层仍未开始，不应混入当前波次

> [!IMPORTANT]
> Part A 和 Part B 完全独立，可同时进行。Part B 由小李 负责，只需遵守 Phase 1 冻结的 Agent Gateway 契约。
> 详细四层协议定义见 [agent-architecture.md](agent-architecture.md)。
