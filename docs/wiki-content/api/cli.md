---
title: 命令行（studysolo CLI）
description: 使用 studysolo 命令行登录 PAT、查看账户与用量、列出工作流，并以流式或轮询方式启动运行并等待结束。
lastUpdated: 2026-04-17
---

# 命令行（studysolo CLI）

**`studysolo`** 是 StudySolo 官方命令行客户端（Typer + Rich），通过后端 **REST API** 访问与浏览器相同的数据面；认证统一使用 **Personal Access Token（PAT）**，请求头形式为：

`Authorization: Bearer sk_studysolo_…`

## 前置条件

1. Python 环境，并已安装 CLI（开发仓库内常用：`pip install -e packages/cli`）。
2. 在 Web 端 **设置 → 开发者 / API Token** 创建 PAT，并复制一次性明文。

## 安装与登录

```bash
pip install -e packages/cli
studysolo login
```

交互模式下粘贴 PAT 回车即可。PAT 默认写入用户目录下的 `~/.studysolo/config.toml`，权限应为 **600**（仅所有者可读写）。退出登录：

```bash
studysolo logout
```

非交互场景可使用（具体以当前 CLI 实现为准）：

```bash
studysolo login --token sk_studysolo_xxx
```

## 环境变量（覆盖配置文件）

| 变量 | 说明 |
| --- | --- |
| `STUDYSOLO_API_BASE` | 后端 API 根 URL。 |
| `STUDYSOLO_TOKEN` | PAT；若设置，优先级高于配置文件。 |

## 常用命令

### 账户与配额

```bash
studysolo me
studysolo quota
```

### AI 使用数据

```bash
studysolo usage overview --range 7d
studysolo usage timeseries --range 7d --source workflow
studysolo usage live --window 5m
```

### 工作流

```bash
studysolo wf list
studysolo wf show <workflow_id>
studysolo wf manifest
```

### 启动运行并等待结束

两种方式对应不同观测需求：

```bash
# 高频拉取事件，适合终端里「逐条看节点进展」
studysolo wf run <workflow_id> --stream

# 按间隔打印聚合进度，适合脚本或低噪声
studysolo wf run <workflow_id> --poll --interval 5
studysolo wf run <workflow_id> --poll --interval 10 --timeout 1800
```

| 场景 | 建议 |
| --- | --- |
| 本地调试、想看每条节点事件 | `--stream`（内部约 0.5s 步长轮询事件接口） |
| 只关心是否跑完、当前阶段 | `--poll` + 合适 `--interval` |
| CI / 定时任务 | `--poll`，适当增大间隔与 `--timeout` |

底层与 MCP 使用同一套 **Run API v2**：`POST /api/workflow/{id}/runs` 启动，`GET .../progress` 与 `GET .../events` 观测（路径以部署的 OpenAPI/文档为准）。

## 退出码（脚本必读）

| 码 | 含义 |
| --- | --- |
| 0 | 成功，或工作流最终为 `completed`。 |
| 1 | 输入非法、一般请求错误等。 |
| 2 | 未登录或认证失败（如 401）。 |
| 3 | 工作流最终失败，或等待超时。 |

在 shell 脚本中请根据退出码分支处理，不要将 `2` 与 `3` 混为普通失败。

## 错误与排查

- **401**：PAT 无效或已在设置页撤销 → 重新 `login` 或换新 Token。
- **403（模型与会员）**：工作流内模型超出当前 tier → 换模型或升级。
- **429**：配额或限流 → 稍后重试。

与 MCP 共用的 PAT 流程、安全说明与 FAQ 见仓库《MCP 与 CLI 功能流程》文档。
