<!-- 编码：UTF-8 -->

# ✅ #02 WorkflowCanvas.tsx 拆分方案（918 行 → 目标每文件 < 250 行）

> **状态：已完成** | 完成日期：2026-03-30 | 918 行 → 262 行，提取 7 个 hooks/工具文件

## 当前问题

`WorkflowCanvasInner` 函数体占 ~730 行，是一个典型的 God Component，混合了：

1. **节点创建逻辑**（createDefaultNodeData、createCommunityNodeData）~90 行
2. **拖放处理**（handleDrop、handleDragOver）~60 行
3. **右键菜单状态**（canvasMenu、nodeMenu、edgeMenu + 3 个 handler）~50 行
4. **边重连逻辑**（handleReconnect*）~30 行
5. **剪贴板操作**（handleCopyNode、handlePasteFromClipboard）~60 行
6. **键盘快捷键**（Ctrl+Z/Y/C/V + Escape）~70 行
7. **CustomEvent 监听器**（8 个 useEffect）~150 行
8. **放置模式逻辑**（placementMode + handlePaneClick）~40 行
9. **背景/全屏切换**（handleToggleBg、handleToggleFullscreen）~30 行
10. **ReactFlow JSX 渲染**（~80 行）
11. **上下文菜单 JSX**（~60 行）
12. **HistoryControls 子组件**（~30 行）
13. **常量定义**（nodeTypes、edgeTypes、BG_PRESETS）~50 行

## 拆分策略

按职责提取 custom hooks + 工厂函数 + 子组件。

### Hook 提取

| Hook | 职责 | 预估行数 |
|------|------|----------|
| `use-canvas-dnd.ts` | handleDrop + handleDragOver + 节点创建 | ~120 |
| `use-canvas-clipboard.ts` | handleCopyNode + handlePasteFromClipboard | ~80 |
| `use-canvas-keyboard.ts` | 全部键盘快捷键 useEffect | ~80 |
| `use-canvas-context-menus.ts` | 3 个菜单状态 + handler + edgeMenu | ~60 |
| `use-canvas-event-listeners.ts` | 8 个 CustomEvent useEffect 合并 | ~120 |
| `use-canvas-edge-reconnect.ts` | handleReconnect* 三件套 | ~40 |

### 工厂函数提取

| 文件 | 职责 | 预估行数 |
|------|------|----------|
| `canvas-node-factory.ts` | createDefaultNodeData + createCommunityNodeData | ~80 |
| `canvas-constants.ts` | nodeTypes + edgeTypes + BG_PRESETS | ~60 |

### 子组件保留

| 组件 | 位置 | 备注 |
|------|------|------|
| `HistoryControls` | 已在文件内，可提取为独立文件 | ~30 行 |

## 拆分后 Tree

```
frontend/src/features/workflow/
├── components/canvas/
│   ├── WorkflowCanvas.tsx            # ~180 行：ReactFlow JSX + hook 组合
│   ├── HistoryControls.tsx           # ~35 行：撤销/重做按钮
│   ├── canvas-constants.ts           # ~60 行：nodeTypes, edgeTypes, BG_PRESETS
│   ├── canvas-node-factory.ts        # ~80 行：createDefaultNodeData, createCommunityNodeData
│   ├── CanvasContextMenu.tsx         # 已有，保持
│   ├── NodeContextMenu.tsx           # 已有，保持
│   ├── EdgeContextMenu.tsx           # 已有，保持
│   ├── CanvasModal.tsx               # 已有，保持
│   ├── CanvasMiniMap.tsx             # 已有，保持
│   ├── CanvasTraceLoader.tsx         # 已有，保持
│   └── edges/                        # 已有，保持
├── hooks/
│   ├── use-canvas-dnd.ts             # ~120 行：拖放 + 节点创建
│   ├── use-canvas-clipboard.ts       # ~80 行：复制/粘贴
│   ├── use-canvas-keyboard.ts        # ~80 行：键盘快捷键
│   ├── use-canvas-context-menus.ts   # ~60 行：右键菜单状态管理
│   ├── use-canvas-event-listeners.ts # ~120 行：CustomEvent 监听
│   ├── use-canvas-edge-reconnect.ts  # ~40 行：边重连
│   ├── use-canvas-context.ts         # 已有，保持
│   ├── use-loop-group-drop.ts        # 已有，保持
│   └── ...其他已有 hooks
```

## 拆分后 WorkflowCanvas.tsx 骨架

```tsx
'use client';
import { useState, useMemo } from 'react';
import { ReactFlow, ReactFlowProvider, Controls, SelectionMode } from '@xyflow/react';
import { nodeTypes, edgeTypes, BG_PRESETS } from './canvas-constants';
import { HistoryControls } from './HistoryControls';
import { useCanvasDnd } from '../../hooks/use-canvas-dnd';
import { useCanvasClipboard } from '../../hooks/use-canvas-clipboard';
import { useCanvasKeyboard } from '../../hooks/use-canvas-keyboard';
import { useCanvasContextMenus } from '../../hooks/use-canvas-context-menus';
import { useCanvasEventListeners } from '../../hooks/use-canvas-event-listeners';
import { useCanvasEdgeReconnect } from '../../hooks/use-canvas-edge-reconnect';
// ... 其他 imports

function WorkflowCanvasInner() {
  const [canvasTool, setCanvasTool] = useState<CanvasTool>('pan');
  const [bgIndex, setBgIndex] = useState(0);
  // ... 组合所有 hooks
  const dnd = useCanvasDnd();
  const clipboard = useCanvasClipboard();
  const menus = useCanvasContextMenus();
  const reconnect = useCanvasEdgeReconnect();
  useCanvasKeyboard({ clipboard, reactFlowInstance });
  useCanvasEventListeners({ setCanvasTool, setNodes, reactFlowInstance });

  return (
    <div ...>
      <ReactFlow ... />
      <FloatingToolbar />
      {/* context menus */}
    </div>
  );
}
```

## 可复用组件识别

- `canvas-node-factory.ts` 中的 `createDefaultNodeData` 被 NodeStorePanel 的 click-to-add 事件也间接使用，提取后可统一引用
- `HistoryControls` 可在其他画布场景（如 ReadOnlyCanvas）复用
- `use-canvas-keyboard.ts` 的快捷键模式可被其他编辑器场景复用

## 符合 Next.js 架构

- hooks 放在 `features/workflow/hooks/` 符合 feature-based 组织
- 常量和工厂函数放在 `components/canvas/` 目录下，因为它们是 canvas 专属
- 不需要改动路由层，纯组件级重构

## 重复代码识别

🔴 `handlePasteFromClipboard` 和键盘 Ctrl+V 的粘贴逻辑有 ~30 行完全重复。
拆分后统一为 `useCanvasClipboard().paste(position)` 一个入口。

## 预估工作量

~3 小时（hook 提取 + 测试 + 验证交互不变）
