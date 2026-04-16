<!-- 编码：UTF-8 -->

# StudySolo 2026-04-16 阶段总结：Agent 节点专区与子后端对接落地

**完成日期**：2026-04-16
**状态**：核心实现已完成，后端与前端定向测试通过；前端全量 `tsc --noEmit` 仍被既有测试类型问题阻塞。
**覆盖范围**：Agent Gateway、`/api/agents/*`、5 个固定 Agent 节点、节点 Manifest、节点商店、Agent 专属模型选择器、NodeConfig Agent 信息面板、AI 工作流生成提示词、执行 Trace、相关测试与规范文档。

## 1. 执行摘要

本轮改造把“子后端 Agent 能力”从单独的 Gateway/API 基础设施，推进到了工作流节点系统中的真实可用能力。

落地后的核心形态是：默认节点商店新增 `Agent` 分组，内置 5 个固定 Agent 节点，每个节点绑定一个固定子 Agent，并直接通过主后端 `AgentGateway` 调用对应子后端。Agent 节点不再使用主 AI catalog 的模型列表，而是只读取对应子 Agent 的模型清单。

5 个新增节点为：

- `agent_code_review`：代码审查、补丁评估、错误定位。
- `agent_deep_research`：长链资料研究、深度综述、结构化调研。
- `agent_news`：最新资讯、时效主题、新闻追踪。
- `agent_study_tutor`：个性化讲解、学习辅导、学习方案建议。
- `agent_visual_site`：网页结构、页面草案、HTML 起稿。

本轮没有做通用 `agent_call` 节点，也没有把 skills/MCP 真正接入工作流执行链。skills/MCP 在当前版本只作为 Agent 元数据和面板状态展示，避免把未闭环能力提前暴露成可执行配置。

## 2. 后端更新

### 2.1 Agent Registry 与 Gateway

`backend/config/agents.yaml` 继续作为运行时注册表，本轮补齐了 5 个 Agent 的注册基础，其中新增了：

- `study-tutor`
- `visual-site`

`AgentGateway` 增加了模型发现能力：

- 优先请求子 Agent 的 `GET /v1/models`。
- 子 Agent 不健康、请求失败或返回异常时，回退到 `agents.yaml` 中的 `models`。
- 模型结果带短 TTL 缓存，避免每次打开节点配置都打到子后端。
- 健康状态仍通过 `/health/ready` 判断。
- 健康状态只影响运行时提示和实际调用，不决定 Agent 是否进入节点商店。

关键文件：

- `backend/app/services/agent_gateway/models.py`
- `backend/app/services/agent_gateway/caller.py`
- `backend/app/services/agent_gateway/gateway.py`
- `backend/app/services/agent_gateway/__init__.py`
- `backend/config/agents.yaml`

### 2.2 Agent API

`GET /api/agents` 的语义已调整：

- 返回所有 `enabled=true` 的 Agent。
- 每个 Agent 附带 `healthy`。
- 每个 Agent 附带 `capabilities`、`skills_ready`、`mcp_ready`。
- 不再只返回健康 Agent。

新增接口：

```text
GET /api/agents/{name}/models
```

返回结构：

```json
{
  "agent": "code-review",
  "healthy": true,
  "source": "runtime",
  "models": ["code-review/default"]
}
```

其中 `source` 只会是：

- `runtime`：来自子 Agent 的 `/v1/models`。
- `registry-fallback`：来自 `agents.yaml` 的注册表兜底。

关键文件：

- `backend/app/api/agents.py`

### 2.3 Manifest 与节点类别

节点 Manifest 增加了模型来源语义：

- `model_source: "catalog"`：普通 LLM 节点，继续使用主 AI catalog。
- `model_source: "agent"`：Agent 节点，只使用对应子 Agent 模型。
- `model_source: "none"`：不显示模型选择器。

Agent 节点 Manifest 还会输出：

- `category: "agent"`
- `agent_name: "<gateway-agent-name>"`

这让前端可以按 Manifest 分流，不需要在模型选择器里硬编码“哪些节点是 Agent 节点”。

关键文件：

- `backend/app/nodes/_base.py`
- `backend/app/nodes/_categories.py`

### 2.4 5 个固定 Agent 节点

新增 `backend/app/nodes/agent/` 节点类别，并落地共享基类 `BaseAgentNode`。

节点执行链为：

1. 读取节点本地 `prompt.md`。
2. 合并用户配置中的 `task_prompt` / `instruction`。
3. 合并上游节点输出。
4. 根据 `agent_name` 调用 `AgentGateway`。
5. 解析 OpenAI-compatible SSE chunk。
6. 向工作流执行器逐 token 回推。
7. 记录 `resolved_model_route` 供执行 Trace 展示。

每个节点固定绑定一个 Agent：

