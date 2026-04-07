# StudySolo 安全漏洞审计报告

针对当前代码库（尤其是 FastAPI 后端）的深入分析，我们发现了以下几个核心安全漏洞。这些问题可能导致服务遭受恶意刷量攻击，并引入潜在的数据越权风险。

## 1. 通过 IP 伪造绕过速率限制 (Rate Limit Bypass via IP Spoofing)

### 漏洞位置
文件：`backend/app/api/auth/_helpers.py`

```python
def resolve_client_ip(request: Request) -> str:
    """Resolve the originating client IP, preferring proxy headers when present."""
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
```

### 漏洞描述与影响
在获取客户端 IP 用于速率限制（Rate Limiting，如防止发送验证码、密码重置请求被恶意爆破）时，代码直接从请求头 `x-forwarded-for` 中读取 IP 地址。
由于 `X-Forwarded-For` 头是可以由客户端任意构造的，攻击者只需要在每次请求时伪造不同的 `X-Forwarded-For` 值，就能轻松绕过 `is_rate_limited`（位于同文件的认证限流机制）针对 `ip_bucket` 的检查。

**影响范围**：
- 注册验证码发送接口 (`/api/auth/send-code`) 被恶意调用，耗尽短信/邮件额度并导致服务商封号。
- 密码重置接口被批量爆破。

### 修复建议
如果应用部署在反向代理（如 Nginx、CDN）之后，反向代理应负责重写 `X-Forwarded-For` 或者使用 `X-Real-IP`。在应用代码侧，不应该直接信任客户端发来的 `X-Forwarded-For`，而应该：
1. 配置反向代理在转发前清除客户端原始的 `X-Forwarded-For`。
2. 使用 FastAPI/Uvicorn 官方提供的 `ProxyHeadersMiddleware` 中间件，并明确配置 `forwarded_allow_ips` 为受信任的反向代理 IP，让框架安全地解析真实客户端 IP，而不是手写解析逻辑。

---

## 2. 系统性越权与 RLS 绕过风险 (Broken Access Control & RLS Bypass)

### 漏洞位置
文件：`backend/app/core/database.py`
文件：`backend/app/core/deps.py`

```python
# backend/app/core/database.py
async def get_db() -> AsyncClient:
    """Return the shared Supabase AsyncClient with **service_role** key."""
    # 实例化并返回具有最高权限的 service_role 客户端...

# backend/app/core/deps.py
async def get_supabase_client(
    db: AsyncClient = Depends(get_db),
) -> AsyncClient:
    """Yield the shared Supabase AsyncClient (service_role)."""
    return db
```

### 漏洞描述与影响
代码库在架构层面上，针对绝大多数业务路由（如工作流 CRUD、节点操作、知识库操作等），注入并使用了 `get_supabase_client`，而该依赖项底层调用的是 `get_db`，即返回了带有 **`service_role`** 密钥的 Supabase 客户端。

`service_role` 密钥的设计初衷是用于服务端内部管理操作，它会**完全绕过 Supabase 的行级安全策略（Row Level Security, RLS）**。
虽然目前的绝大多数路由代码中（例如 `backend/app/api/workflow.py` 或 `backend/app/api/community_nodes.py`）都由开发者手动添加了 `.eq("user_id", current_user["id"])` 过滤条件来进行鉴权，但这种设计模式是**极其脆弱**的。

**影响范围**：
只要开发者在新增接口或重构复杂查询时（尤其是关联查询），遗漏了任何一个 `.eq("user_id", ...)` 的条件，系统就会立即产生**水平越权漏洞（IDOR/BOLA）**，允许攻击者任意读取、修改或删除其他用户的核心资产（工作流、节点、知识库文档）。

### 修复建议
1. **区分访问级别**：仅在真正的后端管理路由或不需要用户鉴权的后台任务中使用 `service_role`。
2. **应用 JWT 透传与 RLS**：对于所有需要鉴权的 API 请求，应当将验证后的用户 JWT token 直接向下传递给 Supabase 客户端，实例化一个用户级别的客户端（类似于 `get_anon_db` 结合用户的 access token）。这样所有的数据库读写操作都能受到 Supabase 数据库侧定义的 RLS 规则的自动保护，形成纵深防御（Defense in Depth）。
3. 如果由于历史包袱无法切换客户端，必须建立极其严格的代码审计制度（Code Review），或者通过 ORM 层的切面（Aspect）强制拦截所有业务表的查询，确保一定带有 `user_id` 的匹配条件。