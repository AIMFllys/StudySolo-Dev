# StudySolo API 规范

> 最后更新：2026-04-16（与 `backend/app/api/router.py` 对齐）
> 文档编码：UTF-8（无 BOM） / LF
> 事实源：`backend/app/api/*`、`backend/app/models/*`、`frontend/src/types/*`

本文档描述 StudySolo 项目的 HTTP API 契约。路径以 `backend/app/api/router.py` 为准。

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
| `POST` | `/api/auth/login` | 登录 |
| `POST` | `/api/auth/register` | 注册 |
| `POST` | `/api/auth/logout` | 登出 |
| `POST` | `/api/auth/refresh` | 刷新会话 |
| `POST` | `/api/auth/forgot-password` | 发起重置 |
| `POST` | `/api/auth/reset-password` | 重置密码 |
| `GET` | `/api/auth/me` | 当前用户 |
| `POST` | `/api/auth/captcha-challenge` | 生成拼图验证码 challenge |
| `POST` | `/api/auth/captcha-token` | 校验拼图并换取 token |
| `POST` | `/api/auth/consent` | 提交同意书 |
| `GET` | `/api/auth/consent/status` | 查询同意书状态 |
| `POST` | `/api/auth/sync-session` | 同步会话 |
| `POST` | `/api/auth/send-code` | 发送验证码 |
| `POST` | `/api/auth/resend-verification` | 重发验证邮件 |
| `POST` | `/api/auth/reset-password-with-code` | 使用验证码重置密码 |

**来源**：`backend/app/api/auth/`

### 2.2 后台认证

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `/api/admin/login` | 后台登录 |
| `POST` | `/api/admin/logout` | 后台登出 |
| `POST` | `/api/admin/change-password` | 修改后台密码 |

## 3. 工作流接口

### 3.1 CRUD 与执行

| 方法 | 路径 | 用途 | 来源文件 |
| --- | --- | --- | --- |
| `GET` | `/api/workflow` | 工作流列表 | `api/workflow/crud.py` |
| `POST` | `/api/workflow` | 创建工作流 | `api/workflow/crud.py` |
| `GET` | `/api/workflow/{workflow_id}` | 获取单个 | `api/workflow/crud.py` |
| `PUT` | `/api/workflow/{workflow_id}` | 更新工作流 | `api/workflow/crud.py` |
| `DELETE` | `/api/workflow/{workflow_id}` | 删除工作流 | `api/workflow/crud.py` |
| `GET` | `/api/workflow/{workflow_id}/content` | 画布内容 | `api/workflow/crud.py` |
| `POST` | `/api/workflow/{workflow_id}/execute` | 执行并监听 SSE | `api/workflow/execute.py` |

> **Phase 2 变更**：Workflow 路由从 4 个散文件重组为 `api/workflow/` 子目录。

### 3.2 社交与公开域

| 方法 | 路径 | 用途 | 来源文件 |
| --- | --- | --- | --- |
| `POST` | `/api/workflow/{workflow_id}/like` | 点赞切换 | `api/workflow/social.py` |
| `POST` | `/api/workflow/{workflow_id}/favorite` | 收藏切换 | `api/workflow/social.py` |
| `GET` | `/api/workflow/{workflow_id}/public` | 公开视图 | `api/workflow/social.py` |
| `GET` | `/api/workflow/marketplace` | 市场列表 | `api/workflow/social.py` |
| `POST` | `/api/workflow/{workflow_id}/fork` | Fork 公共工作流 | `api/workflow/social.py` |

### 3.3 协作域

| 方法 | 路径 | 用途 | 来源文件 |
| --- | --- | --- | --- |
| `POST` | `/api/workflow/{workflow_id}/collaborators` | 邀请协作者 | `api/workflow/collaboration.py` |
| `GET` | `/api/workflow/{workflow_id}/collaborators` | 协作者列表 | `api/workflow/collaboration.py` |
| `DELETE` | `/api/workflow/{workflow_id}/collaborators/{user_id}` | 移除协作者 | `api/workflow/collaboration.py` |
| `GET` | `/api/workflow/invitations` | 我的邀请 | `api/workflow/collaboration.py` |
| `POST` | `/api/workflow/invitations/{invitation_id}/accept` | 接受邀请 | `api/workflow/collaboration.py` |
| `POST` | `/api/workflow/invitations/{invitation_id}/decline` | 拒绝邀请 | `api/workflow/collaboration.py` |
| `GET` | `/api/workflow/shared` | 与我共享的工作流 | `api/workflow/collaboration.py` |

### 3.4 执行记录

