<!-- 编码：UTF-8 -->

# 社区共享节点系统一期实施总结

> **日期**：2026-03-27
> **类型**：社区共享节点一期落地 + 工作流执行契约修复 + 模型选择真实生效 + Supabase 云端迁移落地
> **涉及模块**：Community Nodes API / Workflow Executor / Node Store / Workflow Canvas / AI Model Selector / Supabase Migration / Test Infra / Summary Docs

---

## 1. 背景、目标与实施前提

这次工作的直接来源，是详细规划文档 `docs/Plans/daily_plan/adds/2-community-shared-nodes-system.md` 中定义的“社区共享节点系统（社区提示词节点）”一期目标。核心诉求不是简单新增一个“节点市场”界面，而是要把一套完整的“用户发布提示词节点 → 其他用户拖入工作流 → 后端可真实执行”的闭环打通。

在实施前，系统中有两个关键现实前提必须先被纳入：

1. **编码约束必须前置**
   本轮所有新增和修改文件都要求保持 `UTF-8（无 BOM）+ LF`，禁止破坏中文文本、中文注释、中文提示词和中文文档。

2. **执行契约本身存在既有断层**
   前端 `NodeModelSelector` 会把模型选择写入 `node.data.model_route`，但后端执行器过去只把 `node.data.config` 传给节点执行，导致“用户在节点头部选了模型，但运行时不一定真正使用这个模型”。

因此，本次任务的真实目标不是只做“社区节点 UI”，而是同时完成以下三件事：

- 落地社区共享节点一期能力
- 修正工作流执行层的运行时配置传递契约
- 让模型选择功能从“界面可选”变成“运行真实生效”

---

## 2. 对详细规划文档的收敛与取舍

本次实施以 `docs/Plans/daily_plan/adds/2-community-shared-nodes-system.md` 为主参考，但不是逐字照抄，而是结合真实代码结构做了工程化收敛。

### 2.1 保持一致的部分

- 统一前端节点类型为 `community_node`
- 共享节点提示词对使用者不可见
- 使用者只能改模型和画布标签，不可改封装 prompt
- 支持知识文件上传
- 支持 `markdown | json` 输出格式
- 支持 AI 辅助生成 JSON Schema
- 支持点赞
- 支持在节点商店中搜索、排序、分页、发布、拖拽到画布

### 2.2 按真实工程做出的收敛

1. **知识库关联从 `knowledge_refs` 收敛为同步文件注入 MVP**
   规划文档早期版本里保留了“关联知识库 ID 列表”的设想，但当前工程实际更适合先走同步文件上传与文本抽取。因此本次采用：
   - `knowledge_file_path`
   - `knowledge_file_name`
   - `knowledge_file_size`
   - `knowledge_text`

   即：发布时上传原文件到 Storage，同时同步提取纯文本并截断存入数据库，用于执行时 prompt 注入。

2. **`install_count` 只保留字段，不落地 installs 表**
   规划中提到 `ss_community_node_installs` 可用于排行榜与使用统计，但一期实现中先保留 `install_count` 字段，未创建安装记录表，也未做自动维护逻辑。

3. **模型路由修复放在 `executor.py`，而不是每个节点 mixin 内分散处理**
   规划中原本设想在 `_mixins.py` 做统一直连逻辑，但最终实施时发现执行器层集中收口更稳，因为：
   - 可以一次性覆盖所有 LLM 节点
   - 可以统一兼容 `node.data.config + node.data` 根层执行字段
   - 不需要逐个节点类回填重复逻辑

4. **权限控制以 API 过滤为主，不把 RLS 视为唯一边界**
   原因是当前后端数据库访问默认使用 `service_role`，RLS 不是第一道权限墙。因此：
   - 公开接口序列化时主动剔除 `prompt`、`knowledge_text`、`knowledge_file_path`
   - 作者接口才返回 `prompt`
   - 运行时内部再通过服务层读取 prompt

---

## 3. 数据库与 Supabase 变更

### 3.1 本地迁移文件

本地新增迁移文件：

- `supabase/migrations/20260327210000_add_community_nodes.sql`

该迁移完成了以下结构：

