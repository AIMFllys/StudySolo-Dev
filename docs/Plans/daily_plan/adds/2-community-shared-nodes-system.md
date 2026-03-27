# 共享节点系统（社区提示词节点）— 详细规划

> 最后更新：2026-03-27
> 编码要求：UTF-8 (无BOM) + LF
> 状态：分析完成，待实施

---

## 0. 核心概念

### 0.1 定义

- **共享节点** (Community Node)：用户发布的、基于自定义提示词 + 可选知识库构建的工作流节点
- 其他用户可以将共享节点拖入自己的工作流，和官方节点一样使用
- 共享节点的 **提示词已封装**（使用者不可见、不可改），只能选择模型

### 0.2 与官方节点的对比

| 维度 | 官方节点 | 共享节点 |
|------|---------|---------|
| **创建者** | 平台开发团队 | 任何注册用户 |
| **prompt 来源** | `backend/app/nodes/xxx/prompt.md` | `ss_community_nodes.prompt`（DB） |
| **渲染器** | `AIStepNode.tsx`（共用） | `AIStepNode.tsx`（共用，泛型化） |
| **后端执行** | 每种有独立 Python class | 只有一个 `CommunityNode` class |
| **前端 NodeType** | 在 `workflow.ts` union 中硬编码 | 统一为 `'community_node'` |
| **使用者可改** | model_key、label | model_key、label |
| **使用者不可改** | — | prompt、input/output schema |
| **AI 对话生成** | ✅ 支持 | ❌ 不支持（设计决策） |

### 0.3 封装原则

```
"封装节点" = 发布者锁定以下属性：
  🔒 system_prompt   — 核心提示词
  🔒 input_schema    — 需要什么输入（字段描述）
  🔒 output_format   — 输出格式 (markdown | json)
  🔒 output_schema   — 输出字段结构（可选）
  🔒 knowledge_refs  — 关联知识库 ID（可选）

使用者只能改：
  ✅ model_key       — 用哪个模型
  ✅ label           — 画布上显示的名称
```

---

## 1. 节点商店双视图 — UI 设计

### 1.1 当前 NodeStorePanel 结构（需改造）

```
现有（NodeStorePanel.tsx）：
  ├── 搜索框
  ├── Tag 筛选器（全部 / 输入源 / AI处理 / 内容生成 / 输出存储 / 逻辑控制）
  └── 按 category 分组的官方节点列表
```

### 1.2 改造后结构

```
节点商店 — 右上角增加视图切换按钮

┌─────────────────────────────────────────┐
│  节点商店                  [默认 | 共享]  │  ← SegmentedControl 切换
├─────────────────────────────────────────┤
│                                         │
│  === 默认视图（保持不变）===              │
│  搜索框 + Tag 筛选 + 官方节点列表        │
│                                         │
│  === 共享视图（新增）===                  │
│  搜索框                                 │
│  排序：❤️ 最多点赞 | 🕐 最新发布         │
│  ┌─────────────────────────────────┐    │
│  │ [icon] Python 代码审查器         │    │
│  │ by @user123 · v1.0                │    │
│  │ 审查 Python 代码，输出问题清单     │    │
│  │ 🏷️ AI处理  ❤️ 1.2k  📥 3.4k     │    │
│  └─────────────────────────────────┘    │
│  ... (每页 10 个)                       │
│  [上一页] [1] [2] [3] ... [下一页]       │
│                                         │
│  ── 底部 ──                             │
│  [🚀 发布我的节点]                       │
└─────────────────────────────────────────┘
```

### 1.3 前端改动位置

```
修改：
  frontend/src/components/layout/sidebar/NodeStorePanel.tsx
    → 增加 SegmentedControl（Tab 切换）
    → 默认视图 = 现有代码原封不动
    → 共享视图 = 新组件 CommunityNodeList

新增：
  frontend/src/components/layout/sidebar/CommunityNodeList.tsx    ← 共享节点列表
  frontend/src/components/layout/sidebar/CommunityNodeCard.tsx    ← 单个卡片
  frontend/src/components/layout/sidebar/PublishNodeDialog.tsx    ← 发布弹窗
```

---

## 2. 数据库设计

### 2.1 共享节点表

```sql
-- supabase/migrations/YYYYMMDD_add_community_nodes.sql

-- ① 共享节点定义表
CREATE TABLE IF NOT EXISTS ss_community_nodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 展示信息
    name            TEXT NOT NULL,                    -- "Python 代码审查器"
    description     TEXT NOT NULL DEFAULT '',         -- "专门审查 Python 代码"
    icon            TEXT NOT NULL DEFAULT 'Bot',      -- lucide icon name（从预设池选）
    category        TEXT NOT NULL DEFAULT 'analysis', -- 'analysis' | 'generation' | 'assessment' | 'other'
    version         TEXT NOT NULL DEFAULT '1.0.0',
    
    -- 核心封装内容
    prompt          TEXT NOT NULL,                    -- System Prompt（使用者不可见）
    input_hint      TEXT NOT NULL DEFAULT '',         -- 告诉上游"需要什么输入"
    output_format   TEXT NOT NULL DEFAULT 'markdown', -- 'markdown' | 'json'
    output_schema   JSONB DEFAULT NULL,               -- JSON Schema（可选，json 格式时使用）
    
    -- 可选：知识库关联
    knowledge_refs  UUID[] DEFAULT '{}',              -- 关联的知识库 ID 列表
    
    -- 模型偏好（发布者建议，使用者可覆盖）
    model_preference TEXT NOT NULL DEFAULT 'auto',    -- 'auto' | 'fast' | 'powerful'
    
    -- 发布者可暴露的配置参数（可选 P2）
    config_schema   JSONB DEFAULT '[]',               -- 参数表单定义（类似 BaseNode.config_schema）
    
    -- 发布状态
    status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
    reject_reason   TEXT DEFAULT NULL,
    is_public       BOOLEAN NOT NULL DEFAULT false,   -- approved 后设为 true
    
    -- 统计
    likes_count     INTEGER NOT NULL DEFAULT 0,
    install_count   INTEGER NOT NULL DEFAULT 0,
    
    -- 时间戳
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ② 索引
CREATE INDEX IF NOT EXISTS ss_community_nodes_author_idx ON ss_community_nodes(author_id);
CREATE INDEX IF NOT EXISTS ss_community_nodes_status_idx ON ss_community_nodes(status);
CREATE INDEX IF NOT EXISTS ss_community_nodes_public_idx ON ss_community_nodes(is_public, likes_count DESC);
CREATE INDEX IF NOT EXISTS ss_community_nodes_category_idx ON ss_community_nodes(category);

-- ③ RLS
ALTER TABLE ss_community_nodes ENABLE ROW LEVEL SECURITY;

-- 公开节点所有人可读
CREATE POLICY "所有人可查看已公开的节点"
    ON ss_community_nodes FOR SELECT
    USING (is_public = true);

-- 作者可查看自己所有节点（含 pending/rejected）
CREATE POLICY "作者可查看自己的节点"
    ON ss_community_nodes FOR SELECT
    USING (auth.uid() = author_id);

-- 只有作者可创建
CREATE POLICY "用户可发布节点"
    ON ss_community_nodes FOR INSERT
    WITH CHECK (auth.uid() = author_id);

-- 只有作者可修改
CREATE POLICY "作者可更新自己的节点"
    ON ss_community_nodes FOR UPDATE
    USING (auth.uid() = author_id);

-- 只有作者可删除
CREATE POLICY "作者可删除自己的节点"
    ON ss_community_nodes FOR DELETE
    USING (auth.uid() = author_id);
```