| 方法 | 路径 | 用途 | 来源文件 |
| --- | --- | --- | --- |
| `GET` | `/api/workflow-runs` | 执行记录列表 | `api/workflow/runs.py` |
| `GET` | `/api/workflow-runs/by-workflow/{workflow_id}` | 指定工作流的运行记录 | `api/workflow/runs.py` |
| `GET` | `/api/workflow-runs/all` | 当前用户全部运行记录 | `api/workflow/runs.py` |
| `GET` | `/api/workflow-runs/{run_id}` | 运行详情 | `api/workflow/runs.py` |
| `GET` | `/api/workflow-runs/{run_id}/public` | 公开运行详情 | `api/workflow/runs.py` |
| `POST` | `/api/workflow-runs/{run_id}/share` | 切换运行记录分享状态 | `api/workflow/runs.py` |

## 4. AI 接口

### 4.1 AI 聊天（Phase 2 合并后）

| 方法 | 路径 | 用途 | 说明 |
| --- | --- | --- | --- |
| `POST` | `/api/ai/chat` | 非流式对话 | Phase 2：合并自 `ai_chat.py` + `ai_chat_stream.py` |
| `POST` | `/api/ai/chat-stream` | 流式对话 | Phase 2：合并到同一 router |

**来源**：`backend/app/api/ai/chat.py`

> **Phase 2 变更**：`ai_chat.py` 和 `ai_chat_stream.py` 合并为 `api/ai/chat.py`，共享逻辑提取到 `services/ai_chat/`。

### 4.2 AI 生成

| 方法 | 路径 | 用途 | 来源文件 |
| --- | --- | --- | --- |
| `POST` | `/api/ai/generate-workflow` | 生成工作流 | `api/ai/generate.py` |

### 4.3 AI 模型目录

| 方法 | 路径 | 用途 | 来源文件 |
| --- | --- | --- | --- |
| `GET` | `/api/ai/models/catalog` | 用户侧模型目录 | `api/ai/catalog.py` |
| `GET` | `/api/ai/chat/models` | 聊天模型列表（轻量） | `api/ai/models.py` |

## 5. AI 聊天请求契约

**权威模型**：`backend/app/models/ai_chat.py`

### 5.1 关键字段

- `user_input`
- `canvas_context`
- `conversation_history`
- `selected_model_key`（**正式主入口**）
- `selected_platform`（兼容字段，已废弃）
- `selected_model`（兼容字段，已废弃）
- `thinking_level`
- `mode`

### 5.2 规则

- 正式模型选择字段：`selected_model_key`
- 兼容字段：`selected_model`、`selected_platform`
- `mode`：`plan` / `chat` / `create`
- `thinking_level`：`fast` / `balanced` / `deep`

## 6. AI 模型目录契约

**权威模型**：`backend/app/models/ai_catalog.py`

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

### 7.1 节点 Manifest

| 方法 | 路径 | 用途 | 来源文件 |
| --- | --- | --- | --- |
| `GET` | `/api/nodes/manifest` | 节点清单 | `api/nodes.py` |

### 7.2 知识库

| 方法 | 路径 | 用途 | 来源文件 |
| --- | --- | --- | --- |
| `POST` | `/api/knowledge/upload` | 上传文档 | `api/knowledge.py` |
| `GET` | `/api/knowledge` | 文档列表 | `api/knowledge.py` |
| `GET` | `/api/knowledge/{document_id}` | 文档详情 | `api/knowledge.py` |
| `POST` | `/api/knowledge/query` | 检索问答 | `api/knowledge.py` |
| `DELETE` | `/api/knowledge/{document_id}` | 删除文档 | `api/knowledge.py` |

## 8. 导出与反馈接口

| 方法 | 路径 | 用途 | 来源文件 |
| --- | --- | --- | --- |
| `GET` | `/api/exports/download/{filename}` | 下载文件 | `api/exports.py` |
| `POST` | `/api/feedback` | 提交反馈并发放奖励 | `api/feedback.py` |
| `GET` | `/api/feedback/mine` | 我的反馈历史 | `api/feedback.py` |

## 9. usage 接口

**权威模型**：`backend/app/models/usage.py`

### 9.1 用户侧

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/usage/overview?range=24h|7d|30d` | 总览 |
| `GET` | `/api/usage/live?window=5m|60m` | 实时窗口 |
| `GET` | `/api/usage/timeseries?range=24h|7d|30d&source=assistant|workflow|all` | 时序数据 |
| `GET` | `/api/usage/quota` | 当前用户配额 |

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

| 方法 | 路径 | 来源文件 |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard/overview` | `api/admin/dashboard.py` |
| `GET` | `/api/admin/dashboard/charts` | `api/admin/dashboard.py` |

### 10.2 用户与工作流

