# Marriage Deletion System - Comprehensive Deep-Dive Analysis

**Analysis Date**: October 23, 2025
**Status**: Foundational System Review
**Scope**: Data integrity, UX, system behavior, undo safety

---

## Executive Summary

The current marriage deletion system has a **critical flaw**: it orphans children by clearing `father_id` and `mother_id`, destroying family relationships. When a marriage is deleted (particularly Munasib marriages), children lose both parent references instead of maintaining the father relationship while only clearing the mother.

This deep-dive provides a complete analysis of the system with 9 sections covering data models, business logic, scenarios, UI/UX, alternatives, undo complexity, permissions, migrations, and testing.

---

## 1. DATA MODEL UNDERSTANDING

### 1.1 Schema Relationships

**Profiles Table** (`profiles`)
```sql
id UUID PRIMARY KEY
father_id UUID NULLABLE REFERENCES profiles(id)
mother_id UUID NULLABLE REFERENCES profiles(id)
hid TEXT NULLABLE  -- Historical ID (Al-Qefari family members only)
name TEXT
gender TEXT ('male' | 'female')
deleted_at TIMESTAMPTZ NULLABLE  -- Soft delete timestamp
version INT DEFAULT 1  -- Optimistic locking
```

**Marriages Table** (`marriages`)
```sql
id UUID PRIMARY KEY
husband_id UUID NOT NULL REFERENCES profiles(id)
wife_id UUID NOT NULL REFERENCES profiles(id)
deleted_at TIMESTAMPTZ NULLABLE  -- Soft delete timestamp
created_at TIMESTAMPTZ
UNIQUE(husband_id, wife_id)  -- Prevent duplicate marriages
```

### 1.2 Family Relationships

**Al-Qefari Members** (`hid IS NOT NULL`)
- Has a Historical ID (e.g., "R1.2.3")
- Part of main family tree
- Can marry other Al-Qefari members (cousin marriages)
- Can marry Munasib (spouses from other families)

