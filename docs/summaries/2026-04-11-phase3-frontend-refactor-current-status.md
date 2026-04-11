<!-- 编码：UTF-8 -->

# StudySolo 2026-04-11 阶段总结：Phase 3 前端重构当前状态

**完成日期**：2026-04-11  
**状态**：当前本地状态已收口，前端 Phase 3 已从 stores/service 收口推进到 workflow-local EventBus 与 renderer registry 预适配  
**覆盖范围**：Phase 2 后端重构后的稳定化、Phase 3 / D2 与 3.3~3.5 当前已落地部分、当前本地提交链、验证结果与下一步建议

## 1. 执行摘要

截至 2026-04-11，StudySolo 的真实状态可以概括为四点：

1. **Phase 2 后端结构重构已稳定**
   - `backend/app/api/workflow/`
   - `backend/app/api/ai/`
   - `backend/app/services/llm/`
   - Workflow 路由基线仍保持 `107`
   - Workflow 关键测试已回绿

2. **Phase 2 后续稳定化已完成核心闭环**
   - B1：非流式 AI Chat usage 收口已完成
   - D1：前端 chat bridge 解耦与 workflow service 初步收口已完成

3. **Phase 3 前端重构已完成 stores、service、workflow-local EventBus、renderer registry 预适配四条主线的当前阶段交付**
   - stores 已按域重组并保留兼容 shim
   - workflow 主域 import 已基本切完
   - workflow 相关 service 请求通道已进一步统一
   - workflow-local TypedEventBus 已落地
   - renderer registry 已拆成“renderer 名映射 + nodeType 回退”两层

4. **当前本地 `main` 比 `origin/main` 超前 6 个提交**
   - `b28812b refactor(frontend): migrate workflow component store imports`
   - `2bcd9fd refactor(frontend): finish workflow store and service migration`
   - `29b3954 fix(frontend): restore admin models page export`
   - `70c6582 refactor(frontend): unify workflow-adjacent service fetchers`
   - `4de7087 refactor(frontend): add workflow typed event bus`
   - `2adc657 refactor(frontend): prepare workflow renderer registry`

## 2. 当前已完成改动

### 2.1 Phase 2 / 稳定化基础

已确认完成：

- Phase 2 后端结构重构
- Workflow 路由测试基线恢复
- `/api/ai/chat` 的 usage tracking 收口
- 前端 AI chat store 与 conversation store 解耦
- browser / server 两侧 workflow service 的初步职责收口

这一层的意义是把“刚完成重构的结构”变成“能继续安全推进 Phase 3 的基线”。

### 2.2 D2 / Task 3.2：stores 目录重组与 import 迁移

已完成的闭环包括：

1. `3.2a stores` 目录重组兼容层
   - 新目录：
     - `frontend/src/stores/chat/`
     - `frontend/src/stores/workflow/`
     - `frontend/src/stores/ui/`
     - `frontend/src/stores/admin/`
   - 根层 compat shim 保留：
     - `frontend/src/stores/use-ai-chat-store.ts`
     - `frontend/src/stores/use-conversation-store.ts`
     - `frontend/src/stores/use-workflow-store.ts`
     - `frontend/src/stores/use-panel-store.ts`
     - `frontend/src/stores/use-settings-store.ts`
     - `frontend/src/stores/use-admin-store.ts`
   - 新增：
     - `frontend/src/stores/index.ts`
     - `frontend/src/__tests__/store-path-compat.property.test.ts`

2. `3.2b-1` 低风险 store import 切换
   - tests
   - `components/layout`
   - `components/layout/sidebar`
   - `features/admin`
   - `features/settings`
   - `app/(admin)/admin-analysis/login/page.tsx`
   - `app/(dashboard)/settings/page.tsx`

3. `3.2b-2` workflow hooks 与 workspace shell import 切换
   - `frontend/src/features/workflow/hooks/**` 关键 hooks
   - `frontend/src/app/(dashboard)/workspace/[id]/WorkflowCanvasLoader.tsx`
   - `frontend/src/app/(dashboard)/workspace/[id]/WorkflowPageShell.tsx`

4. `3.2b-3` workflow components import 切换
   - `frontend/src/features/workflow/components/**` 中 20 个文件、21 处 import 已切到新分组路径

5. `3.2b-4` workflow utils 尾差收口
   - `frontend/src/features/workflow/utils/edge-actions.ts` 已切到 `@/stores/workflow/use-workflow-store`

