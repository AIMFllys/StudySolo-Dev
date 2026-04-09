# 术语冻结表

> 冻结时间：2026-04-09
> 状态：待三人确认签字
> 用途：Phase 0 术语统一，后续所有技术文档必须使用本表术语

---

## 核心术语

| # | 术语 | 精确定义 | 不等于 | 英文 |
|---|------|---------|--------|------|
| 1 | **节点 Node** | 工作流中的最小执行单元。由主引擎 (`engine/`) 调度，继承 `BaseNode`，遵守节点契约（type, category, execute） | ≠ 插件，≠ 社区节点 | Node |
| 2 | **插件 Plugin** | 仓内独立模块，可拥有前端页面、后端 API、数据库表，节点只是其可选暴露方式之一 | ≠ 单个 node.py，≠ mock 卡片 | Plugin |
| 3 | **社区节点 Community Node** | 由用户发布的节点能力描述/模板/配置资产，不是可直接运行的代码插件 | ≠ 可安装的插件 | Community Node |
| 4 | **子后端 Sub-backend** | 团队成员独立开发和部署的 HTTP 服务，通过 Agent Gateway 协议接入主平台 | ≠ 主后端内的 service 模块 | Sub-backend |
| 5 | **Agent Gateway** | 主后端中的统一子后端接入层，负责发现、认证、限流、审计 | ≠ 简单的 HTTP 代理 | Agent Gateway |
| 6 | **Wiki** | 已稳定的文档发布目标，面向终端用户 | ≠ 设计文档主战场，≠ 规范制定空间 | Wiki |
| 7 | **Manifest** | 后端 `/api/nodes/manifest` 返回的节点元数据 JSON，是节点定义的唯一事实源 | ≠ 前端 workflow-meta.ts | Manifest |
| 8 | **Feature 模块** | 前端 `features/` 下的按业务域分组的代码目录 | ≠ 独立可部署的服务 | Feature Module |

---

## 层级术语

| 术语 | 精确定义 |
|------|---------|
| **API 层** | `backend/app/api/` — 只处理 HTTP 层，不含业务逻辑 |
| **Service 层** | `backend/app/services/` — 纯业务逻辑，不依赖 HTTP 框架 |
| **Engine 层** | `backend/app/engine/` — 工作流执行调度器 |
| **Node 层** | `backend/app/nodes/` — 节点实现，禁止依赖 api/ 和 services/ |
| **Store 层** | `frontend/src/stores/` — Zustand 状态管理 |
| **Service 层（前端）** | `frontend/src/services/` — API 调用封装 |

---

## 签字确认

| 角色 | 姓名 | 日期 | 签字 |
|------|------|------|------|
| 主系统负责人 | | | ☐ |
| 队友 A | | | ☐ |
| 队友 B | | | ☐ |

> [!IMPORTANT]
> 签字后，任何术语变更需三人同步确认并更新本文档版本号。
