# StudySolo 会员体系完整设计 · 权威指南

> 📅 创建日期：2026-02-27  
> 📌 所属模块：user_auth · 用户认证与权限 · VIP 会员  
> 🔗 关联文档：[工作流AI交互规划 · 付费机制](../core/工作流AI交互规划.md#一付费机制与订阅体系) · [02-user-tier-routing-strategy](./02-user-tier-routing-strategy.md) · [vip-02-付费与计费架构](./vip-02-payment-and-billing-architecture.md) · [vip-03-学生认证方案](./vip-03-student-verification-plan.md)  
> 🎯 定位：**StudySolo 会员体系的完整顶层设计文档，统一定义四级会员权益、免费版极简模型策略、商业模式与盈利预测**  
> ⚠️ 本文档针对会员相关设计具有最终决定权，与 `工作流AI交互规划.md` 中的 §1 付费机制保持同步。

---

## 📑 目录

- [一、商业模式定位](#一商业模式定位)
- [二、四级会员权益矩阵（权威版）](#二四级会员权益矩阵权威版)
- [三、免费版极简策略深度解读](#三免费版极简策略深度解读)
- [四、按量加购生态](#四按量加购生态)
- [五、会员过期与数据保留机制](#五会员过期与数据保留机制)
- [六、学生认证特权体系](#六学生认证特权体系)
- [七、会员成长与留存策略](#七会员成长与留存策略)
- [八、数据库 Schema（会员核心表）](#八数据库-schema会员核心表)
- [九、前端会员 UI 设计规范](#九前端会员-ui-设计规范)
- [十、盈利预测模型](#十盈利预测模型)
- [十一、ACTION ITEMS](#十一action-items)

---

## 一、商业模式定位

### 1.1 StudySolo 的付费本质

StudySolo 不是一个"消耗型 AI 聊天工具"，而是一个**"学习增效工作流平台"**。用户的付费意愿并非为了"和 AI 聊更多话"，而是为了：

1. **更深度的分析**：满血推理模型（DeepSeek-R1）vs 轻量模型
2. **更高效的执行**：并发 + 不限次 vs 每日20次
3. **更丰富的能力**：海外模型、深度搜索、多模态、知识库精准检索
4. **更大的空间**：更多工作流 + 更大知识库

### 1.2 定价策略核心原则

| 原则 | 实践 |
|------|------|
| **免费版要好用** | 核心功能（生成工作流 + 运行）必须可用。让用户先爽到，才会付费 |
| **Pro 是甜点** | ¥25/月 = 一杯奶茶钱。大学生群体的心理价位上限 |
| **Pro+ 是刚需** | ¥79/月。面向重度用户（考研党、毕业论文党），深度搜索+大存储 |
| **Ultra 是钩子** | ¥1299/月。面向机构/教培，企业级 SLA，几乎不期望个人付费 |
| **加购是粘性** | 每月 ¥1/GB 的加购让用户从"试用"变成"投入"，沉没成本驱动续费 |

### 1.3 与竞品的定价对标

| 竞品 | 免费额度 | 入门付费 | 定位 |
|------|---------|---------|------|
| ChatGPT Plus | 有限 GPT-4 | $20/月 | 通用 AI 对话 |
| 通义千问 Pro | 大量免费 | ¥19.9/月 | 通用 AI 对话 |
| 飞书多维表格 | 免费基础 | ¥25/月 | 效率工具 |
| **StudySolo** | 日 20 次免费 | **¥25/月** | **学习工作流 AI** |

> **StudySolo 的价格锚点**：与通义千问 Pro 和飞书对齐，低于 ChatGPT Plus。强调"学习专用"差异化。

---

## 二、四级会员权益矩阵（权威版）

> 此表为付费体系的**唯一权威定义**，与 `工作流AI交互规划.md` §1.1 保持一致。

### 2.1 核心权益总表

| 权益维度 | 具体权益项 | 🆓 **免费版** | 💎 **Pro版** | 💠 **Pro+版** | 👑 **Ultra版** |
|:---|:---|:---:|:---:|:---:|:---:|
| **💰 价格** | 国内月付 | ¥0 | **¥25** (原价¥30) | **¥79** | **¥1299** |
| | 国内年付 | – | **¥199** (≈¥16.6/月) | **¥599** (≈¥49.9/月) | **¥9999** (≈¥833/月) |
| | 海外月付 | $0 | **$7.99** | **$19.99** | **$129** |
| | 海外年付 | – | **$79** (≈$6.58/月) | **$199** (≈$16.58/月) | **$1299** (≈$108.25/月) |
| | 新人专享 | – | **¥1试用7天** 或 **¥3首月** | – | – |
| **💾 存储空间** | 总云存储配额 | **1 GB** | **3 GB** | **10 GB** | **100 GB** |
| | 单个知识库文件上限 | 100 MB | 200 MB | **1 GB** | **3 GB** |
| **⚙️ 工作流** | 最大创建工作流数 | 10个 | 50个 | **200个** | **无限制** |
| | 并发运行工作流数 | 2个 | 5个 | **10个** | **100个** |
| | 单次运行循环次数 | 1次（手动） | 1次（手动） | **最多3次** | **最多10次** |
| **🧠 模型能力** | AI 模型等级 | 基础国内模型 | **满血模型** (含GPT-4o等) | **满血模型** | **最灵活调用** (所有旗舰) |
| | 联网搜索 | 仅权威来源 | 权威+论坛 | 权威+论坛+总结 | 全部+深度分析 |
| | 知识库检索深度 | 仅摘要层 | 摘要+向量层 | 摘要+向量+原文 | 全量+缓存优化 |
| | 每日执行上限 | 20次 | 50次 | 150次 | 500次 |
| **✨ 特权** | 新功能抢先体验 | ❌ | ❌ | ✅ | ✅ |
| | 赠送会员 | ❌ | ❌ | ✅ 1037soloAI 对话 | ✅ +企业专属 |
| | 技术支持 | 社区支持 | 邮件(24h内) | 优先邮件(12h内) | **专属客户经理**+SLA |
| **🎓 学生** | 学生认证权益 | 认证后可调满血 | 学期付资格 | 学期付资格 | – |
| | 学期付价格(国内) | – | ¥99-116/学期 | ¥299-349/学期 | – |

### 2.2 模型等级详细映射

> 此映射与 [02-user-tier-routing-strategy](./02-user-tier-routing-strategy.md) §3 完全同步

| 任务类型 | 🆓 Free | 💎 Pro | 💠 Pro+ | 👑 Ultra |
|:---|:---|:---|:---|:---|
| JSON 格式输出 | qwen-turbo | qwen3-turbo | qwen3-turbo | qwen3-max |
| 深度推理 | deepseek-v3 | deepseek-r1 ✅ | deepseek-r1 | deepseek-r1 双校验 |
| 超长文本 | qwen-long | kimi-k2.5 ✅ | kimi-k2.5 | kimi-k2.5 满血 |
| 海外旗舰 | ❌ | gpt-4o ✅ | gpt-5.1 | gpt-5.1 + claude-4 |
| 深度搜索 | 仅基础 | 百度+qwen总结 | 智谱深度搜索 ✅ | Agent 搜索 |
| OCR | 基础 OCR | glm-ocr ✅ | 双引擎 OCR | 满血双引擎 |
| 图片/视频/TTS | ❌ | 图片限量 ✅ | 图+视+TTS | 全功能无限 |

### 2.3 免费版核心卖点：不是阉割版

**免费版的设计哲学**不是"让用户难受逼他付费"，而是"让用户爽到了再告诉他可以更爽"。

| 免费版能做到的 | 说明 |
|:---|:---|
| ✅ 输入自然语言 → 生成完整工作流 | 核心价值不打折 |
| ✅ 工作流执行 + 流式输出 | 画布上看得到 AI 实时思考 |
| ✅ 基础推理能力 | DeepSeek-V3 虽然没有 R1 的思维链，但日常够用 |
| ✅ 基础搜索 | 百炼 enable_search 能回答大部分时事问题 |
| ✅ 知识库摘要检索 | 上传文档后能回答常见问题（约覆盖 80% 场景） |
| ✅ 每日 20 次执行 | 对于"体验党"和"轻度用户"完全足够 |

**免费版做不到的（升级动力）**：

| 做不到 | 用户会在什么场景感知到？ |
|:---|:---|
| ❌ 深度推理（R1） | 写论文大纲时，发现 AI 生成的内容不够深入 |
| ❌ 超长文本（Kimi） | 上传一篇 5 万字论文时，AI 只分析了前 1/3 |
| ❌ 海外模型 | 需要英文学术论文时，无法调用 GPT |
| ❌ 深度搜索 | 只搜到了表面信息，无法深入分析 |
| ❌ 每日 >20 次 | 考前刷题时，20 次很快就用完了 |

---

## 三、免费版极简策略深度解读

> 此节承接对话中确认的"Qwen + DeepSeek + 工具API"三角矩阵决策

### 3.1 为什么确定这个策略？

经过对话中的深度分析，我们确认了以下事实：

| 事实 | 结论 |
|------|------|
| 满血配置单次运行 ¥0.15-0.50 | **灾难性**，100个免费用户/天月成本 ¥1500 |
| qwen-turbo ¥0.0003/K Token | **几乎免费**，100万 Token 才几毛钱 |
| deepseek-v3 ¥0.002/K Token | **比 R1 便宜 10 倍**，日常推理够用 |
| 百炼有千万级免费额度 | **前期甚至不花钱** |
| 聚合平台 JSON 不稳定 | **格式严格任务必须走原生百炼** |
| 智谱搜索太贵 | **拆成"百度骨架 + qwen 总结"降低 10 倍成本** |

### 3.2 免费版的三条生命线

```
生命线 1：qwen-turbo（基座）
    └── 承担 80% 的任务：意图分类 + JSON 输出 + 闪卡 + 短文总结 + 润色
    └── 成本：¥0.0003/K Token（几乎为零）
    └── 死亡条件：百炼免费额度用尽 → 切硅基流动 qwen 分流

生命线 2：deepseek-v3（尖兵）
    └── 承担 15% 的任务：大纲生成 + 知识提炼 + 深度分析
    └── 成本：¥0.002/K Token
    └── 死亡条件：DS 高峰期宕机 → 8秒超时切百炼 qwen-plus

生命线 3：工具 API（外挂）
    └── 承担 5% 的任务：OCR + 搜索
    └── 成本：¥0.01-0.05/次
    └── 死亡条件：七牛云服务中断 → 降级为"无搜索模式"
```

### 3.3 免费版与付费版的体验差异感知设计

**关键设计**：不能让免费用户觉得"这东西不好用"，而是让他觉得"如果升级了会好用100倍"。

| 交互点 | 免费版体验 | Pro 版体验 | 感知差异 |
|:---|:---|:---|:---|
| 点击"运行" | 正常运行 | 正常运行 | 无差异 |
| 查看结果 | 正常展示 | 正常展示 | 无差异 |
| 大纲深度 | 3-5 个要点 | 8-12 个要点+子项 | **明显更深入** |
| 搜索结果 | 简单摘要 | 深度总结+来源评价 | **明显更专业** |
| 知识库问答 | "根据您的文档..." | "根据原文第3章第2节..." | **明显更精准** |
| 运行结束后 | "升级 Pro 获取更深度分析" | — | 自然引导 |

---

## 四、按量加购生态

### 4.1 加购价格矩阵

| 加购维度 | 加购单位 | 国内月付 (CNY) | 海外月付 (USD) | 折扣逻辑 |
|:---|:---|:---:|:---:|:---|
| **存储空间** | +1 GB | ¥1.0 | $0.5 | 基准价 |
| | +5 GB | ¥4.5 (省¥0.5) | $2.3 | 约9折 |
| | +10 GB | ¥8.5 (省¥1.5) | $4.5 | 约85折 |
| **工作流数量** | +5个 | ¥3.0 | $2.0 | 基准价 |
| | +10个 | ¥5.0 (省¥1.0) | $3.5 | 约83折 |
| | +20个 | ¥9.0 (省¥3.0) | $6.0 | 约75折 |
| **并发数量** | +1个 | ¥5.0 | $3.0 | 基准价 |
| | +3个 | ¥13.0 (省¥2.0) | $7.5 | 约87折 |
| | +5个 | ¥20.0 (省¥5.0) | $12.0 | 约8折 |

### 4.2 加购计费规则

1. **独立计费周期**：每个加购项有独立的续费日期
2. **主会员关联**：主会员过期时加购项同步失效
3. **续费恢复**：主会员续费后，系统提示"一键复购"加购项
4. **扣款宽限期**：扣款失败保留 3 天，连续 2 月失败自动取消
5. **配额即时生效**：加购成功后配额立即叠加，取消后即时收回

### 4.3 套餐 vs 加购的性价比对比

| 维度 | Pro 套餐包含 | 等价加购费用 | 套餐性价比 |
|:---|:---|:---:|:---|
| 3GB 存储 | ✅ 含 | ¥3 | 折合 ¥8.3/GB |
| 50个工作流 | ✅ 含 | ¥30 | 折合 ¥0.5/个 |
| 5个并发 | ✅ 含 | ¥25 | 折合 ¥5/个 |
| **合计价值** | — | **¥58** | 实际售价 **¥25**（**2.3 倍性价比**） |

> 营销话术："Pro 套餐 = 用 ¥25 买到 ¥58 的价值，比加购便宜一半以上！"

---

## 五、会员过期与数据保留机制

### 5.1 完整时间线

```
 Day 0       Day 1-7        Day 8-14       Day 15        Day 22
  │           │               │              │              │
  ▼           ▼               ▼              ▼              ▼
会员过期   宽限期            最后通知期     数据隐藏日     永久删除
  │      (可查看/下载)     (仅下载/删除)   (进入不可见)   (物理删除)
  │      续费=立即恢复      续费=立即恢复   联系客服可恢复  不可恢复
  │           │               │              │              │
  ├─邮件通知─┤  ├───每日弹窗───┤  ├──邮件通知──┤              │
```

### 5.2 各阶段行为限制

| 时间节点 | 状态 | 用户可操作 | 系统行为 |
|:---|:---|:---|:---|
| **过期当天** | 会员过期 | 可查看/下载/删除 | 第 1 次提醒邮件+站内通知 |
| | | ❌ 禁止新建工作流 | 新建按钮禁用 |
| | | ❌ 禁止上传文件 | 上传功能禁用 |
| **1-7天** | 宽限期 | 可查看/下载/删除 | 每日弹窗"距离数据删除还有X天" |
| | | ✅ 可随时续费恢复 | 续费后立即恢复全部功能 |
| **8-14天** | 最后通知期 | 可下载/删除 | 第 10 天第 2 次邮件提醒 |
| | | ❌ 不可上传新内容 | 界面显示删除倒计时 |
| **第15天** | 数据隐藏日 | 数据进入不可见状态 | 自动执行清理脚本 |
| | | 可联系客服申请恢复(7天内) | 数据标记"待删除"，物理删除延迟7天 |
| **第22天** | 永久删除 | **不可恢复** | 物理删除，释放存储 |

### 5.3 降级后的权益处理

| 维度 | 降级处理规则 |
|:---|:---|
| **存储空间** | 超出免费版额度(1GB)部分进入"只读模式"，用户需手动删除或重新付费 |
| **工作流数量** | 超出免费版上限(10个)的工作流保留但不可编辑，需删除到上限内才能新建 |
| **模型权限** | 立即降级到免费版模型路由（qwen-turbo + deepseek-v3） |
| **知识库检索** | 立即降级到仅摘要层 |
| **加购项** | 主会员过期时所有加购项同步失效 |

---

## 六、学生认证特权体系

> 完整方案详见 [vip-03-student-verification-plan](./vip-03-student-verification-plan.md)

### 6.1 核心特权

| 特权 | 说明 |
|------|------|
| **免费版满血体验** | 学生认证后，免费版可临时调用满血模型（日限 5 次） |
| **学期付资格** | 可购买学期付方案（约为年付的 40-50%） |
| **学生专属标识** | 头像角标 🎓，社区中增加可信度 |

### 6.2 学期付价格

| | Pro 学期付 | Pro+ 学期付 |
|:---|:---:|:---:|
| 国内 | ¥99-116/学期 | ¥299-349/学期 |
| 海外 | $40-50/学期 | $100-120/学期 |
| 对比月付 | 省 34-61% | 省 26-56% |

---

## 七、会员成长与留存策略

### 7.1 免费→Pro 转化漏斗

```
注册用户 (100%)
    │
    ├─ 使用 1 次工作流 (60%)
    │
    ├─ 使用 5 次工作流 (35%)
    │   └─ 触发"升级建议卡片"
    │
    ├─ 达到每日上限 1 次 (15%)
    │   └─ 触发"升级弹窗" + "¥1 试用 7 天"
    │
    └─ 转化为 Pro (目标 5-8%)
        └─ 首月 ¥3 优惠 或 ¥1 试用 7 天
```

### 7.2 留存策略

| 策略 | 触发条件 | 操作 |
|------|---------|------|
| **使用报告** | 每周一 | 发送"您的学习报告"邮件（工作流使用统计） |
| **续费折扣** | 到期前 3 天 | "立即续费享 9折" + "年付省 ¥101" |
| **流失召回** | 过期 3 天后 | "¥1 重新激活 7 天" 限时召回 |
| **里程碑奖励** | 连续使用 30 天 | 赠送 1GB 存储或 +5 工作流 |
| **社区荣誉** | 分享工作流模板 | Pro+ 专属"贡献者"角标 |

### 7.3 定价心理学

| 技巧 | 应用 |
|------|------|
| **锚定效应** | 原价 ¥30 → 现价 ¥25（划掉原价） |
| **损失厌恶** | "今日优惠即将结束" 倒计时 |
| **社会认同** | "已有 1,234 名学生选择 Pro" |
| **零风险** | "¥1 试用 7 天，不满意全额退款" |
| **年付锚点** | 年付 ¥199 (≈¥16.6/月) vs 月付 ¥25/月，明确显示"省 ¥101" |

---

## 八、数据库 Schema（会员核心表）

### 8.1 新增表总览

```
已有表（来自 PROJECT_PLAN.md §11）：
  ├── user_profiles          (需扩展 tier 字段)
  ├── workflows      (已有)
  ├── workflow_runs   (已有)
  └── ...

新增会员相关表：
  ├── subscriptions           (会员订阅记录)
  ├── addon_purchases         (加购项记录)
  ├── payment_records         (支付流水)
  ├── user_usage_daily        (每日用量统计)
  ├── tier_change_log         (等级变更日志)
  └── student_verifications   (学生认证记录)
```

### 8.2 subscriptions 表（会员订阅记录）

```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- 订阅信息
    tier TEXT NOT NULL CHECK (tier IN ('pro', 'pro_plus', 'ultra')),
    plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', 'yearly', 'semester')),
    currency TEXT NOT NULL DEFAULT 'CNY' CHECK (currency IN ('CNY', 'USD')),
    
    -- 金额
    amount DECIMAL(10, 2) NOT NULL,   -- 实际支付金额
    original_amount DECIMAL(10, 2),   -- 原价（用于显示折扣）
    
    -- 时间
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- 续费
    auto_renew BOOLEAN DEFAULT true,
    renew_failed_count INTEGER DEFAULT 0,     -- 续费失败次数
    last_renew_attempt_at TIMESTAMPTZ,
    
    -- 状态
    status TEXT DEFAULT 'active' 
        CHECK (status IN ('active', 'expired', 'cancelled', 'grace_period', 'pending_deletion')),
    
    -- 来源
    payment_provider TEXT,   -- 'stripe', 'alipay', 'wechat_pay'
    external_subscription_id TEXT,  -- 第三方订阅ID
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sub_user ON subscriptions(user_id);
CREATE INDEX idx_sub_status ON subscriptions(status);
CREATE INDEX idx_sub_expires ON subscriptions(expires_at);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
```

### 8.3 addon_purchases 表（加购项记录）

```sql
CREATE TABLE addon_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    
    -- 加购信息
    addon_type TEXT NOT NULL CHECK (addon_type IN ('storage', 'workflows', 'concurrent')),
    quantity INTEGER NOT NULL,        -- 加购数量（GB/个/个）
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'CNY',
    
    -- 时间
    started_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- 续费
    auto_renew BOOLEAN DEFAULT true,
    renew_failed_count INTEGER DEFAULT 0,
    
    -- 状态
    status TEXT DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'cancelled')),
    
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_addon_user ON addon_purchases(user_id);
ALTER TABLE addon_purchases ENABLE ROW LEVEL SECURITY;
```

### 8.4 payment_records 表（支付流水）

```sql
CREATE TABLE payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- 关联
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    addon_purchase_id UUID REFERENCES addon_purchases(id) ON DELETE SET NULL,
    
    -- 支付信息
    payment_type TEXT NOT NULL CHECK (payment_type IN (
        'subscription_new', 'subscription_renew', 'subscription_upgrade',
        'addon_new', 'addon_renew',
        'refund'
    )),
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'CNY',
    
    -- 第三方
    payment_provider TEXT NOT NULL,  -- 'stripe', 'alipay', 'wechat_pay'
    external_payment_id TEXT,        -- 第三方支付单号
    
    -- 状态
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    
    -- 发票
    invoice_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_user ON payment_records(user_id);
CREATE INDEX idx_payment_status ON payment_records(status);
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;
```

### 8.5 student_verifications 表

```sql
CREATE TABLE student_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    
    -- 认证信息
    school_name TEXT NOT NULL,
    student_id TEXT,                  -- 学号（可选，脱敏存储）
    edu_email TEXT,                   -- 教育邮箱
    graduation_year INTEGER,          -- 预计毕业年份
    
    -- 证明材料
    proof_type TEXT CHECK (proof_type IN ('edu_email', 'student_card', 'enrollment_letter')),
    proof_url TEXT,                   -- 上传的证明文件URL（对象存储）
    
    -- 审核
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    reviewed_by TEXT,                 -- 审核人（admin ID 或 'system'）
    review_note TEXT,                 -- 审核备注
    reviewed_at TIMESTAMPTZ,
    
    -- 有效期
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,           -- 默认到预计毕业年份
    
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_student_user ON student_verifications(user_id);
ALTER TABLE student_verifications ENABLE ROW LEVEL SECURITY;
```

### 8.6 user_profiles 表扩展（汇总）

```sql
-- 在现有的共享表 user_profiles 基础上新增
ALTER TABLE user_profiles ADD COLUMN tier TEXT DEFAULT 'free' 
    CHECK (tier IN ('free', 'pro', 'pro_plus', 'ultra'));
ALTER TABLE user_profiles ADD COLUMN tier_expires_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN is_student_verified BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN student_verified_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN storage_used_bytes BIGINT DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN preferred_currency TEXT DEFAULT 'CNY' 
    CHECK (preferred_currency IN ('CNY', 'USD'));
```

---

## 九、前端会员 UI 设计规范

### 9.1 定价页面 (/pricing)

```
╔══════════════════════════════════════════════════════════════════╗
║                    🎯 选择适合您的方案                             ║
║              月付    [年付（省¥101）]     学期付                    ║
╠═════════════╤═════════════╤══════════════╤═══════════════════════╣
║  🆓 免费    │  💎 Pro     │  💠 Pro+     │  👑 Ultra             ║
║  ¥0/月     │  ¥25/月     │  ¥79/月      │  ¥1299/月             ║
║  ──────    │  原价¥30    │              │                       ║
║  10个工作流 │  50个工作流  │  200个工作流   │  无限制               ║
║  1GB存储   │  3GB存储     │  10GB存储     │  100GB存储            ║
║  基础模型   │  满血模型    │  满血+深搜    │  全旗舰               ║
║  日20次    │  日50次      │  日150次      │  日500次              ║
║            │  ¥1试用7天   │              │                       ║
║  [当前方案] │  [立即升级]  │  [立即升级]   │  [联系我们]            ║
╚═════════════╧═════════════╧══════════════╧═══════════════════════╝
```

### 9.2 资源仪表盘（会员中心 /settings/membership）

```
╔══════════════════════════════════════════════════╗
║  当前套餐：Pro版（剩余23天）  [管理订阅]          ║
╠══════════════════════════════════════════════════╣
║  存储空间：2.8GB/8GB  ▪▪▪▪▪▪▪▫▫▫  35%          ║
║  工作流：  48/55个    ▪▪▪▪▪▪▪▪▪▫  87% ⚠️       ║
║  并发运行：2/5个      ▪▪▪▪▫▫▫▫▫▫  40%          ║
║  今日执行：23/50次    ▪▪▪▪▪▫▫▫▫▫  46%          ║
╠══════════════════════════════════════════════════╣
║  已购加购项：                                      ║
║  ├─ +5GB 存储（自动续费）      剩余23天           ║
║  └─ +5个工作流（自动续费）     剩余23天           ║
║                                                  ║
║  [管理加购项]  [加购更多]  [升级套餐]              ║
╚══════════════════════════════════════════════════╝
```

### 9.3 升级引导 UI

在以下场景自然植入升级引导：

| 场景 | UI元素 | 文案 |
|:---|:---|:---|
| 工作流运行结果页 | 底部卡片 | "深度分析需要 Pro 版满血模型 → 升级" |
| 知识库检索 | 结果标注 | "摘要层回答。升级 Pro 解锁精准原文定位" |
| 搜索结果 | 对比卡片 | "基础搜索 3 条结果 vs Pro 深度搜索 10+ 条" |
| 配额耗尽 | 弹窗 | "今日已用完。¥1 试用 Pro 7 天" |
| 新功能入口 | 锁定icon | "🔒 此功能需要 Pro+ 会员" |

---

## 十、盈利预测模型

### 10.1 用户增长假设（MVP 发布后 6 个月）

| 月份 | 注册用户 | DAU | Free→Pro 转化率 | 付费用户 | MRR (¥) |
|:---:|:---:|:---:|:---:|:---:|:---:|
| M1 | 200 | 50 | 3% | 6 | 150 |
| M2 | 500 | 120 | 4% | 20 | 500 |
| M3 | 1,000 | 250 | 5% | 50 | 1,250 |
| M4 | 2,000 | 450 | 5% | 100 | 2,500 |
| M5 | 3,500 | 700 | 6% | 210 | 5,250 |
| M6 | 5,000 | 1,000 | 7% | 350 | **8,750** |

### 10.2 成本结构（M6 预估）

| 成本项 | 月度费用 |
|:---|:---:|
| 阿里云 ECS | ¥300 |
| Supabase Pro | $25 ≈ ¥180 |
| AI API 成本 | ¥4,000（详见02文档） |
| 域名 + SSL | ¥50 |
| 邮件推送 | ¥50 |
| **总计** | **¥4,580** |

### 10.3 M6 损益

```
收入：MRR ¥8,750 + 加购 ¥500 ≈ ¥9,250
成本：¥4,580
──────────────
毛利：¥4,670（毛利率 50.5%）
```

> **结论**：在 5,000 注册用户（350 付费）规模下即可实现月度盈利，API 成本占比约 43%。

---

## 十一、ACTION ITEMS

| 优先级 | 任务 | 涉及文件/服务 | 备注 |
|:---|:---|:---|:---|
| **P0** | 数据库建表（subscriptions, addon_purchases, payment_records） | Supabase SQL | 会员核心 |
| **P0** | user_profiles 表扩展 tier 字段 | Supabase SQL | 路由依赖 |
| **P0** | 后端订阅 CRUD API | `backend/app/api/subscription.py` | 与支付集成 |
| **P1** | 前端定价页 (/pricing) | `frontend/src/app/pricing/` | 转化关键页 |
| **P1** | 前端会员中心 (/settings/membership) | `frontend/src/app/(dashboard)/settings/` | 用户自助管理 |
| **P1** | 支付集成（支付宝/微信/Stripe） | `backend/app/services/payment/` | 见 vip-02 |
| **P1** | 会员过期处理定时任务 | `backend/app/tasks/subscription_expiry.py` | Cron Job |
| **P2** | 学生认证系统 | `backend/app/api/student.py` | 见 vip-03 |
| **P2** | 加购项管理页面 | `frontend/src/app/(dashboard)/settings/addons/` | — |
| **P2** | 升级引导组件库 | `frontend/src/components/upgrade/` | 转化优化 |
| **P3** | 留存策略定时邮件 | `backend/app/tasks/retention.py` | 周报+召回 |
| **P3** | 管理后台会员概览 | `frontend/src/app/(admin)/memberships/` | 运营看板 |

---

> **一句话总结**：四级会员体系（Free→Pro→Pro+→Ultra）以"免费版要好用、Pro 是甜点、加购是粘性"为核心策略，免费版采用 Qwen+DeepSeek 极简三角矩阵将单次成本压至 ¥0.025，配合学生认证、学期付、按量加购等差异化定价，目标 M6 达到 350 付费用户、MRR ¥8,750、毛利率 50%+。
