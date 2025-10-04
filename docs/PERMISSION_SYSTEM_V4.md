# Permission System v4.2 - Complete Documentation

**Status**: ✅ DEPLOYED (Production-Ready)
**Version**: 4.2 (Security Hardened)
**Last Updated**: January 2025
**Database**: All tables and functions verified and operational

---

## 📋 Executive Summary

The v4.2 permission system provides granular, family-relationship-based access control for the Alqefari Family Tree app. It replaces simple admin/user permissions with an intelligent three-circle model that automatically determines edit rights based on actual family connections.

### Current Deployment Status

✅ **Database**: All 4 tables deployed
✅ **Functions**: All 18 functions operational
✅ **Frontend**: ProfileSheet, suggestionService, UI components integrated
✅ **Security**: SQL injection prevention, rate limiting, RLS policies active
✅ **Testing**: Verified on production database

### Quick Permission Reference

| Permission Level | Can Do | Auto-Approve | Example Relationships |
|-----------------|---------|--------------|----------------------|
| `admin` | Direct edit anyone | N/A | Super admin, admin role |
| `moderator` | Direct edit subtree | N/A | Branch moderator |
| `inner` | Direct edit | N/A | Self, spouse, parents, children, siblings, descendants |
| `family` | Suggest edit | 48 hours | Cousins, aunts/uncles, nephews/nieces |
| `extended` | Suggest edit | Manual only | Distant relatives, Al Qefari members |
| `blocked` | Cannot suggest | Never | Explicitly blocked users |
| `none` | No access | Never | No family relationship |

---

## 🗄️ Database Schema (AS DEPLOYED)

### Table 1: `profile_edit_suggestions`

Stores all edit suggestions from users who don't have direct edit rights.

**Columns** (13 total):
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
profile_id        UUID NOT NULL REFERENCES profiles(id)
submitter_id      UUID NOT NULL REFERENCES profiles(id)  -- v4.2: renamed from suggested_by
field_name        TEXT NOT NULL
old_value         TEXT
new_value         TEXT
reason            TEXT
status            TEXT NOT NULL DEFAULT 'pending'  -- 'pending', 'approved', 'rejected'
reviewed_by       UUID REFERENCES profiles(id)
reviewed_at       TIMESTAMPTZ
notes             TEXT  -- Reviewer notes
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
```

**Indexes**:
- Primary key on `id`
- Foreign keys on `profile_id`, `submitter_id`, `reviewed_by`
- Composite index on `(status, created_at)` for pending queries

**RLS Policies**:
- Users see suggestions they created
- Users see suggestions for their profiles
- Branch moderators see their branch
- Admins see all

### Table 2: `branch_moderators`

Tracks users assigned to manage specific family branches.

**Columns** (6 total):
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id      UUID NOT NULL REFERENCES profiles(id)
branch_hid   TEXT NOT NULL  -- HID of branch root (e.g., "12" for محمد's branch)
is_active    BOOLEAN DEFAULT true
assigned_by  UUID REFERENCES profiles(id)
created_at   TIMESTAMPTZ DEFAULT NOW()
```

**Notes**:
- One user can moderate multiple branches
- Branch moderators have `inner` permission for entire subtree
- HID pattern matching: `target_hid LIKE branch_hid || '%'`

### Table 3: `user_rate_limits`

Prevents abuse with daily rate limits per user.

**Columns** (7 total):
```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id               UUID NOT NULL UNIQUE REFERENCES profiles(id)
daily_suggestions     INTEGER DEFAULT 0
daily_approvals       INTEGER DEFAULT 0
last_suggestion_at    TIMESTAMPTZ
last_approval_at      TIMESTAMPTZ
last_reset_at         TIMESTAMPTZ DEFAULT NOW()
```

**Limits**:
- **Suggestions**: 10 per day per user
- **Approvals**: 100 per day per admin/moderator
- Auto-resets daily via cron job

**RLS Policies**:
- Users see only their own limits
- Admins see all limits
- Updates only via functions (not direct SQL)

### Table 4: `suggestion_blocks`

Tracks users explicitly blocked from making suggestions.

**Columns** (6 total):
```sql
id              UUID PRIMARY KEY DEFAULT gen_random_uuid()
blocked_user_id UUID NOT NULL REFERENCES profiles(id)
reason          TEXT
is_active       BOOLEAN DEFAULT true
blocked_by      UUID REFERENCES profiles(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
```