- `agent_code_review` -> `code-review`
- `agent_deep_research` -> `deep-research`
- `agent_news` -> `news`
- `agent_study_tutor` -> `study-tutor`
- `agent_visual_site` -> `visual-site`

Agent 节点的输出格式统一为 Markdown，当前版本不引入专用 renderer。

新增关键文件：

- `backend/app/nodes/agent/base.py`
- `backend/app/nodes/agent/code_review/node.py`
- `backend/app/nodes/agent/deep_research/node.py`
- `backend/app/nodes/agent/news/node.py`
- `backend/app/nodes/agent/study_tutor/node.py`
- `backend/app/nodes/agent/visual_site/node.py`
- `backend/app/nodes/agent/*/prompt.md`

### 2.5 工作流生成与执行 Trace

后端 AI 模型枚举已接受 5 个 Agent 节点类型。

工作流生成器的行为调整为：

- 普通 LLM 节点仍可按主 catalog 生成或继承 `model_route`。
- Agent 节点不会被伪造主 catalog SKU。
- Agent 节点默认 `model_route` 为空，由运行时回退到该 Agent 默认模型。

执行 Trace 增强：

- `node_done` SSE 事件现在支持 `metadata`。
- Agent 节点完成时会把实际解析后的 `resolved_model_route` 写入 Trace。
- 前端执行面板可以显示 Agent 节点最终调用的子 Agent 模型。

关键文件：

- `backend/app/models/ai.py`
- `backend/app/services/workflow_generator.py`
- `backend/app/engine/node_runner.py`
- `backend/app/api/workflow/execute.py`

## 3. 前端更新

### 3.1 类型系统

`frontend/src/types/workflow.ts` 新增 5 个 Agent 节点类型，并扩展 Manifest 字段：

- `NodeModelSource = "none" | "catalog" | "agent"`
- `NodeManifestItem.model_source`
- `NodeManifestItem.agent_name`

`frontend/src/types/workflow-events.ts` 同步支持 `node_done.metadata`。

### 3.2 节点商店 Agent 分组

默认节点商店新增 `Agent` 分组，展示 5 个固定 Agent 节点。

实现边界：

- `默认 / 共享` 一级结构保持不变。
- `Agent` 是默认商店内的新分组，不是新的一级 Tab。
- Agent 分组只在 Manifest 确认对应 Agent 节点可用后展示。
- 静态 fallback 模式下不会提前展示 Agent 节点，避免出现“注册表未启用但前端可拖出”的状态。

关键文件：

- `frontend/src/components/layout/sidebar/resolve-node-store-groups.ts`
- `frontend/src/components/layout/sidebar/NodeStoreDefaultView.tsx`
- `frontend/src/components/layout/sidebar/NodeStoreItem.tsx`

### 3.3 Agent 专属模型选择器

`NodeModelSelector` 已按 Manifest `model_source` 分流：

- `catalog`：继续读取 `/api/ai/models/catalog`。
- `agent`：只读取 `/api/agents/{agent_name}/models`。
- `none`：不显示模型选择器。

Agent 模型选择器的行为：

- 只展示对应 Agent 返回或兜底的模型。
- 提供“默认模型（自动）”选项，写入空 `model_route`。
- 显示 Agent 健康状态。
- 显示模型来源是 runtime 还是 registry fallback。
- 不混用主 AI catalog。

关键文件：

- `frontend/src/features/workflow/components/nodes/NodeModelSelector.tsx`
- `frontend/src/services/agent.service.ts`
- `frontend/src/features/workflow/components/nodes/AIStepNode.tsx`

### 3.4 NodeConfig Agent 信息面板

节点配置抽屉现在能识别 Agent 节点，并显示只读 Agent 信息：

- 绑定的 Agent 名称。
- 健康状态。
- 模型来源。
- skills ready 状态。
- MCP ready 状态。
- capabilities。
- 当前可用模型列表。

当前版本不提供 skills/MCP 执行开关，只显示 ready/not-ready 状态。

关键文件：

- `frontend/src/features/workflow/components/node-config/NodeConfigFormContent.tsx`

### 3.5 Canvas 与执行前端

5 个 Agent 节点继续复用 `AIStepNode`，不新增特殊画布节点组件。

已同步接入：

- 节点 meta。
- 节点主题。
- 画布节点注册。
- 只读画布注册。
- AI 动作执行器。
- 执行事件解析。

关键文件：

- `frontend/src/features/workflow/constants/workflow-meta.ts`
- `frontend/src/features/workflow/components/canvas/canvas-constants.ts`
- `frontend/src/features/workflow/components/canvas/ReadOnlyCanvas.tsx`
- `frontend/src/features/workflow/components/canvas/canvas-node-factory.ts`
- `frontend/src/features/workflow/hooks/use-action-executor.ts`
- `frontend/src/features/workflow/utils/workflow-execution-events.ts`

