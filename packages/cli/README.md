# studysolo-cli

StudySolo 命令行工具。支持：

- 查看账户 / 会员 / 工作流配额
- 查看 AI 调用数据（`usage`）
- 查看工作流列表与画布节点元信息
- 启动工作流，支持「实时事件流」与「定时轮询进度」两种输出方式

CLI 使用 StudySolo 后端 REST API，认证走 **Personal Access Token（PAT）**：

> `Authorization: Bearer sk_studysolo_xxx`

## 安装

```bash
pip install -e packages/cli   # 开发
pip install studysolo-cli     # 发布后（暂未上架）
```

## 快速开始

1. 登录 StudySolo 前端，进入 **设置 → 开发者 / API Token**，点「新建 Token」，复制一次性明文。
2. 在终端执行：

```bash
studysolo login
# 粘贴 sk_studysolo_... 回车
```

PAT 会写入 `~/.studysolo/config.toml`（权限 600）。你可以随时用 `studysolo logout` 清理它。

## 常用命令

```bash
studysolo me                             # 基本信息 + 会员 tier
studysolo quota                          # 工作流 / 每日配额
studysolo usage overview --range 7d      # 过去 7 天调用总览
studysolo wf list                        # 工作流列表
studysolo wf show <workflow_id>          # 画布节点元信息
studysolo wf manifest                    # 节点类型清单

# 启动工作流 — 二选一
studysolo wf run <workflow_id> --stream          # 实时打印节点事件
studysolo wf run <workflow_id> --poll --interval 5  # 每 5s 一次，打印阶段进度
```

## 环境变量（可覆盖配置）

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `STUDYSOLO_API_BASE` | 后端地址 | `http://127.0.0.1:2038` |
| `STUDYSOLO_TOKEN` | PAT，优先级高于 config.toml | — |

## 退出码

| 码 | 含义 |
| --- | --- |
| 0 | 成功 |
| 1 | 命令执行错误（输入不合法、请求失败等） |
| 2 | 认证失败 / 未登录 |
| 3 | 工作流运行失败（CLI 等待模式专用） |
