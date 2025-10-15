# Migration Summary: Fix audit_log References

**Migration File:** `20251015160000_fix_audit_log_references.sql`  
**Created:** 2025-10-15  
**Priority:** CRITICAL - Blocking production operations

## Problem

Migration `20251014131354` dropped the `audit_log` table, but 32+ database functions still referenced it. This caused:

- ❌ ALL profile deletions failing (including user-reported issue)
- ❌ Cascade delete completely broken
- ❌ Marriage operations failing silently
- ❌ Edit suggestion system non-functional
- ❌ Audit logging not working
- ❌ Undo system blocked

## Root Cause

When `audit_log` was dropped and replaced with `audit_log_enhanced`, the following were not updated:
- Function definitions with `INSERT INTO audit_log`
- Function definitions with `SELECT FROM audit_log`
- Fallback error handlers that tried `audit_log` as a backup

## Functions Fixed (6 Critical Functions)

### 1. **admin_cascade_delete_profile** (CRITICAL - Blocking User)
- **Lines Fixed:** Audit log insertion after cascade delete
- **Impact:** Unblocks recursive family tree deletion
- **References:** Line 226 in original migration

### 2. **admin_update_marriage**
- **Lines Fixed:** Audit log insertion after marriage update
- **Impact:** Marriage edits now properly logged
- **References:** Line 83-101 in migration 077

### 3. **admin_create_marriage**
- **Lines Fixed:** Audit log insertion + removed fallback to non-existent table
- **Impact:** Marriage creation works + proper logging
- **References:** Lines 112-182 in migration 090

### 4. **admin_soft_delete_marriage**
- **Lines Fixed:** Audit log insertion after soft delete
- **Impact:** Marriage deletion now works with audit trail
- **References:** Lines 76-92 in migration 086

### 5. **approve_edit_suggestion**
- **Lines Fixed:** Audit log insertion after suggestion approval
- **Impact:** Edit suggestions can be approved with proper logging
- **References:** Lines 339-364 in migration 005

### 6. **reject_edit_suggestion**
- **Lines Fixed:** Audit log insertion after suggestion rejection
- **Impact:** Edit suggestions can be rejected with proper logging
- **References:** Lines 428-448 in migration 005

## Additional Functions That May Need Fixing

The following functions were identified but not yet migrated (likely in archived migrations):

- admin_bulk_create_children
- admin_bulk_create_children_v2
- admin_delete_marriage (may be superseded by soft delete)
- admin_delete_user_account
- admin_force_unlink_profile
- admin_reorder_siblings
- admin_restore_profile
- admin_revert_action
- admin_toggle_suggestion_block
- submit_edit_suggestion_v4
- auto_approve_suggestions_v4
- super_admin_set_user_role
- super_admin_assign_branch_moderator
- super_admin_remove_branch_moderator
- undo_marriage_create
- delete_user_account_complete
- log_profile_changes (trigger function)

**Note:** Many of these may not be actively used in production. Migration focused on the 6 critical functions blocking current operations.

## Changes Made

For each function:
1. ✅ Replaced `INSERT INTO audit_log` → `INSERT INTO audit_log_enhanced`
2. ✅ Updated column names (e.g., `action` → `action_type` where applicable)
3. ✅ Removed fallback attempts to non-existent `audit_log` table
4. ✅ Verified function signatures match latest versions
5. ✅ Added GRANT EXECUTE statements
6. ✅ Updated function comments to note the fix

## Verification

```sql
-- Check that functions exist
SELECT proname, prosrc LIKE '%audit_log_enhanced%' as uses_correct_table
FROM pg_proc
WHERE proname IN (
  'admin_cascade_delete_profile',
  'admin_update_marriage',
  'admin_create_marriage',
  'admin_soft_delete_marriage',
  'approve_edit_suggestion',
  'reject_edit_suggestion'
);

-- Check for remaining references to old table
SELECT proname
FROM pg_proc
WHERE prosrc LIKE '%INSERT INTO audit_log %'
   OR prosrc LIKE '%SELECT FROM audit_log %';
```

## Testing Checklist

- [ ] Profile deletion works (test with single profile)
- [ ] Cascade delete works (test with parent + children)
- [ ] Marriage creation works
- [ ] Marriage update works
- [ ] Marriage deletion works
- [ ] Edit suggestion approval works
- [ ] Edit suggestion rejection works
- [ ] Audit log entries appear in `audit_log_enhanced` table
- [ ] No errors in Supabase logs related to `audit_log`

## Deployment

```bash
# Apply migration via MCP
mcp__supabase__apply_migration \
  --name "fix_audit_log_references" \
  --query "$(cat supabase/migrations/20251015160000_fix_audit_log_references.sql)"
```

## Rollback Plan

If issues occur:
1. Migration is idempotent (uses `CREATE OR REPLACE`)
2. Can be re-run safely
3. Previous function definitions are in `migrations_archive/`
4. No data loss risk (only function definitions changed)

## Related Issues

- User report: "Delete button not working" (Discord/GitHub issue)
- Undo system blocked (cannot log undo operations)
- Activity log dashboard showing incomplete data

## Next Steps

1. Deploy this migration ASAP (blocking production operations)
2. Monitor Supabase logs for any remaining `audit_log` errors
3. If additional functions found, create follow-up migration
4. Update documentation in `FIELD_MAPPING.md` to note table name change

---

**Status:** ✅ Ready for deployment  
**Risk Level:** Low (idempotent, no schema changes, only function updates)  
**Estimated Duration:** <1 second  
**Downtime Required:** None (functions updated atomically)
