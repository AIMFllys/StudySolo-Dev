# AI 聊天系统与意图路由原理

> **最后更新**: 2026-04-16 · 深度剖析 StudySolo 产品中 AI 聊天交互的完整底层原理

---

## 一、什么是 StudySolo 的 AI 聊天系统？

StudySolo 的侧边栏中内嵌了一个 **AI 学习导师聊天面板** (`SidebarAIPanel`)。它不是简单的 ChatGPT 式对话框——而是一个 **能"看见"画布、理解你的工作流、并直接操作节点** 的智能系统。

**核心能力**：

```
用户在侧边栏输入: "在总结节点后面加个闪卡"
     ↓
AI 聊天系统内部:
  1. 序列化当前画布状态 → 生成 AI 可读的文本快照
  2. 意图分类 → 判断这是 "MODIFY" (修改画布)
  3. 选择模式 → Create 模式 (直接操作画布)
  4. AI 返回 JSON 指令 → [{tool: "add_node", params: {...}}]
  5. ActionExecutor 解释执行 → 在画布上真的添加了一个闪卡节点 🎉
```

---

## 二、三种模式 (Mode) —— 用最通俗的话解释

StudySolo AI 聊天有 **三种模式**，就像汽车的挡位一样，每种模式的行为完全不同：

| 模式 | 图标 | 类比 | 能操作画布吗？ | 输出格式 |
|------|------|------|--------------|---------|
| **Chat** (对话) | 💬 | 跟老师聊天 | ❌ 只能看，不能改 | Markdown 文本 (流式) |
| **Plan** (规划) | 📋 | 老师审视你的作业并给建议 | ❌ 只分析，不执行 | XML 结构化建议 (流式) |
| **Create** (创建) | ⚡ | 老师直接帮你修改作业 | ✅ 可以增删改节点 | JSON 指令 (一次性) |

### 模式选择逻辑

```
用户在 SidebarAIPanel 中选择模式 (顶部切换栏)
     │
     ├── "对话" → mode="chat"   → 后端选用 mode_chat.md 系统提示词
     ├── "规划" → mode="plan"   → 后端选用 mode_plan.md 系统提示词
     └── "创建" → mode="create" → 后端选用 mode_create.md 系统提示词
```

---

## 三、四种意图 (Intent) —— AI 如何理解你想做什么

### 3.1 意图分类矩阵

在 Create 模式下，AI 需要进一步判断你的真实意图：

| 意图 | 含义 | 触发条件 | AI 动作 |
|------|------|---------|--------|
| **BUILD** | 从零搭建一个全新工作流 | 画布为空 + 用户描述学习目标 | 跳转到全量工作流生成路线 |
| **MODIFY** | 增量修改现有画布 | 画布有节点 + 用户说"添加/删除/修改" | AI 返回 JSON 操作指令 |
| **CHAT** | 纯对话，不操作画布 | 用户问问题、闲聊 | 返回文字回答 |
| **ACTION** | 触发系统动作 | 用户说"运行/保存/导出" | 触发前端对应功能 |

### 3.2 意图分类器 (`intent_classifier.md`)

意图分类是一个 **独立的 AI 调用**——在执行真正的任务之前，先用一个轻量提示词让 AI 判断意图：

```
[前端] 用户输入 + 画布上下文
     ↓
[后端] ai_chat_stream.py 
     ↓
[后端] 先用 intent_classifier.md 提示词调用一次 AI
     ↓
[AI 返回] {"intent": "MODIFY", "confidence": 0.95, "reasoning": "用户提到添加节点"}
     ↓
[后端] 根据 intent 选择对应的处理逻辑
```

**分类优先级规则**：
```
1. ACTION 最高 → "运行"、"保存" 等系统指令优先识别
2. MODIFY 次之 → 有明确修改动词 + 节点引用
3. BUILD       → 画布为空 + 描述性输入
4. CHAT 兜底   → 任何不确定的都归为对话
```

