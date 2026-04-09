# 🛡️ StudySolo 深度安全审计报告

> **审计日期**: 2026-04-09
> **审计范围**: StudySolo 全栈 (FastAPI 后端 + Next.js 前端 + Supabase 数据层)
> **方法论**: OWASP Top 10:2025 + Supply Chain + Attack Surface Mapping
> **审计员**: Security Auditor Agent

---

## 📊 Executive Summary

| 严重度 | 数量 | 状态 |
|--------|------|------|
| 🔴 **CRITICAL** | 2 | 需立即修复 |
| 🟠 **HIGH** | 6 | 需尽快修复 |
| 🟡 **MEDIUM** | 8 | 应在下个迭代修复 |
| 🔵 **LOW** | 6 | 建议改进 |
| ✅ **已有安全强项** | 6 | 保持 |

---

## ✅ 已有安全强项（值得肯定）

在发现问题之前，先确认项目已做好的安全实践：

| # | 安全措施 | 位置 | 评价 |
|---|---------|------|------|
| ✅1 | **RLS 全面启用** | 所有 `supabase/migrations/` | 所有公共表均启用 RLS，包括后续修复的 `_project_registry` 和 `_db_conventions` |
| ✅2 | **Service Role / Anon Key 分离** | [database.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/core/database.py) | 双 Supabase 客户端，auth 用 anon key 尊重策略，内部用 service_role |
| ✅3 | **无代码注入风险** | 全后端 | 无 `eval()`, `exec()`, `pickle`, `subprocess`, `verify=False` |
| ✅4 | **路径穿越防御** | [exports.py:29-44](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/exports.py#L29-L44) | `os.path.basename()` + `..` 检测 + `os.path.realpath()` belt-and-suspenders |
| ✅5 | **Admin JWT 纵深防御** | [admin_auth.py](file:///d:/project/Study_1037Solo/StudySolo/backend/app/middleware/admin_auth.py) | type claim 校验 + DB active check + 账号锁定 + bcrypt 12 轮 + 审计日志 |
| ✅6 | **HttpOnly + SameSite Cookie** | [_helpers.py:17-27](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/_helpers.py#L17-L27) | 所有 auth cookie 均设 httponly, samesite, 生产环境 secure |

---

## 🔴 CRITICAL — 立即修复

### C-1: SMTP 使用明文端口 80（非 TLS）

| 属性 | 详情 |
|------|------|
| **位置** | [config.py:48](file:///d:/project/Study_1037Solo/StudySolo/backend/app/core/config.py#L48) |
| **OWASP** | A02 - Cryptographic Failures |
| **现状** | `smtp_port: int = 80`（HTTP 端口，非加密） |
| **影响** | 邮件内容（含验证码、密码重置链接）以**明文**在网络中传输，可被中间人攻击截获 |
| **风险** | 攻击者可以嗅探网络流量获取密码重置链接，接管任意用户账户 |

**修复方案**:
```python
# 使用 Aliyun DirectMail 的 TLS 端口
smtp_port: int = 465  # SSL/TLS
# 或
smtp_port: int = 587  # STARTTLS
```

---

### C-2: OpenAPI/Swagger 文档在生产环境暴露

| 属性 | 详情 |
|------|------|
| **位置** | [main.py:31](file:///d:/project/Study_1037Solo/StudySolo/backend/app/main.py#L31) + [auth.py:37-40](file:///d:/project/Study_1037Solo/StudySolo/backend/app/middleware/auth.py#L37-L40) |
| **OWASP** | A02 - Security Misconfiguration |
| **现状** | FastAPI 默认启用 `/docs`, `/openapi.json`, `/redoc` 且已加入 `UNPROTECTED_PATHS`，无条件绕过认证 |
| **影响** | 攻击者可直接访问完整 API 文档，获取所有端点的请求/响应结构，极大降低攻击门槛 |

**修复方案**:
```python
# main.py — 生产环境禁用 Swagger
settings = get_settings()
app = FastAPI(
    title="StudySolo API",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
    openapi_url="/openapi.json" if settings.environment == "development" else None,
)
```

---

## 🟠 HIGH — 尽快修复

### H-1: 缺少 HSTS 响应头

| 属性 | 详情 |
|------|------|
| **位置** | [security.py:9-14](file:///d:/project/Study_1037Solo/StudySolo/backend/app/middleware/security.py#L9-L14) |
| **OWASP** | A02 - Security Misconfiguration |
| **现状** | `_SECURITY_HEADERS` 缺少 `Strict-Transport-Security` |
| **影响** | 用户首次访问可被 SSL Stripping 攻击降级到 HTTP，窃取 Cookie/Token |

**修复方案**:
```python
_SECURITY_HEADERS = {
    # ... 现有 headers ...
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
}
```

---

### H-2: 导出文件无自动清理机制（磁盘耗尽 DoS）

| 属性 | 详情 |
|------|------|
| **位置** | [file_converter.py:35](file:///d:/project/Study_1037Solo/StudySolo/backend/app/services/file_converter.py#L35) |
| **OWASP** | A10 - Exceptional Conditions |
| **现状** | 导出文件写入 `tempdir/studysolo_exports/`，但无 TTL 清理 / 文件数量限制 |
| **影响** | 攻击者可通过大量导出请求填满服务器磁盘，导致服务不可用 |

**修复方案**:
- 添加定时清理任务（删除 > 1h 的导出文件）
- 设置每用户导出频率限制
- 设置导出目录大小上限

---

### H-3: Schema 生成 Rate Limit 使用进程内存（重启丢失 + 多实例失效）

| 属性 | 详情 |
|------|------|
| **位置** | [community_nodes.py:45-95](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/community_nodes.py#L45-L95) |
| **OWASP** | A01 - Broken Access Control |
| **现状** | `_schema_gen_hits: dict[str, list[float]] = defaultdict(list)` — 存储在 Python 全局变量 |
| **影响** | 1) 服务重启后限制清零 2) 多 worker/多实例时完全失效 3) 长时间运行内存泄漏（用户 ID 永不清理） |

**修复方案**: 迁移到 DB-based 或 Redis-based rate limiter, 或参照 `auth_rate_limit_events` 表的模式。

---

### H-4: Login 响应泄漏 Token 到 Response Body

| 属性 | 详情 |
|------|------|
| **位置** | [login.py:50](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/login.py#L50) + [login.py:92](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/login.py#L92) |
| **OWASP** | A04 - Cryptographic Failures |
| **现状** | `access_token` 和 `refresh_token` 同时通过 HttpOnly Cookie（✅对的）**和** JSON Response Body（❌不好）返回 |
| **影响** | Token 出现在 Response Body 中意味着可被 XSS 读取、前端 JS 日志记录、浏览器开发工具缓存等途径泄漏 |

**修复方案**: 移除 response body 中的 token，仅通过 HttpOnly Cookie 传递。前端的 `sync-session` 也应同步处理。

---

### H-5: 异常信息直接暴露给客户端

| 属性 | 详情 |
|------|------|
| **位置** | [ai_chat_stream.py:261](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/ai_chat_stream.py#L261), [workflow_execute.py:235](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/workflow_execute.py#L235), [knowledge.py:75](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/knowledge.py#L75) |
| **OWASP** | A05 - Security Misconfiguration |
| **现状** | 多处 `str(exc)` 直接返回给客户端 |
| **影响** | 可能泄漏内部堆栈信息、文件路径、数据库表名、第三方 API 错误等敏感细节 |

**修复方案**:
```python
# 替换直接暴露
# ❌ "error": str(exc)
# ✅ "error": "服务内部错误，请稍后重试"  # 仅面向用户
# 同时 logger.exception() 记录完整细节供调试
```

---

### H-6: Workflow Execute 缺少专门的 Rate Limit

| 属性 | 详情 |
|------|------|
| **位置** | [workflow_execute.py:268-300](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/workflow_execute.py#L268-L300) |
| **OWASP** | A01 - Broken Access Control |
| **现状** | execute 端点无任何频率限制，仅靠认证 |
| **影响** | 恶意用户可密集触发工作流执行，消耗大量 AI API 配额和服务器资源 |

**修复方案**: 添加每用户 per-minute/per-hour 执行频率限制（可基于 `ss_usage_daily` 或 SlowAPI）。

---

## 🟡 MEDIUM — 应在下个迭代修复

### M-1: CSP 策略过于严格，可能阻断功能 OR 过于宽松

| 属性 | 详情 |
|------|------|
| **位置** | [security.py:10](file:///d:/project/Study_1037Solo/StudySolo/backend/app/middleware/security.py#L10) |
| **现状** | `default-src 'self'` — 但前端使用了 Supabase SDK (外部域)、Google Fonts (如有)、AI API 调用 |
| **影响** | 要么 CSP 因过严阻断功能，要么为了工作需要被放宽（表示当前 CSP 可能不生效） |

**建议**: 检查实际是否生效；如生效需添加如下指令：
```
default-src 'self'; connect-src 'self' https://*.supabase.co; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

---

### M-2: 文件上传仅校验扩展名，未校验 MIME Type / Magic Bytes

| 属性 | 详情 |
|------|------|
| **位置** | [knowledge.py:50-55](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/knowledge.py#L50-L55), [community_nodes.py:107-112](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/community_nodes.py#L107-L112) |
| **现状** | 只检查 `file.filename.rsplit(".", 1)[-1]` |
| **影响** | 攻击者可将恶意文件重命名为 `.pdf` 绕过检查 |

**建议**: 添加 `python-magic` MIME 类型校验或文件头 Magic Bytes 验证。

---

### M-3: CORS `allow_methods=["*"]` + `allow_headers=["*"]`

| 属性 | 详情 |
|------|------|
| **位置** | [security.py:49-50](file:///d:/project/Study_1037Solo/StudySolo/backend/app/middleware/security.py#L49-L50) |
| **现状** | 虽然 Origin 限制为单一域，但 methods/headers 完全放开 |
| **影响** | 允许了 `DELETE`, `PATCH`, `PUT` 等非标准方法的预检通过 |

**建议**: 限制为实际使用的方法和头部：
```python
allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
allow_headers=["Content-Type", "Authorization", "Cookie"],
```

---

### M-4: `window.__ENV__` 暴露 Supabase Keys 到 HTML Source

| 属性 | 详情 |
|------|------|
| **位置** | [layout.tsx:47-56](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/app/layout.tsx#L47-L56) |
| **现状** | Supabase URL 和 Anon Key 通过 `JSON.stringify` 注入到内联 script |
| **影响** | Anon Key 本身是设计为公开的，但降低了攻击者直接调用 Supabase API 的门槛 |

**建议**: 这是 Supabase 的正常模式（anon key 意图公开），确保所有表的 RLS 策略足够严格即可。**当前 RLS 已全面启用 ✅**，风险可接受。

---

### M-5: Admin 登录无 CAPTCHA 保护

| 属性 | 详情 |
|------|------|
| **位置** | [admin_auth.py:76-204](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/admin_auth.py#L76-L204) |
| **现状** | Admin 登录仅有 5 次失败锁定 30 分钟机制，无 CAPTCHA |
| **影响** | 攻击者可以 5/30min 的节奏持续尝试，进行慢速暴力破解 |

**建议**: 对 admin 登录添加 Jigsaw CAPTCHA（项目已有此能力），或要求 TOTP/2FA。

---

### M-6: X-Forwarded-For 头可被伪造

| 属性 | 详情 |
|------|------|
| **位置** | [_helpers.py:56-59](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/_helpers.py#L56-L59) |
| **现状** | 直接信任 `x-forwarded-for` 第一个值 |
| **影响** | 攻击者可伪造该头部绕过 IP-based 限流 |

**建议**: 仅在受信任代理（Nginx）后信任该头，或使用 `request.client.host` + Nginx `X-Real-IP` 单一可信头。

---

### M-7: Redeem Code 缺少 Rate Limit

| 属性 | 详情 |
|------|------|
| **位置** | [discounts.py:134](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/discounts.py#L134) |
| **现状** | 兑换码接口无频率限制 |
| **影响** | 攻击者可以暴力枚举兑换码，虽然码空间可能较大，但仍应防御 |

**建议**: 添加 per-user 和 per-IP 频率限制，连续失败后增加延迟。

---

### M-8: PDF 导出中 Markdown 内容未经 HTML 转义

| 属性 | 详情 |
|------|------|
| **位置** | [file_converter.py:249](file:///d:/project/Study_1037Solo/StudySolo/backend/app/services/file_converter.py#L249) |
| **现状** | `{html_content}` 直接插入 HTML 模板，WeasyPrint 渲染 |
| **影响** | 如果工作流输出包含恶意 HTML/JS，可能在 PDF 生成过程中执行（SSRF via WeasyPrint external resource loading） |

**建议**: 对 `html_content` 进行 HTML sanitization（如 bleach），或配置 WeasyPrint 禁止加载外部资源。

---

## 🔵 LOW — 建议改进

### L-1: `remember_me` Cookie 存储用户偏好但标记 HttpOnly

| 位置 | [_helpers.py:40-44](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/_helpers.py#L40-L44) |
|------|------|
| **影响** | 极低，仅影响 UX。`remember_me` 值 (`"0"` / `"1"`) 不是敏感数据，但与 access_token 使用相同 httponly 选项 |

---

### L-2: Admin Cookie SameSite=strict 但 User Cookie SameSite=lax 不一致

| 位置 | Admin: [admin_auth.py:64](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/admin_auth.py#L64), User: [_helpers.py:22](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/_helpers.py#L22) |
|------|------|
| **建议** | 统一为 `strict`，除非 OAuth 重定向需要 `lax` |

---

### L-3: ShikiCodeBlock 使用 `dangerouslySetInnerHTML`（已评估安全）

| 位置 | [ShikiCodeBlock.tsx:49](file:///d:/project/Study_1037Solo/StudySolo/frontend/src/features/workflow/components/nodes/ShikiCodeBlock.tsx#L49) |
|------|------|
| **影响** | 低 — HTML 来源是 shiki 的 `codeToHtml()`，仅处理代码片段语法高亮，非用户输入 |
| **建议** | 保持当前注释说明；如 `code` 参数将来可能包含用户内容，考虑 DOMPurify |

---

### L-4: 部分 `.agent/` 文件意外可能泄漏到仓库

| 位置 | [.gitignore:36-40](file:///d:/project/Study_1037Solo/StudySolo/.gitignore#L36-L40) |
|------|------|
| **现状** | `.agent/*` 被 ignore 但有白名单例外 (`workflow-node-builder/`, `project-context/`) |
| **建议** | 确认白名单中的 skill 文件不包含任何环境特定的配置或密钥 |

---

### L-5: Auth Rate Limit Events 表无自动过期清理

| 位置 | [_helpers.py:77-97](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/_helpers.py#L77-L97) |
|------|------|
| **现状** | 虽记录了 `expires_at`，但无 cron 或 TTL 自动删除过期记录 |
| **建议** | 添加 Supabase pg_cron 定期清理过期 events |

---

### L-6: `LOGIN_RESPONSE` 同时返回 `needs_tos` 和 `needs_cookie_consent`

| 位置 | [login.py:51-52](file:///d:/project/Study_1037Solo/StudySolo/backend/app/api/auth/login.py#L51-L52) |
|------|------|
| **风险** | 极低 — 这是合法的业务字段，但确认这些不被用于做任何安全决策 |

---

## 🗺️ 攻击面总览

```mermaid
graph TD
    A[互联网用户] --> B[Nginx 反向代理]
    B --> C[FastAPI :2038]
    B --> D[Next.js :2037]
    
    C --> E[Supabase service_role]
    C --> F[AI API 集群<br/>DashScope/DeepSeek/Moonshot/...]
    C --> G[SMTP 邮件<br/>⚠️ 端口80明文]
    C --> H[文件系统<br/>⚠️ 导出目录]
    
    D --> I[Supabase anon key<br/>RLS 保护 ✅]
    
    subgraph 攻击面
        J[/docs /openapi.json<br/>🔴 未限制]
        K[/api/workflow/execute<br/>🟠 无限频]
        L[/api/discounts/redeem<br/>🟡 可暴力]
        M[/api/knowledge/upload<br/>🟡 仅扩展名]
        N[/api/admin/login<br/>🟡 无CAPTCHA]
    end
    
    C --> J
    C --> K
    C --> L
    C --> M
    C --> N
```

---

## 📋 修复优先级清单

| 优先级 | ID | 问题 | 预估工作量 |
|--------|-----|------|-----------|
| 🔴 P0 | C-1 | SMTP 端口改为 465/587 TLS | 5 min |
| 🔴 P0 | C-2 | 生产环境禁用 OpenAPI 文档 | 10 min |
| 🟠 P1 | H-1 | 添加 HSTS 响应头 | 5 min |
| 🟠 P1 | H-4 | 移除 Response Body 中的 Token | 30 min |
| 🟠 P1 | H-5 | 异常信息脱敏 | 1h |
| 🟠 P1 | H-2 | 导出文件自动清理 | 1h |
| 🟠 P1 | H-3 | Rate Limit 迁移至 DB | 2h |
| 🟠 P1 | H-6 | Workflow Execute Rate Limit | 1h |
| 🟡 P2 | M-1 | 调整 CSP 策略 | 30 min |
| 🟡 P2 | M-2 | 文件上传 MIME 校验 | 1h |
| 🟡 P2 | M-3 | 收紧 CORS methods/headers | 10 min |
| 🟡 P2 | M-5 | Admin 登录添加 CAPTCHA/2FA | 4h |
| 🟡 P2 | M-6 | 修复 X-Forwarded-For 信任链 | 30 min |
| 🟡 P2 | M-7 | Redeem Code Rate Limit | 1h |
| 🟡 P2 | M-8 | PDF 导出 HTML Sanitization | 1h |

---

## 🔗 相关文档与 KI 参考

- [1037Solo Security Verification System KI](file:///C:/Users/AIMFl/.gemini/antigravity/knowledge/1037solo_security_verification_system/artifacts/overview.md) — CAPTCHA + IP 锁定
- [1037Solo Production Deployment KI](file:///C:/Users/AIMFl/.gemini/antigravity/knowledge/1037solo_production_deployment/artifacts/overview.md) — Nginx / DNS / Cookie Domain
- [Vulnerability Scanner Skill](file:///d:/project/Study_1037Solo/StudySolo/.agent/skills/vulnerability-scanner/SKILL.md) — OWASP 2025 方法论
- [Security Checklists](file:///d:/project/Study_1037Solo/StudySolo/.agent/skills/vulnerability-scanner/checklists.md) — 审计对照清单

---

> ⚠️ **注意**: GitHub Issues 由于 API 认证失败未能拉取。建议在 PAT 权限修复后，创建对应 Issues 对上述发现进行追踪。