### 2.2 点赞表

```sql
-- ④ 点赞表
CREATE TABLE IF NOT EXISTS ss_community_node_likes (
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    node_id     UUID NOT NULL REFERENCES ss_community_nodes(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (user_id, node_id)
);

-- RLS
ALTER TABLE ss_community_node_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可查看点赞"
    ON ss_community_node_likes FOR SELECT
    USING (true);

CREATE POLICY "用户可点赞"
    ON ss_community_node_likes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户可取消赞"
    ON ss_community_node_likes FOR DELETE
    USING (auth.uid() = user_id);

-- ⑤ 点赞计数触发器（自动维护 likes_count）
CREATE OR REPLACE FUNCTION update_community_node_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE ss_community_nodes SET likes_count = likes_count + 1 WHERE id = NEW.node_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE ss_community_nodes SET likes_count = likes_count - 1 WHERE id = OLD.node_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_community_node_likes
    AFTER INSERT OR DELETE ON ss_community_node_likes
    FOR EACH ROW EXECUTE FUNCTION update_community_node_likes_count();
```

### 2.3 安装/使用记录表（可选，用于 install_count 统计）

```sql
-- ⑥ 使用记录（可选 P2，用于排行榜）
CREATE TABLE IF NOT EXISTS ss_community_node_installs (
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    node_id     UUID NOT NULL REFERENCES ss_community_nodes(id) ON DELETE CASCADE,
    used_at     TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (user_id, node_id)
);

ALTER TABLE ss_community_node_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户可记录使用"
    ON ss_community_node_installs FOR ALL
    USING (auth.uid() = user_id);
```

---

## 3. 后端 API

### 3.1 路由文件

```
backend/app/api/community_nodes.py  ← 新增
```

### 3.2 API 端点

| Method | Path | 功能 | 鉴权 | 分页 |
|--------|------|------|------|------|
| `GET` | `/api/community-nodes/` | 公开节点列表（点赞排序/分页） | ✅ | 10/页 |
| `GET` | `/api/community-nodes/mine` | 我发布的节点 | ✅ | — |
| `GET` | `/api/community-nodes/{id}` | 节点详情（不含 prompt） | ✅ | — |
| `POST` | `/api/community-nodes/` | 发布节点 | ✅ | — |
| `PUT` | `/api/community-nodes/{id}` | 更新节点（仅作者） | ✅ | — |
| `DELETE` | `/api/community-nodes/{id}` | 删除节点（仅作者） | ✅ | — |
| `POST` | `/api/community-nodes/{id}/like` | 点赞 | ✅ | — |
| `DELETE` | `/api/community-nodes/{id}/like` | 取消赞 | ✅ | — |
| `GET` | `/api/community-nodes/{id}/prompt` | **仅供后端执行调用** | ❌ internal | — |

### 3.3 重要安全约束

```
prompt 字段永远不返回给前端！

GET /api/community-nodes/ 的响应中 prompt 字段 = null
GET /api/community-nodes/{id} 的响应中 prompt 字段 = null

prompt 只在两个地方可见：
  1. 发布者自己（GET /api/community-nodes/mine）
  2. 后端 CommunityNode.execute() 内部加载

这保证了发布者的知识产权保护。
```

### 3.4 Pydantic 模型

```python
# backend/app/models/community_nodes.py

class CommunityNodeCreate(BaseModel):
    name: str
    description: str
    icon: str = 'Bot'
    category: str = 'analysis'
    prompt: str                         # 创建时必须提供
    input_hint: str = ''
    output_format: str = 'markdown'
    output_schema: dict | None = None
    model_preference: str = 'auto'
    knowledge_refs: list[str] = []

class CommunityNodePublic(BaseModel):
    """返回给前端的公开信息（不含 prompt）"""
    id: str
    author_id: str
    author_name: str                    # JOIN auth.users 获取
    name: str
    description: str
    icon: str
    category: str
    version: str
    input_hint: str
    output_format: str
    model_preference: str
    likes_count: int
    install_count: int
    is_liked: bool                      # 当前用户是否已点赞
    created_at: datetime
    # prompt 字段不在这里！

class CommunityNodeListResponse(BaseModel):
    items: list[CommunityNodePublic]
    total: int
    page: int
    pages: int

class CommunityNodeMine(CommunityNodePublic):
    """作者视图，包含 prompt"""
    prompt: str
    status: str
    reject_reason: str | None
```

### 3.5 API 注册

```python
# backend/app/api/router.py 新增：
from app.api.community_nodes import router as community_nodes_router
router.include_router(community_nodes_router, prefix="/community-nodes", tags=["community-nodes"])
```

### 3.6 分页 & 排序查询

```python
# backend/app/services/community_node_service.py

async def list_public_nodes(
    page: int = 1,
    per_page: int = 10,
    sort: str = 'likes',        # 'likes' | 'newest'
    category: str | None = None,
    search: str | None = None,
    current_user_id: str | None = None,
) -> CommunityNodeListResponse:
    query = supabase.table('ss_community_nodes') \
        .select('*, author:auth.users(email, raw_user_meta_data)') \
        .eq('is_public', True)
    
    if category:
        query = query.eq('category', category)
    if search:
        query = query.or_(f'name.ilike.%{search}%,description.ilike.%{search}%')
    
    order_col = 'likes_count' if sort == 'likes' else 'created_at'
    query = query.order(order_col, desc=True)
    
    # 分页
    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)
    
    # 执行 + 组装响应...
```

---

## 4. 后端执行层 — CommunityNode

### 4.1 泛型节点 class

```python
# backend/app/nodes/community/node.py

from app.nodes._base import BaseNode
from app.services.community_node_service import CommunityNodeService

class CommunityNode(BaseNode):
    node_type = "community_node"
    category = "community"
    description = "社区共享节点"
    is_llm_node = True
    output_format = "markdown"
    icon = "🌐"
    color = "#8b5cf6"

    async def execute(self, node_input, llm_caller):
        """执行社区节点：从 DB 动态加载 prompt，然后走标准 LLM 流程"""

        community_node_id = node_input.node_config.get('community_node_id')
        if not community_node_id:
            yield "[错误] 缺少社区节点 ID"
            return

        # 从 DB 读取完整 prompt（只有这里可以读到）
        node_def = await CommunityNodeService.get_node_with_prompt(community_node_id)
        if not node_def:
            yield "[错误] 社区节点不存在或未审核"
            return

        # 用发布者的 prompt 替换 system prompt
        custom_prompt = node_def['prompt']
        
        # 构建标准消息格式
        user_input = node_input.get_upstream_text()
        messages = [
            {"role": "system", "content": custom_prompt},
            {"role": "user", "content": user_input},
        ]

        # 走标准 LLM 调用流程
        async for token in llm_caller(messages):
            yield token
```

### 4.2 自动注册

由于继承 `BaseNode` + `__init_subclass__`，只需确保模块被 import：

```python
# backend/app/nodes/__init__.py 中确保 import：
from app.nodes.community.node import CommunityNode  # noqa: F401
```

---

## 5. 画布集成 — 拖入与渲染

### 5.1 NodeType 扩展

```typescript
// frontend/src/types/workflow.ts

export type NodeType =
  | 'trigger_input'
  // ... 现有类型 ...
  | 'community_node';    // ← 新增
```

### 5.2 节点类型注册

```typescript
// WorkflowCanvas.tsx nodeTypes 新增：
const nodeTypes: NodeTypes = {
  // ... 现有 ...
  community_node: AIStepNode,   // ← 共用 AIStepNode 渲染器
};
```

### 5.3 workflow-meta.ts 新增 meta