**快速跳过机制**：如果前端已经高置信度判断了意图 (`intent_hint`)，可以跳过 AI 分类：
```python
# ai_chat_stream.py
if body.intent_hint and body.intent_hint in ("BUILD", "MODIFY", "ACTION"):
    intent = body.intent_hint  # 跳过 AI 分类，直接使用前端判断
```

---

## 四、Canvas Context —— AI 如何"看见"画布

### 4.1 核心问题

AI 大模型是纯文本模型——它看不到画布上的图形。那它怎么知道画布上有哪些节点？

答案是：**前端在每次发消息时，将画布状态序列化为一段结构化文本**，附带在请求里发给后端。

### 4.2 序列化过程 (`use-canvas-context.ts`)

```typescript
// 前端: use-canvas-context.ts
export function useCanvasContext() {
  const serialize = (): CanvasContext => {
    const { nodes, edges, currentWorkflowId, selectedNodeId } = useWorkflowStore.getState();
    
    // 1. 构建每个节点的 AI 可读摘要
    const nodesSummary = nodes.map((node, i) => ({
      id: node.id,                       // 唯一 ID (用于后续操作定位)
      index: i,                          // 序号 (用于 "第几个" 引用)
      label: node.data.label,            // 标签 (如 "总结归纳")
      type: node.data.type,              // 节点类型 (如 "summary")
      status: node.data.status,          // 状态 (pending/running/done)
      hasOutput: !!node.data.output,     // 是否有输出结果
      outputPreview: output.slice(0, 100), // 输出预览 (前100字)
      upstreamLabels: ["大纲生成"],       // 上游节点标签列表
      downstreamLabels: ["闪卡生成"],     // 下游节点标签列表
      position: { x: 460, y: 200 },      // 画布坐标 ← 供 AI 计算新节点位置
    }));
    
    // 2. 构建 DAG 描述 (连线关系的文本表示)
    //    "大纲生成 → 内容提炼, 内容提炼 → 总结归纳, 总结归纳 → 闪卡生成"
    const dagDescription = edges.map(e => `${labelById[e.source]} → ${labelById[e.target]}`).join(', ');
    
    return { workflowId, workflowName, nodesSummary, dagDescription, selectedNodeId };
  };
}
```

### 4.3 后端的画布文本化 (`_build_canvas_summary`)

后端收到序列化数据后，进一步将其转换为 **人类可读的文本**，注入到 System Prompt 中：

```python
# ai_chat.py → _build_canvas_summary()
def _build_canvas_summary(ctx):
    """将画布上下文转为 AI 可读文本"""
    # 输出示例:
    # 工作流: 机器学习入门
    # 节点数量: 5
    # 执行状态: completed
    #
    #   #1 [trigger_input] "学习目标" @(120,200) [done]
    #   #2 [outline_gen] "大纲生成" @(460,200) [done] ← 学习目标
    #     输出预览: 1. 线性回归 2. 逻辑回归...
    #   #3 [content_extract] "内容提炼" @(800,200) [done] ← 大纲生成 → 总结归纳
    #   #4 [summary] "总结归纳" @(1140,200) [done] ← 内容提炼
    #   #5 [flashcard] "闪卡生成" @(1480,200) [pending] ← 总结归纳
    #
    # DAG: 学习目标 → 大纲生成, 大纲生成 → 内容提炼, ...
    # 当前选中: #3 "内容提炼"
```

**通俗解释**: 就像你拍了一张画布的"文字照片"发给 AI。AI 虽然看不到图形，但通过这段文字可以完全理解画布上有什么、结构是什么、当前什么状态。

### 4.4 性能优化：缓存机制

序列化操作在每次用户发消息时都会执行，但做了缓存优化：

```typescript
// 简单哈希检测: 如果节点数、边数、选中节点都没变 → 复用上次结果
const hash = `${nodes.length}-${edges.length}-${selectedNodeId}`;
if (hash === lastHashRef.current && cacheRef.current) {
  return cacheRef.current;  // 跳过重新序列化
}
```

---

## 五、Prompt 模块化系统 —— AI 大脑的"人设"

### 5.1 架构设计

