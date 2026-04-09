# 🧠 AI 对话意图路由系统 — 完整实施总结

> **日期**: 2026-03-24
> **范围**: 左侧 AI 面板升级为类 Antigravity 智能体
> **状态**: Phase 1~3 + 数据库 ✅ 完成

---

## 📋 目标

将 StudySolo 侧边栏 AI 面板从单一的「生成工作流」功能，升级为支持 **自然语言对话** + **画布操作** + **流式响应** + **多模型选择** 的智能体系统。

---

## 🏗️ 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│  用户输入 → SidebarAIPanel                                       │
│    ↓                                                             │
│  ┌──────────────────────────────────┐                            │
│  │  Intent Classifier (前端, <1ms)   │                            │
│  │  ├─ BUILD  → /api/ai/generate    │                            │
│  │  ├─ ACTION → Store 直调          │                            │
│  │  └─ MODIFY / CHAT               │                            │
│  │       ↓                          │                            │
│  │  /api/ai/chat-stream (SSE)       │                            │
│  │    ├─ CHAT: 逐token流式推送       │                            │
│  │    └─ MODIFY: CanvasAction[] JSON │                            │
│  └──────────────────────────────────┘                            │
│    ↓                                                             │
│  ActionExecutor → WorkflowStore → 画布更新                        │
│    ↓                                                             │
│  ConversationStore → localStorage → Supabase (ss_ai_*)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 文件清单 (16 个文件, 全部 ≤ 300 行)

### Backend (4 文件)

| 文件 | 行数 | 职责 |
|------|------|------|
| `backend/app/prompts/ai_chat_prompts.py` | 197 | 提示词单文件中心 (4 套 Prompt) |
| `backend/app/models/ai_chat.py` | 74 | Pydantic 请求/响应模型 |
| `backend/app/api/ai_chat.py` | 204 | `/api/ai/chat` 统一端点 |
| `backend/app/api/ai_chat_stream.py` | 144 | `/api/ai/chat-stream` SSE 流式端点 |

### Frontend Hooks (4 文件)

| 文件 | 行数 | 职责 |
|------|------|------|
| `hooks/use-canvas-context.ts` | 121 | 画布状态→AI 可读快照 (含坐标) |
| `hooks/use-action-executor.ts` | 205 | CanvasAction → WorkflowStore 操作 |
| `hooks/use-conversation-store.ts` | 163 | localStorage 多会话管理 |
| `hooks/use-stream-chat.ts` | 137 | ReadableStream SSE 解析 |

### Frontend Utils (2 文件)

| 文件 | 行数 | 职责 |
|------|------|------|
| `utils/intent-classifier.ts` | 114 | 前端零成本规则引擎 |
| `utils/node-reference-resolver.ts` | 164 | "第三个""总结那个" → node ID |

### Frontend UI (3 文件) + Constants (1 文件)

| 文件 | 行数 | 职责 |
|------|------|------|
| `sidebar/SidebarAIPanel.tsx` | 294 | 主面板 (集成全部功能) |
| `sidebar/ModelSelector.tsx` | 138 | 5 供应商品牌色下拉 |
| `sidebar/ChatMessages.tsx` | 81 | 消息气泡列表 |
| `constants/ai-models.ts` | 140 | 10 个模型配置 |

### 路由注册 (已修改)

| 文件 | 改动 |
|------|------|
| `backend/app/api/router.py` | 注册 `ai_chat_router` + `ai_chat_stream_router` |

---

## 🗄️ 数据库变更 (Supabase Migration)

### Migration: `create_ss_ai_conversations_and_messages`

遵循 `_db_conventions` 命名规范：`ss_` 前缀 + snake_case + UUID 主键 + RLS

#### `ss_ai_conversations` — AI 对话会话表

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | gen_random_uuid() |
| `user_id` | uuid FK → user_profiles | 用户 (Supabase Auth) |
| `workflow_id` | uuid FK → ss_workflows | 关联的工作流 (可选) |
| `title` | text | 自动从首条消息提取 |
| `model_id` | text | 用户选择的模型 ID |
| `platform` | text | 模型供应商 |
| `message_count` | integer | 消息计数 |
| `is_pinned` | boolean | 置顶 |
| `is_archived` | boolean | 归档 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 自动更新 (trigger) |

#### `ss_ai_messages` — AI 对话消息表

| 列名 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | gen_random_uuid() |
| `conversation_id` | uuid FK → ss_ai_conversations | CASCADE 删除 |
| `role` | text CHECK | user / assistant / system |
| `content` | text | 消息内容 |
| `intent` | text CHECK | BUILD / MODIFY / CHAT / ACTION (可选) |
| `actions_json` | jsonb | MODIFY 时的 CanvasAction[] |
| `canvas_snapshot` | jsonb | 发送时画布快照 |
| `tokens_used` | integer | token 消耗 |
| `model_used` | text | 实际使用的模型 |
| `is_deleted` | boolean | 软删除 |
| `created_at` | timestamptz | 创建时间 |

#### 索引
- `idx_ss_ai_conversations_user_id`
- `idx_ss_ai_conversations_workflow_id`
- `idx_ss_ai_conversations_updated_at` (DESC)
- `idx_ss_ai_messages_conversation_id`
- `idx_ss_ai_messages_created_at`

#### RLS Policy (8 条)
- 每张表 SELECT / INSERT / UPDATE / DELETE 各 1 条
- `ss_ai_conversations`: `auth.uid() = user_id`
- `ss_ai_messages`: 通过 JOIN `ss_ai_conversations` 验证 `user_id`

