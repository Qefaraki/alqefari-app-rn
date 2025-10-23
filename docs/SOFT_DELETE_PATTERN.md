# Soft Delete Pattern & Optimistic Locking

**Status**: ✅ Deployed and operational (January 2025)

The app uses soft deletion for profile records, combined with optimistic locking for concurrent edit protection.

## Soft Delete Behavior

### What is Soft Delete?
- Sets `deleted_at` timestamp instead of removing records from database
- Profile disappears from queries (`WHERE deleted_at IS NULL`)
- Data remains in database for audit trail and potential recovery
- **Reversible** - Admin can restore by setting `deleted_at` back to NULL

### Why Soft Delete?
1. **Data Preservation** - Never lose family history data
2. **Audit Trail** - Track who deleted what and when
3. **Reversibility** - Mistakes can be undone
4. **Reference Integrity** - Foreign keys remain valid

## Optimistic Locking with `p_version`

### What is Optimistic Locking?
- Each profile has a `version` field that increments on every update
- `admin_update_profile()` requires `p_version` parameter
- Function checks if version matches before updating
- Prevents concurrent edits from overwriting each other

### Function Signature
```sql
admin_update_profile(
  p_id UUID,
  p_version INTEGER,  -- REQUIRED for optimistic locking
  p_updates JSONB
)
```

### Version Fallback Pattern
```javascript
// Always use fallback to handle profiles created before version tracking
const { error } = await supabase.rpc('admin_update_profile', {
  p_id: profile.id,
  p_version: profile.version || 1,  // Fallback to 1 if version is NULL
  p_updates: { name: 'New Name' }
});
```

## Edge Cases & Warnings

### Descendant Orphaning
- Soft deleting a profile does NOT cascade to descendants (unless using cascade delete function)
- Children/grandchildren remain in tree with NULL parent reference
- **Best Practice**: Check for descendants before deleting

### Example - Delete with Descendant Warning
```javascript
// From TabFamily.js:666-731
const handleDeleteChild = async (child) => {
  try {
    // 1. Check for descendants before deleting
    const { data: descendants } = await supabase
      .from('profiles')
      .select('id, name, gender')
      .or(`father_id.eq.${child.id},mother_id.eq.${child.id}`)
      .is('deleted_at', null);

    const descendantCount = descendants?.length || 0;

    // 2. Build warning message
    let message = `هل أنت متأكد من حذف ${child.name} من العائلة؟`;

    if (descendantCount > 0) {
      message += `\n\n⚠️ تحذير: لديه ${descendantCount} ${
        descendantCount === 1 ? 'طفل' : 'أطفال'
      }.\n\nملاحظة: الأطفال سيبقون في الشجرة لكن بدون والد ظاهر.`;
    }

    Alert.alert('تأكيد الحذف', message, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          // 3. Soft delete with optimistic locking
          const { error } = await supabase.rpc('admin_update_profile', {
            p_id: child.id,
            p_version: child.version || 1,
            p_updates: { deleted_at: new Date().toISOString() },
          });
          // ... handle error
        },
      },
    ]);
  } catch (err) {
    Alert.alert('خطأ', 'حدث خطأ أثناء التحقق من البيانات');
  }
};
```

## Code Locations Using This Pattern

All locations **MUST** include `p_version` parameter when calling `admin_update_profile()`:

1. **TabFamily.js:700** - Delete child (soft delete)
2. **TabFamily.js:747** - Set mother (family relationship update)
3. **TabFamily.js:779** - Clear mother (family relationship update)
4. **EditChildModal.js:74** - Update child profile
5. **SelectMotherModal.js:97** - Update person's mother

### Common Error if `p_version` Missing
```
ERROR: "Could not find the function public.admin_update_profile(p_id, p_updates) in the schema cache"
HINT: "Perhaps you meant to call admin_update_profile(p_id, p_updates, p_version)"
```

**Fix**: Add `p_version: object.version || 1` to all RPC calls

## Migration History

- **Migration 007**: Added `version` field to profiles table with optimistic locking
- **Migration 013**: Updated `admin_update_profile()` to require p_version parameter
- **Dropped 2-parameter version**: Only 3-parameter version exists now (p_id, p_version, p_updates)

---

# Marriage Deletion System (Error Correction)

