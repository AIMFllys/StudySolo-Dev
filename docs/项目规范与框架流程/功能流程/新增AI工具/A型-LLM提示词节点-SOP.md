# A 型 — LLM 提示词节点 SOP

> 最后更新：2026-03-27
> 编码要求：UTF-8
> 前置：必须先完成 [00-节点与插件分类判断.md](./00-节点与插件分类判断.md) 的分类确认

适用场景：节点的全部能力来自 `prompt.md` + LLM 调用，无需外部 API。

---

## 0. 先做子类型判断

在开始写代码之前，必须先确定是 A1 还是A2。

| | A1 — 用户自选模型 | A2 — 系统指定模型 |
|--|-----------------|-----------------|
| **前端是否显示模型选择器** | 是 | 否 |
| **workflow-meta.ts** | `requiresModel: true` | `requiresModel: false` |
| **用户体验** | 用户在节点头部可切换模型 | 节点图标处无模型选择器 |
| **config.yaml 路由** | 配置默认备选链（用户选择后覆盖默认） | 写死特定路由链，不受用户选择影响 |
| **适用节点类型** | 内容生成类（summary、flashcard、quiz_gen…）| 规划/分析类（ai_planner、ai_analyzer…）|

**判断原则**：当节点的输出质量高度依赖模型能力差异时，给用户选择权（A1）。当节点需要严格的输出格式保证（如 JSON 规划结果），模型切换可能破坏解析，固定模型（A2）。

---

## 1. 确定节点分类（`category`）

节点类型字符串和所在目录必须一致：

| `category` | 文件夹 | 适用节点 |
|------------|--------|---------|
| `analysis` | `nodes/analysis/` | 分析、规划、分类判断 |
| `generation` | `nodes/generation/` | 内容生成、格式转换 |
| `interaction` | `nodes/interaction/` | 对话回复、用户交互 |

> `input` 和 `output` 类别不适用于 A 型节点（那些通常是非 LLM 节点）。

---

## 2. 确定输出格式

选错输出格式会导致前端渲染异常和 JSON 解析失败。

| `output_format` | 何时使用 | 对应 Mixin | 渲染器 |
|-----------------|---------|-----------|--------|
| `"markdown"` | 输出是自然语言文本、列表、代码块 | `LLMStreamMixin` | `MarkdownRenderer` |
| `"json"` | 输出是结构化数据（闪卡、题目、分析结果） | `LLMStreamMixin + JsonOutputMixin` | 专用渲染器或 `JsonRenderer` |

**JSON 节点必须**：
- `prompt.md` 末尾加"不要输出任何 JSON 以外的内容"
- 覆写 `post_process()` 做结构校验

---

## 3. 后端：创建节点包

### 3.1 文件夹结构

```
backend/app/nodes/<category>/<node_type>/
├── __init__.py          ← 空文件，仅作 Python 包标记
├── node.py              ← 节点实现（必须）
└── prompt.md            ← System Prompt（必须）
```

文件夹名 = `node_type` 值，全小写 `snake_case`。

### 3.2 编写 `__init__.py`

```python
# 空文件，不需要任何内容
```

### 3.3 编写 `node.py`

#### 模板 A1-Markdown（用户自选模型 + Markdown 输出）

```python
"""<节点功能描述>."""

from typing import Any, AsyncIterator
from app.nodes._base import BaseNode, NodeInput
from app.nodes._mixins import LLMStreamMixin


class <NodeName>Node(BaseNode, LLMStreamMixin):
    node_type = "<node_type>"       # 必须与文件夹名一致
    category = "<category>"         # analysis / generation / interaction
    description = "<中文功能描述>"   # 展示在前端节点面板
    is_llm_node = True
    output_format = "markdown"
    icon = "<Emoji>"                # 与前端 workflow-meta.ts 中保持一致
    color = "<hex color>"           # 与前端 workflow-meta.ts 中保持一致
    config_schema: list = []        # 无参数时留空列表

    async def execute(
        self,
        node_input: NodeInput,
        llm_caller: Any,
    ) -> AsyncIterator[str]:
        system = self.system_prompt + self.build_context_prompt(
            node_input.implicit_context
        )
        user_msg = self.build_user_message(node_input)
        messages = [
            {"role": "system", "content": system},
            {"role": "user",   "content": user_msg},
        ]
        async for token in self.stream_llm(messages, llm_caller):
            yield token
```

#### 模板 A1-JSON（用户自选模型 + JSON 输出）

