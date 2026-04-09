<!-- 编码：UTF-8 -->

# ✅ #06 ChatMessages.tsx 拆分方案（438 行 → 目标每文件 < 250 行）

> **状态：已完成** | 完成日期：2026-03-30 | 438 行 → 72 行，提取 4 个子组件

## 当前问题

单文件包含 8 个组件/常量定义：

1. `StudySoloIcon` SVG 组件 ~15 行
2. `CopyButton` 复制按钮 ~20 行
3. `StreamingIndicator` 流式指示器 ~15 行
4. `AIMessage` 消息渲染（最大，~130 行）含 thinking/plan/markdown 分支
5. `markdownComponents` 自定义 Markdown 渲染器 ~80 行
6. `UserMessage` 用户消息 ~10 行
7. `SkeletonLoader` 加载骨架 ~30 行（含重复 SVG）
8. `EmptyState` 空状态 ~50 行（含重复 SVG）
9. `ChatMessages` 主组件 ~30 行

## 拆分策略

| 文件 | 内容 | 预估行数 |
|------|------|----------|
| `ChatMessages.tsx` | 主组件 + UserMessage | ~60 |
| `AIMessage.tsx` | AIMessage + StreamingIndicator | ~160 |
| `chat-markdown-components.tsx` | markdownComponents + CopyButton | ~110 |
| `ChatEmptyState.tsx` | EmptyState + StudySoloIcon | ~70 |
| `ChatSkeletonLoader.tsx` | SkeletonLoader | ~40 |

## 拆分后 Tree

```
frontend/src/components/layout/sidebar/
├── ChatMessages.tsx                   # ~60 行：主列表 + UserMessage
├── AIMessage.tsx                      # ~160 行：AI 消息渲染
├── chat-markdown-components.tsx       # ~110 行：Markdown 自定义渲染器
├── ChatEmptyState.tsx                 # ~70 行：空状态
├── ChatSkeletonLoader.tsx             # ~40 行：加载骨架
├── ChatInputBar.tsx                   # 已有，保持
├── PlanCard.tsx                       # 已有，保持
├── ThinkingCard.tsx                   # 已有，保持
└── ...其他已有文件
```

## 可复用组件识别

🔴 **重复代码**：`SkeletonLoader` 和 `AIMessage` 中的 "magic wand" SVG 动画完全相同（~20 行 SVG）。
→ 提取为 `MagicWandLoader.tsx` 共享组件。

- `StudySoloIcon` 在 EmptyState 和 AIMessage 中都使用，提取后可全局复用
- `CopyButton` 可提升到 `components/ui/CopyButton.tsx` 供其他代码展示场景使用
- `markdownComponents` 可被其他 Markdown 渲染场景（如节点输出、公开页）复用

## 符合 Next.js 架构

- 子组件保持在 `sidebar/` 目录下，因为它们是 sidebar chat 专属
- `CopyButton` 如果其他地方也需要，可后续提升到 `components/ui/`

## 预估工作量

~1.5 小时
