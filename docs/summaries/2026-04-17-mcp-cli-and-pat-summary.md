# MCP 初版 + CLI 初版 + PAT 认证 + Run API v2 摘要

**日期**：2026-04-17
**完成状态**：✅ 已完成
**相关更新**：`docs/Updates/2026-04-17-mcp-cli-and-pat.md`

---

## 一句话总结

为 StudySolo 引入最初可用的 **Python MCP Server + CLI 双客户端 + PAT 认证 + 节点级事件 REST**，使 Claude Desktop / Cursor 等 MCP Host 与终端都能安全调用「查基本信息 / 额度 / API 数据 / 工作流元信息」与「启动工作流（流式或轮询）」。

---

## 设计要点

### 1. 为什么引入 PAT（不直接复用 Supabase JWT）

| 维度 | Supabase JWT (Cookie) | PAT |
| --- | --- | --- |
| 生命周期 | 短（刷新机制） | 用户自定义 / 永久 |
| 存储 | HttpOnly Cookie | CLI 本地 `config.toml` / MCP Host env |
| 吊销 | 无法单点吊销 | 可按机器独立撤销 |
| 审计 | 需关联会话 | `last_used_at` + `token_prefix` 直接可读 |

结论：CLI / MCP 场景下 PAT 更合适；浏览器仍用 Cookie JWT，两条路径在 `middleware/auth.py` 按前缀分叉。

### 2. 为什么新建 `ss_workflow_run_events` 表

SSE `execute.py` 是「长连接推送」模式，断连即丢事件。CLI / MCP 的轮询场景需要可重放、可分片的事件流：

- `seq` 单调分配 → 客户端只需持有 `after_seq` 即可无损增量
- 仅持久化关键帧（`workflow_status / node_input / node_status / node_done / workflow_done`），不落 token 级 partial，控制写入量
- RLS 与 `ss_workflow_run_traces` 同构：owner + shared 可读

### 3. 为什么 MCP 只做 stdio

- 与 Claude Desktop / Cursor 默认发现方式吻合，无需用户额外开端口
- 本地 JSON-RPC，延迟 < 1ms，轮询 `/events` 0.5s 步长足以模拟「流式」
- HTTP/SSE transport 留作后续 iteration

### 4. 为什么把 `--stream` 与 `--poll` 做成互斥开关

两种形态的**用户意图**不同：
- `--stream` 面向**人**（调试、观察节点一个个跑），0.5s 高频小步
- `--poll` 面向**机器 / 脚本 / CI**（要个进度条和最终输出），N 秒聚合

混合模式会让 UX 碎裂；MCP 的 `run_workflow_and_wait` 参数同理。

---

## 关键实现

| 层 | 实现要点 |
| --- | --- |
| 数据库 | 两张新表、两组 RLS；`seq` 单调由应用层保证（`EventSink.initialise` 读 max） |
| 服务 | `api_token_service.verify_bearer` 失败一律 `None`（简化 401 分支） |
| 中间件 | `_resolve_user` 只按 `sk_studysolo_` 前缀分叉，下游 `get_current_user` 零改动 |
| 后台任务 | `run_to_db` 全 try/except，异常路径也写 `workflow_done` 终态帧 |
| 客户端 | CLI / MCP 各自维护 `client.py`，MVP 暂不抽共享包，避免过早耦合 |
| 进度聚合 | `summarise_progress` 基于最近 200 条事件 + `ss_workflow_runs` 时间戳推导 `elapsed_ms / percent` |

---

## 验证路径

1. **数据库迁移**：`supabase migration up` → 两表出现、RLS 生效。
2. **后端契约**：
   - `POST /api/tokens` → 返回明文 + `token_prefix`；再 `GET /api/tokens` 仅见元数据。
   - 用该 PAT `GET /api/auth/me` 通过。
   - `POST /api/workflow/{id}/runs` → 202 + `run_id`；`GET /progress` + `GET /events` 可观察到 `workflow_done`。
3. **前端**：设置页新增「开发者 / API Token」section，新建一次性明文弹窗正确显示 + 复制。
4. **CLI**：`studysolo login` → `studysolo me` → `studysolo wf run <id> --stream` 有节点事件输出，`--poll` 有进度条 + 终态 JSON。
5. **MCP**：Claude Desktop 配置 `studysolo-mcp` 后，`list_tools` 返回 11 个工具，`get_me` / `run_workflow_and_wait` 工作。

---

## 下一步路线

- HTTP / SSE transport 的 MCP Server
- 细粒度 `scopes`（字段已留）
- 工作流 run 的 `pause / resume / cancel`
- 用户自有模型 API Key（OpenAI / Anthropic 自带 Key 接入）

---

## 相关文件

- 迁移：`supabase/migrations/20260417120000_add_api_tokens_and_run_events.sql`
- 后端：`backend/app/api/tokens.py`、`backend/app/api/workflow/execute.py`、`backend/app/api/workflow/runs.py`、`backend/app/engine/run_worker.py`、`backend/app/middleware/auth.py`、`backend/app/models/api_token.py`、`backend/app/services/api_token_service.py`
- 前端：`frontend/src/services/tokens.service.ts`、`frontend/src/features/settings/components/DeveloperTokens.tsx`、`frontend/src/features/settings/SettingsPageView.tsx`
- 客户端：`packages/cli/`、`packages/mcp-server/`
- Skill：`.agent/skills/studysolo-mcp/SKILL.md`、`.agent/skills/studysolo-cli/SKILL.md`
- 规范：`docs/项目规范与框架流程/项目规范/04-API规范.md`、`docs/项目规范与框架流程/项目规范/02-模块边界规范.md`
- 流程：`docs/项目规范与框架流程/功能流程/MCP与CLI/README.md`
