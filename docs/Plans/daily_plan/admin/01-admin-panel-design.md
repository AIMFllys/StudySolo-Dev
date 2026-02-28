# 后台管理面板系统 · 全面设计文档

> 📅 创建日期：2026-02-27  
> 🔄 最新更新：2026-02-27  
> 📌 所属模块：Admin · 后台管理面板  
> 🔗 关联文档：[项目深度功能规划](../../global/项目深度功能规划.md) · [PROJECT_PLAN](../../global/PROJECT_PLAN.md) · [公告系统设计](../notice/01-notice-system-design.md) · [工作流AI交互规划](../core/工作流AI交互规划.md)

---

## 📑 目录

- [一、系统概述与安全设计](#一系统概述与安全设计)
- [二、技术架构方案](#二技术架构方案)
- [三、核心功能模块设计](#三核心功能模块设计)
- [四、数据看板（Dashboard）](#四数据看板dashboard)
- [五、用户管理](#五用户管理)
- [六、公告管理](#六公告管理)
- [七、工作流监控](#七工作流监控)
- [八、AI 模型管理](#八ai-模型管理)
- [九、会员与订阅管理](#九会员与订阅管理)
- [十、系统配置与运维](#十系统配置与运维)
- [十一、数据库设计](#十一数据库设计)
- [十二、API 设计](#十二api-设计)
- [十三、实施优先级与任务分解](#十三实施优先级与任务分解)

---

## 一、系统概述与安全设计

### 1.1 系统定位

后台管理面板（Admin Panel）是 StudySolo 的**运营中枢**，为管理员提供平台全方位的数据洞察与运营管控能力。

> **核心理念：数据驱动运营 + 一站式管控 + 安全第一**

### 1.2 访问配置

| 配置项 | 值 | 说明 |
|--------|---|------|
| **访问 URL** | `{项目URL}/admin-analysis` | 独立路由，不影响用户界面 |
| **管理员用户名** | `1037SoloAdmin` | 独立管理员账号体系 |
| **管理员密码** | `HUSTerYYDS` | 初始密码，首次登录强制修改 |

### 1.3 安全架构

#### 多层安全防护

```
第1层：路由隐藏
  └── /admin-analysis 不出现在前端导航中、robots.txt 中 disallow
  └── 无任何页面链接指向该路由

第2层：独立认证
  └── 管理员账号系统独立于用户 Supabase Auth
  └── 使用独立的 JWT Token（admin_token）
  └── Token 有效期短：4 小时
  └── 登录日志全记录

第3层：IP 白名单（可选）
  └── 仅允许指定 IP 访问 /admin-analysis
  └── 配置于 Nginx 层

第4层：操作审计
  └── 所有管理操作记录到 admin_audit_logs 表
  └── 包含：操作人 · 操作类型 · 操作目标 · 时间 · IP
```

#### 认证流程

```
管理员访问 /admin-analysis
    │
    ▼
┌──────────────────────────────────┐
│  Admin Login Page                │
│                                  │
│  用户名：[________________]      │
│  密  码：[________________]      │
│                                  │
│  [登录]                          │
└──────────────────────────────────┘
    │
    ▼
POST /api/admin/login
  → 验证用户名 + 密码（bcrypt 哈希比对）
  → 成功：签发 admin_jwt_token（HttpOnly Cookie）
  → 失败：记录失败日志，连续5次锁定30分钟
    │
    ▼
admin_jwt_token 中间件鉴权
  → 所有 /api/admin/* 接口均需携带
  → 验证失败 → 重定向到登录页
```

#### 密码安全策略

| 策略 | 规则 |
|------|------|
| 存储方式 | bcrypt 哈希（salt rounds = 12） |
| 首次登录 | 强制修改初始密码 |
| 密码复杂度 | ≥12 位，必须包含大小写字母 + 数字 + 特殊字符 |
| 登录失败锁定 | 连续 5 次失败 → 锁定 30 分钟 |
| 登录通知 | 每次成功登录发送邮件通知 |
| Session 管理 | 单点登录（同时只允许 1 个管理员会话） |

---

## 二、技术架构方案

### 2.1 前端路由设计

```
app/
  └── (admin)/                    # 管理员路由组（独立 Layout，不继承用户界面）
      ├── admin-analysis/
      │   ├── layout.tsx          # Admin Shell（侧边栏 + 顶栏）
      │   ├── page.tsx            # 数据看板首页
      │   ├── login/
      │   │   └── page.tsx        # Admin 登录页
      │   ├── users/
      │   │   ├── page.tsx        # 用户列表
      │   │   └── [id]/
      │   │       └── page.tsx    # 用户详情
      │   ├── notices/
      │   │   ├── page.tsx        # 公告管理列表
      │   │   └── create/
      │   │       └── page.tsx    # 新建/编辑公告
      │   ├── workflows/
      │   │   └── page.tsx        # 工作流监控
      │   ├── models/
      │   │   └── page.tsx        # AI 模型管理
      │   ├── members/
      │   │   └── page.tsx        # 会员与订阅管理
      │   ├── ratings/
      │   │   └── page.tsx        # 用户评分数据
      │   ├── config/
      │   │   └── page.tsx        # 系统配置
      │   └── audit/
      │       └── page.tsx        # 操作审计日志
```

### 2.2 后端路由设计

```python
# backend/app/api/admin.py
# 所有 Admin API 路由统一前缀 /api/admin/*
# 需通过 admin_jwt 中间件鉴权

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

# 认证
POST   /api/admin/login              # 管理员登录
POST   /api/admin/logout             # 管理员退出
POST   /api/admin/change-password    # 修改密码

# 数据看板
GET    /api/admin/dashboard/overview  # 核心指标概览
GET    /api/admin/dashboard/charts    # 图表数据（时间范围参数）

# 用户管理
GET    /api/admin/users               # 用户列表（分页+搜索+筛选）
GET    /api/admin/users/{id}          # 用户详情
PUT    /api/admin/users/{id}/status   # 启用/禁用用户
PUT    /api/admin/users/{id}/role     # 修改用户角色

# 公告管理
GET    /api/admin/notices             # 公告列表
POST   /api/admin/notices             # 创建公告
PUT    /api/admin/notices/{id}        # 更新公告
DELETE /api/admin/notices/{id}        # 删除公告
POST   /api/admin/notices/{id}/push   # 立即推送指定公告

# 工作流监控
GET    /api/admin/workflows/stats     # 工作流整体统计
GET    /api/admin/workflows/running   # 当前运行中的工作流
GET    /api/admin/workflows/errors    # 异常工作流列表

# AI 模型管理
GET    /api/admin/models/status       # 各模型健康状态
GET    /api/admin/models/usage        # 模型调用量统计
PUT    /api/admin/models/{id}/config  # 更新模型配置

# 会员管理
GET    /api/admin/members/stats       # 会员统计数据
GET    /api/admin/members/list        # 付费会员列表
GET    /api/admin/members/revenue     # 营收数据

# 评分数据
GET    /api/admin/ratings/overview    # 评分总览（NPS/CSAT）
GET    /api/admin/ratings/details     # 评分明细

# 系统配置
GET    /api/admin/config              # 获取系统配置
PUT    /api/admin/config              # 更新系统配置

# 审计日志
GET    /api/admin/audit-logs          # 操作审计日志列表
```

### 2.3 Admin Shell 布局

```
┌───────────────────────────────────────────────────────────────┐
│  🔒 StudySolo Admin                    admin@1037solo.com  🔔 │
├────────────┬──────────────────────────────────────────────────┤
│            │                                                  │
│  📊 数据看板 │  ┌────────────────────────────────────────────┐ │
│            │  │                                            │ │
│  👥 用户管理 │  │              主内容区域                     │ │
│            │  │                                            │ │
│  📢 公告管理 │  │    (根据左侧选中的菜单动态渲染)              │ │
│            │  │                                            │ │
│  ⚡ 工作流  │  │                                            │ │
│            │  │                                            │ │
│  🧠 模型管理 │  │                                            │ │
│            │  │                                            │ │
│  💎 会员管理 │  │                                            │ │
│            │  │                                            │ │
│  ⭐ 评分数据 │  │                                            │ │
│            │  │                                            │ │
│  ⚙️ 系统配置 │  │                                            │ │
│            │  │                                            │ │
│  📋 审计日志 │  └────────────────────────────────────────────┘ │
│            │                                                  │
└────────────┴──────────────────────────────────────────────────┘
```

---

## 三、核心功能模块设计

### 3.1 功能模块总览

| 模块 | 功能概述 | 优先级 | 复杂度 |
|------|---------|--------|--------|
| **数据看板** | 核心指标、趋势图表、实时数据 | ⭐ P0 | ⭐⭐⭐ |
| **用户管理** | 用户列表、搜索、状态管理 | ⭐ P0 | ⭐⭐ |
| **公告管理** | CRUD + 推送 + 预览 | ⭐ P0 | ⭐⭐⭐ |
| **工作流监控** | 运行状态、异常告警、性能指标 | ⭐ P0 | ⭐⭐⭐ |
| **AI 模型管理** | 模型健康、调用量、配置 | ⭐ P1 | ⭐⭐⭐ |
| **会员管理** | 订阅数据、营收分析 | ⭐ P1 | ⭐⭐ |
| **评分数据** | NPS/CSAT 可视化、反馈列表 | ⭐ P1 | ⭐⭐ |
| **系统配置** | 全局参数、限流规则、YAML 配置 | ⬜ P2 | ⭐⭐ |
| **审计日志** | 操作审计、安全事件追溯 | ⬜ P2 | ⭐ |

---

## 四、数据看板（Dashboard）

### 4.1 核心指标卡片（KPI Cards）

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ 📊 总用户  │  │ 📈 DAU   │  │ ⚡ 工作流  │  │ 💰 MRR   │
│  1,247    │  │   328    │  │   4,521  │  │ ¥8,450   │
│ +12% ↑   │  │ +5.3% ↑  │  │ +23% ↑   │  │ +15% ↑   │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

| 指标 | 计算方式 | 数据源 | 刷新频率 |
|------|---------|--------|---------|
| **总注册用户数** | `COUNT(user_profiles)` | user_profiles 表 | 实时 |
| **DAU（日活跃用户）** | 当日有任何 API 请求的去重 user_id | 请求日志 | 每小时 |
| **WAU**（周活跃用户） | 7 天滚动去重 | 请求日志 | 每天 |
| **MAU**（月活跃用户） | 30 天滚动去重 | 请求日志 | 每天 |
| **总工作流运行次数** | `COUNT(workflow_runs)` | workflow_runs 表 | 实时 |
| **今日工作流执行** | 当天 `COUNT(workflow_runs)` | 同上 | 每小时 |
| **MRR**（月经常性收入） | 所有活跃订阅月付金额之和 | 订阅表 | 每天 |
| **ARPU**（每用户平均收入） | MRR / 付费用户数 | 计算 | 每天 |
| **免费→付费转化率** | 付费用户 / 总注册用户 | 计算 | 每天 |
| **NPS 得分** | (9-10推荐者%) - (0-6批评者%) | user_ratings 表 | 实时 |

### 4.2 趋势图表

#### 用户增长趋势（折线图）

- X 轴：日期（7天 / 30天 / 90天 切换）
- Y 轴：注册用户数（累计 vs 新增）
- 双 Y 轴：新注册 + 累计用户

#### 工作流执行趋势（柱状图 + 折线叠加）

- 柱状图：每日工作流执行次数
- 折线图：成功率（%）
- 颜色区分：成功(绿) / 失败(红) / 进行中(蓝)

#### 模型调用分布（饼图 / 环形图）

- 按模型提供商分布（DeepSeek / 通义千问 / GPT-4 / Claude 等）
- 按节点类型分布（outline_gen / content_extract / summary 等）

#### 营收趋势（面积图）

- 按会员等级分层的月营收
- Pro / Pro+ / Ultra 各层营收占比

### 4.3 实时监控面板

```
┌──────────────────────────────────────────────────┐
│  📡 实时监控                                      │
│                                                  │
│  当前在线用户：43                                  │
│  正在执行的工作流：7                               │
│  API 平均响应时间：127ms                           │
│  最近 15 分钟错误数：2                             │
│                                                  │
│  系统健康度：🟢 正常                               │
│  ├── FastAPI：🟢 OK (2038)                       │
│  ├── Next.js：🟢 OK (2037)                       │
│  ├── Supabase：🟢 OK                             │
│  ├── DeepSeek API：🟢 OK (98ms)                  │
│  ├── 通义千问 API：🟢 OK (145ms)                  │
│  └── 七牛云 API：🟡 Slow (1.2s)                   │
└──────────────────────────────────────────────────┘
```

---

## 五、用户管理

### 5.1 用户列表

| 列名 | 说明 | 操作 |
|------|------|------|
| 头像 + 昵称 | 用户基本信息 | 点击查看详情 |
| 邮箱 | 注册邮箱（部分脱敏） | — |
| 注册时间 | 格式化时间 | 支持排序 |
| 会员等级 | 免费/Pro/Pro+/Ultra | 支持筛选 |
| 工作流数 | 该用户创建的工作流数量 | 支持排序 |
| 状态 | 正常/已禁用 | 切换操作 |
| 最后登录 | 最近活跃时间 | 支持排序 |

### 5.2 搜索与筛选

```
搜索框：[按邮箱/昵称搜索...]

筛选器：
  会员等级：[全部 ▼] [免费] [Pro] [Pro+] [Ultra]
  注册来源：[全部 ▼] [普通邮箱] [.edu 邮箱]
  状态：    [全部 ▼] [正常] [已禁用]
  时间范围：[最近7天 ▼] [最近30天] [全部]
```

### 5.3 用户详情页

```
┌──────────────────────────────────────────────────┐
│  👤 用户详情：example@university.edu.cn           │
│                                                  │
│  ── 基本信息 ──                                   │
│  用户 ID：b7a3f2d1-...                           │
│  昵  称：学习者小王                                │
│  邮  箱：example@university.edu.cn               │
│  注册时间：2026-02-15 14:23                       │
│  最后登录：2026-02-26 22:10                       │
│  注册来源：.edu 邮箱                               │
│                                                  │
│  ── 订阅信息 ──                                   │
│  当前套餐：Pro 版                                  │
│  到期时间：2026-03-15                              │
│  付费历史：3 笔                                    │
│                                                  │
│  ── 使用统计 ──                                   │
│  工作流总数：28 / 50 (56%)                         │
│  总执行次数：156                                   │
│  今日执行：5 / 50                                  │
│  总 Token 消耗：1,234,567                          │
│  本月 Token：345,678                              │
│                                                  │
│  ── 操作 ──                                       │
│  [重置密码] [修改角色] [禁用账户] [查看工作流]       │
└──────────────────────────────────────────────────┘
```

---

## 六、公告管理

### 6.1 公告列表

显示所有公告，支持搜索/筛选/排序：

| 列名 | 说明 | 操作 |
|------|------|------|
| 标题 | 公告标题 | 点击编辑 |
| 类型 | system/feature/promotion/education/changelog | 筛选 |
| 状态 | 草稿/已发布/已过期 | 切换 |
| 目标受众 | all/free/pro/student | 筛选 |
| 弹窗 | 是否弹窗展示 | 快速开关 |
| 已读率 | 已读人数/目标人数 | 排序 |
| 创建时间 | — | 排序 |

### 6.2 WYSIWYG 公告编辑器

```
┌──────────────────────────────────────────────────────────┐
│  📢 编辑公告                                              │
│                                                          │
│  标题：[__________________________________________]       │
│  类型：[system ▼]  受众：[all ▼]  优先级：[5 ▼]          │
│                                                          │
│  ── 内容编辑（Markdown） ──                               │
│  ┌──────────────────────────────────────────────────┐    │
│  │ B I U | H1 H2 | 🔗 📷 | 📋 引用 | < > 代码      │    │
│  │──────────────────────────────────────────────────│    │
│  │                                                  │    │
│  │  ## 公告内容                                      │    │
│  │                                                  │    │
│  │  在此编写公告正文...                               │    │
│  │                                                  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ── 展示设置 ──                                           │
│  ☑ 弹窗展示    弹窗类型：[modal ▼]                        │
│  生效时间：[2026-02-27]  到 [2026-03-15]                  │
│                                                          │
│  ── 操作按钮 ──                                           │
│  按钮文案：[立即查看]  链接：[/pricing]  样式：[primary ▼]  │
│                                                          │
│  ── 预览 ──                                               │
│  ┌──────────────────────────────────────────────────┐    │
│  │  (Markdown 渲染预览区)                            │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  [保存草稿]  [预览弹窗效果]  [立即发布]                     │
└──────────────────────────────────────────────────────────┘
```

### 6.3 公告推送操作

- **立即推送**：管理员可对已发布公告执行"立即推送"操作，所有目标用户的 `notice_reads` 状态重置
- **定时发布**：设置 `start_time` 和 `end_time`，到达 `start_time` 后自动激活
- **撤回**：可随时将已发布的公告设为非激活，用户端即时隐藏

---

## 七、工作流监控

### 7.1 工作流状态看板

```
┌──────────────────────────────────────────────────┐
│  ⚡ 工作流监控                                    │
│                                                  │
│  ── 实时状态 ──                                   │
│  🟢 运行中：7       🔵 排队中：3                  │
│  ✅ 今日完成：89     ❌ 今日失败：4                │
│                                                  │
│  ── 运行中的工作流 ──                              │
│  ┌──────────────────────────────────────────────┐│
│  │ ID        | 用户     | 进度 | 当前节点 | 耗时  ││
│  │───────────┼─────────┼──────┼─────────┼──── ──││
│  │ wf-a3b2   | user@...| 3/6  | extract | 45s   ││
│  │ wf-d4e5   | test@...| 1/4  | outline | 12s   ││
│  │ wf-f6g7   | edu@... | 5/7  | summary | 2m30s ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ── 异常告警 ──                                   │
│  🔴 wf-h8i9 执行超时（>5分钟）@ 15:32            │
│  🔴 wf-j0k1 模型API错误（429 Too Many Requests） │
│  🟡 DeepSeek API 响应变慢（avg 2.1s → 4.5s）      │
│                                                  │
│  ── 性能指标（24小时） ──                           │
│  平均执行时间：3分42秒                              │
│  P95 执行时间：8分15秒                              │
│  成功率：96.2%                                     │
│  Token 总消耗：2,345,678                           │
└──────────────────────────────────────────────────┘
```

### 7.2 工作流详情追踪

点击某个运行中/异常的工作流，可看到完整执行链路：

```
wf-a3b2 详细执行链路
  │
  ├─ [trigger_input]     ✅ Done   0.1s    "深入学习 React Hooks"
  ├─ [ai_analyzer]       ✅ Done   1.8s    豆包 2.0-pro · 856 tokens
  ├─ [ai_planner]        ✅ Done   3.2s    qwen3-turbo · 1,240 tokens
  ├─ [outline_gen]       🔵 Running 45s... qwen3-turbo · streaming
  ├─ [content_extract]   ⏳ Pending
  ├─ [summary]           ⏳ Pending
  └─ [flashcard]         ⏳ Pending

  操作：[强制停止] [重试失败节点] [查看详细日志]
```

---

## 八、AI 模型管理

### 8.1 模型健康状态面板

```
┌──────────────────────────────────────────────────────────┐
│  🧠 AI 模型状态                                          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 模型名称        │ 状态 │ 延迟   │ 今日调用 │ 错误率 │  │
│  │─────────────────┼──────┼────────┼─────────┼───────│  │
│  │ deepseek-v3.2   │ 🟢   │ 95ms   │ 1,234   │ 0.2%  │  │
│  │ deepseek-r1     │ 🟢   │ 210ms  │ 567     │ 0.1%  │  │
│  │ qwen3-turbo     │ 🟢   │ 130ms  │ 2,345   │ 0.3%  │  │
│  │ qwen3-plus      │ 🟢   │ 180ms  │ 890     │ 0.5%  │  │
│  │ gpt-4.1 (GPT)   │ 🟡   │ 1.2s   │ 123     │ 2.1%  │  │
│  │ claude-3.5-sonnet│ 🟡   │ 980ms  │ 98      │ 1.8%  │  │
│  │ doubao-2.0-pro  │ 🟢   │ 88ms   │ 3,456   │ 0.1%  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ── 调用量趋势图（7天） ──                                │
│  [折线图：各模型每日调用量]                                │
│                                                          │
│  ── Token 消耗统计 ──                                    │
│  今日总消耗：4,567,890 tokens                              │
│  本月总消耗：89,012,345 tokens                             │
│  预估月成本：¥245                                          │
└──────────────────────────────────────────────────────────┘
```

### 8.2 模型配置管理

- 查看当前 `config.yaml` 中的模型配置
- 可在线编辑模型参数（temperature / max_tokens / timeout）
- 模型启用/禁用开关
- 容灾降级链可视化编辑

---

## 九、会员与订阅管理

### 9.1 会员统计看板

```
┌──────────────────────────────────────────────────┐
│  💎 会员统计                                      │
│                                                  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │ 免费版  │ │ Pro    │ │ Pro+   │ │ Ultra  │   │
│  │ 1,089  │ │  128   │ │   25   │ │    5   │   │
│  │ 87.3%  │ │ 10.3%  │ │  2.0%  │ │  0.4%  │   │
│  └────────┘ └────────┘ └────────┘ └────────┘   │
│                                                  │
│  转化漏斗：                                       │
│  注册 → 活跃 → 首次付费 → 续费 → 升级            │
│  1247   643    158      112    35               │
│  100%   51.6%  12.7%    8.9%   2.8%             │
│                                                  │
│  学生用户：87 人（含 .edu 认证 62 人）             │
│                                                  │
│  ── 营收数据 ──                                   │
│  MRR：¥8,450                                     │
│  ARR：¥101,400                                   │
│  ARPU：¥53.5                                     │
│  Churn Rate（月流失率）：4.2%                      │
│  LTV（用户生命周期价值）：¥1,273                    │
└──────────────────────────────────────────────────┘
```

### 9.2 订阅管理操作

| 操作 | 说明 | 权限 |
|------|------|------|
| 查看付费用户列表 | 筛选不同等级的付费用户 | Admin |
| 手动延期 | 为指定用户延长会员有效期 | Admin |
| 赠送会员 | 向指定用户赠送 N 天会员体验 | Admin |
| 创建优惠活动 | 设置折扣码、限时优惠 | Admin |
| 退款处理 | 记录退款操作及原因 | Admin |

---

## 十、系统配置与运维

### 10.1 可配置参数

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 新用户每日工作流上限 | 20 次 | 免费版每日执行上限 |
| 工作流最大运行时间 | 300s | 超时自动终止 |
| SSE 心跳间隔 | 15s | 工作流执行中的 SSE keepalive |
| 自动保存间隔 | 3s | 画布编辑防抖同步 |
| 通知弹窗频率 | 24h | 同类型通知间隔时间 |
| 评分触发频率 | 每3次执行 | 工作流完成后评分触发 |
| NPS 调查频率 | 30天 | NPS 弹窗触发周期 |
| 注册验证码有效期 | 5min | 邮箱验证码过期时间 |
| 登录失败锁定次数 | 5次 | 连续失败后锁定 |

### 10.2 YAML 配置在线编辑器

- 以代码编辑器（Monaco Editor）的形式展示 `config.yaml`
- 支持语法高亮 + 即时校验
- 修改后需确认 → 生成 diff → 管理员审核 → 应用

---

## 十一、数据库设计

### 11.1 新增管理表

```sql
-- 管理员账号表
CREATE TABLE admin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,       -- bcrypt 哈希
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  force_change_password BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  failed_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 管理操作审计日志
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_accounts(id),
  action TEXT NOT NULL,              -- 'create_notice' / 'disable_user' / 'modify_config' 等
  target_type TEXT,                  -- 'notice' / 'user' / 'config' / 'workflow' 等
  target_id TEXT,                    -- 目标资源 ID
  details JSONB,                     -- 操作详情（变更前后对比）
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 系统配置表（KV 形式，可热更新）
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES admin_accounts(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 初始化管理员账号
INSERT INTO admin_accounts (username, password_hash, email, force_change_password)
VALUES (
  '1037SoloAdmin',
  '$2b$12$...',   -- bcrypt hash of 'HUSTerYYDS'
  'admin@1037solo.com',
  true            -- 首次登录强制修改密码
);

-- RLS
ALTER TABLE admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- 仅 service_role 可访问管理表
CREATE POLICY "admin_service_only" ON admin_accounts
  FOR ALL USING (false); -- 前端永不直接访问，仅后端 service_role

CREATE POLICY "audit_service_only" ON admin_audit_logs
  FOR ALL USING (false);
```

### 11.2 统计聚合视图

```sql
-- 每日用户注册统计视图
CREATE VIEW v_daily_signups AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS signups,
  COUNT(CASE WHEN email LIKE '%.edu%' THEN 1 END) AS edu_signups
FROM user_profiles
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 每日工作流执行统计
CREATE VIEW v_daily_workflow_stats AS
SELECT
  DATE(started_at) AS date,
  COUNT(*) AS total_runs,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) AS success,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed,
  SUM(tokens_used) AS total_tokens,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) AS avg_duration_seconds
FROM workflow_runs
GROUP BY DATE(started_at)
ORDER BY date DESC;
```

---

## 十二、API 设计

### 12.1 认证 API

#### POST `/api/admin/login`

```json
// Request
{
  "username": "1037SoloAdmin",
  "password": "HUSTerYYDS"
}

// Response 200
{
  "success": true,
  "admin": {
    "id": "uuid",
    "username": "1037SoloAdmin",
    "force_change_password": true
  }
}
// Set-Cookie: admin_token=<JWT>; HttpOnly; Secure; SameSite=Lax; Max-Age=14400

// Response 401
{
  "error": "invalid_credentials",
  "message": "用户名或密码错误",
  "remaining_attempts": 3
}

// Response 423 (账号锁定)
{
  "error": "account_locked",
  "message": "账号已锁定，请30分钟后重试",
  "locked_until": "2026-02-27T01:00:00Z"
}
```

### 12.2 数据看板 API

#### GET `/api/admin/dashboard/overview`

```json
{
  "total_users": 1247,
  "dau": 328,
  "wau": 643,
  "mau": 1089,
  "total_workflows": 4521,
  "today_runs": 89,
  "today_success_rate": 96.2,
  "mrr": 8450,
  "arpu": 53.5,
  "nps_score": 42,
  "edu_users": 87,
  "paid_users": 158,
  "conversion_rate": 12.7,
  "models_health": {
    "deepseek-v3.2": { "status": "healthy", "avg_latency_ms": 95 },
    "qwen3-turbo": { "status": "healthy", "avg_latency_ms": 130 },
    "gpt-4.1": { "status": "degraded", "avg_latency_ms": 1200 }
  }
}
```

### 12.3 用户管理 API

#### GET `/api/admin/users?page=1&per_page=20&search=&role=&status=`

```json
{
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "小王",
      "avatar_url": null,
      "role": "user",
      "membership": "pro",
      "workflow_count": 28,
      "total_runs": 156,
      "created_at": "2026-02-15T14:23:00Z",
      "last_login": "2026-02-26T22:10:00Z",
      "is_edu": true,
      "status": "active"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 1247,
    "total_pages": 63
  }
}
```

---

## 十三、实施优先级与任务分解

### Phase A — 基础骨架（P2 阶段·第9-10周）

| # | 任务 | 验收标准 |
|---|------|---------|
| A1 | 创建 admin_accounts / admin_audit_logs 表 + 初始管理员数据 | 表创建成功，管理员可登录 |
| A2 | 后端：Admin 认证 API（login / logout / change-password） | 登录获取 admin_token，密码错误锁定生效 |
| A3 | 前端：`/admin-analysis/login` 登录页 | 输入用户名密码可登录 |
| A4 | 前端：Admin Shell Layout（侧边栏 + 顶栏） | 登录后看到后台布局 |
| A5 | 前端：Admin Middleware 路由守卫 | 未登录访问 admin 页面重定向到登录 |

### Phase B — 核心功能（P2 阶段·第10-11周）

| # | 任务 | 验收标准 |
|---|------|---------|
| B1 | 后端：Dashboard Overview API | 返回核心 KPI 数据 |
| B2 | 前端：数据看板页面（KPI 卡片 + 趋势图） | 图表正确渲染 |
| B3 | 后端：用户列表 API（分页+搜索+筛选） | 用户列表查询正常 |
| B4 | 前端：用户管理页面 | 列表展示、搜索筛选、状态切换 |
| B5 | 后端：公告管理 API（CRUD + 推送） | 公告创建/编辑/删除/推送正常 |
| B6 | 前端：公告管理页面（列表 + 编辑器） | 管理员可创建发布公告 |

### Phase C — 监控与高级功能（P2 阶段·第11-12周）

| # | 任务 | 验收标准 |
|---|------|---------|
| C1 | 后端：工作流监控 API | 运行中/异常工作流列表正常 |
| C2 | 前端：工作流监控页面 | 实时显示工作流状态 |
| C3 | 后端：模型状态 API | 各模型健康状态查询正常 |
| C4 | 前端：AI 模型管理页面 | 模型健康状态面板正常 |
| C5 | 后端：评分统计 API | NPS/CSAT 聚合数据正常 |
| C6 | 前端：评分数据页面 | 评分趋势图表正常 |
| C7 | 前端：审计日志页面 | 管理操作审计记录可查看 |

---

> 📌 **文档关系**
>
> | 文档 | 定位 |
> |------|------|
> | **本文（管理后台设计）** | 🛠️ Admin Panel 完整设计方案 |
> | `../notice/01-notice-system-design.md` | 🔔 公告系统设计（公告管理页调用） |
> | `../../global/项目深度功能规划.md` | 🧭 项目全局功能规划总纲 |
> | `../../global/PROJECT_PLAN.md` | 🔧 技术执行方案 |
> | `../core/工作流AI交互规划.md` | 💰 付费体系与工作流交互设计 |