- 新建 `public.ss_community_nodes`
- 新建 `public.ss_community_node_likes`
- 为 `likes_count` 增加触发器维护
- 新建 Storage bucket：`community-node-files`
- 配置与上传/读取相关的 Storage Policy

### 3.2 云端 Supabase 已实际执行

本次不是只写本地 SQL 文件，而是已经通过 Supabase MCP 把迁移实际应用到云端项目：

- **项目**：`1037SoloPlatform`
- **project_id / ref**：`hofcaclztjazoytmckup`
- **云端 migration 名称**：`add_community_nodes`
- **云端 migration 版本**：`20260327130414`

云端验证结果如下：

- `public.ss_community_nodes` 已存在
- `public.ss_community_node_likes` 已存在
- 两张表都已启用 RLS
- `storage.buckets` 中已存在 `community-node-files`
- bucket 大小限制为 `10MB`
- 允许 MIME 类型包含：
  - `application/pdf`
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `text/markdown`
  - `text/plain`

### 3.3 数据层的实际字段设计

`ss_community_nodes` 本次落地的核心字段包括：

- `author_id`
- `name`
- `description`
- `icon`
- `category`
- `version`
- `prompt`
- `input_hint`
- `output_format`
- `output_schema`
- `model_preference`
- `status`
- `reject_reason`
- `is_public`
- `knowledge_file_path`
- `knowledge_file_name`
- `knowledge_file_size`
- `knowledge_text`
- `likes_count`
- `install_count`
- `created_at`
- `updated_at`

其中有两个刻意保留给后续阶段继续扩展的字段：

- `status`：一期默认直接 `approved`
- `install_count`：一期不自动统计，默认 `0`

---

## 4. 后端 API、模型与服务层改动

### 4.1 新增社区节点模型定义

新增文件：

- `backend/app/models/community_nodes.py`

主要新增了以下模型：

- `CommunityNodeCreate`
- `CommunityNodeUpdate`
- `CommunityNodePublic`
- `CommunityNodeMine`
- `CommunityNodeListResponse`
- `SchemaGenRequest`
- `SchemaGenResponse`

这里有一个实施中顺手修掉的运行细节：`SchemaGenResponse` 不能直接把字段命名为 `schema`，否则会触发 Pydantic 对父类属性阴影的警告。因此最终实现采用了：

- 内部字段名：`schema_`
- 对外别名：`schema`

这样既保持接口响应格式正确，又消除了运行时警告。

### 4.2 新增服务层

新增文件：

- `backend/app/services/community_node_service.py`

服务层承接了以下职责：

- 公开节点列表分页、搜索、排序、分类过滤
- 我的节点列表查询
- 公开节点详情查询
- 创建、更新、删除
- 点赞、取消点赞
- 运行时内部读取 prompt 的 `get_node_with_prompt`

同时，服务层内部明确区分了两套序列化结果：

- `CommunityNodePublic`
  - 不返回 `prompt`
  - 不返回 `knowledge_text`
  - 不返回 `knowledge_file_path`

- `CommunityNodeMine`
  - 作者自己可看到 `prompt`

这保证了“发布者可维护、使用者不可窃取 prompt”的产品约束。

### 4.3 新增 API 路由

新增文件：

- `backend/app/api/community_nodes.py`

并在：

- `backend/app/api/router.py`

中完成注册，挂载到：

- `/api/community-nodes`

本次落地的端点包括：

- `GET /api/community-nodes/`
- `GET /api/community-nodes/mine`
- `GET /api/community-nodes/{node_id}`
- `POST /api/community-nodes/`
- `PUT /api/community-nodes/{node_id}`
- `DELETE /api/community-nodes/{node_id}`
- `POST /api/community-nodes/{node_id}/like`
- `DELETE /api/community-nodes/{node_id}/like`
- `POST /api/community-nodes/generate-schema`

### 4.4 知识文件上传的实际实现

本次没有引入异步文件解析队列，而是走同步 MVP：

- 前端发布表单使用 `multipart/form-data`
- 后端在 `publish_community_node()` 中接收 `UploadFile`
- 使用 `app/services/file_parser.py` 里的现有 `parse_file()` 解析文本
- 截断后写入 `knowledge_text`
- 原文件上传到 `community-node-files` bucket

