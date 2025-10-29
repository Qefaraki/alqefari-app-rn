# Permission System v4.3 (Simplified) - Complete Documentation

**Status**: ✅ DEPLOYED (Production-Ready)
**Version**: 4.3 (Simplified)
**Last Updated**: January 2025
**Database**: All tables and functions verified and operational
**Major Change**: Removed 48-hour auto-approve - all suggestions now require manual admin approval

---

## 📋 Executive Summary

The v4.3 permission system provides granular, family-relationship-based access control for the Alqefari Family Tree app. This simplified version removes time-based auto-approval complexity, making all suggestions require manual admin review for better quality control and transparency.

### Current Deployment Status

✅ **Database**: All 4 tables deployed
✅ **Functions**: check_family_permission_v4() updated to v4.3
✅ **Frontend**: ProfileSheet, suggestionService, UI components updated
✅ **Security**: SQL injection prevention, rate limiting, RLS policies active
✅ **Testing**: Verified on production database
✅ **Simplification**: 48-hour auto-approve removed, `family` and `extended` merged into `suggest`

### Quick Permission Reference

| Permission Level | Can Do | Approval Required | Example Relationships |
|-----------------|---------|-------------------|----------------------|
| `admin` | Direct edit anyone | N/A (direct) | Super admin (المدير العام), admin (مشرف) role |
| `moderator` | Direct edit subtree | N/A (direct) | Branch coordinator (منسق) |
| `inner` | Direct edit | N/A (direct) | Self, spouse, parents, children, siblings, descendants |
| `suggest` | Suggest edit | Manual admin approval | Grandparents, cousins, aunts/uncles, all extended family |
| `blocked` | Cannot suggest | N/A (blocked) | Explicitly blocked users |
| `none` | No access | N/A (no access) | No family relationship |

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

**Return Values** (v4.3 - Simplified):
- `'admin'` - User has admin or super_admin role (direct edit)
- `'moderator'` - User is branch moderator for this profile's branch (direct edit)
- `'inner'` - Inner circle (direct edit rights)
- `'suggest'` - Can suggest edits (manual admin approval required)
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

**Suggest Circle Logic** (v4.3 - Manual Approval):
- Any Al Qefari family member (has HID)
- Not in inner circle (above)
- Includes: grandparents, cousins, aunts/uncles, nephews/nieces, distant relatives
- All suggestions require manual admin/moderator approval

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

console.log(permission); // 'inner', 'suggest', 'admin', 'moderator', 'blocked', 'none'
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
- User has `suggest` permission (not `inner`, `admin`, `moderator`, `blocked`, or `none`)
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

### 5. `get_pending_suggestions_count(p_profile_id UUID) → INTEGER`

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

### 6. Additional Functions

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

## 🎨 Permission Model - Two Tiers (v4.3 Simplified)

### Tier 1: Direct Edit Rights

**Who**: Self, spouse, parents, children, siblings, ALL descendants, admins, moderators

**User Experience**: Click "تعديل" → Edit directly → See "تم الحفظ" ✓

**Permission Levels**: `admin`, `moderator`, `inner`

**Logic**:
1. User clicks edit on a profile
2. `check_family_permission_v4()` returns `'admin'`, `'moderator'`, or `'inner'`
3. ProfileSheet shows "تعديل" button (not "اقتراح تعديل")
4. User makes changes
5. Changes saved directly to database
6. No approval workflow

**Why Direct Edit**:
- Immediate family (high trust)
- All your descendants (you manage your lineage)
- Your ancestors (contribute to family history)
- Admin/moderator roles (authorized managers)

---

### Tier 2: Suggest Edits (Manual Approval Required)

**Who**: All other Al Qefari family members - grandparents, cousins, aunts/uncles, nephews/nieces, distant relatives

**User Experience**: Click "اقتراح تعديل" → Submit suggestion → "يحتاج موافقة المشرف"

**Permission Level**: `suggest`

**Workflow**:
1. `check_family_permission_v4()` returns `'suggest'`
2. Button shows "اقتراح تعديل"
3. User submits suggestion via `submit_edit_suggestion_v4()`
4. Suggestion status = 'pending'
5. Admin/moderator/owner must manually review and approve
6. Changes applied only after approval
7. Suggestion status = 'approved' or 'rejected'

**Why Manual Approval Only** (v4.3 Simplification):
- Quality control - all edits reviewed by authorized users
- Transparency - clear approval workflow
- Prevents errors - human verification required
- Simpler system - no time-based auto-approve complexity

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

    // Call v4.3 permission function
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