```typescript
// workflow-meta.ts NODE_TYPE_META 新增：
community_node: {
  label: '社区节点',           // 画布上的默认 label（使用时会被覆盖）
  description: '社区共享的 AI 节点',
  icon: Bot,                    // 默认图标（使用时从 node.data 读取）
  theme: 'COMMUNITY',          // 新主题
},
```

### 5.4 拖入画布 — dataTransfer 协议

共享节点需要额外携带 `community_node_id`：

```typescript
// CommunityNodeCard.tsx — 拖拽开始
const handleDragStart = (e: React.DragEvent, node: CommunityNodePublic) => {
  e.dataTransfer.setData('application/studysolo-node-type', 'community_node');
  e.dataTransfer.setData('application/studysolo-community-id', node.id);
  e.dataTransfer.setData('application/studysolo-community-meta', JSON.stringify({
    name: node.name,
    icon: node.icon,
    output_format: node.output_format,
    model_preference: node.model_preference,
    input_hint: node.input_hint,
  }));
  e.dataTransfer.effectAllowed = 'move';
};
```

### 5.5 WorkflowCanvas.tsx handleDrop 改造

```typescript
// WorkflowCanvas.tsx handleDrop 修改：

const handleDrop = useCallback(
  (e: React.DragEvent) => {
    e.preventDefault();
    const nodeType = e.dataTransfer.getData('application/studysolo-node-type');
    if (!nodeType) return;

    const flowPos = reactFlowInstance.screenToFlowPosition({
      x: e.clientX,
      y: e.clientY,
    });

    const store = useWorkflowStore.getState();
    store.takeSnapshot();

    const nodeId = `${nodeType}-${Date.now().toString(36)}`;

    // ── 社区节点特殊处理 ──
    if (nodeType === 'community_node') {
      const communityId = e.dataTransfer.getData('application/studysolo-community-id');
      const metaStr = e.dataTransfer.getData('application/studysolo-community-meta');
      const meta = metaStr ? JSON.parse(metaStr) : {};

      const newNode: Node = {
        id: nodeId,
        type: 'community_node',
        position: { x: flowPos.x - 176, y: flowPos.y - 70 },
        data: {
          label: meta.name || '社区节点',
          type: 'community_node',
          community_node_id: communityId,       // ← 关键：执行时用这个 ID 加载 prompt
          community_icon: meta.icon || 'Bot',
          output_format: meta.output_format || 'markdown',
          model_route: '',                      // ← 使用者可改模型
          model_preference: meta.model_preference || 'auto',
          input_hint: meta.input_hint || '',
          status: 'pending',
          output: '',
          config: {},
          system_prompt: '',                    // ← 空！prompt 不存前端
        },
      };

      store.setNodes([...store.nodes, newNode]);
      setSelectedNodeId(nodeId);
      return;
    }

    // ── 官方节点（现有逻辑不变）──
    const isLoop = nodeType === 'loop_group';
    const newNode: Node = { /* ... 现有代码 ... */ };
    store.setNodes([...store.nodes, newNode]);
    setSelectedNodeId(nodeId);
  },
  [reactFlowInstance, setSelectedNodeId]
);
```

### 5.6 AIStepNode 渲染器适配（最小改动）

```typescript
// AIStepNode.tsx — 社区节点的标题/图标显示
// 在组件内增加社区节点判断：

const isCommunityNode = node.type === 'community_node';
const displayLabel = isCommunityNode 
  ? (node.data.label || '社区节点')
  : meta.label;

// 图标：社区节点从 data 读取，官方节点从 meta 读取
const IconComponent = isCommunityNode
  ? getLucideIcon(node.data.community_icon)
  : meta.icon;
```

---

## 6. 发布流程 — 用户发布节点

### 6.1 发布入口

共享视图底部的 `[🚀 发布我的节点]` 按钮，打开 `PublishNodeDialog`。

### 6.2 发布表单字段

```
┌─────────────────────────────────────┐
│  发布我的节点                         │
├─────────────────────────────────────┤
│  节点名称 *        [______________]  │
│  描述 *            [______________]  │
│  分类 *            [▼ AI 处理    ]   │
│  图标              [▼ Bot       ]   │  ← 从 10-20 个预设 lucide icon 选
│                                     │
│  ── System Prompt（核心）──          │
│  [                                ] │
│  [  你是一个专业的 Python 代码审查    ] │
│  [  专家。用户会提交代码片段，你需要  ] │
│  [  ...                           ] │
│  [                                ] │
│                                     │
│  输入提示           [需要代码片段]    │
│  输出格式           [▼ Markdown ]    │
│  推荐模型           [▼ 自动     ]    │
│                                     │
│  [取消]                    [发布]    │
└─────────────────────────────────────┘
```

### 6.3 审核流程（MVP 可简化）

```
MVP 阶段：
  发布 → status='pending'
  管理员在 Admin 面板审核 → approved/rejected
  approved → is_public=true → 出现在共享列表

简化方案（如审核量不大）：
  发布 → 自动过 prompt 敏感词检测
  通过 → 直接 status='approved', is_public=true
  检测到敏感词 → 进入人工队列

Admin API（已有 admin 路由基础设施）：
  GET   /api/admin/community-nodes?status=pending
  PATCH /api/admin/community-nodes/{id}/review  { status, reject_reason }
```

---

## 7. 点赞交互

### 7.1 前端交互

```
用户在共享列表点赞 ❤️：
  乐观更新：likes_count + 1，图标变红
  异步请求：POST /api/community-nodes/{id}/like
  失败回滚：likes_count - 1，图标恢复

取消赞：
  乐观更新：likes_count - 1，图标恢复
  异步请求：DELETE /api/community-nodes/{id}/like
  失败回滚：likes_count + 1
```

### 7.2 后端逻辑

```python
@router.post("/{node_id}/like")
async def like_node(node_id: UUID, user=Depends(get_current_user)):
    """点赞（幂等，重复调用不报错）"""
    try:
        await supabase.table('ss_community_node_likes').insert({
            'user_id': str(user.id),
            'node_id': str(node_id),
        }).execute()
    except Exception:
        pass  # 已存在，幂等
    return {"ok": True}

@router.delete("/{node_id}/like")
async def unlike_node(node_id: UUID, user=Depends(get_current_user)):
    """取消赞"""
    await supabase.table('ss_community_node_likes') \
        .delete() \
        .eq('user_id', str(user.id)) \
        .eq('node_id', str(node_id)) \
        .execute()
    return {"ok": True}
```

---

## 8. 执行时 prompt 动态加载（核心安全机制）

### 8.1 为什么不在前端存 prompt

```
安全原因：
  画布 JSON 存储为 workflow nodes_json → Supabase
  如果 prompt 存在 nodes_json 里，RLS 允许用户读自己的 workflow
  → 用户可以直接读到 prompt 内容
  → 破坏封装

性能原因：
  长 prompt（可能 2000+ 字符）存在每个节点数据中会增大 JSON
  执行时从 DB 加载，只有执行那一刻才读取

版本更新原因：
  发布者更新 prompt 后，所有引用该节点的工作流自动生效
  不需要用户"重新拖入"
```

### 8.2 执行链路

```
前端执行请求：
  POST /api/workflow/execute
  body: { nodes_json, edges_json }
    └── 其中 community_node 的 data 包含：
        { community_node_id: "uuid", model_route: "gpt-4o", ... }
        ↑ 没有 prompt

后端 WorkflowEngine 执行到该节点时：
  CommunityNode.execute()
    → 读取 node_config.community_node_id
    → SELECT prompt FROM ss_community_nodes WHERE id = ? AND is_public = true
    → 用读到的 prompt 构建 messages
    → 调用 LLM
    → 流式返回

全程 prompt 不经过前端。
```