截至目前，**workflow 主域的 components + hooks + utils 已脱离旧 shim**。  
已知保留例外只有：

- `frontend/src/app/m/[id]/MemoryView.tsx`

### 2.3 Wave 0 / 构建基线恢复

在继续推进前端重构前，已额外完成一个独立修复闭环：

- 恢复 `frontend/src/features/admin/models/AdminModelsPageView.tsx`
- 解除 `pnpm build` 被 `AdminModelsPageView` 缺失导出阻塞的问题

同时补齐了：

- `frontend/src/app/(dashboard)/workspace/page.tsx` 的 quota fallback 字段
  - `daily_chat_used`
  - `daily_chat_limit`
  - `daily_execution_used`
  - `daily_execution_limit`

这一步的目标不是做 admin 重构，而是恢复“构建能继续作为全局验证门禁”。

### 2.4 Task 3.3：service 层统一的当前进度

#### 已完成 3.3.1

- `frontend/src/services/workflow.service.ts`
  - workflow 读取类请求统一走共享 helper
  - 集中处理 URL、认证头、`revalidate/cache`、401 语义和错误回退
- `frontend/src/services/workflow.server.service.ts`
  - 进一步收薄到 server token / refresh / retry 包装层
- 测试：
  - `frontend/src/__tests__/workflow-service.property.test.ts`
  - `frontend/src/__tests__/workflow-server-service.property.test.ts`

#### 已完成 3.3.2 的 workflow-adjacent service 批次

1. `frontend/src/services/api-client.ts`
   - 当 `body` 是 `FormData` 时，不再默认注入 `Content-Type: application/json`
   - 调用方显式提供 `Content-Type` 时仍然尊重调用方

2. `frontend/src/services/collaboration.service.ts`
   - 浏览器侧裸 `fetch(..., { credentials: 'include' })` 已统一改为 `authedFetch`

3. `frontend/src/services/community-nodes.service.ts`
   - `publishCommunityNode` 已迁到 FormData-safe 的统一请求 helper
   - 保持 multipart 语义不变，不手动写 boundary

4. `frontend/src/services/memory.server.service.ts`
   - 收口到与 `workflow.server.service.ts` 一致的 server-read 风格
   - 保持 owner/public fallback 顺序不变

5. 对应测试已补齐：
   - `frontend/src/__tests__/api-client.property.test.ts`
   - `frontend/src/__tests__/collaboration-service.property.test.ts`
   - `frontend/src/__tests__/community-nodes.service.property.test.ts`
   - `frontend/src/__tests__/memory-server-service.property.test.ts`

### 2.5 Task 3.4：workflow-local TypedEventBus 已落地

已完成的第一批事件迁移：

- 新增：
  - `frontend/src/lib/events/event-bus.ts`
- 已迁 workflow-local 事件：
  - `canvas:tool-change`
  - `canvas:show-modal`
  - `canvas:focus-node`
  - `canvas:add-annotation`
  - `canvas:delete-annotation`
  - `canvas:placement-mode`
  - `workflow:open-node-config`
  - `workflow:close-node-config`
  - `workflow:toggle-all-slips`

关键约束也已实现：

- EventBus 模块本身不直接访问 `window`，SSR-safe
- `useCanvasEventListeners` 已改用 typed event bus 订阅
- `NodeResultSlip` 保留了对旧 `window` 事件的兼容监听
  - 目的：不修改 `MemoryView.tsx` 的前提下，确保 `/m/[id]` 仍可通过旧事件控制“展开/折叠全部 slips”
- `frontend/eslint.config.mjs`
  - 新增 workflow 域 warning 级限制，提醒新代码不要继续直接发 `CustomEvent`

明确仍未纳入第一批的事件：

- `node-store:add-node`
- `studysolo:tier-refresh`

### 2.6 Task 3.5：renderer registry 预适配已完成

已完成：

- `frontend/src/features/workflow/components/nodes/index.ts`
  - 从单层 `RENDERER_REGISTRY` 拆成两层：
    - `RENDERER_COMPONENTS`：renderer 名 -> 组件
    - `NODE_TYPE_RENDERERS`：node type -> renderer 名
  - 保留 `getRenderer(nodeType)` 现有行为
  - 新增：
    - `getRendererByName(...)`
    - `resolveRenderer(...)`

已补测试：

- `frontend/src/__tests__/node-renderer-registry.property.test.ts`

