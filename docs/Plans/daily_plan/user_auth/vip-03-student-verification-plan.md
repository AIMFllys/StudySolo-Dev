# StudySolo 学生认证与特权方案 · 实施指南

> 📅 创建日期：2026-02-27  
> 📌 所属模块：user_auth · VIP 会员  
> 🔗 关联文档：[vip-01-会员体系设计](./vip-01-membership-system-design.md) · [02-user-tier-routing-strategy](./02-user-tier-routing-strategy.md) · [工作流AI交互规划](../core/工作流AI交互规划.md)  
> 🎯 定位：**StudySolo 学生用户认证流程、特权体系、学期付方案、防作弊策略的完整实施指南**

---

## 📑 目录

- [一、学生认证的战略意义](#一学生认证的战略意义)
- [二、认证方式与流程](#二认证方式与流程)  
- [三、学生特权体系](#三学生特权体系)
- [四、学期付方案设计](#四学期付方案设计)
- [五、防作弊与风控](#五防作弊与风控)
- [六、数据库与 API](#六数据库与-api)
- [七、前端 UI 设计](#七前端-ui-设计)
- [八、ACTION ITEMS](#八action-items)

---

## 一、学生认证的战略意义

### 1.1 为什么做学生认证？

StudySolo 的核心用户画像就是**在校学生**（大学生、研究生）。学生认证不仅是产品差异化的关键，更是商业策略的核心：

| 维度 | 价值 |
|------|------|
| **用户获取** | "学生免费用满血模型" 是极强的拉新口号 |
| **口碑传播** | 学生群体的社交传播力最强（宿舍→班级→院系） |
| **付费转化** | 免费体验满血后 → 毕业/深度需求时 → 天然转化为付费用户 |
| **品牌形象** | "为学生党打造" 的定位增加品牌温度 |
| **数据资产** | 学生群体的使用数据为产品迭代提供精准方向 |

### 1.2 核心理念

> **让学生先爽到，未来自然会付费。**

学生认证的设计目标不是"卡住学生"，而是"让学生觉得这个产品懂他们"。通过学生认证获得的满血体验，会在学生群体中形成自发的口碑传播效应。

---

## 二、认证方式与流程

### 2.1 三种认证方式

| 方式 | 说明 | 自动化 | 可信度 | 推荐度 |
|:---|:---|:---:|:---:|:---:|
| **教育邮箱验证** | 用 .edu.cn / .edu 邮箱接收验证码 | ✅ 全自动 | ⭐⭐⭐⭐ | P0 首选 |
| **学生证照片** | 上传学生证正面照片 | ❌ 人工审核 | ⭐⭐⭐⭐⭐ | P1 补充 |
| **在读证明** | 上传学信网在读证明 PDF | ❌ 人工审核 | ⭐⭐⭐⭐⭐ | P1 补充 |

### 2.2 方式一：教育邮箱验证（首选，全自动）

```
用户进入 /settings/student-verify
    │
    ├─ 输入教育邮箱：例如 zhangsan@mail.tsinghua.edu.cn
    │
    ▼
前端 POST /api/student/verify/email
    │
    ├─ 后端检查邮箱后缀是否在白名单（.edu.cn / .edu / 指定高校列表）
    │   ├─ 不在白名单 → 返回 "该邮箱不在教育邮箱列表中，请使用其他方式认证"
    │   └─ 在白名单 → 继续
    │
    ├─ 生成 6 位验证码 + 10 分钟有效期
    │
    ├─ 通过 DirectMail 发送验证码到教育邮箱
    │
    ▼
用户查看教育邮箱 → 输入验证码
    │
    ▼
前端 POST /api/student/verify/confirm
    │
    ├─ 后端校验验证码
    ├─ 创建 student_verifications 记录（status: 'approved'）
    ├─ 更新 user_profiles.is_student_verified = true
    ├─ 设置有效期（预计毕业年份 or 1年）
    │
    ▼
认证成功！🎓
    └─ 立即解锁学生特权
```

### 2.3 教育邮箱后缀白名单

```python
# 中国高校教育邮箱后缀（部分示例）
EDU_EMAIL_SUFFIXES = [
    # 通用教育域
    ".edu.cn",
    ".edu",
    ".ac.cn",
    
    # 特殊高校域名
    "@tsinghua.edu.cn",
    "@pku.edu.cn",
    "@zju.edu.cn",
    "@fudan.edu.cn",
    "@sjtu.edu.cn",
    "@nju.edu.cn",
    "@hit.edu.cn",
    "@hust.edu.cn",
    "@whu.edu.cn",
    "@scut.edu.cn",
    # ... 更多高校
    
    # 海外教育域
    ".edu",
    ".ac.uk",
    ".ac.jp",
    ".edu.au",
]

def is_edu_email(email: str) -> bool:
    """检查是否为教育邮箱"""
    email = email.lower().strip()
    return any(email.endswith(suffix) for suffix in EDU_EMAIL_SUFFIXES)
```

### 2.4 方式二：学生证照片验证（人工审核）

适用于没有教育邮箱的用户（部分高校不提供学生邮箱）：

```
用户上传学生证正面照片
    │
    ├─ 前端引导拍照：
    │   "请拍摄学生证正面，确保姓名、学校、有效期清晰可见"
    │   "个人隐私：身份证号等敏感信息可以遮挡"
    │
    ├─ 图片上传到对象存储（私有 bucket，仅审核人员可见）
    │
    ├─ 创建 student_verifications 记录（status: 'pending'）
    │
    ├─ 通知管理员审核（邮件 + 管理后台推送）
    │
    ▼
管理员审核（管理后台 /admin/student-verifications）
    │
    ├─ 查看学生证照片
    ├─ 确认信息真实性
    ├─ 输入学校名称、预计毕业年份
    │
    ├─ 批准 → status: 'approved' → 解锁特权
    └─ 拒绝 → status: 'rejected' → 通知用户 + 说明原因
```

### 2.5 认证有效期管理

| 认证方式 | 初始有效期 | 续期方式 |
|:---|:---|:---|
| 教育邮箱 | 到预计毕业年份 6 月 30 日 | 重新发送验证邮件 |
| 学生证照片 | 到学生证上的有效期 | 重新上传新学年学生证 |
| 在读证明 | 到证明中的预计毕业日期 | 重新上传 |

> **过期处理**：
> - 过期前 30 天：邮件 + 站内弹窗提醒"学生认证即将过期"
> - 过期当天：is_student_verified = false，学生特权收回
> - 可随时重新认证

---

## 三、学生特权体系

### 3.1 免费版学生特权

| 特权 | 未认证 Free | 认证后 Free 🎓 | 说明 |
|:---|:---:|:---:|:---|
| AI 模型等级 | 基础 (qwen-turbo) | **临时满血** (deepseek-r1, kimi) | 每日限 5 次满血调用 |
| 每日执行上限 | 20 次 | **25 次** | 多送 5 次 |
| 联网搜索 | 仅基础 | **百度搜索+总结** | 升级到一般搜索 |
| 知识库检索 | 仅摘要层 | 仅摘要层 | 不变 |
| 学期付资格 | ❌ | ✅ | 可购买学期付方案 |
| 社区标识 | 无 | 🎓 学生角标 | 头像旁显示 |

**核心设计**："每日 5 次满血"的含义：

```python
# 学生认证 Free 用户的模型路由逻辑
async def route_for_student_free(task_type: str, user: User):
    today_premium_uses = await count_premium_uses_today(user.id)
    
    if today_premium_uses < 5:
        # 前 5 次使用满血模型（等同 Pro 版路由）
        return get_pro_model(task_type)
    else:
        # 超过 5 次后回到普通 Free 路由
        return get_free_model(task_type)
```

### 3.2 学期付专享方案

| | Pro 学期付 | Pro+ 学期付 |
|:---|:---:|:---:|
| 学期定义 | 5 个月（一个学期约 20 周） | 5 个月 |
| 国内价格 | **¥99** (折合 ¥19.8/月) | **¥299** (折合 ¥59.8/月) |
| vs 月付 | 省 ¥26 (月付 ¥25×5=¥125) | 省 ¥96 (月付 ¥79×5=¥395) |
| vs 年付 | 学期更灵活 | 学期更灵活 |
| 海外价格 | **$40** (折合 $8/月) | **$100** (折合 $20/月) |
| 购买条件 | 需学生认证 | 需学生认证 |

> **学期付的商业智慧**：
> - 比月付便宜 → 学生愿意付
> - 比年付灵活 → 每学期重新决策，不怕浪费
> - 5 个月到期正好是学期末 → 下学期开学前自然触发续费

### 3.3 学生毕业后的过渡

```
毕业年份到达（学生认证过期）
    │
    ├─ 30 天前：邮件通知"您的学生认证即将过期"
    │           "毕业快乐！🎓 感谢您使用 StudySolo"
    │           "为您准备了毕业优惠：首年 Pro 学生特价 ¥199"
    │
    ├─ 过期当天：
    │   ├─ is_student_verified = false
    │   ├─ 学生特权收回（满血次数、学期付资格）
    │   ├─ 但如果有正在进行的学期付订阅 → 订阅到期前不受影响
    │   └─ 推送"校友专享"续费折扣
    │
    └─ 过期后 90 天内：
        └─ "校友回归" 特价：首月 Pro ¥15（正价 ¥25）
```

---

## 四、学期付方案设计

### 4.1 学期时间划分

| 学期 | 起止月份 | 天数 | 推荐购买时间 |
|:---|:---|:---:|:---|
| 春季学期 | 2月15日 - 7月15日 | ~150天 | 开学第一周 |
| 秋季学期 | 8月25日 - 1月25日 | ~153天 | 开学第一周 |

> 学期付的实际有效期统一为 **150 天（5个月）**，从购买日开始计算，不与自然学期严格对齐。

### 4.2 学期付与月付的切换

| 场景 | 处理方式 |
|:---|:---|
| 正在月付 → 切换学期付 | 按月付剩余天数折算抵扣 |
| 学期付到期 → 不续费 | 降级为 Free + 学生认证 |
| 学期付到期 → 续费学期付 | 全价 ¥99 续费下一个学期 |
| 学期付到期 → 改月付 | 按正常月付价格（¥25/月） |

### 4.3 学期付的自动续费

- 学期付默认**不开启自动续费**（因为学期结束可能不需要续费）
- 到期前 7 天发送提醒："新学期要开始了！续费学期付 ¥99"
- 提供"一键续费"按钮

---

## 五、防作弊与风控

### 5.1 常见作弊手段与应对

| 作弊手段 | 应对策略 |
|:---|:---|
| **冒用他人教育邮箱** | 验证码发送到该邮箱，必须查看真实邮箱 |
| **伪造学生证照片** | 人工审核 + OCR 辅助校验（学校名、有效期） |
| **毕业后继续使用** | 有效期管理，过期自动收回 |
| **教职工冒充学生** | 教职工也可使用教育邮箱优惠（这实际上是好事，扩大用户群） |
| **同一邮箱多账号** | 一个教育邮箱只能绑定一个 StudySolo 账号 |
| **临时教育邮箱** | 维护黑名单（如 guerrillamail 等临时邮箱域名） |

### 5.2 风控规则

```python
STUDENT_VERIFICATION_RULES = {
    # 每个教育邮箱最多绑定 1 个账号
    "max_accounts_per_edu_email": 1,
    
    # 每个用户每天最多发送 3 次验证码
    "max_verify_attempts_per_day": 3,
    
    # 验证码有效期
    "code_expiry_minutes": 10,
    
    # 照片审核超时自动拒绝（天数）
    "photo_review_timeout_days": 7,
    
    # 认证最长有效期（年）
    "max_verification_years": 6,  # 本科4年+硕士2年
    
    # 拒绝后冷却期（天数）
    "rejection_cooldown_days": 7,
    
    # 临时邮箱黑名单
    "email_blacklist": [
        "guerrillamail.com", "tempmail.com", "throwaway.email",
        "mailinator.com", "yopmail.com"
    ]
}
```

### 5.3 审核效率

| 指标 | 目标 |
|:---|:---|
| 教育邮箱认证 | **即时**（全自动） |
| 照片审核 | **24 小时内**（工作日） |
| 审核通过率 | 预期 >90% |
| 拒绝原因分布 | ~60% 照片模糊, ~20% 已过期, ~20% 信息不完整 |

---

## 六、数据库与 API

### 6.1 数据表（已在 vip-01 中定义）

- `student_verifications` 表：存储认证记录
- `user_profiles.is_student_verified`：快速查询状态

### 6.2 API 端点

```python
# backend/app/api/student.py

# === 学生认证 ===
POST   /api/student/verify/email          # 发送教育邮箱验证码
POST   /api/student/verify/confirm        # 确认验证码
POST   /api/student/verify/upload-proof   # 上传学生证照片
GET    /api/student/verify/status         # 查看认证状态

# === 管理员审核（需 admin 权限） ===
GET    /api/admin/student-verifications          # 获取待审核列表
POST   /api/admin/student-verifications/{id}/approve  # 批准
POST   /api/admin/student-verifications/{id}/reject   # 拒绝
```

### 6.3 关键 API 实现

```python
# backend/app/api/student.py

@router.post("/api/student/verify/email")
async def send_edu_verification(
    request: EduVerifyRequest,    # { edu_email: str }
    user = Depends(get_current_user)
):
    """发送教育邮箱验证码"""
    email = request.edu_email.lower().strip()
    
    # 1. 检查是否为教育邮箱
    if not is_edu_email(email):
        raise HTTPException(400, "请使用 .edu.cn 或 .edu 等教育邮箱")
    
    # 2. 检查黑名单
    if is_blacklisted_email(email):
        raise HTTPException(400, "该邮箱域名不被接受")
    
    # 3. 检查是否已被其他账号绑定
    existing = await find_verified_by_email(email)
    if existing and existing.user_id != user.id:
        raise HTTPException(409, "该教育邮箱已被其他账号使用")
    
    # 4. 检查今日发送次数
    today_attempts = await count_today_verify_attempts(user.id)
    if today_attempts >= 3:
        raise HTTPException(429, "今日验证次数已达上限，请明日重试")
    
    # 5. 生成验证码
    code = generate_six_digit_code()
    await save_verification_code(user.id, email, code, ttl_minutes=10)
    
    # 6. 发送邮件
    await email_service.send_student_verification(email, code)
    
    return {"message": "验证码已发送至您的教育邮箱，10分钟内有效"}


@router.post("/api/student/verify/confirm")
async def confirm_edu_verification(
    request: ConfirmRequest,    # { edu_email: str, code: str, graduation_year: int }
    user = Depends(get_current_user)
):
    """确认教育邮箱验证码"""
    
    # 1. 校验验证码
    if not await verify_code(user.id, request.edu_email, request.code):
        raise HTTPException(400, "验证码错误或已过期")
    
    # 2. 提取学校名称（从邮箱域名匹配）
    school_name = extract_school_name(request.edu_email)
    
    # 3. 计算有效期
    graduation_date = datetime(request.graduation_year, 6, 30)
    if graduation_date < datetime.now():
        raise HTTPException(400, "毕业年份不能是过去")
    if graduation_date > datetime.now() + timedelta(days=365*6):
        raise HTTPException(400, "毕业年份超出合理范围")
    
    # 4. 创建认证记录
    verification = await create_verification(
        user_id=user.id,
        school_name=school_name,
        edu_email=request.edu_email,
        graduation_year=request.graduation_year,
        proof_type="edu_email",
        status="approved",
        verified_at=datetime.now(),
        expires_at=graduation_date
    )
    
    # 5. 更新用户状态
    await update_user_student_status(user.id, True)
    
    # 6. 记录日志
    await log_tier_change(user.id, "none", "student_verified", reason="edu_email_verification")
    
    return {
        "message": "学生认证成功！🎓",
        "school": school_name,
        "expires_at": graduation_date.isoformat(),
        "privileges": get_student_privileges_description()
    }
```

---

## 七、前端 UI 设计

### 7.1 学生认证入口

在 /settings 页面新增"学生认证"卡片：

```
╔══════════════════════════════════════════════════╗
║  🎓 学生认证                                      ║
║  ────────────────────────────────────────────     ║
║  认证后可享受：                                     ║
║  · 每日 5 次满血模型调用                              ║
║  · 学期付特价方案（Pro ¥99/学期）                     ║
║  · 专属学生角标                                     ║
║                                                  ║
║  [开始认证 →]                                      ║
╚══════════════════════════════════════════════════╝
```

### 7.2 认证流程页面

```
╔══════════════════════════════════════════════════╗
║  🎓 学生认证                                      ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  选择认证方式：                                     ║
║                                                  ║
║  ┌────────────────────────────────────────────┐  ║
║  │  📧 教育邮箱验证（推荐，即时通过）              │  ║
║  │  使用 .edu.cn 或 .edu 教育邮箱                │  ║
║  │                                              │  ║
║  │  教育邮箱：[________________@edu.cn]         │  ║
║  │  预计毕业年份：[2028 ▼]                       │  ║
║  │                                              │  ║
║  │  [发送验证码]                                 │  ║
║  └────────────────────────────────────────────┘  ║
║                                                  ║
║  ── 或 ──                                        ║
║                                                  ║
║  ┌────────────────────────────────────────────┐  ║
║  │  📸 上传学生证（1-3个工作日审核）               │  ║
║  │                                              │  ║
║  │  [点击上传学生证照片]                          │  ║
║  │  提示：请确保姓名和有效期清晰可见               │  ║
║  └────────────────────────────────────────────┘  ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```

### 7.3 认证成功状态

```
╔══════════════════════════════════════════════════╗
║  🎓 学生认证  ✅ 已认证                            ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  学校：清华大学                                    ║
║  认证方式：教育邮箱                                 ║
║  认证日期：2026-02-27                             ║
║  有效期至：2028-06-30                              ║
║                                                  ║
║  当前特权：                                       ║
║  ✅ 每日满血模型：3/5 次已使用                       ║
║  ✅ 学期付资格：可用                                ║
║  ✅ 学生角标：已启用                                ║
║                                                  ║
║  [查看学期付优惠 →]  [管理认证]                     ║
╚══════════════════════════════════════════════════╝
```

### 7.4 管理后台审核界面

```
╔══════════════════════════════════════════════════════════════╗
║  待审核学生认证  (3 条待处理)                                    ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  #1  zhangsan@example.com                                    ║
║      认证方式：学生证照片                                       ║
║      提交时间：2小时前                                          ║
║      [查看照片]  学校：[________]  毕业年份：[____]             ║
║      [✅ 批准]  [❌ 拒绝] 拒绝原因：[____________]              ║
║  ─────────────────────────────────────────────────           ║
║  #2  lisi@example.com                                        ║
║      ...                                                     ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 八、ACTION ITEMS

| 优先级 | 任务 | 涉及文件 | 备注 |
|:---|:---|:---|:---|
| **P1** | 教育邮箱白名单数据库 | `backend/app/data/edu_domains.json` | 收集国内+海外高校域名 |
| **P1** | 教育邮箱验证 API | `backend/app/api/student.py` | 全自动流程 |
| **P1** | 验证码发送（复用 DirectMail） | `backend/app/services/email_service.py` | 新增学生认证邮件模板 |
| **P1** | 前端学生认证页面 | `frontend/src/app/(dashboard)/settings/student/` | — |
| **P2** | 学生证照片上传 + 审核流程 | 对象存储 + 管理后台 | 需配置文件存储 |
| **P2** | 管理后台审核界面 | `frontend/src/app/(admin)/student-verifications/` | — |
| **P2** | 满血次数路由逻辑 | `backend/app/services/ai_router.py` | 学生 Flag 判断 |
| **P2** | 学期付支付集成 | `backend/app/api/payment.py` | 新增 plan_type=semester |
| **P3** | 认证过期自动处理 Cron | `backend/app/tasks/student_expiry.py` | 每日检查 |
| **P3** | 毕业优惠营销邮件 | `backend/app/tasks/retention.py` | 毕业前 30 天触发 |

---

> **一句话总结**：教育邮箱全自动验证（P0，即时通过）+ 学生证照片人工审核（P1，补充），认证后免费版解锁每日 5 次满血模型 + 学期付资格（Pro ¥99/学期），有效期到预计毕业年份，过期后温和降级 + 校友回归折扣。学生认证是 StudySolo 获取核心用户群（在校学生）的战略性功能。
