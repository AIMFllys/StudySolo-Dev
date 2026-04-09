# 项目 AI 调用及计费分析统一规范

> 最后更新：2026-03-26
> 编码要求：UTF-8

本文档是 StudySolo 当前 AI 调用、模型目录、平台计费、usage 账本和后台统计的统一权威规范。涉及 AI 配置、模型接入、AI 仪表盘、计费口径时，以本文为准。

## 1. 目标

StudySolo 现阶段必须同时满足四个目标：

- 便宜模型优先走原生 API，压低成本
- 贵模型优先走聚合平台，再逐级回原生，兼顾性价比与容灾
- 工具模型按能力固定平台，不和普通聊天模型混路由
- 后台和用户侧面板都基于同一套真实 usage 账本展示

## 2. 分层架构

### 2.1 运行时路由层

位置：

- `backend/config.yaml`
- `backend/app/core/config_loader.py`
- `backend/app/services/ai_router.py`

职责：

- provider 连接信息
- task route 映射
- fallback 顺序
- timeout / retry
- 平台角色

原则：

- 运行时关键路由逻辑保留在本地 YAML / Python
- 不允许后台直接修改 fallback 核心链

### 2.2 模型目录层

位置：

- `public.ai_model_families`
- `public.ai_model_skus`

职责：

- 模型族定义
- 平台级 SKU 定义
- 价格
- 可见性
- 用户可选开关
- premium 等级
- 价格来源与核验时间

原则：

- Supabase 是模型目录与价格中心
- 同名模型跨平台视为不同 SKU

### 2.3 Usage 账本层

位置：

- `public.ss_ai_requests`
- `public.ss_ai_usage_events`
- `public.ss_ai_usage_minute`

职责：

- 记录逻辑请求
- 记录真实 provider 调用尝试
- 记录分钟级聚合统计

原则：

- 统计按真实平台调用写账
- 成本按调用时价格快照结算

## 3. 模型分层策略

### 3.1 便宜模型

策略：

- `routing_policy = native_first`

适用范围：

- DeepSeek 全系
- 通义千问非 Max 系
- 大多数 Doubao
- GLM 4.5 / 4.6 / 4.7 及其低价模型
- Kimi 低价模型

说明：

- 主通道优先原生 API
- 聚合平台只作为补位和灾备

### 3.2 贵模型

策略：

- `routing_policy = proxy_first`

默认链路：

- `qiniu -> siliconflow -> native`

适用范围：

- 高价旗舰模型
- 高价长上下文模型
- 高价推理模型

说明：

- 先比较聚合平台性价比
- 再考虑回原生

### 3.3 工具模型

策略：

- `routing_policy = capability_fixed`

当前固定规则：

- OCR：智谱原生
- Search：七牛云主通道，预留智谱扩量

说明：

- 工具能力不与普通聊天模型共享统一 fallback 链

## 4. 平台与角色

### 4.1 平台角色定义

- `native`
  官方原生 API
- `proxy`
  聚合 / 代理平台
- `tool_service`
  工具能力服务

### 4.2 当前项目平台类型

原生平台：

- `deepseek`
- `dashscope`
- `moonshot`
- `volcengine`
- `zhipu`

聚合 / 代理平台：

- `qiniu`
- `siliconflow`
- `compshare`

工具能力侧重点：

- `zhipu`：OCR
- `qiniu`：搜索主通道

## 5. 数据模型定义

### 5.1 ai_model_families

表示逻辑模型族。

核心字段：

- `id`
- `vendor`
- `family_name`
- `task_family`
- `routing_policy`
- `description`
- `is_enabled`

示例：

- `deepseek_budget_chat`
- `qwen_premium`
- `zhipu_ocr`

### 5.2 ai_model_skus

表示平台级可调用且可计费的真实 SKU。

核心字段：

- `id`
- `family_id`
- `provider`
- `model_id`
- `display_name`
- `billing_channel`
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

原则：

- 一个 `provider + model_id` 对应一条平台级 SKU
- 不允许多个平台共用一条计费记录

## 6. Usage 账本口径

### 6.1 逻辑请求层

表：

- `ss_ai_requests`

含义：

- 记录一次用户级逻辑请求

例子：

- 一次 chat
- 一次 generate-workflow
- 一次 workflow execute

### 6.2 调用事件层

表：

- `ss_ai_usage_events`

含义：

- 记录一次真实 provider 调用尝试

必须记录：

- `provider`
- `model`
- `sku_id`
- `family_id`
- `vendor`
- `billing_channel`
- `status`
- `attempt_index`
- `is_fallback`
- `total_tokens`
- `cost_amount_cny`

### 6.3 分钟聚合层

表：

- `ss_ai_usage_minute`

作用：

- 支撑 live 面板
- 降低 dashboard 高频轮询成本

## 7. 计费规则

### 7.1 统一币种

当前正式计费口径统一为：

- `CNY`

单位统一为：

- 每百万 Token

### 7.2 价格字段

- `input_price_cny_per_million`
- `output_price_cny_per_million`

### 7.3 成本公式

```text
input_cost  = input_tokens  * input_price_cny_per_million  / 1_000_000
output_cost = output_tokens * output_price_cny_per_million / 1_000_000
cost_amount_cny = input_cost + output_cost
```

### 7.4 历史账单原则

- usage event 必须写入调用时价格快照
- 后续改价不能污染历史账单

## 8. 分账规则

### 8.1 assistant

包含：

- `chat`
- `plan`
- `modify`
- `generate_workflow`

### 8.2 workflow

仅包含：

- `workflow_execute`

说明：

- `BUILD -> generate-workflow` 属于 assistant
- 真正执行 workflow 节点才属于 workflow

## 9. 接口规范

### 9.1 前端选模主入口

正式入口字段：

- `selected_model_key`

兼容字段：

- `selected_platform`
- `selected_model`

### 9.2 模型目录接口

- `GET /api/ai/models/catalog`
- `GET /api/admin/models/catalog`
- `PUT /api/admin/models/{sku_id}`

### 9.3 Usage 分析接口

用户侧：

- `/api/usage/overview`
- `/api/usage/live`
- `/api/usage/timeseries`

后台侧：

- `/api/admin/dashboard/ai-overview`
- `/api/admin/dashboard/ai-live`
- `/api/admin/dashboard/ai-timeseries`
- `/api/admin/dashboard/ai-model-breakdown`
- `/api/admin/dashboard/ai-recent-calls`
- `/api/admin/dashboard/ai-cost-split`

## 10. 后台允许改什么

后台目录管理允许修改：

- 展示名
- 价格
- 价格来源
- `is_enabled`
- `is_visible`
- `is_user_selectable`
- `is_fallback_only`
- `required_tier`
- 排序

后台目录管理不允许修改：

- task route 主策略
- fallback 核心链
- provider 凭证
- 平台 base URL

## 11. 统一原则

StudySolo 当前 AI 调用与计费统一原则是：

- 路由策略归 YAML / Python
- 模型目录归 Supabase
- 计费按平台级 SKU 结算
- 展示按 usage 账本聚合
- 新代码统一使用 CNY 口径
