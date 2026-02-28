# 公告系统 · 全面设计文档

> 📅 创建日期：2026-02-27  
> 🔄 最新更新：2026-02-27  
> 📌 所属模块：Notice · 公告通知系统  
> 🔗 关联文档：[项目深度功能规划](../../global/项目深度功能规划.md) · [PROJECT_PLAN](../../global/PROJECT_PLAN.md) · [工作流AI交互规划](../core/工作流AI交互规划.md)

---

## 📑 目录

- [一、系统概述与目标](#一系统概述与目标)
- [二、公告推送系统](#二公告推送系统)
- [三、用户弹窗评分设定](#三用户弹窗评分设定)
- [四、会员折扣营销系统](#四会员折扣营销系统)
- [五、初始通知内容](#五初始通知内容)
- [六、数据库设计](#六数据库设计)
- [七、前端组件设计](#七前端组件设计)
- [八、后端 API 设计](#八后端-api-设计)
- [九、实施优先级与任务分解](#九实施优先级与任务分解)

---

## 一、系统概述与目标

### 1.1 系统定位

公告系统（Notice System）是 StudySolo 平台的**运营基础设施模块**。核心使命：

> **实时、高效地将平台动态、活动信息、重要通知传递给用户，同时收集用户反馈以驱动产品迭代。**

### 1.2 核心功能模块

| 模块 | 功能 | 优先级 |
|------|------|--------|
| **公告推送** | 每日推送更新核心内容（站内通知 + 弹窗） | ⭐ P0 |
| **用户评分** | 弹窗评分设定，收集用户满意度 | ⭐ P0 |
| **会员营销** | 开通会员享折扣相关内容展示 | ⭐ P0 |
| **通知中心** | 所有通知的集中查看与管理 | ⭐ P1 |
| **邮件通知** | 重要公告通过 DirectMail 推送 | ⬜ P2 |

### 1.3 设计原则

1. **非侵入式**：通知不干扰用户核心工作流操作
2. **可配置**：管理员（后台面板）可完全控制通知内容、展示时机、目标用户
3. **可追溯**：每条通知都有已读/未读状态记录
4. **智能展示**：同一通知不重复弹窗，遵循频率控制策略

---

## 二、公告推送系统

### 2.1 公告类型体系

| 类型 ID | 类型名称 | 图标 | 展示方式 | 示例 |
|---------|---------|------|---------|------|
| `system` | 系统公告 | 📢 | 全局横幅 + 弹窗 | 平台维护通知、重大功能上线 |
| `feature` | 功能更新 | ✨ | 通知中心 + 可选弹窗 | 新节点类型上线、UI 优化 |
| `promotion` | 营销活动 | 🎁 | 弹窗 + 营销卡片 | 会员折扣、首月福利 |
| `education` | 教育福利 | 🎓 | 弹窗 + 横幅 | .edu 邮箱注册福利 |
| `changelog` | 更新日志 | 📋 | 通知中心 | 版本变更记录 |

### 2.2 推送策略

#### 展示时机

| 触发条件 | 触发时机 | 频率控制 |
|---------|---------|---------|
| **用户登录时** | 登录成功后 1.5s 延迟弹出 | 每条公告每用户仅弹出 1 次 |
| **进入 Dashboard 时** | 路由切换到 `/workspace` | 相同类型间隔 ≥ 24h |
| **定时检测** | 前端每 5 分钟轮询 `/api/notices/unread` | 新公告实时标记通知铃铛红点 |
| **后台手动推送** | 管理员在 Admin Panel 操作 | 不受频率限制 |

#### 展示优先级

```
系统公告 (system) > 教育福利 (education) > 营销活动 (promotion) > 功能更新 (feature) > 更新日志 (changelog)
```

> **规则**：同时有多条未读通知时，按优先级排序，一次最多弹出 **1 条**弹窗，其余进入通知中心等待用户主动查看。

### 2.3 公告内容结构

```json
{
  "id": "uuid",
  "type": "system | feature | promotion | education | changelog",
  "title": "公告标题",
  "summary": "一句话摘要（展示在通知列表中）",
  "content": "Markdown 格式的完整内容",
  "cover_image": "可选的封面图 URL",
  "action_button": {
    "text": "立即查看",
    "url": "/pricing",
    "style": "primary | secondary"
  },
  "target_audience": "all | free | pro | student",
  "priority": 1,
  "is_popup": true,
  "popup_style": "modal | banner | toast",
  "start_time": "2026-02-27T00:00:00Z",
  "end_time": "2026-03-15T23:59:59Z",
  "created_by": "admin_user_id",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

---

## 三、用户弹窗评分设定

### 3.1 评分系统设计理念

> **目标**：在关键节点收集用户满意度反馈，以 NPS（Net Promoter Score）和 CSAT（Customer Satisfaction Score）双指标驱动产品优化。

### 3.2 评分触发策略

| 触发场景 | 触发条件 | 弹窗类型 | 频率控制 |
|---------|---------|---------|---------|
| **工作流完成** | 用户完成一次完整工作流执行 | 5 星评分 + 文字反馈 | 每 3 次执行触发 1 次 |
| **功能体验** | 用户首次使用某核心功能 | 满意度滑块（1-10） | 每个功能仅触发 1 次 |
| **定期调查** | 注册满 7 天的活跃用户 | NPS 问卷（推荐意愿 0-10） | 每 30 天触发 1 次 |
| **会员续费前** | 会员到期前 3 天 | 续费意愿 + 改进建议 | 仅触发 1 次 |

### 3.3 评分弹窗 UI 设计规范

#### 基础评分弹窗（5 星制）

```
┌──────────────────────────────────────────┐
│                                          │
│        🌟 您对本次工作流体验满意吗？        │
│                                          │
│        ☆  ☆  ☆  ☆  ☆                    │
│        1  2  3  4  5                     │
│                                          │
│   ┌──────────────────────────────────┐   │
│   │ 请输入您的反馈（可选）...          │   │
│   └──────────────────────────────────┘   │
│                                          │
│      [跳过]              [提交反馈]       │
│                                          │
│   ☐ 不再提醒                              │
└──────────────────────────────────────────┘
```

#### NPS 评分弹窗（0-10 推荐度）

```
┌──────────────────────────────────────────────────┐
│                                                  │
│   📊 您有多大可能向朋友推荐 StudySolo？              │
│                                                  │
│   │ 0 │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │ 9 │10│ │
│    不太可能                            非常可能    │
│                                                  │
│   选择改进方向（可多选）：                           │
│   ☐ AI 输出质量   ☐ 响应速度   ☐ 界面设计           │
│   ☐ 功能丰富度   ☐ 价格合理性  ☐ 其他                │
│                                                  │
│      [稍后再说]              [提交]               │
└──────────────────────────────────────────────────┘
```

### 3.4 评分数据聚合策略

| 维度 | 计算方式 | 用途 |
|------|---------|------|
| **CSAT** | 4+5 星占比（%） | 单次体验满意度 |
| **NPS** | (9-10 推荐者%) - (0-6 批评者%) | 用户忠诚度指标 |
| **趋势分析** | 7 日滚动平均 | 监控产品体验变化 |
| **功能热力图** | 按功能聚合评分 | 发现薄弱环节 |

> 📌 **所有评分数据在管理后台（Admin Panel）以可视化图表展示**，详见 → [管理后台设计](../admin/01-admin-panel-design.md)

---

## 四、会员折扣营销系统

### 4.1 折扣规则引擎

> 与现有四级会员体系（免费版 / Pro / Pro+ / Ultra）深度整合。

#### 折扣类型矩阵

| 折扣类型 | 适用对象 | 折扣力度 | 有效期 | 叠加规则 |
|---------|---------|---------|--------|---------|
| **新人首月** | 未曾付费的注册用户 | Pro 版首月 ¥3 | 注册后 7 天内 | ❌ 不与其他折扣叠加 |
| **学生优惠** | .edu 邮箱认证用户 | 全年享 `学期付` 价格 | 认证有效期内 | ✅ 可叠加年付优惠 |
| **年付折扣** | 所有付费用户 | 年付 ≈ 月付×10（赠2月） | 购买时选择 | ✅ 可叠加学生优惠 |
| **限时活动** | 管理员指定用户群 | 自定义（5折-9折） | 活动期间 | ❌ 不与新人首月叠加 |
| **推荐奖励** | 邀请新用户付费 | 推荐人/被推荐人各获赠 7 天 | 长期有效 | ✅ 可叠加 |

#### .edu 邮箱注册福利详情

```
┌──────────────────────────────────────────────────┐
│  🎓 学生专属福利                                    │
│                                                    │
│  使用 .edu 邮箱注册即可享受：                         │
│                                                    │
│  ✅ 免费版解锁满血模型调用能力                         │
│  ✅ 学期付资格：                                     │
│     · Pro 版 ¥99-116/学期（省 ¥34-51）               │
│     · Pro+ 版 ¥299-349/学期（省 ¥125-175）           │
│  ✅ 优先体验新功能                                   │
│  ✅ 专属学生社群                                     │
│                                                    │
│  📧 支持的邮箱后缀：                                  │
│  *.edu.cn | *.edu | *.ac.uk | *.ac.jp 等            │
│                                                    │
│  [立即认证]                                          │
└──────────────────────────────────────────────────┘
```

### 4.2 会员升级引导策略

#### 触发场景与引导内容

| 触发场景 | 引导内容 | 引导方式 |
|---------|---------|---------|
| 免费用户模型受限时 | "开通 Pro 解锁满血模型" | 底部 Toast + 模型选择器内嵌提示 |
| 工作流数量达上限 | "升级享更多工作流配额" | 弹窗 + 资源仪表盘高亮 |
| 并发数达上限 | "升级享更多并发" | 排队提示框内引导 |
| 首次注册 7 天内 | "新人专享 ¥3 首月 Pro" | 登录后弹窗 + Dashboard 横幅 |
| 使用高级功能被拦截 | 展示功能对比表 | 功能锁定遮罩 + 升级按钮 |

### 4.3 折扣公告模板

```json
{
  "type": "promotion",
  "title": "🎉 会员制度全新升级，首月福利来袭！",
  "summary": "开通会员解锁更多模型，首月仅需 ¥3",
  "content": "## 会员全新升级\n\n...",
  "action_button": {
    "text": "立即开通",
    "url": "/pricing",
    "style": "primary"
  },
  "target_audience": "free",
  "is_popup": true,
  "popup_style": "modal"
}
```

---

## 五、初始通知内容

> 以下为系统上线时需同步推送的首批通知内容。

### 5.1 通知 01：.edu 邮箱注册福利

```yaml
id: notice-001-edu-benefit
type: education
title: "🎓 .edu 邮箱注册福利"
summary: "使用 .edu 教育邮箱注册，即刻解锁满血模型 + 学期付资格"
priority: 2
target_audience: all
is_popup: true
popup_style: modal
content: |
  ## 🎓 学生专属福利通道已开启

  **StudySolo 致力于教育普惠**，使用 `.edu` / `.edu.cn` 教育邮箱注册的用户，可享受：

  ### 🔓 即时解锁
  - **免费版也可调用满血模型**（GPT-4、Claude-3 等）
  - 无需额外付费，注册即享

  ### 💰 学期付特权
  享受比月付更划算的学期套餐：

  | 版本 | 月付 | 学期付（约5个月） | 节省 |
  |------|------|----------------|------|
  | Pro | ¥25/月 | ¥99-116/学期 | 省 ¥9-26 |
  | Pro+ | ¥79/月 | ¥299-349/学期 | 省 ¥46-96 |

  ### ✅ 支持的教育邮箱
  `*.edu.cn` · `*.edu` · `*.ac.uk` · `*.ac.jp` · `*.edu.au` 等全球主流教育域名

  ### 🚀 如何认证
  1. 使用 .edu 邮箱注册 StudySolo 账号
  2. 完成邮箱验证
  3. 系统自动识别教育邮箱并激活学生特权

  > 💡 已注册的用户也可在「设置 → 账号管理」中绑定 .edu 邮箱完成认证。

action_button:
  text: "立即注册"
  url: "/register"
  style: "primary"
```

### 5.2 通知 02：会员制度全新升级

```yaml
id: notice-002-membership-upgrade
type: promotion
title: "🚀 会员制度全新升级，首月福利来袭！"
summary: "开通会员解锁更多 AI 模型，Pro 版首月仅需 ¥3"
priority: 1
target_audience: free
is_popup: true
popup_style: modal
content: |
  ## 🚀 会员制度全新升级

  StudySolo 四级会员体系焕新登场，**开通会员解锁更多强大模型**，让 AI 学习如虎添翼！

  ### 🎁 首月专属福利
  - **¥1 试用 7 天** Pro 版全部功能
  - 或 **¥3 首月** 畅享完整 Pro 体验
  - 仅限未曾付费的新用户

  ### 🧠 会员专享模型
  | 等级 | 可用模型 |
  |------|---------|
  | 免费版 | DeepSeek、部分通义千问 |
  | **Pro 版** | + GPT-4、Claude-3、Gemini 等满血模型 |
  | **Pro+ 版** | + 最新旗舰模型优先体验 |
  | **Ultra 版** | 所有模型无限制 |

  ### 📊 更多权益对比
  | 权益 | 免费版 | Pro 版 |
  |------|--------|--------|
  | 工作流数量 | 10 个 | 50 个 |
  | 并发执行 | 2 个 | 5 个 |
  | 每日执行 | 20 次 | 50 次 |
  | 存储空间 | 1 GB | 3 GB |
  | 联网搜索 | 仅权威 | 权威+论坛 |

  ### 💡 年付更划算
  年付 ≈ 月付 × 10，相当于**赠送 2 个月**！

  > 🎓 学生用户：使用 .edu 邮箱认证后，免费版即可调用满血模型！

action_button:
  text: "查看会员方案"
  url: "/pricing"
  style: "primary"
```

---

## 六、数据库设计

### 6.1 新增数据表

```sql
-- 公告表
CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('system', 'feature', 'promotion', 'education', 'changelog')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,              -- Markdown 格式
  cover_image TEXT,                   -- 封面图 URL
  action_button JSONB,               -- { text, url, style }
  target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'free', 'pro', 'student')),
  priority INTEGER DEFAULT 5,        -- 1=最高，10=最低
  is_popup BOOLEAN DEFAULT false,    -- 是否弹窗展示
  popup_style TEXT DEFAULT 'modal' CHECK (popup_style IN ('modal', 'banner', 'toast')),
  start_time TIMESTAMPTZ DEFAULT now(),
  end_time TIMESTAMPTZ,              -- NULL=永不过期
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 用户通知已读状态表
CREATE TABLE notice_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT true,
  read_at TIMESTAMPTZ DEFAULT now(),
  is_popup_dismissed BOOLEAN DEFAULT false, -- 弹窗是否已关闭
  UNIQUE (user_id, notice_id)
);

-- 用户评分表
CREATE TABLE user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  rating_type TEXT NOT NULL CHECK (rating_type IN ('workflow_completion', 'feature_experience', 'nps', 'renewal')),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  feedback TEXT,                      -- 文字反馈
  tags TEXT[],                        -- 选中的改进方向标签
  context JSONB,                      -- 上下文信息（如 workflow_id、feature_name）
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 折扣/优惠券表
CREATE TABLE discount_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'trial')),
  discount_value NUMERIC NOT NULL,    -- 百分比折扣(0.7=7折) 或固定金额
  applicable_plans TEXT[],            -- ['pro', 'pro_plus']
  target_audience TEXT DEFAULT 'all',
  max_uses INTEGER,                   -- NULL=无限制
  used_count INTEGER DEFAULT 0,
  start_time TIMESTAMPTZ DEFAULT now(),
  end_time TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 用户优惠券领取记录
CREATE TABLE user_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  coupon_id UUID NOT NULL REFERENCES discount_coupons(id),
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, coupon_id)
);

-- RLS 策略
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_coupons ENABLE ROW LEVEL SECURITY;

-- notices: 所有人可读已发布的公告
CREATE POLICY "notices_select_active" ON notices
  FOR SELECT USING (is_active = true AND start_time <= now() AND (end_time IS NULL OR end_time > now()));

-- notice_reads: 用户只能读写自己的已读记录
CREATE POLICY "notice_reads_user" ON notice_reads
  FOR ALL USING (auth.uid() = user_id);

-- user_ratings: 用户只能读写自己的评分
CREATE POLICY "user_ratings_user" ON user_ratings
  FOR ALL USING (auth.uid() = user_id);
```

### 6.2 索引优化

```sql
CREATE INDEX idx_notices_type_active ON notices (type, is_active) WHERE is_active = true;
CREATE INDEX idx_notices_start_end ON notices (start_time, end_time);
CREATE INDEX idx_notice_reads_user ON notice_reads (user_id, notice_id);
CREATE INDEX idx_user_ratings_user ON user_ratings (user_id, rating_type);
CREATE INDEX idx_user_ratings_type_score ON user_ratings (rating_type, score);
```

---

## 七、前端组件设计

### 7.1 组件架构

```
src/components/
  ├── notice/
  │   ├── NoticeCenter.tsx          # 通知中心面板（侧边栏/下拉）
  │   ├── NoticePopup.tsx           # 弹窗公告组件
  │   ├── NoticeBanner.tsx          # 顶部横幅通知
  │   ├── NoticeToast.tsx           # Toast 轻提示通知
  │   ├── NoticeBadge.tsx           # 铃铛图标 + 红点指示
  │   └── NoticeCard.tsx            # 通知列表中的单条卡片
  ├── rating/
  │   ├── StarRating.tsx            # 5 星评分组件
  │   ├── NpsRating.tsx             # NPS 0-10 评分组件
  │   ├── RatingPopup.tsx           # 评分弹窗容器
  │   └── FeedbackTags.tsx          # 改进方向标签选择
  └── membership/
      ├── MembershipBanner.tsx      # 会员升级引导横幅
      ├── UpgradePrompt.tsx         # 功能受限时的升级提示
      ├── PricingCompare.tsx        # 套餐对比卡片
      └── DiscountBadge.tsx         # 折扣标签
```

### 7.2 核心组件交互流

```
用户登录
  │
  ▼
NoticeProvider (Context)
  │ ← 轮询 /api/notices/unread
  │
  ├── NoticePopup (优先级最高的 1 条弹窗)
  │     ├── 系统公告 → 全屏 Modal
  │     ├── 营销活动 → 居中 Modal + 操作按钮
  │     └── 功能更新 → 右下角 Toast
  │
  ├── NoticeBadge (Navbar 铃铛)
  │     └── 点击展开 NoticeCenter
  │
  └── RatingPopup (条件触发)
        ├── 工作流完成 → 5星评分
        └── 定期触发 → NPS问卷
```

### 7.3 状态管理（Zustand Store）

```typescript
// stores/use-notice-store.ts
interface NoticeStore {
  // 未读通知
  unreadNotices: Notice[];
  unreadCount: number;

  // 弹窗队列
  popupQueue: Notice[];
  currentPopup: Notice | null;

  // 评分状态
  pendingRating: RatingRequest | null;

  // Actions
  fetchUnread: () => Promise<void>;
  markAsRead: (noticeId: string) => Promise<void>;
  dismissPopup: (noticeId: string) => void;
  showNextPopup: () => void;
  submitRating: (data: RatingSubmission) => Promise<void>;
}
```

---

## 八、后端 API 设计

### 8.1 公告相关 API

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| `GET` | `/api/notices` | 获取公告列表（分页、筛选） | 已登录 |
| `GET` | `/api/notices/unread` | 获取当前用户未读公告 | 已登录 |
| `GET` | `/api/notices/{id}` | 获取公告详情 | 已登录 |
| `POST` | `/api/notices/{id}/read` | 标记公告为已读 | 已登录 |
| `POST` | `/api/notices/{id}/dismiss-popup` | 关闭弹窗（不再弹出） | 已登录 |
| `POST` | `/api/notices` | 创建新公告 | **Admin** |
| `PUT` | `/api/notices/{id}` | 更新公告 | **Admin** |
| `DELETE` | `/api/notices/{id}` | 删除公告 | **Admin** |

### 8.2 评分相关 API

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| `POST` | `/api/ratings` | 提交用户评分 | 已登录 |
| `GET` | `/api/ratings/check` | 检查是否应触发评分弹窗 | 已登录 |
| `GET` | `/api/ratings/stats` | 获取评分统计数据 | **Admin** |

### 8.3 折扣相关 API

| Method | Path | 说明 | 权限 |
|--------|------|------|------|
| `GET` | `/api/discounts/available` | 获取当前用户可用折扣 | 已登录 |
| `POST` | `/api/discounts/redeem` | 兑换/使用优惠券 | 已登录 |
| `POST` | `/api/discounts` | 创建折扣规则 | **Admin** |

---

## 九、实施优先级与任务分解

### Phase A — MVP 核心（与整体 P1 阶段同步）

| # | 任务 | 验收标准 |
|---|------|---------|
| A1 | 创建 notices + notice_reads 数据表 | 表创建成功，RLS 生效 |
| A2 | 后端：公告 CRUD API + 未读查询 | Swagger 测试通过 |
| A3 | 前端：NoticeBadge + NoticeCenter | 铃铛显示未读数，点击展开通知列表 |
| A4 | 前端：NoticePopup 弹窗逻辑 | 登录后弹出最高优先级未读公告 |
| A5 | 写入初始通知（.edu 福利 + 会员升级） | 数据库有 2 条初始公告 |

### Phase B — 评分系统

| # | 任务 | 验收标准 |
|---|------|---------|
| B1 | 创建 user_ratings 数据表 | 表创建成功 |
| B2 | 后端：评分 API + 触发检查 | `/api/ratings/check` 返回是否应弹窗 |
| B3 | 前端：StarRating + RatingPopup | 工作流完成后弹出评分弹窗 |
| B4 | 前端：NpsRating + FeedbackTags | 定期 NPS 调查弹窗正常 |

### Phase C — 会员营销

| # | 任务 | 验收标准 |
|---|------|---------|
| C1 | 创建 discount_coupons + user_coupons 表 | 表创建成功 |
| C2 | 后端：折扣 API | 可用折扣查询正常 |
| C3 | 前端：MembershipBanner + UpgradePrompt | 免费用户看到升级引导 |
| C4 | 前端：模型选择器会员限制提示 | 选择受限模型时显示升级提示 |

---

> 📌 **文档关系**
>
> | 文档 | 定位 |
> |------|------|
> | **本文（公告系统设计）** | 🔔 公告 + 评分 + 营销完整方案 |
> | `../admin/01-admin-panel-design.md` | 🛠️ 后台面板中的公告管理界面设计 |
> | `../../global/项目深度功能规划.md` | 🧭 项目全局功能规划总纲 |
> | `../core/工作流AI交互规划.md` | 💰 付费体系与会员等级详细设计 |
