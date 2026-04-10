# 节点 Manifest-First 契约（冻结契约）

> 版本：v1.0 | 冻结日期：2026-04-10
> 状态：🔒 已冻结 — 修改需三人 Sync + 版本号升级
> 关联 Phase：Phase 1 Task 1.6
> 实现计划：Phase 4A

---

## 核心原则

**后端 manifest 是节点定义的唯一事实源 (Single Source of Truth)**。

前端的节点类型、分类、图标、配置面板、渲染器选择——全部从后端 manifest 衍生，禁止前端独立维护一套硬编码的 registry。

---

## 现状分析

### 后端 `BaseNode.get_manifest()` 当前返回的字段

```python
# backend/app/nodes/_base.py L221-L239 （当前实现）
{
    "type": nc.node_type,
    "category": nc.category,
    "description": nc.description,
    "is_llm_node": nc.is_llm_node,
    "output_format": nc.output_format,
    "icon": nc.icon,
    "color": nc.color,
    "config_schema": nc.config_schema,
    "output_capabilities": nc.output_capabilities,
    "supports_upload": nc.supports_upload,
    "supports_preview": nc.supports_preview,
    "deprecated_surface": nc.deprecated_surface,
}
```

### 前端 `NodeManifestItem` 当前接口

```typescript
// frontend/src/types/workflow.ts L89-L102 （当前实现）
interface NodeManifestItem {
  type: NodeType;
  category: string;
  description: string;
  is_llm_node: boolean;
  output_format: string;
  icon: string;
  color: string;
  config_schema: NodeConfigFieldSchema[];
  output_capabilities: string[];
  supports_upload: boolean;
  supports_preview: boolean;
  deprecated_surface?: string | null;
}
```

---

## 冻结的 Manifest 字段集（v1.0）

在现有字段基础上新增 `display_name`、`renderer`、`version` 三个字段：

```json
{
  "type": "quiz_gen",
  "category": "generation",
  "display_name": "测验生成",
  "description": "根据学习内容自动生成多种题型的测验，支持选择题、填空题、判断题",
  "icon": "quiz",
  "color": "#6366f1",
  "is_llm_node": true,
  "output_format": "structured",
  "config_schema": [
    {
      "key": "question_types",
      "type": "multi_select",
      "label": "题型",
      "default": ["multiple_choice", "fill_blank"],
      "options": [
        { "label": "选择题", "value": "multiple_choice" },
        { "label": "填空题", "value": "fill_blank" },
        { "label": "判断题", "value": "true_false" }
      ]
    },
    {
      "key": "question_count",
      "type": "number",
      "label": "题目数量",
      "default": 5,
      "min": 1,
      "max": 20
    },
    {
      "key": "difficulty",
      "type": "select",
      "label": "难度",
      "default": "medium",
      "options": [
        { "label": "简单", "value": "easy" },
        { "label": "中等", "value": "medium" },
        { "label": "困难", "value": "hard" }
      ]
    }
  ],
  "output_capabilities": ["quiz_data"],
  "supports_upload": false,
  "supports_preview": true,
  "deprecated_surface": null,
  "renderer": "QuizRenderer",
  "version": "1.0.0"
}
```

### 新增字段说明

| 字段 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `display_name` | `string` | 中文显示名，前端直接使用 | 必填 |
| `renderer` | `string \| null` | 前端渲染器组件名，`null` 使用 MarkdownRenderer | `null` |
| `version` | `string` | 语义化版本号 (SemVer) | `"1.0.0"` |

---

## 后端 BaseNode 新增 Class Variables

```python
# _base.py 新增的 ClassVar（Phase 4A 实现）
class BaseNode(ABC):
    # ... 现有字段 ...
    display_name: ClassVar[str] = ""          # 新增：中文显示名
    renderer: ClassVar[str | None] = None     # 新增：前端渲染器
    version: ClassVar[str] = "1.0.0"          # 新增：语义化版本号
```

### `get_manifest()` 更新

```python
@classmethod
def get_manifest(cls) -> list[dict[str, Any]]:
    return [
        {
            "type": nc.node_type,
            "category": nc.category,
            "display_name": nc.display_name,       # 新增
            "description": nc.description,
            "is_llm_node": nc.is_llm_node,
            "output_format": nc.output_format,
            "icon": nc.icon,
            "color": nc.color,
            "config_schema": nc.config_schema,
            "output_capabilities": nc.output_capabilities,
            "supports_upload": nc.supports_upload,
            "supports_preview": nc.supports_preview,
            "deprecated_surface": nc.deprecated_surface,
            "renderer": nc.renderer,               # 新增
            "version": nc.version,                 # 新增
        }
        for _, nc in sorted(cls._registry.items(), key=lambda item: item[0])
    ]
```