**当前仍未真正启用 manifest-first 的原因很明确**：

- 后端 `backend/app/nodes/_base.py::BaseNode.get_manifest()` 目前还没有返回：
  - `display_name`
  - `renderer`
  - `version`
- 前端 `frontend/src/types/workflow.ts::NodeManifestItem` 也还没有这些字段

所以这一轮只是把前端静态 registry 整理成“可接线”结构，没有提前造假实现。

## 3. 当前验证结果

### 3.1 通过的定向测试

本阶段已明确通过的测试包括：

- stores / import 迁移相关
  - `store-path-compat.property.test.ts`
  - `workflow-store.property.test.ts`
  - `workflow-sync.property.test.ts`
  - `loop-group-drop.property.test.ts`
  - `integration-fixes.workflow-runbutton.property.test.ts`
- workflow service / server service
  - `workflow-service.property.test.ts`
  - `workflow-server-service.property.test.ts`
- workflow-adjacent service
  - `api-client.property.test.ts`
  - `collaboration-service.property.test.ts`
  - `community-nodes.service.property.test.ts`
  - `memory-server-service.property.test.ts`
- EventBus / renderer registry
  - `workflow-event-bus.property.test.ts`
  - `node-renderer-registry.property.test.ts`

### 3.2 构建

当前 `pnpm build` 已恢复通过。  
现存构建级提示仅剩：

- Next.js 的 `middleware` -> `proxy` 约定弃用 warning

### 3.3 lint 说明

本轮新增代码没有引入新的构建或类型错误。  
但在定向 `eslint` 里仍能看到两处既有问题：

- `frontend/src/features/workflow/components/nodes/AIStepNode.tsx`
  - `react-hooks/static-components`
- `frontend/src/features/workflow/components/toolbar/SearchBar.tsx`
  - `react-hooks/set-state-in-effect`
  - `react-hooks/exhaustive-deps`

这些问题在本轮之前就存在，本轮没有顺手重构它们，以保持“小步闭环、零行为改动优先”。

## 4. 当前边界与保留项

截至当前，以下边界是刻意保留的，不应被误判成“漏做”：

1. `frontend/src/app/m/[id]/MemoryView.tsx`
   - 仍是旧 shim 与旧 `window` 事件链路的业务例外

2. `frontend/src/stores/use-*.ts`
   - compat shim 继续保留

3. `frontend/src/__tests__/store-path-compat.property.test.ts`
   - 必须继续同时覆盖旧路径 + 新路径 + barrel

4. `node-store:add-node` 与 `studysolo:tier-refresh`
   - 还没进入 EventBus 第二批迁移

5. `NodeManifestItem` / backend manifest
   - 契约文档已冻结，但真实 API 还没补字段

## 5. 当前最准确的状态判断

截至现在，Phase 3 可以这样判断：

1. **D2 可视为已完成 workflow 主域收口**
   - stores 新结构已建立
   - workflow 主域 import 已切完
   - compat 例外显式保留为 `MemoryView`

2. **Task 3.3 已完成当前最值得做的 service consolidation 批次**
   - workflow service / server service 重复已明显收薄
   - workflow-adjacent service 已统一到 `api-client`

3. **Task 3.4 已完成第一批 workflow-local EventBus**
   - 但还不是全仓事件总线完成

4. **Task 3.5 只完成了前端静态预适配**
   - 尚未真正进入 manifest-first 运行时切换

换句话说，当前项目已经不是“Phase 3 刚开始”的状态，而是：

- stores / service / workflow-local event / renderer 准备层都已推进一大段
- 下一步开始受后端 manifest 契约落地与跨域事件批次选择约束

## 6. 下一步建议

按当前真实进度，最合理的后续顺序是：

1. **优先推进 manifest 契约落地**
   - backend `BaseNode.get_manifest()` 增加：
     - `display_name`
     - `renderer`
     - `version`
   - 前端 `NodeManifestItem` 同步补字段
   - 然后再把 `resolveRenderer(...)` 真正接到 manifest 数据上

2. **其次做 EventBus 第二批迁移**
   - 只挑边界清晰的跨域事件
   - 不要和 manifest-first 混在同一个闭环里

3. **最后再考虑 `MemoryView.tsx` 例外是否收口**
   - 必须单独成环
   - 不能顺手混进 EventBus 或 manifest 改造

## 7. 结论

