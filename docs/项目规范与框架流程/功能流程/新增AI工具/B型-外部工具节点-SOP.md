# B 型 — 外部工具节点 SOP

> 最后更新：2026-03-27
> 编码要求：UTF-8
> 前置：必须先完成 [00-节点与插件分类判断.md](./00-节点与插件分类判断.md) 的分类确认

适用场景：节点需要调用第三方 API、文件处理库或外部服务，不只依赖 LLM 调用。

---

## 0. 先做节点模式判断

B 型节点有三种内部模式，实现方式有所不同：

| 模式 | 描述 | 典型节点 | `is_llm_node` |
|------|------|---------|:-------------:|
| **B-Tool** | 纯工具节点，不调用 LLM | `export_file`、`write_db` | `False` |
| **B-Search** | 先调外部 API，返回数据，不再加工 | `knowledge_base`、`web_search`（基础版）| `False` |
| **B-Augmented** | 先调外部 API，再把结果喂给 LLM 做加工 | `web_search`（LLM 总结版）| `True` |

**判断原则**：如果外部 API 的原始数据已经足够有意义，不需要 LLM，选 B-Tool 或 B-Search。如果 LLM 能让输出更好（总结、提炼、格式化），选 B-Augmented。

---

## 1. 确认外部服务信息

在写任何代码前，必须明确：

| 项目 | 说明 |
|------|------|
| **服务名称** | 如 Tavily、Pypdf、Pandoc |
| **API 文档地址** | 确认接口契约 |
| **认证方式** | API Key / OAuth / 无需认证 |
| **费率与计费** | 是否需要在 `ss_ai_usage_events` 中单独记录？ |
| **环境变量名** | 遵循 `XXXX_API_KEY` 格式 |
| **超时设置** | 该服务的合理超时时间（一般 5~30s）|
| **错误码** | 常见错误码的处理策略（是否需要重试？）|

---

## 2. 确定节点分类

```
B-Tool / B-Search  →  category = "output" 或 "input"（数据 IO 类）
                       → 也可放 "analysis" 如果节点做检索分析

B-Augmented        →  按 LLM 能力所属分类
                       → content_extract 类 → "generation"
                       → 搜索总结类 → "generation"
```

---

## 3. 后端：创建节点包

### 3.1 文件夹结构

```
backend/app/nodes/<category>/<node_type>/
├── __init__.py          ← 必须，空文件
├── node.py              ← 节点实现（必须）
├── prompt.md            ← B-Augmented 节点必须，B-Tool 可选
└── validator.py         ← 可选：Pydantic 输出结构校验
```

### 3.2 核心原则：服务层封装

> ⚠️ **禁止**在 `node.py` 的 `execute()` 中直接写 `requests.get(...)` 或 `httpx.request(...)`。

所有外部 API 调用必须封装到独立的 Service 层：

```
backend/app/services/<tool_name>_service.py
```

**Service 层封装规范**：

```python
# backend/app/services/tavily_service.py

import os
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_TAVILY_API_KEY_ENV = "TAVILY_API_KEY"
_TAVILY_BASE_URL = "https://api.tavily.com"
_DEFAULT_TIMEOUT = 10.0


class TavilyServiceError(Exception):
    """Raised when Tavily API call fails."""


def _get_api_key() -> str:
    key = os.getenv(_TAVILY_API_KEY_ENV, "").strip()
    if not key:
        raise TavilyServiceError(
            f"Missing environment variable: {_TAVILY_API_KEY_ENV}"
        )
    return key


async def search(
    query: str,
    max_results: int = 5,
    search_depth: str = "basic",
) -> list[dict[str, Any]]:
    """Execute a Tavily web search.

    Returns:
        List of result dicts with keys: title, url, content, score.

    Raises:
        TavilyServiceError: On API error or missing config.
    """
    api_key = _get_api_key()
    payload = {
        "api_key": api_key,
        "query": query,
        "max_results": max_results,
        "search_depth": search_depth,
    }

    try:
        async with httpx.AsyncClient(timeout=_DEFAULT_TIMEOUT) as client:
            response = await client.post(
                f"{_TAVILY_BASE_URL}/search",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
    except httpx.TimeoutException as e:
        raise TavilyServiceError(f"Tavily search timeout: {e}") from e
    except httpx.HTTPStatusError as e:
        raise TavilyServiceError(
            f"Tavily API error {e.response.status_code}: {e.response.text}"
        ) from e

    return data.get("results", [])
```

