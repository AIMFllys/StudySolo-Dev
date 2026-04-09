# StudySolo API 规范

> 最后更新：2026-03-26
> 文档编码：UTF-8（无 BOM） / LF
> 事实源：`backend/app/api/*`、`backend/app/models/*`、`frontend/src/types/*`

本文档描述当前项目对外与前后端内部约定的 HTTP 契约。路径、字段与分组均以真实路由与 Pydantic 模型为准。

## 1. 基础规则

### 1.1 前缀

- 全部业务接口挂在 `/api`
- 用户接口在 `/api/auth/*`、`/api/workflow/*`、`/api/ai/*` 等域下
- 后台接口统一在 `/api/admin/*`

### 1.2 返回格式

成功返回：

- 单对象：`{ ... }`
- 列表：`{ items: [...] }`、`{ calls: [...] }` 或直接数组
- 布尔确认：`{ success: true }`

错误返回：

```json
{
  "detail": "错误信息"
}
```

### 1.3 常见状态码

- `200`
- `201`
- `202`
- `400`
- `401`
- `403`
- `404`
- `409`
- `500`
- `503`

## 2. 认证接口

### 2.1 用户认证

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/api/auth/send-code` | 注册验证码 |
| `POST` | `/api/auth/register` | 注册 |
| `POST` | `/api/auth/resend-verification` | 重发验证 |
| `POST` | `/api/auth/login` | 登录 |
| `POST` | `/api/auth/logout` | 登出 |
| `POST` | `/api/auth/refresh` | 刷新会话 |
| `POST` | `/api/auth/sync-session` | 同步会话 |
| `POST` | `/api/auth/forgot-password` | 发起重置 |
| `POST` | `/api/auth/reset-password` | 重置密码 |
| `POST` | `/api/auth/reset-password-with-code` | 验证码重置 |
| `GET` | `/api/auth/me` | 当前用户 |
| `POST` | `/api/auth/captcha-challenge` | 获取挑战 |
| `POST` | `/api/auth/captcha-token` | 校验挑战 |

### 2.2 后台认证

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/api/admin/login` | 后台登录 |
| `POST` | `/api/admin/logout` | 后台登出 |
| `POST` | `/api/admin/change-password` | 修改后台密码 |

## 3. 工作流接口

### 3.1 CRUD 与执行

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/workflow` | 工作流列表 |
| `POST` | `/api/workflow` | 创建工作流 |
| `GET` | `/api/workflow/{workflow_id}/content` | 画布内容 |
| `PUT` | `/api/workflow/{workflow_id}` | 更新工作流 |
| `DELETE` | `/api/workflow/{workflow_id}` | 删除工作流 |
| `GET` | `/api/workflow/{workflow_id}/execute` | 执行并监听 SSE |

### 3.2 社交与公开域

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/api/workflow/{workflow_id}/like` | 点赞切换 |
| `POST` | `/api/workflow/{workflow_id}/favorite` | 收藏切换 |
| `GET` | `/api/workflow/{workflow_id}/public` | 公开视图 |
| `GET` | `/api/workflow/marketplace` | 市场列表 |
| `POST` | `/api/workflow/{workflow_id}/fork` | Fork 公共工作流 |

### 3.3 协作域

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/api/workflow/{workflow_id}/collaborators` | 邀请协作者 |
| `GET` | `/api/workflow/{workflow_id}/collaborators` | 协作者列表 |
| `DELETE` | `/api/workflow/{workflow_id}/collaborators/{user_id}` | 移除协作者 |
| `GET` | `/api/workflow/invitations` | 我的邀请 |
| `POST` | `/api/workflow/invitations/{invitation_id}/accept` | 接受邀请 |
| `POST` | `/api/workflow/invitations/{invitation_id}/reject` | 拒绝邀请 |
| `GET` | `/api/workflow/shared` | 与我共享的工作流 |

## 4. AI 接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/api/ai/generate-workflow` | 生成工作流 |
| `POST` | `/api/ai/chat` | 非流式对话 |
| `POST` | `/api/ai/chat-stream` | 流式对话 |
| `GET` | `/api/ai/models/catalog` | 用户侧模型目录 |
| `GET` | `/api/admin/models/catalog` | 后台完整模型目录 |
| `PUT` | `/api/admin/models/{sku_id}` | 更新模型目录 |

