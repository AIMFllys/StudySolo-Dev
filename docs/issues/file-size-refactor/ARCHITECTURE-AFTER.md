<!-- 编码：UTF-8 -->

# 拆分后架构全景 Tree

> 仅展示受影响的目录和文件，`# 已有` 表示不变，`# NEW` 表示新增

## 前端

```
frontend/src/
├── styles/
│   ├── base.css                                    # 已有
│   ├── glass.css                                   # 已有
│   ├── tokens.css                                  # 已有
│   ├── admin-scholarly.css                         # 已有
│   └── workflow/                                   # NEW — 替代原 workflow.css
│       ├── canvas-core.css                         # NEW ~80 行
│       ├── toolbar-base.css                        # NEW ~160 行
│       ├── toolbar-buttons.css                     # NEW ~160 行
│       ├── toolbar-panels.css                      # NEW ~150 行
│       ├── node-base.css                           # NEW ~200 行
│       ├── node-states.css                         # NEW ~200 行
│       ├── node-dark.css                           # NEW ~180 行
│       ├── node-types.css                          # NEW ~140 行
│       ├── node-handles.css                        # NEW ~70 行
│       ├── edge-styles.css                         # NEW ~190 行
│       ├── edge-type-panel.css                     # NEW ~70 行
│       ├── loop-nodes.css                          # NEW ~170 行
│       ├── canvas-placement-panel.css              # NEW ~55 行
│       └── node-result-slip.css                    # NEW ~15 行
│
├── stores/
│   ├── use-workflow-store.ts                       # 重构 ~80 行（组合入口）
│   ├── workflow-store-helpers.ts                   # NEW ~50 行
│   ├── slices/                                     # NEW
│   │   ├── graph-slice.ts                          # NEW ~130 行
│   │   ├── execution-slice.ts                      # NEW ~130 行
│   │   ├── history-slice.ts                        # NEW ~60 行
│   │   └── connect-slice.ts                        # NEW ~50 行
│   ├── use-admin-store.ts                          # 已有
│   ├── use-ai-chat-store.ts                        # 已有
│   ├── use-conversation-store.ts                   # 已有
│   ├── use-panel-store.ts                          # 已有
│   └── use-settings-store.ts                       # 已有
│
├── components/layout/
│   ├── Sidebar.tsx                                 # 重构 ~200 行
│   ├── SidebarIconBar.tsx                          # NEW ~120 行
│   ├── sidebar-types.ts                            # NEW ~40 行
│   └── sidebar/
│       ├── ChatMessages.tsx                        # 重构 ~60 行
│       ├── AIMessage.tsx                           # NEW ~160 行
│       ├── chat-markdown-components.tsx            # NEW ~110 行
│       ├── ChatEmptyState.tsx                      # NEW ~70 行
│       ├── ChatSkeletonLoader.tsx                  # NEW ~40 行
│       ├── NodeStorePanel.tsx                      # 重构 ~120 行
│       ├── NodeStoreItem.tsx                       # NEW ~110 行
│       ├── NodeStoreDefaultView.tsx                # NEW ~190 行
│       ├── ChatInputBar.tsx                        # 已有
│       ├── PlanCard.tsx                            # 已有
│       ├── ThinkingCard.tsx                        # 已有
│       └── ...其他 22 个已有文件
│
├── features/workflow/
│   ├── components/canvas/
│   │   ├── WorkflowCanvas.tsx                      # 重构 ~180 行
│   │   ├── HistoryControls.tsx                     # NEW ~35 行
│   │   ├── canvas-constants.ts                     # NEW ~60 行
│   │   ├── canvas-node-factory.ts                  # NEW ~80 行
│   │   ├── CanvasContextMenu.tsx                   # 已有
│   │   ├── NodeContextMenu.tsx                     # 已有
│   │   ├── EdgeContextMenu.tsx                     # 已有
│   │   └── ...其他已有文件
│   ├── hooks/
│   │   ├── use-canvas-dnd.ts                       # NEW ~120 行
│   │   ├── use-canvas-clipboard.ts                 # NEW ~80 行
│   │   ├── use-canvas-keyboard.ts                  # NEW ~80 行
│   │   ├── use-canvas-context-menus.ts             # NEW ~60 行
│   │   ├── use-canvas-event-listeners.ts           # NEW ~120 行
│   │   ├── use-canvas-edge-reconnect.ts            # NEW ~40 行
│   │   └── ...其他 12 个已有 hooks
│   ├── constants/
│   │   ├── workflow-meta.ts                        # 已有，保留不拆
│   │   └── ai-models.ts                            # 已有
│   └── utils/                                      # 已有，保持
│
├── features/auth/
│   ├── forms/
│   │   ├── RegisterForm.tsx                        # 重构 ~180 行
│   │   ├── LoginForm.tsx                           # 已有
│   │   └── ForgotPasswordFlow.tsx                  # 已有
│   └── hooks/
│       └── use-register-form.ts                    # NEW ~120 行
│
├── features/community-nodes/
│   ├── components/
│   │   ├── CommunityNodeManagePage.tsx             # 重构 ~150 行
│   │   ├── CommunityNodeEditor.tsx                 # NEW ~140 行
│   │   └── ...其他已有文件
│   └── hooks/
│       └── use-community-node-manage.ts            # NEW ~80 行
```