**Status**: ✅ Deployed and operational (October 2025)

**Important Note**: Marriage deletion is for **data entry errors only** - when an admin accidentally creates a wrong marriage. This is NOT for divorce scenarios. When a marriage is deleted:
- The marriage record is soft-deleted (`deleted_at` timestamp)
- Children remain in the tree with their father
- Mother reference is cleared (`mother_id = NULL`) for children
- Spouse profile is deleted ONLY if it's a Munasib (non-family) with no other marriages

## Components & Files

- **MarriageDeletionSheet.js** - Modal confirmation dialog with real-time data fetching
- **SpouseRow.js** - Delete button wrapper with permission validation
- **TabFamily.js** - orchestrates marriage deletion flow and permissions

## How It Works

### Step 1: User Initiates Deletion
User clicks the delete button on a spouse in the family tree. SpouseRow validates that:
- User has `canEditFamily` permission
- Marriage data exists with valid `marriage_id`
- Spouse profile exists

### Step 2: Deletion Sheet Opens with Real-Time Data
MarriageDeletionSheet opens and immediately fetches accurate data:

**1. Determine Marriage Type**:
```javascript
// Cousin marriage = both spouses have HID (Al-Qefari family)
const isCousinMarriage = spouse.hid !== null && spouse.hid?.trim() !== '';
```

**2. Count ALL Children**:
```javascript
// Query by father_id or mother_id (not from marriage.children array)
const { count: affectedChildren } = await supabase
  .from('profiles')
  .select('id', { count: 'exact', head: true })
  .eq(parentColumn, spouseId)
  .is('deleted_at', null);
```

**3. Check if Munasib Spouse Profile Will Be Deleted**:
```javascript
// For Munasib (non-family), check other marriages
const { count: otherMarriagesCount } = await supabase
  .from('marriages')
  .select('id', { count: 'exact', head: true })
  .or(`husband_id.eq.${spouseId},wife_id.eq.${spouseId}`)
  .neq('id', marriage.marriage_id)
  .is('deleted_at', null);

const willDeleteProfile = otherMarriagesCount === 0;
```

### Step 3: Show Contextual Warning
Warning message varies by marriage type:

**Cousin Marriage**:
```
الزواج سيتم حذفه. ملف [الاسم] سيبقى في الشجرة (زواج قريب).
```

**Munasib (Profile Will Be Deleted)**:
```
الزواج وملف [الاسم] سيتم حذفهما معاً من الشجرة.
```

**Munasib (Profile Will Remain)**:
```
الزواج سيتم حذفه فقط. ملف [الاسم] سيبقى (لديه زيجات أخرى).
```

**Children Warning**:
```
سيتم إزالة رابط [الأب/الأم] من [عدد] أطفال.
```

### Step 4: Confirm and Execute
When user confirms:
1. Permission re-validated (catches permission changes while sheet was open)
2. `admin_soft_delete_marriage()` RPC called
3. Database soft-deletes marriage and handles cleanup atomically
4. Audit trail logged with marriage ID and affected children count
5. UI updates optimistically and refreshes profile data

## Safety Features

### Network Timeout (10 seconds)
All Supabase queries wrapped with timeout to prevent infinite loading:
```javascript
const fetchWithTimeout = (promise, ms = 10000) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('انتهى وقت الاتصال. تحقق من اتصال الإنترنت.')), ms)
  );
  return Promise.race([promise, timeout]);
};
```

If fetch exceeds 10 seconds on slow network:
- Sheet shows error message
- User can click "حاول مرة أخرى" to retry
- No need to close/reopen sheet

### Triple Permission Validation
1. **SpouseRow**: Checks `canEditFamily` before opening sheet
2. **MarriageDeletionSheet**: Validates data before showing delete button
3. **TabFamily**: Re-checks `canEditFamily` before deletion RPC call

Catches scenarios where permissions changed while sheet was open.

### Real-Time Data Fetching
- Fetches children count on sheet open (not stale `marriage.children` array)
- Fetches other marriages count for accurate profile deletion prediction
- Detects if marriage already deleted (RPC will catch and show error)

### Graceful Error Handling
- Network timeout → Show error with retry button
- Missing spouse data → Show error, disable delete button
- Marriage already deleted → RPC rejection with clear message
- Permission denied → Show permission error

