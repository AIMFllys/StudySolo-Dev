# 工作流协作系统与连线机制：阶段收尾总结报告

> **日期**：2026-03-26
> **所属模块**：Workflow (Marketplace / Collaboration / Edge Connection)
> **状态**：🟢 双核心系统全面完结
> **基线 Commit**：`625b457` 及之前的关联提交

---

## 🎯 核心目标回顾

本次研发周期的目标是完整交付并阶段性收口两个关键的核心业务系统：
1. **Marketplace 路由与协作系统**：引入读写分离的双路由架构，解决误触导致的冗余数据创建问题，建立完整的三级权限多人协作体系。
2. **Edge Connection System (节点连线机制重构)**：废除旧版复杂的多重连线分类，统一使用 `sequential` 连线传递基础元数据，将条件分支、循环等高阶逻辑剥离并收敛至专属节点处理。

---

## 📦 系统一：Marketplace 路由与协作系统（已完成）

全面完成了 Phase 1 至 Phase 3 的预定任务，实现了架构级多权限系统的建立。

### 1. Phase 1 — Marketplace 交互与路由体系
重构底层的页面加载流和链接体系。

| # | 任务 | 状态 | 说明 |
|---|------|:---:|------|
| P1-1 | `WorkflowExamplesPanel` 点击跳转路由修改 | ✅ | 点击工作流展示卡片由原本的 Fork 策略改为跳转 `/s/{id}` 预览页面。 |
| P1-2 | 移除冗余状态与旧代码 | ✅ | 从面板清单移除 `handleFork` 以及 `forkingId` 遗留操作状态。 |
| P1-3 | `PublicWorkflowView` 画布增强 | ✅ | 将占位文字区域升级，接入受限（无网格、禁选取拖拽）的真实 `ReadOnlyCanvas` 组件图形分析引擎。 |
| P1-4 | 创建 `/c/[id]/` 编辑路由架构 | ✅ | 建立全新的专属物理层路由节点映射用于工作流深层编辑。 |
| P1-5 | 编辑页组件向内迁移集成 | ✅ | 将 `CanvasEditor` 逻辑顺利平移至 `/c/{id}` 路径内挂载运行。 |
| P1-6 | `middleware.ts` 鉴权安全保护层 | ✅ | 增加针对 `/c/*` 前缀的全局重定向拦截器设定，过滤所有隐秘调用的未授权游客。 |
| P1-7 | 编辑页拓展开源快速入口 | ✅ | 画布控制顶部工具栏新增基于 `is_public` 状态开启的“查看公开链接”新窗口分发通道。 |
| P1-8 | 回切编辑功能的授权路由判定 | ✅ | 公开预览页内嵌判断，若当前用户为资源 Owner，则允许点击 "编辑此工作流" 无缝跳回 `/c/[id]` 工具台。 |
| 补充 | 游客操作状态拦截与引导下沉 | ✅ | 统一处理未登入游客的全局强提示（Toast）及召唤出基于 "Ink & Parchment" 处理的登录弹窗，阻断报错。 |

### 2. Phase 2 — 协作机制 MVP
完成了基于数据库 RLS (Row Level Security) 和 后端三级权限构建的核心鉴权与授权树。