**Button Text Logic** (v4.3):
```javascript
const getEditButtonText = () => {
  if (['admin', 'moderator', 'inner'].includes(permissionLevel)) {
    return 'تعديل'; // Direct edit
  } else if (permissionLevel === 'suggest') {
    return 'اقتراح تعديل'; // Suggest edit
  } else {
    return null; // No button (blocked or none)
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

-- Oldest pending suggestions (need review)
SELECT s.id, s.field_name, p.name,
       AGE(NOW(), s.created_at) as age
FROM profile_edit_suggestions s
JOIN profiles p ON p.id = s.profile_id
WHERE s.status = 'pending'
ORDER BY s.created_at ASC
LIMIT 20;

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
// Get permission level (v4.3)
const { data: level } = await supabase.rpc('check_family_permission_v4', {
  p_user_id: userProfile.id,
  p_target_id: targetProfile.id
});
// Returns: 'admin', 'moderator', 'inner', 'suggest', 'blocked', 'none'
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

### v4.3 (January 2025) - CURRENT
**Status**: ✅ Deployed and operational

**Major Change**: Simplified permission system - removed 48-hour auto-approve complexity

**Changes**:
- Merged `'family'` and `'extended'` permission levels into single `'suggest'` level
- Removed `auto_approve_suggestions_v4()` function
- All suggestions now require manual admin/moderator approval
- Updated `check_family_permission_v4()` to return 6 permission levels instead of 7
- Removed auto-approve cron job
- Simplified frontend permission checks
- Updated Arabic role labels for consistency

**Return Values**: Now returns `'admin'`, `'moderator'`, `'inner'`, `'suggest'`, `'blocked'`, `'none'`

**Migration Notes**:
- Frontend components updated to check for `'suggest'` instead of `'family'` or `'extended'`
- All auto-approval UI elements removed
- No database schema changes - function logic updated only
- Backward compatible - existing suggestions continue to work

---

### v4.2 (January 2025) - SUPERSEDED
**Status**: ⚠️ Superseded by v4.3

**Changes**:
- Renamed `suggested_by` → `submitter_id` in profile_edit_suggestions
- Added security hardening (SQL injection prevention)
- Added RLS policies for all tables
- Added rate limiting system
- Added branch moderator support
- Added auto-approve for family circle (48 hours) - **REMOVED in v4.3**
- Added comprehensive error handling
- Fixed type coercion issues

**Tables Created**:
- profile_edit_suggestions (13 columns)
- branch_moderators (6 columns)
- user_rate_limits (7 columns)
- suggestion_blocks (6 columns)

**Functions Created**: 18 total (see API Reference)

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
-- Reset daily rate limits (every day at midnight)
SELECT cron.schedule(
  'reset-rate-limits',
  '0 0 * * *',
  'UPDATE user_rate_limits SET daily_suggestions = 0, daily_approvals = 0, last_reset_at = NOW()'
);
```

**Note**: v4.3 removed auto-approve functionality, so no cron job needed for suggestion approval.

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

## ⏱️ Permission Check Timeout Protection (October 28, 2025)

**Status**: ✅ Deployed - Network timeout protection across all permission checks

### Problem

Permission checks hung indefinitely on slow/flaky networks, blocking users from:
- Editing profiles (ProfileViewer edit button)
- Scanning QR codes (deep link handler)
- Submitting edit suggestions (suggestion service)

**User Impact**: App appeared frozen, no error message, no retry option.

---

### Solution

Dual-layer timeout protection (frontend + backend) with graceful degradation:

#### 1. Frontend Timeout (3 seconds)

**File**: `src/utils/fetchWithTimeout.js`

**Implementation**:
```javascript
export async function fetchWithTimeout(promise, timeoutMs = 3000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), timeoutMs)
  );

  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (error) {
    if (error.message === 'NETWORK_TIMEOUT') {
      throw { code: 'NETWORK_TIMEOUT', message: 'انتهت المهلة' };
    }
    throw error;
  }
}
```

**Usage**:
```javascript
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const { data, error } = await fetchWithTimeout(
  supabase.rpc('check_family_permission_v4', { p_user_id, p_target_id })
);

if (error) {
  if (error.code === 'NETWORK_TIMEOUT') {
    // Show retry button
  } else if (error.message?.includes('offline')) {
    // Show "لا يوجد اتصال بالإنترنت"
  }
}
```