**Service 层必须做到的几点**：

1. **密钥从环境变量读取**，不硬编码，不写 config.yaml（连接信息与流媒体路由配置分离）
2. **明确的自定义异常**（`XxxServiceError`），不直接暴露底层 HTTP 异常给引擎
3. **设置合理超时**（默认10s，可配置）
4. **async 实现**，配合引擎的异步环境

### 3.3 编写 `node.py`

#### 模板 B-Tool（纯工具节点）

```python
"""<节点功能描述>."""

from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput, NodeOutput
from app.services.<tool>_service import <Tool>ServiceError, <action>


class <NodeName>Node(BaseNode):
    node_type = "<node_type>"
    category = "<category>"
    description = "<中文功能描述>"
    is_llm_node = False            # ← 工具节点
    output_format = "passthrough"  # 或 "json"
    icon = "<Emoji>"
    color = "<hex>"
    config_schema = [
        # 声明节点参数（从前端 node.data.config 读取）
        # {"key": "param_name", "type": "str", "default": "value", "label": "参数标签"},
    ]

    async def execute(
        self,
        node_input: NodeInput,
        llm_caller: Any,           # 不使用，但签名必须保持一致
    ) -> AsyncIterator[str]:
        # 从 node_config 读取参数（禁止从 label 嗅探）
        config = node_input.node_config or {}
        param = config.get("param_name", "default_value")

        try:
            result = await <action>(param)
            yield str(result)
        except <Tool>ServiceError as e:
            yield f"[工具错误] {e}"
```

#### 模板 B-Augmented（工具 + LLM 增强）

```python
"""<节点功能描述>."""

import json
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput
from app.nodes._mixins import LLMStreamMixin
from app.services.<tool>_service import <Tool>ServiceError, <action>


class <NodeName>Node(BaseNode, LLMStreamMixin):
    node_type = "<node_type>"
    category = "<category>"
    description = "<中文功能描述>"
    is_llm_node = True    # ← LLM 参与处理
    output_format = "markdown"
    icon = "<Emoji>"
    color = "<hex>"
    config_schema = [
        {"key": "max_results", "type": "int", "default": 5, "label": "最大结果数"},
    ]

    async def execute(
        self,
        node_input: NodeInput,
        llm_caller: Any,
    ) -> AsyncIterator[str]:
        # 1. 读取配置
        config = node_input.node_config or {}
        max_results = int(config.get("max_results", 5))

        # 2. 调用外部服务
        try:
            raw_results = await <action>(
                query=node_input.user_content,
                max_results=max_results,
            )
        except <Tool>ServiceError as e:
            yield f"[服务错误] {e}"
            return

        # 3. 构建给 LLM 的上游内容
        tool_context = json.dumps(raw_results, ensure_ascii=False)
        augmented_input = NodeInput(
            user_content=node_input.user_content,
            upstream_outputs={
                **node_input.upstream_outputs,
                "_tool_results": tool_context,   # 注入工具结果
            },
            implicit_context=node_input.implicit_context,
            node_config=node_input.node_config,
        )

        # 4. 调用 LLM 处理
        system = self.system_prompt + self.build_context_prompt(
            node_input.implicit_context
        )
        user_msg = self.build_user_message(augmented_input)
        messages = [
            {"role": "system", "content": system},
            {"role": "user",   "content": user_msg},
        ]
        async for token in self.stream_llm(messages, llm_caller):
            yield token
```

---

## 4. 环境变量管理

### 4.1 本地开发 `.env`

在 `backend/.env` 中添加：

```dotenv
# <服务名称> API Key
<SERVICE>_API_KEY=your_key_here
```

`.env` 已在 `.gitignore` 中，不要 commit。

### 4.2 生产环境

在部署平台（Vercel/Railway/自建）的 Environment Variables 中添加。
不要在代码库中直接写入，不要在 `config.yaml` 中写入（config.yaml 走 git）。

### 4.3 环境变量命名规范

```
<SERVICE_NAME>_API_KEY       # API 密钥
<SERVICE_NAME>_BASE_URL      # 服务地址（如需自定义）
<SERVICE_NAME>_TIMEOUT_MS    # 超时（可选）
```

