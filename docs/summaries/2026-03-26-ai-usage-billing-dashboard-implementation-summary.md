<!-- 编码：UTF-8 -->

# 2026-03-26 AI 使用量、模型目录与计费体系升级总结

## 1. 这次升级解决了什么

这次不是单纯“多加几个图表”，而是把 StudySolo 当前 AI 调用、模型目录、价格体系、usage 账本、用户侧左面板、后台 AI 仪表盘和项目规范文档统一成了一套完整机制。

本次升级后，系统具备了以下能力：

- 使用真实 usage 账本记录 AI 请求与真实 provider 调用
- 明确区分 `assistant` 和 `workflow` 两本账
- 从 USD 试运行口径切换到正式 `CNY` 计费口径
- 引入 `ai_model_families + ai_model_skus` 双层模型目录
- 前端和后台统一从 catalog API 读取模型目录
- 后台模型页可以直接管理平台级 SKU 元数据
- 规范文档、命名、API 契约和新增模型 SOP 同步升级

## 2. 本次确认的核心业务策略

### 2.1 便宜模型

统一策略：

- 原生 API 优先
- `routing_policy = native_first`

适用方向：

- DeepSeek 全系
- 通义千问非 Max 系
- 大多数 Doubao
- GLM 4.5 到 4.7 的低价通道
- Kimi 低价模型

### 2.2 贵模型

统一策略：

- 聚合优先，再逐级回原生
- `routing_policy = proxy_first`

默认顺序：

- `qiniu -> siliconflow -> native`

### 2.3 工具模型

统一策略：

- 能力固定平台
- `routing_policy = capability_fixed`

当前明确规则：

- OCR：智谱原生
- Search：七牛云主通道，预留智谱扩量

## 3. 数据模型升级

### 3.1 新增模型目录表

新增：

- `public.ai_model_families`
- `public.ai_model_skus`

作用：

- `ai_model_families` 表示逻辑模型族
- `ai_model_skus` 表示平台级可调用且可计费的真实 SKU

关键意义：

- 同名模型跨平台不再混成一条价格记录
- `provider` 与 `vendor` 分离
- 真正支持多原生厂商 + 多聚合平台差异计费

### 3.2 旧表状态

旧表：

- `public.ai_models`

处理方式：

- 继续保留一轮兼容期
- 已被标记为 deprecated compatibility source
- 新代码不再把它作为主目录表

### 3.3 usage 表结构扩展

扩展：

- `public.ss_ai_usage_events`
- `public.ss_ai_usage_minute`

新增字段：

- `sku_id`
- `family_id`
- `vendor`
- `billing_channel`
- `input_price_cny_per_million`
- `output_price_cny_per_million`
- `cost_amount_cny`
- `total_cost_cny`

### 3.4 分钟聚合主键升级

`ss_ai_usage_minute` 新主键收口为：

- `(minute_bucket, user_id, source_type, source_subtype, sku_id)`

同时补了旧数据去重逻辑，避免历史 request 桶在切新主键时冲突。

## 4. 迁移与 Supabase 云端状态

### 4.1 本地迁移文件

新增迁移：

- [20260326162000_upgrade_ai_catalog_and_cny_billing.sql](/D:/project/Study_1037Solo/StudySolo/supabase/migrations/20260326162000_upgrade_ai_catalog_and_cny_billing.sql)

该迁移完成：

- 新建 `ai_model_families`
- 新建 `ai_model_skus`
- 扩展 usage 账本字段
- 将分钟聚合切到新主键
- 新建 / 重建 `fn_ss_ai_usage_minute_increment`
- 预置首批 family 与 SKU 种子

### 4.2 云端 Supabase 同步

本次已通过 MCP 将该迁移成功应用到云端 Supabase 项目：

- project id: `hofcaclztjazoytmckup`
- migration name: `upgrade_ai_catalog_and_cny_billing`

第一次云端执行失败的原因：

- 旧 `ss_ai_usage_minute` 在切新主键时存在重复桶

处理方式：

- 在迁移中补充去重聚合逻辑
- 重新执行后成功

### 4.3 云端结果

云端现在已经同步具备：

- `ai_model_families`
- `ai_model_skus`
- 扩展后的 `ss_ai_usage_events`
- 扩展后的 `ss_ai_usage_minute`

说明：

- 这不是只存在本地文件的计划状态
- 云端数据库结构已经同步到位

## 5. 后端改造

### 5.1 配置分层

重构：

- [config.yaml](/D:/project/Study_1037Solo/StudySolo/backend/config.yaml)
- [config_loader.py](/D:/project/Study_1037Solo/StudySolo/backend/app/core/config_loader.py)

现在分层清晰为：

