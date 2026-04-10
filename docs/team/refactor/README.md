# StudySolo 代码重构计划

> 最后更新：2026-04-10
> 状态：Phase 0 已完成 95% · Phase 1 契约已全部输出（待三人签字）· Phase 2-4 待启动
> GitHub Issue：[#10](https://github.com/AIMFllys/StudySolo-Dev/issues/10)

---

## 概述

本目录汇集了 StudySolo 平台大规模重构的所有分析文档、冻结契约与分阶段实施方案。重构涵盖后端架构优化、前端模块解耦、节点系统统一、子后端 Agent 架构、Wiki 子项目等全栈维度。

---

## 🗺️ 执行进度

```
Phase 0 ✅ ──→ Phase 1 📝 ──→ ┬─ Phase 2（后端）  ⏳
                               ├─ Phase 3（前端）  ⏳
                               └─ Phase 4（节点+Agent）⏳ ──→ Phase 5（集成）⏳
```

| Phase | 名称 | 状态 | 文档 |
|-------|------|------|------|
| **Phase 0** | 基础冻结与紧急修复 | ✅ 95%（待术语签字） | [phase-0](final-plan/phase-0-foundation.md) |
| **Phase 1** | 接口契约冻结 | 📝 6/6 契约已输出，待签字 | [phase-1](final-plan/phase-1-contract-freeze.md) |
| **Phase 2** | 后端核心重构 | ⏳ 待 Phase 1 签字 | [phase-2](final-plan/phase-2-backend-refactor.md) |
| **Phase 3** | 前端架构重构 | ⏳ 待 Phase 1 签字 | [phase-3](final-plan/phase-3-frontend-refactor.md) |
| **Phase 4** | 节点系统 + 子后端 | ⏳ 待 Phase 1 签字 | [phase-4](final-plan/phase-4-nodes-and-agents.md) |
| **Phase 5** | 平台集成 + 治理 + Wiki | ⏳ 待 Phase 2-4 完成 | [phase-5](final-plan/phase-5-integration.md) |

---

## 目录结构

```
refactor/
├── README.md                     ← 本文件（总览与导航）
├── REFACTORING-GUIDE.md          ← 非技术向概览：为什么重构、核心目标
│
├── snapshot/                     ← Phase 0 基线快照（重构前的 X 光片）
│   ├── repo-structure.md         ← 仓库结构 + 文件数 + 技术栈
│   ├── api-inventory.md          ← 35 个路由文件清单
│   ├── node-definitions-audit.md ← 节点 7 处重复定义审计
│   └── terminology.md            ← 8 个核心术语冻结表
│
├── contracts/                    ← Phase 1 冻结契约（接口规范）🔒
│   ├── backend-deps.md           ← 后端依赖方向图
│   ├── frontend-deps.md          ← 前端依赖方向图
│   ├── ai-chat-contract.md       ← AI Chat 合并 API 契约
│   ├── usage-tracker-contract.md ← Usage Tracker 装饰器契约
│   ├── agent-gateway-contract.md ← Agent Gateway 四层协议
│   └── node-manifest-contract.md ← 节点 Manifest-First 契约
│
├── final-plan/                   ← 最终分阶段实施方案 ⭐
│   ├── 00-索引.md                ← 总索引 + 并行关系图
│   ├── phase-0-foundation.md     ← Phase 0：基础冻结
│   ├── phase-1-contract-freeze.md← Phase 1：接口契约冻结
│   ├── phase-2-backend-refactor.md← Phase 2：后端重构
│   ├── phase-3-frontend-refactor.md← Phase 3：前端重构
│   ├── phase-4-nodes-and-agents.md← Phase 4：节点 + Agent
│   ├── phase-5-integration.md    ← Phase 5：集成 + 治理
│   ├── agent-architecture.md     ← Agent 四层协议详细规范
│   ├── wiki-init-plan.md         ← Wiki 初始化计划（Phase 5 细化）
│   └── 超级完整重构方案.md        ← 原始综合方案（v1，已被分 Phase 取代）
│
├── codex-analysis/               ← Codex 分析（架构原则 + 治理框架）
│   ├── 00-README.md              ← 分析总览
│   ├── 01-baseline/              ← 分析基线快照
│   ├── 02 ~ 10                   ← 10 篇架构分析
│   └── ...
│
├── claude-analysis/              ← Claude 分析（代码级诊断 + 具体方案）
│   ├── 01 ~ 11                   ← 11 篇代码诊断
│   └── ...
│
└── comparison/                   ← 双方案深度对比
    └── 00-双方案对比分析.md
```

---

## 方案来源与定位

| 来源 | 核心贡献 | 适用场景 |
|------|----------|----------|
| **Codex 分析** | 架构原则、术语统一、治理框架、4 阶段路线 | 架构决策、原则指导 |
| **Claude 分析** | P0 Bug 定位、代码级重构方案、具体目录结构 | 落地实施、代码层面执行 |
| **对比分析** | 两套方案的互补性分析与取舍建议 | 决策参考 |
| **最终方案** | 以 Codex 原则为骨架 + Claude 方案为血肉的分阶段计划 | **主实施文档** |
| **基线快照** | 代码库的"重构前照片"，用于对比验证 | 回溯基准 |
| **冻结契约** | 模块间接口的"不可单方面修改的协议" | Phase 2-4 实施约束 |

---

## 核心原则

1. **先冻结再实施**：Phase 0-1 是硬性 Gate，不可跳过
2. **单一事实源**：节点系统只有后端 manifest 作为权威
3. **四层兼容性**：子后端不只是字段兼容（请求/响应/运行时/治理）
4. **Wiki 是发布源**：不是设计源
5. **每个 Task 独立 PR**：出问题可单独 revert
6. **契约修改需三人 Sync**：冻结 = 写下来 + 签字 + 不许单方面改

---

## 阅读建议

| 目的 | 推荐路径 |
|------|---------|
| **快速了解当前进度** | → [00-索引.md](final-plan/00-索引.md) |
| **看重构全貌** | → [REFACTORING-GUIDE.md](REFACTORING-GUIDE.md)（非技术）→ [索引](final-plan/00-索引.md)（技术） |
| **执行当前 Phase** | → [phase-1-contract-freeze.md](final-plan/phase-1-contract-freeze.md) → `contracts/` 各文件 |
| **理解为什么这样设计** | → [双方案对比](comparison/00-双方案对比分析.md) → codex/claude 源分析 |
| **查阅某个契约** | → `contracts/` 目录，6 份冻结文档 |
| **回溯代码基线** | → `snapshot/` 目录，4 份快照 |
