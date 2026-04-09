# Phase 3: 前端架构重构

> 预估时间：8 天
> 前置依赖：Phase 1 全部冻结
> 负责人：主系统负责人
> 可并行：Phase 2（后端重构）、Phase 4（子后端样板）

---

## 目标

**消灭前端架构债**——解耦 Store、统一 Service、改进事件通信、为节点系统 Manifest-First 做准备。

---

## Task 3.1：Store 跨域解耦（最高优先）

### 问题回顾

`useAIChatStore.pushMessage` 在 setter 内部直接调用 `useConversationStore.getState()`，形成隐式跨 Store 依赖。

### 解决方案：调用方显式同步

```typescript
// 修改 stores/use-ai-chat-store.ts
// 删除 pushMessage 内部对 useConversationStore 的调用

pushMessage: (role, content) => {
  const entry: ChatEntry = {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: Date.now(),
  };
  set((state) => ({ history: [...state.history, entry] }));
  return entry.id;  // ← 只管自己的状态
},
```

```typescript
// 修改调用方 features/workflow/hooks/use-stream-chat.ts
const handleMessage = (role: string, content: string) => {
  const id = useAIChatStore.getState().pushMessage(role, content);
  
  // 显式处理跨 store 同步
  const convStore = useConversationStore.getState();
  if (!convStore.activeId) convStore.createConversation();
  convStore.appendMessage({ id, role, content, timestamp: Date.now() });
  
  return id;
};
```

### 验证

- [ ] AI 聊天消息正常发送和显示
- [ ] 新建对话自动创建 conversation
- [ ] 历史消息列表正常同步

### AI 编程易出问题的点

> [!WARNING]
> 1. **调用方查找不完全**：`pushMessage` 可能在多处被调用，必须 `grep -r "pushMessage" frontend/src/` 找出所有调用点
> 2. **`getState()` 的时机**：Zustand `getState()` 是同步的，但 `createConversation` 可能有异步操作（如存数据库），需要 await
> 3. **React 渲染批次**：两个 store 的状态更新不在同一个 React batch 内，可能导致短暂闪烁

---

## Task 3.2：Store 目录重组

### 目标结构

```
stores/
├── workflow/
│   ├── use-workflow-store.ts
│   ├── execution-slice.ts       # 保持 slice 但归入子目录
│   └── history-slice.ts
├── chat/
│   ├── use-ai-chat-store.ts
│   └── use-conversation-store.ts
├── ui/
│   ├── use-panel-store.ts
│   └── use-settings-store.ts
├── admin/
│   └── use-admin-store.ts
├── workflow-store-helpers.ts    # 保持在根级
└── index.ts                     # 统一导出
```

### 操作步骤

1. 创建子目录
2. 移动文件
3. 全局搜索替换 import 路径
4. 在 `index.ts` 建立统一导出，保持向后兼容

### AI 编程易出问题的点

> [!WARNING]
> 1. **`@/stores/use-xxx` vs `@/stores/workflow/use-xxx`**：大量 import 路径需要更新，AI 容易漏
> 2. **`slices/` 目录**：`execution-slice.ts` 被 `use-workflow-store.ts` 以相对路径引用，移动后相对路径变化
> 3. **Barrel export 陷阱**：`index.ts` 要用 `export { useWorkflowStore } from './workflow/use-workflow-store'`，不要 `export *`

---

## Task 3.3：Service 层统一

### 3.3.1 合并 workflow.service.ts + workflow.server.service.ts

```typescript
// services/workflow.service.ts（合并后）
type AuthMode = 'header' | 'cookie';

function createFetcher(authMode: AuthMode) {
  return async (url: string, options?: RequestInit) => {
    const headers = authMode === 'header'
      ? { Authorization: `Bearer ${await getAccessToken()}` }
      : {};
    return fetch(url, { ...options, headers: { ...headers, ...options?.headers }, credentials: authMode === 'cookie' ? 'include' : undefined });
  };
}

export const workflowService = createWorkflowService('header');
export const serverWorkflowService = createWorkflowService('cookie');
```

### 3.3.2 统一 api-client 使用