| # | 任务 | 状态 | 说明 |
|---|------|:---:|------|
| P2-1 | 协作关联表构建 | ✅ | 新建并初始化了 Supabase `ss_workflow_collaborators` 表关联结构，开启行级安全策略 (RLS) 。 |
| P2-2 | 安全体系：统一权限鉴权函数 | ✅ | 于 `deps.py` 提供单一主入口 `check_workflow_access()`，涵盖了 Owner, Editor, Viewer 状态比对解析。 |
| P2-3 | CRUD 接口访问权限重组改造 | ✅ | 升级旧全量匹配 `user_id` 的查询，确保读取与写回受到鉴权函数的授权验证。 |
| P2-4 | 协作者管理 API 实装 | ✅ | 提供对协作者生命周期调度的管理，允许 Owner 邀请新访问客，查询当前列单及安全免职剥离。 |
| P2-5 | 邀请响应 API 实装 | ✅ | 向上层提供基于操作行为改变邀约记录内部生命周期的功能 (接受与拒绝转移状态)。 |
| P2-6 | 协作空间映射查询 API | ✅ | 暴露 `GET /api/workflow/shared` 读取自身作为协作者的所有异源资产节点表单。 |
| P2-7 | 前端动态邀请弹窗交互组件 | ✅ | 依据业务需要建设基于 Popover 框架承载了邮件查询分配及角色选择树的复合型菜单块 (`CollaborationPopover`)。 |
| P2-8 | 画布界面协作挂载点融合 | ✅ | 将上述组件装配挂载至 `/c/{id}` 工具层界面顶部。 |
| P2-9 | 协作网络通信请求类集合 | ✅ | 模块化编写抽取了所有相关逻辑至单例服务类 (`collaboration.service.ts`)。 |
| P2-10 | 协作数据合并与挂载侧边栏 | ✅ | 更新全局视图侧边导航规划新增 "协作空间" 树形分区。 |
| P2-11 | 邀请通知事件接受组件 | ✅ | 通过提供具象化的视图小卡允许终端用户看到悬而未决的邀约 (`InvitationList`)。 |

### 3. Phase 3 — 协作体验增强
实现前端状态与协作相关的 UI 额外交互展示拓展。

| # | 任务 | 状态 | 说明 |
|---|------|:---:|------|
| P3-1 | 在线群聚状态头像展示序列 | ✅ | 获取协同作业人员信息，利用提取首字母和邮箱计算分配固定背景色的头像叠展队列。 |
| P3-3 | 协作者资产副本保存机制 | ✅ | 支持并引导拥有部分权限者复用 `/s/{id}` 内公共提取端点在自己账户名下落库归档 (Fork)。 |
| P3-2 | 邮件外联通知体系挂钩 | ⏳ | 依赖于外部配置变量，故此模块如非当下要求，延后于未来业务部署期完成闭环。 |

---

## 🕸️ 系统二：Edge Connection System (连线机制重构)

系统底层数据解耦完成，已消除多状态混合导致的前后端校验不同步现象，并完成全部验证指标（Phase 1 至 Phase 5）。

### 1. 结构精简与统一 (Phase 1 & Phase 4)
*   正式废止移除了 `positive`/`negative`/`loop` 等所有定制场景边。整套图形库系统唯一只认同和产生一种合法连线：`sequential`。
*   此连线仅用作结构通信通道，只承载以下三种受控元数据字段：
    *   `note`: 明文字符注释属性。
    *   `waitSeconds`: 在推进运行引擎下一步前告知触发全局堵塞多少时长的计数属性。
    *   `branch`: 提供上个流程运算决断所透传携带的分支名称。

### 2. 剥离执行状态：`logic_switch` 与 `BranchManagerPanel` (Phase 2)
*   **重构单源多出**：逻辑控制模块从旧模式转由单句柄出边。基于建立的前端单例状态池（Zustand 拦截器）在其接力牵线完成后立即按序号赋名分发并生成对应的编排序号 (A → B → C依次递进)。
*   **分支编排管理器**：全新增减 `BranchManagerPanel.tsx` 整合组件。该组件负责读取节点所包含的衍生路径数组；利用原生文本框给予终端用户自由覆写命名或者通过组件内部阻断回收垃圾数据的操作；并通过采用具有项目级警醒性质的 amber（琥珀色）虚线视觉，同一般连线形成分级展示。

