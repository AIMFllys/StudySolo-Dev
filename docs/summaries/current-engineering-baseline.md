<!-- 编码：UTF-8 -->

# 当前工程基线

> 最后更新：2026-03-07
> 文档定位：当前唯一可信的工程现状摘要，不包含未来规划

## 当前结构状态

- 后端执行链已经统一到 `backend/app/engine/executor.py`
- 后端认证路由已经拆分到 `backend/app/api/auth/`
- 知识库处理已经收口到 `services/document_service.py` 与 `services/knowledge_service.py`
- 前端 workflow 已完成 feature 化，入口位于 `frontend/src/features/workflow/`
- 前端 knowledge 已拆分为 `frontend/src/features/knowledge/`
- `components/business/` 已彻底退出当前前端结构

## 当前门禁命令

- 前端：
  - `npm run lint`
  - `npm run lint:lines:strict`
  - `npm run lint:pages`
  - `npx vitest run src/__tests__/sse-store-update.property.test.ts src/__tests__/workflow-sync.property.test.ts src/__tests__/workflow-store.property.test.ts src/__tests__/integration-fixes.workflow-runbutton.property.test.ts src/__tests__/crash-recovery.property.test.ts src/__tests__/knowledge-utils.property.test.ts`
- 后端：
  - `python -m pytest tests`

## 通过标准

- 前端 lint、页面行数门禁、重点 Vitest 全部通过
- 后端全量 pytest 通过
- 对外 API、SSE 兼容事件名、Supabase schema 保持不变

## 文档事实源优先级

1. 当前入口文档：`docs/README.md`、`docs/architecture.md`、`docs/progress.md`
2. 实时代码、测试与实际运行结果
3. `docs/Plans/daily_plan/refactor/StudySolo架构重构方案.md`
4. 历史计划、历史总结、更新日志

## 使用说明

- 需要了解“现在是什么”，先看本文档和入口文档
- 需要了解“为什么变成这样”，再看重构方案和历史记录
- 历史文档即使未改名为 `已过期-*`，也默认不高于代码与测试事实