传统做法是把所有提示词写死在代码里。StudySolo 采用了 **Markdown 文件 + 模板变量** 的方案：

```
backend/app/prompts/
├── __init__.py              ← 对外 API 接口
├── prompt_loader.py         ← 核心加载器 (LRU缓存 + {{变量}} 渲染)
├── identity.md              ← 身份设定 (所有模式共享)
├── intent_classifier.md     ← 意图分类器提示词
├── mode_chat.md             ← Chat 模式提示词
├── mode_plan.md             ← Plan 模式提示词
└── mode_create.md           ← Create 模式提示词
```

### 5.2 `identity.md` —— 不可变的 AI 身份

这是所有模式都会注入的 **基础人设**，包含：
- AI 的名称和定位（学习工作流专家 + 教育 AI 助手）
- 可操作的 15 种节点类型列表
- 安全规则（防止 Prompt 注入攻击）

```
最终发给大模型的 System Prompt = identity.md + mode_xxx.md
```

### 5.3 `prompt_loader.py` —— 模板引擎

```python
# 核心加载机制:
@lru_cache(maxsize=32)  # 进程级缓存，避免重复读文件
def _load_md(name: str) -> str:
    path = _PROMPTS_DIR / f"{name}.md"
    return path.read_text(encoding="utf-8")

def _render(template: str, **variables: str) -> str:
    """替换 {{var}} 占位符"""
    # 例如: "{{canvas_context}}" → 替换为实际画布文本
    return re.sub(r"\{\{(\w+)\}\}", replacer, template)

# 高级组装器:
def get_plan_prompt(canvas_context: str, thinking_depth: str) -> str:
    identity = load_prompt("identity")
    plan = load_prompt("mode_plan", canvas_context=canvas_context, thinking_depth=depth_label)
    return f"{identity}\n\n{plan}"
```

**好处**：
1. **可编辑** — PM 或教学设计师可以直接修改 `.md` 文件调整 AI 行为，无需碰代码
2. **Git 友好** — 每次提示词变更都有版本管理
3. **高性能** — `@lru_cache` 缓存，进程内不重复读文件
4. **可测试** — 每个 `.md` 文件可以独立测试效果

### 5.4 三种模式的提示词策略

| 模式 | 输出格式 | 能力范围 | 思考深度适配 |
|------|---------|---------|------------|
| **Chat** | 直接 Markdown 文本 | 只能看画布，不能改 | ❌ 不支持 |
| **Plan** | `<plan><analysis>...<recommendations>...<response>...</plan>` (XML) | 分析画布 + 给建议，不执行 | ✅ fast/balanced/deep |
| **Create** | `{"tool_calls": [...], "response": "..."}` (JSON) | 直接操作画布 (增删改节点/连线) | ✅ fast/balanced/deep |

---

## 六、思考深度 (Thinking Depth) —— 精细控制 AI 思维

用户可以在 SidebarAIPanel 中选择三种思考深度：

| 深度 | 图标 | 系统提示注入的内容 | 效果 |
|------|------|-----------------|------|
| **Fast** (快速) | ⚡ | "请快速简洁地回答, 不需要展开细节。" | 1-2 句话搞定 |
| **Balanced** (均衡) | ⚖️ | "请给出完整但有条理的回答。" | 默认，2-4 条建议 |
| **Deep** (深度) | 🧠 | "请深入思考, 从多角度详细分析, 给出专业级回答。" | 教育学原理级别的分析 |

**Plan 模式下的深度差异**：

```
Fast   → 1-2 个最关键的缺失, 每条一句话
Balanced → 分析优缺点, 2-4 个建议, 简要理由
Deep   → 多维度分析 (知识覆盖/学习闭环/认知负荷/记忆曲线), 3-6 个建议, 教育学原理
```

---

## 七、模型选择 —— 用户可以换 AI 大脑

### 7.1 ModelSelector 组件

用户可以在聊天面板中切换 AI 模型，支持 8 个平台：