搜索所有直接使用 `fetch` 的 service 文件，统一改为通过 `api-client.ts` 的 `authedFetch`。

**验证**：`grep -r "fetch(" frontend/src/services/ | grep -v "api-client"` 返回 0 结果

---

## Task 3.4：事件通信模式改进

### 创建类型安全的 EventBus

```typescript
// lib/events/event-bus.ts
type EventMap = {
  'canvas:tool-change': { tool: string };
  'canvas:node-placed': { nodeId: string; position: { x: number; y: number } };
  'workflow:execution-start': { workflowId: string };
  'workflow:execution-complete': { workflowId: string; status: string };
  'panel:toggle': { panel: string; visible: boolean };
};

class TypedEventBus {
  private listeners = new Map<string, Set<Function>>();

  on<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }
}

export const eventBus = new TypedEventBus();
```

### 渐进式迁移

不需要一次替换所有 CustomEvent：
1. 新代码必须用 `eventBus`
2. 旧 CustomEvent 在涉及该文件的 PR 中逐步替换
3. 添加 ESLint 规则 `no-restricted-globals: [dispatchEvent]`（仅 warning，不 error）

### AI 编程易出问题的点

> [!WARNING]
> 1. **内存泄漏**：`eventBus.on` 返回的 unsubscribe 函数必须在组件 unmount 时调用
> 2. **React hooks 中的 stale closure**：handler 函数中引用的 state 可能是旧值，需要用 ref 或 useCallback
> 3. **SSR 兼容**：Next.js SSR 环境下 `window` 不存在，EventBus 必须支持 server 端空操作

---

## Task 3.5：节点 Manifest-First 前端适配准备

### 目标

让前端 `RENDERER_REGISTRY` 从后端 manifest 动态生成，而不是静态维护。

### Step 1：扩展后端 manifest 返回 `renderer` 字段

（与 Phase 2 协调，后端需要在 manifest API 中增加 `renderer` 字段）

### Step 2：前端创建动态 Registry

```typescript
// features/workflow/components/nodes/dynamic-registry.ts
import { STATIC_RENDERERS } from './renderers';

const RENDERER_MAP: Record<string, React.ComponentType<any>> = {
  ...STATIC_RENDERERS,  // 兜底：保留静态注册
};

export async function initRendererRegistry() {
  const manifest = await fetch('/api/nodes/manifest').then(r => r.json());
  for (const node of manifest) {
    if (node.renderer && STATIC_RENDERERS[node.renderer]) {
      RENDERER_MAP[node.type] = STATIC_RENDERERS[node.renderer];
    }
  }
}

export function getRenderer(nodeType: string) {
  return RENDERER_MAP[nodeType] || RENDERER_MAP['default'];
}
```

### Step 3：渐进式迁移

- 不删除 `renderers/index.ts`，而是让它作为 `STATIC_RENDERERS` 的兜底
- 新节点只需要在后端 manifest 声明 `renderer`，前端不再需要修改 RENDERER_REGISTRY

### AI 编程易出问题的点

> [!WARNING]
> 1. **首屏闪烁**：manifest 是异步加载的，首次渲染时 registry 可能还没初始化
> 2. **动态导入**：`React.lazy` 可以用于按需加载渲染器，但 SSR 环境需要特殊处理
> 3. **类型安全**：manifest 返回的 `renderer` 字段值如何映射到实际的 React 组件？必须有静态映射表兜底

---

## Phase 3 完成标志

- [ ] useAIChatStore 不再直接调用 useConversationStore
- [ ] stores/ 已重组为子目录结构
- [ ] workflow.server.service.ts 已合并或消除重复
- [ ] TypedEventBus 已创建，新代码使用 EventBus
- [ ] 节点 Manifest-First 前端适配准备完成
- [ ] 所有 Vitest 测试通过
- [ ] 手动测试：工作流画布、AI 聊天、节点拖放、全局面板切换

> [!IMPORTANT]
> **回滚策略**：同 Phase 2，每个 Task 独立 PR。前端改动通过 `npm run dev` 手动验证核心流程。
