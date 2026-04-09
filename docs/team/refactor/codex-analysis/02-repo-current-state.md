# 当前仓库真实状态分析

## 1. 顶层结构与运行事实

当前仓库是一个事实上的 Polyglot Monorepo：

- `frontend/`：Next.js 16 主前端，端口 2037。
- `backend/`：FastAPI 主后端，端口 2038。
- `introduce/`：独立 Vite 静态介绍页。
- `wiki/`：仅有 README，尚未初始化项目骨架。
- `shared/`：Git submodule，不是根工作区的 package。
- `supabase/migrations/`：数据库真实结构与增量迁移。
- `docs/`：规范、计划、技术指导。
- `.agent/`：项目级架构文档、skills、workflow 规则。

运行链路仍然是典型的“双主应用 + 附属子项目”：

`Browser -> frontend -> /api rewrites -> backend -> Supabase / AI provider / storage`

其中：

- `frontend/next.config.ts` 已通过 `rewrites()` 代理 `/api/*` 到后端。
- `backend/app/main.py` 统一挂载 `/api` 路由并在启动时做 SKU 校验与周期清理。
- 根目录没有真正的 workspace root，也没有统一任务编排层。

## 2. 这不是“根级治理完善的 monorepo”

虽然 README 已将仓库定义为 monorepo，但根目录仍缺少典型 monorepo 的关键治理能力：

- 没有根级 `package.json` / `pnpm-workspace.yaml` / `turbo.json`。
- `frontend/` 内部有自己的 `pnpm-workspace.yaml`，但它不是根工作区。
- `backend/` 通过 Python 虚拟环境独立运行。
- `shared/` 有自己的 `package.json`，但作为 submodule 存在，不参与根级依赖编排。
- `introduce/`、`wiki/` 也没有被纳入统一任务入口。

当前更准确的描述不是“完整 monorepo”，而是：

> 一个把多个独立子项目放在同一仓库中的 Polyglot Repo，具备共享文档与共享迁移，但尚未建立根级任务治理、根级依赖治理和模块 ownership 治理。

## 3. 前端当前状态

前端已经有较强的 feature 分层意识：

- `features/` 下已有 `workflow`、`auth`、`admin`、`knowledge`、`settings`、`community-nodes`。
- `services/` 已集中了一部分 API 调用入口。
- `stores/` 有 Zustand 主 store 与 slices。
- `__tests__/` 已有较多属性测试。

但前端的“结构化治理”仍不彻底：

- 业务事实和展示元数据仍混杂。
- 节点系统有明显的多处硬编码。
- 侧边栏面板、节点商店、扩展面板之间存在概念重叠。
- 插件相关 UI 仍以 mock 为主，不是真正的模块系统。

## 4. 后端当前状态

后端已形成较清晰的层次：

- `api/`：29 个路由文件，功能域较多。
- `services/`：25 个服务文件。
- `models/`：11 个模型文件。
- `nodes/`：20 个 `node.py` 节点实现，已具备自动注册机制。

后端优势在于：

- 节点系统已有自动发现能力。
- `/api/nodes/manifest` 已能向前端输出节点元数据。
- `community_nodes`、`workflow_runs`、`ai_catalog` 等已体现功能域细分。

后端短板在于：

- 仍是单体 FastAPI，尚无“子后端”契约。
- 插件型能力和节点型能力没有被抽象成统一扩展协议。
- 面向团队协作的模块 ownership 与边界规范还停留在文档层面。

## 5. 共享层与数据库当前状态

`shared/` 当前承担的是“跨项目共识层”，不是“运行时共享包平台”：

- 它通过 `.gitmodules` 接入。
- 它主要承载共享类型、数据库边界和 subtree/submodule 说明。
- 它并未参与根级构建编排。

数据库迁移层已经相对成熟：

- 有 baseline 迁移。
- 有 AI 目录与计费迁移。
- 有 community nodes 与 workflow run 的迁移。

这说明数据库层已经开始承载平台化能力，但仓库结构和模块接口尚未同步升级。

## 6. Wiki 当前状态

`wiki/README.md` 明确说明：

- 目标是独立的 Next.js 文档站。
- 预留端口 2039。
- 当前尚未初始化。

因此 Wiki 当前不能被视为“已存在的子项目”，只能视为：

> 一个已经形成需求方向、部署方向和 URL 规划，但尚未具备代码骨架的待建文档子项目。

## 7. 当前最重要的结构结论

当前仓库不是“没有架构”，而是已经出现了以下特征：

- 主业务系统已经复杂到需要平台化治理。
- 若继续以单体思路直接堆功能，会迅速恶化团队协作成本。
- 当前最值得保留的是：
  - 前端 feature 分层方向
  - 后端节点自动注册方向
  - 数据库迁移作为真实事实源
  - `shared/` 作为跨仓共识层
- 当前最需要升级的是：
  - 根级 monorepo 治理
  - 节点/插件/子后端的统一扩展模型
  - 面向多人协作的模块边界

