# Marriage Deletion System - Executive Summary

**Status**: Critical Issue Identified
**Analysis Document**: `MARRIAGE_DELETION_DEEP_DIVE.md` (1,211 lines)
**Date**: October 23, 2025

---

## The Problem

When a marriage is deleted (especially Munasib marriages), the system **orphans children** by clearing both `father_id` and `mother_id`. This destroys family relationships permanently.

**Example**:
```
Ahmed (father) + Fatima (mother) → Mohammed, Sara (children)

After marriage deletion:
- Mohammed.father_id = Ahmed.id (kept)
- Mohammed.mother_id = NULL (❌ lost forever!)
- Sara.father_id = Ahmed.id (kept)
- Sara.mother_id = NULL (❌ lost forever!)
```

---

## Why It Matters

1. **Data Loss**: Biological relationships erased from database
2. **Genealogy Broken**: Can't trace family lines through mothers
3. **Undo Incomplete**: Current undo doesn't restore mother relationships
4. **UX Confusing**: Users don't know children will lose mothers
5. **Search Fails**: Can't find children by searching mother's name chain

---

## The Root Cause

**File**: `/supabase/migrations/20251018000006_add_munasib_profile_cleanup_to_marriage_delete.sql` (lines 86-116)

```sql
-- Problem: Clears mother_id when deleting Munasib marriage
IF v_wife_profile.hid IS NULL THEN  -- Is Munasib?
    -- If no other marriages
    IF v_wife_other_marriages_count = 0 THEN
        -- Clear mother_id from ALL children ❌
        UPDATE profiles
        SET mother_id = NULL
        WHERE mother_id = v_marriage.wife_id
```

---

## Solution Framework

### Recommended Approach (Option E): Metadata Tracking

**No schema changes required.**

**On marriage deletion**:
1. Track affected children in audit metadata
2. Store original mother_id values
3. Clear mother_id (or keep it - to be decided)
4. Record everything for undo

**On undo**:
1. Read affected children from metadata
2. Restore mother_id from metadata
3. Restore marriage record
4. Full reversibility achieved

**Implementation**: 4-6 hours
**Risk**: LOW (no schema changes)
**Reversibility**: Complete

---

## Alternative Approaches

| Option | Pros | Cons | Risk |
|--------|------|------|------|
| **A: Clear Mother (Current)** | Simple | Permanent data loss | HIGH |
| **B: Mark Marriage as Dissolved** | Preserves relationships | Query complexity | MEDIUM |
| **C: Add Birth Mother Column** | Full history | Schema change | MEDIUM |
| **D: Soft-Delete Mother Ref** | Clean audit trail | Schema change | LOW |
| **E: Metadata Tracking (Recommended)** | No schema changes, reversible | Requires undo logic update | LOW |

---

## Implementation Phases

### Phase 1: Audit Current State (1 hour)
```sql
-- Find orphaned children
SELECT p.id, p.name, p.mother_id, 
       (SELECT deleted_at FROM profiles WHERE id = p.mother_id) as mother_deleted
FROM profiles p
WHERE p.mother_id IS NULL AND p.hid IS NOT NULL
```

### Phase 2: Enhanced Metadata Tracking (2 hours)
- Update `admin_soft_delete_marriage()` RPC
- Store affected children in audit metadata
- No schema changes

### Phase 3: Improved Undo Function (3 hours)
- Create `undo_marriage_delete_v2()`
- Use metadata to restore mother relationships
- Handle edge cases (version conflicts, intervening edits)

### Phase 4: Permission Validation (1 hour)
- Update RelationshipManager.js
- Use RPC instead of raw delete
- Show impact warnings to users

### Phase 5: (Optional) UI Enhancements (4 hours)
- Show children count in confirmation dialog
- Display marriage history in profile
- Activity log shows affected children

---

## Critical Questions for Stakeholders

1. **Should we keep mother references after divorce?**
   - Yes: Keep intact (biological truth)
   - No: Clear to NULL (clean break)
   - Maybe: Mark as "former mother"

2. **How long should deletions be undoable?**
   - Unlimited (like regular updates)
   - 30 days (current policy)
   - 7 days (admin actions only)

3. **Should we prevent deletion if children are Al-Qefari?**
   - Yes: Only allow with special approval
   - No: Allow if admin wants it

4. **For cousin marriages, show both parents?**
   - Yes: Always show complete family tree
   - No: Just show father if marriage dissolved

5. **Require admin review for large deletions?**
   - Yes: If >2 children affected
   - No: Admin is trusted

6. **Update schema in future?**
   - Birth mother history tracking?
   - Marriage status field?
   - Or stay with metadata approach?

---

## Test Coverage

**20+ test cases** covering:
- Simple Munasib marriages
- Cousin marriages  
- Polygamy (multiple spouses)
- Undo scenarios
- Edge cases (double undo, permission errors)
- Relationship calculations
- Performance (100 marriage batch)
- Data integrity

All in: `MARRIAGE_DELETION_DEEP_DIVE.md` Section 9

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Child orphaning | CRITICAL | Metadata tracking, undo support |
| Undo failure | CRITICAL | Enhanced audit data, version checking |
| TOCTOU race | HIGH | Row-level locking, advisory locks |
| Permission bypass | HIGH | RPC validation before delete |
| Data loss | HIGH | Complete audit trail, metadata storage |

---

## Timeline

**Conservative Estimate**:
- Phase 1 (Audit): 1 hour
- Phase 2 (Metadata): 2 hours
- Phase 3 (Undo): 3 hours
- Phase 4 (Permissions): 1 hour
- **Total: 7 hours** (1 working day)

**With Testing & UI**:
- Add 3 hours for comprehensive testing
- Add 4 hours for UI enhancements
- **Total: ~14 hours** (2 working days)

---

## Next Steps

1. **Present** to stakeholders
2. **Decide** on approach (recommend Option E: Metadata Tracking)
3. **Answer** the 6 critical questions
4. **Run** audit query to understand current data state
5. **Implement** Phase 1-4 (no schema changes)
6. **Test** comprehensively
7. **Deploy** with OTA update
8. **(Future)** Consider Phase 5 schema enhancements

---

## Files Referenced

**Core Issue**:
- `/supabase/migrations/20251018000006_add_munasib_profile_cleanup_to_marriage_delete.sql`
- `/supabase/migrations/20251018000007_update_undo_marriage_delete_restore_profiles.sql`

**UI Layer**:
- `/src/components/admin/RelationshipManager.js`
- `/src/components/admin/SpouseManager.js`

**Business Logic**:
- `/src/utils/cousinMarriageDetector.js`
- `/src/services/profiles.js`

**Related Documentation**:
- `/docs/PERMISSION_SYSTEM_V4.md`
- `/docs/UNDO_SYSTEM_TEST_CHECKLIST.md`
- `/docs/SOFT_DELETE_PATTERN.md`

---

## Key Insight

**The current system treats children as secondary to the marriage record.** When a marriage ends, it abandons the children's parent relationships.

**Better approach**: Children come first. When a marriage ends, the children retain their biological parents. The marriage record changes status, but parentage is immutable.

---

**Full Analysis**: `/docs/MARRIAGE_DELETION_DEEP_DIVE.md` (1,211 lines)