截至 2026-04-11，StudySolo 当前最新本地状态已经从“Phase 2 刚收尾、Phase 3 仅完成 stores 目录迁移前置”推进到：

- workflow 主域 store import 收口完成
- workflow / memory / collaboration / community-node 相关 service 请求通道收口完成
- workflow-local TypedEventBus 第一批落地
- renderer registry 的 manifest-first 预适配完成
- 全局构建重新恢复绿色

接下来真正的分叉点不在“还要不要继续做前端整理”，而在于：

- 先补 backend manifest 真契约
- 还是先继续处理第二批跨域事件

无论选哪条，都应继续保持当前这套约束：

- UTF-8 读写
- 最小 patch
- 一次一个闭环
- 不顺手处理 `MemoryView`、compat shim、无关脏文件

## 8. 追加更新（2026-04-11 晚）：Manifest 契约闭环与跨域 EventBus 第二批已完成

在上述阶段总结形成后，Phase 3 又继续向前推进了三个独立闭环，分别覆盖 backend manifest 契约、frontend manifest renderer 接线，以及跨域 EventBus 第二批迁移。

### 8.1 `feat(backend): extend node manifest metadata contract`

后端节点 manifest 已从“预留契约”推进到“真实 API 已返回新字段”。

#### 完成内容
1. `backend/app/nodes/_base.py`
   - `BaseNode` 新增类变量：
     - `display_name`
     - `renderer`
     - `version`
   - `BaseNode.get_manifest()` 统一输出这三个字段
2. 现有节点已显式补齐 `display_name`
   - 例如：
     - `trigger_input -> 用户输入`
     - `ai_analyzer -> 需求分析`
     - `ai_planner -> 工作流规划`
     - `summary -> 总结归纳`
     - `loop_group -> 循环块`
     - `community_node -> 社区共享节点`
3. 现有专用 renderer 节点已显式补齐 `renderer`
   - `outline_gen -> OutlineRenderer`
   - `flashcard -> FlashcardRenderer`
   - `compare -> CompareRenderer`
   - `mind_map -> MindMapRenderer`
   - `quiz_gen -> QuizRenderer`
   - `community_node -> CommunityNodeRenderer`
4. `version` 当前统一固定为 `1.0.0`
5. 新增 dedicated route test
   - `backend/tests/test_node_manifest_contract_property.py`

#### 结果
- `GET /api/nodes/manifest` 现在真实返回：
  - `display_name`
  - `renderer`
  - `version`
- backend manifest 契约不再只是冻结文档，而是已落地实现

### 8.2 `refactor(frontend): align node manifest types and renderer resolution`

这一闭环把前端 manifest 数据面与新的 backend 契约对齐，并让 renderer 选择真正走 manifest-first 的最小运行路径。

#### 完成内容
1. `frontend/src/types/workflow.ts`
   - `NodeManifestItem` 新增：
     - `display_name`
     - `renderer`
     - `version`
2. `frontend/src/services/node-manifest.service.ts`
   - 保持现有 cache / inflight 结构
   - 新增 `peekNodeManifestCache()`，让消费方能优先复用已缓存 manifest
3. `frontend/src/features/workflow/hooks/use-node-manifest.ts`
   - 新增：
     - `findNodeManifestItem(...)`
     - `useNodeManifestItem(...)`
   - 保持原 hook 形态，不新增 store，不做全局初始化
4. 两个输出渲染入口现在都改为：
   - manifest 命中 `renderer` 时，优先走 `resolveRenderer({ nodeType, rendererName })`
   - manifest 缺失或 renderer 无效时，继续回退到静态 `nodeType -> renderer` 映射
5. 新增测试
   - `frontend/src/__tests__/node-manifest.service.property.test.ts`

#### 范围控制
- 这一轮**只接 renderer**
- 没有把 `workflow-meta.ts`、节点商店、节点配置抽屉改成 manifest 驱动
- `NodeConfigFormContent` 继续只把 manifest 用在：
  - `config_schema`
  - `output_capabilities`
  - `deprecated_surface`

### 8.3 `refactor(frontend): migrate cross-domain events to typed bus`

在 workflow-local EventBus 第一批完成后，这一轮继续完成第二批跨域事件迁移。

#### 完成内容
1. `frontend/src/lib/events/event-bus.ts`
   - 新增事件：
     - `node-store:add-node`
     - `studysolo:tier-refresh`
