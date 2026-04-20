# Agent 分支提交 SOP（团队协作）

> 适用范围：`agents/` 开发与交接、Agent PR 审核、Merge 后 Gateway 接入、Agent 工作流节点兼容验收
> 最后更新：2026-04-16
> 编码要求：UTF-8 无 BOM + LF
> 目标：让队友可以在主仓里高频并行开发 Agent，同时确保要暴露到工作流画布的 Agent 完成“子后端 + Gateway + 前端工作流节点”的完整产品化闭环。

---

## 1. 一句话规则

- Agent 开发在主仓完成，但开发分支默认只提交 `agents/<agent-name>/` 及该 Agent README。
- 分支命名必须是 `<type>/<description>`，Agent 推荐 `feat/subagent-*`。
- `git add` 必须精确控制，不要直接 `git add .`。
- 开发同学负责 Agent 代码、契约测试、README 交接说明。
- 审核负责人负责评审、Merge、Gateway 接入、`docs/Updates` 记录，以及必要的工作流节点兼容验收。
- 如果 Agent 要暴露到工作流画布，未完成节点兼容验证，不得在 PR、Updates 或阶段总结中声明“产品化交付完成”。

---

## 2. 规范来源与优先级

提交 Agent 分支时，按以下优先级执行：

1. `docs/项目规范与框架流程/项目规范/10-Git与协作规范.md`（分支、commit、PR 规范）
2. `docs/项目规范与框架流程/项目规范/02-模块边界规范.md`（接口冻结与边界规则）
3. `docs/issues/TeamRefactor/contracts/agent-gateway-contract.md`（冻结契约）
4. `agents/README.md` 与 `docs/项目规范与框架流程/项目规范/07-子后端Agent规范.md`（Agent 实现与测试规范）
5. `docs/项目规范与框架流程/功能流程/新增AI工具/00-节点与插件分类判断.md`（工作流节点分类边界）

如需修改冻结契约，必须先完成团队同步和契约版本升级，再提交代码 PR。

---

## 3. 分支创建、同步与提交范围

### Step 0：确认当前分支

```bash
git status
git branch --show-current
```

如果发现不在目标分支，不要继续写代码。

### Step 1：创建新分支

```bash
git checkout main
git pull origin main
git checkout -b feat/subagent-<agent-name>
```

推荐命名：

- `feat/subagent-code-review`
- `feat/subagent-deep-research`
- `feat/subagent-news`
- `feat/subagent-study-tutor`
- `feat/subagent-visual-site`

### Step 2：同步已有分支

```bash
git fetch origin
git checkout feat/subagent-<agent-name>
git pull origin feat/subagent-<agent-name>
```

已有分支不要重复创建。多人共用同一 Agent 分支时，每次开发前都先 `fetch + pull`。

### Step 3：控制修改范围

默认只改：

- `agents/<agent-name>/...`

只有在明确需要时才改：

- `backend/config/agents.yaml`（通常由审核负责人在 Merge 后补）
- `agents/<agent-name>/README.md`
- 必要规范文档

如必须跨模块修改 `backend/app/services/agent_gateway/`、`backend/app/nodes/agent/` 或 `frontend/`，必须在 PR 描述中说明原因、影响范围和验证结果。

### Step 4：精确提交

推荐写法：

```bash
git add agents/<agent-name>/
```

如果本次只改 README：

```bash
git add agents/<agent-name>/README.md
```

提交前必须检查：

```bash
git status
git diff --cached --name-only
```

看到非预期目录（如无关 `frontend/`、无关 `backend/`、本地临时文件）必须先清理再 commit。

---

## 4. Agent README 交接模板

队友提交 Agent PR 时，`agents/<agent-name>/README.md` 必须至少包含以下内容，确保审核负责人可以直接接手：

1. Agent 用途与边界（做什么，不做什么）
2. 启动方式（本地运行命令、依赖）
3. 环境变量清单（只写变量名，不写真实密钥）
4. 模型 ID 与端口约定
5. 契约对齐状态（`/health`、`/health/ready`、`/v1/models`、`/v1/chat/completions`）
6. 测试命令与结果（至少包含 `test_contract.py`）
7. Gateway 注册说明（可复制 YAML 片段）
8. 是否暴露到工作流画布