```python
"""<节点功能描述>."""

import json
from typing import Any, AsyncIterator

from app.nodes._base import BaseNode, NodeInput, NodeOutput
from app.nodes._mixins import LLMStreamMixin, JsonOutputMixin


class <NodeName>Node(BaseNode, LLMStreamMixin, JsonOutputMixin):
    node_type = "<node_type>"
    category = "<category>"
    description = "<中文功能描述>"
    is_llm_node = True
    output_format = "json"
    icon = "<Emoji>"
    color = "<hex color>"
    config_schema: list = []

    async def execute(
        self,
        node_input: NodeInput,
        llm_caller: Any,
    ) -> AsyncIterator[str]:
        system = self.system_prompt + self.build_context_prompt(
            node_input.implicit_context
        )
        user_msg = self.build_user_message(node_input)
        messages = [
            {"role": "system", "content": system},
            {"role": "user",   "content": user_msg},
        ]
        async for token in self.stream_llm(messages, llm_caller):
            yield token

    async def post_process(self, raw_output: str) -> NodeOutput:
        """校验并格式化 JSON 输出."""
        try:
            parsed = await self.validate_json(raw_output)
            # 根据节点实际数据结构做断言或转换
            if not isinstance(parsed, list):
                parsed = [parsed]
            return NodeOutput(
                content=json.dumps(parsed, ensure_ascii=False, indent=2),
                format="json",
                metadata={"count": len(parsed)},
            )
        except ValueError:
            # JSON 解析失败时降级为 Markdown，不崩溃
            return NodeOutput(content=raw_output, format="markdown")
```

#### 模板 A2（系统指定模型，两种输出格式均可用）

模板与 A1 完全相同，区别**仅在 `workflow-meta.ts` 和 `config.yaml`**，`node.py` 本身写法一致。

### 3.4 编写 `prompt.md`

System Prompt 编写规范：

```markdown
你是一个<角色定位>。根据用户提供的<输入描述>，<核心任务>。

<输出要求>：
- <要求1>
- <要求2>

<Markdown 节点>：
直接输出内容，使用 Markdown 格式，语言清晰易读。

<JSON 节点>：
输出格式为 JSON <对象/数组>：
{
  "<字段1>": "<描述>",
  "<字段2>": "<描述>"
}
不要输出任何 JSON 以外的内容。
```

Prompt 编写原则：

1. 第一句明确角色
2. 明确输出格式和字段要求
3. 提供至少一个输出示例
4. JSON 节点必须加"不要输出任何 JSON 以外的内容"
5. 文件编码 UTF-8，可用中文

---

## 4. 配置 `config.yaml` 路由

> **规则**：`is_llm_node = True` 的节点**必须**配置路由。

### 4.1 路由链选择

| 路由链 | `routing_policy` | 用途 | 典型模型 |
|--------|-----------------|------|---------|
| **A 链（格式严格）** | `native_first` + 快速模型 | JSON 输出节点，需要格式稳定 | `qwen-turbo`、`deepseek-chat` |
| **B 链（深度推理）** | `native_first` + 推理模型 | Markdown 输出节点，需要内容质量 | `deepseek-reasoner`、`qwen-plus` |
| **C 链（高质量）** | `proxy_first` | 对质量要求极高 | `kimi-k2.5`、`qwen-max` |

**选链原则**：
- 输出 JSON？→ A 链（格式稳定优先）
- 输出 Markdown 且内容质量关键？→ B 链
- 需要最强推理能力？→ C 链（考虑成本）

### 4.2 写入 `config.yaml`

```yaml
task_routes:
  # ... 已有路由 ...

  <node_type>:                         # 必须与 node_type 字段一致
    routing_policy: "native_first"     # 或 proxy_first
    sku_ids:
      - "sku_dashscope_qwen_turbo_native"   # 首选
      - "sku_deepseek_chat_native"          # 备选1
      - "sku_volcengine_doubao_pro_32k_native"  # 备选2
```

### 4.3 A2 节点的路由配置

A2（系统指定模型）同样需要路由配置，但 `sku_ids` 列表通常更短且选择更精确：

```yaml
  <node_type>:
    routing_policy: "native_first"
    sku_ids:
      - "sku_dashscope_qwen_turbo_native"  # 精确指定，不给太多备选
```

---

## 5. 后端验证

### 5.1 重启后端并确认注册

```bash
cd backend
uvicorn app.main:app --reload
```

### 5.2 访问节点清单确认出现

```bash
curl http://localhost:2038/api/nodes/manifest | python -m json.tool | grep -A2 "<node_type>"
```

预期：节点出现，字段正确。

### 5.3 Python 快速验证

```bash
cd backend
python -c "
from app.nodes import NODE_REGISTRY
assert '<node_type>' in NODE_REGISTRY, '<node_type> 未注册！'
print('✅ 注册成功:', NODE_REGISTRY['<node_type>'])
"
```

---

## 6. 前端：必须修改的四个文件