---

## 9. 可选图标池（预设）

发布者从以下 lucide icon 中选择一个：

```typescript
const COMMUNITY_NODE_ICONS = [
  'Bot',           // 默认
  'Brain',         // 智能分析
  'Search',        // 检索
  'FileText',      // 文档
  'Code',          // 代码
  'Languages',     // 翻译
  'PenTool',       // 写作
  'Microscope',    // 研究
  'Scale',         // 法律
  'HeartPulse',    // 医学
  'Calculator',    // 数学
  'Palette',       // 设计
  'Music',         // 音乐
  'BookOpen',      // 教育
  'Briefcase',     // 商务
  'Shield',        // 安全
] as const;
```

---

## 10. AI 对话不支持生成社区节点（设计决策文档）

### 10.1 为什么不支持

```
技术原因：
  1. ai_planner 的 system prompt 中 AVAILABLE_NODE_TYPES 是写死的
  2. 社区节点的 community_node_id 是 UUID，AI 无法猜测
  3. 用户安装的社区节点各不相同，无法统一注入 prompt
  4. 注入所有社区节点的描述会严重膨胀 context

产品原因：
  1. AI 生成结果依赖"理解节点能力" → 社区节点描述质量参差不齐
  2. AI 可能生成用户未安装的社区节点 → 画布报错
  3. MVP 阶段优先保证官方节点的 AI 生成质量

未来可能的解法（Phase 3）：
  将用户已安装的社区节点摘要（id + name + description，限 10 个）
  动态注入 ai_planner 的 available_types
  但优先级极低
```

---

## 11. 完整文件改动清单

### 后端新增

```
backend/app/
├── api/community_nodes.py              ← API 路由（增删改查 + 点赞）
├── models/community_nodes.py           ← Pydantic 模型
├── services/community_node_service.py  ← 业务逻辑
└── nodes/community/
    ├── __init__.py
    └── node.py                          ← CommunityNode 泛型执行器
```

### 后端修改

```
backend/app/
├── api/router.py                        ← 注册 community_nodes_router
└── nodes/__init__.py                    ← import CommunityNode
```

### 数据库

```
supabase/migrations/
└── YYYYMMDD_add_community_nodes.sql     ← 3 张表 + RLS + 触发器
```

### 前端新增

```
frontend/src/
├── components/layout/sidebar/
│   ├── CommunityNodeList.tsx            ← 共享节点分页列表
│   ├── CommunityNodeCard.tsx            ← 共享节点拖拽卡片
│   └── PublishNodeDialog.tsx            ← 发布弹窗
├── features/community-nodes/
│   ├── hooks/use-community-nodes.ts     ← 列表 + 点赞状态管理
│   ├── services/community-nodes.service.ts ← API 调用
│   └── index.ts
└── types/community-nodes.ts            ← TypeScript 类型
```

### 前端修改

```
frontend/src/
├── components/layout/sidebar/NodeStorePanel.tsx  ← 增加 Tab 切换
├── features/workflow/components/canvas/WorkflowCanvas.tsx
│   ├── nodeTypes 增加 community_node
│   ├── handleDrop 增加社区节点分支
│   └── createDefaultNodeData 增加社区节点
├── features/workflow/components/nodes/AIStepNode.tsx  ← 社区节点标题/图标适配
├── features/workflow/constants/workflow-meta.ts ← 增加 NODE_TYPE_META['community_node']
└── types/workflow.ts                     ← NodeType union 增加 'community_node'
```

### 总计：约 18-22 个文件

---

## 12. 实施阶段

### Phase 1（数据基础 — 1.5 天）

1. 数据库迁移（3 表 + RLS + 触发器）
2. 后端 API 路由 + Service（CRUD + 点赞）
3. Pydantic 模型
4. 路由注册

### Phase 2（前端列表视图 — 1.5 天）

1. `NodeStorePanel` 增加 Tab 切换
2. `CommunityNodeList` + `CommunityNodeCard` 组件
3. 分页 + 点赞 + 搜索
4. 拖入画布集成（dataTransfer + handleDrop 改造）

### Phase 3（后端执行 + 画布适配 — 1 天）

1. `CommunityNode` 泛型执行器
2. `AIStepNode` 社区节点渲染适配
3. `workflow-meta.ts` 增加 community_node meta
4. `NodeType` union 扩展

### Phase 4（发布流程 + 审核 — 1 天）

1. `PublishNodeDialog` 发布弹窗
2. Admin 面板审核接口
3. 敏感词自动检测（可选）

---

## 13. Checklist

```
□ 数据库
  □ ss_community_nodes 表 + RLS（5 条策略）
  □ ss_community_node_likes 表 + RLS + 触发器（自动计数）
  □ ss_community_node_installs 表（可选 P2）
  □ 索引覆盖查询场景
  □ supabase inspect 无红色警告

□ 后端 API
  □ community_nodes.py 路由（7 个端点）
  □ 每个路由有 Depends(get_current_user)
  □ 注册到 router.py
  □ prompt 字段不在公开响应中返回
  □ 分页:per_page=10, page 参数

□ 后端执行
  □ CommunityNode 继承 BaseNode
  □ execute() 中从 DB 加载 prompt
  □ 正确注册到 __init__.py

□ 前端节点商店
  □ NodeStorePanel 增加 SegmentedControl
  □ CommunityNodeList 分页列表
  □ CommunityNodeCard 拖拽支持
  □ 点赞乐观更新
  □ 搜索 + 排序（点赞/最新）

□ 前端画布集成
  □ NodeType union 增加 'community_node'
  □ nodeTypes 注册 community_node → AIStepNode
  □ NODE_TYPE_META 增加 community_node
  □ handleDrop 处理 community_node 类型
  □ AIStepNode 适配社区节点标题/图标

□ 发布流程
  □ PublishNodeDialog 表单
  □ 图标预设池
  □ Admin 审核 API

□ 安全
  □ prompt 永远不返回给前端（除了作者自己）
  □ RLS 全覆盖
  □ 敏感词检测（可选 P2）
  □ 发布频率限制（防 spam）

□ AI 对话
  □ ai_planner 不生成 community_node 类型（确认限制）
  □ AVAILABLE_NODE_TYPES 不包含 community_node
```

---

## 14. 关键代码位置参考

| 内容 | 文件路径 |
|------|---------|
| 节点类型定义 | `frontend/src/types/workflow.ts` → `NodeType` union |
| 节点元数据 | `frontend/src/features/workflow/constants/workflow-meta.ts` |
| 节点商店面板 | `frontend/src/components/layout/sidebar/NodeStorePanel.tsx` |
| 画布拖入逻辑 | `frontend/src/features/workflow/components/canvas/WorkflowCanvas.tsx` → `handleDrop` |
| 节点渲染器 | `frontend/src/features/workflow/components/nodes/AIStepNode.tsx` |
| BaseNode 基类 | `backend/app/nodes/_base.py` |
| 节点自动注册 | `backend/app/nodes/__init__.py` |
| 后端路由注册 | `backend/app/api/router.py` |
| 拖拽数据协议 | `dataTransfer key: 'application/studysolo-node-type'` + `'application/studysolo-community-id'` |

---

## 15. 独立分类体系（Category System）

> **设计决策**：社区节点使用独立于官方引擎的场景化分类体系，不与官方节点的 5 大分类（input/process/generate/output/control）混用。

### 15.1 分类常量定义（前端）

