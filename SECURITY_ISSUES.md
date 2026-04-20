# StudySolo 安全漏洞检查报告

在深度检查仓库代码后，发现了以下几个潜在的严重安全问题。请开发团队关注并修复：

## 1. PDF 导出功能存在严重的 SSRF 与任意本地文件读取（LFI）漏洞

**位置**：`backend/app/services/file_converter.py` 的 `export_pdf` 函数。

**详细描述**：
导出 PDF 时，采用了先将 Markdown 转换为 HTML，再使用 `Weasyprint` 渲染为 PDF 的策略：
```python
html_content = markdown.markdown(
    content,
    extensions=["tables", "fenced_code", "codehilite"],
)
# ...
WeasyprintHTML(string=styled_html).write_pdf(filepath)
```
Python 的 `markdown` 库默认**不会**对 HTML 标签进行转义或过滤。如果用户传入的 `content` 包含恶意的 HTML 标签（如 `<img src="file:///etc/passwd">` 或 `<img src="http://169.254.169.254/latest/meta-data/">`），这些标签会被原样保留。
随后，`Weasyprint` 在渲染 PDF 时会尝试获取 `<img>` 或 `<link>` 指向的外部资源，导致以下两个致命漏洞：
- **任意本地文件读取（LFI）**：攻击者可以通过渲染包含本地文件的图片标签，并在最终生成的 PDF 中查看目标文件的内容或使得服务报错泄露信息。
- **服务端请求伪造（SSRF）**：攻击者可以向内部网络发送 HTTP 请求，探测内网接口或获取云服务器的元数据（如 AWS/Aliyun Metadata）。

**修复建议**：
1. 强烈建议在使用 `markdown.markdown()` 后，使用 `bleach` 等库清洗生成的 HTML 代码，彻底清除 `<img>`、`<script>`、`<iframe>`、`<link>` 等不安全标签及其属性。
2. 配置 `Weasyprint` 的 `url_fetcher`：通过传递自定义的 URL Fetcher 函数，拦截所有非 HTTP/HTTPS 请求，并限制其仅能访问受信任的外部域名或直接拒绝加载外部资源。

---

## 2. 前端环境变量注入导致严重的跨站脚本（XSS）漏洞

**位置**：`frontend/src/app/layout.tsx` 的 RootLayout。

**详细描述**：
为了在客户端注入环境变量，应用在 `<body>` 标签内直接拼接了 JSON 数据作为 `<script>` 的内容：
```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `window.__ENV__=${JSON.stringify({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      // ...
    })};`,
  }}
/>
```
`JSON.stringify` 并不会转义 `<` 等特殊字符。如果攻击者通过某种途径控制了 `.env` 文件或容器的环境变量（或某个变量本身包含了恶意输入），注入诸如 `</script><script>alert(1)</script>`，则会导致浏览器的 HTML 解析器提前闭合当前标签，并执行注入的恶意 JavaScript。

**修复建议**：
在将其放入 `__html` 前，应该对 `JSON.stringify` 产生的字符串进行字符替换，特别是将 `<` 转义为其 Unicode 形式，例如：
```typescript
JSON.stringify(...).replace(/</g, '\\u003c')
```

---

## 3. 验证码生成存在安全隐患（使用了不安全的随机数发生器）

**位置**：`backend/app/services/email_service.py` 的 `_generate_code` 函数。

**详细描述**：
在生成六位数字的邮箱验证码时，使用了标准的 `random.choices`：
```python
def _generate_code(length: int = 6) -> str:
    """Generate a random numeric verification code."""
    return "".join(random.choices(string.digits, k=length))
```
Python 的内置模块 `random` 并非加密安全（Cryptographically Secure）。它的算法是基于 Mersenne Twister 的伪随机数生成器。如果攻击者能够收集到一定数量的连续验证码，可能能推测出生成器的内部状态，从而预测出未来发出的验证码，导致验证码被绕过。

**修复建议**：
应替换为加密安全的随机数生成器 `secrets` 模块：
```python
import secrets
import string

def _generate_code(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))
```

---

## 4. Path Traversal（路径遍历）风险虽然被拦截，但存在逻辑疏漏

**位置**：`backend/app/api/exports.py` 的 `download_export` 函数。

**详细描述**：
代码中包含这样的安全校验：
```python
real_path = os.path.realpath(filepath)
real_export = os.path.realpath(EXPORT_DIR)
if not real_path.startswith(real_export):
    raise HTTPException(status_code=403, detail="访问被拒绝")
```
这是一个常见的安全陷阱：使用 `startswith` 检查路径安全性并不完全严谨。如果 `EXPORT_DIR` 解析后为 `/tmp/exports`，此时一个指向 `/tmp/exports_malicious/secret.txt` 的 `real_path` 也会通过验证，因为字符串 `/tmp/exports_malicious/...` 确实以 `/tmp/exports` 开头。
尽管在这段代码前面使用了 `os.path.basename(filename)` 和特定字符过滤，使其暂时不可被直接利用。但这种防御逻辑属于典型的"深度防御"隐患，未来如果上层过滤逻辑被修改，该层校验将无法发挥作用。

**修复建议**：
不要使用 `startswith` 校验路径。应通过 `os.path.commonpath` 或 `pathlib` 进行判断：
```python
from pathlib import Path

export_dir_path = Path(EXPORT_DIR).resolve()
file_path = Path(filepath).resolve()
if not file_path.is_relative_to(export_dir_path):
    raise HTTPException(status_code=403, detail="访问被拒绝")
```