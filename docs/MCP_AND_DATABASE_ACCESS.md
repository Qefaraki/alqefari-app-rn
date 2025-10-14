# Database Access Methods

## Current Status: CLI-Only Workflow

### MCP Server Issue
The Supabase MCP server is experiencing DNS resolution issues:
```
Error: getaddrinfo ENOTFOUND db.ezkioroyhzpavmbfavyn.supabase.co
```

**Root Cause**: The MCP server cannot resolve the Supabase database hostname.

### Web MCP Alternative (Suggested by Supabase)
Supabase documentation suggests using the web-based MCP:
```json
{
  "mcpServers": {
    "supabase": {
      "url": "https://mcp.supabase.com/mcp?project_ref=ezkioroyhzpavmbfavyn"
    }
  }
}
```

**Note**: Claude Code CLI's MCP configuration location and method differs from Claude Desktop. The configuration method for Claude Code CLI is not currently documented for URL-based MCP servers.

## ✅ Working Solution: Supabase CLI

Since MCP is unreliable, **use the Supabase CLI exclusively** for all database operations:

### For Migrations
```bash
# Create migration
supabase migration new feature_name

# Push to remote
supabase db push

# Check status
supabase migration list
```

### For Direct SQL Execution (When Needed)
When you absolutely need to run SQL directly (rare cases):

**Option 1: Supabase Dashboard (Recommended)**
1. Go to: https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn
2. Click "SQL Editor" in left sidebar
3. Paste and run SQL
4. Copy result

**Option 2: CLI with File**
```bash
# Write SQL to file
echo "SELECT * FROM profiles LIMIT 1;" > /tmp/query.sql

# Execute via CLI (if supported in newer versions)
supabase db execute -f /tmp/query.sql
```

**Option 3: psql (Advanced)**
```bash
# Get connection string from Supabase dashboard
psql "postgresql://postgres:[password]@db.ezkioroyhzpavmbfavyn.supabase.co:5432/postgres"
```

## Best Practices

1. **Prefer migrations** for schema changes
2. **Use CLI** for deployment
3. **Use Dashboard** for one-off queries or debugging
4. **Never manually edit** production database outside of tracked migrations
5. **Always test** locally if possible (requires Docker)

## Troubleshooting

### CLI Connection Issues
- Verify project link: `supabase link --project-ref ezkioroyhzpavmbfavyn`
- Check authentication: `supabase login`
- Test connection: `supabase migration list`

### MCP Connection Issues
- MCP is not reliable for this project
- Don't depend on it for critical operations
- Use CLI or Dashboard instead