```
前端 ModelSelector 组件
     ↓ 选择了 { platform: "deepseek", model: "deepseek-reasoner" }
     ↓
SidebarAIPanel → useStreamChat → 请求体中携带 selected_platform + selected_model
     ↓
后端 ai_chat_stream.py → _call_with_model()
     ├── 用户指定了模型? → 直接调用该平台的 API
     └── 未指定? → 走默认降级链 (config.yaml)
```

### 7.2 降级容灾 (复用 ai_router.py)

如果用户没有指定模型，默认走 `config.yaml` 中的路由配置：

```
chat_response 节点的路由:
  Chain B (深度推理): DeepSeek R1 → 百炼 Plus → 火山豆包
  
  如果 DeepSeek 挂了 → 自动切到百炼 qwen-plus
  如果百炼也挂了 → 切到火山 doubao-pro-32k
```

---

## 八、Create 模式深度剖析 —— AI 如何直接操作画布

### 8.1 完整数据流

```
用户输入: "在总结后面加个闪卡节点"
     ↓
[前端] SidebarAIPanel → mode="create"
     ↓
[前端] useCanvasContext.serialize() → 生成画布快照
     ↓
[前端] useStreamChat.send() → POST /api/ai/chat-stream
     ↓
[后端] ai_chat_stream.py 接收请求
     ↓
[后端] 步骤 1: 意图分类 (intent_classifier.md)
     │  → AI 判断: "MODIFY" (有节点 + 修改动词)
     ↓
[后端] 步骤 2: 组装 mode_create.md + identity.md → System Prompt
     │  → 画布上下文注入到 {{canvas_context}} 占位符
     ↓
[后端] 步骤 3: 调用大模型 → AI 返回 JSON
     │  → {"tool_calls": [{"tool": "add_node", "params": {"type": "flashcard", "label": "闪卡生成"}}]}
     ↓
[后端] 步骤 4: SSE 推送给前端
     │  → {intent: "MODIFY", done: true, actions: [{operation: "ADD_NODE", ...}]}
     ↓
[前端] useStreamChat.onDone() → 检测到 intent === "MODIFY"
     ↓
[前端] useActionExecutor.execute(actions) → 真正操作画布
     ↓
[前端] WorkflowStore.setNodes() / setEdges() → 画布上出现新节点 🎉
```

### 8.2 ActionExecutor —— 指令执行器 (`use-action-executor.ts`)

这是 Create 模式的核心——它将 AI 返回的 JSON 指令翻译为实际的画布操作：

**支持 6 种操作**：

| 操作 | 功能 | 安全约束 |
|------|------|---------|
| `ADD_NODE` | 添加新节点 + 自动连线到锚点 | 必须提供 type 和 label |
| `DELETE_NODE` | 删除节点 + 清理关联连线 | 至少保留 1 个节点 |
| `UPDATE_NODE` | 更新节点属性 | 只能改 label，不能改 type/id |
| `COPY_NODE` | 深拷贝节点 (保留配置，重置状态) | 必须提供源节点 ID |
| `ADD_EDGE` | 添加连线 | 自动去重 |
| `DELETE_EDGE` | 删除连线 | 必须提供 source + target |

**关键安全机制 — Snapshot + Undo**：

```typescript
// 执行前自动做快照
store.getState().takeSnapshot();  // 保存当前状态到 past[]

// 如果任何一步出错 → 自动整体回滚
catch (err) {
  store.getState().undo();  // 恢复到快照状态
  return { success: false, error: err.message };
}
```

**通俗解释**: 就像 Word 的"撤销"——AI 操作前自动保存一个还原点，出错了就自动恢复。

### 8.3 坐标计算 —— AI 怎么知道新节点放在哪？

AI 需要计算新节点的 `position`，避免与现有节点重叠：

```python
# mode_create.md 中的规则:
# 1. 找到锚点节点坐标 anchor_x, anchor_y
# 2. 找出画布上所有节点的 max_x
# 3. 新节点 x = max(anchor_x + 340, max_x + 340) — 避免 x 轴重叠
# 4. y = anchor_y (与锚点同行)

# 前端 ActionExecutor 也有保护:
function calcSafeX(existingNodes, anchorX) {
  const maxX = existingNodes.reduce((m, n) => Math.max(m, n.position.x), 0);
  return Math.max(anchorX + 340, maxX + 340);
}
```