2. `node-store:add-node`
   - 发射端：
     - `frontend/src/components/layout/sidebar/NodeStoreItem.tsx`
   - 监听端：
     - `frontend/src/features/workflow/hooks/use-canvas-event-listeners.ts`
   - 已从 `window.dispatchEvent / addEventListener` 切换到 typed event bus
3. `studysolo:tier-refresh`
   - 发射端：
     - `frontend/src/app/upgrade/_components/RedeemCode.tsx`
   - 监听端：
     - `frontend/src/components/layout/sidebar/UserPanel.tsx`
     - `frontend/src/components/layout/sidebar/WalletPanel.tsx`
   - 已从旧 `window` 自定义事件切换到 typed event bus
4. `frontend/src/__tests__/workflow-event-bus.property.test.ts`
   - 新增了第二批事件的测试覆盖

#### 明确保留
- `frontend/src/app/m/[id]/MemoryView.tsx` 仍然不动
- `workflow:toggle-all-slips` 的 legacy 兼容监听仍保留在 `NodeResultSlip.tsx`
- 这保证 `/m/[id]` 仍能沿旧链路工作，不被第二批事件迁移误伤

### 8.4 本轮新增验证结果

#### 后端
- `pytest backend/tests/test_node_manifest_contract_property.py`
- 结果：通过

#### 前端
- `pnpm.cmd test -- src/__tests__/node-manifest.service.property.test.ts src/__tests__/node-renderer-registry.property.test.ts src/__tests__/workflow-event-bus.property.test.ts`
- 实际结果：Vitest 全量测试一并执行，`39` 个测试文件、`155` 个测试全部通过

#### 构建
- `pnpm.cmd build`
- 结果：通过

#### 静态扫描结论
- `node-store:add-node` 不再有旧 `window` 自定义事件残留
- `studysolo:tier-refresh` 不再有旧 `window` 自定义事件残留
- 仅剩 `MemoryView.tsx` 继续保留既有 `workflow:toggle-all-slips` 兼容路径

### 8.5 当前本地提交链追加

在之前 6 个本地提交基础上，又新增了 3 个本地提交：

- `eaeabab feat(backend): extend node manifest metadata contract`
- `0d87d1a refactor(frontend): align node manifest types and renderer resolution`
- `ca47b64 refactor(frontend): migrate cross-domain events to typed bus`

因此当前本地 `main` 相比 `origin/main` 已累计超前 `10` 个提交。

### 8.6 当前最准确的状态判断（更新版）

截至 2026-04-11 当前最新本地状态，Phase 3 可以这样重新判断：

1. **D2 已完成 workflow 主域收口**
   - stores 新结构、compat shim、workflow 主域路径迁移都已稳定
2. **Task 3.3 已完成当前规划内最重要的一批 service consolidation**
   - workflow / collaboration / community-node / memory 相关 service 已明显收薄
3. **Task 3.4 已完成两批事件迁移**
   - workflow-local 第一批已完成
   - `node-store:add-node` 与 `studysolo:tier-refresh` 第二批也已完成
4. **Task 3.5 已不再停留在“静态预适配”**
   - backend manifest 契约已真实返回新字段
   - frontend 输出渲染已真正接入 manifest `renderer`
5. **当前仍显式保留的例外只剩少数边界项**
   - `MemoryView.tsx`
   - compat shim
   - `workflow-meta.ts` 的 label/icon/description 硬编码职责

换句话说，Phase 3 现在已经从“准备接 manifest / 第二批事件尚未开始”，推进到了：

- manifest 契约已真实落地
- renderer-first 的最小运行时接线已完成
- 跨域事件第二批已落地
- 构建与核心测试链保持绿色

### 8.7 `refactor(frontend): prefer manifest copy in node config drawer`

在 renderer 与跨域事件收口后，Phase 3 继续沿“manifest-first UI 文案渐进替换”推进了第一步，先只处理节点配置抽屉，不扩到其它 UI。

#### 完成内容
1. 新增纯函数 helper
   - `frontend/src/features/workflow/components/node-config/resolve-node-config-copy.ts`
   - 统一节点配置抽屉文案解析规则：
     - 标题：`node.data.label -> manifest.display_name -> workflow-meta.label`
     - 描述：`manifest.description -> workflow-meta.description`
   - 空字符串与纯空白字符串视为缺失
2. `frontend/src/features/workflow/components/node-config/NodeConfigDrawer.tsx`
   - 抽屉 header 已改为 manifest-first 文案
   - 仍保留 `node.data.label` 的最高优先级，不覆盖实例标题语义
