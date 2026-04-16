# Agent 分支提交 SOP（团队协作）

> 适用范围：`agents/` 开发与交接、Agent PR 审核、Merge 后主后端对接  
> 最后更新：2026-04-15  
> 目标：让队友可以在主仓里高频并行开发 Agent，只提交 Agent 相关改动，由审核负责人按 README 完成主后端接入

---

## 1. 一句话规则（先看这个）

- Agent 开发在主仓完成，但提交范围要尽量收敛在 `agents/<agent-name>/`。
- 分支命名必须是 `<type>/<description>`，Agent 推荐 `feat/subagent-*`。
- 如果分支已经存在，先切到对应分支再开发，不要在错误分支提交。
- `git add` 必须精确控制，不要直接 `git add .`。
- Agent 开发同学负责代码 + README 对接说明；审核负责人负责评审、Merge、更新 `docs/Updates`、按 README 补主后端接入。

---

## 2. 规范来源与优先级

提交 Agent 分支时，按以下优先级执行：

1. `docs/项目规范与框架流程/项目规范/10-Git与协作规范.md`（分支、commit、PR 规范）
2. `docs/项目规范与框架流程/项目规范/02-模块边界规范.md`（接口冻结与边界规则）
3. `docs/项目规范与框架流程/项目介绍/项目介绍.md`（团队职责）
4. `docs/issues/TeamRefactor/contracts/agent-gateway-contract.md`（冻结契约）
5. `agents/README.md` 与 `docs/项目规范与框架流程/项目规范/07-子后端Agent规范.md`（Agent 实现与测试规范）

---

## 3. 分支操作 SOP（人话版）

## Step 0：先确认你现在在哪个分支

```bash
git status
git branch --show-current
```

如果发现你不在目标分支，不要继续写代码。

## Step 1：如果分支还没创建

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

## Step 2：如果分支已经存在（重点）

```bash
git fetch origin
git checkout feat/subagent-<agent-name>
git pull origin feat/subagent-<agent-name>
```

说明：

- 已有分支不要重复创建，直接切换并同步最新远端。
- 多人共用同一 Agent 分支时，每次开发前都先 `fetch + pull`。

---

## 4. 开发与提交范围（防止误提交）

## Step 3：只改 Agent 相关文件

默认只改：

- `agents/<agent-name>/...`

只有在明确需要时才改：

- `backend/config/agents.yaml`（通常由审核负责人在 merge 后补）
- 少量规范文档（如本 SOP 或该 Agent README）

## Step 4：控制 `git add` 范围（重点）

推荐写法：

```bash
git add agents/<agent-name>/
```

如果本次只改了 README：

```bash
git add agents/<agent-name>/README.md
```

不要直接使用：

```bash
git add .
```

提交前必须检查：

```bash
git status
git diff --cached --name-only
```

看到非预期目录（如 `frontend/`、无关 `backend/`）就先清理再 commit。

---

## 5. Agent README 交接内容（必须写清）

队友提交 Agent PR 时，`agents/<agent-name>/README.md` 必须至少包含以下内容，确保审核负责人可直接对接：

1. Agent 用途与边界（做什么，不做什么）
2. 启动方式（本地运行命令、依赖）
3. 环境变量清单（仅变量名，不写真实密钥）
4. 模型 ID 与端口约定
5. 契约对齐状态（`/health`、`/health/ready`、`/v1/models`、`/v1/chat/completions`）
6. 测试命令与结果（至少含 `test_contract.py`）
7. 给主后端的注册说明（可复制 YAML 片段）

建议模板（可直接放 README）：

```yaml
# 建议补充到 backend/config/agents.yaml 的片段（示例）
agents:
  my-agent:
    url: http://127.0.0.1:800X
    timeout: 45
    max_retries: 2
    api_key_env: AGENT_MY_AGENT_KEY
    models:
      - my-agent-v1
    enabled: false
    description: "..."
    owner: "..."
```

并在 README 明确标注：

`本 PR 不直接改主后端注册表，由审核负责人在 merge 后按本节完成接入。`

---

## 6. 提交、PR、审核、Merge 的接力流程

