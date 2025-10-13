# Database Migration Guide

Comprehensive guide to all database migrations for the Alqefari Family Tree app.

## Critical Migrations for Permission System

### Migration 005: Family Edit Permissions System
**File**: `migrations/005_family_edit_permissions_system.sql`

Creates the foundation for granular edit permissions:
- **Tables Created**:
  - `profile_suggestions` - Edit suggestions from non-admins
  - `profile_link_requests` - Requests to link new family members
- **Functions Created**:
  - `get_pending_suggestions()` - View pending edits
  - `approve_suggestion()` - Approve and apply edits
  - `reject_suggestion()` - Reject with notes
  - `get_pending_link_requests()` - View link requests
  - `approve_link_request()` - Approve connections
  - `reject_link_request()` - Reject with reason
- **Columns Added to profiles**:
  - `can_edit` - BOOLEAN (deprecated)
  - `is_moderator` - BOOLEAN
  - `moderated_branch` - TEXT (HID of branch)

### Migration 006: Super Admin Permissions
**File**: `migrations/006_super_admin_permissions.sql`

Adds super admin role and management functions:
- **Functions Created**:
  - `grant_admin_role()` - Promote user to admin
  - `revoke_admin_role()` - Demote admin to user
  - `grant_moderator_role()` - Assign branch moderator
  - `revoke_moderator_role()` - Remove moderator
  - `super_admin_search_by_name_chain()` - Search with ancestry
- **Important Notes**:
  - Renamed search function to avoid collision
  - Only super_admin can call role management functions
  - All functions include authorization checks

### Migration 077: Admin Update Marriage RPC
**File**: `migrations/077_admin_update_marriage.sql`

Secure RPC function for updating marriage records with permission checks:
- **Function Created**: `admin_update_marriage(p_marriage_id UUID, p_updates JSONB)`
- **Features**:
  - Permission check: User must have admin/moderator/inner permission on either spouse
  - Validates status values (only 'current' or 'past' allowed after migration 078)
  - Creates audit log entry for all changes
  - Uses whitelist approach for security
- **Important Notes**:
  - Replaces direct UPDATE on marriages table (blocked by RLS)
  - Includes DROP FUNCTION to avoid parameter name conflicts
  - Validates date fields and status values

### Migration 078: Simplify Marriage Status Values
**File**: `migrations/078_simplify_marriage_status.sql`

**Status**: ✅ Deployed (January 2025)

Replaces stigmatizing marriage status terms with neutral language:
- **Old Values**: `'married'`, `'divorced'`, `'widowed'`
- **New Values**: `'current'` (حالي), `'past'` (سابق)

**Changes**:
1. Updates all existing records: married→current, divorced/widowed→past
2. Drops old constraint, adds new constraint accepting only current/past
3. Updates default value to 'current'
4. Adds documentation comment explaining the change

**Why This Migration**:
- Removes cultural stigma from marriage status terminology
- Simplifies UI (2 options instead of 3)
- More neutral and inclusive language

**App Code Updates Required**:
When this migration is deployed, **all app references to marriage status must be updated**:

Critical Files Updated (committed 2a7cde41f, ad643c193):
- ✅ `TabFamily.js` - Spouse filters and display
- ✅ `EditChildModal.js` - Mother selection
- ✅ `EditMarriageModal.js` - Status options (already done)
- ✅ `InlineSpouseAdder.js` - Default status on creation
- ✅ `profiles.js` - Default status in createMarriage
- ✅ `SpouseEditor.js` - Status options and logic
- ✅ `FatherSelectorSimple.js` - Status filter
- ✅ `MotherSelector.js` - is_current derivation
- ✅ Test files - Mock data updated

**Backward Compatibility**: App code now supports both old and new values during transition period.

**Common Issue**: If wives disappear after migration, check that spouse filters accept both 'current' AND 'married' values:
```javascript
// ✅ Correct
const activeSpouses = spouses.filter(s => s.status === 'current' || s.status === 'married');

// ❌ Wrong (causes wives to disappear)
const activeSpouses = spouses.filter(s => s.status === 'married');
```

### Migration 083: Optimized Mother Picker Query
**File**: `supabase/migrations/083_get_father_wives_minimal.sql`

**Status**: ✅ Deployed (January 2025)

Creates a lightweight RPC function specifically for the mother picker UI, replacing an inefficient N+1 query pattern:
- **Performance**: 80-90% bandwidth reduction (28KB → ~3KB per query)
- **Old Behavior**: Fetched entire father's family data (father, mother, all spouses with full profiles, all children)
- **New Behavior**: Returns only minimal spouse data needed for UI

**Function Created**: `get_father_wives_minimal(p_father_id UUID)`

**Returns**: JSONB array of spouse objects with minimal fields:
```json
[
  {
    "marriage_id": "uuid",
    "status": "current",
    "children_count": 3,
    "spouse_profile": {
      "id": "uuid",
      "name": "فاطمة بنت عبدالله",
      "photo_url": "https://..."
    }
  }
]
```

**Key Features**:
- Filters soft-deleted wives (`wife.deleted_at IS NULL`)
- Sorts by marriage status (current first) then start date
- Supports both new ('current'/'past') and legacy ('married'/'divorced'/'widowed') status values
- Only returns 3 spouse_profile fields vs ~40 in full query

**App Code Updates**:
- ✅ `TabFamily.js:513` - Uses `get_father_wives_minimal` instead of `get_profile_family_data`
- ✅ Mother picker displays children count to disambiguate wives with similar names
- ✅ Button label bug fixed (checks `person.mother_id` instead of `mother` object)
- ✅ Delete confirmation dialog with mother's name