工作流画布交接字段必须明确写出：

```yaml
workflow_exposure:
  expose_to_workflow: true
  agent_name: my-agent
  target_node_type: agent_my_agent
  models:
    - my-agent/default
  capabilities:
    - "一句话能力标签"
  endpoint_contract:
    health: ready
    health_ready: ready
    models: ready
    chat_completions: ready
  node_compatibility_plan: "需要新增固定 Agent 节点，或复用已有固定节点并完成验收"
```

如果不暴露到工作流画布，必须明确写：

```yaml
workflow_exposure:
  expose_to_workflow: false
  reason: "仅作为内部子后端能力，不进入工作流节点商店"
```

Gateway 注册片段建议写法：

```yaml
agents:
  my-agent:
    url: http://127.0.0.1:800X
    timeout: 45
    max_retries: 2
    api_key_env: AGENT_MY_AGENT_KEY
    models:
      - my-agent/default
    enabled: false
    description: "..."
    owner: "..."
```

如果本 PR 不直接改主后端注册表，README 必须写明：

```text
本 PR 不直接改主后端注册表，由审核负责人在 Merge 后按本节完成 Gateway 接入与必要的工作流节点兼容验收。
```

---

## 5. PR 描述模板

PR 描述必须写清：

- 本 PR 修改了哪些路径
- 是否仅包含 `agents/<agent-name>/` 及 README
- 契约测试命令与结果
- Gateway 如何对接，README 哪一节可复制
- `expose_to_workflow` 是 `true` 还是 `false`
- 如果 `expose_to_workflow=true`，目标节点类型是什么
- 如果不改注册表，明确写：`由审核负责人 Merge 后补 Gateway 接入`
- 风险、回滚点、后续待办

PR 标题使用 Conventional Commits：

```text
feat(agent): add news agent contract-compliant endpoints
fix(agent): align sse done marker with gateway contract
```

---

## 6. 审核检查

审核负责人至少检查：

- 分支命名是否符合 `<type>/<description>`
- 修改范围是否收敛，跨模块修改是否有说明
- 四层契约是否达标
- `test_contract.py` 与核心测试是否通过
- README 交接说明是否可执行
- 是否存在硬编码密钥、Token、凭证
- 是否存在调试残留
- `workflow_exposure` 是否明确

通过后执行 Merge，建议使用 `Squash and Merge`。

---

## 7. Merge 后负责人必做

Merge 完 Agent PR 后，审核负责人必须继续完成收尾。只合并 Agent 代码不等于交付完成。

### 7.1 Agent 服务闭环

无论是否暴露到工作流画布，都必须完成：

- 按 Agent README 更新 `backend/config/agents.yaml`，必要时补环境变量说明。
- 确认 `enabled` 状态符合当前发布策略。
- 确认 `/api/agents` 能返回该 Agent。
- 确认 `/api/agents/{name}/models` 能返回模型。
- 确认模型来源是运行时 `/v1/models` 或注册表 fallback，且结果符合 README。
- 在 `docs/Updates/` 追加当日更新记录。
- 在 PR 评论或关联说明中补充收尾结论。

`docs/Updates/` 记录至少包含：

- 合并了哪个 Agent PR
- Gateway 补了哪些接入项
- 当前启用状态（`enabled: true/false`）
- 是否暴露到工作流画布
- 如果没有完成工作流节点产品化，明确写“尚未产品化交付”

### 7.2 工作流节点产品化闭环

仅当 `workflow_exposure.expose_to_workflow=true` 时强制执行。

必须确认：

- `/api/nodes/manifest` 中存在目标节点。
- Manifest 输出 `category='agent'`。
- Manifest 输出 `model_source='agent'`。
- Manifest 输出正确的 `agent_name`。
- 默认节点商店出现 `Agent` 分组和目标节点。
- `NodeModelSelector` 只读取 `/api/agents/{agent_name}/models`。
- Agent 节点模型列表不混用主 AI catalog。
- NodeConfig 显示 Agent 健康状态、模型来源、capabilities、skills/MCP ready 状态。
- 最小工作流可以执行：`trigger_input -> <agent_node>`。
- 执行 Trace 能显示实际解析后的子 Agent 模型。
- AI 创建/修改工作流提示词知道该节点的适用场景。

