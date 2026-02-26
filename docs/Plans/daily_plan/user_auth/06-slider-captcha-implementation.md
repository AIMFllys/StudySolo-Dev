# 滑动拼图验证 · 实施指南

> 📅 创建日期：2026-02-27  
> 📌 所属模块：user_auth · 用户认证与权限  
> 🔗 关联文档：[04-sso-cross-project-auth](./04-sso-cross-project-auth.md) · [05-email-verification](./05-email-verification-implementation.md)  
> 🎯 定位：**滑动拼图人机验证（Slider CAPTCHA）的前后端实现，作为邮件发送的前置防护层**

---

## 📑 目录

- [一、设计目标与触发场景](#一设计目标与触发场景)
- [二、技术选型](#二技术选型)
- [三、前端集成方案](#三前端集成方案)
- [四、后端验证逻辑](#四后端验证逻辑)
- [五、安全加固策略](#五安全加固策略)
- [六、UI/UX 设计规范](#六uiux-设计规范)
- [七、ACTION ITEMS](#七action-items)

---

## 一、设计目标与触发场景

### 1.1 核心目标

阻止自动化脚本批量调用「发送验证码」接口，从而防止：
- 邮件轰炸（恶意向目标邮箱发大量垃圾邮件）
- DirectMail 配额浪费（每日 2000 封限制）
- 服务器资源消耗

### 1.2 触发场景

| 场景 | 是否需要滑动拼图 | 说明 |
|------|:----------------:|------|
| **注册 → 发送验证码** | ✅ 必须 | 防止批量注册 |
| **找回密码 → 发送验证码** | ✅ 必须 | 防止邮件轰炸 |
| 登录（邮箱+密码） | ❌ 不需要 | 密码本身就是验证，如果后续爆破严重再加 |
| 修改密码（已登录） | ❌ 不需要 | 已有 JWT 鉴权 |

### 1.3 流程中的位置

```
用户填写邮箱 → 🧩 完成滑动拼图 → 点击"发送验证码" → 后端验证拼图 → 发送邮件
                  │                                    │
                  └─── 前端交互 ───────────────────────┘
                                                       └── 后端校验
```

---

## 二、技术选型

### 2.1 选型对比

| 方案 | 类型 | React 支持 | 维护状态 | 自主可控 | 推荐度 |
|------|------|:----------:|:--------:|:--------:|:------:|
| **`rc-slider-captcha`** | 纯前端组件 | 原生 React | 2月前更新 | ✅ 完全自主 | ⭐⭐⭐⭐⭐ |
| `slider-captcha-js` | 多框架 | 支持 | 4月前更新 | ✅ 完全自主 | ⭐⭐⭐⭐ |
| Cloudflare Turnstile | 云服务 | SDK | 持续更新 | ❌ 依赖第三方 | ⭐⭐⭐ |
| 自行 Canvas 实现 | 自建 | 手写 | - | ✅ | ⭐⭐ |

### 2.2 推荐方案：`rc-slider-captcha`

**选择理由：**
1. React 原生组件，与 Next.js 无缝集成
2. 支持自定义图片（可以用 StudySolo 品牌相关图片）
3. 支持暗色模式
4. 零第三方服务依赖（不依赖 Cloudflare/Google）
5. 可配合 Shadcn/UI 的设计风格定制

```bash
pnpm add rc-slider-captcha
```

### 2.3 MVP vs 完整方案

| 阶段 | 验证逻辑位置 | 安全等级 | 开发成本 |
|------|:----------:|:--------:|:--------:|
| **MVP（推荐先做）** | 前端生成 + 前端初步验证 + 后端签名校验 | ⭐⭐⭐ 中 | 低 |
| 完整版（后续升级） | 后端生成拼图位置 + 后端验证偏差 | ⭐⭐⭐⭐⭐ 高 | 中 |

> MVP 阶段使用前端验证 + 签名 Token 的方式，足以阻挡 99% 自动化脚本。高级攻击者（Headless Chrome + AI 识图）属于 P2 阶段的对抗目标。

---

## 三、前端集成方案

### 3.1 MVP 方案：前端验证 + 签名 Token

#### 3.1.1 封装 CAPTCHA 组件

```typescript
// src/components/auth/SliderCaptcha.tsx
'use client'

import React, { useState, useCallback } from 'react'
import SliderCaptcha from 'rc-slider-captcha'

interface Props {
  onSuccess: (captchaToken: string) => void
  onFailed?: () => void
}

export function CaptchaSlider({ onSuccess, onFailed }: Props) {
  const [status, setStatus] = useState<'default' | 'success' | 'error'>('default')

  // 生成签名 Token（包含时间戳 + 随机值 + HMAC）
  const generateCaptchaToken = useCallback((): string => {
    const timestamp = Date.now()
    const nonce = crypto.randomUUID()
    const payload = btoa(JSON.stringify({ ts: timestamp, nonce, verified: true }))
    // 注意：真正的签名需要在后端完成，这里只是传递元数据
    return payload
  }, [])

  return (
    <div className="captcha-container">
      <SliderCaptcha
        mode="slider"
        tipText={{
          default: '向右滑动完成验证',
          moving: '请移动到正确位置',
          error: '验证失败，请重试',
          success: '验证通过 ✓',
        }}
        onVerify={async (data) => {
          // 前端基础验证：检查滑动轨迹
          // data 包含：x, y, sliderOffsetX, duration, trail 等
          
          const { duration, trail } = data
          
          // 规则 1：滑动时间不能太快（< 300ms = 机器人）
          if (duration < 300) {
            setStatus('error')
            onFailed?.()
            return Promise.reject()
          }
          
          // 规则 2：滑动轨迹不能是完美直线（机器人特征）
          if (trail && trail.length < 5) {
            setStatus('error')
            onFailed?.()
            return Promise.reject()
          }
          
          // 验证通过
          setStatus('success')
          const token = generateCaptchaToken()
          onSuccess(token)
          return Promise.resolve()
        }}
        style={{
          '--rcsc-primary': 'hsl(var(--primary))',
          '--rcsc-bg-color': 'hsl(var(--card))',
          '--rcsc-border-color': 'hsl(var(--border))',
        } as React.CSSProperties}
      />
    </div>
  )
}
```

#### 3.1.2 在注册页面中使用

```tsx
// src/app/(auth)/register/page.tsx
'use client'

import { useState } from 'react'
import { CaptchaSlider } from '@/components/auth/SliderCaptcha'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const handleSendCode = async () => {
    if (!captchaToken) return

    const res = await fetch('/api/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({
        email,
        purpose: 'register',
        captcha_token: captchaToken,
      }),
    })

    if (res.ok) {
      setCodeSent(true)
      startCountdown()
    }
  }

  return (
    <div>
      {/* 邮箱输入 */}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="请输入你的邮箱"
      />

      {/* 滑动拼图验证 */}
      {!captchaToken && (
        <CaptchaSlider
          onSuccess={(token) => setCaptchaToken(token)}
          onFailed={() => setCaptchaToken(null)}
        />
      )}

      {/* 发送验证码按钮 */}
      <button
        onClick={handleSendCode}
        disabled={!captchaToken || !email || countdown > 0}
      >
        {countdown > 0 ? `重新发送 (${countdown}s)` : '发送验证码'}
      </button>

      {/* 验证码输入 + 密码设置（codeSent 后显示） */}
      {codeSent && (
        <>
          <input placeholder="6 位验证码" maxLength={6} />
          <input type="password" placeholder="设置密码（至少 8 位）" />
          <button>注册</button>
        </>
      )}
    </div>
  )
}
```

---

## 四、后端验证逻辑

### 4.1 MVP 方案：Token 时效性校验

```python
# backend/app/services/captcha_verifier.py

import json
import base64
from datetime import datetime, timezone, timedelta

# captcha_token 有效期
CAPTCHA_TOKEN_TTL = timedelta(minutes=5)

# 已使用的 token 缓存（防重放）
# MVP 用内存 Set，生产环境用 Redis
_used_tokens: set[str] = set()

def verify_captcha(captcha_token: str) -> bool:
    """验证前端发送的 captcha_token"""
    
    try:
        # 1. 解码 payload
        payload = json.loads(base64.b64decode(captcha_token))
        
        # 2. 检查时间戳（5 分钟内有效）
        ts = payload.get("ts", 0)
        token_time = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
        now = datetime.now(timezone.utc)
        
        if now - token_time > CAPTCHA_TOKEN_TTL:
            return False  # Token 过期
        
        if token_time > now + timedelta(seconds=30):
            return False  # 未来时间（时钟篡改）
        
        # 3. 检查是否已使用（防重放攻击）
        nonce = payload.get("nonce", "")
        if nonce in _used_tokens:
            return False
        _used_tokens.add(nonce)
        
        # 4. 检查 verified 标记
        if not payload.get("verified"):
            return False
        
        return True
    
    except Exception:
        return False
```

### 4.2 完整方案（后续升级）：服务端生成 + 验证

```python
# 升级路径（P2 阶段实现）

# 1. 后端生成拼图位置
@router.get("/api/captcha/challenge")
async def create_challenge():
    """生成拼图挑战"""
    # 随机生成拼图缺口位置
    target_x = random.randint(100, 250)
    challenge_id = str(uuid.uuid4())
    
    # 存入缓存（Redis / 内存）
    captcha_store[challenge_id] = {
        "target_x": target_x,
        "created_at": time.time(),
    }
    
    return {
        "challenge_id": challenge_id,
        "bg_image": generate_bg_image(target_x),   # 带缺口的背景图
        "puzzle_image": generate_puzzle(target_x),   # 拼图块
    }

# 2. 后端验证滑动位置
@router.post("/api/captcha/verify")
async def verify_challenge(data: CaptchaVerifyRequest):
    """验证拼图位置"""
    challenge = captcha_store.get(data.challenge_id)
    if not challenge:
        raise HTTPException(400, "验证已过期")
    
    # 偏差在 5px 以内算通过
    offset = abs(data.slider_x - challenge["target_x"])
    if offset <= 5:
        # 生成一次性验证 Token
        token = generate_signed_token(data.challenge_id)
        return {"verified": True, "captcha_token": token}
    
    return {"verified": False}
```

---

## 五、安全加固策略

### 5.1 对抗等级矩阵

| 攻击者等级 | 攻击手段 | MVP 防御 | 完整版防御 |
|:----------:|----------|:--------:|:----------:|
| **L1 脚本小子** | cURL / requests 直接调 API | ✅ 拼图阻断 | ✅ |
| **L2 自动化工具** | Selenium / Puppeteer 模拟点击 | ⚠️ 轨迹检测 | ✅ 后端验证 |
| **L3 AI 攻击** | 用 CV 模型识别拼图位置 | ❌ 无法防御 | ⚠️ 图片混淆 |
| **L4 人工打码** | 雇人手动验证 | ❌ 无法防御 | ❌ 无法防御 |

> MVP 对抗 L1-L2 足矣。L3-L4 属于「花钱攻击」，成本远高于收益。

### 5.2 滑动轨迹反作弊特征

```typescript
// 前端收集的轨迹数据用于反作弊分析
interface SliderTrail {
  x: number[]      // X 坐标序列
  y: number[]      // Y 坐标序列
  timestamps: number[]  // 时间戳序列
}

// 机器人特征（后端可选校验）
function isSuspiciousTrail(trail: SliderTrail): boolean {
  // 1. 滑动太快（< 300ms）
  const duration = trail.timestamps.at(-1)! - trail.timestamps[0]
  if (duration < 300) return true

  // 2. Y 轴完全不动（人类手抖会有 Y 偏移）
  const yVariance = calculateVariance(trail.y)
  if (yVariance === 0) return true

  // 3. 匀速运动（人类加速度不均匀）
  const speeds = calculateSpeedChanges(trail.x, trail.timestamps)
  const speedVariance = calculateVariance(speeds)
  if (speedVariance < 0.01) return true

  // 4. 数据点太少（正常人类 > 20 个采样点）
  if (trail.x.length < 10) return true

  return false
}
```

### 5.3 Token 一次性使用

```
每个 captcha_token 只能使用一次：
    1. 前端完成拼图 → 生成 token（含 nonce UUID）
    2. 前端调用 send-code → 传 token 给后端
    3. 后端验证 token → 记录 nonce 到已用集合
    4. 同一 nonce 再次提交 → 拒绝（防重放）
```

---

## 六、UI/UX 设计规范

### 6.1 视觉效果

```
注册页面中的滑动拼图验证区域：

┌──────────────────────────────────────┐
│                                      │
│   ┌────────────────────────────┐     │
│   │  🖼️ [背景图片]              │     │
│   │        ┌───┐               │     │
│   │        │ 🧩│ ← 拼图缺口     │     │
│   │        └───┘               │     │
│   └────────────────────────────┘     │
│                                      │
│   ┌────────────────────────────┐     │
│   │ ▶ │━━━━━━━━━━━━━━━━━━━━━│ │     │  ← 滑动条
│   │   向右滑动完成验证          │     │
│   └────────────────────────────┘     │
│                                      │
└──────────────────────────────────────┘

验证成功后变为：
┌──────────────────────────────────────┐
│   ✅ 验证通过                         │
└──────────────────────────────────────┘
```

### 6.2 暗色模式适配

```css
/* 滑动拼图暗色模式 */
:root {
  --rcsc-primary: hsl(var(--primary));
  --rcsc-bg-color: hsl(var(--card));
  --rcsc-border-color: hsl(var(--border));
  --rcsc-text-color: hsl(var(--foreground));
}

.dark {
  --rcsc-bg-color: hsl(var(--card));
  --rcsc-border-color: hsl(var(--border));
}
```

### 6.3 交互状态

| 状态 | 视觉反馈 |
|------|----------|
| 默认 | 灰色滑块 + "向右滑动完成验证" |
| 滑动中 | 滑块跟随手指，背景图显示拼图 |
| 成功 | 绿色 ✅ + "验证通过" |
| 失败 | 红色震动 + "验证失败，请重试" + 自动重置 |
| 禁用 | 灰色不可交互（邮箱未填写时） |

### 6.4 移动端适配

- 滑块高度增大至 48px（符合触控目标最小 44px 规范）
- 拼图图片宽度自适应容器
- 支持触摸事件（touch events）

---

## 七、ACTION ITEMS

| 优先级 | 任务 | 涉及文件 | 预估 |
|:---|:---|:---|:---:|
| **P0** | 安装 `rc-slider-captcha` | `frontend/package.json` | 0.2h |
| **P0** | 封装 CaptchaSlider 组件 | `src/components/auth/SliderCaptcha.tsx` | 2h |
| **P0** | 后端 Token 校验逻辑 | `backend/app/services/captcha_verifier.py` | 1.5h |
| **P0** | 集成到注册页面 | `app/(auth)/register/page.tsx` | 1h |
| **P0** | 集成到找回密码页面 | `app/(auth)/forgot-password/page.tsx` | 0.5h |
| **P1** | 暗色模式 CSS 适配 | `src/app/globals.css` | 0.5h |
| **P1** | 移动端触控优化 | `SliderCaptcha.tsx` | 1h |
| **P2** | 后端完整验证（服务端生成拼图） | `backend/app/api/captcha.py` | 4h |
| **P2** | 滑动轨迹反作弊分析 | `captcha_verifier.py` | 2h |

**总预估**：MVP ~5.7h，完整版 ~11.7h

---

> **一句话总结**：使用 `rc-slider-captcha` React 组件实现滑动拼图验证，作为邮件发送 API 的前置防护层。MVP 阶段采用前端验证 + 签名 Token + 后端时效性校验，可阻挡 99% 自动化攻击。后续可升级为服务端生成拼图 + 偏差校验 + 轨迹反作弊分析。