> ⚠️ **这是现有 CONTRIBUTING.md 没有完整说明的部分**，是前端最常见的遗漏点。

### 6.1 `types/workflow.ts` — 加 NodeType union 成员

```typescript
// 在对应分组中加入新节点类型
export type NodeType =
  | 'trigger_input'
  | 'ai_analyzer'
  // ... 已有节点 ...
  | '<node_type>'    // ← 新增
  | 'loop_group';
```

### 6.2 `constants/workflow-meta.ts` — 加 NODE_TYPE_META 条目

```typescript
export const NODE_TYPE_META: Record<NodeType, NodeTypeMeta> = {
  // ... 已有节点 ...

  <node_type>: {
    label: '<中文名称>',
    icon: <Lucide图标组件>,   // 从 lucide-react 导入
    description: '<一句话描述>',
    accentClassName: 'from-<color>-500/20 to-<color>-500/5 text-<color>-100 ring-<color>-400/30',
    requiresModel: true,    // A1: true  |  A2: false
    inputs: [
      { key: '<输入端口名>', description: '<描述>', required: true },
    ],
    outputs: [
      { key: '<输出端口名>', description: '<描述>', required: true },
    ],
  },
};
```

### 6.3 `constants/workflow-meta.ts` — 加 `getNodeTheme()` 视觉分类

在 `getNodeTheme` 函数中，将新节点加入最合适的视觉分类分支：

```typescript
// 找到对应的视觉分类，在其 includes() 数组中加入新节点
if (['outline_gen', 'summary', '<node_type>'].includes(nodeType)) {
  return {
    category: 'GENERATION',
    borderClass: 'border-[3px] border-indigo-900 dark:border-indigo-400',
    // ...
  };
}
```

视觉分类参考（选最匹配的）：

| 分类常量 | 适用节点类型 | 边框风格 |
|---------|------------|---------|
| `RAW_DATA` | trigger_input | 灰色打孔虚线 |
| `ANALYSIS` | ai_analyzer, content_extract, compare | 墨绿双线 |
| `GENERATION` | outline_gen, summary | 靛蓝厚重 |
| `FINAL_REPORT` | chat_response, merge_polish | 藏青双线 |
| `EXTERNAL_TOOL` | knowledge_base, web_search | 青色左边框 |
| `ACTION_IO` | write_db, export_file | 工业灰点线 |
| `CONTROL_FLOW_BRANCH` | logic_switch | 琥珀色警告 |
| `VISUALIZE` | mind_map | 紫色相框 |
| `ASSESSMENT` | quiz_gen, flashcard | 玫瑰红考卷 |

### 6.4 `nodes/index.ts` — 加 RENDERER_REGISTRY 条目

先判断是否需要新渲染器：

| 输出格式 | 是否需要新渲染器 | 直接复用 |
|---------|:--------------:|--------|
| Markdown 文本 | ❌ | `MarkdownRenderer` |
| 通用 JSON | ❌ | `JsonRenderer` |
| 需要交互 UI（如测验作答、闪卡翻转） | ✅ | — |

**复用已有渲染器（无需创建新文件）**：

```typescript
// nodes/index.ts
const RENDERER_REGISTRY: Record<string, React.FC<NodeRendererProps>> = {
  // ... 已有 ...
  <node_type>: MarkdownRenderer,   // 或 JsonRenderer
};
```

**需要新渲染器时**，在 `renderers/` 目录下创建 `<NodeName>Renderer.tsx`：

```tsx
"use client";

import React from "react";
import type { NodeRendererProps } from "../index";

export const <NodeName>Renderer: React.FC<NodeRendererProps> = ({
  output,
  isStreaming,
}) => {
  // 三态渲染规范：
  if (isStreaming && !output) {
    return <div className="text-muted-foreground text-xs italic">生成中...</div>;
  }
  if (!output) {
    return <div className="text-muted-foreground text-xs italic">等待执行</div>;
  }
  // 正常渲染
  return <div>{/* 你的渲染逻辑 */}</div>;
};
```

然后在 `nodes/index.ts` 注册：

```typescript
import { <NodeName>Renderer } from "./renderers/<NodeName>Renderer";

const RENDERER_REGISTRY = {
  // ...
  <node_type>: <NodeName>Renderer,
};
```

### 6.5 渲染器 `compact` 规范（执行面板必做）

`nodes/index.ts` 中的 `NodeRendererProps` 已包含 `compact?: boolean`。新增或改造渲染器时必须同时实现两种视图：

- `compact = false`
  - 画布节点展开视图 / 详细输出
  - 可以保留完整 Markdown、交互答题、翻卡等重交互
- `compact = true`
  - 执行面板 Trace 精简视图
  - 必须输出轻量摘要，不显示重交互控件，不依赖大图表或复杂 Canvas

