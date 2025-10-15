# Batch Delete Redesign - Architecture Specification

## Status: DESIGN PHASE (NOT APPROVED FOR IMPLEMENTATION)

## Problem Statement

Original batch delete proposal has critical flaws:
1. Transaction scope confusion (partial success unclear)
2. Audit log violations (no operation_groups integration)
3. Deadlock risk (non-deterministic locking)
4. Performance issues (N permission checks in loop)
5. Missing undo system integration

## Corrected Architecture

### Design Principles

1. **Atomic Operations:** All-or-nothing semantics with clear rollback
2. **Operation Groups:** Full integration with undo system
3. **Deterministic Locking:** Sort profiles by ID before locking
4. **Batch Validation:** Pre-compute permissions and descendants
5. **Clear Error Reporting:** Distinguish between partial and full failures

### Database Schema Changes Required

```sql
-- No new tables needed - use existing operation_groups
-- Ensure operation_groups supports batch delete type
ALTER TABLE operation_groups
  ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'cascade_delete';

-- Add index for batch operations
CREATE INDEX IF NOT EXISTS idx_audit_log_operation_group
  ON audit_log_enhanced(operation_group_id)
  WHERE operation_group_id IS NOT NULL;
```

### RPC Function - Phase 1 (Validation Only)

```sql
-- Separate validation from execution for better UX
CREATE OR REPLACE FUNCTION public.validate_batch_delete(
  p_profile_ids UUID[]
)
RETURNS TABLE(
  profile_id UUID,
  can_delete BOOLEAN,
  blocked_reason TEXT,
  has_descendants BOOLEAN,
  descendant_count INTEGER,
  marriages_affected INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_current_user_id UUID;
BEGIN
  -- Limit batch size
  IF array_length(p_profile_ids, 1) > 50 THEN
    RAISE EXCEPTION 'تجاوز الحد الأقصى (50 ملف شخصي لكل دفعة)';
  END IF;

  -- Get current user
  SELECT id INTO v_current_user_id FROM profiles WHERE user_id = auth.uid();
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'غير مصرح';
  END IF;

  -- Batch permission check
  RETURN QUERY
  WITH permission_results AS (
    SELECT * FROM batch_check_deletion_permissions(p_profile_ids)
  ),
  descendant_counts AS (
    SELECT
      parent_id,
      COUNT(*) AS child_count
    FROM (
      SELECT father_id AS parent_id FROM profiles
      WHERE father_id = ANY(p_profile_ids) AND deleted_at IS NULL
      UNION ALL
      SELECT mother_id AS parent_id FROM profiles
      WHERE mother_id = ANY(p_profile_ids) AND deleted_at IS NULL
    ) children
    GROUP BY parent_id
  ),
  marriage_counts AS (
    SELECT
      profile_id,
      COUNT(*) AS marriage_count
    FROM (
      SELECT husband_id AS profile_id FROM marriages
      WHERE husband_id = ANY(p_profile_ids) AND deleted_at IS NULL
      UNION ALL
      SELECT wife_id AS profile_id FROM marriages
      WHERE wife_id = ANY(p_profile_ids) AND deleted_at IS NULL
    ) marriages_data
    GROUP BY profile_id
  )
  SELECT
    pr.profile_id,
    pr.can_delete AND (dc.child_count IS NULL OR dc.child_count = 0) AS can_delete,
    CASE
      WHEN NOT pr.can_delete THEN pr.blocked_reason
      WHEN dc.child_count > 0 THEN 'يوجد ' || dc.child_count || ' من الأبناء/الأحفاد'
      ELSE NULL
    END AS blocked_reason,
    (dc.child_count > 0) AS has_descendants,
    COALESCE(dc.child_count, 0)::INTEGER AS descendant_count,
    COALESCE(mc.marriage_count, 0)::INTEGER AS marriages_affected
  FROM permission_results pr
  LEFT JOIN descendant_counts dc ON dc.parent_id = pr.profile_id
  LEFT JOIN marriage_counts mc ON mc.profile_id = pr.profile_id;
END;
$function$;
```

