# 🔍 工作流 SSE 流式输出 — 本地 vs 部署差异 Bug 总结

**Bug 描述**：工作流执行时的流式输出（SSE/打字机效果）在生产环境（部署后）正常工作，但在本地开发预览时失效，前端请求会一直处于 pending 状态，卡住直到整个工作流执行完毕后才将结果一次性全部渲染返回。

**根因总结**：
问题核心并非出现在后端 Streaming 逻辑中，而是出在开发架构的代理层。**Next.js Turbopack Dev Server 的内置 HTTP 代理（rewrites）会完全缓冲整个响应体**。
由于本地开发环境依赖 `next.config.ts` 中的 `rewrites` 将 `/api/workflow/{id}/execute` 代理转发到后端 2038 端口，原本设计为逐条推送的 SSE 数据流被这层代理拦截并全量缓冲了。
相反，生产环境中浏览器请求由 Nginx 直接反向代理到后端，且明确配置了 `proxy_buffering off` 和 `proxy_cache off`，因此流式传输能够正常穿透。

**解决方案推荐**：
创建针对工作流端点专门的 App Router Route Handler (`frontend/src/app/api/workflow/[workflowId]/execute/route.ts`)。利用原生的 Web Streams API，手动将后端响应逐字节 (byte-by-byte) 代理透传到前端处理，从而高优先级地绕过 Next.js `rewrites()` 带来的缓冲问题。此方案也与当前项目中成功处理 AI Chat 流式输出（`chat-stream/route.ts`）的解法保持架构上的一致。

---

## 附录：详细深度分析报告

# 🔍 工作流 SSE 流式输出 — 本地 vs 部署差异深度分析

> **结论先行**: 问题根因是 **Next.js Turbopack Dev Server 的 rewrites 代理会缓冲整个响应体**，导致
> SSE 事件无法逐条推送到浏览器。生产环境通过 Nginx 直接代理避开了这个问题。

---

## 📊 架构对比

### 生产环境 ✅ (流式正常)

```
浏览器 → Nginx (443)
         ├─ /api/* → FastAPI (2038) [proxy_buffering off]
         └─ /*     → Next.js (2037) [静态页面]
```

**关键**: Nginx 直接将 `/api/workflow/{id}/execute` 代理到 FastAPI 后端，
配置了 `proxy_buffering off` + `proxy_cache off`，SSE 事件实时穿透。

### 本地开发 ❌ (流式失败)

```
浏览器 → Next.js Dev Server (2037, Turbopack)
         └─ /api/* → [next.config.ts rewrites] → FastAPI (2038)
```

**关键**: 所有 `/api/*` 请求都先经过 Next.js Dev Server 的内置 HTTP 代理（rewrites），
这个代理会 **缓冲整个响应体** 后再转发给浏览器。

---

## 🔬 核心证据链

### 证据 1: `chat-stream/route.ts` 的注释已经记录了这个问题

```typescript
// frontend/src/app/api/ai/chat-stream/route.ts (第 1-13 行)

/**
 * SSE Streaming Proxy — Next.js App Router API Route.
 *
 * WHY: Next.js `rewrites()` in dev mode (Turbopack) uses an HTTP proxy that
 * buffers the entire response body before forwarding. This kills SSE streaming.
 *
 * This route.ts creates a native Web Streams proxy that passes through SSE
 * events byte-by-byte from the FastAPI backend to the browser, with zero buffering.
 */
```

**AI Chat 的流式输出已经通过创建 App Router `route.ts` 解决了这个问题。**

### 证据 2: Workflow Execute 没有对应的 route.ts

```
frontend/src/app/api/
└── ai/
    └── chat-stream/
        └── route.ts  ← 只有 AI Chat 有 SSE 代理！
```

**`/api/workflow/{id}/execute` 完全依赖 `next.config.ts` 的 rewrites，
这在 Turbopack 开发模式下会导致响应被缓冲。**

### 证据 3: Next.js rewrites 配置