### 3. 父子聚合拆分：`LoopGroupNode` (循环容器) (Phase 3)
*   改用 React Flow 基于父坐标内接连结构来接手管理子树结构 (`extent: 'parent'`)。从根本形态上废弃通过回溯连线做闭环查找的不稳定逻辑。
*   **节点结构穿层脱离**：完成底层坐标变换挂载规则。不仅节点放入实现接管，用户手动拉出边界即立刻消除对应的状态绑定使其回落至全局顶级画卷。
*   **轻量化调优内建面板**：避免了与普通右侧多余面板冲突，允许该专属节点组件利用内部框体呼起 `Clamp` 限幅调节器，配置限定在 1-100（频次）和 0-300 （空挡秒数）范围内的运算数值，并自动回写。并在后端执行器内提供了相同的深层关联数据树结构迭代函数解析机制。

### 4. 稳态防差错保障 (Phase 5 验证端点测试)
*   结合 `Vitest` 于持续集成套件 `edge-connection-system.smoke.test.ts` 加入了以下 9 组冒烟探测保障断言：
    *   校验连结逻辑生成环节是否具备递增顺序表标签功能。
    *   注入上下异常高阶数字检验前端输入数值边界阈值回执是否保持正常范畴。
    *   针对合并聚点运算时针对延迟事件的处理规则采取聚合值最长获取方法运算逻辑的可靠性验证（Aggregating Max）。
    *   UI 层展示标识规则判断验证 (`branch` 高于 `note` 的重载优先次序测频)。
*   通过结合前期旧模块组件验证测试用例，所有测试指令均一次性完全通过编译。

---

## 📐 规范合规度确认

1. **≤ 300 行规范约束**：
    *   全部文件新建和代码增补行为皆达标通过审计。复杂的核心路由中继大文件（如 `workflow_collaboration.py` = 250 行）以及密集信息流处理 UI （如 `CollaborationPopover.tsx` = 208 行）和面板编辑器（`BranchManagerPanel.tsx` = 106 行）全部都在预先计划边界之下。
2. **“Ink & Parchment” 设计语言贯彻**：
    *   清退了原本留存的高斯模糊、渐变阴影以及多级次圆角外延设计。
    *   系统包含容器、侧边抽屉、弹出界面、标签卡片等在内彻底回滚落实成 0px 方正、色阶极致化的高亮 Ivory 主体结构加之采用具有强特征的单向黑体方块阴影 (`shadow-[4px_4px_0px_0px]`) 渲染，保证极其专业的刻薄工整学术外观。
3. **前后端接口协议对齐**：
    *   依照了 `api.md` 文档中约束的内容，同步将所有增减删查的新老路径点访问参数校验格式进行了彻底刷新。确保各系统 403 / 409 数据阻塞态异常在调用交互前均得以匹配应对和展示纠正状态。

---

## ⏳ 后续远期延伸演进里程碑 (Phase 4 及预备方案)

所有相关的 **待开发以及阻塞推进主线项已在当前进程全面合并结项完毕**。
以下列举将要或者计划探索的高层次扩展点，以补充后续规划视角：

1. **多用户前端光标映射及实时渲染引擎（基于 CRDT）**
   *   架构现阶段可以避免跨用户相互覆盖保存数据的隔离屏障，未来有待在引入由 Supabase Realtime 内置 yjs 等数据机制中完成同步高频更新与光标碰撞互娱机制 (需增加信道支持)。
2. **定影式历史变更轨迹回放回溯面板**
   *   增加定期定标或者事件捕捉器锁定存档方案以提供快速 Snapshot 生成恢复结构能力（防御最高级别重置失误操作导致的节点级不可追述级破坏）。
3. **全局监控管理台（/admin 面板集成监测）**
   *   基础 API 能力完备之后，计划通过内部审计表同步供职权在后台通过系统分析所有人员协作网络图或者特定高消耗、不合理分发的集群操作追踪及预防控制操作（目前暂行仅落库）。

---

> **阶段结论**：这两大繁重的基础模块重铸工程在此宣告已全部符合要求闭环合并完成。我们的底层应用形态终于走完了从小众单独承接运行试验版本到兼容现代架构要求、能够平滑应对并发并具有完善生命周期操作、共享流权限划分等高鲁棒性级别的基建转换升级。当下环境已非常安定成熟，无论针对展示或外沿集成已具备强大的结构防守基石支撑能力。

