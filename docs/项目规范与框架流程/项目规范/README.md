# 项目规范文档

> 最后更新：2026-04-15
> 统一入口：[00-规范索引.md](00-规范索引.md)
> 定位：StudySolo 所有技术规范的权威来源（L0 层级）

---

## 规范文档一览

| 编号 | 文档 | 一句话说明 | 主要读者 |
|------|------|-----------|---------|
| 00 | [规范索引](00-规范索引.md) | 所有规范的统一入口与权威层级定义 | 所有人 |
| 01 | [项目架构全景](01-项目架构全景.md) | 仓库结构、技术栈、前后端完整架构、数据流、节点体系、API 路由总表 | 所有开发者 |
| 02 | [模块边界规范](02-模块边界规范.md) | 前后端模块边界、Feature 隔离、Store 解耦、依赖方向冻结契约 | 所有开发者 |
| 03 | [命名规范](03-命名规范.md) | 变量/函数/数据库/路由/AI 术语的统一命名规则 | 所有开发者 |
| 04 | [API 规范](04-API规范.md) | HTTP API 契约、完整路由表、请求/响应格式、SSE 事件契约 | 前后端开发者 |
| 05 | [设计规范](05-设计规范.md) | UI 设计语言（Ink & Parchment）、色彩/字体/间距/组件/动画规范 | 前端开发者 |
| 06 | [节点开发规范](06-节点开发规范.md) | 节点分类（A/B/C型）、开发流程、plugin.json、前端插件规范 | 节点开发者 |
| 07 | [子后端 Agent 规范](07-子后端Agent规范.md) | Agent 目录结构、四层协议摘要、新增流程、本地开发、FAQ | Agent 开发者 |
| 08 | [前端工程规范](08-前端工程规范.md) | 目录约束、行数治理（≤300行）、Manifest-First、TypedEventBus | 前端开发者 |
| 09 | [AI 调用与计费规范](09-AI调用与计费规范.md) | AI 模型路由策略、计费字段（CNY）、usage 账本口径 | AI 域开发者 |
| 10 | [Git 与协作规范](10-Git与协作规范.md) | 分支、Commit、PR、Issue、安全上报统一规范 | 全体协作者 |

---

## 各规范的职责边界

```
01 架构全景  ──→  "项目长什么样"（事实描述，不含规则）
02 模块边界  ──→  "模块之间怎么交互"（依赖方向规则）
03 命名规范  ──→  "东西叫什么名字"（命名约定）
04 API 规范  ──→  "接口长什么样"（HTTP 契约）
05 设计规范  ──→  "界面怎么画"（UI 标准）
06 节点规范  ──→  "节点怎么开发"（插件开发 SOP）
07 Agent 规范 ─→  "Agent 怎么开发"（微服务开发 SOP）
08 前端工程  ──→  "前端代码怎么组织"（工程实践）
09 AI 计费   ──→  "AI 调用怎么计费"（计费口径）
10 Git协作  ──→  "团队如何提交与协作"（流程规范）
```

**重叠处理原则**：
- 01 是概览，02~09 是详细规则，两者重叠时以详细规则为准
- 04 API 规范与 01 架构全景的路由表重叠时，以 04 为准
- 03 命名规范与 04 API 规范的命名规则重叠时，以 03 为准

---

## 冻结契约（不可修改）

以下文档已冻结，修改需三人 Sync + 版本号升级：

| 契约 | 位置 | 说明 |
|------|------|------|
| 后端依赖方向 | `docs/issues/TeamRefactor/contracts/backend-deps.md` | Phase 1 冻结 |
| 前端依赖方向 | `docs/issues/TeamRefactor/contracts/frontend-deps.md` | Phase 1 冻结 |
| AI Chat 契约 | `docs/issues/TeamRefactor/contracts/ai-chat-contract.md` | Phase 1 冻结 |
| Usage 追踪契约 | `docs/issues/TeamRefactor/contracts/usage-tracker-contract.md` | Phase 1 冻结 |
| Agent Gateway 契约 | `docs/issues/TeamRefactor/contracts/agent-gateway-contract.md` | Phase 1 冻结 |
| 节点 Manifest 契约 | `docs/issues/TeamRefactor/contracts/node-manifest-contract.md` | Phase 1 冻结 |
| Agent 四层协议 | `docs/issues/TeamRefactor/final-plan/agent-architecture.md` | Phase 4B 冻结 |

---

## 新增规范文档的规则

1. 先在 `00-规范索引.md` 中登记，再创建文件
2. 文件名格式：`NN-主题名称.md`（NN 为两位数编号）
3. 文件头部必须包含：最后更新日期、适用范围、事实源
4. 每个技术主题只有一个权威文档，其他文档通过链接引用，不复制内容