## Database Function

### `admin_soft_delete_marriage()`

**Location**: Supabase RPC function (deployed via migration)

**Behavior**:
1. Validates marriage exists and not already deleted
2. Checks user has edit permission on both spouse profiles
3. Soft-deletes marriage (`deleted_at = NOW()`)
4. For Munasib spouse: If no other marriages, soft-delete spouse profile
5. For all children: If spouse was mother, clear `mother_id`
6. Creates audit log entry with marriage ID and affected children count
7. Transaction-based: All-or-nothing atomicity

**Signature**:
```sql
admin_soft_delete_marriage(
  p_marriage_id UUID,
  p_reason TEXT DEFAULT NULL
)
```

**Example**:
```javascript
const { data, error } = await supabase.rpc('admin_soft_delete_marriage', {
  p_marriage_id: marriage.marriage_id,
  p_reason: 'حذف زواج خاطئ',
});

if (error) {
  if (error.message?.includes('not found')) {
    // Marriage already deleted by another admin
  } else if (error.message?.includes('Unauthorized')) {
    // User lacks permission to delete
  }
}
```

## Undo Capability

Marriage deletion is **fully reversible** via the Undo System:

- Location: Admin Dashboard → Activity Log → Undo button on deletion entry
- Time limit: 30 days for regular admins, unlimited for super admins
- Function: `undo_marriage_delete()` in undo system
- Restores: Marriage record + spouse profile (if deleted) + parent references

See [`/docs/UNDO_SYSTEM_TEST_CHECKLIST.md`](/docs/UNDO_SYSTEM_TEST_CHECKLIST.md) for full undo documentation.

## Testing Scenarios

All 8 critical test scenarios:

1. **Delete cousin marriage (0 children)**
   - Expected: Only marriage deleted, spouse profile remains
   - Verify: Marriage shows in audit log, spouse still searchable

2. **Delete cousin marriage (3+ children)**
   - Expected: Marriage deleted, children remain with father, mother_id cleared
   - Verify: Audit log shows affected_children_count = 3

3. **Delete Munasib marriage (single, 0 children)**
   - Expected: Marriage AND spouse profile deleted
   - Verify: Spouse no longer searchable

4. **Delete Munasib marriage (single, 5 children)**
   - Expected: Marriage deleted, spouse profile deleted, children lose mother reference
   - Verify: Children still have father_id, mother_id is NULL

5. **Delete Munasib with multiple marriages**
   - Expected: Marriage deleted, spouse profile remains, other marriages unaffected
   - Verify: Spouse still has other marriage entries

6. **Error: Network timeout on slow network**
   - Setup: Throttle to 3G in dev tools
   - Expected: Spinner shows for 10 seconds, then error with retry button
   - Verify: User can click retry to retry fetching

7. **Error: Permission change while sheet open**
   - Setup: Revoke admin role while sheet open
   - Expected: Delete button disabled OR deletion RPC rejected with permission error
   - Verify: Cannot delete without permission

8. **Error: Marriage deleted by another admin**
   - Setup: Delete marriage via database while sheet open
   - Expected: RPC call fails with "not found" error
   - Verify: Clear error message shown

## Error Messages

| Scenario | Message | Action |
|----------|---------|--------|
| Missing spouse data | "بيانات الزوج/الزوجة غير متوفرة" | Disable delete button |
| Network timeout | "انتهى وقت الاتصال. تحقق من اتصال الإنترنت." | Show retry button |
| Fetch failed | "فشل تحميل معلومات الحذف. يرجى المحاولة مرة أخرى." | Show retry button |
| Permission denied | "ليس لديك صلاحية لحذف هذا الزواج" | Close sheet, show alert |
| Not found | "الزواج غير موجود. ربما تم حذفه مسبقاً." | Close sheet, show alert |

## Code Locations

- **UI Component**: `src/components/ProfileViewer/EditMode/MarriageDeletionSheet.js` (Full implementation)
- **Delete Button**: `src/components/ProfileViewer/EditMode/SpouseRow.js:146-163` (handleDelete)
- **Flow Orchestration**: `src/components/ProfileViewer/EditMode/TabFamily.js:572-657` (confirmDeleteMarriage)

## Best Practices

