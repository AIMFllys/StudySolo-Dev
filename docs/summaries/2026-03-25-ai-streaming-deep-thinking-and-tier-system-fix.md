# 🪄 AI 对话流式升级 + 🔐 会员等级全链路修复 — 完整实施总结

> **日期**: 2026-03-25
> **范围**: AI 对话流式交互升级 (魔法棒动画 + 深度思考) + 会员等级(tier)系统全链路修复 (GitHub Issue #11)
> **状态**: Phase 0~3 ✅ 完成 · Phase 4 (自动降级) 待实施

---

## 📋 本次目标

本次会话完成了两大工程目标：

1. **AI 对话流式交互升级** — 用 Uiverse 魔法棒动画和 Generating/Thinking 状态机替换旧的短竖线光标，并集成 DeepSeek R1 深度思考能力
2. **会员等级(tier)机制全链路修复** — 解决 Issue #11 中 `/me` 字段混淆、命名不一致、硬编码 mock 等 6 个子问题

---

## 🎯 Part 1: AI 对话流式交互升级

### 1.1 魔法棒 SVG 动画 (等待首 token)

**来源**: [Uiverse.io/elijahgummer/slippery-puma-80](https://uiverse.io/elijahgummer/slippery-puma-80)

将等待 AI 响应时的短竖线光标 (`StreamCursor`) 替换为一个带动画的魔法棒 SVG + "正在思考..." 文字：

| 阶段 | 旧UI | 新UI |
|------|------|------|
| 等待首 token | 闪烁短竖线 `\|` | 🪄 魔法棒 SVG 动画 + "正在思考…" |
| 思考中 (R1) | 无 | 🪄 魔法棒 + ThinkingCard 展开 + "Thinking..." |
| 生成中 | 闪烁短竖线 | ⬤⬤⬤ 弹跳圆点 + "Generating..." |
| 完成 | 无指示 | 静态 ThinkingCard (可折叠) + 完整 markdown |

**SVG 细节修改**:
- 魔法棒线条从黑色改为灰色 (`stroke: #888`)，更协调美观
- 星星 (star-1/star-2) 保留 orangeRed/lime 原色动画
- 棒身 (stick) 保留规律旋转 + 弹跳关键帧

### 1.2 StreamCursor → StreamingIndicator

```diff
- function StreamCursor() {
-   return <span className="ai-stream-cursor ..." />;
- }
+ function StreamingIndicator() {
+   return (
+     <div className="flex items-center gap-1.5 mt-2">
+       <span className="flex gap-[3px]">
+         <span className="... animate-bounce" />×3
+       </span>
+       <span>Generating...</span>
+     </div>
+   );
+ }
```

### 1.3 深度思考集成 (DeepSeek R1)

#### 后端

| 文件 | 变更 |
|------|------|
| [ai_router.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/services/ai_router.py) | `_stream_tokens` 提取 `reasoning_content` + `<think>` 标签包裹 · 新增 `call_llm_direct` 强制路由函数 |
| [ai_chat_stream.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/ai_chat_stream.py) | Chat 模式传 `thinking_level` · `balanced`/`deep` 强制路由 `deepseek-reasoner` |
| [prompt_loader.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/prompts/prompt_loader.py) | `DEPTH_LABELS` 增强(深度有更强的推导链指令) · `get_chat_prompt` 接受 `thinking_depth` |

#### 前端

| 文件 | 变更 |
|------|------|
| **新建** [parse-thinking.ts](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/features/workflow/utils/parse-thinking.ts) | `<think>` 标签流式安全解析器 |
| **新建** [ThinkingCard.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/ThinkingCard.tsx) | 可折叠思考卡片 + Route 图标 + 流式动画 |
| [ChatMessages.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/ChatMessages.tsx) | AIMessage 集成 `parseThinking` + ThinkingCard + StreamingIndicator |
| [ChatInputBar.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/ChatInputBar.tsx) | Brain → Route 图标 · 条件改为 `supportsThinking` · 透传 `selectedModel` |
| [ai-models.ts](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/features/workflow/constants/ai-models.ts) | 新增 `supportsThinking?: boolean` 字段 · R1 标记 `true` |
| [SidebarAIPanel.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/SidebarAIPanel.tsx) | 透传 `selectedModel` 给 ChatInputBar |

#### CSS

| 文件 | 变更 |
|------|------|
| [base.css](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/styles/base.css) | 移除废弃的 `cursor-blink` 动画 + `.ai-stream-cursor` 类 |

### 1.4 思考深度选择器

三级深度通过底部输入栏 pill 选择：

| 深度 | 行为 | 图标 |
|------|------|------|
| **快速** (fast) | 默认模型，无思考 | — |
| **均衡** (balanced) | 强制路由 `deepseek-reasoner`，标准推理 | `lucide-route` |
| **深度** (deep) | 强制路由 `deepseek-reasoner`，增强推理提示词 | `lucide-route` |

> 不支持 `supportsThinking` 的模型隐藏深度选择器。

### 1.5 流式状态机

```
用户发送消息
    ↓
[等待首 token] → 魔法棒动画 + "正在思考…"
    ↓ (R1 返回 reasoning_content)
[Thinking 阶段] → ThinkingCard(streaming) + "Thinking..."
    ↓ (R1 返回 content)  
[Generating 阶段] → ThinkingCard(collapsed) + markdown + "Generating..."
    ↓ (流结束)
[完成] → ThinkingCard(可折叠) + 静态 markdown
```

---

## 🔐 Part 2: 会员等级(tier)机制全链路修复

> **对应 Issue**: [#11 — [BUG] 会员等级(tier)机制全链路问题](https://github.com/AIMFllys/StudySolo/issues/11)

### 2.1 问题诊断 — 6 大问题

| # | 优先级 | 问题 | 根因 |
|---|--------|------|------|
| **1** | **P0** | `/me` 将 tier 塞入 role | `role=row.get("tier", ...)` 在 login.py:298 |
| **2** | **P0** | 前后端 tier 命名不一致 | DB `pro_plus` vs 前端 `Plus` (Pascal-case) |
| **3** | **P1** | WalletPanel 硬编码 | `const USER_TIER = 'Plus'` 不读真实数据 |
| **4** | **P1** | 前端 UserInfo 类型不对齐 | 后端无 `tier` 字段 |
| **5** | **P2** | 缺少自动降级机制 | 无 Cron/Edge Function |
| **6** | **P2** | get_current_user 不含 tier | 仅从 JWT 取 id/email/role |

### 2.2 核心设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| **Tier 命名标准** | 全链路 `snake_case` (`free`/`pro`/`pro_plus`/`ultra`) | DB CHECK 约束修改成本最高，前端做 display label 映射 |
| **role vs tier** | 严格分离，永不混用 | role(JWT用户角色) ≠ tier(订阅等级)，IAM ≠ Billing |
| **tier 全局状态** | 各组件各自调 `getUser()` | 当前阶段足够，未来可迁移 Zustand |
| **模型权限** | 前端 UI 控制 + 后端 API 双重校验 | Defense in Depth |

### 2.3 命名标准化映射

```
┌─────────────────────────────────────────────────────────────────┐
│                 CANONICAL TIER VALUES (snake_case)              │
│                                                                 │
│   DB ─→ Backend ─→ API Response ─→ Frontend State              │
│   "free"      "free"         "free"           "free"            │
│   "pro"       "pro"          "pro"            "pro"             │
│   "pro_plus"  "pro_plus"     "pro_plus"       "pro_plus"        │
│   "ultra"     "ultra"        "ultra"          "ultra"           │
│                                                                 │
│   Display Labels (getTierLabel):                                │
│   "free" → "Free"     "pro" → "Pro"                             │
│   "pro_plus" → "Pro+"  "ultra" → "Ultra"                        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 修复实施 — Phase 0: "进入 创建" 按钮修复

**问题**: AI 回复 `[SUGGEST_MODE:create]` 后显示的"进入 创建"按钮完全无响应

**根因**: `onModeSwitch` 回调在 `SidebarAIPanel → ChatMessages → AIMessage` 链路中断

```diff
  SidebarAIPanel (setMode ✅)
-   ├── ChatMessages ← setMode ❌ 未传
+   ├── ChatMessages ← onModeSwitch ✅ 已传
    │   └── AIMessage
-   │       └── 按钮 ← onClick ❌ 空
+   │       └── 按钮 ← onClick={(m) => onModeSwitch?.(m)} ✅
    └── ChatInputBar ← setMode ✅ 已传
```

**改动文件** (5 处):

| 文件 | 改动 |
|------|------|
| [ChatMessages.tsx:39-46](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/ChatMessages.tsx#L39-L46) | `ChatMessagesProps` 新增 `onModeSwitch` |
| [ChatMessages.tsx:84-90](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/ChatMessages.tsx#L84-L90) | `AIMessage` 接收 `onModeSwitch` |
| [ChatMessages.tsx:224](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/ChatMessages.tsx#L224) | 按钮 `onClick={() => onModeSwitch?.(m)}` |
| [ChatMessages.tsx:392](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/ChatMessages.tsx#L392) | `ChatMessages` 解构 `onModeSwitch` |
| [SidebarAIPanel.tsx:172](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/SidebarAIPanel.tsx#L172) | 透传 `onModeSwitch={(m) => setMode(m as AIMode)}` |

### 2.5 修复实施 — Phase 1: 后端 (P0)

#### A. `UserInfo` Model 增加 `tier` + 集中 `TierType`

```python
# backend/app/models/user.py
from typing import Literal

TierType = Literal["free", "pro", "pro_plus", "ultra"]  # 全链路唯一定义

class UserInfo(BaseModel):
    id: str
    email: str
    name: str | None = None
    avatar_url: str | None = None
    role: str = "user"          # System role (user/admin) — from JWT
    tier: TierType = "free"     # Subscription tier — from user_profiles table
```

#### B. `/me` 端点修复 — role/tier 严格分离

```diff
# login.py — /me 端点
  return UserInfo(
      id=current_user["id"],
      email=current_user.get("email") or row.get("email", ""),
      name=row.get("nickname"),
      avatar_url=row.get("avatar_url"),
-     role=row.get("tier", current_user.get("role", "user")),  # ← tier 塞入 role！
+     role=current_user.get("role", "user"),    # ← 系统角色，来自 JWT
+     tier=row.get("tier", "free"),              # ← 订阅等级，来自 DB
  )
```

#### C. `/login` 和 `/sync-session` — 同步返回 tier

两个端点新增 `db: AsyncClient = Depends(get_supabase_client)` 依赖，在认证成功后查询 `user_profiles.tier`：

```python
# 新增的 tier 查询逻辑 (login + sync-session 均包含)
profile = await db.from_("user_profiles") \
    .select("tier, nickname, avatar_url") \
    .eq("id", str(user.id)).maybe_single().execute()
row = profile.data or {}
# 返回 UserInfo 时: tier=row.get("tier", "free")
```

#### D. `get_current_user` — 增加 tier (带 request.state 缓存)

```python
# deps.py — 新逻辑
if hasattr(request.state, "user_tier"):
    tier = request.state.user_tier
else:
    profile = await db.table("user_profiles") \
        .select("tier").eq("id", user_id).maybe_single().execute()
    tier = (profile.data or {}).get("tier", "free")
    request.state.user_tier = tier  # 同一请求内缓存

return {"id": user_id, "email": email, "role": role, "tier": tier}
```

#### E. `admin_users.py` — 去重 TierType

```diff
- from typing import Literal
- TierType = Literal["free", "pro", "pro_plus", "ultra"]
+ from app.models.user import TierType
```

### 2.6 修复实施 — Phase 2: 前端 (P0/P1)

#### A. `auth.service.ts` — TierType 类型 + 工具函数

```typescript
export type TierType = 'free' | 'pro' | 'pro_plus' | 'ultra';

export const TIER_DISPLAY_LABELS: Record<TierType, string> = {
  free: 'Free', pro: 'Pro', pro_plus: 'Pro+', ultra: 'Ultra',
};

export function getTierLabel(tier: TierType | undefined): string { ... }
export function isPaidTier(tier: TierType | undefined): boolean { ... }
```

#### B. `UserPanel.tsx` — 比较值修正

```diff
- user?.tier === 'Plus'  → + user?.tier === 'pro_plus'
- user?.tier === 'Pro'   → + user?.tier === 'pro'
- user?.tier === 'Ultra' → + user?.tier === 'ultra'
- {user?.tier || 'Free'} → + {getTierLabel(user?.tier)}
```

#### C. `WalletPanel.tsx` — 删除硬编码，接入真实数据

```diff
- const USER_TIER = 'Plus';
+ const [user, setUser] = useState<UserInfo | null>(null);
+ const userTier: TierType = user?.tier ?? 'free';
+ useEffect(() => { getUser().then(setUser).catch(() => null); }, []);

- getTierCardStyle(USER_TIER)
+ getTierCardStyle(userTier)

- {USER_TIER}
+ {getTierLabel(userTier)}

- <span>学习记录者</span>
+ <span>{user?.name || '学习记录者'}</span>
```

#### D. `ModelSelector.tsx` — 基于 tier 控制 premium 模型

```diff
+ import { isPaidTier, type TierType } from '@/services/auth.service';

  interface ModelSelectorProps {
    value: AIModelOption;
    onChange: (model: AIModelOption) => void;
+   userTier?: TierType;
  }

+ const canUsePremium = isPaidTier(userTier);

  const handleSelect = (model: AIModelOption) => {
-   if (model.isPremium) return;
+   if (model.isPremium && !canUsePremium) return;
  };

- disabled={model.isPremium}
+ disabled={model.isPremium && !canUsePremium}
```

#### E. `SidebarAIPanel.tsx` — 获取 userTier 并下发

```typescript
const [userTier, setUserTier] = useState<TierType>('free');
useEffect(() => {
  getUser().then((u) => setUserTier(u.tier ?? 'free')).catch(() => null);
}, []);

<ModelSelector value={selectedModel} onChange={setSelectedModel} userTier={userTier} />
```

### 2.7 修复实施 — Phase 3: 后端安全 (P1)

```python
# ai_chat_stream.py — 新增模型权限校验

PREMIUM_MODELS = {
    "deepseek-reasoner", "doubao-pro-256k",
    "qwen-max", "glm-4", "moonshot-v1-128k",
}

async def _chat_stream_generator(body, current_user):
    selected_model = getattr(body, "selected_model", None)
    user_tier = current_user.get("tier", "free")
    if selected_model and selected_model in PREMIUM_MODELS and user_tier == "free":
        yield {"data": json.dumps({"error": "该模型需要升级会员使用", "done": True})}
        return
    # ... 正常流式处理 ...
```

---

## 📦 完整文件清单 (13 个文件, 2 新建)

### 后端 (5 文件)

| 文件 | 变更类型 | 关键改动 |
|------|----------|----------|
| [user.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/models/user.py) | **改** | `TierType` 集中定义 + `UserInfo.tier` 新增 |
| [login.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/login.py) | **改** | `/me`/`/login`/`/sync-session` 三处 role/tier 分离 |
| [deps.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/core/deps.py) | **改** | `get_current_user` 增加 tier + request.state 缓存 |
| [admin_users.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/admin_users.py) | **改** | `TierType` 去重，改为 import |
| [ai_chat_stream.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/ai_chat_stream.py) | **改** | `PREMIUM_MODELS` 集合 + tier 校验 + `current_user` 透传 |

### 前端 (6 文件)

| 文件 | 变更类型 | 关键改动 |
|------|----------|----------|
| [auth.service.ts](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/services/auth.service.ts) | **改** | `TierType` + `getTierLabel()` + `isPaidTier()` |
| [UserPanel.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/UserPanel.tsx) | **改** | tier 比较值 Pascal→snake_case + `getTierLabel()` |
| [WalletPanel.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/WalletPanel.tsx) | **改** | 删除 `USER_TIER` 硬编码 → `getUser()` 真实数据 |
| [ModelSelector.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/ModelSelector.tsx) | **改** | `userTier` prop + `isPaidTier` 条件门控 |
| [ChatMessages.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/ChatMessages.tsx) | **改** | `onModeSwitch` 回调透传 + StreamingIndicator + ThinkingCard |
| [SidebarAIPanel.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/SidebarAIPanel.tsx) | **改** | `userTier` state + `getUser()` + 透传 ModelSelector & ChatMessages |

### 新建文件 (Part 1 阶段)

| 文件 | 职责 |
|------|------|
| [parse-thinking.ts](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/features/workflow/utils/parse-thinking.ts) | `<think>` 标签流式安全解析器 |
| [ThinkingCard.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/ThinkingCard.tsx) | 可折叠思考卡片 UI |

---

## 🔄 修复后全链路数据流

```
┌─ Database ─────────────────────────────────────────────────────┐
│ user_profiles.tier = "free" | "pro" | "pro_plus" | "ultra"     │
│ (CHECK constraint, single source of truth)                     │
└───────────────┬────────────────────────────────────────────────┘
                ↓
┌─ Backend ──────────────────────────────────────────────────────┐
│ get_current_user (deps.py)                                     │
│   → SELECT tier FROM user_profiles (cached in request.state)   │
│   → Returns { id, email, role: "user", tier: "pro_plus" }     │
│                                                                │
│ /api/auth/me, /login, /sync-session                            │
│   → role = JWT user_metadata.role (user/admin)                 │
│   → tier = user_profiles.tier (free/pro/pro_plus/ultra)        │
│                                                                │
│ /api/ai/chat-stream                                            │
│   → PREMIUM_MODELS check: tier=="free" → 403 error             │
└───────────────┬────────────────────────────────────────────────┘
                ↓
┌─ Frontend ─────────────────────────────────────────────────────┐
│ auth.service.ts                                                │
│   → TierType, getTierLabel(), isPaidTier()                     │
│                                                                │
│ SidebarAIPanel (getUser → userTier)                            │
│   ├── ModelSelector (userTier → canUsePremium)                 │
│   └── ChatMessages (onModeSwitch → setMode)                   │
│                                                                │
│ UserPanel (getTierLabel → "Pro+")                              │
│ WalletPanel (getUser → real tier, no hardcode)                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 📊 Issue #11 关闭状态

| 子问题 | 状态 |
|--------|------|
| `/me` 将 tier 塞入 role | ✅ 已修复 (Phase 1) |
| 前后端 tier 命名不一致 | ✅ 已统一 snake_case (Phase 1-2) |
| WalletPanel 硬编码 | ✅ 已删除，接入真实数据 (Phase 2) |
| 前端 UserInfo 类型不对齐 | ✅ 已增加 TierType + tier 字段 (Phase 2) |
| get_current_user 不含 tier | ✅ 已增加 + request.state 缓存 (Phase 1) |
| 缺少自动降级机制 | ✅ 已实施 pg_cron (Phase 4) |

> **全部 6 个子问题已解决，Issue #11 可关闭** 🎉

---

## ⏱️ Part 3: 订阅自动降级 (Phase 4)

### 3.1 前置条件分析

通过 Supabase MCP 深入分析数据库现状，确认所有前置条件均已满足：

| 前置条件 | 状态 | 详情 |
|----------|------|------|
| `user_profiles.tier_expires_at` | ✅ 已存在 | `timestamptz, nullable` |
| `pg_cron` 扩展 | ✅ 已安装 | `v1.6.4` |
| `tier_change_log` 表 | ✅ 已存在 | 记录 old_tier → new_tier + reason |
| `subscriptions.expires_at` | ✅ 已存在 | CHECK: active/expired/cancelled/grace_period |

### 3.2 Migration: `create_auto_downgrade_expired_subscriptions`

#### PL/pgSQL 函数: `check_expired_subscriptions()`

```sql
CREATE OR REPLACE FUNCTION check_expired_subscriptions()
RETURNS void LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
```

**执行逻辑**:

```
1. SELECT user_profiles WHERE tier != 'free' AND tier_expires_at < NOW()
   ↓
2. INSERT INTO tier_change_log (old_tier → 'free', reason: 'auto_downgrade_expired')
   ↓
3. UPDATE user_profiles SET tier = 'free', tier_expires_at = NULL
   ↓
4. UPDATE subscriptions SET status = 'expired' WHERE status = 'active' AND expires_at < NOW()
```

#### pg_cron 定时任务

| 属性 | 值 |
|------|-----|
| **Job Name** | `check-expired-subscriptions` |
| **Schedule** | `0 */4 * * *` (每 4 小时) |
| **Job ID** | 2 |
| **Status** | ✅ Active |

### 3.3 安全设计

| 设计点 | 说明 |
|--------|------|
| `SECURITY DEFINER` | 函数以定义者权限运行，不受 RLS 限制 |
| `SET search_path = public` | 防止搜索路径注入 |
| 审计日志 | 每次降级都写入 `tier_change_log`，可追溯 |
| 幂等性 | 多次执行不会重复降级（WHERE tier != 'free'） |
| `tier_expires_at = NULL` | 降级后清空过期时间，防止重复处理 |

### 3.4 验证

- ✅ 空运行执行成功（当前无过期用户，0 降级 — 符合预期）
- ✅ `cron.job` 表确认任务已注册且 `active = true`

---

## 🟡 待后续优化

| 优先级 | 建议 | 说明 |
|--------|------|------|
| **P3** | Zustand 全局 User Store | 替代当前各组件分别调 `getUser()` |
| **P3** | 模型 requiredTier 精细化 | 按 tier 级别细分 (如 Ultra 独占模型) |
| **P3** | Supabase 持久化对话 | `useConversationStore` localStorage → ss_ai_* 表 |
| **P4** | Stripe/支付宝 Webhook | 付费成功后自动升级 tier |
| **P4** | 用量配额系统 | Free 用户每日 N 次 AI 调用限制 |

---

## 🛠️ Part 4: Marketplace (工作流样例) Bug 深度诊断与修复

### 4.1 故障现象

- **表面现象**：点击左侧边栏「工作流样例」面板后，长时间只显示“加载中...”或直接显示“暂无工作流”，**前端界面无任何 API 报错**。
- **干扰现象**：本地在终端使用脚本调试 `/api/workflow/marketplace` 时，遭遇了奇怪的 `502 Bad Gateway`。

### 4.2 诊断过程

1.  **排除干扰 (502 错误)**：
    *   发现所有对 `localhost:2038` 的本地脚本请求均返回 `502`（且无响应题）。
    *   通过 `NO_PROXY=*` 和 `httpx(proxy=None)` 测试，确认 `502` 是由本地系统代理（Clash/VPN）拦截发送的流量所致。
    *   绕过代理查探后，发现真正的 HTTP 状态码是 **500 Internal Server Error**，而非 502。
2.  **定位 500 根因 (Pydantic 验证失败)**：
    *   查看 FastAPI 后端原始报错日志：`{'type': 'missing', 'loc': ('response', 1, 'status')}`
    *   阅读代码对比：由于重构，`workflow_social.py` 中的 `_MARKETPLACE_COLS` 查询字符串**遗漏了 `status` 字段**。
    *   而接口的响应模型 `response_model=list[WorkflowMeta]` 要求 `status` 为**必填项**（无默认值）。导致从 DB 拉出数据后，Pydantic 序列化 JSON 时直接抛出 `ValidationError` 崩溃。
3.  **解释“暂无工作流”现象 (前端静默吞错)**：
    *   为何前端不显示 500 报错？在 `frontend/src/services/workflow.service.ts` 的 `fetchMarketplace` 方法中，有着“防死锁”的 `try...catch`：
        ```typescript
        catch (error) {
          // 这里虽然有 console.error，但被严格的环境或 NextJS Error Boundary 掩盖
          return []; // <<< 吞噬了 500 错误，直接返回空数组
        }
        ```
    *   由于最终返回了合法空数组 `[]`，UI 组件（如 `WorkflowExamplesPanel`）判定数据为空，从而显示了“暂无工作流”（空状态页），掩盖了后端的 500 崩溃真相。

### 4.3 修复实施

在迷雾中抽丝剥茧后，实质性的修复**只需 1 行代码**的改动：

```diff
# backend/app/api/workflow_social.py (line 27)
-    "id,name,description,tags,is_public,is_featured,is_official,"
+    "id,name,description,status,tags,is_public,is_featured,is_official,"
```

### 4.4 验证

* ✅ `http://localhost:2037/workspace` 界面成功渲染返回结果列表（如“测试工作流03”, “未命名工作流”）。
* ✅ 工作流卡片（展示创建人、点赞数、收藏数等）全部正确恢复，查询参数（精选、官方等路由）正常处理。

---

## 🏗️ Part 5: Marketplace 全链路深度重构 (Phase 5)

### 5.1 核心痛点与问题诊断

在前期修复 Marketplace 500 错误的过程中，暴露出后端架构与前端错误处理的深层问题：

1.  **静默吞咽异常 (Silent Failures)**:
    *   **后端**: 点赞/收藏接口 (`_toggle_interaction`) 采用了原生态的 `try-except Exception`，试图先捕获全量异常作为“唯一约束冲突”的判定。这导致 RLS (Row Level Security) 拒绝、网络断开等真实错误被全部掩盖，返回虚假的“成功”状态。
    *   **前端**: `fetchMarketplace` 接口使用裸 `try...catch` 返回 `[]`。导致当后端崩溃时，前端 UI 判定为“暂无数据”而非“服务异常”。
2.  **散落的领域字段定义 (Field Drift)**:
    *   API 路由中硬编码了多次类似于 `id,name,description...` 的字符串。
    *   当模型层 (`WorkflowMeta`) 新增字段时，分散的硬编码极易遗漏，从而引发 500 崩溃。
3.  **UI 状态死锁与缺乏反馈**:
    *   前端 `useEffect` 中未通过 `.catch` 兜底异常导致 Promise 挂起，且核心操作（如 Fork、发布、收藏设置）缺乏 `toast` 回馈。

### 5.2 后端深度加固 (P0/P1)

| 改造项 | 实施细节 | 收益 |
|--------|----------|------|
| **“先查后写”确定性机制** | 彻底废弃 `_toggle_interaction` 的包裹式 `try...except Exception` 猜测写法。改用 `db.select().maybe_single()` 显式检查存在性；后续的 `insert()` 和 `delete()` 操作变得明确且安全。 | 消除静默数据损坏或虚假成功的可能，任何意外错误都会正当抛出 500。 |
| **单源真理 (Single Source)** | 在 `WorkflowMeta` 中新增 `@classmethod select_cols()`。将硬编码的数据库字符串提取为：基于模型 `model_fields` 动态生成。 | 永久杜绝由于漏写新增字段而引发的 Pydantic 模型解析 500 错误（Field-drift bugs）。 |
| **显式路由补全** | 修复 `list_marketplace` 中遗漏的 `filter='public'` 分支 (`is_public.eq.true`)。 | 确保“社区公开”标签页的筛选能够正常工作。 |
| **日志可观测性** | `get_public_workflow` 中捕获异常时加入 `logger.warning`。 | 即使返回 404 给前端，后端日志也能留存追溯证据。 |

### 5.3 前端健壮性重构 (P1/P2)

| 改造项 | 实施细节 | 收益 |
|--------|----------|------|
| **引入 `FetchResult<T>` 模式** | `workflow.service.ts` 引入 `FetchResult<T>` 判别联合类型并改写 `fetchMarketplace`。 | 分离“空列表”与“网络异常”状态。 |
| **完善 UI 异常感知** | `WorkflowExamplesPanel` 消费 `FetchResult`。新增 `fetchError` 状态与对应的 `AlertTriangle` 警告视图。 | 若后端崩溃，用户界面将明确展示“HTTP 500 错误的具象原因”。 |
| **挂死防御与 Toast 闭环** | ① `useEffect` 追加 `.catch()` 确保释放。② Fork/发布/收藏操作由 `void apiCall` 改造为明确的 `.then().catch()` 结构，结合 `toast.success/error`。 | 防止 Loading 永久显示；用户所有关键操作均有了明确的结果回馈。 |
| **Header 注入安全化** | 一致地使用 `buildAuthHeaders(token)` (Bearer Token) 替代局部手动 Cookie 拼接。 | 减少由于认证信息注入姿势不一致引起的身份识别错误。 |

### 5.4 验收与验证结果

- ✅ **交互完整度**: 左侧边栏 (Marketplace 工作流样例、收藏、社区公开) 所有卡片均展示正常，Fork 操作响应正常，取消收藏/发布状态具有绿色的 Toast 反馈。
- ✅ **API 数据对齐**: 验证了 `WorkflowMeta.select_cols()` 输出 DB 原生字段，正确过滤掉动态虚拟字段，彻底取代硬编码魔法参数。
- ✅ **容错能力**: 后端引发 502/500 时，前端稳定捕获并在 UI 显示黄色警告模块。