## 5. AI 聊天请求契约

权威模型：`backend/app/models/ai_chat.py`

### 5.1 关键字段

- `user_input`
- `canvas_context`
- `conversation_history`
- `selected_model_key`
- `selected_model`
- `selected_platform`
- `thinking_level`
- `mode`

### 5.2 规则

- 正式模型选择字段：`selected_model_key`
- 兼容字段：`selected_model`、`selected_platform`
- `mode`：`plan` / `chat` / `create`
- `thinking_level`：`fast` / `balanced` / `deep`

## 6. AI 模型目录契约

权威模型：`backend/app/models/ai_catalog.py`

目录条目字段：

- `sku_id`
- `family_id`
- `family_name`
- `provider`
- `vendor`
- `model_id`
- `display_name`
- `billing_channel`
- `task_family`
- `routing_policy`
- `required_tier`
- `is_enabled`
- `is_visible`
- `is_user_selectable`
- `is_fallback_only`
- `supports_thinking`
- `max_context_tokens`
- `input_price_cny_per_million`
- `output_price_cny_per_million`
- `price_source`
- `pricing_verified_at`
- `sort_order`

## 7. 节点与知识库接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/nodes/manifest` | 节点清单 |
| `POST` | `/api/knowledge/upload` | 上传文档 |
| `GET` | `/api/knowledge` | 文档列表 |
| `GET` | `/api/knowledge/{document_id}` | 文档详情 |
| `POST` | `/api/knowledge/query` | 检索问答 |
| `DELETE` | `/api/knowledge/{document_id}` | 删除文档 |

## 8. 导出与反馈接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/exports/download/{filename}` | 下载文件 |
| `POST` | `/api/feedback` | 提交反馈并发放奖励 |
| `GET` | `/api/feedback/mine` | 我的反馈历史 |

反馈请求字段：

- `rating`
- `issue_type`
- `content`

## 9. usage 接口

权威模型：`backend/app/models/usage.py`

### 9.1 用户侧

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/usage/overview?range=24h|7d|30d` | 总览 |
| `GET` | `/api/usage/live?window=5m|60m` | 实时窗口 |
| `GET` | `/api/usage/timeseries?range=24h|7d|30d&source=assistant|workflow|all` | 时序数据 |

### 9.2 后台侧

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard/ai-overview` | 总览 |
| `GET` | `/api/admin/dashboard/ai-live` | 实时 |
| `GET` | `/api/admin/dashboard/ai-timeseries` | 时序 |
| `GET` | `/api/admin/dashboard/ai-model-breakdown` | 模型拆分 |
| `GET` | `/api/admin/dashboard/ai-recent-calls` | 最近调用 |
| `GET` | `/api/admin/dashboard/ai-cost-split` | 成本拆分 |

### 9.3 正式计费字段

- `provider_call_count`
- `successful_provider_call_count`
- `total_tokens`
- `cost_amount_cny`
- `total_cost_cny`
- `fallback_rate`
- `p95_latency_ms`

## 10. 后台接口

### 10.1 仪表盘

- `/api/admin/dashboard/overview`
- `/api/admin/dashboard/charts`
- `/api/admin/dashboard/ai-*`

### 10.2 用户与工作流

- `/api/admin/users`
- `/api/admin/users/{user_id}`
- `/api/admin/users/{user_id}/status`
- `/api/admin/users/{user_id}/role`
- `/api/admin/workflows/stats`
- `/api/admin/workflows/running`
- `/api/admin/workflows/errors`

### 10.3 通知、评分、会员、配置、审计

- `/api/admin/notices`
- `/api/admin/notices/{notice_id}`
- `/api/admin/notices/{notice_id}/publish`
- `/api/admin/ratings/overview`
- `/api/admin/ratings/details`
- `/api/admin/members/stats`
- `/api/admin/members/list`
- `/api/admin/members/revenue`
- `/api/admin/config`
- `/api/admin/audit-logs`

## 11. 健康检查

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康检查 |

## 12. 契约约束

- 模型选择正式主键必须是 `selected_model_key`
- `provider` 表示实际调用平台
- `vendor` 表示模型厂商
- 目录展示必须来自 catalog API
- 新图表和新接口统一使用 `*_cny`
- 文档不得遗漏已存在的 `feedback`、`usage`、`workflow_social`、`workflow_collaboration`、`admin_models`
