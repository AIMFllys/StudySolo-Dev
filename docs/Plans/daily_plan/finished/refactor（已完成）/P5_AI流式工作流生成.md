# P5 — AI 流式工作流生成

> **优先级**: 🔵 P5（P4 面板增强之后）  
> **前置依赖**: P2 ✅ (addNode action + 所有节点可执行) · P3 ✅ (存储机制稳定) · P4 ✅ (AI 思考流面板就绪)  
> **预估工时**: 25-32h  
> **目标**: 用户输入自然语言描述 → AI 按「分析 → 分域规划 → 逐节点生成」的递归模式流式创建工作流，全过程在右侧 AI 面板实时展示

---

## 一、核心设计理念

### 1.1 从"瀑布式"到"涌泉式"

```
当前 (瀑布式):
  用户输入 → [10-30s 黑盒等待] → 所有节点一次性全部出现

目标 (涌泉式):
  用户输入
    → 1s: 🧠 "分析中... 这是 React Hooks 学习任务" (AI 面板可见)
    → 2s: 📐 "拆分为: 输入采集 / 学习处理 / 输出整合" (AI 面板可见)
    → 3s: 📥 [输入区] 节点 1 pop in 画布 (AI 面板 + 画布可见)
    → 5s: ⚙️ [处理区] 节点 2-4 逐个 pop in (AI 面板 + 画布可见)
    → 7s: 📤 [输出区] 节点 5-6 pop in (AI 面板 + 画布可见)
    → 8s: 🔗 连线绘制 → 布局优化 → 完成！
```

### 1.2 三阶段管线

```
Stage 1: 需求分析 + 区域规划 (AI_Analyzer 改造)
  → 输入: 用户自然语言
  → 输出: ZonePlan[] (各区域的节点计划)
  → 体验: 思考过程实时展示在 AI 面板

Stage 2: 逐区域节点生成 (Zone Planner)
  → 输入: 单个 Zone 的上下文
  → 输出: 该 Zone 内的完整节点定义
  → 体验: 每个节点生成后立即出现在画布

Stage 3: 全局连线 + 布局优化
  → 输入: 所有已生成节点
  → 输出: edges[] + 最终坐标
  → 体验: 连线动画绘制，节点滑动到最终位置
```

---

## 二、新增 SSE 事件协议

### 2.1 事件类型清单

在现有 5 种**执行**事件基础上，新增 **11 种生成事件**:

| 事件类型 | Payload | 用途 |
|----------|---------|------|
| `generation_start` | `{ user_input }` | 标记生成流程开始 |
| `generation_thinking` | `{ content, stage }` | AI 思考过程 (流式文本) |
| `generation_plan` | `{ zones: ZonePlan[] }` | 区域规划结果 |
| `zone_start` | `{ zone_id, zone_type, label, description }` | 区域开始生成 |
| `zone_thinking` | `{ zone_id, content }` | 区域内思考过程 |
| `node_created` | `{ zone_id, node: WorkflowNodeSchema }` | 单节点生成完毕 |
| `zone_done` | `{ zone_id, node_count }` | 区域生成完毕 |
| `edges_created` | `{ edges: WorkflowEdgeSchema[] }` | 全局连线 |
| `layout_applied` | `{ positions: Record<string, {x,y}> }` | 最终布局 |
| `generation_done` | `{ total_nodes, total_edges, duration_ms }` | 生成完毕 |
| `generation_error` | `{ error, stage, zone_id? }` | 生成报错 |

### 2.2 命名空间隔离

```
执行事件:  node_status | node_token | node_done | workflow_done | save_error
生成事件:  generation_* | zone_* | node_created | edges_created | layout_applied
```

---

## 三、后端 Task 清单

### Phase 5A: 数据模型 (1h)

#### T5A.1: 新增 Pydantic 模型

**修改文件**: `backend/app/models/ai.py`

```python
class ZonePlan(BaseModel):
    zone_id: str
    zone_type: str  # input | processing | output | analysis | interaction
    label: str
    description: str
    estimated_nodes: int
    depends_on: list[str] = []

class GenerationEvent(BaseModel):
    event: str
    data: dict
```

---

### Phase 5B: 流式生成端点 (3-4h)

#### T5B.1: 新增 SSE 端点

**修改文件**: `backend/app/api/ai.py`

```python
@router.post("/generate-workflow-stream")
async def generate_workflow_stream(
    body: GenerateWorkflowRequest,
    current_user = Depends(get_current_user),
):
    return StreamingResponse(
        _generate_workflow_sse(body.user_input, current_user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
```

保留现有 `/generate-workflow` 端点作为降级通道。

#### T5B.2: 三阶段生成器