| 方法 | 路径 | 来源文件 |
| --- | --- | --- |
| `GET` | `/api/admin/users` | `api/admin/users.py` |
| `GET` | `/api/admin/users/{user_id}` | `api/admin/users.py` |
| `PATCH` | `/api/admin/users/{user_id}/status` | `api/admin/users.py` |
| `PATCH` | `/api/admin/users/{user_id}/role` | `api/admin/users.py` |
| `GET` | `/api/admin/workflows/stats` | `api/admin/workflows.py` |
| `GET` | `/api/admin/workflows/running` | `api/admin/workflows.py` |
| `GET` | `/api/admin/workflows/errors` | `api/admin/workflows.py` |

### 10.3 其他管理接口

| 方法 | 路径 | 用途 | 来源文件 |
| --- | --- | --- | --- |
| `GET/POST` | `/api/admin/notices` | 公告 CRUD | `api/admin/notices.py` |
| `POST` | `/api/admin/notices/{id}/publish` | 发布公告 | `api/admin/notices.py` |
| `GET` | `/api/admin/ratings/overview` | 评分统计 | `api/admin/ratings.py` |
| `GET` | `/api/admin/members/stats` | 会员统计 | `api/admin/members.py` |
| `GET` | `/api/admin/members/list` | 会员列表 | `api/admin/members.py` |
| `GET` | `/api/admin/members/revenue` | 会员收入 | `api/admin/members.py` |
| `GET/PUT` | `/api/admin/config` | 系统配置 | `api/admin/config.py` |
| `GET` | `/api/admin/audit-logs` | 审计日志 | `api/admin/audit.py` |

## 11.1 Agent / 优惠 / 社区节点域（补充）

| 方法 | 路径 | 用途 | 来源文件 |
| --- | --- | --- | --- |
| `GET` | `/api/agents` | Agent 列表 | `api/agents.py` |
| `POST` | `/api/agents/{name}/chat` | 调用指定 Agent | `api/agents.py` |
| `GET` | `/api/agents/{name}/health` | Agent 健康检查 | `api/agents.py` |
| `POST` | `/api/discounts/redeem` | 兑换码核销 | `api/discounts.py` |
| `GET` | `/api/community-nodes/` | 社区节点列表 | `api/community_nodes.py` |
| `POST` | `/api/community-nodes/` | 发布社区节点 | `api/community_nodes.py` |
| `GET` | `/api/community-nodes/mine` | 我的社区节点 | `api/community_nodes.py` |
| `GET` | `/api/community-nodes/{id}` | 社区节点详情 | `api/community_nodes.py` |
| `POST` | `/api/community-nodes/{id}/like` | 社区节点点赞 | `api/community_nodes.py` |
| `POST` | `/api/community-nodes/generate-schema` | 生成节点 schema | `api/community_nodes.py` |

### 10.4 AI 模型管理

| 方法 | 路径 | 用途 | 来源文件 |
| --- | --- | --- | --- |
| `GET` | `/api/admin/models/catalog` | 后台完整模型目录 | `api/admin/models.py` |
| `PUT` | `/api/admin/models/{sku_id}` | 更新模型目录 | `api/admin/models.py` |

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
- 文档不得遗漏已存在的 `feedback`、`usage`、`workflow_social`、`workflow_collaboration`、`admin_models`、`agents`、`discounts`、`community-nodes`

## 13. Phase 2 重构变更记录

| 变更 | 日期 | 说明 |
|------|------|------|
| Workflow 路由重组 | 2026-04-10 | 4 个散文件 → `api/workflow/` 子目录 |
| AI 路由重组 | 2026-04-10 | 5 个散文件 → `api/ai/` 子目录 |
| AI Chat 合并 | 2026-04-10 | `ai_chat.py` + `ai_chat_stream.py` → `api/ai/chat.py` |
| 共享逻辑提取 | 2026-04-10 | 聊天共享逻辑 → `services/ai_chat/` |

## 14. Phase 4/5 变更记录

| 变更 | 日期 | 说明 |
|------|------|------|
| Agent 四层协议冻结 | 2026-04-10 | `agent-architecture.md` 协议规范 v1.0 冻结 |
| Agent 样板完成 | 2026-04-11 | `agents/_template/` + `code-review-agent` 可运行 |
| 契约测试通过 | 2026-04-11 | `code-review-agent` 87 passed → Phase 4B 收口 177 passed |
| Agent Gateway 实现 | 2026-04-13 | `backend/app/services/agent_gateway/` + `backend/config/agents.yaml` |
| `/api/agents/*` 路由上线 | 2026-04-13 | `GET /api/agents`、`POST /api/agents/{name}/chat`、`GET /api/agents/{name}/health` |

> **注意**：API 路径前缀保持不变（`/api/workflow/*`、`/api/ai/*`），仅内部文件组织方式改变。
