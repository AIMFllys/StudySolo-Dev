# Usage Tracker 装饰器契约（冻结契约）

> 版本：v1.0 | 冻结日期：2026-04-10
> 状态：🔒 已冻结 — 修改需三人 Sync + 版本号升级
> 关联 Phase：Phase 1 Task 1.4
> 实现计划：Phase 2 Task 2.x

---

## 背景与问题

当前 `usage_ledger.py`（347 行）提供了三阶段 Usage 跟踪：

```python
# 在 4+ 个 API 文件中重复的模式：
usage_request = await create_usage_request(user_id=..., source_type=..., ...)
request_status = "completed"

with bind_usage_request(usage_request):
    try:
        # ... 业务逻辑 ...
    except Exception:
        request_status = "failed"
        raise
    finally:
        await finalize_usage_request(usage_request.request_id, request_status)
```

**重复出现位置**（已确认）：

| 文件 | 行数范围 | 模式 |
|------|---------|------|
| `api/ai_chat.py` | L101-L233 | create → bind → try/finally/finalize |
| `api/ai_chat_stream.py` | L95-L297 | create → bind → try/finally/finalize |
| `api/workflow_execute.py` | 多处 | create → bind → try/finally/finalize |
| `api/ai.py` | 分散 | create → finalize（无 bind context） |

---

## 冻结的装饰器接口

### Public API — 装饰器模式

```python
from app.services.usage_tracker import track_usage

@router.post("/chat", response_model=AIChatResponse)
@track_usage(source_type="assistant", source_subtype="chat")
async def ai_chat(
    body: AIChatRequest,
    current_user: dict = Depends(get_current_user),
):
    # ✅ 业务逻辑，完全不用管 usage
    # ✅ 装饰器自动：create → bind → finalize
    # ✅ 异常时自动 status="failed"
    ...
```

### 装饰器行为规约

```python
def track_usage(
    *,
    source_type: str,                    # "assistant" | "workflow"
    source_subtype: str | None = None,   # "chat" | "modify" | "plan" | None
    workflow_id_param: str | None = None, # 从请求体字段提取 workflow_id
):
    """
    装饰器行为：
    1. 从 Depends(get_current_user) 获取 user_id
    2. 调用 create_usage_request() 创建请求记录
    3. 自动 bind_usage_request() → ContextVar
    4. 执行被装饰函数
    5. 正常完成 → finalize(status="completed")
    6. 异常抛出 → finalize(status="failed") → 重新 raise
    """
```

### 高级用法 — source_subtype 动态解析

```python
@track_usage(
    source_type="assistant",
    source_subtype=None,  # None = 从请求体动态解析
    subtype_resolver=lambda body: "modify" if body.intent_hint == "MODIFY" else "chat",
)
async def ai_chat(body: AIChatRequest, ...):
    ...
```

---

## 冻结的内部契约

### UsageTracker 类接口

```python
class UsageTracker:
    """内部实现类 — 装饰器的底层引擎。"""

    async def begin(
        self,
        user_id: str,
        source_type: str,
        source_subtype: str,
        *,
        workflow_id: str | None = None,
        workflow_run_id: str | None = None,
        conversation_id: str | None = None,
        message_id: str | None = None,
    ) -> UsageContext:
        """创建 usage 请求记录并返回上下文。"""

    async def finalize(
        self,
        context: UsageContext,
        status: Literal["completed", "failed"],
    ) -> None:
        """关闭 usage 请求并更新状态。"""
```

### UsageContext 数据类

```python
@dataclass(slots=True)
class UsageContext:
    request_id: str
    user_id: str
    source_type: str
    source_subtype: str
    workflow_id: str | None = None
    workflow_run_id: str | None = None
    conversation_id: str | None = None
    message_id: str | None = None
```

> **注意**：这与现有 `BoundUsageRequest` 完全兼容，Phase 2 只需 rename 或 alias。

---

## 不变的底层契约

以下 `usage_ledger.py` 函数签名保持冻结：

| 函数 | 签名 | 变更策略 |
|------|------|---------|
| `record_usage_event()` | 现有 17 个参数 | 🔒 冻结 — 不改签名 |
| `bind_usage_request()` | ContextVar context manager | 🔒 冻结 — 装饰器内部使用 |
| `bind_usage_call()` | ContextVar context manager | 🔒 冻结 — engine 使用 |
| `parse_openai_usage()` | `(usage: Any) -> UsageNumbers` | 🔒 冻结 |
| `estimate_usage_from_messages()` | `(messages, output_text) -> UsageNumbers` | 🔒 冻结 |
| `calculate_cost_cny()` | `(usage, pricing) -> float` | 🔒 冻结 |

---

## 数据表契约

装饰器写入的表（不变）：

| 表名 | 写入时机 | 关键字段 |
|------|---------|---------|
| `ss_ai_requests` | `begin()` 创建 | `user_id, source_type, source_subtype, status, started_at` |
| `ss_ai_requests` | `finalize()` 更新 | `status, finished_at` |
| `ss_ai_usage_events` | `record_usage_event()` | `request_id, provider, model, tokens, cost_amount_cny` |
| `ss_ai_usage_minute_rollups` | RPC `fn_ss_ai_usage_minute_increment` | 聚合统计 |

---

## AI 编程易出问题的点

1. **装饰器必须在 `@router.post()` 之后**：FastAPI 装饰器顺序敏感，`@track_usage` 必须紧贴函数定义
2. **不要把 `current_user` 移出 Depends**：装饰器内部通过 `**kwargs` 或 inspect 获取 current_user，不要改成位置参数
3. **流式端点特殊处理**：`ai_chat_stream` 返回的是 `EventSourceResponse`，`finalize()` 必须在生成器的 `finally` 块中，不能在装饰器外层
4. **ContextVar 线程安全**：`bind_usage_request()` 使用 `ContextVar`，在 async 环境下每个 request 独立，不要改成全局变量

---

## 签字确认

| 角色 | 姓名 | 签字 | 日期 |
|------|------|------|------|
| 主系统负责人 | | ☐ | |
| 队友 B | | ☐ | |
| 队友 C | | ☐ | |