1. **Always show affected children count** - Users must understand full impact
2. **Distinguish cousin vs Munasib** - Different consequences for each type
3. **Re-validate permissions** - Catch permission changes while sheet open
4. **Handle network timeouts** - Provide retry mechanism, not indefinite spinner
5. **Log audit trail** - Essential for admin oversight and undo capability
6. **Test with real family data** - Verify accuracy with actual marriage counts and children

---

# Cascading Soft Delete (Migrations 084a & 084b)

**Status**: ✅ Deployed and operational (January 2025)

**Migration Files**:
- **084a**: `migrations/084a_batch_permission_validator.sql` - Batch permission checking helper
- **084b**: `migrations/084b_cascade_soft_delete_complete.sql` - Full cascade delete implementation

The app implements a comprehensive cascade soft delete system that recursively deletes a profile and ALL its descendants (children, grandchildren, etc.) in a single atomic operation with full safety mechanisms.

## Behavior & Features

### What It Does
- Recursively finds ALL descendants using PostgreSQL recursive CTE
- Soft-deletes parent + all descendants by setting `deleted_at` timestamp
- Cascades to related marriages (soft-deletes if either spouse deleted)
- Validates permissions on EVERY descendant before deleting
- Locks all affected profiles to prevent concurrent edits
- Cleans up orphaned admin metadata (branch_moderators, suggestion_blocks)
- Creates complete audit trail with `batch_id` for potential recovery

### UX Strategy - "Permanent but Recoverable"
- **User sees**: "لا يمكن التراجع عن هذا الحذف" (deletion cannot be undone)
- **Admin reality**: Full audit trail with `batch_id` enables sequential recovery
- **Why**: Encourages user caution while maintaining admin safety net

### Function Signature
```sql
admin_cascade_delete_profile(
  p_profile_id UUID,
  p_version INTEGER,           -- Optimistic locking on parent profile
  p_confirm_cascade BOOLEAN,   -- Must be TRUE for cascade operations
  p_max_descendants INTEGER    -- Safety limit (default 100)
)
RETURNS JSONB
```

### Example Return Value
```json
{
  "success": true,
  "batch_id": "uuid-for-recovery",
  "deleted_count": 15,
  "deleted_ids": ["uuid1", "uuid2", ...],
  "generations_affected": 3,
  "marriages_affected": 4,
  "profile": {
    "id": "parent-uuid",
    "name": "محمد القفاري",
    "hid": "1.2.3"
  }
}
```

## Safety Mechanisms

### 1. Batch Permission Validation (Migration 084a)
- Checks permissions for all descendants in ONE query (not N queries)
- Performance: 100 individual checks (8+ seconds) → 1 batch check (300ms)
- Prevents timeout errors with large family trees

### 2. Row-Level Locking
- Uses `FOR UPDATE NOWAIT` on all affected profiles
- Prevents concurrent edits during cascade operation
- Fails immediately if any profile is locked by another user

### 3. Descendant Count Limit
- Default maximum: 100 descendants
- Prevents accidental mass deletion
- Configurable via `p_max_descendants` parameter

### 4. Statement Timeout
- 5-second maximum execution time
- Protects database from runaway queries
- Fails gracefully with timeout error

### 5. Circular Reference Protection
- Maximum 20 generation depth in recursive CTE
- Prevents infinite loops from data corruption

### 6. Optimistic Locking
- Requires `p_version` parameter for parent profile
- Prevents version conflicts: "تم تحديث البيانات من مستخدم آخر"

### 7. Confirmation Requirement
- `p_confirm_cascade` must be TRUE for multi-profile deletions
- Explicit user confirmation required in UI

## Performance Metrics

**Single Profile (no descendants)**:
- Execution time: <100ms
- Permission checks: 1
- Database queries: 3-4

**Small Branch (10 descendants)**:
- Execution time: ~300ms
- Permission checks: 11 (batched in 1 query)
- Database queries: 5-6

**Large Branch (100 descendants)**:
- Execution time: ~1.5s
- Permission checks: 101 (batched in 1 query)
- Database queries: 7-8

## Three-Tier UI Messaging

The UI shows different messages based on descendant count:

### Scenario 1: No descendants (0)
```
Title: حذف من العائلة
Message: هل تريد حذف [name] من شجرة العائلة؟
Button: حذف
```