- YAML 负责运行时路由策略
- Supabase 负责模型目录与价格元数据
- usage ledger 负责真实消耗记录

### 5.2 YAML 新职责

当前 YAML 重点保留：

- `providers`
- `task_routes`
- `compatibility`
- `engine`

已经明确表达：

- `native_first`
- `proxy_first`
- `capability_fixed`

并支持旧环境变量兼容别名，例如：

- `QINIU_AI_API_KEY | QINIU_API_KEY`
- `COMPSHARE_API_KEY | YOUYUN_API_KEY`

### 5.3 Catalog 服务

新增：

- [ai_catalog_service.py](/D:/project/Study_1037Solo/StudySolo/backend/app/services/ai_catalog_service.py)

核心能力：

- 从 Supabase 读取 family 与 SKU
- 进程内缓存目录
- 通过 `selected_model_key` 或旧字段解析真实 SKU
- 提供 task route 对应 SKU 列表

### 5.4 AI 路由器

重构：

- [ai_router.py](/D:/project/Study_1037Solo/StudySolo/backend/app/services/ai_router.py)

现在逻辑是：

- YAML 决定路由策略和候选链
- catalog service 决定这一步到底用哪个平台级 SKU
- usage ledger 写入真实平台、真实模型、真实价格快照

### 5.5 usage 账本

升级：

- [usage_ledger.py](/D:/project/Study_1037Solo/StudySolo/backend/app/services/usage_ledger.py)
- [usage_analytics.py](/D:/project/Study_1037Solo/StudySolo/backend/app/services/usage_analytics.py)
- [usage.py](/D:/project/Study_1037Solo/StudySolo/backend/app/models/usage.py)

当前已正式改为：

- `CNY`
- 每百万 Token 计价
- 真实平台级 SKU 计费

### 5.6 请求入口兼容

升级：

- [ai_chat.py](/D:/project/Study_1037Solo/StudySolo/backend/app/api/ai_chat.py)
- [ai_chat_stream.py](/D:/project/Study_1037Solo/StudySolo/backend/app/api/ai_chat_stream.py)
- [ai_chat.py](/D:/project/Study_1037Solo/StudySolo/backend/app/models/ai_chat.py)

当前规则：

- 新入口：`selected_model_key`
- 兼容入口：`selected_platform + selected_model`

同时：

- premium 校验已从静态模型名列表改为按 catalog `required_tier` 判断

### 5.7 新接口

新增用户侧目录接口：

- `GET /api/ai/models/catalog`

文件：

- [ai_catalog.py](/D:/project/Study_1037Solo/StudySolo/backend/app/api/ai_catalog.py)

新增后台目录接口：

- `GET /api/admin/models/catalog`
- `PUT /api/admin/models/{sku_id}`

文件：

- [admin_models.py](/D:/project/Study_1037Solo/StudySolo/backend/app/api/admin_models.py)

说明：

- 后台只允许编辑目录元数据
- 不允许直接改运行时 YAML 路由

## 6. 前端改造

### 6.1 模型目录来源统一

新增：

- [ai-catalog.service.ts](/D:/project/Study_1037Solo/StudySolo/frontend/src/services/ai-catalog.service.ts)
- [ai-catalog.ts](/D:/project/Study_1037Solo/StudySolo/frontend/src/types/ai-catalog.ts)

重构：

- [ai-models.ts](/D:/project/Study_1037Solo/StudySolo/frontend/src/features/workflow/constants/ai-models.ts)

现在前端模型来源原则：

- 正式来源：catalog API
- 本地常量：仅开发兜底

### 6.2 用户侧 AI 选模

重构：

- [SidebarAIPanel.tsx](/D:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/SidebarAIPanel.tsx)
- [ModelSelector.tsx](/D:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/ModelSelector.tsx)
- [use-ai-chat-store.ts](/D:/project/Study_1037Solo/StudySolo/frontend/src/stores/use-ai-chat-store.ts)
- [use-stream-chat.ts](/D:/project/Study_1037Solo/StudySolo/frontend/src/features/workflow/hooks/use-stream-chat.ts)

改动点：

- 模型选择器改为接收 catalog 返回的 SKU 列表
- 发送请求时优先传 `selected_model_key`
- 旧 `selected_platform + selected_model` 继续兼容提交

### 6.3 用户侧左侧仪表盘

重构：

- [DashboardPanel.tsx](/D:/project/Study_1037Solo/StudySolo/frontend/src/components/layout/sidebar/DashboardPanel.tsx)
- [usage.service.ts](/D:/project/Study_1037Solo/StudySolo/frontend/src/services/usage.service.ts)
- [usage.ts](/D:/project/Study_1037Solo/StudySolo/frontend/src/types/usage.ts)

