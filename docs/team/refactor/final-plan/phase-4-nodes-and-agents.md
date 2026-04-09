# Phase 4: 节点系统单一事实源 + 子后端样板

> 预估时间：10 天
> 前置依赖：Phase 1 全部冻结
> 负责人：主系统负责人（节点）+ 队友 B（子后端样板）
> 可并行：Phase 2 + Phase 3

---

## 目标

1. **节点系统**：消除 7 处重复定义，实现后端 manifest 作为唯一事实源
2. **子后端样板**：让队友 B 能拿着模板独立开发 Agent

---

## Part A：节点系统单一事实源（主系统）

### Task 4A.1：实现动态节点发现

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

## Part B：子后端 Agent 样板（队友 B）

### Task 4B.1：创建模板仓库结构

```
services/
├── custom-agent-template/
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI 入口模板
│   │   ├── agent.py             # Agent 逻辑模板
│   │   ├── prompts.py           # Prompt 模板
│   │   ├── schemas.py           # 请求/响应模型
│   │   └── config.py            # 配置
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_agent.py        # 基本测试
│   │   └── test_health.py       # 健康检查测试
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── README.md                # 使用说明
```

### Task 4B.2：实现一个最小 Agent 样板

以 `code-review-agent` 为例，实际实现 3 个必要端点：

1. `GET /health` → 健康检查
2. `GET /v1/models` → 模型列表
3. `POST /v1/chat/completions` → Chat Completions（支持 stream/non-stream）

### Task 4B.3：编写集成测试

```python
# tests/test_contract.py
"""验证子后端是否符合 Agent Gateway 契约"""

def test_health_endpoint(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert "status" in r.json()
    assert "agent" in r.json()

def test_models_endpoint(client):
    r = client.get("/v1/models")
    data = r.json()
    assert data["object"] == "list"
    assert len(data["data"]) > 0

def test_chat_completions_non_stream(client):
    r = client.post("/v1/chat/completions", json={
        "model": "test-agent",
        "messages": [{"role": "user", "content": "hello"}],
        "stream": False,
    })
    data = r.json()
    assert data["object"] == "chat.completion"
    assert len(data["choices"]) > 0
    assert "usage" in data

def test_chat_completions_stream(client):
    r = client.post("/v1/chat/completions", json={
        "model": "test-agent",
        "messages": [{"role": "user", "content": "hello"}],
        "stream": True,
    })
    # 验证 SSE 格式
    lines = r.text.strip().split("\n")
    assert any(line.startswith("data: ") for line in lines)
    assert lines[-1] == "data: [DONE]"
```

### Task 4B.4：编写子后端开发文档

输出 `services/custom-agent-template/README.md`，包含：
- 快速开始（5 分钟创建一个新 Agent）
- 必须实现的 3 个端点
- 四层兼容性 checklist
- API Key 管理方式
- 本地测试方式

### AI 编程易出问题的点

> [!WARNING]
> 1. **OpenAI SDK 版本**：子后端 Agent 内部使用 OpenAI SDK 调用上游 AI，确保 `openai>=1.60` 的 API 兼容
> 2. **流式 SSE 格式**：必须是 `data: {json}\n\n`，注意双换行。AI 经常忘记 `\n\n`
> 3. **CORS**：子后端的 CORS 在开发阶段设 `allow_origins=["*"]`，生产环境必须限制
> 4. **端口冲突**：多个 Agent 在本地跑时要分配不同端口（8001, 8002, ...）

---

## Phase 4 完成标志

### Part A（节点系统）

- [ ] 动态节点发现 `_registry.py` 已实现并替代 `__init__.py` 静态导入
- [ ] Manifest API 返回 `renderer` 和 `version` 字段
- [ ] 前端 NodeStoreDefaultView 可从 manifest 动态渲染（带静态兜底）
- [ ] 所有官方节点有 `version` 字段

### Part B（子后端样板）

- [ ] `custom-agent-template/` 模板可直接复制使用
- [ ] 至少 1 个实际 Agent（如 code-review-agent）可运行
- [ ] 集成测试全部通过（契约层）
- [ ] 子后端开发文档已编写

> [!IMPORTANT]
> Part A 和 Part B 完全独立，可同时进行。Part B 由队友 B 负责，只需遵守 Phase 1 冻结的 Agent Gateway 契约。