## 后端

```
backend/app/
├── engine/
│   ├── __init__.py                                 # 更新 re-export
│   ├── executor.py                                 # 重构 ~250 行（主编排）
│   ├── topology.py                                 # NEW ~120 行
│   ├── node_runner.py                              # NEW ~180 行
│   ├── loop_runner.py                              # NEW ~120 行
│   ├── context.py                                  # 已有
│   ├── events.py                                   # 已有
│   └── sse.py                                      # 已有
│
├── services/
│   ├── ai_router.py                                # 重构 ~250 行
│   ├── llm_provider.py                             # NEW ~80 行
│   ├── llm_caller.py                               # NEW ~150 行
│   ├── community_node_queries.py                   # NEW ~220 行
│   ├── community_node_service.py                   # 重构 ~210 行
│   ├── workflow_generator.py                       # NEW ~250 行
│   ├── notice_service.py                           # NEW ~180 行
│   ├── admin_user_service.py                       # NEW ~120 行
│   ├── usage_analytics.py                          # 重构 ~180 行
│   ├── usage_analytics_breakdown.py                # NEW ~160 行
│   ├── usage_analytics_helpers.py                  # NEW ~140 行
│   ├── usage_ledger.py                             # 重构 ~200 行
│   ├── usage_ledger_models.py                      # NEW ~145 行
│   └── ...其他已有 services
│
├── api/
│   ├── ai.py                                       # 重构 ~180 行
│   ├── admin_notices.py                            # 重构 ~200 行
│   ├── admin_users.py                              # 重构 ~170 行
│   ├── auth/
│   │   ├── login.py                                # 重构 ~180 行
│   │   ├── password.py                             # NEW ~120 行
│   │   ├── me.py                                   # NEW ~70 行
│   │   └── ...其他已有文件
│   └── ...其他已有 API 文件
```

## 统计

| 指标 | 拆分前 | 拆分后 |
|------|--------|--------|
| 前端超标文件（>300行） | 18 | 0（目标） |
| 后端超标文件（>300行） | 12 | 0（目标） |
| 新增前端文件 | — | ~22 |
| 新增后端文件 | — | ~12 |
| 总预估工作量 | — | ~20 小时 |

## 跨文件可复用组件汇总

| 组件/函数 | 当前位置 | 可复用场景 |
|-----------|----------|-----------|
| `MagicWandLoader` | ChatMessages 内重复 SVG | ChatSkeletonLoader + AIMessage |
| `CopyButton` | ChatMessages 内 | 节点输出、公开页代码块 |
| `StudySoloIcon` | ChatMessages 内 | EmptyState、品牌展示 |
| `createDefaultNodeData` | WorkflowCanvas 内 | NodeStorePanel click-to-add |
| `markdownComponents` | ChatMessages 内 | NodeMarkdownOutput、PublicWorkflowView |
| `topological_sort` | executor.py 内 | 测试工具、可视化调试 |
| `sanitize_user_input` | api/ai.py 内 | 其他 API 输入校验 |
| `deduplicateNodes` | workflow-store 内 | 测试、导入功能 |