当前状态：

- 成本字段已切到 `CNY`
- 显示个人 AI 使用镜像
- 与后台使用同一套 usage 数据口径

### 6.4 后台 AI 仪表盘

重构：

- [AdminDashboardPageView.tsx](/D:/project/Study_1037Solo/StudySolo/frontend/src/features/admin/dashboard/AdminDashboardPageView.tsx)
- [DashboardKpiSection.tsx](/D:/project/Study_1037Solo/StudySolo/frontend/src/features/admin/dashboard/DashboardKpiSection.tsx)
- [DashboardChartsSection.tsx](/D:/project/Study_1037Solo/StudySolo/frontend/src/features/admin/dashboard/DashboardChartsSection.tsx)
- [DashboardActivityTable.tsx](/D:/project/Study_1037Solo/StudySolo/frontend/src/features/admin/dashboard/DashboardActivityTable.tsx)

当前状态：

- 成本字段改为 `CNY`
- 展示 provider、vendor、billing_channel
- 模型排行已按平台级 SKU 思路展示

### 6.5 后台模型目录页

重构：

- [models/page.tsx](/D:/project/Study_1037Solo/StudySolo/frontend/src/app/(admin)/admin-analysis/models/page.tsx)

当前页面能力：

- 查看平台级模型 SKU 目录
- 编辑展示名、tier、价格、可见性、用户可选开关、fallback-only 等元数据
- 直接调用后台 catalog API 保存

## 7. 规范文档同步

本次同步更新：

- [naming.md](/D:/project/Study_1037Solo/StudySolo/docs/项目规范与框架流程/项目规范/naming.md)
- [api.md](/D:/project/Study_1037Solo/StudySolo/docs/项目规范与框架流程/项目规范/api.md)

新增：

- [项目AI调用及计费分析统一规范.md](/D:/project/Study_1037Solo/StudySolo/docs/项目规范与框架流程/项目规范/项目AI调用及计费分析统一规范.md)
- [新增AI模型-SOP.md](/D:/project/Study_1037Solo/StudySolo/docs/项目规范与框架流程/功能流程/新增AI模型/新增AI模型-SOP.md)

这些文档现在已经覆盖：

- provider / vendor / family / sku 定义
- CNY 计费字段
- 新 catalog API
- `selected_model_key` 主入口
- 新增模型流程

## 8. 测试与验证

### 8.1 后端

通过：

- `backend\\.venv\\Scripts\\python.exe -m pytest backend\\tests\\test_usage_analytics_property.py`
- `backend\\.venv\\Scripts\\python.exe -m compileall backend\\app`

结果：

- 3 个 usage analytics 测试全部通过
- 后端模块编译通过

### 8.2 前端

通过：

- `npx vitest --run src/__tests__/usage-service.property.test.ts src/__tests__/admin-service.property.test.ts`

结果：

- 7 个测试全部通过

### 8.3 TypeScript 检查

执行：

- `npx tsc --noEmit`

结果：

- 本次改动新增的问题已清掉
- 当前剩余 2 个错误为仓库内既有无关问题：
  - `src/__tests__/edge-connection-system.smoke.test.ts`
  - `src/features/admin/users/UserDetailPanels.tsx`

说明：

- 本次升级没有新增新的全量 TypeScript 错误

## 9. 这次做完后，系统现在是什么状态

截至 2026-03-26，这套体系已经从“usage 看板试运行版”升级为“平台级模型目录 + CNY 计费版”。

现在已经具备：

- YAML 路由策略中心
- Supabase 模型目录中心
- 真实 provider 使用账本
- 平台级 SKU 成本分析
- 用户侧 / 后台侧同步显示
- 文档与 SOP 同步

## 10. 仍未彻底完成的部分

### 10.1 价格完整度

当前仍有部分模型价格待核验，因此这些 SKU 可能表现为：

- 有调用
- 有 token
- 成本暂时为 `0 CNY`

典型待补：

- 部分 Moonshot
- 部分 GLM
- 部分 Doubao 映射
- 部分 SiliconFlow / 搜索扩量价格

### 10.2 人工 UI 级联调

建议后续补一次真实操作链路验收：

1. 用户侧实际选一个 catalog 模型发起聊天
2. 触发一次 generate-workflow
3. 执行一次 workflow
4. 观察左侧仪表盘与后台仪表盘是否按轮询周期同步刷新

## 11. 一句话结论

这次升级已经把 StudySolo 的 AI 配置、模型目录、平台级计费、usage 分析、后台模型管理和项目规范收口成一套统一体系；剩余工作主要是补价格元数据和做最后一层真实页面联调，而不是再重做底层架构。