## Step 5：提交 Commit

```bash
git commit -m "feat(agent): <简要描述>"
git push -u origin feat/subagent-<agent-name>
```

## Step 6：发起 PR（开发同学）

PR 描述必须写清：

- 本 PR 改了哪些路径
- 是否仅包含 `agents/<agent-name>/`（以及 README）
- 测试结果
- 主后端如何对接（README 哪一节）
- 若不改注册表，明确写：`由审核负责人 merge 后补主后端`

## Step 7：审核与分析（审核负责人）

审核负责人至少检查：

- 分支命名和提交范围是否符合规范
- 契约与测试是否达标
- README 交接说明是否可执行
- 是否存在越权跨模块修改

通过后执行 Merge（建议 `Squash and Merge`）。

---

## 7. Merge 后负责人必做（不能漏）

Merge 完 Agent PR 后，审核负责人继续完成以下事项：

1. 按 Agent README 更新主后端接入（通常是 `backend/config/agents.yaml`，必要时补环境变量说明）
2. 在 `docs/Updates/` 追加当日更新记录，说明：
   - 合并了哪个 Agent PR
   - 主后端补了哪些接入项
   - 当前启用状态（`enabled: true/false`）
3. 在 PR 评论或关联说明中补充收尾结论：
   - `Agent 代码已合并`
   - `主后端已完成对接`
   - `后续待办（如有）`

这一步完成后，该 Agent 交付才算闭环。

---

## 8. 最低检查清单（开发 + 审核通用）

- [ ] 当前在正确的 `feat/subagent-*` 分支
- [ ] 若分支已存在，已执行切换与同步
- [ ] `git add` 范围已控制（无无关目录）
- [ ] Agent README 已写完整交接信息
- [ ] `test_contract.py` 与核心测试通过
- [ ] PR 描述写清接力边界（谁在 merge 后补主后端）
- [ ] 审核通过并完成 Merge
- [ ] Merge 后已更新 `docs/Updates` 与主后端接入说明

# Agent 分支提交 SOP（团队协作）

> 适用范围：`agents/`、`backend/config/agents.yaml`、Agent Gateway 契约相关变更  
> 最后更新：2026-04-15  
> 目标：统一“队友如何提交 Agent 分支”的最小可执行流程，避免口径不一致

---

## 1. 规范来源与优先级

提交 Agent 分支时，按以下优先级执行：

1. `docs/项目规范与框架流程/项目规范/10-Git与协作规范.md`（分支、commit、PR 规范）
2. `docs/项目规范与框架流程/项目规范/02-模块边界规范.md`（接口冻结与边界规则）
3. `docs/项目规范与框架流程/项目介绍/项目介绍.md`（团队职责）
4. `docs/issues/TeamRefactor/contracts/agent-gateway-contract.md`（冻结契约）
5. `agents/README.md` 与 `docs/项目规范与框架流程/项目规范/07-子后端Agent规范.md`（Agent 实现与测试规范）

---

## 2. 先说结论：队友应该怎么提 Agent 分支

### 2.1 分支命名（必须）

- 必须采用 `<type>/<description>`，全小写，连字符分隔。
- Agent 相关分支统一推荐：
  - `feat/subagent-<agent-name>`
  - `fix/subagent-<topic>`
  - `feat/agent-gateway-<topic>`（涉及网关逻辑时）
- 不推荐：`agent-xxx`、`wiki` 这种缺少 `type/` 前缀的命名。

示例：

```text
feat/subagent-code-review
feat/subagent-deep-research
feat/subagent-news
feat/agent-gateway-routing-hardening
fix/subagent-sse-done-marker
```

### 2.2 提交流程（必须）

- 禁止直接 commit 到 `main`。
- 所有 Agent 变更必须通过 PR 合并到 `main`。
- PR 至少 1 位 reviewer 批准，且 CI 通过。
- Feature 分支合并默认使用 `Squash and Merge`。

---

## 3. Agent 分支提交 SOP（可直接执行）

## Step 0：立项与边界确认