```typescript
// frontend/src/features/community-nodes/constants/categories.ts

export const COMMUNITY_NODE_CATEGORIES = [
  { id: 'academic',       label: '学术论文',   icon: 'GraduationCap' },
  { id: 'coding',         label: '代码开发',   icon: 'Code' },
  { id: 'translation',    label: '语言翻译',   icon: 'Languages' },
  { id: 'writing',        label: '创意写作',   icon: 'PenTool' },
  { id: 'data_analysis',  label: '数据分析',   icon: 'BarChart3' },
  { id: 'education',      label: '教育辅导',   icon: 'BookOpen' },
  { id: 'legal',          label: '法律咨询',   icon: 'Scale' },
  { id: 'health',         label: '医疗健康',   icon: 'HeartPulse' },
  { id: 'business',       label: '商业分析',   icon: 'Briefcase' },
  { id: 'daily_tools',    label: '日常工具',   icon: 'Wrench' },
  { id: 'assessment',     label: '评估检查',   icon: 'ClipboardCheck' },
  { id: 'research',       label: '科研实验',   icon: 'Microscope' },
  { id: 'other',          label: '其他',       icon: 'Puzzle' },
] as const;

export type CommunityCategory = typeof COMMUNITY_NODE_CATEGORIES[number]['id'];
```

### 15.2 存储与查询

```
存储：ss_community_nodes.category = 'academic' (string)
查询：GET /api/community-nodes/?category=coding&search=python

后端 SQL：
  .eq('is_public', True)
  .eq('category', category)                        -- 精确匹配分类
  .or_(f'name.ilike.%{search}%,description.ilike.%{search}%')  -- 模糊搜索名称+描述
```

### 15.3 前端 UI（共享视图内）

```
共享节点视图内增加分类筛选：

┌─────────────────────────────────────┐
│  [搜索框]                            │
│  [🎓 学术] [💻 代码] [🌐 翻译] ...  │  ← 水平 Tag 筛选（可多选，可取消）
│  排序：❤️ 最多点赞 | 🕐 最新发布     │
│  ─────────────────────────────────── │
│  节点列表...                         │
└─────────────────────────────────────┘
```

### 15.4 数据库端

category 字段已在 §2.1 的 `ss_community_nodes` 表中定义（`TEXT NOT NULL DEFAULT 'other'`），
已有索引 `ss_community_nodes_category_idx`。无需额外 DDL 变更。

---

## 16. 知识文件上传机制

> **MVP 决策**：采用「提取纯文本 → 截断 8000 字符 → 存 DB TEXT 字段」方案。
>
> 不使用完整 RAG 管道的原因：
> - MVP 无需异步 BackgroundTasks + polling 状态逻辑
> - 开发量减少约 60%（无需新建 chunk/embedding 表）
> - 社区节点的知识文件通常是中等大小（1-20 页）
> - 后续 Phase 可升级到 RAG（基础设施已就绪）

### 16.1 数据库变更（在 §2.1 表中新增字段）

```sql
-- 在 ss_community_nodes 表新增以下字段：
ALTER TABLE ss_community_nodes ADD COLUMN IF NOT EXISTS
    knowledge_file_path  TEXT DEFAULT NULL;          -- Supabase Storage 路径

ALTER TABLE ss_community_nodes ADD COLUMN IF NOT EXISTS
    knowledge_file_name  TEXT DEFAULT NULL;           -- 原始文件名

ALTER TABLE ss_community_nodes ADD COLUMN IF NOT EXISTS
    knowledge_file_size  INTEGER DEFAULT 0;           -- 文件大小 (bytes)

ALTER TABLE ss_community_nodes ADD COLUMN IF NOT EXISTS
    knowledge_text       TEXT DEFAULT NULL;            -- 提取后的纯文本（截断 8000 字符）
```

> **注意**：`knowledge_text` 是预提取的缓存字段。执行时直接从 DB 读取，无需再次解析文件。
> 字段不返回给前端（和 prompt 一样的安全策略）。

### 16.2 Supabase Storage Bucket

```sql
-- 新建 Storage Bucket（在 Supabase Dashboard 或迁移中执行）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-node-files',
  'community-node-files',
  false,                                            -- 私有 bucket
  10485760,                                         -- 10MB 限制
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'text/plain'
  ]
);

-- Storage RLS：只有上传者可以读写
CREATE POLICY "作者可上传知识文件"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'community-node-files'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "后端 service_role 可读知识文件"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'community-node-files');
```

### 16.3 上传 & 提取流程

```python
# backend/app/api/community_nodes.py — 发布时的文件处理

from app.services.file_parser import parse_file

MAX_KNOWLEDGE_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_KNOWLEDGE_TEXT_LENGTH = 8000             # 8000 字符硬截断
ALLOWED_KNOWLEDGE_EXTENSIONS = {'pdf', 'docx', 'md', 'txt'}

@router.post("/")
async def publish_community_node(
    name: str = Form(...),
    description: str = Form(...),
    prompt: str = Form(...),
    icon: str = Form('Bot'),
    category: str = Form('other'),
    output_format: str = Form('markdown'),
    output_schema: str | None = Form(None),      # JSON string
    model_preference: str = Form('auto'),
    input_hint: str = Form(''),
    knowledge_file: UploadFile | None = File(None),   # 可选文件
    current_user: dict = Depends(get_current_user),
    db: AsyncClient = Depends(get_supabase_client),
    service_db: AsyncClient = Depends(get_db),
):
    """发布社区节点（含可选知识文件）"""
    user_id = current_user["id"]

    # ── 知识文件处理 ──
    knowledge_file_path = None
    knowledge_file_name = None
    knowledge_file_size = 0
    knowledge_text = None

    if knowledge_file and knowledge_file.filename:
        ext = knowledge_file.filename.rsplit('.', 1)[-1].lower()
        if ext not in ALLOWED_KNOWLEDGE_EXTENSIONS:
            raise HTTPException(400, f"不支持的文件格式: .{ext}")

        content = await knowledge_file.read()
        if len(content) > MAX_KNOWLEDGE_FILE_SIZE:
            raise HTTPException(400, "知识文件不能超过 10MB")

        # ❶ 提取纯文本
        parsed = parse_file(knowledge_file.filename, content)
        knowledge_text = parsed.full_text[:MAX_KNOWLEDGE_TEXT_LENGTH]

        # ❷ 上传到 Supabase Storage
        storage_path = f"{user_id}/{uuid.uuid4()}.{ext}"
        await service_db.storage.from_('community-node-files').upload(
            path=storage_path,
            file=content,
            file_options={"content-type": knowledge_file.content_type},
        )

        knowledge_file_path = storage_path
        knowledge_file_name = knowledge_file.filename
        knowledge_file_size = len(content)

    # ── 插入节点记录 ──
    node_id = str(uuid.uuid4())
    parsed_schema = json.loads(output_schema) if output_schema else None

    await service_db.from_("ss_community_nodes").insert({
        "id": node_id,
        "author_id": user_id,
        "name": name,
        "description": description,
        "prompt": prompt,
        "icon": icon,
        "category": category,
        "output_format": output_format,
        "output_schema": parsed_schema,
        "model_preference": model_preference,
        "input_hint": input_hint,
        "knowledge_file_path": knowledge_file_path,
        "knowledge_file_name": knowledge_file_name,
        "knowledge_file_size": knowledge_file_size,
        "knowledge_text": knowledge_text,
        "status": "pending",
    }).execute()

    return {"id": node_id, "status": "pending"}
```

### 16.4 执行时知识注入