3. `frontend/src/features/workflow/components/node-config/NodeConfigFormContent.tsx`
   - 顶部能力摘要卡片已复用同一套文案解析逻辑
   - 其余 schema / output capabilities / deprecated surface / patch 写回逻辑保持不变
4. 新增纯逻辑测试
   - `frontend/src/__tests__/node-config-copy.property.test.ts`

#### 验证
- `pnpm --dir frontend test -- src/__tests__/node-config-copy.property.test.ts src/__tests__/node-manifest.service.property.test.ts`
- `pnpm --dir frontend build`
- 结果：通过

#### 提交
- `36e6d20 refactor(frontend): prefer manifest copy in node config drawer`

### 8.8 `refactor(frontend): prefer manifest copy in node store`

在节点配置抽屉收口后，继续推进第二个 UI 文案闭环，只处理节点商店默认视图的列表展示、tooltip 和搜索命中。

#### 完成内容
1. 新增节点商店纯函数 helper
   - `frontend/src/components/layout/sidebar/resolve-node-store-copy.ts`
   - 提供：
     - `resolveNodeStoreCopy(...)`
     - `matchesNodeStoreQuery(...)`
   - 统一规则：
     - 标题：`manifest.display_name -> workflow-meta.label`
     - 描述：`manifest.description -> workflow-meta.description`
     - 搜索：命中标题、描述或原始 `nodeType`
2. `frontend/src/components/layout/sidebar/NodeStoreDefaultView.tsx`
   - 顶层统一持有 `useNodeManifest()`
   - 搜索过滤、分类计数、列表渲染都已改为复用 manifest-first helper
   - 未新增 loading/error UI，manifest 缺失时仍即时回退到 `workflow-meta`
3. `frontend/src/components/layout/sidebar/NodeStoreItem.tsx`
   - 列表项标题、副标题和 hover tooltip 顶部短文案已切到 manifest-first
   - icon / theme / 扩展说明仍保留 `workflow-meta` 静态职责
4. 新增纯逻辑测试
   - `frontend/src/__tests__/node-store-copy.property.test.ts`

#### 验证
- `pnpm --dir frontend test -- src/__tests__/node-store-copy.property.test.ts src/__tests__/node-manifest.service.property.test.ts src/__tests__/workflow-event-bus.property.test.ts`
- `pnpm --dir frontend build`
- 结果：通过

#### 提交
- `560969c refactor(frontend): prefer manifest copy in node store`

### 8.9 当前状态补充判断（最新）

截至这两个闭环完成后，Phase 3 关于 manifest-first UI 文案的推进已经形成三段清晰路径：

1. 输出渲染入口已接入 manifest `renderer`
2. 节点配置抽屉已切到 manifest-first 文案
3. 节点商店默认视图已切到 manifest-first 文案与搜索

当前仍明确保留、不应混做的边界包括：

- `frontend/src/app/m/[id]/MemoryView.tsx`
- compat shim
- `workflow-meta.ts` 的 icon / theme / 端口 / 结构性元数据职责
- 右侧面板与画布节点本体的剩余文案来源

因此，下一步最合理的方向已经不再是节点商店，而是评估右侧面板等剩余 UI 文案是否继续按同样策略渐进切到 manifest。

### 8.10 `refactor(frontend): prefer manifest copy in execution panels`

在节点配置抽屉和节点商店之后，这一轮继续推进执行态 UI，但仍然只处理名称与描述回退，不改执行 trace 主标题语义。

#### 完成内容
1. 新增执行面板纯函数 helper
   - `frontend/src/features/workflow/utils/execution-node-copy.ts`
   - 提供：
     - `resolveExecutionNodeCopy(...)`
     - `buildExecutionNodeNameMap(...)`
2. `frontend/src/components/layout/sidebar/RightPanelContent.tsx`
   - 焦点标题与描述已切到 manifest-first 回退
   - `trace.nodeName` 继续保留最高优先级
3. `frontend/src/features/workflow/components/execution/ExecutionTraceDrawer.tsx`
   - 执行列表输入标签所依赖的 `nodeNameMap` 已改为复用同一套名称回退
4. 新增测试
   - `frontend/src/__tests__/execution-node-copy.property.test.ts`

