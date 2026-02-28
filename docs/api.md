# StudySolo 接口契约

> 最后更新：2026-02-28
> 这份文件防止 AI 自己"脑补"接口。所有前后端通信必须严格遵循此契约。

## 请求/响应统一格式

### 成功响应

```json
// 单对象
{ "id": "xxx", "name": "xxx", ... }

// 列表
[{ "id": "xxx", ... }, { "id": "yyy", ... }]

// 操作确认
{ "message": "操作成功" }
{ "success": true }
```

### 错误响应

```json
{
  "detail": "错误描述信息（中文）"
}
```

HTTP 状态码约定：
- `200` — 成功
- `201` — 创建成功
- `400` — 请求参数错误
- `401` — 未认证 / Token 过期
- `404` — 资源不存在
- `500` — 服务器内部错误
- `503` — AI 服务暂时不可用

### 分页结构（预留）

当前 MVP 不分页，后续扩展时使用：
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

## 鉴权方式

### Cookie-based JWT

- 登录成功后，后端通过 `Set-Cookie` 写入 `access_token` 和 `refresh_token`
- 两个 Cookie 均为 `HttpOnly`，前端 JS 无法读取
- 每次请求浏览器自动携带 Cookie，后端 JWT 中间件验证
- 开发环境 `secure=False`（HTTP 可用），生产环境 `secure=True`（仅 HTTPS）

### Cookie 配置

```python
_COOKIE_OPTS = dict(
    httponly=True,
    secure=not _IS_DEV,  # 生产环境 True
    samesite="lax",
    path="/",
)
```

### Token 刷新流程

```
access_token 过期 → 前端 middleware.ts 检测
  → POST /api/auth/refresh（自动携带 refresh_token Cookie）
  → 后端写入新 Cookie
  → 重定向回原页面
```

### 前端路由守卫

- `middleware.ts` 检查 `access_token` Cookie 是否存在
- 不存在则重定向到 `/login`
- 公开路由白名单：`/`, `/login`, `/register`

---

## 已有接口端点列表

### 认证接口 `/api/auth/*`

| 方法 | 端点 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/auth/register` | 用户注册 | `{ email, password }` | `201 { message }` |
| POST | `/api/auth/login` | 用户登录 | `{ email, password }` | `200 { access_token, user: UserInfo }` + Set-Cookie |
| POST | `/api/auth/logout` | 退出登录 | 无 | `200 { message }` + Delete-Cookie |
| POST | `/api/auth/refresh` | 刷新 Token | 无（Cookie 自动携带） | `200 { message }` + Set-Cookie |
| GET | `/api/auth/me` | 获取当前用户 | 无 | `200 UserInfo` |

#### UserInfo 结构

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "用户名 | null",
  "avatar_url": "头像URL | null",
  "role": "user"
}
```

### 工作流接口 `/api/workflow/*`

| 方法 | 端点 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/workflow` | 获取工作流列表 | 无 | `200 WorkflowMeta[]` |
| POST | `/api/workflow` | 创建工作流 | `{ name, description? }` | `201 WorkflowMeta` |
| GET | `/api/workflow/{id}/content` | 获取工作流完整内容 | 无 | `200 WorkflowContent` |
| PUT | `/api/workflow/{id}` | 更新工作流 | `{ name?, description?, nodes_json?, edges_json?, status? }` | `200 WorkflowMeta` |
| DELETE | `/api/workflow/{id}` | 删除工作流 | 无 | `200 { success: true }` |
| GET | `/api/workflow/{id}/execute` | SSE 执行工作流 | 无 | `text/event-stream` |

#### WorkflowMeta 结构

```json
{
  "id": "uuid",
  "name": "工作流名称",
  "description": "描述 | null",
  "status": "draft | running | completed | error",
  "created_at": "2026-02-28T12:00:00Z",
  "updated_at": "2026-02-28T12:00:00Z"
}
```

#### WorkflowContent 结构

```json
{
  "id": "uuid",
  "name": "工作流名称",
  "description": "描述 | null",
  "nodes_json": [{ "id": "node-1", "type": "outline_gen", "position": { "x": 0, "y": 100 }, "data": { "label": "生成大纲", "system_prompt": "...", "model_route": "...", "status": "pending", "output": "" } }],
  "edges_json": [{ "id": "edge-1", "source": "node-1", "target": "node-2" }],
  "status": "draft",
  "created_at": "2026-02-28T12:00:00Z",
  "updated_at": "2026-02-28T12:00:00Z"
}
```

#### SSE 事件类型

| 事件 | 数据结构 | 说明 |
|------|---------|------|
| `node_status` | `{ node_id, status }` | 节点状态变更 |
| `node_token` | `{ node_id, token }` | AI 流式输出 token |
| `node_done` | `{ node_id, output }` | 节点执行完成 |
| `workflow_done` | `{ workflow_id, status }` | 工作流执行完成 |
| `save_error` | `{ workflow_id, error }` | 自动保存失败（预留） |

### AI 接口 `/api/ai/*`

| 方法 | 端点 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/ai/generate-workflow` | AI 生成工作流 | `{ user_input }` | `200 GenerateWorkflowResponse` |

#### GenerateWorkflowRequest

```json
{
  "user_input": "用户自然语言学习目标（1-2000字符）"
}
```

#### GenerateWorkflowResponse

```json
{
  "nodes": [WorkflowNodeSchema],
  "edges": [WorkflowEdgeSchema],
  "implicit_context": {
    "global_theme": "核心学习目标",
    "language_style": "简洁专业",
    "core_outline": ["步骤1", "步骤2"],
    "target_audience": "学习者",
    "user_constraints": {}
  }
}
```

---

## 接口命名规则

| 规则 | 正例 | 反例 |
|------|------|------|
| RESTful 资源命名，复数名词 | `/api/workflow` | `/api/getWorkflows` |
| 动作用 HTTP 方法表达 | `POST /api/workflow` (创建) | `/api/workflow/create` |
| 嵌套资源用路径表达 | `/api/workflow/{id}/content` | `/api/workflow-content/{id}` |
| SSE 端点用 GET | `GET /api/workflow/{id}/execute` | `POST /api/workflow/{id}/execute` |
| 认证相关用动词 | `/api/auth/login`, `/api/auth/refresh` | `/api/auth/session` |
| 路径全小写，用连字符分隔 | `/api/ai/generate-workflow` | `/api/ai/generateWorkflow` |

---

## 安全约定

- 所有 API 端点（除 `/api/auth/register` 和 `/api/auth/login`）需要认证
- 认证通过 `get_current_user` 依赖注入实现
- Supabase RLS 确保用户只能访问自己的数据（`user_id` 隔离）
- AI 输入经过 `sanitize_user_input` 防注入处理
- 请求体大小限制：Nginx `client_max_body_size 10m`
- API 限流：通用 10r/s，AI 2r/s，登录 5r/m