最低要求：

- `MarkdownRenderer`：前 200 字摘要
- `JsonRenderer`：关键字段摘要
- `FlashcardRenderer`：卡片数量与首张示例
- `QuizRenderer`：题目数量摘要
- 其他专用渲染器：至少返回可读的一行摘要

---

## 7. 联调验收

### 7.1 TypeScript 编译检查（必须 0 错误）

```bash
cd frontend
npx tsc --noEmit
```

若报 `NodeType` 类型相关错误，说明 6.1 步未完成。

### 7.2 在工作流画布中创建节点

1. 打开工作流编辑器
2. 在节点面板中找到新节点（按分类搜索）
3. 拖入画布，检查：
   - 节点图标和颜色正确（来自 `workflow-meta.ts`）
   - A1 节点头部显示模型选择器；A2 节点不显示
   - 节点输入/输出端口正确

### 7.3 执行测试

1. 连接 `trigger_input → <新节点>`
2. 点击执行
3. 检查后端日志：路由是否命中正确 SKU
4. 检查前端：SSE 流式渲染正常

### 7.4 对于 JSON 输出节点，额外检查

1. 节点输出是否被正确解析（不是原始 JSON 字符串）
2. `post_process()` 的降级路径是否工作（手动构造一个错误 JSON 测试）

### 7.5 执行面板验收

1. 运行工作流后，右侧执行面板自动弹出
2. 新节点步骤条目正确显示名称、执行顺序与状态
3. `running` 状态时步骤自动展开，流式输出实时追加
4. `done` 状态后可展开查看 Input / Output，且内容与画布节点 slip 一致
5. `compact = true` 时渲染器不崩溃、不显示不必要的重交互控件

---

## 8. Checklist（提交前逐项确认）

```
□ 已确认是 A1（用户自选）还是 A2（系统指定）子类型
□ 已选定 category（analysis / generation / interaction）
□ 已选定 output_format（markdown / json）

□ 后端
  □ 创建 nodes/<category>/<node_type>/ 文件夹
  □ 创建 __init__.py（空文件）
  □ 创建 node.py（继承 BaseNode，设置所有必须 ClassVar，config_schema = []）
  □ 创建 prompt.md（UTF-8，含角色、格式、示例）
  □ 在 config.yaml 的 task_routes 添加路由
  □ 路由链选择正确（A链/B链/C链）

□ 后端验证
  □ 后端重启无报错
  □ /api/nodes/manifest 返回中包含新节点
  □ Python 断言验证通过

□ 前端（四件套）
  □ types/workflow.ts NodeType union 已加入 <node_type>
  □ constants/workflow-meta.ts NODE_TYPE_META 已加入完整条目
  □ constants/workflow-meta.ts getNodeTheme() 已将节点归入正确视觉分类
  □ nodes/index.ts RENDERER_REGISTRY 已加入映射条目
  □ 如需新渲染器：renderers/<NodeName>Renderer.tsx 已创建并实现三态

□ TypeScript 检查
  □ npx tsc --noEmit 零错误

□ 端到端测试
  □ 画布中节点外观正确（图标/颜色/标签）
  □ A1：头部有模型选择器；A2：无
  □ SSE 执行流正常
  □ 输出渲染正确

□ 文档
  □ docs/项目架构全景.md 已同步（节点目录树、NodeType 注释）
```

---

## 9. 常见错误排查

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| 节点不出现在 `/api/nodes/manifest` | `node_type` 为空或 `__init__.py` 缺失 | 确认 class 变量和文件夹都存在 |
| 执行时报 `AIRouterError: Unknown task route` | `config.yaml` 未配置 `task_routes` | 在对应位置添加路由配置 |
| 前端显示 fallback 样式（青绿色） | `getNodeTheme()` 未加入新节点 | 在对应分类的 `includes()` 数组中添加 |
| JSON 输出显示原始字符串 | `RENDERER_REGISTRY` 用了 `MarkdownRenderer` 但输出是 JSON | 改用 `JsonRenderer` 或创建专用渲染器 |
| TypeScript 报 `not assignable to NodeType` | `types/workflow.ts` 未加入 union 成员 | 在 `NodeType` 中加入新类型字符串 |
| A2 节点仍然显示模型选择器 | `workflow-meta.ts` 中 `requiresModel` 未设为 `false` | 修改 `NODE_TYPE_META` 对应条目 |

---

> 📌 **核心原则**：A 型节点的全部价值在 `prompt.md` 里。写代码是形式，写 Prompt 才是内容。
> 新增一个 A 型节点，后端结构改动不超过 3 个文件，前端不超过 4 个文件。超过了，重新分类。
