---
name: studysolo-cli
description: StudySolo 官方命令行工具 studysolo 的使用指南。当用户在终端里想要查看账户 / 额度 / AI 使用数据 / 工作流，或通过命令行触发工作流并选择「实时流式」或「定时轮询」两种输出方式时，必须参考此技能。
triggers:
  - "studysolo cli"
  - "StudySolo 命令行"
  - "终端.*StudySolo"
  - "CLI.*工作流"
  - "studysolo wf run"
  - "命令行.*跑.*工作流"
allowed-tools: Read, Shell
version: 1.0
priority: HIGH
---

# studysolo-cli — StudySolo 命令行工具使用技能

## 1. 技能目标

告诉 AI：在终端里，如何用 `studysolo` 命令完成以下任务：

- **登录 / 登出**：保存 PAT 到 `~/.studysolo/config.toml`
- **查看账户 / 会员 / 额度**：`studysolo me` / `studysolo quota`
- **查看 AI 调用数据**：`studysolo usage overview|timeseries|live`
- **查看工作流**：`studysolo wf list` / `studysolo wf show <id>` / `studysolo wf manifest`
- **启动并等待工作流**：`studysolo wf run <id> --stream|--poll`

## 2. 必读物

| 顺序 | 路径 | 为什么必读 |
| --- | --- | --- |
| 1 | `packages/cli/README.md` | 命令清单 + 退出码语义 |
| 2 | `docs/项目规范与框架流程/功能流程/MCP与CLI/README.md` | PAT 流程、安全边界 |
| 3 | `docs/项目规范与框架流程/项目规范/04-API规范.md` §「PAT」「Run API v2」 | 权威定义 |

## 3. `--stream` vs `--poll` 决策

| 场景 | 选择 | 原因 |
| --- | --- | --- |
| 用户要在终端「看到节点一个个跑完」 | `--stream` | 0.5s 小步轮询，打印 `node_input / node_status / node_done` 明细 |
| 只关心「跑完没 / 到哪步了 / 最终输出」 | `--poll --interval 5` | 每 5 秒打印一次聚合进度条，结束时一次性展示 `workflow_done` |
| CI / 自动化脚本 | `--poll --interval 10 --timeout 1800` | 低频、低噪、可预测 |
| 人工交互式调试 | `--stream` | 事件密度对调试最友好 |

## 4. 常用命令速查

```bash
# 登录（粘贴 PAT）
studysolo login
studysolo login --token sk_studysolo_xxx  # 非交互模式

# 账户
studysolo me
studysolo quota

# 使用数据
studysolo usage overview --range 7d
studysolo usage timeseries --range 7d --source workflow
studysolo usage live --window 5m

# 工作流
studysolo wf list
studysolo wf show <workflow_id>
studysolo wf manifest

# 启动工作流
studysolo wf run <workflow_id> --stream            # 默认
studysolo wf run <workflow_id> --poll --interval 5 # 轮询
studysolo wf run <workflow_id> --poll --timeout 1800
```

## 5. 退出码语义（脚本化必读）

| 退出码 | 含义 |
| --- | --- |
| `0` | 成功（或工作流最终 completed） |
| `1` | 请求 / 输入错误 |
| `2` | 未登录或认证失败（401/403） |
| `3` | 工作流最终 status=failed，或等待超时 |

## 6. 约束（MUST / MUST NOT）

- **MUST**：PAT 通过 `studysolo login` 保存，或 `STUDYSOLO_TOKEN` 环境变量注入；不要把 PAT 写在 shell history 或命令行参数（易被日志收集到）。
- **MUST**：`--stream` 与 `--poll` 互斥，默认为 `--stream`。
- **MUST NOT**：不要把 `~/.studysolo/config.toml` 提交到仓库。
- **MUST NOT**：不要对同一 workflow 短时间反复 `wf run`，后端 rate-limit 会返回 429。

## 7. 典型 AI 助手回答脚本

用户：「跑一下 abcd-1234 工作流，跑完告诉我结果」

AI 应执行：

```powershell
studysolo wf show abcd-1234          # 先确认存在 + 节点结构
studysolo wf run abcd-1234 --poll --interval 5 --timeout 900
# 观察最后的 workflow_done JSON 面板提取关键字段给用户
```

用户：「我今天还能跑几次？」

```powershell
studysolo quota
# 从 daily_executions_remaining 读值
```