### RPC Function - Phase 2 (Atomic Execution)

```sql
CREATE OR REPLACE FUNCTION public.execute_batch_delete(
  p_profile_data JSONB,  -- [{id: UUID, version: INTEGER}]
  p_operation_description TEXT DEFAULT 'حذف دفعة'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_current_user_id UUID;
  v_operation_group_id UUID;
  v_profile RECORD;
  v_deleted_count INTEGER := 0;
  v_profile_ids UUID[];
  v_validation RECORD;
  v_all_valid BOOLEAN := TRUE;
  v_failed_validations JSONB := '[]'::JSONB;
BEGIN
  -- Size limit
  IF jsonb_array_length(p_profile_data) > 50 THEN
    RETURN jsonb_build_object('success', false, 'error', 'تجاوز الحد الأقصى (50 ملف)');
  END IF;

  -- Get current user
  SELECT id INTO v_current_user_id FROM profiles WHERE user_id = auth.uid();
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'غير مصرح');
  END IF;

  -- Extract profile IDs for validation
  SELECT array_agg((item->>'id')::UUID) INTO v_profile_ids
  FROM jsonb_array_elements(p_profile_data) AS item;

  -- Pre-validate entire batch (fail fast)
  FOR v_validation IN
    SELECT * FROM validate_batch_delete(v_profile_ids)
  LOOP
    IF NOT v_validation.can_delete THEN
      v_all_valid := FALSE;
      v_failed_validations := v_failed_validations || jsonb_build_object(
        'id', v_validation.profile_id,
        'reason', v_validation.blocked_reason
      );
    END IF;
  END LOOP;

  -- If ANY profile fails validation, abort entire batch
  IF NOT v_all_valid THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'فشل التحقق من الصلاحيات',
      'failed_validations', v_failed_validations
    );
  END IF;

  -- Create operation group for undo support
  INSERT INTO operation_groups (description, operation_type)
  VALUES (p_operation_description, 'batch_delete')
  RETURNING id INTO v_operation_group_id;

  -- Lock profiles in deterministic order (prevent deadlock)
  FOR v_profile IN
    SELECT
      (item->>'id')::UUID AS profile_id,
      (item->>'version')::INTEGER AS expected_version
    FROM jsonb_array_elements(p_profile_data) AS item
    ORDER BY (item->>'id')::UUID  -- Deterministic lock order
  LOOP
    DECLARE
      v_current_version INTEGER;
      v_old_data JSONB;
    BEGIN
      -- Lock row and verify version
      SELECT version, to_jsonb(p.*) INTO v_current_version, v_old_data
      FROM profiles p
      WHERE id = v_profile.profile_id
      FOR UPDATE NOWAIT;

      -- Version conflict check
      IF v_current_version != v_profile.expected_version THEN
        -- Rollback entire batch on version conflict
        RAISE EXCEPTION 'تعارض في النسخة للملف %', v_profile.profile_id;
      END IF;

      -- Soft delete
      UPDATE profiles
      SET deleted_at = NOW(), version = version + 1, updated_by = v_current_user_id
      WHERE id = v_profile.profile_id;

      -- Audit log with operation group linkage
      INSERT INTO audit_log_enhanced (
        table_name, record_id, action_type, actor_id,
        old_data, description, severity, operation_group_id
      )
      VALUES (
        'profiles', v_profile.profile_id, 'batch_delete', auth.uid(),
        v_old_data, p_operation_description, 'high', v_operation_group_id
      );

      v_deleted_count := v_deleted_count + 1;

    EXCEPTION
      WHEN lock_not_available THEN
        -- Rollback entire batch on lock conflict
        RAISE EXCEPTION 'عملية أخرى قيد التنفيذ على الملف %', v_profile.profile_id;
    END;
  END LOOP;

  -- Success: all profiles deleted atomically
  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'operation_group_id', v_operation_group_id
  );
END;
$function$;
```

### Client-Side Integration

**profilesService.js additions:**