```python
async def _generate_workflow_sse(user_input: str, user) -> AsyncIterator[str]:
    yield sse_event("generation_start", {"user_input": user_input})
    
    try:
        # Stage 1: 分析 + 区域规划
        analysis, zones = await _stage1_analyze_and_plan(user_input, sse_yield=yield)
        yield sse_event("generation_plan", {"zones": [z.dict() for z in zones]})
        
        # Stage 2: 逐区域生成节点
        all_nodes = []
        for zone in zones:
            yield sse_event("zone_start", zone.summary_dict())
            nodes = await _stage2_generate_zone(zone, analysis, sse_yield=yield)
            all_nodes.extend(nodes)
            yield sse_event("zone_done", {"zone_id": zone.zone_id, "node_count": len(nodes)})
        
        # Stage 3: 连线 + 布局
        edges = _infer_edges(all_nodes, zones)
        positions = _auto_layout_nodes(all_nodes, edges)
        
        # 注入 system_prompt + model_route
        enriched_nodes = _enrich_nodes(all_nodes)
        
        yield sse_event("edges_created", {"edges": edges})
        yield sse_event("layout_applied", {"positions": positions})
        yield sse_event("generation_done", {
            "total_nodes": len(all_nodes),
            "total_edges": len(edges),
        })
    except Exception as e:
        yield sse_event("generation_error", {"error": str(e), "stage": "unknown"})
```

---

### Phase 5C: 分阶段 AI 调用 (6-8h)

#### T5C.1: Stage 1 — 分析器改造

改造现有 `_call_with_retry("ai_analyzer", ...)` 为流式模式:
- 流式环节: 分析过程的 thinking 文本 (用户可见)
- 结构化环节: 最终输出 ZonePlan[]

```python
async def _stage1_analyze_and_plan(user_input, sse_yield):
    # Phase A: 流式思考 (用户可见)
    thinking = ""
    async for token in call_llm("ai_analyzer", messages, stream=True):
        thinking += token
        await sse_yield(sse_event("generation_thinking", {
            "content": thinking, "stage": "需求分析"
        }))
    
    # Phase B: 结构化区域规划
    plan_prompt = build_zone_plan_prompt(thinking)
    plan_json = await call_llm("ai_planner", plan_prompt, stream=False)
    zones = validate_zone_plan(plan_json)
    
    return thinking, zones
```

#### T5C.2: Stage 2 — 区域节点生成器

每个 Zone 独立调用 AI，生成该区域的节点:

```python
async def _stage2_generate_zone(zone, analysis, sse_yield):
    # 动态构建 prompt — 注入该 Zone 可用的节点类型
    available_nodes = [
        n.to_manifest() for n in NODE_REGISTRY.values()
        if n.category == zone.zone_type
    ]
    
    # Phase A: 流式思考
    thinking = ""
    async for token in call_llm("zone_planner", messages, stream=True):
        thinking += token
        await sse_yield(sse_event("zone_thinking", {
            "zone_id": zone.zone_id, "content": thinking
        }))
    
    # Phase B: 结构化节点生成
    nodes_json = await call_llm("zone_planner", structured_prompt, stream=False)
    nodes = validate_zone_nodes(nodes_json)
    
    # Phase C: 逐个推送节点
    for node in nodes:
        enriched = enrich_single_node(node)
        await sse_yield(sse_event("node_created", {
            "zone_id": zone.zone_id,
            "node": enriched.dict()
        }))
    
    return nodes
```

#### T5C.3: 动态注册表注入

AI Planner 的 system prompt 从硬编码改为动态:

```python
def build_zone_planner_prompt(zone_type: str) -> str:
    available = [
        f"- {n.node_type}: {n.description} (output: {n.output_format})"
        for n in NODE_REGISTRY.values()
        if n.category == zone_type and n.node_type not in ('ai_analyzer', 'ai_planner')
    ]
    return f"""
你是 [{zone_type}] 区域的节点规划器。
可用节点类型:
{chr(10).join(available)}

请从以上类型中选择最合适的节点来完成该区域的任务。
"""
```

---

### Phase 5D: 降级与错误处理 (2h)

#### T5D.1: 自动降级

```python
try:
    async for event in _generate_workflow_sse(user_input, user):
        yield event
except Exception:
    # 降级为同步模式
    result = await generate_workflow_sync(user_input, user)
    yield sse_event("generation_done", {
        "nodes": result.nodes,
        "edges": result.edges,
        "fallback": True,
    })
```

#### T5D.2: Zone 失败隔离

单个 Zone 失败不影响其他 Zone:

```python
for zone in zones:
    try:
        nodes = await _stage2_generate_zone(zone, ...)
        all_nodes.extend(nodes)
    except Exception as e:
        yield sse_event("generation_error", {
            "error": str(e),
            "stage": "zone_generation",
            "zone_id": zone.zone_id,
        })
        # 继续生成其他 Zone
```

---

## 四、前端 Task 清单

### Phase 5E: SSE 消费 Hook (4-5h)

#### T5E.1: use-workflow-generation Hook

**新建文件**: `frontend/src/features/workflow/hooks/use-workflow-generation.ts`

使用 `fetch` + `ReadableStream` 手动解析 SSE（因为 `EventSource` 不支持 POST）:

```typescript
async function startStreamGeneration(input: string, handlers: GenerationHandlers) {
  const response = await fetch('/api/ai/generate-workflow-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_input: input }),
  });
  
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    
    for (const eventStr of events) {
      const { eventType, data } = parseSSE(eventStr);
      handlers[eventType]?.(data);
    }
  }
}
```

