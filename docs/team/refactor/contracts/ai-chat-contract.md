# AI Chat 合并 API 契约（冻结契约）

> 版本：v1.0 | 冻结日期：2026-04-10
> 状态：🔒 已冻结 — 修改需三人 Sync + 版本号升级
> 关联 Phase：Phase 1 Task 1.3
> 实现计划：Phase 2 Task 2.x

---

## 背景与问题

当前 AI Chat 功能由两个文件维护：

| 文件 | 行数 | 端点 | 职责 |
|------|------|------|------|
| `api/ai_chat.py` | 234 行 | `POST /api/ai/chat` | 非流式对话 |
| `api/ai_chat_stream.py` | 307 行 | `POST /api/ai/chat-stream` | 流式对话 |

**重复度约 80%**。以下逻辑在两个文件中几乎完全一致：

- `_extract_json_obj()` — JSON 解析
- `_build_canvas_summary()` — 画布上下文构建
- `_call_with_model()` — 模型路由调用
- Intent 分类流程 (`classify_msgs → _call_with_model → _extract_json_obj`)
- Usage 请求生命周期 (`create_usage_request → bind → finalize`)
- SKU 解析与 tier 校验 (`resolve_selected_sku → is_tier_allowed`)
- 会话历史截取 (`conversation_history[-10:]`)

---

## 冻结后的 API 端点

### 非流式

```
POST /api/ai/chat
Content-Type: application/json
Authorization: Bearer <jwt>
```

**Request Body**: `AIChatRequest`（不变）

```python
class AIChatRequest(BaseModel):
    user_input: str = Field(..., min_length=1, max_length=4000)
    canvas_context: CanvasContextSchema | None = None
    conversation_history: list[ChatMessageSchema] = Field(
        default_factory=list, max_length=20,
    )
    intent_hint: str | None = None
    selected_model_key: str | None = None
    selected_model: str | None = None
    selected_platform: str | None = None
    thinking_level: Literal["fast", "balanced", "deep"] = "balanced"
    mode: Literal["plan", "chat", "create"] = "chat"
```

**Response**: `AIChatResponse`（不变）

```python
class AIChatResponse(BaseModel):
    intent: str                               # "CHAT" | "BUILD" | "MODIFY" | "ACTION" | "PLAN"
    response: str
    actions: list[CanvasAction] | None = None
    model_used: str = ""
    platform_used: str = ""
```

### 流式

```
POST /api/ai/chat-stream
Content-Type: application/json
Authorization: Bearer <jwt>
Response: text/event-stream (SSE)
```

**Request Body**: `AIChatRequest`（同上）

**SSE 事件格式（冻结）**:

```
# 1. Intent 声明（首包）
data: {"intent": "CHAT"}

# 2. Token 流（中间包，仅 mode=chat/plan 时）
data: {"token": "你好"}
data: {"token": "，这是"}

# 3. 完成包（末包）
data: {"done": true, "full": "完整内容..."}

# 4. 结束信号
data: [DONE]
```

**特殊场景 SSE 格式**:

```
# Quota 降级警告（在 token 流之前）
data: {"quota_warning": true, "message": "...", "used": 5, "limit": 5}

# Create 模式（mode=create）— 非流式一次性返回
data: {"intent": "MODIFY", "done": true, "response": "...", "actions": [...], "model_used": "..."}

# 错误包
data: {"error": "AI 模型调用失败，请稍后重试", "done": true}
```

---

## 共享逻辑提取契约

合并后的模块结构（Phase 2 实现）：

```
backend/app/services/ai_chat/
├── __init__.py
├── helpers.py          # _extract_json_obj, _build_canvas_summary
├── model_caller.py     # _call_with_model — 模型路由调用
├── intent.py           # Intent 分类逻辑（classify → parse → fallback）
├── validators.py       # SKU 解析, tier 校验, quota 检查
└── generators/
    └── stream.py       # SSE 流式生成器 (_chat_stream_generator)
```

### helpers.py Public API

```python
def extract_json_obj(text: str) -> dict:
    """从 LLM 输出中提取 JSON 对象。支持 markdown code block 包裹。"""

def build_canvas_summary(ctx: CanvasContextSchema | None) -> str:
    """将画布上下文序列化为 LLM 可读的文本摘要。"""
```

### model_caller.py Public API

```python
async def call_with_model(
    selected_model_key: str | None,
    platform: str | None,
    model: str | None,
    messages: list[dict],
    stream: bool = False,
) -> tuple[str, str, str] | AsyncIterator[str]:
    """统一模型调用入口。非流式返回 (content, provider, model)，流式返回 token 迭代器。"""
```

### intent.py Public API

```python
async def classify_intent(
    body: AIChatRequest,
    canvas_summary: str,
    model_identity: str,
) -> str:
    """返回 Intent: "BUILD" | "MODIFY" | "CHAT" | "ACTION" | "PLAN"。"""
```

### validators.py Public API

```python
async def validate_and_resolve_sku(
    body: AIChatRequest,
    user_tier: str,
) -> tuple[ResolvedSku | None, bool]:
    """返回 (resolved_sku, is_quota_degraded)。若 tier 不足，raise TierForbiddenError。"""

def resolve_source_subtype(body: AIChatRequest) -> str:
    """根据 mode 和 intent_hint 返回 usage source_subtype。"""
```

---

## 保持不变的接口

| 项目 | 状态 | 说明 |
|------|------|------|
| `AIChatRequest` Pydantic 模型 | 🔒 冻结 | 字段不增不减 |
| `AIChatResponse` Pydantic 模型 | 🔒 冻结 | 字段不增不减 |
| `CanvasContextSchema` | 🔒 冻结 | 前端序列化格式 |
| `ChatMessageSchema` | 🔒 冻结 | 前后端共用 |
| `CanvasAction` | 🔒 冻结 | 画布操作指令 |
| SSE event 格式 | 🔒 冻结 | 前端 EventSource 解析依赖 |
| URL 路径 | 🔒 冻结 | `/api/ai/chat` + `/api/ai/chat-stream` |

---

## AI 编程易出问题的点

1. **`_extract_json_obj` 提取后不要改名为 `extract_json`**：前端的 ActionExecutor 依赖于 `tool_calls / actions` 字段名，解析逻辑不可变
2. **SSE 事件不要加 `event:` 字段**：当前前端使用 `EventSource` 的默认 `message` 事件，不要添加自定义 event type
3. **`conversation_history[-10:]` 截取逻辑**：合并时必须保留，不要把截取移到前端
4. **Mode 与 Intent 的关系**：`mode=create` 会走 MODIFY/BUILD 分支，不是简单的 chat；`mode=plan` 最终 intent 固定为 `PLAN`

---

## 签字确认

| 角色 | 姓名 | 签字 | 日期 |
|------|------|------|------|
| 主系统负责人 | | ☐ | |
| 队友 B | | ☐ | |
| 队友 C | | ☐ | |