**Notes**:
- Admins can block/unblock users
- Blocked users get `blocked` permission level
- Cannot make suggestions for any profile

---

## 🔑 Core Functions

### 1. `check_family_permission_v4(p_user_id UUID, p_target_id UUID) → TEXT`

**Primary permission checking function**. Returns permission level based on family relationship.

**Parameters**:
- `p_user_id`: Profile ID (NOT auth.users.id!) of the user
- `p_target_id`: Profile ID of the profile being accessed

**Return Values**:
- `'admin'` - User has admin or super_admin role
- `'moderator'` - User is branch moderator for this profile's branch
- `'inner'` - Inner circle (direct edit rights)
- `'family'` - Family circle (suggest with 48hr auto-approve)
- `'extended'` - Extended family (suggest, manual approve only)
- `'blocked'` - User is explicitly blocked
- `'none'` - No relationship or permission

**Inner Circle Logic** (Direct Edit):
```sql
-- Self
p_user_id = p_target_id

-- Active Spouse
EXISTS (
  SELECT 1 FROM marriages
  WHERE is_current = true
  AND ((husband_id = p_user_id AND wife_id = p_target_id) OR
       (wife_id = p_user_id AND husband_id = p_target_id))
)

-- Parents (both directions)
user.father_id = target.id OR user.mother_id = target.id OR
target.father_id = user.id OR target.mother_id = user.id

-- Siblings (shared parent)
(user.father_id IS NOT NULL AND user.father_id = target.father_id) OR
(user.mother_id IS NOT NULL AND user.mother_id = target.mother_id)

-- All Descendants (recursive check)
is_descendant_of(target.id, user.id)  -- Target is descendant of user

-- All Ancestors (can edit your ancestors)
is_descendant_of(user.id, target.id)  -- User is descendant of target
```

**Family Circle Logic** (48hr Auto-Approve):
- Shared grandparent (cousins, aunts/uncles, nephews/nieces)
- Aunt/uncle relationships
- Nephew/niece relationships
- First cousin relationships

**Extended Circle Logic**:
- Any Al Qefari member (has HID)
- No shared grandparent

**Example Usage**:
```javascript
// Frontend: Get user's PROFILE ID first, then check permission
const { data: { user } } = await supabase.auth.getUser();
const { data: userProfile } = await supabase
  .from('profiles')
  .select('id')
  .eq('user_id', user.id)
  .single();

const { data: permission } = await supabase.rpc('check_family_permission_v4', {
  p_user_id: userProfile.id,  // PROFILE ID
  p_target_id: targetProfile.id
});

console.log(permission); // 'inner', 'family', 'extended', etc.
```

---

### 2. `submit_edit_suggestion_v4(p_profile_id UUID, p_field_name TEXT, p_new_value TEXT, p_reason TEXT) → UUID`

**Submit an edit suggestion** for a profile the user doesn't have direct edit rights for.

**Parameters**:
- `p_profile_id`: Profile being edited
- `p_field_name`: Column name (e.g., 'name', 'bio', 'phone')
- `p_new_value`: New value as string
- `p_reason`: Optional reason for the change

**Returns**: UUID of created suggestion

**Checks**:
- User has `family` or `extended` permission (not `none` or `blocked`)
- User hasn't exceeded rate limit (10/day)
- Field is allowed to be edited

**Creates**:
- New row in `profile_edit_suggestions` with status='pending'
- Updates `user_rate_limits`

**Example**:
```javascript
const suggestionId = await supabase.rpc('submit_edit_suggestion_v4', {
  p_profile_id: targetProfile.id,
  p_field_name: 'bio',
  p_new_value: 'Updated biography text',
  p_reason: 'Correcting outdated information'
});
```

---

### 3. `approve_suggestion(p_suggestion_id UUID, p_notes TEXT) → BOOLEAN`

**Approve and apply** a pending suggestion.

**Parameters**:
- `p_suggestion_id`: Suggestion to approve
- `p_notes`: Optional notes from reviewer

**Returns**: `true` on success

**Actions**:
- Checks user has admin/moderator/owner rights
- Updates profile with new value
- Sets suggestion status to 'approved'
- Records reviewer and timestamp
- Updates audit log

