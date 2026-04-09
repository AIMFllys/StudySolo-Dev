# Phase 2: 后端核心重构

> 预估时间：10 天
> 前置依赖：Phase 1 全部冻结
> 负责人：主系统负责人
> 可并行：Phase 3（前端重构）、Phase 4（子后端样板）

---

## 目标

**消灭后端代码债**——按 Phase 1 冻结的契约，重组路由、消除重复、统一横切关注点。

---

## Task 2.1：AI Chat 合并（关键优先）

> 优先级：最高。当前 ai_chat.py + ai_chat_stream.py 约 80% 重复，每次改 intent 逻辑需改 2 处。

### Step 1：创建共享服务层

```
backend/app/services/ai_chat/
├── __init__.py
├── helpers.py          # 提取 _extract_json_obj, _build_canvas_summary, _call_with_model
├── intent.py           # 提取 Intent 分类 (BUILD/MODIFY/CHAT/ACTION)
├── validators.py       # 提取 Quota 检查, tier 验证, model 解析, fallback
└── generators/
    ├── __init__.py
    └── stream.py       # 流式 SSE 生成器
```

### Step 2：重写 `api/ai/chat.py`

```python
# 合并后的单一文件
@router.post("/chat")
async def ai_chat(body: AIChatRequest, current_user=Depends(get_current_user)):
    # 非流式 → 调用 services/ai_chat

@router.post("/chat/stream")
async def ai_chat_stream(body: AIChatRequest, current_user=Depends(get_current_user)):
    # 流式 → 返回 EventSourceResponse(stream_generator(...))
```

### Step 3：删除旧文件

- 删除 `api/ai_chat.py`
- 删除 `api/ai_chat_stream.py`
- 更新 `router.py` import

### 验证

- [ ] `POST /api/ai/chat` 非流式正常响应
- [ ] `POST /api/ai/chat/stream` 流式 SSE 正常
- [ ] 前端 AI 对话功能完全正常
- [ ] Intent 分类逻辑在一处维护

### AI 编程易出问题的点

> [!WARNING]
> 1. **SSE 格式**：流式 response 必须保持 `data: {json}\n\n` 格式，AI 容易忘记双换行
> 2. **Import 链**：合并后 `_build_canvas_summary` 从 `services/ai_chat/helpers.py` import，不要在 api 层重新定义
> 3. **`_normalize_modify_actions` vs `_extract_json_obj`**：stream 版本有扩展，合并时不能丢失
> 4. **current_user 类型**：是 dict 不是 Pydantic model，AI 容易假设错误类型
> 5. **Quota fallback 链**：要保持 `_resolve_source_subtype` + `_resolve_assistant_subtype` 的语义差异

---

## Task 2.2：Usage Tracker 装饰器实现

### Step 1：创建装饰器

```
backend/app/services/usage/
├── __init__.py
├── tracker.py          # UsageTracker 类
├── decorators.py       # @track_usage 装饰器
└── models.py           # UsageContext 等 Pydantic models
```

### Step 2：试点 1 个 API

先在 `api/ai.py`（generate-workflow）上试用：

```python
# Before
@router.post("/generate-workflow")
async def generate_workflow(body, current_user=Depends(...)):
    usage_request = await create_usage_request(...)
    with bind_usage_request(usage_request):
        # ... 200 行业务逻辑 ...

# After
@router.post("/generate-workflow")
@track_usage("assistant", "generate_workflow")
async def generate_workflow(body, current_user=Depends(...)):
    # ... 纯业务逻辑 ...
```

### Step 3：推广到所有 API

按优先级：
1. `api/ai/chat.py`（合并后的）
2. `api/workflow_execute.py`
3. 其余有 usage_ledger 模式的 API

### AI 编程易出问题的点

