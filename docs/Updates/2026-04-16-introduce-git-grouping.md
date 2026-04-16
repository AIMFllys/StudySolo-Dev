# 2026-04-16 Introduce Git 收口分组与提交草案

## 收口原则

- 仅覆盖 `introduce + docs/updates`，不混入仓库其他并行改动。
- 以“可独立回滚”为分组边界。
- 文档与代码分离，降低回滚风险。

## 建议分组

### Group A：动效与性能主改造（P0/P1）

- `introduce/src/App.tsx`
- `introduce/src/index.css`
- `introduce/src/components/Hero.tsx`
- `introduce/src/components/Architecture.tsx`
- `introduce/src/components/AIRouter.tsx`
- `introduce/src/components/WorkflowDemo.tsx`
- `introduce/src/components/NodeGallery.tsx`
- `introduce/src/components/Features.tsx`

建议 commit message：

```text
feat(introduce): improve animation narrative and interaction smoothness

Unify motion tokens and optimize high-frequency interactions to reduce jank.
Enhance architecture and AI routing storytelling so users can follow end-to-end flow.
```

### Group B：稳定性与可构建修复

- `introduce/src/components/Scenarios.tsx`
- `introduce/src/components/PlatformEcosystem.tsx`

建议 commit message：

```text
fix(introduce): restore broken scenario and ecosystem components

Repair encoding/syntax issues that caused build instability and keep sections aligned with current product narrative.
```

### Group C：收尾文档与验收资料

- `docs/updates/2026-04-16.md`
- `docs/updates/2026-04-16-introduce-deep-optimization.md`
- `docs/updates/2026-04-16-introduce-quality-gates.md`
- `docs/updates/2026-04-16-introduce-git-grouping.md`
- `docs/updates/2026-04-16-introduce-release-sop.md`

建议 commit message：

```text
docs(updates): finalize introduce closure logs and release checklist

Deduplicate daily logs, add cross-links, quality gate records, git grouping notes, and deployment rollback SOP.
```

## 提交顺序建议

1. Group A（功能体验）
2. Group B（稳定性修复）
3. Group C（文档收尾）

## 注意事项

- 当前 `lint` 仍有阻断项；若要求严格 CI 全绿，建议在提交前先修复相关规则问题。
- 提交时请显式指定文件路径，避免把仓库其他目录的改动误带入。