未完成以上检查时，不得在 PR、`docs/Updates/` 或阶段总结中写“该 Agent 已完成产品化交付”。

### 7.3 现有 5 个固定 Agent 的处理

现有固定 Agent 包括：

- `code-review` -> `agent_code_review`
- `deep-research` -> `agent_deep_research`
- `news` -> `agent_news`
- `study-tutor` -> `agent_study_tutor`
- `visual-site` -> `agent_visual_site`

这 5 个 Agent 的 Merge 后重点是：

- 注册信息正确
- 健康检查正确
- 模型发现正确
- 目标节点在 Agent 分组可见
- 最小工作流执行通过

通常不需要新增前端类型，但仍必须做节点兼容验收。

### 7.4 未来新增第 6 个 Agent 的处理

未来新增 Agent 如果要暴露到工作流画布，必须新增固定 Agent 节点，不允许先做通用 `agent_call` 节点绕过规范。

必须同步完成：

- 后端固定节点包：`backend/app/nodes/agent/<node_type>/`
- `frontend/src/types/workflow.ts` 中的 `NodeType`
- `workflow-meta.ts` 中的节点 meta 和视觉分类
- Node Store 的 `Agent` 分组映射
- `NodeModelSelector` 的 Agent 模型来源兼容
- NodeConfig Agent 信息展示
- AI 创建/修改/规划提示词
- Manifest、执行链路和前端定向测试

---

## 8. 常见错误与纠正

| 错误 | 风险 | 纠正 |
|------|------|------|
| 只合并 Agent 代码，不补 `agents.yaml` | Gateway 不可发现 | Merge 后补注册表并验证 `/api/agents` |
| README 没写 `expose_to_workflow` | 审核负责人无法判断是否要做前端闭环 | README 必须补工作流暴露字段 |
| Agent 节点使用主 AI catalog 模型 | 模型来源串线，用户选择错误 | Agent 节点必须用 `model_source='agent'` |
| 节点商店不可见却宣称交付完成 | 用户无法使用 | 验证 Node Store Agent 分组和目标节点 |
| Trace 不显示实际模型 | 执行结果不可审计 | 验证 `resolved_model_route` 写入 Trace |
| 新增第 6 个 Agent 直接复用通用节点 | 打破固定映射边界 | 新增固定 Agent 节点类型 |
| 直接 `git add .` | 容易误提交无关前端/后端文件 | 使用精确路径 add |

---

## 9. 最低检查清单

### 开发同学提交前

- [ ] 当前在正确的 `feat/subagent-*` 分支
- [ ] 若分支已存在，已执行切换与同步
- [ ] `git add` 范围已控制，无无关目录
- [ ] Agent README 已写完整交接信息
- [ ] README 已明确 `expose_to_workflow`
- [ ] `test_contract.py` 与核心测试通过
- [ ] 无调试残留
- [ ] 无硬编码密钥、Token、凭证
- [ ] PR 描述写清接力边界

### 审核负责人 Merge 前

- [ ] 分支命名符合规范
- [ ] 修改范围符合边界
- [ ] 契约与测试达标
- [ ] README 可直接执行
- [ ] `workflow_exposure` 字段明确
- [ ] 至少 1 位 Reviewer 批准
- [ ] CI 通过

### 审核负责人 Merge 后

- [ ] 已更新 `backend/config/agents.yaml`
- [ ] 已确认 `/api/agents` 可见
- [ ] 已确认 `/api/agents/{name}/models` 可用
- [ ] 已记录 `docs/Updates`
- [ ] 已在 PR 评论或关联说明中补收尾结论
- [ ] 如 `expose_to_workflow=false`，已明确“不进入工作流产品化”
- [ ] 如 `expose_to_workflow=true`，已完成工作流节点产品化闭环

---

## 10. 交付口径

交付结论必须使用以下口径之一：

```text
Agent 服务已合并，Gateway 接入完成，未暴露到工作流画布。
```

```text
Agent 服务已合并，Gateway 接入完成，工作流节点产品化闭环已完成。
```

```text
Agent 服务已合并，但 Gateway 或工作流节点产品化仍有待办，不得声明完整交付。
```
