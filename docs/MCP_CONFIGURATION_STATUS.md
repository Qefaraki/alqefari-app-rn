# MCP Configuration Status

## ✅ Successfully Configured

The Supabase MCP has been successfully reconfigured to use the web-based HTTP transport:

**Location**: `~/.claude.json`

**Configuration**:
```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=ezkioroyhzpavmbfavyn"
    },
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp"
    }
  }
}
```

**Status**:
- ✓ Connected to web endpoint
- ⚠ Needs OAuth authentication (will prompt in browser on first use)

## Previous Configuration (Removed)

The old stdio-based configuration was causing DNS resolution errors:
```
npx -y @modelcontextprotocol/server-postgres postgresql://postgres:...@db.ezkioroyhzpavmbfavyn.supabase.co:5432/postgres
```

**Issue**: Could not resolve `db.ezkioroyhzpavmbfavyn.supabase.co`

## Next Steps

1. **Restart Claude Code session** - The new MCP tools will become available
2. **Authentication** - On first query, the web MCP will prompt for OAuth login
3. **Test query** - Verify the MCP works with a simple query

## Commands Used

```bash
# Remove old configuration
claude mcp remove supabase

# Add new web-based configuration
claude mcp add --transport http supabase "https://mcp.supabase.com/mcp?project_ref=ezkioroyhzpavmbfavyn"

# Verify configuration
claude mcp list
claude mcp get supabase
```

## Documentation

- [Claude Code MCP Docs](https://docs.claude.com/en/docs/claude-code/mcp)
- [Supabase MCP Docs](https://supabase.com/docs/guides/getting-started/mcp)

---

**Summary**: The MCP is now properly configured. After restarting Claude Code, you'll be able to run SQL queries via the MCP without needing manual SQL execution in the dashboard.