支持的扩展名包括：

- `pdf`
- `docx`
- `md`
- `txt`

### 4.5 AI 生成 Schema 的实际实现

`POST /api/community-nodes/generate-schema` 的实现并不是伪接口，而是已经真实接入大模型：

- 使用 `call_llm_direct("dashscope", "qwen-turbo-latest", ...)`
- 增加了简单的内存级频控
- 支持清理模型返回的 Markdown code fence
- 支持把 `schema + example` 解析为结构化响应

---

## 5. 后端执行层与运行契约修复

这是本次工作里最关键、也是最容易被忽略的一层。

### 5.1 旧问题：前端选了模型，执行时不一定真正使用

旧链路的问题在于：

- 前端 `NodeModelSelector` 把用户选择写到了 `node.data.model_route`
- 但执行器过去主要把 `node.data.config` 传给节点
- 结果是根层字段与运行配置存在断层

这个问题不只影响社区节点，也影响原生官方节点。

### 5.2 新契约：执行器统一合并运行时配置

在：

- `backend/app/engine/executor.py`

中新增并固定了新的运行时配置收口逻辑：

- `_build_runtime_config(node_data)`

它会把：

- `node.data.config`
- `node.data.model_route`
- `node.data.community_node_id`
- `node.data.output_format`
- `node.data.input_hint`
- `node.data.model_preference`
- `node.data.community_icon`

统一合并成运行时 `node_input.node_config`。

这意味着：

- 前端仍可以继续把运行字段放在 `node.data` 根层
- 节点执行时又能拿到完整配置
- 不需要强制把所有旧节点数据结构整体迁移到 `config` 内部

### 5.3 模型路由真实生效

执行器进一步新增了：

- `_build_node_llm_caller(runtime_config)`

其逻辑是：

1. 如果 `model_route` 存在且能通过 `get_sku_by_id()` 解析到 SKU
   - 则走 `call_llm_direct(provider, model_id, ...)`

2. 如果不存在或无法解析
   - 则回退到原有 `call_llm(node_type, ...)`

这样完成之后：

- 社区节点可以真实使用用户选中的模型
- 官方节点也同步获得同样的“真实模型选择”能力
- 模型选择功能从“UI 上看起来能选”变成“执行层真正遵守”

### 5.4 新增 CommunityNode 节点类

新增文件：

- `backend/app/nodes/community/node.py`
- `backend/app/nodes/community/__init__.py`

`CommunityNode` 的执行职责包括：

- 根据 `community_node_id` 读取 DB 中的节点定义
- 拼接封装 prompt
- 可选拼接知识文件抽取文本
- 如果输出格式为 `json`，则拼接严格输出约束
- 执行后在 `post_process()` 中：
  - 去掉 code fence
  - 清洗 JSON 文本
  - 解析成功则按 JSON 返回
  - 解析失败则回退为 Markdown，并附带错误提示与模型原始输出

这实现了“只有一个统一 CommunityNode class，运行时从数据库读取 prompt”的规划目标。

---

## 6. 前端节点商店、画布集成与发布流程

### 6.1 新增社区节点前端能力目录

本次前端没有把所有逻辑塞进旧组件，而是新增了：

- `frontend/src/features/community-nodes/`

其中包含：

- `components/CommunityNodeList.tsx`
- `components/CommunityNodeCard.tsx`
- `components/PublishNodeDialog.tsx`
- `components/SchemaEditor.tsx`
- `components/KnowledgeFileUpload.tsx`
- `constants/catalog.ts`

同时新增服务层：

- `frontend/src/services/community-nodes.service.ts`

### 6.2 Node Store 改成双视图

改造文件：

- `frontend/src/components/layout/sidebar/NodeStorePanel.tsx`

最终形态是：

- `default`：保留原官方节点商店
- `community`：显示共享节点列表

共享节点视图支持：

- 搜索
- 分类
- 排序（最多点赞 / 最新发布）
- 分页
- 点赞 / 取消点赞
- 打开“发布我的节点”弹窗

### 6.3 发布表单已接通完整链路

发布弹窗 `PublishNodeDialog.tsx` 支持：

