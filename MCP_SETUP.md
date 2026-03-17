# Supabase & GitHub MCP Integration Guide

This guide explains how to set up and use Supabase and GitHub MCP (Model Context Protocol) integrations with your StudySolo project.

## Overview

MCP (Model Context Protocol) enables AI assistants to interact with external systems like Supabase and GitHub through standardized interfaces. This setup allows Claude/Copilot to:

- **Supabase**: Execute database queries, manage migrations, deploy edge functions, manage authentication
- **GitHub**: Create/update pull requests, manage issues, search repositories, manage workflows

## Prerequisites

- **GitHub CLI**: [Install from https://cli.github.com/](https://cli.github.com/)
- **Node.js**: Version 16+ (for using supabase via npx)
- **Cursor or VS Code**: With MCP support enabled
- **GitHub Account**: For authentication
- **Supabase Account**: For database operations

## Quick Setup

### 1. Run the Setup Script

```powershell
cd .agent/scripts
.\setup-mcp.ps1
```

This script will:
- ✓ Verify GitHub CLI installation
- ✓ Check Supabase CLI availability
- ✓ Prompt for GitHub authentication (if needed)
- ✓ Create `.env.local` template
- ✓ Display configuration summary

### 2. Configure Environment Variables

Copy the example file and fill in your tokens:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add:

#### GitHub Token
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `gist`, `read:user`, `workflow`
4. Copy the token and paste into `.env.local`

#### Supabase Access Token
1. Go to https://app.supabase.com/account/tokens
2. Create a new token with appropriate scopes
3. Copy and paste into `.env.local`
4. Add your Supabase project ID (from your project URL)

### 3. Authenticate CLI Tools

#### GitHub CLI

```bash
gh auth login
# Follow the prompts to authenticate with GitHub
# Verify: gh auth status
```

#### Supabase CLI

```bash
npx supabase@latest login
# This opens your browser to authenticate
# Your session is saved locally for future use
```

## Configuration Files

### `.agent/mcp_config.json`

Defines the MCP servers available to your AI assistant:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}",
        "SUPABASE_PROJECT_ID": "${SUPABASE_PROJECT_ID}"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@octokit/mcp"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### `.env.local`

Contains sensitive environment variables loaded at runtime. **Never commit this file to git.**

## Using MCP Features

### Supabase MCP Capabilities

Once configured, you can ask Claude/Copilot to:

```
"查询 users 表中所有用户"
"创建一个新的数据库迁移"
"部署 edge function 到 Supabase"
"查看当前项目的 RLS 策略"
"从 Supabase 导出数据"
```

### GitHub MCP Capabilities

You can request operations like:

```
"创建一个 pull request"
"列出所有未关闭的 issues"
"查找包含 bug 标签的 issues"
"更新 PR 描述"
"查询 repository 统计信息"
"创建新的分支"
```

## Troubleshooting

### "GitHub CLI not found"

Install GitHub CLI from: https://cli.github.com/

**Windows (Scoop)**:
```powershell
scoop install gh
```

**Windows (Chocolatey)**:
```powershell
choco install gh
```

### "Supabase token invalid"

1. Verify token at https://app.supabase.com/account/tokens
2. Ensure it has `Project API Access` scope
3. Check expiration date (tokens can expire)
4. Generate a new token and update `.env.local`

### "GITHUB_TOKEN not recognized"

1. Ensure `.env.local` is in project root directory
2. Verify the token has correct scopes (repo, gist, read:user)
3. Check that the token is not expired
4. Run `gh auth status` to verify CLI authentication

### "MCP server not responding"

Try one of these:

```bash
# Verify Cursor/VS Code has MCP support enabled
# Check MCP logs in your editor's output panel
# Restart your editor
```

## Security Notes

⚠️ **Important**:

- Never commit `.env.local` to git (it's in `.gitignore`)
- Rotate tokens regularly (especially GitHub tokens)
- Use minimal scopes (don't grant admin access if not needed)
- Monitor token usage for unauthorized access
- Consider using environment-specific tokens:
  - Development: Limited read-only access
  - Production: Full access, stored securely

## Environment Variables Reference

| Variable | Purpose | Source |
|----------|---------|--------|
| `SUPABASE_ACCESS_TOKEN` | Authenticate Supabase API calls | https://app.supabase.com/account/tokens |
| `SUPABASE_PROJECT_ID` | Target Supabase project | From your project URL |
| `GITHUB_TOKEN` | Authenticate GitHub API calls | https://github.com/settings/tokens |
| `UPSTASH_API_KEY` | Optional: Upstash integration | https://console.upstash.com/ |

## Next Steps

1. ✅ Run setup script
2. ✅ Configure environment variables
3. ✅ Authenticate both CLI tools
4. ✅ Verify in Cursor: Open chat and try a Supabase/GitHub operation
5. ✅ Start using MCP features in your workflows!

## Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [GitHub CLI Manual](https://cli.github.com/manual)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)

---

For questions or issues, check the project's main README or consult the MCP server logs in your editor.
