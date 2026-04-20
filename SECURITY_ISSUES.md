# StudySolo Backend Security Audit Report

在对 `backend` 代码库的深入分析中，发现以下潜在的安全漏洞与风险。建议尽快修复以保障系统安全。

## 1. `X-Forwarded-For` 请求头伪造导致的 IP 速率限制绕过与审计日志伪造
**风险等级：高**

**漏洞描述**：
在 `backend/app/api/auth/_helpers.py` 的 `resolve_client_ip` 函数，以及 `backend/app/services/audit_logger.py` 的 `get_client_info` 函数中，系统直接读取并无条件信任了 `X-Forwarded-For` 请求头，以提取客户端 IP。
由于缺少对反向代理的配置校验，攻击者可以在 HTTP 请求中自行添加任意的 `X-Forwarded-For` 头，直接伪造来源 IP。

**漏洞影响**：
1. **速率限制绕过**：攻击者可以通过不断更换伪造的 IP，完美绕过邮箱验证码发送和密码重置的速率限制（`is_rate_limited`）。这会导致验证码爆破和短信/邮件轰炸攻击。
2. **审计日志伪造**：在管理员系统的审计日志中记录的 `ip_address` 将毫无价值，攻击者可以轻易伪造恶意操作的 IP 来源，增加追踪溯源的难度。

**修复建议**：
如果应用程序运行在受信任的反向代理（如 Nginx）之后，建议使用 FastAPI 的 `ProxyHeadersMiddleware` 结合 Uvicorn 的 `--forwarded-allow-ips` 配置，而不是手动解析 header。确保只接受来自已知代理 IP 的 `X-Forwarded-For`。

---

## 2. 不安全的随机数生成器用于生成身份验证码
**风险等级：中**

**漏洞描述**：
在 `backend/app/services/email_service.py` 中，生成 6 位数验证码的方法如下：
```python
def _generate_code(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))
```
`random` 模块基于 Mersenne Twister，这是一个伪随机数生成器（PRNG），并非加密安全的（CSPRNG）。

**漏洞影响**：
如果攻击者能够收集到一定数量的验证码样本，就可以逆向推算出随机数生成器的内部状态，从而准确预测后续将生成的验证码，最终造成账户接管风险。

**修复建议**：
使用 `secrets` 模块替代 `random` 模块：
```python
import secrets
import string

def _generate_code(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))
```

---

## 3. 管理员 JWT 鉴权绕过风险（未校验 `aud` / `iss` 且检查宽松）
**风险等级：高（基于配置）**

**漏洞描述**：
在 `backend/app/middleware/admin_auth.py` 中，`AdminJWTMiddleware` 手动使用 `jwt.decode` 解码 Token，但仅验证了密钥和 `payload.get("type") == "admin"`。
由于它与用户的 Supabase Auth 共享相同的 `jwt_secret`，这带来了交叉混淆风险。

**漏洞影响**：
如果普通用户的 JWT 中可以通过 `user_metadata` 等方式被注入 `type: admin`，或者如果系统存在其他签发使用了相同 `jwt_secret` 的 JWT 的地方，攻击者可以利用这个签名构造一个通过 `AdminJWTMiddleware` 校验的伪造 Token，从而实现权限提升，获取管理员权限。

**修复建议**：
- 为管理员 Token 设置独立的 JWT Secret。
- 如果必须共用 Secret，应当严格校验 `aud`、`iss` 字段，并在 Payload 中使用不可被用户控制的顶层字段来声明管理员角色。

---

## 4. 基于 Nginx 反向代理配置的开发模式 Loopback 授权绕过
**风险等级：中**

**漏洞描述**：
在 `backend/app/middleware/admin_auth.py` 和 `backend/app/core/deps.py` 中，存在为开发环境保留的本地免鉴权通道：
```python
is_dev = settings.environment.lower() in ("development", "dev", "local")
is_loopback = client_host in _LOOPBACK_HOSTS # _LOOPBACK_HOSTS 为 127.0.0.1 等
```
这里利用了 `request.client.host` 作为判断依据。然而，如果后端运行在 Nginx 等反向代理之后且未正确配置代理头解析，FastAPI 读取到的 `request.client.host` 将**始终为 127.0.0.1**。

**漏洞影响**：
如果在生产或外网可访问的环境中，由于疏忽将 `ENVIRONMENT` 误配置为 `development`，此时所有的外部公网请求都会因为 Nginx 的代理被判定为 `is_loopback=True`，导致管理员诊断等相关接口（如 `/api/admin/diagnostics/full`）被公网任意用户未授权访问，造成敏感系统信息泄露。

**修复建议**：
开发环境免密后门应当基于硬性端口限制或者干脆在部署环境中彻底移除，不应仅依靠 `request.client.host` 来做安全阻断判断。

---

## 5. 硬编码的内部调试与数据收集 Endpoint (潜在 SSRF/信息泄露)
**风险等级：低**

**漏洞描述**：
在 `backend/app/services/workflow_generator.py` 中存在一段使用 `urllib.request.urlopen` 发送调试信息的硬编码逻辑：
```python
        req = Request(
            "http://127.0.0.1:7807/ingest/6761d4ab-0d6d-4e94-a0bc-90a491230a9a",
            method="POST",
            headers={"Content-Type": "application/json", "X-Debug-Session-Id": "f04052"},
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        )
```

**漏洞影响**：
这不仅把敏感的执行流程数据发到了本地硬编码的 `7807` 端口（如果存在外部控制监听，可能导致敏感日志泄露），也是一种硬编码的 `HTTP` 明文请求。动态拼接 urlopen 存在 SSRF 的基础隐患，应该清理这类无用的测试与遥测代码。

**修复建议**：
删除上述测试打点代码，或者将其配置化并通过安全的 HTTPS 传输发送至遥测服务器。