**Usage Example**:
```javascript
// From TabFamily.js:513-520
const { data: motherData, error } = await supabase.rpc('get_father_wives_minimal', {
  p_father_id: data.father.id,
});

// Returns lightweight array directly (no .spouses property)
dispatch({ type: 'SET_MOTHER_OPTIONS', payload: motherData || [] });
```

## ⚠️ CRITICAL: Field Mapping Maintenance

**Full Documentation**: [`/docs/FIELD_MAPPING.md`](FIELD_MAPPING.md)

### The Problem
When you add a new field to the `profiles` table, it will **save correctly but disappear on reload** unless you update ALL relevant RPC functions.

### The "Weird Dance" (Now Fixed!)
This happened **3 times**:
1. **Titles**: Added `professional_title` → had to update 3 functions (migrations 012, 013)
2. **Achievements**: Added `achievements` & `timeline` → had to update 3 functions (migration 015)
3. **Next field?** → Use the checklist below!

### The Checklist: "Add Once, Update Everywhere"

When adding a **new column** to `profiles` table:

- [ ] **1. profiles table** - `ALTER TABLE profiles ADD COLUMN new_field TYPE`
- [ ] **2. get_branch_data()** - Add to RETURNS TABLE + all 3 SELECT statements
- [ ] **3. search_name_chain()** - Add to RETURNS TABLE + all 3 SELECT statements
- [ ] **4. admin_update_profile()** - Add to UPDATE statement whitelist
- [ ] **5. Test in app** - Verify field persists across save/reload

### Quick Test
```javascript
// 1. Save a field
await supabase.rpc('admin_update_profile', {
  p_updates: { your_new_field: 'test value' }
});

// 2. Reload profile
const profile = await supabase.rpc('get_branch_data', {...});

// 3. Check it's there
console.log(profile.your_new_field);  // Should NOT be undefined!
```

### Reference Migrations
- **Migration 012**: `migrations/012_add_titles_to_rpc_functions.sql` - Title fields example
- **Migration 013**: `migrations/013_add_titles_to_admin_update_profile.sql` - Update function example
- **Migration 015**: `migrations/015_comprehensive_profile_fields.sql` - Complete coverage

**See [`docs/FIELD_MAPPING.md`](FIELD_MAPPING.md) for step-by-step guide and examples.**

## Deployment Order

Always deploy migrations in sequence:
```bash
# Check deployed migrations
SELECT version, name FROM migrations ORDER BY version;

# Deploy missing migrations
node scripts/execute-sql.js migrations/005_family_edit_permissions_system.sql
node scripts/execute-sql.js migrations/006_super_admin_permissions.sql

# Or use combined script
node scripts/execute-sql.js scripts/deploy-missing-admin-migrations.sql
```

## Known Issues

1. **Constraint Conflicts**: Old `check_profile_role` vs new `check_valid_role`
   - Solution: `ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_profile_role;`

2. **Audit Log**: `audit_log_action_check` doesn't accept 'ROLE_CHANGE'
   - Workaround: Skip audit logging when changing roles for now
   - TODO: Update audit_log_action_check constraint

3. **MCP Read-Only**: Cannot deploy via MCP, must use clipboard method
   - Solution: Use `node scripts/execute-sql.js` instead

4. **Search Function Collision**: Fixed by renaming to `super_admin_search_by_name_chain`

## Current System Status (January 2025)

- **Super Admin**: علي (phone: 966501669043, ID: ff239ed7-24d5-4298-a135-79dc0f70e5b8)
- **Authentication**: Phone-based only (no email logins)
- **Migrations Deployed**: 005, 006 (permission system), 012, 013, 015 (field mapping), 077, 078 (marriage status), 084a, 084b (cascade delete)
- **Admin Functions**: All 12 core functions deployed and operational (includes cascade delete functions)
- **Constraint Status**: Fixed - only `check_valid_role` active
- **Field Coverage**: Migration 015 ensures all 41 profile fields are returned by RPC functions
- **Marriage Status**: Migration 078 deployed - uses 'current'/'past' terminology (January 2025)
- **Cascade Delete**: Migration 084b deployed - comprehensive cascade soft delete with batch permission validation (January 2025)

## Troubleshooting

**"ERROR: 23514: new row violates check constraint 'check_profile_role'"**
```sql
-- Two conflicting constraints exist, drop the old one:
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_profile_role;
-- Keep only 'check_valid_role' which allows super_admin
```

**"ERROR: 23514: audit_log violates check constraint 'audit_log_action_check'"**
```sql
-- The audit_log doesn't accept 'ROLE_CHANGE' action
-- Skip audit logging when changing roles for now
-- TODO: Update audit_log_action_check constraint
```

**"Functions missing after deployment"**
```sql
-- Check what functions exist:
SELECT proname FROM pg_proc
WHERE proname IN ('get_pending_suggestions', 'approve_suggestion',
                  'grant_admin_role', 'super_admin_search_by_name_chain');

-- If missing, redeploy migrations 005 and 006
```

**"MCP in read-only mode"**
- MCP server configured with `--read-only` flag
- Cannot use `apply_migration` function
- Solution: Copy SQL to clipboard and run manually in Supabase Dashboard

**"Can't find user by phone number"**
- Phone authentication stored in auth.users.phone
- Profile phone field may be NULL
- Use join: `profiles p JOIN auth.users au ON au.id = p.user_id`

## Best Practices

1. **Always test migrations locally first**
2. **Deploy in sequence** - Never skip migration numbers
3. **Update field mapping checklist** - When adding new profile fields
4. **Commit migrations immediately** - After successful deployment
5. **Document changes** - Update this guide and CLAUDE.md