```python
# backend/app/nodes/community/node.py — execute() 知识注入部分

# ① 从 DB 读取 prompt + knowledge_text
node_def = await CommunityNodeService.get_node_with_prompt(community_node_id)
custom_prompt = node_def['prompt']
knowledge_text = node_def.get('knowledge_text')

# ② 拼装 system prompt
if knowledge_text:
    custom_prompt += f"""

---
【参考知识库】
以下是发布者提供的参考资料，请在回答中优先参考此知识：

{knowledge_text}
---"""

# ③ 构建 messages
messages = [
    {"role": "system", "content": custom_prompt},
    {"role": "user", "content": user_input},
]
```

### 16.5 前端发布表单扩展（PublishNodeDialog）

```
┌─────────────────────────────────────┐
│  ...（基础信息、Prompt 编辑区）       │
│                                     │
│  ── 知识库（可选）──                  │
│  [📎 上传文件] 或 [拖拽文件到此]      │
│  支持：PDF、Word、Markdown、TXT       │
│  限制：单个文件 ≤ 10MB               │
│                                     │
│  已上传：                            │
│  ┌──────────────────────────────┐   │
│  │ 📄 machine-learning.pdf     │   │
│  │    2.3 MB                    │   │
│  │    [✕ 移除]                  │   │
│  └──────────────────────────────┘   │
│                                     │
│  ── 输出格式 ──                      │
│  ...                                │
└─────────────────────────────────────┘
```

### 16.6 后续升级路径（非 MVP）

```
Phase 2 升级路径：如果需要支持大文件精确检索
  ↓
  发布时：file_parser → text_chunker → embed_texts → ss_community_node_chunks
  执行时：用户输入作 query → 语义检索 top_k=5 chunks → 注入 prompt
  基础设施：复用项目已有的 knowledge_service.py 管道

  所需新增：
  - ss_community_node_chunks 表（结构同 ss_kb_document_chunks）
  - ss_community_node_embeddings 表（结构同 ss_kb_chunk_embeddings）
  - BackgroundTasks 异步处理 + 前端 polling
  - 约 50 行代码（大部分复用 knowledge_service.py）
```

---

## 17. 输出格式约束（JSON Schema 强制）

> **MVP 决策**：后端 prompt 注入 + post_process 正则清洗 + JSON 校验。
> 不依赖 LLM 的 structured output API（通义千问 turbo 不支持），纯逻辑实现。

### 17.1 发布者配置 JSON 格式时的交互

```
输出格式           [▼ JSON     ]    ← 选择 JSON 后，展开以下面板

┌── JSON Schema 定义 ──────────────────────────┐
│                                               │
│  [✨ AI 生成 Schema]  [📋 从示例推断]         │  ← 辅助按钮
│                                               │
│  {                                            │  ← Monaco Editor (JSON mode)
│    "type": "object",                          │
│    "properties": {                            │
│      "summary": {                             │
│        "type": "string",                      │
│        "description": "代码摘要"              │
│      },                                       │
│      "issues": {                              │
│        "type": "array",                       │
│        "items": {                             │
│          "type": "object",                    │
│          "properties": {                      │
│            "line": { "type": "number" },      │
│            "severity": {                      │
│              "type": "string",                │
│              "enum": ["error","warning","info"]│
│            },                                 │
│            "message": { "type": "string" }    │
│          }                                    │
│        }                                      │
│      }                                        │
│    },                                         │
│    "required": ["summary", "issues"]          │
│  }                                            │
│                                               │
│  校验状态：✅ JSON Schema 格式合法             │
└───────────────────────────────────────────────┘
```

### 17.2 后端 prompt 注入逻辑

```python
# backend/app/nodes/community/node.py — execute() 中 JSON 约束部分

import json
import re

def _build_json_constraint_prompt(output_schema: dict) -> str:
    """构建 JSON 格式强制约束的 prompt 片段。"""
    schema_str = json.dumps(output_schema, ensure_ascii=False, indent=2)
    return f"""

---
【输出格式严格约束 / OUTPUT FORMAT CONSTRAINT】

你必须且只能输出一个合规的 JSON 对象。

严格要求：
1. 以 {{ 开头，以 }} 结尾
2. 不要输出 ```json ``` 代码块标记
3. 不要输出任何解释、注释或多余文字
4. 字段名必须与以下 Schema 完全一致
5. 所有 required 字段必须存在

JSON Schema：
{schema_str}
---"""


# execute() 中的拼装：
if output_format == 'json' and output_schema:
    custom_prompt += _build_json_constraint_prompt(output_schema)
```

### 17.3 后端 post_process 清洗逻辑

```python
# backend/app/nodes/community/node.py — post_process 重写

class CommunityNode(BaseNode):
    # ...

    async def post_process(self, raw_output: str) -> NodeOutput:
        """社区节点输出后处理：JSON 模式时进行清洗 + 校验。"""
        if self._output_format != 'json':
            return NodeOutput(content=raw_output, format="markdown")

        cleaned = raw_output.strip()

        # ❶ 去掉 ```json ... ``` 代码块标记
        if cleaned.startswith("```"):
            cleaned = re.sub(r'^```\w*\n?', '', cleaned)
            cleaned = re.sub(r'\n?```$', '', cleaned)
            cleaned = cleaned.strip()

        # ❷ 尝试提取 JSON 对象（处理模型在 JSON 后附加解释文本的情况）
        brace_start = cleaned.find('{')
        brace_end = cleaned.rfind('}')
        if brace_start >= 0 and brace_end > brace_start:
            cleaned = cleaned[brace_start:brace_end + 1]

        # ❸ 尝试解析
        try:
            parsed = json.loads(cleaned)
            return NodeOutput(
                content=json.dumps(parsed, ensure_ascii=False, indent=2),
                format="json",
                metadata={"json_valid": True},
            )
        except json.JSONDecodeError as e:
            # ❹ 解析失败：返回 markdown 标注错误
            return NodeOutput(
                content=(
                    f"⚠️ **JSON 格式校验失败**\n\n"
                    f"错误信息：{e.msg}\n\n"
                    f"模型原始输出：\n```\n{raw_output[:2000]}\n```"
                ),
                format="markdown",
                metadata={"json_valid": False, "json_error": str(e)},
            )
```

### 17.4 JSON 校验重试（可选增强，config.yaml 已有设置）

```
config.yaml 已定义：
  engine:
    json_validation_retries: 3    ← 现有配置

MVP 阶段不重试。如需重试，在 executor.py 的 node_done 后检查
  metadata.json_valid == False → 重新调用 execute()（最多重试 N 次）

Phase 2 实现。
```

---

## 18. AI 辅助生成 JSON Schema

> **MVP 决策**：硬编码调用 `call_llm_direct("dashscope", "qwen-turbo-latest")`，
> 不消耗用户额度，平台内部调用。使用已有 `ai_router.py` 的 `call_llm_direct` 函数。

### 18.1 API 端点

```
POST /api/community-nodes/generate-schema

请求体：
{
  "name": "Python 代码审查器",
  "description": "审查 Python 代码质量",
  "prompt_snippet": "你是一个专业的 Python 代码审查专家..."  ← prompt 的前 500 字
}

响应体：
{
  "schema": { ... JSON Schema ... },
  "example": { ... 示例输出 ... }
}
```

### 18.2 后端实现

```python
# backend/app/api/community_nodes.py — AI 生成 Schema 端点

from app.services.ai_router import call_llm_direct

SCHEMA_GEN_SYSTEM_PROMPT = """你是一个 JSON Schema 生成专家。

用户正在创建一个 AI 节点，需要你根据节点信息生成合适的 JSON Schema。

要求：
1. 输出一个标准的 JSON Schema (draft-07)
2. 包含 "type", "properties", "required" 字段
3. 每个 property 都有 "type" 和 "description"
4. 同时生成一个符合 Schema 的示例 JSON

严格按以下格式输出（不要多余文字）：
```json
{
  "schema": { ... 你的 JSON Schema ... },
  "example": { ... 符合 Schema 的示例 ... }
}
```"""