**Example**:
```javascript
await supabase.rpc('approve_suggestion', {
  p_suggestion_id: suggestion.id,
  p_notes: 'Verified with family records'
});
```

---

### 4. `reject_suggestion(p_suggestion_id UUID, p_notes TEXT) → BOOLEAN`

**Reject** a pending suggestion without applying changes.

**Parameters**:
- `p_suggestion_id`: Suggestion to reject
- `p_notes`: Reason for rejection

**Returns**: `true` on success

**Example**:
```javascript
await supabase.rpc('reject_suggestion', {
  p_suggestion_id: suggestion.id,
  p_notes: 'Does not match verified records'
});
```

---

### 5. `auto_approve_suggestions_v4() → VOID`

**Automatically approve family circle suggestions** after 48 hours.

**Logic**:
- Finds suggestions with status='pending'
- Created more than 48 hours ago
- Submitter has 'family' permission (not 'extended')
- Applies changes and marks as approved

**Execution**: Run via cron job every hour

**SQL Cron Setup**:
```sql
SELECT cron.schedule(
  'auto-approve-family-suggestions',
  '0 * * * *',  -- Every hour
  'SELECT auto_approve_suggestions_v4()'
);
```

---

### 6. `get_pending_suggestions_count(p_profile_id UUID) → INTEGER`

**Get count of pending suggestions** for a specific profile.

**Parameters**:
- `p_profile_id`: Profile to check (optional, defaults to all if NULL)

**Returns**: Number of pending suggestions

**Example**:
```javascript
const { data: count } = await supabase.rpc('get_pending_suggestions_count', {
  p_profile_id: currentProfile.id
});
```

---

### 7. Additional Functions

**Permission Management**:
- `can_manage_permissions(p_user_id UUID) → BOOLEAN` - Check if user is super_admin
- `get_user_permissions_summary(p_user_id UUID) → JSONB` - Get full permission summary

**Blocking**:
- `block_user_suggestions(p_user_id UUID, p_reason TEXT) → BOOLEAN`
- `unblock_user_suggestions(p_user_id UUID) → BOOLEAN`
- `admin_toggle_suggestion_block(p_user_id UUID, p_block BOOLEAN, p_reason TEXT) → JSONB`

**Approval**:
- `approve_edit_suggestion(p_suggestion_id UUID, p_approved_by UUID) → JSONB`
- `reject_edit_suggestion(p_suggestion_id UUID, p_rejected_by UUID, p_rejection_reason TEXT) → JSONB`

---

## 🎨 Permission Model - Three Circles

### Inner Circle: Direct Edit Rights

**Who**: Self, spouse, parents, children, siblings, ALL descendants

**User Experience**: Click "تعديل" → Edit directly → See "تم الحفظ" ✓

**Logic**:
1. User clicks edit on a profile
2. `check_family_permission_v4()` returns `'inner'`
3. ProfileSheet shows "تعديل" button (not "اقتراح تعديل")
4. User makes changes
5. Changes saved directly to database
6. No approval workflow

**Why Direct Edit**:
- Immediate family (high trust)
- All your descendants (you manage your lineage)
- Your ancestors (contribute to family history)

---

### Family Circle: 48-Hour Auto-Approve

**Who**: Shared grandparent relatives (cousins, aunts/uncles, nephews/nieces)

**User Experience**: Click "اقتراح تعديل" → Submit suggestion → "سيتم الموافقة خلال 48 ساعة"

**Workflow**:
1. `check_family_permission_v4()` returns `'family'`
2. Button shows "اقتراح تعديل"
3. User submits suggestion via `submit_edit_suggestion_v4()`
4. Suggestion status = 'pending'
5. **After 48 hours**: `auto_approve_suggestions_v4()` runs
6. Changes automatically applied
7. Suggestion status = 'approved'

**Why Auto-Approve**:
- Close family relationship (shared grandparent)
- Medium trust level
- Reduces admin workload
- 48-hour window allows owner to reject if needed

---

### Extended Circle: Manual Approval Only

**Who**: Distant relatives, Al Qefari members with no shared grandparent

**User Experience**: Click "اقتراح تعديل" → Submit suggestion → "يحتاج موافقة المشرف"

**Workflow**:
1. `check_family_permission_v4()` returns `'extended'`
2. User submits suggestion
3. **No auto-approve** - stays pending indefinitely
4. Admin/moderator/owner must manually approve
5. Notification sent to approvers