#### 验证
- `pnpm --dir frontend test -- src/__tests__/execution-node-copy.property.test.ts src/__tests__/workflow-right-panel.property.test.ts src/__tests__/node-manifest.service.property.test.ts`
- `pnpm --dir frontend build`
- 结果：通过

#### 提交
- `cf90a66 refactor(frontend): prefer manifest copy in execution panels`

### 8.11 `refactor(frontend): prefer manifest descriptions in canvas nodes`

在执行面板组之后，这一轮继续推进画布节点本体，但保持为“只改描述、不改标题语义”的最小闭环。

#### 完成内容
1. 新增画布节点描述纯函数 helper
   - `frontend/src/features/workflow/components/nodes/resolve-canvas-node-description.ts`
2. `frontend/src/features/workflow/components/nodes/AIStepNode.tsx`
   - 普通节点描述已切到：
     - `manifest.description -> workflow-meta.description`
   - 社区节点描述已切到：
     - `input_hint -> manifest.description -> '社区共享的封装 AI 节点'`
   - 节点标题继续直接使用实例 `label`
3. 新增测试
   - `frontend/src/__tests__/canvas-node-copy.property.test.ts`

#### 验证
- `pnpm --dir frontend test -- src/__tests__/canvas-node-copy.property.test.ts src/__tests__/node-manifest.service.property.test.ts`
- `pnpm --dir frontend build`
- 结果：通过

#### 提交
- `135ee6b refactor(frontend): prefer manifest descriptions in canvas nodes`

### 8.12 当前状态补充判断（再次更新）

截至当前最新本地状态，Phase 3 关于 manifest-first UI 文案的推进已经形成五个连续闭环：

1. 输出渲染入口已接入 manifest `renderer`
2. 节点配置抽屉已切到 manifest-first 文案
3. 节点商店默认视图已切到 manifest-first 文案与搜索
4. 执行面板组已切到 manifest-first 文案与名称回退
5. 画布节点卡片描述已切到 manifest-first

当前仍显式保留的边界主要收缩为：

- `frontend/src/app/m/[id]/MemoryView.tsx`
- compat shim
- `workflow-meta.ts` 的 icon / theme / inputs / outputs / 结构性元数据职责
- `canvas-node-factory.ts` 的实例默认标题语义
- `NodeResultSlip.tsx` 的上游输入标签名称回退

### 8.13 `refactor(frontend): prefer manifest labels in node result slip`

在画布节点卡片描述闭环之后，这一轮继续只处理 `NodeResultSlip.tsx` 的上游输入标签名称回退，不触碰 `MemoryView.tsx`、slip 展开逻辑或实例默认标题语义。

#### 完成内容
1. `frontend/src/features/workflow/components/nodes/NodeResultSlip.tsx`
   - 上游输入标签已复用 `buildExecutionNodeNameMap(...)`
   - 名称回退顺序固定为：
     - `node.data.label`
     - `manifest.display_name`
     - `workflow-meta.label`
     - `node.id`
2. 明确保留不变
   - slip 展开 / 折叠行为不变
   - 输出 renderer 继续走 manifest-first 选择
   - `workflow:toggle-all-slips` 的 legacy 兼容监听继续保留，避免误伤 `MemoryView.tsx`

#### 验证
- `pnpm --dir frontend test -- src/__tests__/execution-node-copy.property.test.ts src/__tests__/workflow-event-bus.property.test.ts src/__tests__/node-manifest.service.property.test.ts`
- 结果：通过

#### 提交
- `8689350 refactor(frontend): prefer manifest labels in node result slip`

### 8.14 当前状态补充判断（最终更新）

截至当前最新本地状态，Phase 3 关于 manifest-first UI 文案的推进已经形成六个连续闭环：

1. 输出渲染入口已接入 manifest `renderer`
2. 节点配置抽屉已切到 manifest-first 文案
3. 节点商店默认视图已切到 manifest-first 文案与搜索
4. 执行面板组已切到 manifest-first 文案与名称回退
5. 画布节点卡片描述已切到 manifest-first
6. `NodeResultSlip.tsx` 的上游输入标签已切到 manifest-first 名称回退

当前仍显式保留的边界进一步收缩为：

- `frontend/src/app/m/[id]/MemoryView.tsx`
- compat shim
- `workflow-meta.ts` 的 icon / theme / inputs / outputs / 结构性元数据职责
- `canvas-node-factory.ts` 的实例默认标题语义
- `NodeResultSlip.tsx` 对旧 `workflow:toggle-all-slips` 的兼容监听
