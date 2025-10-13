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
