<!-- 编码：UTF-8 -->

# ✅ #10 NodeStorePanel.tsx 拆分方案（419 行 → 目标每文件 < 250 行）

> **状态：已完成** | 完成日期：2026-03-30 | 419 行 → 32 行，提取 Item + DefaultView

## 当前问题

单文件包含 6 个组件：

1. `NodeTooltip` 节点提示框 ~50 行
2. `TagFilterBar` 标签过滤栏 ~55 行
3. `NodeStoreItem` 单个节点卡片 ~60 行
4. `CategorySection` 分类折叠区 ~50 行
5. `DefaultNodeStoreView` 默认视图（搜索+分类列表）~85 行
6. `NodeStorePanel` 主面板（含社区节点 tab 切换）~120 行

## 拆分策略

| 文件 | 内容 | 预估行数 |
|------|------|----------|
| `NodeStorePanel.tsx` | 主面板 + tab 切换 | ~120 |
| `NodeStoreItem.tsx` | 单个节点卡片 + NodeTooltip | ~110 |
| `NodeStoreDefaultView.tsx` | DefaultNodeStoreView + CategorySection + TagFilterBar | ~190 |

## 拆分后 Tree

```
frontend/src/components/layout/sidebar/
├── NodeStorePanel.tsx                 # ~120 行：主面板 + tab
├── NodeStoreItem.tsx                  # ~110 行：节点卡片 + tooltip
├── NodeStoreDefaultView.tsx           # ~190 行：默认视图 + 分类 + 过滤
└── ...其他已有文件
```

## 可复用组件识别

- `NodeTooltip` 可被 WorkflowCanvas 的节点悬浮提示复用
- `TagFilterBar` 的过滤模式可被社区节点列表复用

## 预估工作量

~1 小时