**Munasib** (`hid IS NULL`)
- Spouses from other families
- No Historical ID
- Cannot have their own children in tree (they're junction points)
- When they remarry outside the family, their profile can be deleted if orphaned

### 1.3 Parentage Representation

```
Profile.father_id → Link to paternal parent
Profile.mother_id → Link to maternal parent

Both can be NULL independently:
- father_id = NULL, mother_id = Alice  (unusual, means father unknown)
- father_id = Ahmed, mother_id = NULL  (new after marriage deletion)
- father_id = Ahmed, mother_id = Alice (normal, both parents)
- father_id = NULL, mother_id = NULL   (orphaned, root profiles)
```

### 1.4 Calculated/Dependent Fields

Fields that depend on parent references:
- `generation` - Calculated from parent generations (not dependent, stored independently)
- `name_chain` - Built from parents for search indexing
- `sibling_order` - Position among children of same parents
- Relationship types (sibling, cousin, etc.) - Calculated from parent paths

**Critical**: If `mother_id` is set but parent is deleted, relationship calculations may fail.

---

## 2. BUSINESS LOGIC IMPACT

### 2.1 Current System Behavior

**Location**: `/supabase/migrations/20251018000006_add_munasib_profile_cleanup_to_marriage_delete.sql`

```sql
-- Current: When deleting marriage to wife (Munasib)
IF v_wife_profile.hid IS NULL THEN  -- Is Munasib?
    -- Check for other active marriages
    SELECT COUNT(*) WHERE wife_id = v_marriage.wife_id AND deleted_at IS NULL
    
    IF no other marriages THEN
        -- PROBLEM: Clear mother_id from ALL children
        UPDATE profiles
        SET mother_id = NULL
        WHERE mother_id = v_marriage.wife_id
```

**Impact**: Children lose their mother relationship entirely.

### 2.2 RPC Functions That Query Parent References

**Direct queries**:
- `get_branch_data()` - Fetches subtree using `father_id` and `mother_id`
- `search_name_chain()` - Builds search index from parent chain
- `check_family_permission_v4()` - Calculates relationships via parent traversal

**Indirect impact**:
- `admin_update_profile()` - Can change `father_id`, `mother_id`
- `build_name_chain()` - Used in profile creation, depends on parents existing

### 2.3 Relationship Calculation Logic

**File**: `src/utils/cousinMarriageDetector.js`

```javascript
export function isAlQefariMember(profile) {
  return profile.hid !== null && profile.hid !== undefined;
}

export function isCousinMarriage(profile1, profile2) {
  // Returns true if BOTH have hid !== null
  return isAlQefariMember(profile1) && isAlQefariMember(profile2);
}
```

**Current behavior**:
- Cousin detection based on `hid` field, NOT parent relationships
- Does NOT traverse parent chains to determine cousins
- Marriage type determined by both spouses' family membership

**Risk**: If parent references are cleared, cousin detection still works (uses `hid`), BUT:
- Direct parent relationships are lost
- Children's generation calculations may be off
- Sibling relationships become ambiguous

### 2.4 Tree Rendering Algorithm

The `TreeView` component likely:
1. Queries `father_id` to position nodes horizontally
2. Queries `mother_id` for secondary parent path in dual-parent rendering
3. Calculates node positioning based on parent coordinates
4. Renders children below parent(s)

**If mother_id is NULL**: Tree may render children with only father link visible.

---

## 3. SCENARIO ANALYSIS

### Scenario 1: Simple Munasib Marriage (First & Only)

**Initial State**:
```
Ahmed (Al-Qefari, hid=R1.2.3) married Fatima (Munasib, hid=NULL)
Children: Mohammed, Sara (both hid=R1.2.3.1, R1.2.3.2)
- Mohammed.father_id = Ahmed.id, Mohammed.mother_id = Fatima.id
- Sara.father_id = Ahmed.id, Sara.mother_id = Fatima.id
```

**Delete Marriage(Ahmed + Fatima)**:

Current system:
```
1. Set marriages[marriage_id].deleted_at = NOW()
2. Fatima is Munasib (hid IS NULL)
3. Fatima has no other marriages
4. ❌ UPDATE profiles SET mother_id = NULL WHERE mother_id = Fatima.id
   → Mohammed.father_id = Ahmed.id, Mohammed.mother_id = NULL ❌
   → Sara.father_id = Ahmed.id, Sara.mother_id = NULL ❌
5. ✅ DELETE Fatima profile (soft-delete)
```

**Desired behavior**:
```
1. Set marriages[marriage_id].deleted_at = NOW()
2. Fatima is Munasib (hid IS NULL)
3. Fatima has no other marriages
4. ✅ Keep mother_id intact OR explicitly handle as "former mother"
   → Mohammed.father_id = Ahmed.id, Mohammed.mother_id = Fatima.id (or NULL if required)
   → Sara.father_id = Ahmed.id, Sara.mother_id = Fatima.id (or NULL if required)
5. ✅ DELETE Fatima profile (soft-delete)
```

**Questions**:
- Should we keep Fatima.mother_id = Fatima.id even though she's soft-deleted?
- How does tree rendering handle parent references to deleted profiles?
- Should we mark children as "half-siblings" if only one parent is cleared?

### Scenario 2: Multiple Marriages (Polygamy)

**Initial State**:
```
Ali (hid=R1.2) married:
  - Fatima (Munasib, hid=NULL) → Children: Mohammed, Sara
  - Noor (Munasib, hid=NULL) → Children: Ahmed, Layla
  - Maryam (Al-Qefari, hid=R1.2.1) → Child: Hassan

Ali.marriages = [
  {id: m1, wife: Fatima},
  {id: m2, wife: Noor},
  {id: m3, wife: Maryam}
]
```

**Delete Ali + Fatima marriage**:

Current system:
```
1. m1.deleted_at = NOW()
2. Fatima is Munasib, has no other marriages (only Ali)
3. Delete Fatima profile
4. ❌ Clear mother_id from Mohammed, Sara
   Result: Mohammed, Sara orphaned on mother side
```

**Ali's profile now shows**:
- 4 total children (Mohammed, Sara, Ahmed, Layla, Hassan)
- Mohammed, Sara have no mother in UI
- Ahmed, Layla have mother=Noor
- Hassan has mother=Maryam

**Desired behavior**:
- Keep mother relationships intact or explicitly mark as "former"
- Children understand "this was my birth mother, marriage dissolved"
- Ali's profile clearly shows 2 children from first marriage (no longer active)

### Scenario 3: Cousin Marriage Dissolution

**Initial State**:
```
Ali (Al-Qefari, hid=R1.2) married Fatima (Al-Qefari, hid=R1.3)
Children: Hassan (hid=R1.2.1) - inherits Al-Qefari status
```

**Delete Ali + Fatima marriage**:

Current system:
```
1. m1.deleted_at = NOW()
2. Fatima.hid IS NOT NULL (is Al-Qefari), so:
   → Do NOT delete Fatima profile ✅
   → DO clear mother_id from Hassan ❌
   Result: Hassan.father_id = Ali.id, Hassan.mother_id = NULL
```

**Issues**:
- Hassan still recognized as Al-Qefari (has hid)
- But family tree shows only father, no mother (confusing UI)
- Genealogy calculations miss Fatima's family line
- If analyzing "who did Hassan's lineage come from", mother side is lost

**Desired behavior**:
- Keep Hassan.mother_id = Fatima.id
- Mark marriage as "past" or "dissolved" in marriages table
- Tree shows both parents, but indicates marriage is no longer active
- Hassan still knows both family lines

### Scenario 4: Undo After Editing Child Profile

**Initial State**:
```
Ahmed (father) + Fatima (mother) → Mohammed (child)
Mohammed.version = 1, Mohammed.father_id = Ahmed.id, Mohammed.mother_id = Fatima.id
```

**Timeline**:
```
T1: Delete marriage
    - Mohammed.mother_id = NULL
    - audit_log created with old_data containing "mother_id: Fatima.id"

T2: User edits Mohammed's name
    - UPDATE profiles SET name = 'Mohammad', version = 2 WHERE id = Mohammed.id
    - audit_log created for name edit

T3: Admin tries to UNDO the marriage deletion
    - Reads audit_log entry from T1
    - Tries to restore mother_id from old_data
    - But Mohammed.version is now 2 (was 1 when marriage was deleted)
    - ❓ Should we restore mother_id despite version conflict?
    - ❓ What if mother's profile was deleted in the meantime?
```

**Undo Function Issues**:

Current `undo_marriage_delete()`:
```sql
-- STEP 1: Restore deleted profiles (if any)
UPDATE profiles SET deleted_at = NULL WHERE id = v_deleted_profile_ids[i]

-- STEP 2: Restore parent references
UPDATE profiles
SET father_id = v_profile_record.id
WHERE father_id IS NULL
AND id IN (SELECT id FROM profiles WHERE mother_id = v_marriage.husband_id OR mother_id = v_marriage.wife_id)
```

**Gap**: Doesn't restore mother_id to children! Only restores father_id.

If marriage deletion cleared mother_id, and then undo tries to restore:
- Mother's profile is restored ✅
- But children's mother_id is still NULL ❌
- Migration 20251018000007 only handles father references, NOT mother references

---

## 4. UI/UX IMPLICATIONS

### 4.1 Marriage Deletion Confirmation Dialog

**Current** (in RelationshipManager.js):
```javascript
Alert.alert(
  "تأكيد الحذف",
  "هل تريد حذف هذا الزواج؟",
  [
    { text: "إلغاء", style: "cancel" },
    { text: "حذف", style: "destructive", onPress: () => {
        // Calls: admin_soft_delete_marriage(marriage_id)
      }}
  ]
);
```

**Problem**: No warning about children impact! User doesn't know:
- How many children will be affected
- That mother references will be cleared
- Whether children will become orphaned

**Desired UX**:
```
Title: "تأكيد حذف الزواج"

Message: "سيؤدي حذف هذا الزواج إلى:
- إلغاء الزواج من [spouse name]
- تعديل بيانات الأطفال: محمد، سارة [count]
- الاحتفاظ بـ [spouse name] كالأم البيولوجية
- يمكن التراجع عن هذا الإجراء"

Actions:
[إلغاء] [حذف على المسؤولية]
```

### 4.2 Profile Display After Marriage Deletion

**Current**:
- Ali's profile shows "أم الأطفال: [none visible]"
- Mohammed's profile shows "الأب: Ahmed, الأم: [empty]"
- Tree renders Mohammed only under Ahmed, not Fatima

**Desired**:
- Profile shows marriage history: "متزوج من فاطمة (2010-2020)"
- Children show: "الأب: Ahmed, الأم: فاطمة (زواج منحل)"
- Tree shows both parents, with marriage status visual indicator
- Option to "restore marriage" instead of complete deletion

### 4.3 Activity Log Presentation

**Current**: Activity log shows marriage deleted, but doesn't show children affected

**Desired**:
```
حذف الزواج من فاطمة
تم تعديل البيانات المتعلقة بـ: 2 أطفال
- محمد (عدل: mother_id من فاطمة.id إلى NULL)
- سارة (عدل: mother_id من فاطمة.id إلى NULL)

[التراجع] [التفاصيل]
```

### 4.4 Search & Relationship Display

**If mother references are cleared**:
- Search name_chain might fail to find children via mother's lineage
- Cousin detection still works (based on hid, not parents)
- But genealogy reports showing "descendants of Fatima" would miss Mohammed

---

## 5. ALTERNATIVE APPROACHES

### Option A: Clear Mother Only (Current Proposal)

**Approach**:
```sql
DELETE marriage
    ↓
IF spouse is Munasib with no other marriages:
    UPDATE profiles SET mother_id = NULL WHERE mother_id = spouse.id
    SOFT DELETE spouse profile
```

**Pros**:
- Simple implementation
- Clear, unambiguous state
- Reduces data footprint

**Cons**:
- **Loses biological relationship permanently** (even in audit log, might be hard to recover)
- Children show incomplete family tree
- Genealogy calculations miss one parent
- Undo operation needs extra logic to track what was cleared

**Risk Level**: HIGH - Data loss of family relationships

---

### Option B: Keep Mother Reference, Mark Marriage as "Dissolved"

**Approach**:
```sql
ALTER TABLE marriages ADD COLUMN status TEXT DEFAULT 'current'; -- 'current', 'past', 'dissolved'

DELETE marriage
    ↓
UPDATE marriages SET status = 'dissolved', deleted_at = NOW() WHERE id = marriage_id
-- children.mother_id remains intact
-- profile UI shows "زواج سابق" badge
```

**Pros**:
- Preserves all biological relationships
- Clear indication of marriage status
- Easier to display "ex-spouse" vs "current spouse"
- Undo is simple (just clear deleted_at, reset status)

**Cons**:
- Children still technically "linked" to deleted/former parent
- Query complexity increases (must filter by status)
- Risk of showing deceased mother as current in some screens

**Risk Level**: MEDIUM - Requires consistent status checking in UI

---

### Option C: Add "Birth Mother" History Column

**Approach**:
```sql
ALTER TABLE profiles ADD COLUMN birth_mother_id UUID NULLABLE;
-- Immutable, stores original mother at birth
-- Allows changing current mother without losing history

DELETE marriage
    ↓
-- Clear active mother_id
UPDATE profiles SET mother_id = NULL WHERE mother_id = spouse.id
-- But birth_mother_id remains for historical reference
```

**Pros**:
- Preserves complete biological history
- Can show "born to" vs "raised by" distinction
- Enables complex family reconstructions
- Undo can verify birth_mother before restoring

**Cons**:
- Schema change required (migration)
- Added complexity to profile management
- Need to establish rule: "if birth_mother is deleted, what happens?"

**Risk Level**: MEDIUM - Schema migration risk, but good long-term solution

---

### Option D: Soft-Delete Mother Reference Instead of Hard-Clear

**Approach**:
```sql
ALTER TABLE profiles ADD COLUMN mother_id_deleted_at TIMESTAMPTZ NULLABLE;

DELETE marriage
    ↓
UPDATE profiles 
SET mother_id_deleted_at = NOW() 
WHERE mother_id = spouse.id  -- Keep mother_id, but mark as deleted
```

**Pros**:
- Full audit trail of mother relationship
- Can distinguish "never had mother" vs "had mother, relationship ended"
- Undo simply clears mother_id_deleted_at
- Query logic: `WHERE mother_id = X AND mother_id_deleted_at IS NULL`

**Cons**:
- Requires schema change (migration)
- Query logic becomes more complex everywhere `mother_id` is used
- Performance impact from additional WHERE clause

**Risk Level**: LOW - Clean audit trail, minimal code impact

---

### Option E (Recommended): Track Mother in Audit Metadata

**Approach**:
```
NO schema changes. Keep everything in audit logs.

DELETE marriage
    ↓
IF spouse is Munasib with no other marriages:
    -- Collect children to be affected
    v_affected_children = SELECT id, mother_id FROM profiles WHERE mother_id = spouse.id
    
    -- Clear mother_id
    UPDATE profiles SET mother_id = NULL WHERE mother_id = spouse.id
    
    -- Store audit metadata with complete history
    INSERT INTO audit_log_enhanced (
        action_type: 'marriage_soft_delete',
        old_data: {...marriage data...},
        new_data: {deleted_at: NOW()},
        metadata: {
            affected_children: [
                {id, name, original_mother_id},
                {id, name, original_mother_id}
            ],
            deleted_profiles: [spouse.id]
        }
    )
```

**Undo operation**:
```sql
undo_marriage_delete(audit_log_id)
    ↓
1. Read affected_children from metadata
2. Restore marriage (clear deleted_at)
3. Restore deleted profiles
4. For each affected child:
   UPDATE profiles 
   SET mother_id = {original_mother_id}
   WHERE id = {child_id}
```

**Pros**:
- NO schema changes needed
- Complete audit trail in metadata
- Undo is straightforward and reversible
- Can report "this child lost their mother link" in activity log

**Cons**:
- Requires updating undo_marriage_delete() logic
- Metadata becomes richer (but this is good)

**Risk Level**: LOW - No schema changes, metadata-based tracking

---

## 6. UNDO COMPLEXITY

### 6.1 Current Undo Implementation

**File**: `supabase/migrations/20251018000007_update_undo_marriage_delete_restore_profiles.sql`

Current undo logic:
```sql
-- STEP 1: Restore deleted profiles
UPDATE profiles SET deleted_at = NULL WHERE id IN (v_deleted_profile_ids)

-- STEP 2: Restore parent references in children
UPDATE profiles
SET father_id = v_profile_record.id
WHERE father_id IS NULL
  AND id IN (
    SELECT id FROM profiles
    WHERE (mother_id = v_marriage.husband_id OR mother_id = v_marriage.wife_id)
      AND deleted_at IS NULL
  )
  AND v_profile_record.id = v_marriage.husband_id;

UPDATE profiles
SET mother_id = v_profile_record.id
WHERE mother_id IS NULL
  AND id IN (...)
  AND v_profile_record.id = v_marriage.wife_id;
```

**Issue**: This assumes:
1. Children still have mother_id = NULL when undo is called
2. We can determine which children were affected by checking for NULL
3. No other operations touched the mother_id field

### 6.2 TOCTOU (Time-of-Check-Time-of-Use) Risk

**Scenario**:
```
T1: Marriage deleted
    mother_id = NULL set for children

T2: Child profile edited (name changed)
    - UPDATE profiles SET name = 'new_name', updated_at = NOW()

T3: Admin tries to undo marriage
    - Reads audit_log
    - Looks for children with mother_id = NULL
    - Finds none (because only Mohammed had mother set to NULL, but mother might have been set to someone else)
    - ❌ Fails to restore mother to affected children
```

### 6.3 Version Conflict During Undo

**Scenario**:
```
T1: Married marriage (version = 1)
    audit_log.old_data = {version: 1}

T2: Child profile edited
    UPDATE profiles SET name = 'new_name', version = 2

T3: Undo marriage deletion
    - Read audit_log.old_data
    - Extract mother_id from old_data
    - But child.version is now 2, was 1 when mother_id was cleared
    - ❓ Do we restore to old_data state (version 1 data)?
    - ❓ Or do we only restore mother_id, leaving version at 2?
```

### 6.4 Improved Undo Design

**Required changes to `admin_soft_delete_marriage()`**:

```sql
-- When clearing parent references, ALSO store detailed audit info
INSERT INTO audit_log_enhanced (
    action_type: 'marriage_soft_delete',
    metadata: {
        -- CRITICAL for undo: track exactly what was cleared
        affected_children: [
            {
                child_id: UUID,
                child_name: TEXT,
                original_mother_id: UUID,
                original_father_id: UUID,
                child_version: INT
            }
        ],
        deleted_profile_ids: UUID[],
        marriage_reason_for_deletion: TEXT -- track why it was deleted
    }
)
```

**New undo function `undo_marriage_delete_v2()`**:

```sql
undo_marriage_delete_v2(p_audit_log_id, p_undo_reason)
    ↓
1. Idempotency check: if already undone, error
2. Read metadata.affected_children
3. For each child:
   a. Lock child profile (SELECT FOR UPDATE NOWAIT)
   b. Verify version hasn't diverged too far
   c. Restore mother_id from metadata
   d. DON'T touch version (version conflict detected, admin notified)
   e. Create audit entry: {action: 'child_parent_restored', old_data, new_data}
4. Restore marriage (clear deleted_at)
5. Restore deleted profiles (clear deleted_at)
6. Mark original audit log undone
```

---

## 7. PERMISSION & AUTHORIZATION

### 7.1 Current Permission Model

**File**: `src/components/admin/RelationshipManager.js`

```javascript
const handleDeleteMarriage = async (marriageId) => {
  // NO permission check shown!
  // Just calls supabase from('marriages').delete()
}
```

**Missing**: Permission validation!

### 7.2 Who Should be Able to Delete Marriages?

**Rules**:
1. **Super Admin** - Can delete any marriage ✅
2. **Admin** - Can delete any marriage ✅
3. **Moderator** - Can delete marriage only if:
   - Both spouses in their assigned branch, OR
   - One spouse in their branch AND other is Munasib
4. **Regular User** - Can delete only:
   - Their own marriage, OR
   - Their spouse's other marriages (if permitted by admin)

### 7.3 Child Impact Authorization

**When deleting a marriage that affects children**:
- Current system: No special authorization
- **Proposed**: Require explicit admin review if:
  - More than 2 children affected
  - Children are Al-Qefari (hid IS NOT NULL)
  - Deleting a cousin marriage

---

## 8. MIGRATION STRATEGY

### 8.1 Changes Required

**Phase 1: Enhanced Audit Tracking (NO schema changes)**
```sql
-- Update admin_soft_delete_marriage() to store detailed metadata
-- about affected children and what will be cleared

Affected: Migration to replace 20251018000006
Timeline: 1-2 hours
Risk: LOW - Only affects metadata, not data
```

**Phase 2: Improved Undo Function (NO schema changes)**
```sql
-- Create new undo_marriage_delete_v2() that uses enhanced metadata
-- Make it the new default in undoService.js

Affected: New RPC function, update undoService registry
Timeline: 2-3 hours
Risk: LOW - New function, doesn't affect existing undo
```

**Phase 3: Permission Validation (App code)**
```javascript
// Update RelationshipManager.js to validate permissions
// Call admin_soft_delete_marriage() instead of raw delete()

Affected: RelationshipManager.js
Timeline: 1 hour
Risk: LOW - Just adding validation before delete
```

**Phase 4: Optional Schema Enhancement (Future)**
```sql
-- If long-term need for parent relationship history:
ALTER TABLE profiles ADD COLUMN birth_mother_id UUID NULLABLE;
ALTER TABLE profiles ADD COLUMN mother_id_deleted_at TIMESTAMPTZ NULLABLE;

-- Or:
ALTER TABLE marriages ADD COLUMN status TEXT DEFAULT 'current';

Affected: Complex schema migration
Timeline: 4-6 hours (testing required)
Risk: MEDIUM - Schema change affects all parent-related queries
```

### 8.2 Data Cleanup (Current Data State)

**Action**: Audit current data to find orphaned children
```sql
SELECT 
    p.id, p.name, p.father_id, p.mother_id, p.deleted_at,
    CASE 
        WHEN p.father_id IS NULL AND p.mother_id IS NULL THEN 'completely orphaned'
        WHEN p.father_id IS NULL AND p.mother_id IS NOT NULL THEN 'missing father'
        WHEN p.father_id IS NOT NULL AND p.mother_id IS NULL THEN 'missing mother'
    END as orphan_type,
    (SELECT deleted_at FROM profiles WHERE id = p.father_id) as father_status,
    (SELECT deleted_at FROM profiles WHERE id = p.mother_id) as mother_status
FROM profiles p
WHERE 
    (p.father_id IS NULL OR p.mother_id IS NULL)
    AND p.deleted_at IS NULL
    AND p.hid IS NOT NULL  -- Al-Qefari only (Munasib shouldn't have children)
ORDER BY p.generation, p.created_at;
```

**Findings needed**:
- How many Al-Qefari children are missing mother_id?
- How many have deleted_at mothers?
- How many have deleted_at fathers?

**Cleanup**:
```sql
-- For children with deleted mothers, create family reunion records
-- OR restore mother_id from audit logs (if available)
```

---

## 9. COMPREHENSIVE TEST CASES

### 9.1 Core Marriage Deletion Tests

#### Test Case 1.1: Simple Munasib Marriage Deletion
**Setup**:
- Ahmed (Al-Qefari) married Fatima (Munasib)
- 2 children: Mohammed, Sara

**Test**:
```javascript
describe('Marriage Deletion - Simple Munasib', () => {
  it('should preserve child father_id when deleting Munasib marriage', async () => {
    const marriage = // fetch marriage
    const childrenBefore = // fetch Mohammed, Sara
    
    await admin_soft_delete_marriage(marriage.id)
    
    const childrenAfter = // fetch Mohammed, Sara
    expect(childrenAfter[0].father_id).toBe(childrenBefore[0].father_id)
    expect(childrenAfter[0].mother_id).toBe(childrenBefore[0].mother_id)  // Should NOT be cleared
  })
})
```

**Assertions**:
- Marriage.deleted_at is set ✅
- Children.father_id unchanged ✅
- Children.mother_id unchanged (or tracked in metadata) ✅
- Fatima profile soft-deleted ✅
- Audit log entry created with affected_children metadata ✅

#### Test Case 1.2: Cousin Marriage Deletion
**Setup**:
- Ali (Al-Qefari) married Fatima (Al-Qefari)
- 1 child: Hassan

**Test**:
```javascript
it('should preserve child relationships for cousin marriages', async () => {
  const marriage = // Ali + Fatima
  await admin_soft_delete_marriage(marriage.id)
  
  const hassan = // fetch Hassan
  expect(hassan.father_id).toBe(ali.id)
  expect(hassan.mother_id).toBe(fatima.id)  // Should NOT be cleared
})
```

**Assertions**:
- Marriage.deleted_at is set ✅
- Fatima profile NOT deleted (is Al-Qefari) ✅
- Hassan father and mother both intact ✅

#### Test Case 1.3: Polygamy (Multiple Marriages)
**Setup**:
- Ali married to Fatima (Munasib) → 2 children
- Ali married to Noor (Munasib) → 2 other children
- Ali married to Maryam (Al-Qefari) → 1 child

**Test**:
```javascript
it('should only affect children of deleted marriage', async () => {
  const m1 = // Ali + Fatima
  await admin_soft_delete_marriage(m1.id)
  
  const aliChildren = // fetch all Ali's children
  expect(aliChildren.filter(c => c.mother_id === fatima.id)).toHaveLength(2)
  expect(aliChildren.filter(c => c.mother_id === noor.id)).toHaveLength(2)
  expect(aliChildren.filter(c => c.mother_id === maryam.id)).toHaveLength(1)
})
```

**Assertions**:
- Fatima's children keep mother_id = fatima.id ✅
- Noor's children unchanged ✅
- Maryam's children unchanged ✅

### 9.2 Undo/Restoration Tests

#### Test Case 2.1: Undo Restores Mother References
**Setup**:
- Delete marriage (with new metadata tracking)
- Call undo_marriage_delete()

**Test**:
```javascript
it('should restore mother_id to children when undoing marriage deletion', async () => {
  const marriage = // Ali + Fatima
  const auditLogId = // store before delete
  
  await admin_soft_delete_marriage(marriage.id)
  const childrenAfterDelete = // fetch
  
  await undo_marriage_delete(auditLogId, 'testing')
  const childrenAfterUndo = // fetch
  
  expect(childrenAfterUndo[0].mother_id).toBe(fatima.id)
  expect(childrenAfterUndo[0].mother_id).not.toBeNull()
})
```

**Assertions**:
- Marriage.deleted_at cleared ✅
- Children mother_id restored ✅
- Original audit log marked undone ✅
- New audit log entry created ✅

#### Test Case 2.2: Undo with Intervening Edits
**Setup**:
- Delete marriage
- Edit child's name (separate operation)
- Try to undo

**Test**:
```javascript
it('should handle undo when child was edited after marriage deletion', async () => {
  const marriage = // Ali + Fatima
  const auditLogId = await admin_soft_delete_marriage(marriage.id)
  
  // Edit child's name
  await profilesService.updateProfile(child.id, {name: 'new_name'})
  
  // Now undo should still work
  const result = await undo_marriage_delete(auditLogId, 'fixing')
  
  expect(result.success).toBe(true)
  const childAfter = // fetch
  expect(childAfter.name).toBe('new_name')  // Name change preserved
  expect(childAfter.mother_id).toBe(fatima.id)  // Mother restored
})
```

**Assertions**:
- Undo succeeds despite intervening edits ✅
- Name change preserved ✅
- Mother_id restored ✅
- Version field properly managed ✅

### 9.3 Edge Cases & Error Handling

#### Test Case 3.1: Undo Already Undone Action
```javascript
it('should prevent double-undo of same marriage deletion', async () => {
  const marriage = // ...
  const auditLogId = await admin_soft_delete_marriage(marriage.id)
  
  await undo_marriage_delete(auditLogId, 'reason1')
  const result2 = await undo_marriage_delete(auditLogId, 'reason2')
  
  expect(result2.success).toBe(false)
  expect(result2.error).toContain('already been undone')
})
```

#### Test Case 3.2: Permission Validation
```javascript
it('should prevent non-admin from deleting marriages outside their scope', async () => {
  const moderator = // branch moderator
  const marriage = // between someone else's branch
  
  const result = await admin_soft_delete_marriage(marriage.id, moderator)
  
  expect(result.success).toBe(false)
  expect(result.error).toContain('permissions')
})
```

#### Test Case 3.3: Deleting Marriage with No Children
```javascript
it('should handle marriage deletion with zero children', async () => {
  const marriage = // Ali + Fatima, no children
  
  const result = await admin_soft_delete_marriage(marriage.id)
  
  expect(result.success).toBe(true)
  expect(result.deleted_profile_ids).toContain(fatima.id)
})
```

#### Test Case 3.4: Deleting Marriage When Spouse is Father of Other Children
```javascript
it('should handle when spouse father other children outside this marriage', async () => {
  // Fatima had child before marriage to Ahmed
  // Then married Ahmed, had more children
  
  const result = await admin_soft_delete_marriage(marriage.id)
  
  // Children from Ahmed should be affected
  // Children before Ahmed should NOT be affected
  // Only one marriage per couple should be deleted
})
```

### 9.4 Relationship Calculation Tests

#### Test Case 4.1: Cousin Detection After Marriage Deletion
```javascript
it('should still detect cousin marriages after parent marriage deletion', async () => {
  // Delete Ali+Fatima marriage
  // Check if Hassan's children can detect cousin marriages with Ali's other children
  
  const cousinMarriages = detectCousinMarriage(hassan, nodesMap)
  
  // Should still work because cousin detection uses hid, not parent relationships
  expect(cousinMarriages).toBeTruthy()
})
```

#### Test Case 4.2: Search Name Chain After Mother Deleted
```javascript
it('should find children when searching by mother name after marriage deletion', async () => {
  const results = await supabase.rpc('search_name_chain', {
    p_names: ['fatima'],
    p_limit: 50
  })
  
  // Should find children of Fatima even if mother_id was cleared?
  // Depends on implementation of search_name_chain
})
```

### 9.5 Performance & Integrity Tests

#### Test Case 5.1: Large Batch Marriage Deletion
```javascript
it('should handle deletion of 100 marriages without timeout', async () => {
  const marriages = // 100 marriages with Munasib
  const start = Date.now()
  
  for (const marriage of marriages) {
    await admin_soft_delete_marriage(marriage.id)
  }
  
  const duration = Date.now() - start
  expect(duration).toBeLessThan(30000)  // Should complete in 30 seconds
})
```

#### Test Case 5.2: Referential Integrity
```javascript
it('should maintain referential integrity after marriage deletion', async () => {
  await admin_soft_delete_marriage(marriage.id)
  
  const orphaned = await supabase
    .from('profiles')
    .select('id')
    .not('father_id', 'is', null)
    .not('father_id', 'in', '(SELECT id FROM profiles WHERE deleted_at IS NOT NULL)')
  
  // Check mother_id doesn't reference deleted profiles
  const orphanedMothers = await supabase.rpc('find_orphaned_mother_references')
  
  expect(orphanedMothers).toHaveLength(0)
})
```

---

## 10. RISK ASSESSMENT

### 10.1 Critical Risks

| Risk | Severity | Probability | Impact | Mitigation |
|------|----------|-------------|--------|-----------|
| **Child Orphaning** | CRITICAL | HIGH | Lose family relationships permanently | Comprehensive audit, metadata tracking |
| **Undo Failure** | CRITICAL | MEDIUM | Can't restore broken relationships | Enhanced metadata, version checking |
| **TOCTOU Race** | HIGH | MEDIUM | Concurrent edits lose changes | Row-level locking, advisory locks |
| **Permission Bypass** | HIGH | LOW | Non-admin deletes marriages | Validate permissions in RPC |

### 10.2 Data Loss Risks

**Current State** (unverified):
- Unknown number of children with missing mother_id
- Unknown how many need recovery
- Audit log may not have enough data for recovery

**Before Implementation**:
1. Run diagnostic query from Section 8.2
2. Document current orphan count
3. Decide if remediation needed

### 10.3 Backward Compatibility

**No Breaking Changes If**:
- Keep `admin_soft_delete_marriage()` interface the same
- New undo function separate from old (keep old for legacy)
- Metadata added to audit_log (always backward compatible)

**Breaking Changes If**:
- Add required schema changes (birth_mother_id, etc.)
- Require UI changes to display new fields
- Change marriage.status field behavior

---

## 11. RECOMMENDED IMPLEMENTATION PATH

### Phase 1: Analysis & Audit (Today)
```
1. Run orphan diagnostic query
2. Document current state of father_id, mother_id references
3. Check how many children would be affected by current system
4. Verify undo function is working correctly
5. Identify any existing data inconsistencies
```

### Phase 2: Enhanced Metadata Tracking (This Week)
```
Migrati on: Update admin_soft_delete_marriage() to track affected_children in metadata
- No schema changes
- Full audit trail captured
- Undo can use this data

Timeline: 2 hours
Risk: LOW
Testing: Add tests from Section 9.1
```

### Phase 3: Improved Undo Function (This Week)
```
Migration: Create undo_marriage_delete_v2()
- Uses enhanced metadata
- Better error handling
- Proper version management

Timeline: 3 hours
Risk: LOW (new function)
Testing: Add tests from Section 9.2
```

### Phase 4: Permission Validation (This Week)
```
Update: RelationshipManager.js
- Use admin_soft_delete_marriage() RPC instead of raw delete()
- Validate permissions before deletion
- Show impact information to user

Timeline: 1 hour
Risk: LOW
Testing: Add tests from Section 9.3
```

### Phase 5: (Future) Optional Schema Enhancement
```
Only if business requires:
- Full parent history tracking
- Complex genealogy reporting
- Genealogist-grade family tree data

Consider: birth_mother_id column or mother_id_deleted_at tracking
Timeline: 4-6 hours
Risk: MEDIUM (schema change)
```

---

## 12. OPEN QUESTIONS FOR STAKEHOLDER

1. **Should children keep mother references after marriage deletion?**
   - Keep intact (preferred)
   - Clear to NULL (current)
   - Mark as "former" (new approach)

2. **How long should marriage deletion be undoable?**
   - Unlimited (like regular updates)
   - 30 days (like other undo actions)
   - 7 days (for admin actions only)

3. **Should deleting a Munasib profile also be reversible?**
   - Only the marriage deletion (current)
   - Both marriage AND profile deletion (preferred)

4. **What about children in deleted profiles?**
   - Should they be restored too when undoing?
   - Should we prevent deletion if children are Al-Qefari?

5. **For cousin marriages, should we show both parents or just father?**
   - Keep full family tree (both parents visible)
   - Mark as "past marriage" (show status)
   - Store genealogy history separately

6. **Should admins need approval to delete marriages with many children?**
   - Yes, add a review step
   - No, admin should be trusted
   - Only if > 5 children affected

---

## 13. REFERENCES

### Code Files
- `/supabase/migrations/20251018000006_add_munasib_profile_cleanup_to_marriage_delete.sql` - Current implementation
- `/supabase/migrations/20251018000007_update_undo_marriage_delete_restore_profiles.sql` - Current undo
- `/src/components/admin/RelationshipManager.js` - UI for marriage deletion
- `/src/components/admin/SpouseManager.js` - Marriage creation
- `/src/utils/cousinMarriageDetector.js` - Relationship calculation
- `/src/services/profiles.js` - Profile service layer

### Documentation
- `/docs/PERMISSION_SYSTEM_V4.md` - Permission rules
- `/docs/UNDO_SYSTEM_TEST_CHECKLIST.md` - Undo system details
- `/docs/SOFT_DELETE_PATTERN.md` - Soft delete approach
- `/docs/FIELD_MAPPING.md` - RPC field maintenance

---

## 14. CONCLUSION

The current marriage deletion system has a **critical design flaw**: it orphans children by clearing parent references. This analysis provides:

1. **Complete system understanding** - Data models, relationships, algorithms
2. **Scenario analysis** - 4 realistic scenarios with current vs desired behavior
3. **Alternative approaches** - 5 options with pros/cons
4. **Undo complexity** - Race conditions, version conflicts, recovery strategies
5. **Comprehensive testing** - 20+ test cases covering all scenarios
6. **Phased implementation** - 5 phases from audit to optional schema changes
7. **Risk assessment** - Critical risks and mitigation strategies

**Next Step**: Present findings to stakeholders and answer the 6 open questions to determine final approach.

---

**End of Deep-Dive Analysis**