### 8.4 节点引用解析 —— 用户怎么指代节点？

用户不会记住节点 ID，而是用自然语言引用节点：

| 用户说法 | AI 解析方式 |
|---------|-----------|
| "第 3 个节点" | `nodes[2].id` |
| "总结节点" / "总结那个" | label 包含 "总结" 的节点 |
| "最后一个" | nodes 列表最后一个元素 |
| "大纲后面的" | 大纲节点的下游节点 |
| "所有闪卡" | 所有 type 为 "flashcard" 的节点 |

---

## 九、Chat 模式的模式边界

Chat 模式有一个重要的 **边界检测机制**——如果用户在对话中表达了修改画布的意图，AI 会友好地引导用户切换模式：

```markdown
用户: "帮我在总结后面加一个闪卡节点"

AI 回复 (Chat 模式):
  我理解你想添加闪卡节点，这是个很好的想法！📝
  不过我当前在「对话模式」下，无法直接操作画布。
  请切换到「创建模式」，然后告诉我同样的需求，我会帮你添加。
  [SUGGEST_MODE:create]  ← 前端会解析并显示切换按钮
```

**前端解析 `[SUGGEST_MODE:xxx]` 标记**：
```
SidebarAIPanel 检测到 [SUGGEST_MODE:create] → 显示「切换到创建模式」按钮
用户点击 → mode 切换为 "create" → 再次发送相同请求 → AI 执行操作
```

---

## 十、Plan 模式的 XML 输出解析

Plan 模式的 AI 返回结构化的 XML：

```xml
<plan>
  <analysis>
    <current_state>画布有 3 个节点: 大纲→内容→总结</current_state>
    <strengths>知识提取链条完整</strengths>
    <gaps>缺少记忆巩固环节 (闪卡/测验)</gaps>
  </analysis>
  <recommendations>
    <step priority="high">
      <action>ADD_NODE</action>
      <description>在总结节点后添加闪卡生成节点</description>
      <node_type>flashcard</node_type>
      <anchor>总结归纳</anchor>
    </step>
    <step priority="medium">
      <action>ADD_NODE</action>
      <description>添加测验节点验证学习效果</description>
      <node_type>quiz_gen</node_type>
      <anchor>闪卡生成</anchor>
    </step>
  </recommendations>
  <response>
    你的工作流已经覆盖了知识提取的核心流程 ✅
    但缺少**记忆巩固环节**。建议添加闪卡 + 测验...
  </response>
</plan>
```

前端 `PlanCard` 组件解析这个 XML 并渲染为美观的卡片 UI。

---

## 十一、SSE 流式传输协议

### 11.1 Chat/Plan 模式 (流式)

```
[后端] → SSE event: {"intent": "CHAT"}      ← 告知前端意图
[后端] → SSE event: {"token": "你的"}        ← 第1个 token
[后端] → SSE event: {"token": "工作流"}      ← 第2个 token
[后端] → SSE event: {"token": "结构"}        ← 第3个 token
[后端] → SSE event: {"token": "..."}         ← ...
[后端] → SSE event: {"done": true, "full": "你的工作流结构..."} ← 完成
[后端] → SSE event: [DONE]                   ← 结束标记
```

前端 `useStreamChat` 在每收到一个 token 时调用 `onToken()` 回调，实时追加到消息内容中，产生打字机效果。

### 11.2 Create 模式 (一次性)

```
[后端] → SSE event: {
    "intent": "MODIFY",
    "done": true,
    "response": "已添加闪卡节点",
    "actions": [{"operation": "ADD_NODE", ...}],
    "model_used": "deepseek-reasoner"
}
```

Create 模式不流式——等 AI 完全生成 JSON 后一次性返回。

---

## 十二、对话历史管理 (`use-conversation-store.ts`)