**Why 3 seconds?** Matches `useProfilePermissions` hook cache TTL, provides responsive UX.

---

#### 2. Backend Timeout (3 seconds)

**Migration**: `supabase/migrations/20251028000003_add_permission_check_timeout.sql`

**Implementation**:
```sql
CREATE OR REPLACE FUNCTION check_family_permission_v4(
  p_user_id UUID,
  p_target_id UUID
) RETURNS TEXT AS $$
BEGIN
  -- Enforce 3-second timeout at database level
  SET LOCAL statement_timeout = '3000';

  -- Permission check logic...
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Purpose**: Prevents long-running queries from blocking connections, ensures consistency with frontend timeout.

---

### Protected Locations

1. **ProfileViewer** (`src/components/ProfileViewer/index.js:845-892`)
   - Edit button permission check
   - Shows "انتهت المهلة" + retry button on timeout

2. **Deep Linking** (`src/utils/deepLinking.ts:215-257`)
   - QR code scan permission check
   - Shows alert with retry option

3. **Suggestion Service** (`src/services/suggestionService.js:49-82`)
   - Suggestion submission permission check
   - Returns error object for UI handling

---

### Error Messages (Arabic)

| Error Code | Message | Action |
|------------|---------|--------|
| `NETWORK_OFFLINE` | لا يوجد اتصال بالإنترنت | Prompt to check connection |
| `NETWORK_TIMEOUT` | انتهت المهلة | Show retry button (1-second debounce) |
| Other | فشل التحقق من الصلاحيات | Generic error message |

---

### Security Notes (per plan-validator)

**Q**: Is permission check redundant if user has cached permission?
**A**: No. Cache TTL is 5 minutes. Permission check catches:
- Role changes during cache window (admin → user)
- Blocking status changes (user → blocked)
- Branch moderator reassignments

**Q**: Why not bypass permission check for self-view?
**A**: Security hole. Must validate user still has edit rights (not blocked, not demoted).

**Q**: Does timeout protection bypass optimistic locking?
**A**: No. Version check happens after permission check passes. Timeout only affects permission validation, not the edit flow.

**Q**: Can timeout be exploited for unauthorized edits?
**A**: No. Timeout causes operation to fail (error state). No edit attempt is made without permission validation success.

---

### Monitoring & Debugging

**Check timeout frequency**:
```sql
-- View permission check timeouts (if logged)
SELECT COUNT(*) FROM logs
WHERE message LIKE '%permission check timeout%'
AND created_at > NOW() - INTERVAL '24 hours';
```

**Test timeout locally**:
```javascript
// Simulate slow network
const { data, error } = await fetchWithTimeout(
  new Promise(resolve => setTimeout(resolve, 5000)),  // 5 sec delay
  3000  // 3 sec timeout
);
// Should throw NETWORK_TIMEOUT error
```

**Manual test checklist**:
- [ ] Turn on airplane mode → Check offline error
- [ ] Throttle to 2G → Check timeout + retry button
- [ ] Normal network → Check permission loads normally

---

### Rollback Plan (if needed)

**Frontend**: Remove `fetchWithTimeout()` wrapper, use direct Supabase call
**Backend**: Remove `SET LOCAL statement_timeout = '3000'` from RPC function

**Emergency hotfix**:
```sql
-- Increase timeout to 10 seconds (temporary)
CREATE OR REPLACE FUNCTION check_family_permission_v4(...) AS $$
BEGIN
  SET LOCAL statement_timeout = '10000';  -- 10 seconds
  -- ... rest of function
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 🎯 Best Practices

1. **Always use profiles.id, never auth.users.id** for permission checks
2. **Check permission before every edit** - don't cache permission levels
3. **Provide clear feedback** - Tell users why they can/can't edit (direct edit vs suggest)
4. **Use suggestionService** - Don't call RPC functions directly from UI
5. **Monitor rate limits** - Alert admins when users hit limits
6. **Review pending suggestions regularly** - All suggestions require manual approval in v4.3
7. **Test with real family data** - Permission logic complex, needs real scenarios
8. **Communicate approval workflow** - Set expectations that suggestions need admin review
9. **Handle network errors gracefully** - Use fetchWithTimeout for all permission checks
10. **Provide retry options** - Don't leave users stuck on timeout errors

---

**End of Documentation**

For questions or issues, check troubleshooting section or review audit logs in database.