- `name`
- `description`
- `icon`
- `category`
- `prompt`
- `input_hint`
- `output_format`
- `model_preference`
- 可选知识文件
- JSON Schema 编辑与 AI 生成

当 `output_format = json` 时：

- 会展开 `SchemaEditor`
- 前端会校验 JSON 合法性后再提交

### 6.4 共享节点拖入画布已落地

改造文件：

- `frontend/src/features/workflow/components/canvas/WorkflowCanvas.tsx`

完成内容：

- 注册 `community_node: AIStepNode`
- 新增 `createCommunityNodeData()`
- 支持从共享节点卡片拖拽创建节点
- 支持点击卡片后通过 `window` 事件添加节点
- 节点数据中写入：
  - `community_node_id`
  - `community_icon`
  - `output_format`
  - `input_hint`
  - `model_preference`
  - `description`

### 6.5 共享节点与现有 AIStepNode 复用

本次没有单独做一套新的 ReactFlow 节点外壳，而是最小侵入复用：

- `AIStepNode.tsx`

改造后会优先读取共享节点元信息：

- 标题
- icon
- 描述 / input_hint

同时不向前端暴露封装 prompt。

这符合规划文档里“共享节点与官方节点共用渲染器”的方向。

---

## 7. 前端类型系统与模型选择器修复

### 7.1 前端类型扩展

涉及文件：

- `frontend/src/types/community-nodes.ts`
- `frontend/src/types/workflow.ts`
- `frontend/src/types/index.ts`

完成内容：

- 增加社区节点 API 类型
- 把 `community_node` 正式加入 `NodeType`
- 为 `AIStepNodeData` 增加：
  - `community_node_id`
  - `community_icon`
  - `input_hint`
  - `model_preference`

### 7.2 模型选择器从 `model.model` 改为 `model.skuId`

修复文件：

- `frontend/src/features/workflow/components/nodes/NodeModelSelector.tsx`

这是本次与社区节点实施一起收掉的关键 bug：

- 旧行为：写入 `model.model`
- 新行为：写入 `model.skuId`

同时保留了兼容逻辑：

- 如果历史数据里存的是旧的 `model.model`
- 仍然可以正确显示为已选中状态

这样既修了新数据契约，也避免旧节点立刻全部失效。

---

## 8. 测试、验证与编码安全检查

### 8.1 后端新增测试

新增文件：

- `backend/tests/test_community_nodes_property.py`

覆盖内容包括：

- 公开序列化不暴露 `prompt` 与知识文本
- 作者序列化保留 `prompt`
- `_build_runtime_config()` 正确合并根层执行字段
- `_build_node_llm_caller()` 在存在 SKU 时走直连
- `_build_node_llm_caller()` 在缺少 SKU 时回退任务路由
- `CommunityNode.post_process()` 的 JSON 成功分支
- `CommunityNode.post_process()` 的 JSON 回退分支

### 8.2 测试基建修复

在接入社区节点后，旧测试环境暴露出两个问题：

1. `supabase.create_async_client` stub 缺失，导致测试收集期 import 失败
2. workflow execute 路由属性测试缺少中间件鉴权适配，导致直接返回 `401`

本次已同步修复：

- `backend/tests/conftest.py`
- `backend/tests/test_workflow_execute_route_property.py`

### 8.3 已实际运行通过的检查

本轮已完成并通过：

- `backend`: `pytest backend/tests/test_community_nodes_property.py backend/tests/test_workflow_engine_property.py backend/tests/test_workflow_execute_route_property.py -q`
  - **结果**：`17 passed`

- `frontend`: `pnpm exec tsc --noEmit`

- 运行态导入检查：
  - `import app.engine.executor`
  - `import app.api.community_nodes`
  - 均通过

### 8.4 编码与中文安全检查

本次对关键改动文件做了抽样字节检查，确认：

- 文件均为 `UTF-8`
- 无 BOM
- 无 CRLF 回流

抽查范围包含：

- 后端执行器
- 社区节点 API / model / node
- 新增测试
- 节点商店
- 社区节点列表
- 画布
- 模型选择器
- 前端服务层

因此，这次落地没有引入“保存后中文乱码”或“BOM / CRLF 漂移”的额外问题。

---

## 9. 这次实施额外顺手修掉的问题