```javascript
async validateBatchDelete(profileIds) {
  const { data, error } = await supabase.rpc('validate_batch_delete', {
    p_profile_ids: profileIds
  });
  if (error) throw error;
  return { data, error: null };
}

async executeBatchDelete(profiles, description = 'حذف دفعة') {
  const profileData = profiles.map(p => ({
    id: p.id,
    version: p.version || 1
  }));

  const { data, error } = await supabase.rpc('execute_batch_delete', {
    p_profile_data: profileData,
    p_operation_description: description
  });

  if (error) throw error;
  return { data, error: null };
}
```

**QuickAddOverlay.js integration:**

```javascript
// Step 1: Validate before showing confirmation
const validateDeletions = async () => {
  if (deletedExistingChildren.length === 0) return true;

  const profileIds = deletedExistingChildren.map(c => c.id);
  const { data: validations } = await profilesService.validateBatchDelete(profileIds);

  const blocked = validations.filter(v => !v.can_delete);
  if (blocked.length > 0) {
    Alert.alert(
      'لا يمكن الحذف',
      `${blocked.length} ملف لا يمكن حذفه:\n` +
      blocked.map(b => b.blocked_reason).join('\n')
    );
    return false;
  }

  // Show summary with descendants/marriages warning
  const hasWarnings = validations.some(v => v.marriages_affected > 0);
  if (hasWarnings) {
    const totalMarriages = validations.reduce((sum, v) => sum + v.marriages_affected, 0);
    // Show confirmation with marriage count
  }

  return true;
};

// Step 2: Execute with proper threshold
const handleSave = async () => {
  // ... existing code ...

  if (deletedExistingChildren.length >= 5) {
    // Batch delete (atomic)
    try {
      const { data } = await profilesService.executeBatchDelete(
        deletedExistingChildren,
        `حذف ${deletedExistingChildren.length} أطفال من ${profileName}`
      );

      console.log(`Batch deleted ${data.deleted_count} profiles (group ${data.operation_group_id})`);
    } catch (error) {
      Alert.alert('خطأ في الحذف الجماعي', handleSupabaseError(error));
      return; // Abort save
    }
  } else {
    // Individual deletes (existing pattern)
    for (const child of deletedExistingChildren) {
      await profilesService.deleteProfile(child.id, child.version || 1);
    }
  }

  // ... rest of save logic ...
};
```

## Key Design Decisions

### Decision 1: All-or-Nothing Semantics

**Choice:** Atomic batch deletion (any failure rolls back entire batch)

**Rationale:**
- Clearer UX (no partial success confusion)
- Easier error handling (single try-catch)
- Prevents orphaned state (half-deleted batch)

**Tradeoff:** One bad profile blocks entire batch
**Mitigation:** Pre-validation step catches issues before execution

### Decision 2: Two-Phase Approach

**Phase 1 (Validate):** Check all permissions/descendants without locking
**Phase 2 (Execute):** Atomic transaction with locks

**Rationale:**
- User gets immediate feedback (validation fast)
- Reduces lock hold time (better concurrency)
- Allows user to fix issues before commit

**Tradeoff:** TOCTOU race (state changes between phases)
**Mitigation:** Re-validate critical checks during execution (version, descendants)

### Decision 3: Deterministic Locking

**Implementation:** Sort profiles by UUID before acquiring locks

**Rationale:**
- Prevents circular wait deadlocks
- Predictable behavior for debugging
- Standard database pattern

**Tradeoff:** Slightly slower (sorting overhead)
**Impact:** Negligible (<1ms for 50 UUIDs)

### Decision 4: Hard Batch Size Limit (50)

**Rationale:**
- Transaction timeout protection (50 × 50ms = 2.5s << 30s)
- Memory safety (JSONB array size)
- Reasonable UX (user rarely deletes >50 at once)

**Alternative Considered:** Dynamic batching (split large requests)
**Rejected:** Added complexity, unclear progress UX

## Testing Strategy

### Unit Tests (PostgreSQL)