#### Trigger
- `trg_ss_ai_conversations_updated_at`: UPDATE 前自动刷新 `updated_at`
- 函数使用 `SECURITY DEFINER SET search_path = public` (安全)

---

## 🔄 四大意图数据流

### BUILD — 搭建全新工作流
```
用户: "帮我学机器学习"
  → 前端 classifier: BUILD (confidence: 0.95, 画布为空)
  → POST /api/ai/generate-workflow
  → replaceWorkflowGraph() + 序列化 CanvasContext
  → "✅ 已生成 6 个节点"
```

### MODIFY — 增量修改画布
```
用户: "在总结后面加一个测验"
  → 前端 classifier: MODIFY (confidence: 0.85)
  → SSE /api/ai/chat-stream { intent_hint: "MODIFY" }
  → 后端: ModifyExecutor Prompt → CanvasAction[]
  → DELETE 操作? → window.confirm() 确认
  → ActionExecutor: takeSnapshot() → 执行 → setNodes/setEdges
  → "✅ 已添加测验节点 (执行了 2 步操作)"
```

### CHAT — 纯对话
```
用户: "这个工作流怎么样?"
  → 前端 classifier: CHAT (confidence: 0.92)
  → SSE /api/ai/chat-stream { intent_hint: "CHAT" }
  → 逐 token 流式推送, 打字效果
```

### ACTION — 系统操作
```
用户: "运行一下"
  → 前端 classifier: ACTION (confidence: 0.98)
  → 直接调用 startExecution() / undo() / redo()
  → "▶️ 工作流已开始执行"
```

---

## 🛡️ 安全设计

| 规则 | 实现 |
|------|------|
| DELETE 确认 | `window.confirm()` Human-in-the-loop |
| 操作可撤销 | `takeSnapshot()` 执行前自动快照 |
| 失败回滚 | `undo()` on error |
| 最少保留 1 节点 | ActionExecutor DELETE_NODE 校验 |
| Token 限制 | 仅发最近 10 条历史 |
| Prompt 注入防护 | `[USER_INPUT_START]...[USER_INPUT_END]` 边界 |
| RLS 行级安全 | 用户只能访问自己的对话/消息 |
| SECURITY DEFINER | trigger 函数使用安全 search_path |

---

## 🧩 NodeReferenceResolver — 5 种自然语言引用

| 引用模式 | 示例 | 方法 | 置信度 |
|----------|------|------|--------|
| 序号 | "第三个节点" | index | 0.95 |
| 位置 | "最后一个" "倒数第二个" | position | 0.85~0.9 |
| 标签 | "总结节点" "大纲那个" | label | 0.85 |
| 类型 | "闪卡" "测验" "思维导图" | type | 0.80 |
| 关系 | "大纲后面的" "总结前面的" | relation | 0.75 |

---

## 🎛️ 模型选择器 — 5 供应商 × 2 模型

| 供应商 | 免费模型 | 会员模型 |
|--------|---------|---------|
| DeepSeek | deepseek-chat | deepseek-reasoner 🔒 |
| 豆包 (字节跳动) | doubao-1.5-lite-32k | doubao-1.5-pro-256k 🔒 |
| 通义千问 (阿里) | qwen-turbo | qwen-max 🔒 |
| 智谱 AI | glm-4-flash | glm-4-plus 🔒 |
| Kimi (月之暗面) | moonshot-v1-8k | moonshot-v1-128k 🔒 |

---

## 🔧 代码审查结果

### 已修复 🔴

| 问题 | 修复 |
|------|------|
| `call_llm(stream=True)` 缺少 `await` | `ai_chat_stream.py` 第 114 行: `call_llm` 是 `async def`, 即使 stream=True, 调用方也必须 `await` 才能拿到 `AsyncIterator` |
| `useStreamChat` MODIFY 响应丢失 actions | 单次 JSON event 的完整 payload 现在正确传递给 `onDone` |
| `let` → `const` (streamAssistantId) | `SidebarAIPanel.tsx` 不被重赋值的变量改为 `const` |

### 通过 ✅

| 检查项 | 结果 |
|--------|------|
| TypeScript 零错误 | ✅ `pnpm exec tsc --noEmit` 无输出 |
| 文件行数 ≤ 300 | ✅ 最长 294 行 (SidebarAIPanel) |
| RLS 安全审计 | ✅ 新表未出现在 Supabase security lint |
| Prompt 注入防护 | ✅ `[USER_INPUT_START]` 边界标记 |
| 无硬编码 secrets | ✅ 所有 API key 来自 config.yaml |
| 无 `any` 类型 | ✅ 全部使用具体类型或 `Record<string, unknown>` |
| 错误处理覆盖 | ✅ try/catch + fallback 在所有异步路径 |

### 待后续优化 🟡

| 建议 | 说明 |
|------|------|
| Supabase 持久化对接 | `useConversationStore` 目前是 localStorage, 后续需接入 `ss_ai_conversations` / `ss_ai_messages` |
| 会员模型解锁 | `ModelSelector` 中 `disabled={model.isPremium}` 需要对接 `subscriptions` 表 |
| 流式中断恢复 | 网络断开后重连机制 |
| 消息分页加载 | 长对话需要虚拟滚动 + 分页查询 |

---

## 📊 变更统计

```
 16 files changed, 2085 insertions(+), 380 deletions(-)
 + 2 Supabase tables (ss_ai_conversations, ss_ai_messages)
 + 5 indexes + 8 RLS policies + 1 trigger
```