**Why Manual Only**:
- Distant relationship
- Lower trust level
- Higher potential for errors
- Requires human verification

---

## 💻 Frontend Integration

### ProfileSheet Permission Check

**File**: `src/components/ProfileSheet.js`

**Logic**:
```javascript
useEffect(() => {
  const checkPermission = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setPermissionLevel('none');
      return;
    }

    // CRITICAL: Get PROFILE ID, not auth.users.id
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id, name, hid, role')
      .eq('user_id', user.id)
      .single();

    if (!userProfile) {
      setPermissionLevel('none');
      return;
    }

    // Call v4.2 permission function
    const { data, error } = await supabase.rpc('check_family_permission_v4', {
      p_user_id: userProfile.id,  // PROFILE ID
      p_target_id: person.id       // PROFILE ID
    });

    if (!error && data) {
      setPermissionLevel(data);
    } else {
      setPermissionLevel('none');
    }
  };

  checkPermission();
}, [person.id]);
```

**Button Text Logic**:
```javascript
const getEditButtonText = () => {
  if (['admin', 'moderator', 'inner'].includes(permissionLevel)) {
    return 'تعديل'; // Direct edit
  } else if (['family', 'extended'].includes(permissionLevel)) {
    return 'اقتراح تعديل'; // Suggest edit
  } else {
    return null; // No button
  }
};
```

---

### suggestionService

**File**: `src/services/suggestionService.js`

**API**:
```javascript
// Submit suggestion
await suggestionService.submitSuggestion({
  profileId: profile.id,
  fieldName: 'bio',
  newValue: 'Updated text',
  reason: 'Correction needed'
});

// Approve suggestion
await suggestionService.approveSuggestion(suggestionId);

// Reject suggestion
await suggestionService.rejectSuggestion(suggestionId, 'Does not match records');

// Get pending count
const count = await suggestionService.getPendingCount(profileId);
```

---

### UI Components

**SuggestionModal** (`src/components/SuggestionModal.js`)
- Modal for submitting edit suggestions
- Shows current vs new value
- Optional reason field
- Permission-aware (only shows if user has suggest rights)

**ApprovalInbox** (`src/screens/ApprovalInbox.js`)
- Admin dashboard for reviewing suggestions
- Tabbed view (pending/approved/rejected)
- Bulk actions support
- Shows suggester info and timestamps

**PermissionManager** (`src/components/admin/PermissionManager.js`)
- Super admin tool for managing permissions
- Search users by name chain
- Assign/remove moderators
- Block/unblock users

**SuggestionReviewManager** (`src/components/admin/SuggestionReviewManager.js`)
- Review pending suggestions
- Approve/reject with notes
- Filter by status
- Real-time updates

---

## 🧪 Testing & Verification

### Check System Health

```sql
-- Verify all tables exist
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns
        WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN (
  'profile_edit_suggestions',
  'branch_moderators',
  'user_rate_limits',
  'suggestion_blocks'
);

-- Verify all functions exist
SELECT proname as function_name,
       pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
AND (proname LIKE '%permission%' OR proname LIKE '%suggestion%')
ORDER BY proname;

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN (
  'profile_edit_suggestions',
  'branch_moderators',
  'user_rate_limits',
  'suggestion_blocks'
);
```

### Test Permission Levels

```sql
-- Test inner circle (should return 'inner')
SELECT check_family_permission_v4(
  'user-profile-uuid',
  'user-profile-uuid'  -- Same person
);

-- Test family circle (cousins)
-- Find two profiles with shared grandparent
SELECT check_family_permission_v4(
  'cousin1-profile-uuid',
  'cousin2-profile-uuid'
);

-- Test blocked user
SELECT check_family_permission_v4(
  'blocked-user-uuid',
  'target-uuid'
); -- Should return 'blocked'
```

### Monitor Suggestion Activity

