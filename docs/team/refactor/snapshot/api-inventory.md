# API 路由清单（快照）

> 快照时间：2026-04-09T23:40:00+08:00
> 数据来源：`backend/app/api/router.py` + 各路由文件实际统计

---

## 路由概览

| 域 | 路由文件 | 行数 | 路由数 | usage_ledger | prefix |
|----|---------|------|--------|-------------|--------|
| **Auth** | auth/login.py | 108 | 4 | ❌ | /auth |
| | auth/register.py | 187 | 3 | ❌ | /auth |
| | auth/password.py | 62 | 3 | ❌ | /auth |
| | auth/captcha.py | 181 | 2 | ❌ | /auth |
| | auth/consent.py | 86 | 2 | ❌ | /auth |
| | auth/me.py | 22 | 1 | ❌ | /auth |
| | auth/_helpers.py | 86 | 0 | ❌ | (helper) |
| **Workflow** | workflow.py | 187 | 7 | ❌ | /workflow |
| | workflow_execute.py | 450 | 2 | ✅ | /workflow |
| | workflow_social.py | 248 | 5 | ❌ | /workflow |
| | workflow_collaboration.py | 254 | 7 | ❌ | /workflow |
| | workflow_runs.py | 188 | 5 | ❌ | /workflow-runs |
| **AI** | ai.py | 50 | 1 | ✅ | /ai |
| | ai_catalog.py | 13 | 1 | ❌ | /ai |
| | ai_chat.py | 203 | 1 | ✅ | /ai |
| | ai_chat_stream.py | 273 | 0* | ✅ | /ai |
| | ai_chat_models.py | 82 | 1 | ❌ | /ai |
| **Nodes** | nodes.py | 77 | 2 | ❌ | /nodes |
| **Knowledge** | knowledge.py | 206 | 7 | ❌ | /knowledge |
| **Community** | community_nodes.py | 293 | 12 | ❌ | /community-nodes |
| **Other** | exports.py | 46 | 1 | ❌ | /exports |
| | feedback.py | 174 | 2 | ❌ | /feedback |
| | usage.py | 84 | 4 | ❌ | /usage |
| | discounts.py | 243 | 1 | ❌ | /discounts |
| **Admin** | admin_auth.py | 248 | 3 | ❌ | /admin |
| | admin_dashboard.py | 244 | 8 | ❌ | /admin |
| | admin_users.py | 305 | 4 | ❌ | /admin |
| | admin_notices.py | 323 | 6 | ❌ | /admin |
| | admin_workflows.py | 191 | 3 | ❌ | /admin |
| | admin_members.py | 155 | 3 | ❌ | /admin |
| | admin_ratings.py | 114 | 2 | ❌ | /admin |
| | admin_models.py | 53 | 2 | ❌ | /admin |
| | admin_config.py | 98 | 2 | ❌ | /admin |
| | admin_audit.py | 83 | 1 | ❌ | /admin |

> *`ai_chat_stream.py` 使用 `stream_router` (APIRouter) 而非 `@router` 装饰器

---

## 统计

| 指标 | 数值 |
|------|------|
| 总路由文件 | 35 |
| 总路由数 | ~110 |
| 使用 usage_ledger 的文件 | 4（ai.py, ai_chat.py, ai_chat_stream.py, workflow_execute.py） |
| 最大文件 | workflow_execute.py (450 行) |
| 最小文件 | ai_catalog.py (13 行) |

---

## 域分组建议（重构 Phase 2 参考）

| 域 | 当前文件数 | 建议目录化 |
|---|----------|----------|
| Auth | 6 | ✅ 已目录化 `auth/` |
| Workflow | 5 | → `api/workflow/` |
| AI | 5 | → `api/ai/` |
| Admin | 10 | → `api/admin/`（已有 prefix） |
| Other | 6 | 保持平铺 |