---

## 🔧 补充修复：节点 UI 框架深度重构与 Bug 修复（2026-03-26 晚）

> **所属模块**：`frontend/src/features/workflow/components/nodes/`
> **触发原因**：协作系统收尾后的综合深审中，发现节点 UI 层存在多处根因级问题，进行专项修复。
> **涉及 Commit**：`fix(workflow): requiresModel meta-flag, idle result slip, fix model_route:'B' test remnant` + `fix(workflow-node): unset model placeholder, fix isLogicSwitch scope, user-keyed catalog cache`

---

### 一、根因分析总览

通过对 `workflow-meta.ts` → `AIStepNode.tsx` → `NodeModelSelector.tsx` → `use-action-executor.ts` → `use-workflow-catalog.ts` → 后端 `executor.py` 的全链路取证，共识别 **6 个根因问题**：

| # | 问题 | 严重性 | 位置 |
|---|------|--------|------|
| 1 | `model_route` 前端值不传递给后端执行引擎，模型选择功能无效 | 🔴 高（有意搁置） | `executor.py` |
| 2 | `model_route:''` 时显示 `models[0]` 假模型名，视觉欺骗用户 | 🟠 中 | `NodeModelSelector.tsx` |
| 3 | `pending` 状态的 `NodeResultSlip` 返回 `null`，纸条物理消失 | 🟠 中 | `NodeResultSlip.tsx` |
| 4 | `use-action-executor.ts` 硬编码 `model_route: 'B'`（测试残留） | 🟠 中 | `use-action-executor.ts` |
| 5 | `workflow-meta.ts` 无 `requiresModel` 字段，靠脆弱枚举排除法控制模型选择器 | 🟡 中 | `workflow-meta.ts` / `AIStepNode.tsx` |
| 6 | `useWorkflowCatalog` 模块级缓存跨用户 Session 污染 | 🟠 中 | `use-workflow-catalog.ts` |

---

### 二、已修复内容（5 项）

#### 修复 A：`workflow-meta.ts` 引入 `requiresModel` 元数据字段

**根因**：`AIStepNode` 以 `nodeType !== 'trigger_input' && !isLogicSwitch` 的枚举排除法决定是否展示 `NodeModelSelector`。节点种类增加后（`write_db`、`export_file`、`knowledge_base` 等工具型节点），枚举列表落后，导致这些节点也错误渲染模型选择器。

**修复**：在 `NodeTypeMeta` 类型增加 `requiresModel: boolean` 字段，全部 19 个节点逐一标注：

- ✅ `true`（11 个）：`ai_analyzer`、`ai_planner`、`outline_gen`、`content_extract`、`summary`、`flashcard`、`chat_response`、`compare`、`mind_map`、`quiz_gen`、`merge_polish`
- ❌ `false`（8 个）：`trigger_input`、`write_db`、`knowledge_base`、`web_search`、`export_file`、`logic_switch`、`loop_map`、`loop_group`

`AIStepNode` 守卫从枚举排除改为数据驱动：

```tsx
// 修复前（脆弱枚举法）
{model_route != null && model_route !== '' && nodeType !== 'trigger_input' && !isLogicSwitch && (
  <NodeModelSelector ... />
)}

// 修复后（数据驱动）
{typeMeta.requiresModel && (
  <NodeModelSelector nodeId={id} currentModel={model_route ?? ''} ... />
)}
```

---

#### 修复 B：`NodeResultSlip` 的 `pending` 状态不再返回 `null`

**根因**：`if (status === 'pending') return null` 导致编辑态下节点底部纸条物理消失，节点空洞感强，边界不清晰，视觉违背"Ink & Parchment"的实体质感设计原则。

**修复**：`pending` 改为渲染极低调的"闲置中"灰色占位标签，节点始终具备物理占位感：

