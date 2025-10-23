# Migration Incident Report - October 18, 2025

## Incident Summary

**Date**: October 18, 2025
**Severity**: 🔴 HIGH (Data integrity impact)
**Status**: Resolved with preventive measures

## Impact

- **Affected**: 44+ children across 11 families
- **Issue**: Migration applied via MCP without creating `.sql` file in repository
- **Consequence**: Incorrect `sibling_order` values, user complaints, system redesign required
- **Resolution Time**: ~4 hours debugging and fixing

## Root Cause

Migration was applied directly to database using `mcp__supabase__apply_migration` tool without:
1. Creating `.sql` file in `supabase/migrations/` directory
2. Tracking migration in version control
3. Saving migration for reproducibility on other environments

**The workflow violation**: Database updated, code not tracked.

## Timeline

1. **Applied Migration**: `20251018184900_bulk_fix_duplicate_sibling_orders` (MCP only, no file)
2. **Database State**: ✅ Migration applied
3. **Repository State**: ❌ No migration file
4. **Code Commits**: ✅ Feature code committed (but migration missing)
5. **Result**: Breakage on other environments, unable to rollback cleanly

## Consequences

### Immediate
- Incorrect sibling ordering for 44+ children
- User complaints about data inconsistency
- Emergency debugging required

### Recovery
Required **3 migrations** to fix:
- `20251018200000_revert_sibling_order_bulk_fix.sql` (the revert)
- `20251018200001_remove_sibling_order_unique_constraint.sql` (constraint fix)
- System-wide review and redesign

## Preventive Measures Implemented

### 1. **Mandatory Workflow Documentation**
Updated CLAUDE.md with explicit workflow:
```
1. Write tool → supabase/migrations/YYYYMMDDHHMMSS_name.sql  [FIRST!]
2. mcp__supabase__apply_migration                            [SECOND]
3. Test the feature locally                                   [VERIFY]
4. Git commit                                                 [TRACK]
```

### 2. **Pre-Commit Hook**
Added `.git/hooks/pre-commit` that:
- Checks if commit message contains "migration"
- Verifies `.sql` files are being committed if so
- **Blocks the commit** if migration mentioned but no `.sql` files found

### 3. **Pre-Commit Checklist**
Developers must verify before EVERY commit:
```bash
git status | grep "supabase/migrations"
# If migration mentioned but no .sql file → STOP!
```

### 4. **Clear Incident Documentation**
This report serves as permanent record and warning.

## Files Related to Incident

### Applied but Not Committed
- `20251018184900_bulk_fix_duplicate_sibling_orders_APPLIED_NOT_COMMITTED.sql`

### Recovery Migrations
- `20251018200000_revert_sibling_order_bulk_fix.sql`
- `20251018200001_remove_sibling_order_unique_constraint.sql`

## Lessons Learned

### Critical Rule
> **🚨 ALWAYS write the .sql file FIRST, then apply via MCP. Never apply migrations to database without tracking them in version control.**

### Best Practice
- **All migrations use MCP only** (no CLI commands)
- **File-first workflow** prevents synchronization issues
- **Pre-commit hooks catch violations** before they propagate
- **Version control is source of truth** for all schema changes

## Recommended Reading

- See `CLAUDE.md` section: "🚨🚨🚨 CRITICAL: ALWAYS WRITE THE FILE FIRST! 🚨🚨🚨"
- See `CLAUDE.md` section: "📋 Pre-Commit Checklist (MANDATORY)"
- See `CLAUDE.md` section: "🚫 Pre-Commit Hook Protection"

## Prevention Checklist

Before applying ANY migration:
- [ ] `.sql` file created in `supabase/migrations/`
- [ ] File follows naming convention: `YYYYMMDDHHMMSS_descriptive_name.sql`
- [ ] File contains complete, standalone SQL
- [ ] File readable and no syntax errors
- [ ] Change is appropriate for this migration (not mixing concerns)

Before committing ANY code:
- [ ] Check `git status` for untracked `.sql` files
- [ ] If commit message mentions "migration", confirm `.sql` files are staged
- [ ] Pre-commit hook passes (or error is understood and intentional)

## Never Again

This incident drove significant changes to prevent recurrence:
- Mandatory documentation of workflow
- Automated pre-commit protection
- Clear, enforced best practices

**Status**: Resolved ✅
**Risk of Recurrence**: Minimal (with enforcement)
