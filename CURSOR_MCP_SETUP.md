# Cursor MCP Configuration Guide

This guide explains how to enable and configure MCP (Model Context Protocol) servers in Cursor for Supabase and GitHub integrations.

## Quick Start

### 1. Copy MCP Config to Cursor

Cursor uses a specific MCP configuration file. Copy the configuration:

**Windows (PowerShell)**:
```powershell
# Check Cursor's MCP directory
$cursorMcpDir = "$env:APPDATA\cursor\.codeblob\mcp"
# (or check Cursor's settings > MCP section)
```

**Alternative: Use Cursor's Built-in MCP UI**

1. Open **Cursor Settings** (Ctrl+,)
2. Search for "MCP" or "Model Context Protocol"
3. Look for the MCP servers section
4. Add the following servers:

### 2. Configure Supabase MCP

In Cursor's MCP settings, add:

```json
{
  "name": "supabase",
  "command": "npx",
  "args": ["-y", "@supabase/mcp"],
  "env": {
    "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}",
    "SUPABASE_PROJECT_ID": "${SUPABASE_PROJECT_ID}"
  }
}
```

### 3. Configure GitHub MCP

Add:

```json
{
  "name": "github",
  "command": "npx",
  "args": ["-y", "@octokit/mcp"],
  "env": {
    "GITHUB_TOKEN": "${GITHUB_TOKEN}"
  }
}
```

### 4. Set Environment Variables

**Option A: System Environment Variables**

```powershell
# Set environment variables in Windows
[Environment]::SetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", "your_token", "User")
[Environment]::SetEnvironmentVariable("SUPABASE_PROJECT_ID", "your_project_id", "User")
[Environment]::SetEnvironmentVariable("GITHUB_TOKEN", "your_github_token", "User")

# Restart Cursor to load new variables
```

**Option B: .env.local (in project root)**

Create or update `.env.local`:

```
SUPABASE_ACCESS_TOKEN=your_actual_token
SUPABASE_PROJECT_ID=your_project_id
GITHUB_TOKEN=your_github_token
```

Then ensure Cursor loads this file (usually automatic for Next.js projects).

## Cursor MCP Integration Points

### Access MCP Resources in Chat

Once configured, you can use MCP in your messages:

1. **@supabase** - Access Supabase database operations
2. **@github** - Access GitHub repository operations

### Example Conversations

**With Supabase MCP:**
```
Prompt: Can you check the current database schema for the 'users' table?
(Uses Supabase MCP to query database structure)

Prompt: Show me how many edge functions are deployed
(Uses Supabase MCP to list edge functions)
```

**With GitHub MCP:**
```
Prompt: Create a PR from your_branch to main with these changes
(Uses GitHub MCP to create pull request)

Prompt: List all open issues with the 'bug' label
(Uses GitHub MCP to search issues)
```

## Troubleshooting Cursor MCP

### MCP Not Appearing in Cursor

1. **Check Cursor version**: Make sure you're using a recent version
   ```powershell
   cursor --version
   ```

2. **Restart Cursor**: Close and reopen Cursor completely

3. **Check Cursor logs**:
   ```
   Help > Toggle Developer Tools
   > Console tab
   Look for MCP-related errors
   ```

4. **Verify configuration**: Check that MCP config file is valid JSON

### Environment Variables Not Loading

- Ensure `.env.local` is in project root (where you open Cursor)
- System environment variables require Cursor restart
- Check that variable names match exactly (case-sensitive on Linux/Mac)

### Tokens Not Working

1. Verify token validity:
   - **GitHub**: Test with `gh auth status`
   - **Supabase**: Check token at https://app.supabase.com/account/tokens

2. Check token scopes have required permissions

3. Rotate expired tokens and update configuration

### "MCP Server Failed to Start"

1. Verify npx works:
   ```powershell
   npx supabase@latest --version
   npx @octokit/mcp --help  # (if available)
   ```

2. Check Node.js version (requires 16+):
   ```powershell
   node --version
   ```

3. Clear npx cache:
   ```powershell
   npm cache clean --force
   ```

## Advanced: Custom MCP Server Paths

If you prefer not to use npx, you can install MCPs locally:

```bash
npm install --save-dev @supabase/mcp @octokit/mcp
```

Then update the config to use local paths:

```json
{
  "name": "supabase",
  "command": "node",
  "args": ["node_modules/@supabase/mcp/dist/index.js"]
}
```

## Security Best Practices

⚠️ **Important**:

- Never commit `.env.local` to git (check `.gitignore`)
- Don't share tokens in chat or version control
- Use token scopes that are minimal (don't grant admin if not needed)
- Regularly rotate tokens
- Monitor token usage for unauthorized access

## Next Steps

1. ✅ Run `.\.agent\scripts\setup-mcp-init.ps1`
2. ✅ Update `.env.local` with your tokens
3. ✅ Configure MCP in Cursor settings
4. ✅ Restart Cursor
5. ✅ Authenticate with: `gh auth status` and `npx supabase@latest login`
6. ✅ Start using MCP in your chat!

## Getting Authentication Tokens

### GitHub Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token"
3. Enter a name like "Cursor MCP"
4. Select scopes:
   - `repo` - Full repository access
   - `gist` - Gist operations
   - `read:user` - User profile access
   - `workflow` - Workflow management
5. Click "Generate token" and copy it

### Supabase Token

1. Go to https://app.supabase.com/account/tokens
2. Click "Create new token"
3. Give it a name like "Cursor MCP"
4. Copy the token
5. Add your project ID (visible in project URL)

## Resources

- [Cursor Official Docs](https://docs.cursor.com/)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Supabase Documentation](https://supabase.com/docs)
- [GitHub CLI Manual](https://cli.github.com/manual)
- [GitHub REST API Docs](https://docs.github.com/en/rest)
