# Detailed Migration Workflow & Incident Reports

## The Opposite Workflow Violation (Oct 25, 2025)

### Incident

**New incident**: Three migration files existed in the repo but were **NEVER APPLIED TO THE DATABASE**.

This caused:
- ✅ Code expected `version` field on profiles
- ❌ Database returned profiles WITHOUT `version` field
- ❌ Result: "Person object missing version field" errors

**Key insight**: The problem isn't always "DB has it but repo doesn't". It can also be "repo has it but DB doesn't"!

## ✅ CORRECT MIGRATION WORKFLOW (MANDATORY)

```javascript
// Step 1: Write migration SQL file FIRST
Write migration file → supabase/migrations/YYYYMMDDHHMMSS_name.sql

// Step 2: IMMEDIATELY apply to database (within 5 minutes!)
await mcp__supabase__apply_migration({
  name: "fix_name",
  query: <content of .sql file>
});

// Step 3: TEST in database (verify field/RPC exists)
SELECT id, version FROM get_branch_data(NULL, 1, 1);

// Step 4: TEST in app (verify frontend receives field)
// Check console logs, inspect objects

// Step 5: ONLY THEN commit to git
git add supabase/migrations/YYYYMMDDHHMMSS_name.sql
git commit -m "migration: Add version field to RPC"
```

## 🚨 RED FLAGS (STOP IMMEDIATELY)

- ❌ You wrote a migration file but haven't applied it yet
- ❌ Commit message mentions "migration" but RPC doesn't have new field in database
- ❌ Code uses a field that doesn't exist in database RPC
- ❌ RPC signature changed but old function still exists
- ❌ "function is not unique" error (conflicting overloads)

## 🔍 VERIFICATION CHECKLIST

After writing ANY migration:

```javascript
// 1. Verify file exists
ls -la supabase/migrations/YYYYMMDDHHMMSS*.sql

// 2. Verify function/table exists in database
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'your_rpc_name';

// 3. Test the RPC returns expected fields
SELECT id, your_new_field FROM your_rpc();
// Should NOT return error about missing field

// 4. Check frontend doesn't break
// Restart app, check console, verify object structure
```

## 📝 Pre-Migration Checklist

Before EVERY migration:
- [ ] Is this adding a new field to profiles? → Update ALL RPCs that return profiles
- [ ] Is this creating a new RPC? → Test it immediately in database
- [ ] Are you modifying an existing RPC? → Check for old overloaded versions
- [ ] Did you write the .sql file? → Apply to DB within 5 minutes
- [ ] Did you test in database? → Verify field appears in RPC results
- [ ] Did you test in app? → Verify frontend can access field
- [ ] **Are there old versions of this RPC?** → Drop them to avoid "not unique" errors

## Incident Report: Oct 18, 2025

**Problem**: 44+ profiles had incorrect sibling_order values

**Cause**: Applied migration without saving file to repo

**Result**: Full database revert and system redesign required

**Prevention**: This workflow document and pre-commit hooks

📖 **Full Report**: See `/docs/reports/MIGRATION_INCIDENT_OCT2025.md`

## Related Documentation

- [Migration Guide](../MIGRATION_GUIDE.md) - Full migration documentation
- [Pre-Commit Hook Protection](../../.git/hooks/pre-commit) - Automated checks
- [Field Mapping](../FIELD_MAPPING.md) - RPC field maintenance