> [!WARNING]
> 1. **`current_user` 位置不固定**：有些 endpoint 是 `kwargs['current_user']`，有些是位置参数，装饰器必须用 `inspect` 或约定
> 2. **流式 endpoint 特殊**：`@track_usage` 在流式场景下需要在生成器完成后 finalize，不能在 response 返回时就 finalize
> 3. **异步 context manager**：`async with tracker.request(...)` 不能用同步 `with`
> 4. **SSE response 的 status**：EventSourceResponse 即使内容出错，HTTP status 也是 200，需要在生成器内部 catch

---

## Task 2.3：Workflow 路由重组

### 操作

将 4 个 workflow 路由文件移入子目录：

```
api/workflow/
├── __init__.py           # 聚合路由
├── crud.py               # ← 由 workflow.py 移入
├── execute.py            # ← 由 workflow_execute.py 移入
├── social.py             # ← 由 workflow_social.py 移入
└── collaboration.py      # ← 由 workflow_collaboration.py 移入
```

**`__init__.py` 聚合**：

```python
from fastapi import APIRouter
from .crud import router as crud_router
from .execute import router as execute_router
from .social import router as social_router
from .collaboration import router as collaboration_router

router = APIRouter()
router.include_router(crud_router)
router.include_router(execute_router)
router.include_router(social_router)
router.include_router(collaboration_router)
```

**`router.py` 简化**：

```python
from app.api.workflow import router as workflow_router
router.include_router(workflow_router, prefix="/workflow", tags=["workflow"])
# 删除原来的 4 行
```

### AI 编程易出问题的点

> [!WARNING]
> 1. **相对导入**：子目录内部用 `from . import xxx`，不要继续用 `from app.api.workflow import`
> 2. **Tags**：合并后仍需要保留不同的 tags 用于 Swagger 分组
> 3. **中间件/依赖注入**：某些路由可能有独立的 `Depends`，移动后路径不能变

---

## Task 2.4：AI 路由重组

将 5 个 AI 路由文件合并为子目录：

```
api/ai/
├── __init__.py           # 聚合路由
├── chat.py               # ← 合并后的 ai_chat (Task 2.1 产出)
├── generate.py           # ← 由 ai.py 移入（generate-workflow）
├── catalog.py            # ← 由 ai_catalog.py 移入
└── models.py             # ← 由 ai_chat_models.py 移入
```

---

## Task 2.5：LLM 服务边界重划

当前 `services/ai_router.py`（~197行）职责过多。

### 目标

```
services/llm/
├── router.py             # 只做路由选择（resolve_task_route_skus, _build_route_candidates）
├── caller.py             # ← 保持 llm_caller.py 核心逻辑
├── provider.py           # ← 保持 llm_provider.py 核心逻辑
└── generators/
    ├── base.py           # 生成器基类
    ├── streaming.py      # 流式生成器逻辑（从 ai_router.py 提取）
    └── structured.py     # 结构化输出生成器
```

### AI 编程易出问题的点

> [!WARNING]
> 1. **循环导入**：`generator` 中依赖 `caller`，`caller` 中又 yield from `generator`，需要通过接口/协议 class 断环
> 2. **`config.yaml` 的 task_routes**：路由选择逻辑强依赖 config 解析，不能拆得太碎

---

## Task 2.6：配置架构升级（可选，低优先）

将 `core/config.py` 从 flat 改为 nested 结构。

> [!NOTE]
> 此任务改动面大（所有 `settings.xxx` 引用），建议放在 Phase 2 最后，如果时间不够可以推到 Phase 5。

---

## Phase 2 完成标志

- [ ] ai_chat + ai_chat_stream 已合并，旧文件已删除
- [ ] @track_usage 装饰器已实现，至少 3 个 API 已应用
- [ ] Workflow 路由已重组为子目录
- [ ] AI 路由已重组为子目录
- [ ] LLM 服务边界已重划
- [ ] router.py 从 30+ import 精简到 ~15 import
- [ ] 所有现有测试通过
- [ ] 前端功能无回归（手动测试 checklist）

> [!IMPORTANT]
> **回滚策略**：每个 Task 是独立 PR，合并后若发现严重回归，可单独 revert 该 PR。Git 分支策略：`refactor/phase2-task2.1`, `refactor/phase2-task2.3` 等。