### Scenario 2: Small branch (1-5 descendants)
```
Title: حذف [name] وذريته
Messages:
  - 1 child: "سيتم حذف [name] وطفله. المجموع: شخصان"
  - 2 children: "سيتم حذف [name] وطفلاه. المجموع: ٣ أشخاص"
  - 3-5: "سيتم حذف [name] و[count] من أبنائه وأحفاده. المجموع: [total] شخص"
Button: حذف الكل
```

### Scenario 3: Large branch (6+ descendants)
```
Title: حذف [name] وذريته
Message: "هذا الإجراء سيحذف [name] مع [count] فرد من ذريته عبر [n] أجيال.

لا يمكن التراجع عن هذا الحذف.

هل تريد المتابعة؟"
Button: نعم، احذف الكل
```

## Error Messages

### Version Conflict
```
"تم تحديث البيانات من مستخدم آخر. يرجى التحديث والمحاولة مرة أخرى."
```
**Solution**: User should reload profile and try again.

### Permission Denied
```
"ليس لديك صلاحية لحذف بعض الأشخاص في هذه الشجرة."
```
**Solution**: User lacks permission for one or more descendants.

### Count Limit Exceeded
```
"يوجد عدد كبير من الأشخاص. يرجى حذف الفروع بشكل منفصل."
```
**Solution**: Tree has >100 descendants, must delete in smaller subtrees.

### Concurrent Edit Lock
```
"الملف قيد التعديل. يقوم مستخدم آخر بتعديل هذا الملف حالياً. يرجى المحاولة بعد قليل."
```
**Solution**: Another user is editing a profile in the tree, wait and retry.

## Known Limitations

1. **Version Check on Parent Only**:
   - Only the parent profile's version is validated
   - Descendants could be modified concurrently
   - **Trade-off**: Acceptable for performance reasons

2. **Descendant Version Overwrites**:
   - Concurrent edits to descendants may be overwritten
   - Row-level locks prevent data corruption, but changes lost
   - **Mitigation**: Lock error will alert user if editing is active

3. **No Built-In Undo UI**:
   - Admin recovery requires direct database access
   - Recovery query: `SELECT * FROM audit_log_enhanced WHERE metadata->>'batch_id' = 'uuid'`
   - **Future Enhancement**: Admin UI for batch undo

4. **Large Tree Restrictions**:
   - Trees >100 descendants require multiple operations
   - Must delete in subtrees (e.g., delete grandchildren first)
   - **Mitigation**: Configurable limit via `p_max_descendants`

## Implementation Reference

**UI Component**: `src/components/ProfileViewer/EditMode/TabFamily.js:699-852`
- `handleDeleteChild()` function
- `buildGenerationMap()` helper for calculating generations
- Three-tier messaging logic
- Comprehensive error handling

**Database Functions**:
- `check_batch_family_permissions()` - Batch permission validator
- `admin_cascade_delete_profile()` - Main cascade delete function

### Example Usage
```javascript
// From TabFamily.js
const { data: result, error } = await supabase.rpc(
  'admin_cascade_delete_profile',
  {
    p_profile_id: child.id,
    p_version: child.version || 1,
    p_confirm_cascade: true,
    p_max_descendants: 100,
  }
);

if (error) {
  const errorMsg = error.message.toLowerCase();
  if (errorMsg.includes('تم تحديث البيانات')) {
    Alert.alert('تم تحديث البيانات', 'تم تعديل هذا الملف من مستخدم آخر...');
  } else if (errorMsg.includes('permission')) {
    Alert.alert('غير مسموح', 'ليس لديك صلاحية لحذف بعض الأشخاص...');
  }
  // ... more error handling
} else {
  // Success - profile and all descendants soft-deleted
  console.log(`Deleted ${result.deleted_count} profiles`);
  console.log(`Batch ID for recovery: ${result.batch_id}`);
}
```

## Best Practices

1. **Always show descendant count** - Users should know what they're deleting
2. **Require explicit confirmation** - For cascading deletes >0 descendants
3. **Handle all error cases** - Version conflicts, permissions, locks, limits
4. **Log batch_id** - Essential for admin recovery if needed
5. **Test with real data** - Verify performance on large branches
