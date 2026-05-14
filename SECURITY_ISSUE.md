# 潜在的安全问题分析报告

在对 StudySolo 仓库最新代码进行深度审查与安全扫描后（结合 Bandit 和 Semgrep 分析），发现了以下几个潜在的安全漏洞和配置问题，需要予以修复：

## 1. 前端路径穿越（Path Traversal / LFI）
**文件位置**: `frontend/src/lib/wiki.ts`
**具体代码**:
```typescript
export async function getDocContent(slug: string): Promise<{
  content: string;
  frontmatter: DocMeta;
}> {
  const filePath = path.join(WIKI_CONTENT_PATH, `${slug}.md`);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
```
**风险描述**:
前端应用在 `getDocContent` 中直接使用用户传入或未严格校验的 `slug` 参数拼接文件路径 `path.join(WIKI_CONTENT_PATH, \`${slug}.md\`)`，这可能导致路径穿越漏洞。攻击者可以通过传递诸如 `../../../etc/passwd` 等 payload，跳出设定的目录限制，读取系统上的其他文件（尽管有 `.md` 后缀限制，但仍可能读取到意外的敏感 Markdown 文件或进行其他路径利用）。
**修复建议**:
在拼接文件路径前，对 `slug` 进行严格的字符过滤，确保它不包含 `../`，或验证拼接后的绝对路径确实在 `WIKI_CONTENT_PATH` 目录下。

## 2. 不安全的伪随机数生成（Insecure Randomness）
**文件位置**: `backend/app/services/email_service.py`
**具体代码**:
```python
def _generate_code(length: int = 6) -> str:
    """Generate a random numeric verification code."""
    return "".join(random.choices(string.digits, k=length))
```
**风险描述**:
系统在生成重置密码和注册验证用的 6 位验证码时，使用了 Python 标准库的 `random` 模块。`random` 生成的是伪随机数，其结果对于攻击者是可预测的，不应用于任何安全性依赖的场景（如密码重置令牌、验证码）。
**修复建议**:
应当使用 Python 提供的安全随机模块 `secrets` 来替换 `random`，例如：`"".join(secrets.choice(string.digits) for _ in range(length))`。

## 3. 潜在的服务器端请求伪造（SSRF）风险
**文件位置**: `backend/app/services/workflow_generator.py`
**具体代码**:
```python
        req = Request(
            "http://127.0.0.1:7807/ingest/6761d4ab-0d6d-4e94-a0bc-90a491230a9a",
            method="POST",
            headers={"Content-Type": "application/json", "X-Debug-Session-Id": "f04052"},
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        )
        with urlopen(req, timeout=0.2):
            pass
```
以及 Agents 目录下的爬虫工具。
**风险描述**:
在 `workflow_generator.py` 等文件中使用了 `urllib.request.urlopen` 进行硬编码的 HTTP 请求，以及在 `agents/news-agent/src/lib/http.py` 内部发生了不受限制的动态 URL 访问（通过 Semgrep 检测到 `dynamic-urllib-use-detected`）。如果没有对传入的 URL 和网络协议进行严格过滤，这很容易引发 SSRF（服务端请求伪造）攻击，攻击者可诱使服务端向内网其他系统发起请求。
**修复建议**:
在发起请求前校验 URL（限制仅为 `http/https`，屏蔽本地和内网 IP 如 `127.0.0.1`，除非明确需要该白名单访问），并考虑使用安全性更高、超时控制更完善的 `httpx` 或 `requests`。

## 4. 宽松的 CORS 配置（Wildcard CORS）
**文件位置**: `agents/news-agent/src/core/news/app.py`
**具体代码**:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```
**风险描述**:
在代理节点（如 `news-agent`）的 FastAPI 服务中，CORS（跨源资源共享）配置允许任何来源（`allow_origins=["*"]`）。如果此服务直接暴露在外网或对权限控制不严格，恶意站点可以通过跨域请求读取服务敏感信息。
**修复建议**:
将 `allow_origins=["*"]` 替换为明确的源端点白名单配置（如读取环境变量 `CORS_ORIGIN` 进行限制，参考主站的 `backend/app/middleware/security.py` 的做法）。

## 5. Docker 容器权限配置缺陷（Root User）
**文件位置**: `agents/news-agent/Dockerfile`, `agents/deep-research-agent/Dockerfile`, 等等
**风险描述**:
项目下多个 `Dockerfile` 在构建镜像时，均没有指定运行用户的指令（`USER`），这导致默认情况下容器内的服务以 `root` 权限运行。一旦服务中出现 RCE（远程命令执行）或其他突破容器隔离的漏洞，攻击者将轻易获得高权限。
**修复建议**:
在 `Dockerfile` 末尾，执行主程序之前创建并切换至非 `root` 用户运行。
```dockerfile
RUN useradd -m appuser
USER appuser
```

## 6. 其他代码异味 / 风险点
*   **断言的使用**: 在测试以及部分实现代码（`backend/app/services/llm/router.py` 等）中大量使用了 `assert`。在 Python 运行时开启优化标志（`-O`）时，`assert` 语句会被自动忽略，如果业务逻辑依赖断言进行安全校验，则校验会被绕过。
*   **异常被吞没（Try/Except Pass）**: 在 `backend/app/api/auth/login.py` (line 71) 等多处存在捕捉异常后直接 `pass` 的逻辑。这在网络和数据库交互中可能会掩盖底层出现的认证失败或系统隐患。