---

## 5. config.yaml 配置

### 5.1 规则说明

| 节点模式 | 是否写 `task_routes` | 是否写 `tool_services` |
|---------|:------------------:|:-------------------:|
| B-Tool（无 LLM）| ❌ 禁止 | ✅ 如有可配置项 |
| B-Search（无 LLM）| ❌ 禁止 | ✅ 如有可配置项 |
| B-Augmented（含 LLM）| ✅ 必须 | ✅ 如有可配置项 |

### 5.2 B-Augmented 节点写 `task_routes`

```yaml
task_routes:
  <node_type>:
    routing_policy: "native_first"
    sku_ids:
      - "sku_dashscope_qwen_turbo_native"
      - "sku_deepseek_chat_native"
```

### 5.3 工具节点写 `tool_services`（可选，推荐）

```yaml
# config.yaml 新增块（如不存在请新增）
tool_services:
  <node_type>:
    provider: "<service_name>"   # 服务提供商名称，用于日志
    timeout_ms: 10000
    max_retries: 2
    # 节点特定配置（对应 config_schema 中的参数默认值）
    max_results: 5
```

---

## 6. 前端：必须修改的四个文件

> 与 A 型的四件套完全一致，此处仅说明 B 型的特殊注意点。

### 6.1 `types/workflow.ts` — 加 NodeType

同 A 型，略。

### 6.2 `constants/workflow-meta.ts` — 注意 `requiresModel`

```typescript
<node_type>: {
    requiresModel: false,   // B-Tool / B-Search 必须 false
    // B-Augmented 根据实际：true（用户可选模型）或 false（系统固定）
    ...
}
```

### 6.3 `constants/workflow-meta.ts` — 工具节点视觉分类

工具节点通常归入 `EXTERNAL_TOOL` 或 `ACTION_IO`：

```typescript
// 检索类工具
if (['knowledge_base', 'web_search', '<node_type>'].includes(nodeType)) {
    return {
        category: 'EXTERNAL_TOOL',
        borderClass: 'border-l-4 border-y border-r border-cyan-700 dark:border-cyan-500',
        // ...
    };
}

// IO 类工具
if (['write_db', 'export_file', '<node_type>'].includes(nodeType)) {
    return {
        category: 'ACTION_IO',
        borderClass: 'border-[1.5px] border-dotted border-zinc-500 dark:border-zinc-400',
        // ...
    };
}
```

### 6.4 `nodes/index.ts` — 工具节点渲染器选择

| 节点类型 | 推荐渲染器 | 说明 |
|---------|----------|------|
| 纯状态反馈（写库、导出）| `PassthroughRenderer` | 不需要展示内容 |
| 返回列表数据 | `JsonRenderer` 或专用 | 展示结构化结果 |
| 返回 Markdown 总结 | `MarkdownRenderer` | LLM 增强节点 |
| 返回文件链接 | 专用渲染器（如 ExportRenderer）| 需要下载按钮 |

---

## 7. 错误处理规范

### 7.1 分层错误处理策略

```
服务层          → 抛出 XxxServiceError（具体、可读的错误信息）
节点 execute()  → 捕获 XxxServiceError，yield 友好的错误文本
引擎层          → 捕获 execute() 未处理的异常，记录 node_status: error
```

### 7.2 节点内错误输出格式

```python
# ✅ 正确：yield 错误信息，让引擎记录 node_done
except XxxServiceError as e:
    yield f"[{self.description}失败] {e}"
    return

# ❌ 错误：直接 raise，引擎会捕获但状态为 error，用户看不到详情
raise XxxServiceError(...)
```

### 7.3 错误信息双视图要求

工具节点输出的错误文本会同时出现在两个位置：

1. 画布节点 `NodeResultSlip`
2. 右侧执行面板 `TraceStepItem`

因此错误文案必须满足：

- 一句话说明失败原因
- 不暴露技术栈堆栈
- 带服务名或节点名上下文

推荐格式：

```text
[网络搜索失败] Tavily API 超时（10秒）
[知识库检索失败] 缺少可用文件或索引尚未建立
```

### 7.4 服务不可用时的降级策略

对于 B-Augmented 节点，外部服务失败时应降级为纯 LLM 处理：