@router.post("/generate-schema")
async def generate_schema(
    body: SchemaGenRequest,
    current_user: dict = Depends(get_current_user),
):
    """AI 辅助生成 JSON Schema（平台内部调用，不消耗用户额度）"""

    user_message = (
        f"节点名称：{body.name}\n"
        f"节点描述：{body.description}\n"
        f"提示词摘要：{body.prompt_snippet[:500]}\n\n"
        "请为这个节点生成合适的 JSON Schema 和输出示例。"
    )

    messages = [
        {"role": "system", "content": SCHEMA_GEN_SYSTEM_PROMPT},
        {"role": "user", "content": user_message},
    ]

    # 硬编码调用通义千问 turbo — 最便宜的模型，平台承担成本
    result = await call_llm_direct(
        platform_name="dashscope",
        model_name="qwen-turbo-latest",
        messages=messages,
        stream=False,
    )

    # 解析 AI 返回的 JSON
    try:
        # 去掉可能的 ```json ``` 包装
        content = result if isinstance(result, str) else result.content
        cleaned = content.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r'^```\w*\n?', '', cleaned)
            cleaned = re.sub(r'\n?```$', '', cleaned)
        parsed = json.loads(cleaned.strip())
        return {
            "schema": parsed.get("schema", {}),
            "example": parsed.get("example", {}),
        }
    except (json.JSONDecodeError, AttributeError):
        raise HTTPException(
            status_code=500,
            detail="AI 生成的 Schema 格式异常，请手动编写或重试",
        )
```

### 18.3 调用链路与成本

```
调用路径：
  call_llm_direct("dashscope", "qwen-turbo-latest", messages)
    → ai_router.py L456 → _call_non_stream()
    → 百炼官网 API

成本：
  qwen-turbo-latest 价格：
    输入: ¥0.3 / 百万 tokens
    输出: ¥0.6 / 百万 tokens
  一次 Schema 生成 ≈ 500 input + 500 output tokens
    → 成本 ≈ ¥0.00045 / 次
    → 1000 次 ≈ ¥0.45
  结论：可忽略不计

计费：
  不走用户 usage_ledger（不 bind_usage_request）
  后端直接调用 call_llm_direct，记录在平台的 usage events 中
  但不关联到具体用户的额度系统
```

### 18.4 限流保护

```python
# 限流：每用户每小时最多 20 次
# 使用简单的内存限流（或 Redis，如有）

from datetime import timedelta

# 简易方案：在 API 层面加装 slowapi
# 或用一个 dict + asyncio.Lock 做内存限流

SCHEMA_GEN_RATE_LIMIT = 20     # 每小时
SCHEMA_GEN_WINDOW = 3600       # 秒
```

### 18.5 前端交互

```typescript
// frontend/src/features/community-nodes/components/SchemaEditor.tsx

// 点击 [✨ AI 生成 Schema] 按钮
const handleGenerateSchema = async () => {
  setGenerating(true);
  try {
    const result = await communityNodesService.generateSchema({
      name,
      description,
      prompt_snippet: prompt.slice(0, 500),
    });
    setOutputSchema(JSON.stringify(result.schema, null, 2));
    setSchemaExample(JSON.stringify(result.example, null, 2));
    toast.success('Schema 已生成，请检查并调整');
  } catch (error) {
    toast.error('生成失败，请手动编写或重试');
  } finally {
    setGenerating(false);
  }
};
```

---

## 19. LLM 路由策略（社区节点专用）

> **关键问题**：`call_llm(node_type, messages)` 中的 `node_type` 对应 `config.yaml > task_routes`。
> 社区节点的 `node_type = "community_node"` 没有在 `task_routes` 中注册。

### 19.1 解决方案

```python
# backend/app/nodes/community/node.py — execute() 中的 LLM 调用

async def execute(self, node_input, llm_caller):
    # ...（读取 prompt、拼装 messages）...

    # ── LLM 路由策略 ──
    # 优先使用用户在画布上选择的 model_route（如果有）
    model_route = (node_input.node_config or {}).get("model_route")
    if model_route:
        # 用户指定了模型 → 走 direct 路由
        # model_route 格式：sku_id（如 "sku_deepseek_reasoner_native"）
        from app.services.ai_router import call_llm_direct_structured
        from app.services.ai_catalog_service import get_sku_by_id
        sku = await get_sku_by_id(model_route)
        if sku:
            result = await call_llm_direct_structured(
                sku.provider, sku.model_id, messages, stream=True,
            )
            async for token in result.token_stream:
                yield token
            return

    # 用户未指定模型 → 走 chat_response 的默认路由
    # chat_response 路由在 config.yaml 中有降级链，是最通用的 AI 路由
    async for token in llm_caller("chat_response", messages, stream=True):
        yield token
```

### 19.2 为什么用 chat_response 降级

```
chat_response 的 task_routes（config.yaml L131-136）：
  sku_ids:
    - sku_deepseek_reasoner_native      # 首选
    - sku_dashscope_qwen_plus_native    # 降级 1
    - sku_volcengine_doubao_pro_256k    # 降级 2

这是最通用的高质量路由组，适合社区节点的多样化场景。
如果用户自选模型，则忽略此路由，直接走 call_llm_direct。
```

### 19.3 Tier 校验

```
重要安全约束：
  workflow_execute.py L83-102 已有 Tier 校验逻辑（遍历所有节点的 model_route）。
  社区节点也走这个逻辑 → 如果用户选了 Pro 模型但不是 Pro 用户 → 403。
  无需额外代码。
```

---

## 20. 数据库 Schema 补充（更新 §2.1）

以下字段需补充到 `ss_community_nodes` CREATE TABLE 中：

```sql
-- §2.1 补充字段（知识文件 + 分类更新）
-- 在 ss_community_nodes 表定义中补充：

    -- 知识文件
    knowledge_file_path  TEXT DEFAULT NULL,           -- Supabase Storage 路径
    knowledge_file_name  TEXT DEFAULT NULL,           -- 原始文件名（展示用）
    knowledge_file_size  INTEGER DEFAULT 0,           -- 文件大小 bytes
    knowledge_text       TEXT DEFAULT NULL,           -- 提取后纯文本（≤8000 字符）
```

### 20.1 完整字段安全矩阵

| 字段 | 公开 API 返回 | 作者 API 返回 | 后端执行加载 | 前端可见 |
|------|:---:|:---:|:---:|:---:|
| `id, name, description, icon` | ✅ | ✅ | ✅ | ✅ |
| `category, version` | ✅ | ✅ | ✅ | ✅ |
| `input_hint, output_format` | ✅ | ✅ | ✅ | ✅ |
| `model_preference` | ✅ | ✅ | ✅ | ✅ |
| `likes_count, install_count` | ✅ | ✅ | ❌ | ✅ |
| `prompt` | ❌ | ✅ | ✅ | ❌（作者可见） |
| `output_schema` | ✅ | ✅ | ✅ | ✅ |
| `knowledge_file_name` | ✅ | ✅ | ❌ | ✅ |
| `knowledge_file_size` | ✅ | ✅ | ❌ | ✅ |
| `knowledge_text` | ❌ | ❌ | ✅ | ❌ |
| `knowledge_file_path` | ❌ | ❌ | ✅ | ❌ |

---

## 21. Pydantic 模型补充（更新 §3.4）

```python
# backend/app/models/community_nodes.py — 补充字段

