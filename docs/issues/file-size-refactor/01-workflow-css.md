<!-- 编码：UTF-8 -->

# ✅ #01 workflow.css 拆分方案（1945 行 → 目标每文件 < 250 行）

> **状态：已完成** | 完成日期：2026-03-30 | 拆分为 10 个 CSS 模块，原文件已删除

## 当前问题

`frontend/src/styles/workflow.css` 是全项目最大的单文件，包含 17 个独立 section：

1. Canvas cursor（1-12）
2. Controls zoom（14-66）
3. Edge animations（67-185）
4. MiniMap（186-204）
5. Selection glow（205-213）
6. Connection drag line（214-224）
7. Handles（225-233）
8. Floating canvas toolbar（234-703）— **最大段，470 行**
9. Node Paper Texture（704-1423）— **第二大段，720 行**
10. Node Handle 智能显隐（1424-1465）
11. Click-to-Connect 视觉反馈（1466-1495）
12. Edge 类型基础样式（1496-1563）
13. Edge Type Panel（1564-1633）
14. Loop Region Node（1634-1696）
15. Canvas Placement Panel（1697-1751）
16. Edge Labels（1752-1818）
17. Loop Group Node（1819-1929）
18. Node UI Refactor: Result Slip（1930-1945）

## 拆分策略

按 UI 组件域拆分为 8 个 CSS 模块文件，在 `globals.css` 中统一 `@import`。

## 拆分后 Tree

```
frontend/src/styles/
├── base.css                          # 已有，保持
├── glass.css                         # 已有，保持
├── tokens.css                        # 已有，保持
├── workflow/                         # 新建目录
│   ├── canvas-core.css               # ~80 行：cursor + controls + minimap + selection + connection line
│   ├── canvas-toolbar.css            # ~470 行 → 需进一步拆分（见下）
│   ├── node-paper.css                # ~720 行 → 需进一步拆分（见下）
│   ├── node-handles.css              # ~70 行：handles 显隐 + click-to-connect
│   ├── edge-styles.css               # ~190 行：edge animations + edge 类型 + edge labels
│   ├── edge-type-panel.css           # ~70 行：edge type panel
│   ├── loop-nodes.css                # ~170 行：loop region + loop group
│   ├── canvas-placement-panel.css    # ~55 行
│   └── node-result-slip.css          # ~15 行 + 后续扩展
└── workflow.css                      # 删除原文件，改为 index 导入
```

### canvas-toolbar.css 二次拆分（如果 > 300 行）

```
workflow/
├── toolbar-base.css                  # 工具栏容器、定位、背景
├── toolbar-buttons.css               # 按钮样式、hover、active 状态
└── toolbar-panels.css                # 子面板（搜索、emoji picker 等）
```

### node-paper.css 二次拆分（如果 > 300 行）

```
workflow/
├── node-base.css                     # 节点基础纸张纹理、阴影、边框
├── node-states.css                   # 节点状态样式（running/done/error/pending）
├── node-dark.css                     # 暗色主题覆盖
└── node-types.css                    # 特定节点类型样式（trigger、logic_switch 等）
```

## 导入方式

在 `frontend/src/app/globals.css` 中：

```css
/* Workflow canvas styles */
@import '../styles/workflow/canvas-core.css';
@import '../styles/workflow/toolbar-base.css';
@import '../styles/workflow/toolbar-buttons.css';
@import '../styles/workflow/toolbar-panels.css';
@import '../styles/workflow/node-base.css';
@import '../styles/workflow/node-states.css';
@import '../styles/workflow/node-dark.css';
@import '../styles/workflow/node-types.css';
@import '../styles/workflow/node-handles.css';
@import '../styles/workflow/edge-styles.css';
@import '../styles/workflow/edge-type-panel.css';
@import '../styles/workflow/loop-nodes.css';
@import '../styles/workflow/canvas-placement-panel.css';
@import '../styles/workflow/node-result-slip.css';
```

## 可复用识别

- `node-paper-bg` 类在多个组件中使用（ChatMessages、EmptyState 等），应保持全局可用
- `.analyze` 动画在 ChatMessages 和 SkeletonLoader 中复用，应放入 `base.css` 或独立 `animations.css`

## 风险

- CSS 选择器优先级不变（都是全局 CSS），拆分不影响样式生效
- 需确认 Next.js 的 CSS import 顺序与原文件内顺序一致

## 预估工作量

~2 小时（纯文件拆分 + import 调整 + 验证）
