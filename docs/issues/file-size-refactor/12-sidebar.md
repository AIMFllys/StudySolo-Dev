<!-- 编码：UTF-8 -->

# ✅ #12 Sidebar.tsx 拆分方案（405 行 → 目标 < 250 行）

> **状态：已完成** | 完成日期：2026-03-30 | 405 行 → 121 行，提取 ActivityBar + constants

## 当前问题

`Sidebar` 组件是一个面板路由器，根据 `activePanel` 状态渲染不同面板。
405 行中包含：

1. **面板切换逻辑** + 图标栏渲染 ~150 行
2. **右键菜单** 状态管理 + 渲染 ~80 行
3. **工作流列表** 数据获取 + 传递 ~50 行
4. **面板渲染** switch/条件渲染 ~80 行
5. **辅助函数** getPanelLabel ~10 行
6. **类型定义** SidebarProps + ContextMenuState ~30 行

## 拆分策略

| 文件 | 内容 | 预估行数 |
|------|------|----------|
| `Sidebar.tsx` | 主容器 + 图标栏 + 面板路由 | ~200 |
| `SidebarIconBar.tsx` | 图标栏渲染 + tooltip | ~120 |
| `sidebar-types.ts` | SidebarPanel 类型 + getPanelLabel | ~40 |

## 拆分后 Tree

```
frontend/src/components/layout/
├── Sidebar.tsx                        # ~200 行：主容器 + 面板路由
├── SidebarIconBar.tsx                 # ~120 行：图标栏
├── sidebar-types.ts                   # ~40 行：类型 + 辅助
├── sidebar/                           # 已有，各面板组件
│   ├── SidebarWorkflowsPanel.tsx
│   ├── SidebarAIPanel.tsx
│   ├── NodeStorePanel.tsx
│   ├── SettingsPanel.tsx
│   ├── DashboardPanel.tsx
│   ├── WalletPanel.tsx
│   └── ...
└── ...其他已有文件
```

## 架构观察

🟡 `components/layout/sidebar/` 目录下有 22 个文件，这些面板组件实际上是 workflow 编辑器的功能面板，
从 Next.js feature-based 架构角度看，更适合放在 `features/workflow/components/sidebar/` 或 `features/sidebar/`。
但这是一个更大的重构，当前阶段只做文件大小修复。

## 预估工作量

~1 小时