```python
try:
    raw_results = await external_search(query)
except ExternalServiceError as e:
    logger.warning("外部服务失败，降级为纯 LLM: %s", e)
    raw_results = []   # 空结果，继续走 LLM 流程

# 后续 LLM 调用不受影响
```

---

## 8. 联调验收

### 8.1 环境变量验证

```bash
# 在 backend 环境中验证环境变量可读
python -c "import os; key = os.getenv('<SERVICE>_API_KEY'); print('✅ Key present:', bool(key))"
```

### 8.2 Service 层单独测试

```bash
cd backend
python -c "
import asyncio
from app.services.<tool>_service import <action>

async def test():
    result = await <action>('测试查询')
    print('✅ 服务调用成功，结果条数:', len(result))

asyncio.run(test())
"
```

### 8.3 完整节点验证

```bash
# 后端清单确认
curl http://localhost:2038/api/nodes/manifest | python -m json.tool | grep -A5 "<node_type>"
```

### 8.4 TypeScript 编译检查

```bash
cd frontend
npx tsc --noEmit
```

### 8.5 工作流执行测试

1. 创建工作流，加入 B 型节点
2. 正常路径：外部服务调用成功，输出渲染正确
3. **异常路径（必须测试）**：
   - 临时设置错误的 API Key，验证错误信息友好
   - 服务超时时，节点是否输出降级内容而非崩溃

---

## 9. Checklist（提交前逐项确认）

```
□ 已确认节点模式（B-Tool / B-Search / B-Augmented）
□ 已确认外部服务的 API 文档、认证方式、费率

□ 后端 — 服务层
  □ 创建 services/<tool>_service.py
  □ 自定义 XxxServiceError 异常类
  □ 所有外部调用有超时设置
  □ API Key 从环境变量读取，不硬编码

□ 后端 — 节点实现
  □ 创建 nodes/<category>/<node_type>/__init__.py（空文件）
  □ 创建 nodes/<category>/<node_type>/node.py
  □ config_schema 字段声明所有参数（无参数时写 []）
  □ execute() 从 node_input.node_config 读取参数，禁止 label 嗅探
  □ 错误处理：捕获 XxxServiceError，yield 友好文本

□ 后端 — 配置
  □ B-Augmented：config.yaml 的 task_routes 已添加路由
  □ B-Tool/B-Search：config.yaml 无需 task_routes（不添加）
  □ 有可配置项时：config.yaml 的 tool_services 已添加配置块
  □ 本地 .env 已添加所需环境变量
  □ 生产环境 Secrets 已配置（或待部署时添加，已记录）

□ 后端验证
  □ 后端重启无报错（特别是 import 错误）
  □ /api/nodes/manifest 包含新节点
  □ Service 层单独测试通过

□ 前端（四件套）
  □ types/workflow.ts NodeType union 已加入
  □ constants/workflow-meta.ts NODE_TYPE_META 已加入（requiresModel 正确）
  □ constants/workflow-meta.ts getNodeTheme() 已归类（EXTERNAL_TOOL / ACTION_IO）
  □ nodes/index.ts RENDERER_REGISTRY 已加入映射

□ TypeScript 检查
  □ npx tsc --noEmit 零错误

□ 端到端测试
  □ 正常路径：外部服务调用成功，输出正确
  □ 异常路径：服务不可用时，节点输出友好错误信息而非崩溃

□ 文档
  □ docs/项目架构全景.md 已同步
  □ 如果新增了 Supabase 表，RLS 策略已检查
```

---

## 10. 常见错误排查

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| `XxxServiceError: Missing environment variable` | `.env` 没有配置 key | 添加环境变量后重启后端 |
| B-Tool 节点配置了 `task_routes` 却报 `AIRouterError` | 工具节点走了 LLM 路由但 SKU 不存在 | 去掉 `task_routes`；或确认 `is_llm_node` 设置正确 |
| `execute()` 中直接 raise 导致引擎 node_status: error | 异常没有在节点层捕获 | 在 execute() 中捕获服务异常，yield 错误文本 |
| B-Augmented 节点没有题目 | label 嗅探被移除但参数未通过 node_config 传入 | 检查前端是否将配置写入 `node.data.config` |

---

> 📌 **核心原则**：B 型节点的价值在服务层封装。`node.py` 只做胶水层，所有外部逻辑在 `services/` 里。
> 改变服务提供商，只改 service 文件；节点逻辑不动。