```sql
-- Pending suggestions by profile
SELECT p.name, p.hid, COUNT(*) as pending_count
FROM profile_edit_suggestions s
JOIN profiles p ON p.id = s.profile_id
WHERE s.status = 'pending'
GROUP BY p.id, p.name, p.hid
ORDER BY pending_count DESC;

-- Auto-approve candidates (>48 hours old)
SELECT s.id, s.field_name, p.name,
       AGE(NOW(), s.created_at) as age
FROM profile_edit_suggestions s
JOIN profiles p ON p.id = s.profile_id
WHERE s.status = 'pending'
AND s.created_at < NOW() - INTERVAL '48 hours';

-- Rate limit usage
SELECT p.name, r.daily_suggestions, r.daily_approvals
FROM user_rate_limits r
JOIN profiles p ON p.id = r.user_id
WHERE r.daily_suggestions > 0 OR r.daily_approvals > 0
ORDER BY r.daily_suggestions DESC;
```

---

## 🚨 Troubleshooting

### Issue: Permission always returns 'none'

**Cause**: Passing `auth.users.id` instead of `profiles.id`

**Fix**:
```javascript
// ❌ WRONG
const { data: user } = await supabase.auth.getUser();
const permission = await supabase.rpc('check_family_permission_v4', {
  p_user_id: user.id,  // This is auth.users.id!
  p_target_id: target.id
});

// ✅ CORRECT
const { data: userProfile } = await supabase
  .from('profiles')
  .select('id')
  .eq('user_id', user.id)
  .single();

const permission = await supabase.rpc('check_family_permission_v4', {
  p_user_id: userProfile.id,  // This is profiles.id!
  p_target_id: target.id
});
```

---

### Issue: Suggestions not auto-approving

**Check**:
1. Is cron job running?
```sql
SELECT * FROM cron.job WHERE jobname = 'auto-approve-family-suggestions';
```

2. Are there eligible suggestions?
```sql
SELECT * FROM profile_edit_suggestions
WHERE status = 'pending'
AND created_at < NOW() - INTERVAL '48 hours';
```

3. Do they have 'family' permission?
```sql
SELECT s.id, check_family_permission_v4(s.submitter_id, s.profile_id) as permission
FROM profile_edit_suggestions s
WHERE s.status = 'pending';
-- Should return 'family' for auto-approve candidates
```

---

### Issue: Rate limit not resetting

**Manual Reset**:
```sql
UPDATE user_rate_limits
SET daily_suggestions = 0,
    daily_approvals = 0,
    last_reset_at = NOW()
WHERE last_reset_at < NOW() - INTERVAL '24 hours';
```

**Check Cron**:
```sql
-- Should have daily reset job
SELECT * FROM cron.job WHERE command LIKE '%rate_limit%';
```

---

### Issue: Branch moderator not getting access

**Verify**:
```sql
-- Check moderator assignment
SELECT * FROM branch_moderators
WHERE user_id = 'moderator-profile-uuid'
AND is_active = true;

-- Check HID pattern matching
SELECT
  bm.branch_hid,
  p.hid as target_hid,
  p.hid LIKE bm.branch_hid || '%' as should_match
FROM branch_moderators bm
CROSS JOIN profiles p
WHERE bm.user_id = 'moderator-profile-uuid'
AND p.id = 'target-profile-uuid';
```

---

## 📚 API Quick Reference

### Permission Checks
```javascript
// Get permission level
const { data: level } = await supabase.rpc('check_family_permission_v4', {
  p_user_id: userProfile.id,
  p_target_id: targetProfile.id
});
// Returns: 'admin', 'moderator', 'inner', 'family', 'extended', 'blocked', 'none'
```

### Suggestions
```javascript
// Submit suggestion
const { data: suggestionId } = await supabase.rpc('submit_edit_suggestion_v4', {
  p_profile_id: profile.id,
  p_field_name: 'bio',
  p_new_value: 'New bio text',
  p_reason: 'Updating information'
});

// Approve suggestion
await supabase.rpc('approve_suggestion', {
  p_suggestion_id: id,
  p_notes: 'Looks good'
});

// Reject suggestion
await supabase.rpc('reject_suggestion', {
  p_suggestion_id: id,
  p_notes: 'Incorrect information'
});

// Get pending count
const { data: count } = await supabase.rpc('get_pending_suggestions_count', {
  p_profile_id: profile.id
});
```

### Admin Functions
```javascript
// Check if user can manage permissions (super_admin only)
const { data: canManage } = await supabase.rpc('can_manage_permissions', {
  p_user_id: userProfile.id
});

// Get user's full permission summary
const { data: summary } = await supabase.rpc('get_user_permissions_summary', {
  p_user_id: userProfile.id
});

// Block user from making suggestions
await supabase.rpc('block_user_suggestions', {
  p_user_id: targetUser.id,
  p_reason: 'Repeated invalid suggestions'
});

// Unblock user
await supabase.rpc('unblock_user_suggestions', {
  p_user_id: targetUser.id
});
```