```sql
-- Test 1: Atomic rollback on permission failure
BEGIN;
  SELECT execute_batch_delete('[{"id": "valid-uuid", "version": 1}, {"id": "blocked-uuid", "version": 1}]');
  -- Expect: Both profiles unchanged
ROLLBACK;

-- Test 2: Version conflict detection
BEGIN;
  UPDATE profiles SET version = 99 WHERE id = 'test-uuid';
  SELECT execute_batch_delete('[{"id": "test-uuid", "version": 1}]');
  -- Expect: Exception raised
ROLLBACK;

-- Test 3: Deadlock prevention
-- Run concurrently from two sessions with reversed order
-- Session A: [uuid1, uuid2], Session B: [uuid2, uuid1]
-- Expect: No deadlock (deterministic ordering)
```

### Integration Tests (React Native)

```javascript
describe('Batch Delete', () => {
  it('should validate before execution', async () => {
    const invalid = await profilesService.validateBatchDelete([profileWithChildren.id]);
    expect(invalid[0].can_delete).toBe(false);
    expect(invalid[0].blocked_reason).toContain('أبناء');
  });

  it('should handle partial validation failures', async () => {
    const result = await profilesService.executeBatchDelete([
      { id: validProfile.id, version: 1 },
      { id: profileWithChildren.id, version: 1 }
    ]);
    expect(result.data.success).toBe(false);
    expect(result.data.failed_validations).toHaveLength(1);
  });

  it('should create operation group for undo', async () => {
    const result = await profilesService.executeBatchDelete([
      { id: leafProfile.id, version: 1 }
    ]);
    expect(result.data.operation_group_id).toBeDefined();

    // Verify undo works
    const undoResult = await supabase.rpc('undo_operation_group', {
      p_group_id: result.data.operation_group_id
    });
    expect(undoResult.data.restored_count).toBe(1);
  });
});
```

## Migration Path

### Phase 1: Deploy Validation Function (Low Risk)

```bash
npm run migrate -- supabase/migrations/20251015120000_batch_delete_validation.sql
```

**Impact:** Read-only function, no breaking changes

### Phase 2: Deploy Execution Function (Medium Risk)

```bash
npm run migrate -- supabase/migrations/20251015121000_batch_delete_execution.sql
```

**Impact:** New write function, test thoroughly in staging

### Phase 3: Update Client Code (High Risk)

```bash
git checkout -b feat/batch-delete-integration
# Update profilesService.js
# Update QuickAddOverlay.js
# Test extensively
```

**Rollback Plan:** Feature flag to disable batch delete (fall back to serial)

## Performance Benchmarks (Expected)

| Profiles | Serial Delete | Batch Delete | Improvement |
|----------|--------------|--------------|-------------|
| 5 | 250ms | 150ms | 1.7x |
| 10 | 500ms | 200ms | 2.5x |
| 20 | 1000ms | 300ms | 3.3x |
| 50 | 2500ms | 600ms | 4.2x |

**Assumptions:**
- 50ms per RPC call (serial)
- Batch validation: 100ms (single RPC)
- Batch execution: 10ms per profile (locked loop)
- Network RTT: 50ms

## Open Questions

1. Should we support >50 profiles with automatic chunking?
2. How to handle concurrent batch deletes from same admin (same children)?
3. Should validation cache results for 5 seconds to prevent double-check?
4. Add progress callback for large batches (UI feedback)?
5. Implement batch restore (inverse operation)?

## Approval Checklist

- [ ] Security review (SECURITY DEFINER implications)
- [ ] Performance testing with 50-profile batch
- [ ] Deadlock testing (concurrent batches)
- [ ] Undo system integration verified
- [ ] Audit log compliance confirmed
- [ ] Error message localization (Arabic)
- [ ] Documentation updated
- [ ] Migration rollback script prepared

## Status: AWAITING APPROVAL

**Recommendation:** Do NOT implement original batch delete proposal. Use this redesign if batch delete is required. Otherwise, serial deletion with loading indicator is acceptable for current use case (typically <10 children).