---

## 前端 TypeScript 接口更新

```typescript
// 冻结的 NodeManifestItem v1.0
interface NodeManifestItem {
  type: NodeType;
  category: string;
  display_name: string;           // 新增
  description: string;
  icon: string;
  color: string;
  is_llm_node: boolean;
  output_format: string;
  config_schema: NodeConfigFieldSchema[];
  output_capabilities: string[];
  supports_upload: boolean;
  supports_preview: boolean;
  deprecated_surface?: string | null;
  renderer: string | null;        // 新增
  version: string;                // 新增
}
```

---

## Renderer 映射规则

前端收到 `renderer` 字段后，按以下规则选择渲染器：

```typescript
const RENDERER_MAP: Record<string, React.ComponentType> = {
  // 结构化输出渲染器
  QuizRenderer: QuizRenderer,
  FlashcardRenderer: FlashcardRenderer,
  MindMapRenderer: MindMapRenderer,
  CompareRenderer: CompareRenderer,
  OutlineRenderer: OutlineRenderer,
  // 默认
  MarkdownRenderer: MarkdownRenderer,
};

function getRenderer(manifest: NodeManifestItem): React.ComponentType {
  if (manifest.renderer && RENDERER_MAP[manifest.renderer]) {
    return RENDERER_MAP[manifest.renderer];
  }
  // fallback: 根据 output_format 选择
  if (manifest.output_format === "structured") {
    return StructuredRenderer;
  }
  return MarkdownRenderer;
}
```

> **重要**：前端的 `RENDERER_MAP` 是 manifest `renderer` 字段值到组件的映射。增删渲染器需要同步更新 manifest（后端）和 `RENDERER_MAP`（前端），但不需要改组件选择逻辑。

---

## 当前节点与新增字段映射

| 节点类型 | display_name | renderer | version |
|----------|-------------|----------|---------|
| `trigger_input` | 用户输入 | `null` | 1.0.0 |
| `ai_analyzer` | 需求分析 | `null` | 1.0.0 |
| `ai_planner` | 工作流规划 | `null` | 1.0.0 |
| `outline_gen` | 大纲生成 | `OutlineRenderer` | 1.0.0 |
| `content_extract` | 知识提炼 | `null` | 1.0.0 |
| `summary` | 总结归纳 | `null` | 1.0.0 |
| `flashcard` | 闪卡生成 | `FlashcardRenderer` | 1.0.0 |
| `compare` | 对比分析 | `CompareRenderer` | 1.0.0 |
| `mind_map` | 思维导图 | `MindMapRenderer` | 1.0.0 |
| `quiz_gen` | 测验生成 | `QuizRenderer` | 1.0.0 |
| `merge_polish` | 合并润色 | `null` | 1.0.0 |
| `chat_response` | 对话回复 | `null` | 1.0.0 |
| `knowledge_base` | 知识库检索 | `null` | 1.0.0 |
| `web_search` | 网络搜索 | `null` | 1.0.0 |
| `export_file` | 文件导出 | `null` | 1.0.0 |
| `write_db` | 数据写入 | `null` | 1.0.0 |
| `logic_switch` | 逻辑分支 | `null` | 1.0.0 |
| `loop_map` | 循环映射 | `null` | 1.0.0 |

---

## API 端点（不变）

```
GET /api/nodes/manifest → list[NodeManifestItem]
```

前端通过 `node-manifest.service.ts` 调用，结果缓存在前端 store 中。

---

## AI 编程易出问题的点

1. **不要在前端 hardcode 节点类型列表**：`NodeType` union 仍保留在 `workflow.ts` 中作为类型安全，但运行时行为（图标、颜色、config 面板）必须从 manifest 驱动
2. **`workflow-meta.ts` 将逐步废弃**：当前前端的 `WORKFLOW_META` 常量与 manifest 有重叠，Phase 4A 需要消除
3. **`renderer` 字段是组件名字符串，不是组件引用**：前端需要维护一个静态映射 `Record<string, ComponentType>`
4. **`config_schema` 的 `dynamic_options` 字段**：已存在于 TypeScript 定义中，后端需同步支持
5. **社区节点 `community_node` 的 manifest**：不通过 `BaseNode` 注册，而是从数据库加载，但字段集必须同构

---

## 签字确认

| 角色 | 姓名 | 签字 | 日期 |
|------|------|------|------|
| 主系统负责人 | | ☐ | |
| 队友 B | | ☐ | |
| 队友 C | | ☐ | |