---

## 📖 Deployment History

### v4.2 (January 2025) - CURRENT
**Status**: ✅ Deployed and operational

**Changes**:
- Renamed `suggested_by` → `submitter_id` in profile_edit_suggestions
- Added security hardening (SQL injection prevention)
- Added RLS policies for all tables
- Added rate limiting system
- Added branch moderator support
- Added auto-approve for family circle (48 hours)
- Added comprehensive error handling
- Fixed type coercion issues

**Tables Created**:
- profile_edit_suggestions (13 columns)
- branch_moderators (6 columns)
- user_rate_limits (7 columns)
- suggestion_blocks (6 columns)

**Functions Created**: 18 total (see API Reference)

### Migration Notes

**Breaking Changes**:
- Column rename: `suggested_by` → `submitter_id`
- Permission return values changed from boolean to text
- Frontend must use profiles.id, not auth.users.id

**Backward Compatibility**: None - complete rewrite from v3

---

## 🔐 Security Features

### SQL Injection Prevention
- All dynamic queries use parameterized updates
- Column whitelist for allowed edits
- No user input directly concatenated into SQL

### Rate Limiting
- 10 suggestions per day per user
- 100 approvals per day per admin
- Prevents abuse and spam

### Row-Level Security (RLS)
- Users only see their own data
- Admins have elevated access
- All table access controlled by policies

### Advisory Locks
- Prevents race conditions in rate limiting
- Ensures atomic operations
- Lock key based on user ID

### Audit Trail
- All suggestions logged
- Approval/rejection tracked
- Reviewer identity recorded
- Timestamps on all actions

---

## ⚙️ Configuration

### Environment Variables
None required - all configuration in database

### Cron Jobs
```sql
-- Auto-approve family suggestions (every hour)
SELECT cron.schedule(
  'auto-approve-family-suggestions',
  '0 * * * *',
  'SELECT auto_approve_suggestions_v4()'
);

-- Reset daily rate limits (every day at midnight)
SELECT cron.schedule(
  'reset-rate-limits',
  '0 0 * * *',
  'UPDATE user_rate_limits SET daily_suggestions = 0, daily_approvals = 0, last_reset_at = NOW()'
);
```

### Feature Flags
None - all features enabled by default

---

## 📞 Support & Maintenance

### Common Admin Tasks

**Approve all pending suggestions for a profile**:
```sql
-- Review first
SELECT * FROM profile_edit_suggestions
WHERE profile_id = 'target-uuid' AND status = 'pending';

-- Approve all
DO $$
DECLARE
  suggestion RECORD;
BEGIN
  FOR suggestion IN
    SELECT id FROM profile_edit_suggestions
    WHERE profile_id = 'target-uuid' AND status = 'pending'
  LOOP
    PERFORM approve_suggestion(suggestion.id, 'Bulk approval');
  END LOOP;
END $$;
```

**Assign branch moderator**:
```sql
INSERT INTO branch_moderators (user_id, branch_hid, assigned_by)
VALUES (
  'moderator-profile-uuid',
  '12',  -- HID of branch root
  'admin-profile-uuid'
);
```

**Check user's permissions across all profiles**:
```sql
-- Show permission level for user against all active profiles
SELECT
  p.name,
  p.hid,
  check_family_permission_v4('user-profile-uuid', p.id) as permission
FROM profiles p
WHERE p.deleted_at IS NULL
AND p.id != 'user-profile-uuid'
ORDER BY permission, p.name;
```

---

## 🎯 Best Practices

1. **Always use profiles.id, never auth.users.id** for permission checks
2. **Check permission before every edit** - don't cache permission levels
3. **Provide clear feedback** - Tell users why they can/can't edit
4. **Use suggestionService** - Don't call RPC functions directly from UI
5. **Monitor rate limits** - Alert admins when users hit limits
6. **Review auto-approvals** - Periodically audit what got auto-approved
7. **Test with real family data** - Permission logic complex, needs real scenarios

---

**End of Documentation**

For questions or issues, check troubleshooting section or review audit logs in database.