```
conversationStore (Zustand)
├── entries: ChatEntry[]    ← 所有消息 {role, content, timestamp}
├── addEntry()              ← 添加消息
├── clearHistory()          ← 清空历史
└── entries[-10:]           ← 只取最近 10 条作为上下文发给 AI
```

**10 条历史限制的原因**：
1. 避免 token 消耗过大
2. 保持对话上下文窗口合理
3. 太旧的对话对当前意图理解帮助有限

---

## 十三、完整文件依赖图

```
  ┌──────────────────────── 前端 ────────────────────────────────┐
  │                                                                │
  │  SidebarAIPanel.tsx (聊天面板 UI)                               │
  │       ↓ 使用                                                    │
  │  use-stream-chat.ts (SSE 流式通信)                              │
  │       ↓ 使用                                                    │
  │  use-canvas-context.ts (画布序列化) + use-conversation-store.ts │
  │       ↓ 收到 MODIFY 意图后调用                                   │
  │  use-action-executor.ts (画布操作执行器)                         │
  │       ↓ 操作                                                    │
  │  use-workflow-store.ts (Zustand 画布状态)                       │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
                         ↕ SSE / REST
  ┌──────────────────────── 后端 ────────────────────────────────┐
  │                                                                │
  │  api/ai_chat_stream.py (SSE 流式路由, 主入口)                    │
  │       ↓ 使用                                                    │
  │  api/ai_chat.py (_build_canvas_summary, _call_with_model)      │
  │       ↓ 使用                                                    │
  │  prompts/prompt_loader.py (Markdown 模板加载器)                 │
  │  prompts/identity.md + mode_{chat,plan,create}.md + intent_classifier.md │
  │       ↓ 使用                                                    │
  │  services/ai_router.py (模型路由 + 容灾降级)                    │
  │       ↓ 使用                                                    │
  │  config.yaml (8平台 + 2条降级链)                                │
  │                                                                │
  │  models/ai_chat.py (Pydantic 数据模型)                          │
  │  - AIChatRequest (用户请求)                                     │
  │  - AIChatResponse (响应)                                        │
  │  - CanvasContextSchema (画布上下文)                              │
  │  - CanvasAction (画布操作指令)                                   │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

---

## 十四、关键文件速查 (修改 AI 聊天相关代码时必看)

| 修改目标 | 必须同步检查的文件 |
|----------|------------------|
| 修改 AI 人设/能力 | `prompts/identity.md` |
| 修改意图分类 | `prompts/intent_classifier.md`, `api/ai/chat.py` |
| 修改 Chat 模式行为 | `prompts/mode_chat.md` |
| 修改 Plan 模式行为 | `prompts/mode_plan.md`, `PlanCard.tsx` |
| 修改 Create 模式行为 | `prompts/mode_create.md`, `use-action-executor.ts` |
| 新增画布操作类型 | `mode_create.md` (AI 工具表) + `use-action-executor.ts` (前端执行) + `models/ai_chat.py` (数据模型) |
| 修改画布序列化 | `use-canvas-context.ts` (前端) + `api/ai/chat.py/_build_canvas_summary` (后端) + `models/ai_chat.py` |
| 修改模型选择 | `ModelSelector.tsx`, `ai-models.ts`, `api/ai/chat.py/_call_with_model` |
| 修改思考深度 | `SidebarAIPanel.tsx`, `api/ai/chat.py/_DEPTH_INSTRUCTIONS`, `prompt_loader.py/DEPTH_LABELS` |
| 修改流式通信 | `use-stream-chat.ts` (前端 SSE) + `api/ai/chat.py` (后端 SSE) |
| 修改 AI 路由 | `backend/config.yaml`, `services/llm/router.py`, `services/ai_catalog_service.py` |

---

*本文档基于 StudySolo 产品实际代码撰写，所有数据流和文件路径与 `backend/app/api/ai/*.py`、`backend/app/prompts/`、`frontend/src/features/workflow/hooks/` 下的真实实现一一对应。*