除了主任务外，本次还顺手收掉了几个实现级问题：

1. **`executor.py` 缺少 `Any` 导入**
   这个问题不会在 `py_compile` 阶段暴露，但会在模块导入时直接报 `NameError`。已经修复。

2. **`SchemaGenResponse.schema` 的 Pydantic 阴影警告**
   已通过别名字段方式消除。

3. **`workflow_execute.py` 中弃用的 `HTTP_422_UNPROCESSABLE_ENTITY`**
   已改成 `HTTP_422_UNPROCESSABLE_CONTENT`，清掉测试告警。

---

## 10. 当前完成边界与仍未落地部分

本次已经完成的是**社区共享节点一期的主闭环**，但并不等于所有长期功能都已完成。

### 10.1 已完成的边界

- 共享节点数据结构
- 云端数据库迁移
- 列表 / 发布 / 点赞 / 拖入画布
- 运行时 prompt 封装执行
- 知识文件同步上传与文本注入
- JSON Schema 约束
- AI 生成 Schema
- 模型选择真实生效

### 10.2 仍未落地的部分

1. **管理员审核后台**
   一期仍然是“直接发布即公开”，没有做审核工作台。

2. **`install_count` 真实统计**
   当前只有字段，没有安装记录表与自动维护逻辑。

3. **浏览器级端到端冒烟**
   本轮完成了代码级、类型级、单测级验证，但还没有补 Cypress / Playwright 级别的 UI E2E。

4. **更完整的“我的共享节点管理”前端界面**
   后端已有 `mine` 接口，但前端目前主要完成的是发布与商店接入，尚未做完整管理页。

---

## 11. 本次工作的最终结论

到本次提交为止，社区共享节点系统已经不再停留在规划阶段，而是完成了真实可运行的一期实现：

- 用户可以发布封装提示词节点
- 其他用户可以在共享视图中浏览、点赞、拖入自己的工作流
- 节点执行时会从数据库读取封装 prompt，而不是把 prompt 暴露给前端
- 可选知识文件会参与执行注入
- JSON 输出可以被 Schema 约束并在失败时回退
- 节点级模型选择终于在执行链路中真实生效
- 云端 Supabase 结构已经同步创建完成

换句话说，这次不是“又写了一份规划”，而是把“社区共享节点”从一个概念功能，真正推进成了可以继续迭代的产品底座。

---

## 12. 关键文件索引

### 后端

- `backend/app/models/community_nodes.py`
- `backend/app/services/community_node_service.py`
- `backend/app/api/community_nodes.py`
- `backend/app/api/router.py`
- `backend/app/engine/executor.py`
- `backend/app/nodes/community/node.py`
- `backend/app/api/workflow_execute.py`

### 前端

- `frontend/src/types/community-nodes.ts`
- `frontend/src/services/community-nodes.service.ts`
- `frontend/src/components/layout/sidebar/NodeStorePanel.tsx`
- `frontend/src/features/community-nodes/components/CommunityNodeList.tsx`
- `frontend/src/features/community-nodes/components/CommunityNodeCard.tsx`
- `frontend/src/features/community-nodes/components/PublishNodeDialog.tsx`
- `frontend/src/features/community-nodes/components/SchemaEditor.tsx`
- `frontend/src/features/community-nodes/components/KnowledgeFileUpload.tsx`
- `frontend/src/features/workflow/components/canvas/WorkflowCanvas.tsx`
- `frontend/src/features/workflow/components/nodes/AIStepNode.tsx`
- `frontend/src/features/workflow/components/nodes/NodeModelSelector.tsx`
- `frontend/src/features/workflow/constants/workflow-meta.ts`
- `frontend/src/types/workflow.ts`

### 数据库与测试

- `supabase/migrations/20260327210000_add_community_nodes.sql`
- `backend/tests/conftest.py`
- `backend/tests/test_community_nodes_property.py`
- `backend/tests/test_workflow_execute_route_property.py`

### 参考文档

- `docs/Plans/daily_plan/adds/2-community-shared-nodes-system.md`
- `docs/summary/2026-03-27-workflow-node-system-sop-and-capability-foundation-summary.md`
- `docs/summary/2026-03-27-workflow-execution-redesign-completion-summary.md`

