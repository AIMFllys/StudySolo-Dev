# Phase 1: 接口契约冻结

> 预估时间：5 天
> 前置依赖：Phase 0 全部完成
> 负责人：主系统负责人（与 B 协作设计 Gateway 契约）
> 阻断条件：本 Phase 未完成，禁止队友并行开发

---

## 目标

**冻结所有模块间接口**——让团队能独立开发而不互踩。冻结 ≠ 实现，冻结只是"写下来、签字、不许改"。

---

## Task 1.1：冻结后端依赖方向图

输出 `docs/team/refactor/contracts/backend-deps.md`：

```
models/         ← 所有层可依赖（只读数据模型）
core/           ← api/, services/, engine/ 可依赖
services/       ← api/ 可依赖（api → services → models）
api/            ← 禁止依赖 engine/（防循环）
engine/         ← nodes/ 可依赖
nodes/          ← 禁止依赖 api/, services/（防循环）
middleware/     ← 只被 main.py 引用
```

**违反处理**：Code Review 硬拒。

---

## Task 1.2：冻结前端依赖方向图

输出 `docs/team/refactor/contracts/frontend-deps.md`：

```
types/          ← 所有模块可依赖（只读）
components/ui/  ← 所有模块可依赖
services/       ← features/ 可依赖
stores/         ← components/ 和 hooks/ 可依赖
hooks/          ← components/ 可依赖
features/       ← features 之间禁止互相导入（必须通过 services/ 或 stores/ 的 public API）
```

**违反处理**：ESLint `import/no-restricted-paths` 规则自动 block。

---

## Task 1.3：冻结 AI Chat 合并后的 API 契约

当前 `/ai/chat` 和 `/ai/chat/stream` 分别由 `ai_chat.py`（234行）和 `ai_chat_stream.py`（307行）维护，~80% 重复。

**冻结合并后的 API 契约**（实现在 Phase 2）：

```yaml
# 非流式
POST /api/ai/chat
Request:  AIChatRequest { messages, model_key?, intent? }
Response: AIChatResponse { content, intent, model_used, usage }

# 流式
POST /api/ai/chat/stream
Request:  AIChatRequest（同上）
Response: SSE stream → data: { content, done, usage? }
```

**共享逻辑提取契约**：
```
services/ai_chat/
├── helpers.py        # _extract_json_obj, _build_canvas_summary, _call_with_model
├── intent.py         # Intent 分类逻辑
├── validators.py     # Quota 检查, tier 验证, model 解析
└── generators/
    └── stream.py     # SSE 流式生成器
```

> **关键输出**：`docs/team/refactor/contracts/ai-chat-contract.md`

---

## Task 1.4：冻结 Usage Tracker 装饰器契约

当前 `usage_ledger` 的 create → bind → finalize 模式在 4+ 个 API 文件中重复。

**冻结装饰器接口**：

```python
# 冻结的 public API
@track_usage(source_type="assistant", source_subtype="chat")
async def endpoint(body, current_user=Depends(...)):
    ...  # 业务逻辑，无需管 usage

# 冻结的内部契约
class UsageTracker:
    async def begin(user_id, source_type, source_subtype) -> UsageContext
    async def finalize(context, status: "completed" | "failed")
```

> **关键输出**：`docs/team/refactor/contracts/usage-tracker-contract.md`

---

## Task 1.5：冻结 Agent Gateway 契约

与队友 B 共同设计，三人签字确认。

### 1.5.1 子后端必须实现的接口

```
GET  /health                    → { status, agent, version }
GET  /health/ready              → { ready: bool }
GET  /v1/models                 → { object: "list", data: [...] }
POST /v1/chat/completions       → OpenAI 标准格式
```

### 1.5.2 四层兼容性要求

| 层级 | 冻结内容 | 验证方式 |
|------|---------|---------|
| 请求兼容 | model / messages / temperature / stream / max_tokens | Schema 校验 |
| 响应兼容 | 非流/流式 chunk / error.code+message 格式 | 集成测试 |
| 运行时兼容 | 30s 默认超时 / 3 次重试 / 幂等 POST | 契约测试 |
| 平台治理兼容 | X-Request-Id header / usage.total_tokens 必返 / version 字段 | Gateway 检查 |

### 1.5.3 主后端 Gateway 层接口

```python
# 冻结的 public API
class AgentGateway:
    async def discover() -> list[AgentMeta]
    async def call(agent_name, messages, stream=False) -> Response
    async def health_check(agent_name) -> bool

# 冻结的注册表
# config.yaml
agents:
  <agent_name>:
    url: ${ENV_VAR}
    timeout: int
    capabilities: list[str]
```

> **关键输出**：`docs/team/refactor/contracts/agent-gateway-contract.md`

---

## Task 1.6：冻结节点 Manifest-First 契约

**核心原则**：后端 manifest 是节点定义的唯一事实源，前端必须从 manifest 衍生。

**冻结的 manifest 字段集**：

```json
{
  "type": "quiz_gen",
  "category": "generation",
  "display_name": "测验生成",
  "description": "...",
  "icon": "quiz",
  "config_schema": { ... },
  "supports_upload": false,
  "supports_preview": true,
  "output_format": "structured",
  "renderer": "QuizRenderer",
  "version": "1.0.0"
}
```

**新增字段**：`renderer`（告诉前端用哪个渲染器），使前端不再需要独立维护一套 RENDERER_REGISTRY。

> **关键输出**：`docs/team/refactor/contracts/node-manifest-contract.md`

---

## Phase 1 完成标志

- [x] 后端依赖方向图已输出并签字 → [`contracts/backend-deps.md`](../contracts/backend-deps.md)
- [x] 前端依赖方向图已输出并签字 → [`contracts/frontend-deps.md`](../contracts/frontend-deps.md)
- [x] AI Chat 合并 API 契约文档已冻结 → [`contracts/ai-chat-contract.md`](../contracts/ai-chat-contract.md)
- [x] Usage Tracker 装饰器契约已冻结 → [`contracts/usage-tracker-contract.md`](../contracts/usage-tracker-contract.md)
- [x] Agent Gateway 契约已与队友 B 共同签字 → [`contracts/agent-gateway-contract.md`](../contracts/agent-gateway-contract.md)
- [x] 节点 Manifest-First 契约已冻结 → [`contracts/node-manifest-contract.md`](../contracts/node-manifest-contract.md)
- [x] 所有契约文档存放在 `docs/team/refactor/contracts/`

> [!IMPORTANT]
> **Gate 规则**：Phase 1 全部冻结后，Phase 2-4 才可以并行启动。冻结 = 写下来 + 签字 + 不许单方面改。若需修改，必须三人 sync 并更新契约文档版本号。
