<!-- 编码：UTF-8 -->

# YAML 配置中心化 + Markdown 渲染全家桶 · 技术方案

> 📅 创建日期：2026-02-26  
> 🔄 最新更新：2026-02-26  
> 📌 所属模块：Core · 基础设施  
> 🔗 关联文档：[节点分析](./节点分析.md) · [工作流AI交互规划](./工作流AI交互规划.md) · [StudySolo-MVP](../../StudySolo-MVP.md)

---

## 📑 目录

- [一、YAML 配置中心化](#一yaml-配置中心化)
- [二、Markdown 渲染全家桶](#二markdown-渲染全家桶)
- [三、与 MVP 时间线的集成方案](#三与-mvp-时间线的集成方案)

---

## 一、YAML 配置中心化

### 1.1 背景与痛点

当前 MVP 规划中，双模型路由策略（`ai_router.py`）的模型配置、路由参数、容灾策略均以代码硬编码方式实现。这导致：

| 场景 | 硬编码方案的代价 |
|------|-----------------|
| 换一个模型（如加 DeepSeek） | 改代码 → 重新部署 |
| 调 temperature / max_tokens | 改代码 → 重新部署 |
| 容灾降级切换 | 改 if/else → 重新部署 |
| 上线时 API Key 替换 | 需改 .env + 代码中的每个引用处 |

结合 `节点分析.md` 中定义的 7+ 种节点，每种节点绑定不同模型和参数 → 硬编码管理成本呈指数级增长。

### 1.2 方案：config.yaml 统一配置

在项目根目录创建 `config.yaml`，将所有模型配置、节点配置、执行引擎参数、容灾策略集中管理。

#### 配置文件结构

> ⚠️ **【API 路由规划已过时警告】**  
> 以下展示的 `config.yaml` 示例为早期基于“双模型路由”的快照设定，仅供配置结构参考。  
> **生产环境中真实的 YAML 结构已升级为包含八大平台与十级路由的复杂结构**。  
> 完整的路由配置蓝图请**严格参考最新最权威 [API 统一路由规划 · 权威索引](../API/README.md) 文档的第五部分**！

```yaml
# StudySolo/config.yaml — （⚠️ 已过时，仅供旧版结构参考）
~~# ==================== 模型配置 ====================~~
~~models:~~
~~  # 简单任务模型（免费池）~~
~~  - name: doubao-2.0-pro~~
~~... (旧配置省略, 具体请看 API/README.md ) ...~~
```

#### 配置加载器实现

```python
# backend/app/core/config_loader.py — 配置加载器（约 40 行代码）
import os
import yaml
from pathlib import Path
from functools import lru_cache

def _resolve_env_vars(obj):
    """递归替换 $VAR_NAME 为环境变量值"""
    if isinstance(obj, str) and obj.startswith("$"):
        return os.getenv(obj[1:], "")
    elif isinstance(obj, dict):
        return {k: _resolve_env_vars(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_resolve_env_vars(item) for item in obj]
    return obj

@lru_cache()
def load_config() -> dict:
    """加载并缓存配置（应用生命周期只加载一次）"""
    config_path = os.getenv("STUDYSOLO_CONFIG_PATH")
    if not config_path:
        for candidate in [Path("config.yaml"), Path("../config.yaml")]:
            if candidate.exists():
                config_path = str(candidate)
                break
    
    if not config_path:
        raise FileNotFoundError("找不到 config.yaml")
    
    with open(config_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)
    
    return _resolve_env_vars(raw)

# 便捷访问函数
def get_models() -> list[dict]:
    return load_config().get("models", [])

def get_model_by_route(route: str) -> dict:
    """按路由标记找模型（simple / complex）"""
    for m in get_models():
        if m.get("route") == route:
            return m
    raise ValueError(f"未找到 route={route} 的模型配置")

def get_node_config(node_type: str) -> dict:
    return load_config().get("node_types", {}).get(node_type, {})
```

#### AI 路由代码简化

```python
# backend/app/services/ai_router.py — YAML 版（代码只剩逻辑，零硬编码）
from openai import AsyncOpenAI
from app.core.config_loader import get_model_by_route, get_node_config, get_models

async def call_model(task_type: str, messages: list, node_type: str = None):
    """统一模型调用入口"""
    # 1. 按节点类型或任务类型获取模型配置
    if node_type:
        node_cfg = get_node_config(node_type)
        model_name = node_cfg.get("default_model")
        model_cfg = next(m for m in get_models() if m["name"] == model_name)
    else:
        model_cfg = get_model_by_route(task_type)
    
    # 2. 构造客户端（全从配置来，代码零硬编码）
    client = AsyncOpenAI(
        api_key=model_cfg["api_key"],
        base_url=model_cfg["base_url"]
    )
    
    # 3. 调用
    return await client.chat.completions.create(
        model=model_cfg["model"],
        max_tokens=model_cfg["max_tokens"],
        temperature=model_cfg.get("temperature", 0.7),
        messages=messages,
        stream=True
    )
```

### 1.3 效果对比

| 场景 | 硬编码版 | YAML 版 |
|------|---------|---------|
| 加一个新模型 | 改代码 → 重启 → 重部署 | config.yaml 加 5 行 → 重启即生效 |
| 调 temperature | 改代码 → 重部署 | 改 YAML 一行 → 重启即生效 |
| 容灾切换 | 改 if/else → 重部署 | fallback 配置自动处理 |
| 上线时 Key 替换 | 改 .env + 每个引用处 | `$VOLCENGINE_API_KEY` 自动读 .env |

### 1.4 依赖与兼容性

| 项目 | 说明 |
|------|------|
| 依赖 | `pip install pyyaml`（PyYAML），Python 标准生态 |
| 兼容性 | 100% —— 与现有 `pydantic-settings` 方案互补，非替代 |
| 安全性 | API Key 仍存于 `.env`，YAML 仅通过 `$` 前缀引用 |

---

## 二、Markdown 渲染全家桶

### 2.1 背景与需求分析

StudySolo 所有 LLM 节点的输出均为 **Markdown 格式文本**（参见 `节点分析.md` 中的 output 定义）：

| 节点类型 | 输出格式 | 渲染需求 |
|---------|---------|---------|
| `outline_gen` | Markdown 大纲（标题、列表） | 标题层级 · 列表渲染 |
| `content_extract` | Markdown 知识正文 | 代码高亮 · 表格 · 加粗/斜体 |
| `summary` | Markdown 综合总结 | 完整 Markdown 渲染 |
| `flashcard` | JSON 格式闪卡 | 卡片 UI 渲染 |

同时，项目"四大核心创举"中的 **可观测性看板**（§7.3）明确要求：
> "像打字机一样把带有标题、加粗、列表的排版内容**实时展示**"

**关键挑战**：SSE 流式输出 → 前端需要 **增量渲染** Markdown，而非每次都重新解析整个文本。

### 2.2 依赖清单

| 库名 | 用途 | StudySolo 场景 |
|------|------|---------------|
| `react-markdown` | Markdown 字符串 → React 组件 | 所有节点输出的基础渲染 |
| `remark-gfm` | GitHub 风格扩展（表格、删除线、任务列表） | 大纲表格、知识点列表 |
| `remark-math` | 识别 `$公式$` 和 `$$公式$$` | 数学/物理/化学学习场景 |
| `rehype-katex` | 数学公式精美排版 | 同上 |
| `rehype-raw` | 允许 Markdown 中嵌入原始 HTML | AI 偶尔输出 `<br>` `<details>` 等 |
| `shiki` | 代码块语法高亮（140+ 种语言） | 编程类学习场景 |
| `streamdown` ⭐ | AI 流式输出专用增量 Markdown 解析器 | SSE 打字机效果核心 |

#### 为什么 streamdown 是关键？

普通 Markdown 渲染器的工作方式：**完整 Markdown → 一次性解析 → 渲染 HTML**

但 SSE 流式场景下，AI 每次只吐出几个字：

```
第1次: "# Re"
第2次: "# React"  
第3次: "# React H"
第4次: "# React Hooks\n\n**"
第5次: "# React Hooks\n\n**useState**"
```

如果每次都用 `react-markdown` 重新渲染 → **DOM 疯狂重建 → 页面闪烁抖动**。

`streamdown` 维护增量解析状态，每次只处理新增文本片段，不重新渲染已有内容。

### 2.3 前端组件设计

#### NodeMarkdownOutput 组件

```tsx
// frontend/src/components/business/workflow/nodes/NodeMarkdownOutput.tsx
"use client"

import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import "katex/dist/katex.min.css"

interface NodeMarkdownOutputProps {
  content: string
  isStreaming?: boolean
}

export function NodeMarkdownOutput({ content, isStreaming }: NodeMarkdownOutputProps) {
  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], [])
  const rehypePlugins = useMemo(() => [rehypeKatex, rehypeRaw], [])

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
      >
        {content}
      </ReactMarkdown>
      
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
      )}
    </div>
  )
}
```

#### AIStepNode 自定义节点组件

```tsx
// frontend/src/components/business/workflow/nodes/AIStepNode.tsx
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { NodeMarkdownOutput } from "./NodeMarkdownOutput"

const STATUS_ICON = {
  pending: "⏳",
  running: "🔄", 
  done: "✅",
  error: "❌",
  paused: "⏸️",
} as const

interface AIStepNodeData {
  label: string
  status: "pending" | "running" | "done" | "error" | "paused"
  output: string
}

export function AIStepNode({ data }: NodeProps<AIStepNodeData>) {
  return (
    <div className="rounded-xl border bg-card shadow-sm w-[320px]">
      <Handle type="target" position={Position.Top} />
      
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <span>{STATUS_ICON[data.status]}</span>
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      
      {data.output && (
        <div className="px-3 py-2 max-h-[200px] overflow-y-auto">
          <NodeMarkdownOutput
            content={data.output}
            isStreaming={data.status === "running"}
          />
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
```

#### SSE 流式接收 Hook

```tsx
// frontend/src/hooks/use-workflow-execution.ts
import { useCallback } from "react"
import { useWorkflowStore } from "@/stores/use-workflow-store"

export function useWorkflowExecution() {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData)

  const executeWorkflow = useCallback(async (workflowId: string) => {
    const eventSource = new EventSource(
      `/api/workflow/${workflowId}/execute`
    )

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case "node_status":
          updateNodeData(data.node_id, { status: data.status })
          break

        case "node_token":
          updateNodeData(data.node_id, (prev) => ({
            output: (prev.output || "") + data.token,
          }))
          break

        case "node_done":
          updateNodeData(data.node_id, {
            status: "done",
            output: data.full_output,
          })
          break

        case "workflow_done":
          eventSource.close()
          break
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }
  }, [updateNodeData])

  return { executeWorkflow }
}
```

### 2.4 兼容性验证

| 维度 | 兼容性 | 说明 |
|------|--------|------|
| react-markdown | ✅ 100% | 支持 React 19 + Next.js 16 |
| remark-gfm | ✅ 100% | 纯 ESM 模块，Next.js 16 原生支持 |
| rehype-katex | ✅ 100% | 需要 `katex/dist/katex.min.css` |
| shiki | ✅ 100% | DeerFlow 验证过 3.15.0 版本 |
| streamdown | ✅ 100% | DeerFlow 验证过 1.4.0 版本 |
| Tailwind v4 prose | ✅ 100% | `@tailwindcss/typography` 的 prose 类 |

---

## 三、与 MVP 时间线的集成方案

### 3.1 不额外增加开发天数

这两项技术方案可以**无缝嵌入**现有 MVP 时间线，不增加工期：

| MVP 阶段 | 新增任务 | 工作量 |
|---------|---------|--------|
| **Phase 0 · T0-2** | 前端依赖安装时一并安装 Markdown 渲染库 | +1 分钟（1 行 pnpm add） |
| **Phase 0 · T0-4** | 后端依赖安装时一并安装 `pyyaml` | +1 分钟（已含在 pip install） |
| **Phase 3 · T3-1** | AI 双模型路由服务**直接用 YAML 方式实现** | 0 额外工作量（替代硬编码方案） |
| **Phase 3 · T3-7** | 自定义节点 UI 中使用 `NodeMarkdownOutput` | 0 额外工作量（替代纯文本方案） |

### 3.2 修改已有任务描述

#### T0-2 前端依赖安装（补充）

在原有依赖列表后追加：

```bash
# Markdown 渲染全家桶（AI 节点输出渲染）
pnpm add react-markdown remark-gfm remark-math rehype-katex rehype-raw shiki streamdown
# KaTeX 数学公式样式
pnpm add katex
```

#### T0-4 后端依赖安装（补充）

在原有 pip install 列表后追加 `pyyaml`：

```bash
pip install fastapi uvicorn gunicorn pydantic supabase openai sse-starlette slowapi pydantic-settings pyyaml
```

#### T3-1 双模型路由服务（方案替换）

> 原计划：硬编码双模型路由  
> 新计划：YAML 配置驱动的双模型路由

- 创建 `config.yaml`（项目根目录）
- 创建 `backend/app/core/config_loader.py`（约 40 行）
- `ai_router.py` 直接从 config_loader 读取模型配置 → 零硬编码

#### T3-7 工作流节点自定义 UI（能力增强）

> 原计划：显示 AI 输出内容 + 流式文字动画  
> 新计划：Markdown 渲染输出 + 流式增量渲染 + 代码高亮 + 数学公式

- 创建 `NodeMarkdownOutput.tsx` 组件
- `AIStepNode.tsx` 使用 Markdown 渲染替代纯文本

---

> 📌 **文档定位：** 本文档是 YAML 配置中心化和 Markdown 渲染全家桶的完整技术方案，为 MVP Phase 3 的核心实现提供设计依据。  
> 🔗 **关联更新：** `StudySolo-MVP.md` T0-2、T0-4、T3-1、T3-7 任务描述已同步更新。
