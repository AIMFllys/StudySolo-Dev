# 🔐 安全加固 PR #16 — 完整实施总结

> **日期**: 2026-03-25
> **作者**: SukhoiFlanker (Flanker)
> **PR**: [#16 — Chore/15 安全完善与修复](https://github.com/AIMFllys/StudySolo/pull/16)
> **关联 Issue**: [#15](https://github.com/AIMFllys/StudySolo/issues/15)
> **状态**: ✅ 已合并至 main

---

## 📋 本次目标

本次 PR 由队友 SukhoiFlanker 提交，修复一组高优先级安全问题，覆盖 6 大攻击面：

1. **前端 Markdown XSS** — 移除不安全的原始 HTML 渲染入口
2. **"记住我"明文密码存储** — 不再在 localStorage 保存密码
3. **管理后台鉴权 fail-open** — DB 异常时改为拒绝访问
4. **验证码伪造/重放** — CAPTCHA 改为服务端状态校验 + 一次性消费
5. **邮箱验证码爆破** — 增加失败计数与频率限制
6. **安全响应头缺失** — 补充 CSP、X-Frame-Options 等基础安全头

---

## 📊 改动概览

| 指标 | 数值 |
|------|------|
| 修改文件数 | **16 个** (含 3 个新建) |
| 净新增行数 | ~630 行 |
| 新建 DB 表 | 2 个 (`captcha_challenges`, `auth_rate_limit_events`) |
| 新增 DB 列 | 1 个 (`verification_codes_v2.attempt_count`) |
| 新建测试文件 | 2 个 (前端 + 后端) |
| 需要新增环境变量 | 1 个 (`CAPTCHA_SECRET`) |

---

## 🛡️ 修复详解

### 1. CAPTCHA 机制重构（服务端有状态 + 一次性消费）

**改动文件**: [captcha.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/captcha.py)

**改动前（旧版 — 严重漏洞）：**
- 使用硬编码默认密钥 `"studysolo-captcha-2026"`
- Token 格式: `{timestamp}:{hmac}` — 纯客户端签名，无服务端状态
- Token 可无限次重放（同一 token 反复使用）

**改动后（新版）：**
- **强制要求 `CAPTCHA_SECRET` 环境变量**，缺失直接 `RuntimeError` 崩溃
- 引入 `captcha_challenges` DB 表存储挑战状态
- Token 格式: `{challenge_id}:{timestamp}:{hmac}` — 服务端可追溯
- 分离 `verify_captcha_token()`（验证）与 `consume_captcha_token()`（消费）
- 消费后 `consumed=True`，不可重放

| 阶段 | 旧流程 | 新流程 |
|------|--------|--------|
| 生成挑战 | 仅返回 seed + signature | 写入 DB → 返回 challenge_id + seed + signature |
| 验证滑块 | 纯 HMAC 校对 | HMAC 校对 + DB 查询 + `verified=False` 断言 |
| 签发 token | `{ts}:{hmac}` | `{challenge_id}:{ts}:{hmac}` + 标记 `verified=True` |
| 消费 token | 无消费机制 | 校验 `verified=True && consumed=False` → 标记 `consumed=True` |

### 2. 管理后台鉴权 Fail-Close

**改动文件**: [admin_auth.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/middleware/admin_auth.py)

```diff
  except Exception as e:
      logger.warning("AdminJWTMiddleware: DB check failed ...")
-     # 异常被静默吞掉，请求继续通行 (fail-open 🚨)
+     response = JSONResponse(status_code=503, content={"detail": "管理员鉴权服务暂不可用"})
+     await response(scope, receive, send)
+     return   # fail-close ✅
```

**安全意义**: 数据库故障时，管理员面板不再误放行未授权请求。

### 3. 管理员 Cookie 策略收紧

**改动文件**: [admin_auth.py (API)](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/admin_auth.py)

| Cookie 属性 | 旧值 | 新值 | 意义 |
|-------------|------|------|------|
| JWT 有效期 | 4 小时 | **2 小时** | 缩短窗口期 |
| Cookie Path | `/` (全站可访问) | **`/api/admin`** (限定路径) | 防止非管理 API 泄漏身份 |
| SameSite | `lax` | **`strict`** | 更强的 CSRF 防护 |
| 清除逻辑 | 单次 `delete_cookie` | 双重 delete (`/` + `/api/admin`) | 清理遗留旧 cookie |

### 4. 邮箱验证码暴力破解防护

涉及三层防护：

#### 4.1 验证码本身限次

**改动文件**: [email_service.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/services/email_service.py)

- 每个验证码最多尝试 **5 次** (`_MAX_VERIFICATION_ATTEMPTS = 5`)
- 错误输入 → `attempt_count += 1`
- 达到上限 → 自动标记 `is_used = True`（作废整个验证码）
- 查询改为按 `created_at DESC` 取最新验证码，先查后比对

#### 4.2 注册流程频率限制

**改动文件**: [register.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/register.py)

- **IP + 邮箱双维度**频率限制
- 10 分钟窗口内最多 8 次失败（`_VERIFY_RATE_LIMIT_MAX_ATTEMPTS = 8`）
- 超限返回 `429 Too Many Requests`
- 成功验证后清除对应 bucket

#### 4.3 重置密码频率限制

**改动文件**: [login.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/login.py)

- 同上，10 分钟 / 8 次的 IP + 邮箱双维度限制
- 复用 `auth_rate_limit_events` 表记录事件

#### 4.4 公共 Helper 函数

**改动文件**: [_helpers.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/_helpers.py)

新增以下可复用函数：

| 函数 | 职责 |
|------|------|
| `resolve_client_ip(request)` | 优先从 `X-Forwarded-For` 获取真实客户端 IP |
| `is_rate_limited(db, bucket, event_type, limit, window)` | 查询是否超出频率限制 |
| `record_rate_limit_failure(db, bucket, event_type, window)` | 记录一次失败尝试 |
| `clear_rate_limit_failures(db, event_type, *buckets)` | 成功后清除失败记录 |

### 5. 前端 Markdown XSS 防护

**改动文件**: [NodeMarkdownOutput.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/features/workflow/components/nodes/NodeMarkdownOutput.tsx)

```diff
- rehypePlugins={[rehypeKatex, rehypeRaw]}
+ rehypePlugins={[rehypeKatex]}
```

**`rehype-raw` 的风险**: 允许 Markdown 中嵌入原始 HTML（如 `<script>alert(1)</script>`），启用后相当于关闭了 XSS 保护。移除后所有 HTML 标签会被转义为文本。

**附带**: [ShikiCodeBlock.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/features/workflow/components/nodes/ShikiCodeBlock.tsx) 的 `dangerouslySetInnerHTML` 保留，但添加注释说明 shiki 输出是安全的。

### 6. "记住我"不再存储明文密码

**改动文件**:
- [auth-credentials.service.ts](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/services/auth-credentials.service.ts)
- [LoginForm.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/features/auth/forms/LoginForm.tsx)

```diff
  type SavedCredentials = {
    email: string;
-   password: string;
    remember: boolean;
  };

- saveRememberedCredentials(email, password);
+ saveRememberedCredentials(email);
```

**兼容处理**: 如果检测到旧格式数据（含 `password` 字段），自动删除并返回 `null`，防止旧密码数据残留。

### 7. 安全响应头

**改动文件**:
- [security.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/middleware/security.py) — 新增 `SecurityHeadersMiddleware` 类
- [main.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/main.py) — 注册中间件
- [nginx.conf](file:///d:/project/Study_1037Solo/StudySolo/scripts/nginx.conf) — 同步更新

| 响应头 | 值 | 作用 |
|--------|-----|------|
| `Content-Security-Policy` | `default-src 'self'; frame-ancestors 'none'; object-src 'none'` | 限制资源加载来源，禁止嵌入 iframe |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 防止跨站 Referer 泄漏完整 URL |
| `X-Content-Type-Options` | `nosniff` | 防止 MIME 类型嗅探 |
| `X-Frame-Options` | `DENY` | 禁止页面被 iframe 嵌入 (防点击劫持) |

---

## 🗄️ 数据库迁移

**文件**: `supabase/migrations/20260325103000_harden_verification_codes_and_attempts.sql`

### 新增表

```sql
-- CAPTCHA 服务端状态表
CREATE TABLE captcha_challenges (
  id text PRIMARY KEY,
  seed integer NOT NULL,
  target_x integer NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  consumed boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 频率限制事件表
CREATE TABLE auth_rate_limit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  event_type text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 现有表变更

```sql
-- 验证码表增加尝试计数
ALTER TABLE verification_codes_v2
ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
```

---

## 🧪 测试覆盖

### 后端: `test_auth_security_hardening_property.py` (187 行)

| 测试 | 验证内容 |
|------|---------|
| `test_admin_middleware_returns_503_when_db_check_errors` | DB 异常时返回 503 而非放行 |
| `test_captcha_token_can_only_be_consumed_once` | CAPTCHA token 一次性消费 |
| `test_verify_code_invalid_attempts_exhaust_latest_code` | 验证码 5 次错误后自动作废 |
| `test_missing_captcha_secret_is_rejected` | 缺少 CAPTCHA_SECRET 时抛 RuntimeError |

### 前端: `auth-security.property.test.tsx` (111 行)

| 测试 | 验证内容 |
|------|---------|
| `remember me only persists email and remember flag` | 不保存 password |
| `legacy remembered password payload is cleared` | 旧格式数据自动清理 |
| `markdown rendering escapes raw html` | XSS 标签被转义，Markdown/数学公式正常 |
| `clearRememberedCredentials removes saved data` | 清除功能完整 |

---

## ⚠️ 部署注意事项

| 事项 | 操作 |
|------|------|
| **环境变量** | `.env` 必须新增 `CAPTCHA_SECRET=<强随机字符串>` |
| **数据库迁移** | 执行 `20260325103000_harden_verification_codes_and_attempts.sql` |
| **重启后端** | 新中间件与配置需重启生效 |
| **验证清单** | `/api/health` 正常 · 登录功能正常 · 验证码收发正常 · 安全头下发正常 |

---

## 📦 完整文件清单 (16 个文件)

### 后端 (10 文件)

| 文件 | 改动 |
|------|------|
| [.env.example](file:///d:/project/Study_1037Solo/StudySolo/backend/.env.example) | 新增 `CAPTCHA_SECRET` 示例 |
| [admin_auth.py (API)](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/admin_auth.py) | JWT 2h + cookie path/samesite 收紧 |
| [_helpers.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/_helpers.py) | IP 解析 + 频率限制三函数 |
| [captcha.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/captcha.py) | CAPTCHA 全面重构(服务端有状态) |
| [login.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/login.py) | 重置密码频率限制 |
| [register.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/register.py) | 注册流程频率限制 + consume_captcha |
| [main.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/main.py) | 注册 SecurityHeadersMiddleware |
| [admin_auth.py (中间件)](file:///d:/project/Study_1037Solo/StudySolo/backend/app/middleware/admin_auth.py) | fail-close 503 |
| [security.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/middleware/security.py) | SecurityHeadersMiddleware 类 |
| [email_service.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/services/email_service.py) | 验证码 5 次限制 |

### 前端 (4 文件)

| 文件 | 改动 |
|------|------|
| [LoginForm.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/features/auth/forms/LoginForm.tsx) | 回填仅邮箱，不填密码 |
| [NodeMarkdownOutput.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/features/workflow/components/nodes/NodeMarkdownOutput.tsx) | 移除 rehype-raw |
| [ShikiCodeBlock.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/features/workflow/components/nodes/ShikiCodeBlock.tsx) | 安全注释 |
| [auth-credentials.service.ts](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/services/auth-credentials.service.ts) | 记住我不存密码 + 旧格式清理 |

### 其他 (2 文件)

| 文件 | 改动 |
|------|------|
| [nginx.conf](file:///d:/project/Study_1037Solo/StudySolo/scripts/nginx.conf) | CSP + X-Frame-Options: DENY |
| [迁移 SQL](file:///d:/project/Study_1037Solo/StudySolo/supabase/migrations/20260325103000_harden_verification_codes_and_attempts.sql) | 2 新表 + 1 新字段 |

### 新建测试 (2 文件)

| 文件 | 行数 |
|------|------|
| [test_auth_security_hardening_property.py](file:///d:/project/Study_1037Solo/StudySolo/backend/tests/test_auth_security_hardening_property.py) | 187 行 |
| [auth-security.property.test.tsx](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/__tests__/auth-security.property.test.tsx) | 111 行 |
