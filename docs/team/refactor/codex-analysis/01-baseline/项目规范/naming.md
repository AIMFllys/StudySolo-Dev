# StudySolo 命名规范

> 最后更新：2026-03-26
> 文档编码：UTF-8（无 BOM） / LF

本文档定义 StudySolo 当前项目级命名规则。目标是让代码、数据库、接口、后台和文档使用同一套术语。

## 1. 通用命名规则

### 1.1 前端

- 变量、函数、属性：`camelCase`
- React 组件、类型、接口：`PascalCase`
- 常量：`UPPER_SNAKE_CASE`
- 布尔值：统一使用 `is` / `has` / `should` 前缀
- 事件处理函数：统一使用 `handle` 前缀
- 回调 props：统一使用 `on` 前缀

### 1.2 后端

- Python 模块、变量、函数：`snake_case`
- 类名：`PascalCase`
- 常量：`UPPER_SNAKE_CASE`
- Pydantic 字段：`snake_case`
- FastAPI 路由函数：`snake_case`

### 1.3 数据库

- 表名：`snake_case`
- 列名：`snake_case`
- 主键：优先 `id`
- 外键：`{resource}_id`
- 时间字段：`{action}_at`
- 布尔字段：`is_*` / `has_*`

## 2. 前缀命名规则

数据库前缀必须严格区分：

- 无前缀：共享层
- `ss_`：StudySolo
- `pt_`：Platform
- `fm_`：Forum
- `_`：系统元数据

## 3. 路由命名规则

- 用户认证：`/api/auth/*`
- 工作流：`/api/workflow/*`
- AI：`/api/ai/*`
- 知识库：`/api/knowledge/*`
- 导出：`/api/exports/*`
- 反馈：`/api/feedback/*`
- usage：`/api/usage/*`
- 后台：`/api/admin/*`

规则：

- 路由路径使用名词，不使用页面文案
- 集合接口优先复数或域前缀
- 操作型子资源使用明确动作名
- 后台接口统一从 `/api/admin/` 进入

## 4. AI 术语统一

| 术语 | 含义 | 示例 |
| --- | --- | --- |
| `provider` | 实际调用平台 | `deepseek`、`qiniu`、`siliconflow` |
| `vendor` | 原始模型厂商 | `deepseek`、`qwen`、`zhipu` |
| `model_id` | 平台实际请求的模型标识 | `deepseek-chat`、`Qwen3-Max` |
| `family_id` / `family` | 逻辑模型族 | `deepseek_reasoning`、`qwen_premium` |
| `sku_id` / `selected_model_key` | 可路由、可计费、可展示的具体模型条目 | `sku_qiniu_qwen3_max_proxy` |
| `billing_channel` | 计费通道类型 | `native`、`proxy`、`tool_service` |
| `routing_policy` | 路由策略 | `native_first`、`proxy_first`、`capability_fixed` |
| `task_family` | 任务能力族 | `cheap_chat`、`premium_chat`、`search`、`ocr` |

## 5. AI 术语禁止混用

### 5.1 `provider` 与 `vendor`

- `provider` 只能表示实际调用平台
- `vendor` 只能表示模型厂商

### 5.2 `model_id` 与 `display_name`

- `model_id` 只能用于实际 API 调用
- `display_name` 只用于 UI 展示

### 5.3 `family_id` 与 `sku_id`

- `family_id` 表示逻辑模型族
- `sku_id` 表示具体计费与路由条目

## 6. 正式字段与兼容字段

正式选型字段：

- `selected_model_key`

兼容字段：

- `selected_platform`
- `selected_model`

说明：

- `selected_model_key` 是新接口与新前端的正式主入口
- 兼容字段不再作为新契约设计基准

## 7. 计费与 usage 字段命名

正式计费字段：

- `input_price_cny_per_million`
- `output_price_cny_per_million`
- `cost_amount_cny`
- `total_cost_cny`

兼容字段：

- `cost_amount_usd`
- `total_cost_usd`

usage 账本表：

- `ss_ai_requests`
- `ss_ai_usage_events`
- `ss_ai_usage_minute`

## 8. 状态字段命名

工作流与执行统一使用 `status`，具体取值以模型或前端类型为准。

当前前端节点状态：

- `pending`
- `running`
- `waiting`
- `done`
- `error`
- `skipped`
- `paused`

## 9. 时间字段命名

- `created_at`
- `updated_at`
- `started_at`
- `completed_at`
- `finished_at`
- `expires_at`
- `published_at`
- `pricing_verified_at`

## 10. 文件命名规则

- Python：`snake_case.py`
- TypeScript / React 组件：`PascalCase.tsx` 或领域脚本文件
- 迁移文件：`YYYYMMDDHHMMSS_descriptive_name.sql`

## 11. 命名审查清单

以下情况视为不合规：

- 用 `provider` 表示模型厂商
- 用 `vendor` 表示实际调用平台
- 用 `display_name` 作为 API 请求参数
- 新代码继续把 `selected_platform + selected_model` 当主入口
- 新接口继续用 `*_usd` 作为正式金额字段
- 在文档里把 `shared` submodule 写成 subtree
