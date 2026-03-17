# MCP Quick Reference

## 文件清单 (File Checklist)

- ✅ `.agent/mcp_config.json` - MCP服务器定义
- ✅ `.env.local` - 环境变量模板（运行setup脚本后自动创建）
- ✅ `.env.local.example` - 环境变量示例文件
- ✅ `MCP_SETUP.md` - 完整的Supabase和GitHub MCP设置指南
- ✅ `CURSOR_MCP_SETUP.md` - Cursor特定的MCP配置指南
- ✅ `.agent/scripts/setup-mcp-init.ps1` - 自动化设置脚本

## 快速启动 (Quick Start)

### 1. 运行初始化脚本
```powershell
cd D:\project\Study_1037Solo\StudySolo
.\.agent\scripts\setup-mcp-init.ps1
```

### 2. 填写环境变量
编辑 `.env.local`：
```
SUPABASE_ACCESS_TOKEN=your_token_here
SUPABASE_PROJECT_ID=your_project_id_here
GITHUB_TOKEN=your_github_token_here
```

### 3. 认证CLI
```powershell
# GitHub已认证（可以跳过）
gh auth status

# Supabase认证
npx supabase@latest login
```

### 4. 配置Cursor的MCP
- 打开 Cursor Settings (Ctrl+,)
- 搜索 "MCP"
- 按照 `CURSOR_MCP_SETUP.md` 中的指示配置服务器

## 获取Token (Get Tokens)

### GitHub Token
- 访问: https://github.com/settings/tokens
- 选择作用域: repo, gist, read:user, workflow
- 复制token到 `.env.local`

### Supabase Token
- 访问: https://app.supabase.com/account/tokens
- 创建新token
- 添加你的项目ID
- 复制token到 `.env.local`

## MCP服务器 (MCP Servers)

| 服务器 | 用途 | 命令 |
|--------|------|------|
| supabase | 数据库、迁移、边函数操作 | `npx @supabase/mcp` |
| github | 仓库、Issues、PR操作 | `npx @octokit/mcp` |
| context7 | Upstash集成 | `npx @upstash/context7-mcp` |
| shadcn | shadcn/ui组件支持 | `npx shadcn@latest mcp` |

## 在Cursor中使用MCP (Using MCP in Cursor)

配置完成后，在Cursor聊天中可以：

```
# Supabase操作
"查询数据库schema"
"创建迁移文件"
"部署边函数"

# GitHub操作
"创建pull request"
"列出issue"
"查看仓库统计"
```

## 故障排查 (Troubleshooting)

| 问题 | 解决方案 |
|------|---------|
| MCP服务器不可用 | 检查token有效性，重启Cursor |
| 环境变量未加载 | 确保.env.local在项目根目录 |
| npx错误 | 运行 `npm cache clean --force` |
| Token无效 | 使用 `gh auth status` 验证 |

## 安全注意事项 (Security)

⚠️ 重要:
- ❌ 不要将 `.env.local` 提交到git
- ❌ 不要在聊天中分享token
- ❌ 定期轮换token
- ✅ 使用最小权限scope
- ✅ 监控token使用情况

## 更多资源

- [MCP完整设置指南](MCP_SETUP.md)
- [Cursor MCP配置指南](CURSOR_MCP_SETUP.md)
- [Supabase CLI文档](https://supabase.com/docs/guides/cli)
- [GitHub CLI手册](https://cli.github.com/manual)