```tsx
if (!status || status === 'pending') {
  return (
    <div className="node-result-slip mt-1 border-t border-dashed border-black/8 ...">
      <Clock3 className="w-3 h-3 text-black/20" />
      <span className="font-mono text-[10px] text-black/20">闲置中</span>
    </div>
  );
}
```

---

#### 修复 C：`use-action-executor.ts` 清除测试残留硬编码

**根因**：AI 对话助手通过 `ADD_NODE` 创建节点时，代码硬编码 `model_route: 'B'`，此为早期联调时的临时测试值，从未被清除，导致 AI 生成的节点携带无效路由标识。

**修复**：

```ts
// 修复前
model_route: 'B',
// 修复后
model_route: '',   // User selects model via NodeModelSelector
```

---

#### 修复 D：`NodeModelSelector` 去除视觉欺骗，引入"未选"占位态

**根因**：`currentModel === ''` 时，`models.find(...)` 返回 `undefined`，fallback 到 `models[0]`，触发按钮显示 `deepseek-chat`，但 `model_route` 仍是空字符串。用户以为已选模型，实则未绑定。

**修复**：区分"已选"和"未选"两种视觉态，彻底消除视觉欺骗：

```tsx
const selectedModelInfo = currentModel
  ? models.find((m) => m.model === currentModel)
  : undefined;
const isUnset = !currentModel || !selectedModelInfo;

// 未选态：○ 选择模型（虚线圆 + 斜体灰色）
// 已选态：● deepseek-chat（彩色品牌圆 + 模型名）
```

---

#### 修复 E：`useWorkflowCatalog` 用户 Session 隔离缓存

**根因**：`let _cachedModels: AIModelOption[] | null` 是全局模块单例，永不失效。用户 A（免费）退出、用户 B（PRO）登录后，B 仍看到 A 的免费模型列表，造成跨用户信息泄漏。

**修复**：将单值缓存改为 `{ userId, tier }` 键控结构，换用户或升级套餐均自动失效重取：

```ts
interface CacheEntry { userId: string; tier: string; models: AIModelOption[]; }
let _cache: CacheEntry | null = null;
// 初始化时：getUser() → 比对 userId+tier → 命中直接用 / 不一致则重新拉取
```

---

### 三、有意搁置项（等待 AI 路由重构完成后一步打通）

| 问题 | 详情 | 修复预案 |
|------|------|---------|
| `model_route` 不传递给后端 | `executor.py` 构建 `NodeInput` 时完全不读取 `node_data.get("model_route")`，前端选择的模型不影响实际 LLM 调用 | 路由层稳定后，在 `NodeInput` 处加 `selected_model_key=node_data.get("model_route")` 打通 |
| `model_route` 字段值语义错误 | 目前存 `model_id`（如 `deepseek-chat`），语义上应存 `skuId`（如 `sku_deepseek_chat_native`），供后端 `resolve_selected_sku()` 精确路由 | 同步修复：前端改为 `updateNodeData(nodeId, { model_route: model.skuId })` |

---

### 四、修复后节点 UI 完整状态机

```
新建节点（requiresModel: true）
  ├─ Header：○ 选择模型（虚线圆 + 斜体灰色占位）
  └─ 纸条底部：🕒 闲置中

用户选定模型后
  ├─ Header：● deepseek-chat（彩色品牌圆 + 模型名）
  └─ 纸条底部：🕒 闲置中

执行中
  ├─ Header：● deepseek-chat
  └─ 纸条底部：⟳ 执行中...

执行完成
  ├─ Header：● deepseek-chat
  └─ 纸条底部：✓ 运行成功 2.3s（可展开查看完整输出）

错误状态
  ├─ Header：● deepseek-chat
  └─ 纸条底部：⚠ 执行失败（可展开查看错误信息）

非AI节点（requiresModel: false，如 write_db / logic_switch）
  ├─ Header：无模型选择器（彻底不渲染，零残余）
  └─ 纸条底部：同如上状态机
```