#### T5E.2: 事件处理器映射

```typescript
const handlers: GenerationHandlers = {
  generation_start: () => {
    setGenerationStatus('analyzing');
    aiProcessStore.clearEntries();
    aiProcessStore.setActive(true);
    // 自动切换到 AI 过程 Tab
    setPanelMode('ai_process');
  },
  
  generation_thinking: ({ content, stage }) => {
    aiProcessStore.updateLastEntry(content);
  },
  
  generation_plan: ({ zones }) => {
    setGenerationStatus('generating');
    aiProcessStore.addEntry({ type: 'plan', stage: '区域规划', content: formatZonePlan(zones) });
  },
  
  node_created: ({ zone_id, node }) => {
    // 复用 P2 的 addNode action!
    workflowStore.addNode(convertToXYFlowNode(node));
    aiProcessStore.addEntry({ type: 'node_created', stage: '节点生成', nodeType: node.type, content: `创建: ${node.label}` });
  },
  
  edges_created: ({ edges }) => {
    workflowStore.addEdges(edges);
  },
  
  layout_applied: ({ positions }) => {
    workflowStore.batchUpdatePositions(positions);
  },
  
  generation_done: (data) => {
    setGenerationStatus('done');
    aiProcessStore.setActive(false);
    aiProcessStore.addEntry({ type: 'done', stage: '完成', content: `🎉 生成完毕！${data.total_nodes} 节点，${data.total_edges} 连线` });
  },
  
  generation_error: ({ error, stage }) => {
    aiProcessStore.addEntry({ type: 'error', stage, content: error });
  },
};
```

---

### Phase 5F: 画布动画 (3-4h)

#### T5F.1: 节点入场动画

给 AIStepNode 添加 Framer Motion 入场效果:

```typescript
import { motion } from 'framer-motion';

// 在 AIStepNode 外层
<motion.div
  initial={{ scale: 0.5, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
>
  {/* 现有节点内容 */}
</motion.div>
```

#### T5F.2: 连线绘制动画

```css
.react-flow__edge-path[data-new="true"] {
  stroke-dasharray: 500;
  stroke-dashoffset: 500;
  animation: edge-draw 0.6s ease-out forwards;
}

@keyframes edge-draw {
  to { stroke-dashoffset: 0; }
}
```

#### T5F.3: 布局过渡动画

节点从当前位置到最终位置的平滑过渡:

```typescript
// 收到 layout_applied 后
function animateToFinalLayout(positions: Record<string, {x: number, y: number}>) {
  // 方案: 直接更新节点 position，配合 CSS transition
  // node 元素: transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)
  batchUpdatePositions(positions);
  
  // 500ms 后 fitView
  setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 600);
}
```

---

### Phase 5G: WorkflowPromptInput 改造 (2h)

#### T5G.1: 切换到流式模式

修改 `WorkflowPromptInput.tsx`:

```typescript
// 替换现有的 fetch + await json
const { startGeneration, generationStatus, cancelGeneration } = useWorkflowGeneration();

const handleGenerate = () => {
  if (!input.trim() || generationStatus === 'running') return;
  startGeneration(input.trim());
};
```

#### T5G.2: 生成状态 UI

```
状态: idle      → 显示 "生成工作流" 按钮
状态: analyzing → 显示 "🧠 分析中..." + 脉冲动画
状态: generating → 显示 "⚙️ 生成中 (3/7)" + 进度指示
状态: done      → 显示 "✅ 完成！" → 2s 后恢复 idle
状态: error     → 显示错误信息 + 重试按钮
```

---

## 五、降级/取消机制

### 5.1 用户取消生成

```typescript
// 使用 AbortController
const abortController = new AbortController();

fetch('/api/ai/generate-workflow-stream', {
  signal: abortController.signal,
  ...
});

// 用户点击"停止"
cancelGeneration = () => {
  abortController.abort();
  // 保留已生成的节点，不清空画布
};
```

### 5.2 后端检测客户端断开

```python
async def _generate_workflow_sse(user_input, user):
    for zone in zones:
        # 检查客户端是否断开
        if await request.is_disconnected():
            return
        # 继续生成...
```

---

## 六、验收标准

| # | 验收项 | 标准 |
|---|--------|------|
| G1 | 简单任务 (3 节点) | 首个节点 ≤ 3s 出现，全程 ≤ 10s |
| G2 | 复杂任务 (7+ 节点) | 首个节点 ≤ 3s，逐个出现，全程 ≤ 20s |
| G3 | AI 面板实时展示 | 分析/规划/节点生成过程全部可见 |
| G4 | 画布节点逐个出现 | 每个节点有入场动画 |
| G5 | 连线动画 | 边从源到目标有绘制动画 |
| G6 | 取消生成 | 点击停止 → 保留已有节点 → 可继续手动编辑 |
| G7 | 降级模式 | 流式失败 → 自动回退同步模式 → 节点一次性出现 |
| G8 | 生成后可执行 | AI 生成的工作流可直接点击"运行全部"执行 |
| G9 | 旧端点兼容 | `/generate-workflow` 同步端点仍可用 |