class CommunityNodeCreate(BaseModel):
    name: str
    description: str
    icon: str = 'Bot'
    category: str = 'other'                     # ← 默认改为 'other'
    prompt: str
    input_hint: str = ''
    output_format: str = 'markdown'             # 'markdown' | 'json'
    output_schema: dict | None = None           # JSON Schema（json 模式时必需）
    model_preference: str = 'auto'
    # knowledge_file 通过 Form + File 上传，不在 JSON body 中

class CommunityNodePublic(BaseModel):
    """返回给前端的公开信息（不含 prompt、knowledge_text）"""
    id: str
    author_id: str
    author_name: str
    name: str
    description: str
    icon: str
    category: str                               # ← 使用场景化分类
    version: str
    input_hint: str
    output_format: str
    output_schema: dict | None                  # ← 新增：前端可展示 JSON 约束
    model_preference: str
    knowledge_file_name: str | None             # ← 新增：展示"有辅助知识"
    knowledge_file_size: int                    # ← 新增
    likes_count: int
    install_count: int
    is_liked: bool
    created_at: datetime
    # prompt 不在这里！
    # knowledge_text 不在这里！
    # knowledge_file_path 不在这里！

class SchemaGenRequest(BaseModel):
    """AI 生成 Schema 请求"""
    name: str
    description: str
    prompt_snippet: str                         # prompt 的前 500 字
```

---

## 22. Checklist 补充（更新 §13）

```
□ 分类体系
  □ 前端 COMMUNITY_NODE_CATEGORIES 常量定义
  □ CommunityNodeList 分类筛选 Tag 组件
  □ API search 参数支持 category + name/description ILIKE

□ 知识文件上传
  □ Supabase Storage bucket: 'community-node-files'
  □ Storage RLS 策略（上传者写，service_role 读）
  □ 发布 API 接收 multipart/form-data（Form + File）
  □ file_parser.parse_file() 提取文本
  □ 截断 8000 字符存入 knowledge_text
  □ PublishNodeDialog 文件上传区域
  □ 单文件 ≤ 10MB 校验

□ 输出格式约束
  □ PublishNodeDialog 输出格式选择器（markdown/json）
  □ SchemaEditor 组件（Monaco Editor + JSON Schema 模式）
  □ 前端 JSON Schema 格式校验（发布前校验合法性）
  □ 后端 _build_json_constraint_prompt() prompt 注入
  □ 后端 CommunityNode.post_process() JSON 清洗逻辑
  □ 清洗失败时的 graceful fallback（返回错误标注的 markdown）

□ AI 生成 Schema
  □ POST /api/community-nodes/generate-schema 端点
  □ SCHEMA_GEN_SYSTEM_PROMPT 定义
  □ 调用 call_llm_direct("dashscope", "qwen-turbo-latest")
  □ 限流：20 次/用户/小时
  □ 前端 SchemaEditor 中 [✨ AI 生成] 按钮 + loading 状态

□ LLM 路由
  □ CommunityNode.execute() 中 model_route 直连逻辑
  □ 无 model_route 时降级到 chat_response 路由
  □ workflow_execute.py 的 Tier 校验覆盖社区节点
```

---

## 23. 完整发布表单（最终版，替代 §6.2）

```
┌─────────────────────────────────────────────┐
│  🚀 发布我的节点                              │
├─────────────────────────────────────────────┤
│                                             │
│  ── 基础信息 ──                              │
│  节点名称 *        [__________________]      │
│  描述 *            [__________________]      │
│  分类 *            [▼ 学术论文         ]      │  ← COMMUNITY_NODE_CATEGORIES
│  图标              [▼ 🤖 Bot          ]      │  ← 16 个预设 lucide icon
│                                             │
│  ── System Prompt（核心，使用者不可见）──      │
│  ┌────────────────────────────────────┐     │
│  │  你是一个专业的 Python 代码审查     │     │  ← 大文本区域
│  │  专家。用户会提交代码片段，你需要   │     │
│  │  逐行检查...                       │     │
│  │                                    │     │
│  └────────────────────────────────────┘     │
│  输入提示           [需要Python代码片段]      │
│                                             │
│  ── 知识库（可选）──                         │
│  ┌────────────────────────────────────┐     │
│  │  📎 点击或拖拽上传知识文件           │     │
│  │  支持 PDF/Word/MD/TXT，≤ 10MB     │     │
│  └────────────────────────────────────┘     │
│  ⓘ AI 执行时会参考此文件内容辅助回答         │
│                                             │
│  ── 输出设置 ──                              │
│  输出格式           [▼ Markdown       ]      │  ← 选 JSON 时展开 Schema 编辑器
│                                             │
│  ┌── JSON Schema（仅 JSON 模式显示）─────┐  │
│  │  [✨ AI 生成]                         │  │
│  │  ┌───────────────────────────────┐   │  │
│  │  │ { "type": "object", ...       │   │  │  ← Monaco Editor
│  │  └───────────────────────────────┘   │  │
│  │  校验：✅ 格式合法                    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  推荐模型           [▼ 自动            ]      │  ← auto/fast/powerful
│                                             │
│  [取消]                           [🚀 发布]  │
└─────────────────────────────────────────────┘
```

---

## 24. 使用者 vs 发布者权限矩阵（最终版）

| 配置项 | 发布者 | 使用者 | 存储位置 |
|--------|:---:|:---:|---------|
| 节点名称 | ✅ 定义 | ✅ 可改画布 label | DB `name` / 画布 `data.label` |
| 节点描述 | ✅ 定义 | 👁️ 只读 | DB `description` |
| 分类 | ✅ 选择 | 👁️ 筛选用 | DB `category` |
| 图标 | ✅ 选择 | 👁️ 只读 | DB `icon` |
| System Prompt | ✅ 编写 | ❌ 不可见 | DB `prompt` |
| 输入提示 | ✅ 编写 | 👁️ 只读 | DB `input_hint` |
| 知识文件 | ✅ 上传 | 👁️ 仅见文件名 | Storage + DB `knowledge_text` |
| 输出格式 | ✅ 选择 | 👁️ 只读 | DB `output_format` |
| JSON Schema | ✅ 编写/AI生成 | 👁️ 只读 | DB `output_schema` |
| 模型选择 | ✅ 设推荐值 | ✅ 可覆盖 | DB `model_preference` / 画布 `data.model_route` |

---

## 25. 前端新增文件补充（更新 §11）

### 前端新增（知识文件、JSON Schema、分类相关）

```
frontend/src/features/community-nodes/
├── constants/
│   └── categories.ts                        ← 分类常量 + 类型
├── components/
│   ├── SchemaEditor.tsx                     ← JSON Schema 编辑器（Monaco + AI 生成按钮）
│   ├── KnowledgeFileUpload.tsx             ← 知识文件上传区域
│   └── CategoryFilter.tsx                  ← 分类 Tag 筛选器
└── services/
    └── community-nodes.service.ts          ← 补充 generateSchema() API 方法
```

### 总计文件数更新

```
原计划：约 18-22 个文件
更新后：约 25-28 个文件
  新增部分：
  +3 前端组件（SchemaEditor, KnowledgeFileUpload, CategoryFilter）
  +1 前端常量（categories.ts）
  +0 后端（合并到 community_nodes.py 路由 + node.py 执行器中）
  修改部分：
  community_nodes.py       ← 增加 generate-schema 端点 + 文件上传处理
  node.py                   ← 增加知识注入 + JSON 约束 + LLM 路由逻辑
  PublishNodeDialog.tsx     ← 扩展表单
  community-nodes.service.ts ← 增加 API 方法
```
