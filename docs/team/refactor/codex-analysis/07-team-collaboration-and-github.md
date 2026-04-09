# 团队协作与 GitHub 规范分析

## 1. 当前协作基础并不差

仓库已经存在：

- `.github/CODEOWNERS`
- `.github/pull_request_template.md`
- Issue 模板
- `CONTRIBUTING.md`
- `SECURITY.md`

这说明项目已经意识到协作治理的重要性。

## 2. 但当前协作模型仍是单人主导

最关键的问题不是“没有模板”，而是：

- `CODEOWNERS` 全部指向同一 owner。
- 还没有按模块分配责任人。
- 还没有按模块冻结接口。
- 还没有“谁可以独立提交而不改动主干模块”的规则。

因此当前 GitHub 规则更像“单人维护的规范化仓库”，不是“多人并行开发的协作仓库”。

## 3. 建议的团队分工思路

结合当前项目状态，未来最适合的拆法不是按技术栈粗暴拆，而是按可交付单元拆：

### 3.1 核心主系统组

负责：

- 工作流核心
- 主后端
- 节点运行时契约
- AI 路由与计量

### 3.2 Wiki / 文档子项目组

负责：

- Wiki 站点
- 用户文档
- API 文档映射
- 与主系统文档的同步规则

### 3.3 子 Agent / 子后端组

负责：

- 特定领域 Agent
- 子后端服务
- OpenAI 兼容接入

### 3.4 插件模块组

负责：

- 仓内独立插件模块
- 插件前后端与节点暴露层

## 4. 未来 PR 协作的最小规则

### 4.1 一个 PR 尽量只属于一个模块

例如：

- Wiki PR 不顺手改主工作流逻辑。
- 子后端 PR 不顺手改核心执行引擎。
- 插件 PR 不顺手改全站导航系统。

### 4.2 先冻结契约，再并行开发

多人协作前必须冻结：

- API schema
- 节点 manifest 字段
- 子后端 gateway 契约
- Wiki 文档来源规则

### 4.3 文档先行

对以下改动，PR 前必须先有分析或设计文档：

- 新插件模块
- 新子后端
- 新公共节点类型
- 新数据库表
- 新跨项目接口

## 5. CODEOWNERS 的未来升级方向

当前 `CODEOWNERS` 的问题不在文件格式，而在粒度不够协作化。

未来应该按模块收敛为：

- `/frontend/src/features/workflow/`
- `/frontend/src/features/community-nodes/`
- `/backend/app/nodes/`
- `/backend/app/api/`
- `/docs/Plans/TNRCodex/`
- `/wiki/`
- `/modules/plugins/*`
- `/modules/agent-gateway/`

这样每个模块都可以绑定明确 owner。

## 6. GitHub 基础知识在本项目中的落地重点

本项目最需要团队成员掌握的不是泛泛 Git 命令，而是以下协作知识：

- 什么是“模块内 PR”与“跨模块 PR”
- 什么是“接口冻结前不能开工”
- 什么是“文档先行”
- 什么是“数据库迁移需要单独审查”
- 什么是“shared submodule 不能与主仓普通目录混看”

## 7. 本部分结论

- 当前 GitHub 协作骨架可以保留。
- 真正需要升级的是 ownership 粒度和模块交付思维。
- 后续重构应把 Wiki、插件、子后端都变成明确的独立协作单元。