```typescript
// frontend/next.config.ts (第 19-26 行)
async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${normalizedBackendUrl}/api/:path*`,  // → http://127.0.0.1:2038
      },
    ];
},
```

这条规则覆盖所有 `/api/*` 路径，但 **App Router route handlers 优先级高于 rewrites**。
所以 `chat-stream/route.ts` 会拦截 `/api/ai/chat-stream`，而 `/api/workflow/{id}/execute` 仍走 rewrites。

### 证据 4: 后端 SSE 实现正确，问题不在后端

```python
# backend/app/api/workflow_execute.py (第 168-175 行)
return StreamingResponse(
    event_generator(),
    media_type="text/event-stream",
    headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    },
)
```

后端正确使用了 `StreamingResponse` + `text/event-stream`，
并且设置了 `X-Accel-Buffering: no` 防止 Nginx 缓冲。

### 证据 5: 后端 Auth Middleware 已经做了正确的纯 ASGI 实现

```python
# backend/app/middleware/auth.py (第 1-8 行)
"""JWT Bearer Token validation middleware for protected API routes.

Uses Pure ASGI middleware to avoid response body buffering
that breaks SSE / StreamingResponse.

NOTE: BaseHTTPMiddleware wraps response body and consumes it fully
before forwarding — this kills SSE streaming. Pure ASGI middleware
passes the response through without buffering.
"""
```

后端中间件已经有意识地避免了 `BaseHTTPMiddleware` 的缓冲问题。

### 证据 6: 前端 SSE 消费端实现正确

```typescript
// frontend/src/features/workflow/hooks/use-workflow-execution.ts (第 116-133 行)
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const parsed = extractSseEvents(buffer);
  buffer = parsed.remainder;
  for (const event of parsed.events) {
    handleEvent(event.event, event.data);
  }
}
```

使用标准的 `ReadableStream` + `getReader()` 读取流，实现完全正确。
**在流式正常工作的情况下，每次 `reader.read()` 会收到一小块数据并立即处理。**
但当 Turbopack 的 rewrites 代理缓冲了整个响应体后，`reader.read()` 会一次性收到所有数据。

---

## 🎯 根因总结

| 层级 | 生产环境 | 本地开发 |
|------|---------|---------|
| **HTTP 代理** | Nginx (`proxy_buffering off`) | Next.js Turbopack rewrites (缓冲整个 body) |
| **SSE 路径** | `浏览器 → Nginx → FastAPI` | `浏览器 → Turbopack Proxy → FastAPI` |
| **SSE 行为** | 事件逐条推送 ✅ | 全部执行完毕后一次性返回 ❌ |

**Turbopack Dev Server 的内置 HTTP 代理不支持 SSE 流式传输。**
它将后端的 `StreamingResponse` 缓冲为普通 HTTP 响应后再整体发给浏览器。

---

## 💡 修复方案

### 方案 A: 创建专用 App Router Route (推荐，与 chat-stream 保持一致)

创建 `frontend/src/app/api/workflow/[workflowId]/execute/route.ts`，
用 Web Streams API 逐字节透传 SSE 事件，与 `chat-stream/route.ts` 同理。

**优点**: 
- 与已有 chat-stream 方案保持架构一致
- 在 dev 和 production 模式下行为统一
- App Router route 优先级高于 rewrites，自动覆盖

**缺点**: 
- 需要手动维护请求转发逻辑（headers、auth）

### 方案 B: 前端在本地开发时直连后端

修改 `use-workflow-execution.ts`，在开发环境下直接请求 `http://127.0.0.1:2038/api/workflow/{id}/execute` 而非走 `/api/workflow/{id}/execute`（rewrites）。

**优点**: 实现简单
**缺点**: 需要处理 CORS、cookie 跨域等问题，架构不统一

### 方案 C: Next.js 自定义 Dev Server

配置 Turbopack 使用自定义的 HTTP 代理中间件来禁用 SSE 路径的缓冲。

**优点**: 根治问题
**缺点**: 复杂度高，依赖 Next.js 内部 API

> [!IMPORTANT]
> **推荐方案 A**： 创建 `route.ts` 文件，与 `chat-stream` 保持架构一致。
> 这已经是项目中验证过的可行方案，且不影响生产环境。