- 以下改动在写代码前必须先有 Issue 或设计说明（文档先行）：
  - 新增 Agent
  - 修改已冻结契约
  - 新增跨项目接口
  - 调整 Gateway 注册/发现调用约束
- 确认本次 PR 边界：优先只做 Agent 模块，不跨改核心执行引擎。

## Step 1：从 main 创建分支

```bash
git checkout main
git pull origin main
git checkout -b feat/subagent-<agent-name>
```

常见命名建议：

- `code-review-agent` -> `feat/subagent-code-review`
- `deep-research-agent` -> `feat/subagent-deep-research`
- `news-agent` -> `feat/subagent-news`
- `study-tutor-agent` -> `feat/subagent-study-tutor`
- `visual-site-agent` -> `feat/subagent-visual-site`

## Step 2：按目录边界开发

主要允许改动：

- `agents/<agent-name>/...`
- `backend/config/agents.yaml`（注册表）
- 必要的规范文档

如必须跨模块（例如改 `backend/app/services/agent_gateway/`），要在 PR 描述中明确“为什么必须跨改”。

## Step 3：接口契约对齐（四层兼容）

确保 Agent 满足以下契约：

- 端点完整：
  - `GET /health`
  - `GET /health/ready`
  - `GET /v1/models`
  - `POST /v1/chat/completions`
- 请求头兼容：
  - `Authorization`
  - `X-Request-Id`
  - `X-User-Id`（可选）
- 响应兼容：
  - non-stream 标准 `chat.completion`
  - stream 使用 SSE `data: {json}\n\n`，最后 `data: [DONE]\n\n`
- 错误结构与错误码符合冻结契约。

若改动冻结契约（`agent-gateway-contract.md`），必须先三人同步并升级版本，再提交代码 PR。

## Step 4：注册表与运行治理检查

若新增/启用 Agent，更新 `backend/config/agents.yaml`，至少检查：

- `url`
- `timeout`
- `max_retries`
- `api_key_env`
- `models`
- `enabled`
- `description`
- `owner`

同时检查：

- 端口不冲突（8001-8005 已有规划）
- 敏感信息不硬编码，走环境变量
- 日志输出符合 stdout JSON 要求

## Step 5：测试与本地自检

至少执行：

```bash
pytest agents/<agent-name>/tests/ -v
pytest agents/<agent-name>/tests/test_contract.py -v
```

提交前自检：

- 无 `console.log` / `print` / `debugger` 调试残留
- 无密钥、Token、凭证硬编码
- `.env.example` 与文档同步更新

## Step 6：提交 Commit（Conventional Commits）

示例：

```text
feat(agent): add deep-research agent contract-compliant endpoints
fix(agent): align sse done marker with gateway contract
```

## Step 7：提 PR 与合并

- PR 标题使用 `<type>(<scope>): <subject>`（例如 `feat(agent): add news agent basic pipeline`）
- PR 描述写清楚：
  - 改动内容
  - 影响模块
  - 测试结果
  - 风险与回滚点
- 建议带上：`Closes #<issue>`
- 等待 Reviewer + CI 通过后，以 `Squash and Merge` 合并。

---

## 4. 常见错误与纠正

- 错误：`agent-news` 这种裸分支名  
  纠正：`feat/subagent-news`

- 错误：只改代码，不改注册表导致网关不可发现  
  纠正：同步更新 `backend/config/agents.yaml`

- 错误：没跑 `test_contract.py` 就提 PR  
  纠正：契约测试必须作为 Agent PR 的最低门槛

- 错误：直接推 `main`  
  纠正：必须走 Feature 分支 + PR

---

## 5. Agent 分支 PR 最低检查清单

- [ ] 分支名符合 `<type>/<description>`
- [ ] 仅修改本次 Agent 相关目录（跨模块有说明）
- [ ] 四层契约检查完成（端点/请求头/SSE/错误码）
- [ ] `agents.yaml` 注册信息完整（如适用）
- [ ] `tests/` 与 `test_contract.py` 通过
- [ ] 无调试残留，无硬编码密钥
- [ ] PR 模板填写完整，已关联 Issue
- [ ] 至少 1 位 Reviewer 批准 + CI 通过