## 4. AI 提示词与规划逻辑更新

AI 创建、修改、规划工作流时，现在知道 5 个 Agent 节点的存在和适用场景。

固定选择规则：

- 代码审查、补丁评估、错误定位：优先 `agent_code_review`。
- 长链研究、资料综述、复杂调研：优先 `agent_deep_research`。
- 最新资讯、新闻追踪、时效主题：优先 `agent_news`。
- 个性化讲解、学习辅导、学习方案：优先 `agent_study_tutor`。
- 页面草案、网页结构、HTML 起稿：优先 `agent_visual_site`。

同时明确：

- Agent 节点不使用主 AI catalog。
- Agent 节点生成时默认不伪造 `model_route`。
- 如果用户没有显式指定子 Agent 模型，`model_route` 保持为空。

关键文件：

- `backend/app/prompts/identity.md`
- `backend/app/prompts/mode_create.md`
- `backend/app/prompts/mode_plan.md`
- `backend/app/prompts/ai_chat_prompts.py`
- `backend/app/nodes/analysis/ai_planner/prompt.md`

## 5. 文档更新

已同步更新项目规范与上下文文档：

- `docs/项目规范与框架流程/项目规范/01-项目架构全景.md`
- `docs/项目规范与框架流程/项目规范/06-节点开发规范.md`
- `docs/项目规范与框架流程/项目规范/07-子后端Agent规范.md`
- `.agent/skills/project-context/SKILL.md`

主要补充内容：

- `agent` 节点类别。
- 5 个 Agent 节点与 5 个子 Agent 的映射。
- Agent 节点模型来源规则。
- Agent 节点 Manifest 约束。
- Agent 节点商店可见性规则。
- skills/MCP 当前只做元数据展示，不进入执行链。

## 6. 测试验证

### 6.1 后端

已运行：

```powershell
python -m pytest backend/tests/test_agent_gateway.py backend/tests/test_node_manifest_contract_property.py backend/tests/test_workflow_engine_property.py -q
```

结果：

```text
32 passed
```

覆盖内容：

- `/api/agents` 返回 enabled Agent 与健康状态。
- `/api/agents/{name}/models` runtime-first 与 registry fallback。
- 5 个 Agent 节点 Manifest。
- `model_source` / `agent_name` 合约。
- Agent 节点 SSE chunk 解析。
- Agent Gateway 错误传播。

### 6.2 前端

先执行：

```powershell
pnpm --dir frontend install
```

用于修复本地缺失的 Rollup optional dependency：

```text
@rollup/rollup-win32-x64-msvc
```

随后运行定向测试：

```powershell
pnpm --dir frontend test -- src/__tests__/node-store-groups.property.test.ts src/__tests__/node-manifest.service.property.test.ts src/__tests__/agent.service.property.test.ts src/__tests__/use-action-executor.property.test.ts src/__tests__/canvas-node-copy.property.test.ts src/__tests__/execution-node-copy.property.test.ts src/__tests__/workflow-store.property.test.ts
```

结果：

```text
7 files passed / 36 tests passed
```

覆盖内容：

- Agent 分组与 5 节点可见性。
- Manifest 新字段。
- Agent 模型服务。
- AI action executor 对新节点类型的支持。
- 节点复制路径对新 Manifest 字段的兼容。

### 6.3 已知剩余问题

执行：

```powershell
pnpm --dir frontend exec tsc --noEmit
```

仍失败，但剩余错误来自既有测试类型问题，不属于本轮 Agent 节点改造直接引入：

- `frontend/src/__tests__/api-client.property.test.ts`
- `frontend/src/__tests__/community-nodes.service.property.test.ts`
- `frontend/src/__tests__/workflow-execution-closure.property.test.ts`
- `frontend/src/__tests__/workflow-service.property.test.ts`

## 7. 当前边界

本轮明确不做以下事项：

- 不做通用 `agent_call` 节点。
- 不允许用户在 Agent 节点里切换绑定到另一个 Agent。
- 不把 Agent 节点模型混入主 AI catalog。
- 不把 skills/MCP 作为可执行开关暴露给用户。
- 不为 5 个 Agent 节点单独做专用 renderer。
- 不把不在 `agents.yaml` 中启用的 Agent 节点提前展示到商店。

## 8. 后续建议

建议下一步优先处理三件事：

1. 清理前端全量 `tsc --noEmit` 的既有测试类型错误，让全量类型检查恢复为可用于 CI 的信号。
2. 对 5 个子 Agent 的 `/v1/models`、`/health/ready`、SSE 输出做真实联调，确认和主后端 Gateway 的协议完全一致。
3. 在 UI 层补一轮 Agent 节点商店文案、模型来源提示、错误态提示，减少用户误以为 Agent 节点可以随意切换主 AI 模型的歧义。
