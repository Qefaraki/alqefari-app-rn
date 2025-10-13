# Pre-Production Test Plan
**Purpose**: Comprehensive testing before wiping test data and adding real family information.

**Status**: 🚨 **DRAFT - NOT STARTED**

---

## ⚠️ Critical: Data Integrity Tests

These tests protect against data loss, corruption, or relationship breaking.

### 1. Cascade Delete System (Migration 084b)
**Risk**: Could accidentally delete entire family branches permanently.

#### Test Cases:
- [ ] **1.1** Delete profile with 0 descendants
  - Expected: Single profile deleted, no cascade
  - Verify: Profile has `deleted_at` timestamp
  - Verify: Audit log has entry with `batch_id`

- [ ] **1.2** Delete profile with 1-5 descendants (small branch)
  - Expected: Parent + all descendants soft-deleted
  - Verify: All profiles have same `deleted_at` timestamp
  - Verify: All entries share same `batch_id` in audit log
  - Verify: UI shows correct descendant count warning

- [ ] **1.3** Delete profile with 6-20 descendants (medium branch)
  - Expected: Cascade delete with "permanent but recoverable" warning
  - Verify: Correct generation count shown in UI
  - Verify: All descendants deleted recursively
  - Verify: Related marriages soft-deleted

- [ ] **1.4** Attempt to delete profile with >100 descendants
  - Expected: Error "عدد كبير من الأشخاص"
  - Verify: Operation fails gracefully
  - Verify: No partial deletions occurred

- [ ] **1.5** Concurrent delete protection
  - Setup: User A opens profile for edit
  - Action: User B attempts to delete same profile
  - Expected: "الملف قيد التعديل" error
  - Verify: Deletion blocked by row-level lock

- [ ] **1.6** Version conflict handling
  - Setup: Profile at version 5
  - Action: Call cascade delete with version 3
  - Expected: "تم تحديث البيانات من مستخدم آخر"
  - Verify: No deletion occurred

- [ ] **1.7** Permission validation across descendants
  - Setup: User has inner permission on parent, but not grandchild
  - Action: Attempt cascade delete
  - Expected: "ليس لديك صلاحية لحذف بعض الأشخاص"
  - Verify: No partial deletions

- [ ] **1.8** Recovery audit trail
  - Action: Delete branch of 10 people
  - Verify: Query `audit_log_enhanced` by `batch_id` returns all 10 deletions
  - Verify: Metadata includes profile names and HIDs
  - Verify: All entries have identical timestamp

**Database Verification Queries**:
```sql
-- Check soft-deleted profiles
SELECT id, name, hid, deleted_at
FROM profiles
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC LIMIT 20;

-- Check cascade delete audit trail
SELECT metadata->>'batch_id' as batch_id,
       COUNT(*) as deleted_count,
       MIN(created_at) as deletion_time
FROM audit_log_enhanced
WHERE action = 'CASCADE_DELETE'
GROUP BY batch_id
ORDER BY deletion_time DESC;

-- Verify no orphaned children
SELECT c.id, c.name, c.father_id, c.mother_id
FROM profiles c
WHERE (c.father_id IN (SELECT id FROM profiles WHERE deleted_at IS NOT NULL)
   OR c.mother_id IN (SELECT id FROM profiles WHERE deleted_at IS NOT NULL))
  AND c.deleted_at IS NULL;
```

---

### 2. Parent-Child Relationships
**Risk**: Broken family connections, orphaned profiles.

#### Test Cases:
- [ ] **2.1** Add child to father (no mother set)
  - Action: Create child with only father_id
  - Verify: Child appears in father's children list
  - Verify: Child's name chain includes father
  - Verify: Mother field is NULL

- [ ] **2.2** Set mother for existing child
  - Action: Child has father, select mother from father's wives
  - Verify: `mother_id` correctly set
  - Verify: Child appears in mother's children list
  - Verify: Name chain unchanged (patrilineal)

- [ ] **2.3** Clear mother from child
  - Action: Remove mother assignment
  - Expected: `mother_id` set to NULL
  - Verify: Child still appears under father
  - Verify: Child removed from ex-mother's children list

- [ ] **2.4** Change child's mother (switch wives)
  - Setup: Father has 2 wives, child assigned to Wife A
  - Action: Reassign child to Wife B
  - Verify: `mother_id` updated
  - Verify: Child removed from Wife A's list
  - Verify: Child added to Wife B's list

- [ ] **2.5** Delete parent with children warning
  - Setup: Father has 3 children
  - Action: Attempt to delete father
  - Verify: Warning shows "لديه ٣ أطفال"
  - Verify: Warning mentions children will become orphans
  - Action: Confirm deletion
  - Verify: Children's `father_id` remains (soft delete preserves references)

- [ ] **2.6** Sibling order persistence
  - Action: Create 5 children with sibling_order 1-5
  - Action: Edit one child
  - Verify: Sibling order unchanged after edit
  - Verify: Children display in correct order in UI

**Database Verification Queries**:
```sql
-- Check parent-child relationships
SELECT
  c.name as child_name,
  c.hid as child_hid,
  f.name as father_name,
  m.name as mother_name,
  c.sibling_order
FROM profiles c
LEFT JOIN profiles f ON f.id = c.father_id
LEFT JOIN profiles m ON m.id = c.mother_id
WHERE c.deleted_at IS NULL
ORDER BY c.father_id, c.sibling_order;

-- Find orphaned children (parents soft-deleted)
SELECT c.id, c.name, c.hid,
       f.name as deleted_father,
       m.name as deleted_mother
FROM profiles c
LEFT JOIN profiles f ON f.id = c.father_id
LEFT JOIN profiles m ON m.id = c.mother_id
WHERE c.deleted_at IS NULL
  AND (f.deleted_at IS NOT NULL OR m.deleted_at IS NOT NULL);

-- Check for circular references
WITH RECURSIVE ancestry AS (
  SELECT id, father_id, ARRAY[id] as path
  FROM profiles WHERE deleted_at IS NULL

  UNION ALL

  SELECT p.id, p.father_id, a.path || p.id
  FROM profiles p
  JOIN ancestry a ON p.id = a.father_id
  WHERE p.deleted_at IS NULL
    AND NOT p.id = ANY(a.path)
)
SELECT * FROM ancestry WHERE id = ANY(path[2:]);
-- Should return 0 rows
```

---

### 3. Marriage System & Munasib
**Risk**: Lost spouse connections, munasib data integrity.

#### Test Cases:
- [ ] **3.1** Create marriage (Al Qefari + Al Qefari)
  - Action: Add wife to husband, both have HID
  - Verify: Marriage record created with status='current'
  - Verify: Wife appears in husband's spouses list
  - Verify: Husband appears in wife's spouses list

- [ ] **3.2** Create marriage (Al Qefari + Munasib)
  - Action: Add wife with no HID (munasib)
  - Verify: Wife profile created with `hid = NULL`
  - Verify: Marriage record links correctly
  - Verify: Wife appears in Munasib Manager

- [ ] **3.3** Update marriage status (current → past)
  - Action: Change marriage status to 'past'
  - Verify: Status updated in database
  - Verify: Wife still appears in TabFamily under "past" section
  - Verify: Children still linked to both parents

- [ ] **3.4** Delete marriage
  - Setup: Marriage with children
  - Action: Soft-delete marriage record
  - Verify: Marriage has `deleted_at` timestamp
  - Verify: Children's mother_id unchanged
  - Verify: Marriage hidden from UI

- [ ] **3.5** Multiple marriages for same person
  - Setup: Man has 3 wives (2 current, 1 past)
  - Verify: All 3 marriages display correctly
  - Verify: Sorted by status (current first) then start_date
  - Verify: Children grouped under correct mother

- [ ] **3.6** Munasib data persistence
  - Action: Create munasib profile with family_origin, bio, photo
  - Action: Reload profile
  - Verify: All fields persist (test field mapping)
  - Verify: Shows in Munasib Manager with correct stats

- [ ] **3.7** Munasib search and filter
  - Setup: 10 munasib profiles with varied data
  - Test: Search by name
  - Test: Filter by family_origin
  - Test: Filter by current_residence
  - Verify: All filters work correctly

**Database Verification Queries**:
```sql
-- Check marriage data integrity
SELECT
  m.id,
  m.status,
  m.start_date,
  h.name as husband_name,
  h.hid as husband_hid,
  w.name as wife_name,
  w.hid as wife_hid,
  m.deleted_at
FROM marriages m
JOIN profiles h ON h.id = m.husband_id
JOIN profiles w ON w.id = m.wife_id
ORDER BY m.created_at DESC;

-- Find munasib (profiles with NULL HID)
SELECT id, name, family_origin, current_residence, phone
FROM profiles
WHERE hid IS NULL
  AND deleted_at IS NULL
ORDER BY name;

-- Check for marriage orphans (spouse deleted but marriage active)
SELECT m.id, h.name as husband, w.name as wife, m.status
FROM marriages m
JOIN profiles h ON h.id = m.husband_id
JOIN profiles w ON w.id = m.wife_id
WHERE m.deleted_at IS NULL
  AND (h.deleted_at IS NOT NULL OR w.deleted_at IS NOT NULL);

-- Verify marriage status values (should only be 'current' or 'past')
SELECT DISTINCT status FROM marriages WHERE deleted_at IS NULL;
-- Expected: 'current', 'past' only (not 'married', 'divorced', 'widowed')
```

---

### 4. Optimistic Locking (Version Control)
**Risk**: Lost edits, version conflicts, concurrent edit overwrites.

#### Test Cases:
- [ ] **4.1** Simple edit with correct version
  - Setup: Profile at version 3
  - Action: Edit with `p_version: 3`
  - Verify: Update succeeds
  - Verify: Version increments to 4

- [ ] **4.2** Edit with stale version
  - Setup: Profile at version 5
  - Action: Edit with `p_version: 3`
  - Expected: Error about version mismatch
  - Verify: Update rejected
  - Verify: Version remains 5

- [ ] **4.3** Edit profile with NULL version (legacy data)
  - Setup: Profile created before version tracking (`version = NULL`)
  - Action: Edit with `p_version: 1` (fallback)
  - Verify: Update succeeds
  - Verify: Version set to 2 (incremented from fallback)

- [ ] **4.4** Concurrent edits scenario
  - Setup: Profile at version 2
  - User A: Loads profile (version 2)
  - User B: Loads profile (version 2)
  - User A: Saves edit (version → 3)
  - User B: Attempts to save edit (with version 2)
  - Expected: User B gets version conflict error
  - Verify: User A's changes preserved, User B rejected

- [ ] **4.5** Version increment on all update types
  - Test: Name change → version increments
  - Test: Phone change → version increments
  - Test: Bio update → version increments
  - Test: Relationship change (father_id) → version increments
  - Test: Soft delete → version increments

**Database Verification Queries**:
```sql
-- Check version distribution
SELECT version, COUNT(*) as count
FROM profiles
WHERE deleted_at IS NULL
GROUP BY version
ORDER BY version;

-- Find profiles with NULL version (legacy data)
SELECT id, name, hid, version, created_at
FROM profiles
WHERE version IS NULL
  AND deleted_at IS NULL;

-- Check recent version increments
SELECT
  al.profile_id,
  p.name,
  al.old_value->>'version' as old_version,
  al.new_value->>'version' as new_version,
  al.created_at
FROM audit_log al
JOIN profiles p ON p.id = al.profile_id
WHERE al.field_name = 'version'
ORDER BY al.created_at DESC
LIMIT 20;
```

---

### 5. Field Persistence (Field Mapping)
**Risk**: Fields save but disappear on reload due to missing RPC updates.

#### Test Cases:
- [ ] **5.1** Core identity fields
  - Fields: name, hid, father_id, mother_id, generation, sibling_order
  - Action: Edit each field
  - Verify: All persist after reload

- [ ] **5.2** Name fields
  - Fields: kunya, nickname, professional_title, title_abbreviation
  - Action: Set all fields
  - Verify: All display correctly in ProfileSheet
  - Verify: All persist after app restart

- [ ] **5.3** Dates and visibility
  - Fields: dob_data, dod_data, dob_is_public
  - Action: Set Gregorian and Hijri dates
  - Action: Toggle public visibility
  - Verify: Date objects persist correctly
  - Verify: Visibility setting respected

- [ ] **5.4** Location and work
  - Fields: birth_place, current_residence, occupation, education
  - Action: Fill all location fields
  - Verify: All save and reload correctly

- [ ] **5.5** Contact fields
  - Fields: phone, email
  - Action: Set both fields
  - Verify: Phone displays with correct formatting
  - Verify: Email saves correctly

- [ ] **5.6** Rich content fields
  - Fields: bio, achievements (JSON array), timeline (JSON array)
  - Action: Add multi-paragraph bio
  - Action: Add 3 achievements
  - Action: Add 3 timeline events
  - Verify: All JSON data persists
  - Verify: No truncation or corruption

- [ ] **5.7** System fields
  - Fields: profile_visibility, role, family_origin
  - Action: Change visibility to 'private'
  - Action: Change role to 'moderator'
  - Action: Set family_origin for munasib
  - Verify: All settings persist

- [ ] **5.8** Photo upload
  - Action: Upload profile photo
  - Verify: photo_url saved
  - Verify: Image displays correctly
  - Verify: URL persists after reload

**Field Mapping Checklist**:
```
✅ Verify each field appears in:
  1. profiles table (database)
  2. get_branch_data() RETURNS TABLE + 3 SELECTs
  3. search_name_chain() RETURNS TABLE + 3 SELECTs
  4. admin_update_profile() UPDATE statement
```

**Database Verification Query**:
```sql
-- Test field persistence for a specific profile
SELECT
  name, hid, kunya, nickname,
  professional_title, title_abbreviation,
  gender, status, photo_url,
  dob_data, dod_data, dob_is_public,
  birth_place, current_residence,
  occupation, education,
  phone, email,
  bio, achievements, timeline,
  social_media_links,
  profile_visibility, role, family_origin,
  sibling_order, generation, version
FROM profiles
WHERE id = 'test-profile-uuid';

-- Check for NULL fields that should have values
SELECT
  id, name, hid,
  CASE WHEN phone IS NULL THEN 'missing phone' END as phone_check,
  CASE WHEN gender IS NULL THEN 'missing gender' END as gender_check,
  CASE WHEN generation IS NULL THEN 'missing generation' END as gen_check
FROM profiles
WHERE deleted_at IS NULL
  AND (phone IS NULL OR gender IS NULL OR generation IS NULL);
```

---

## 🔒 Security: Permission System Tests

These tests ensure permissions work correctly and prevent unauthorized access.

### 6. Permission Circle Logic (v4.2)
**Risk**: Users can edit profiles they shouldn't, or can't edit profiles they should.

#### Test Cases:
- [ ] **6.1** Self editing (inner circle)
  - Action: User edits their own profile
  - Expected: Direct edit (not suggestion)
  - Verify: `check_family_permission_v4()` returns 'inner'

- [ ] **6.2** Spouse editing (inner circle)
  - Setup: Active marriage (status='current')
  - Action: Husband edits wife's profile
  - Expected: Direct edit allowed
  - Verify: Permission = 'inner'

- [ ] **6.3** Ex-spouse editing (past marriage)
  - Setup: Past marriage (status='past')
  - Action: Ex-husband attempts to edit ex-wife
  - Expected: Suggestion only (permission = 'family' or 'extended')
  - Verify: UI shows "اقتراح تعديل" not "تعديل"

- [ ] **6.4** Parent-child editing (both directions)
  - Test A: Parent edits child → inner circle (direct edit)
  - Test B: Child edits parent → inner circle (direct edit)
  - Verify: Bidirectional inner permission

- [ ] **6.5** Sibling editing (inner circle)
  - Setup: Two siblings (shared father or mother)
  - Action: Sibling A edits Sibling B
  - Expected: Direct edit (inner circle)

- [ ] **6.6** Descendant editing (all levels)
  - Test: Parent edits grandchild → inner (direct edit)
  - Test: Parent edits great-grandchild → inner (direct edit)
  - Verify: All descendants in inner circle

- [ ] **6.7** Ancestor editing (all levels)
  - Test: Child edits grandparent → inner (direct edit)
  - Test: Child edits great-grandparent → inner (direct edit)
  - Verify: All ancestors in inner circle

- [ ] **6.8** Cousin editing (family circle)
  - Setup: Two cousins (shared grandparent)
  - Action: Cousin A edits Cousin B
  - Expected: Suggestion only (permission = 'family')
  - Expected: 48-hour auto-approve
  - Verify: UI shows "سيتم الموافقة خلال 48 ساعة"

- [ ] **6.9** Uncle/nephew editing (family circle)
  - Setup: Uncle-nephew relationship (shared grandparent)
  - Action: Uncle edits nephew
  - Expected: Suggestion (family circle, auto-approve)

- [ ] **6.10** Distant relative editing (extended circle)
  - Setup: Two people, both have HID, no shared grandparent
  - Action: User A edits User B
  - Expected: Suggestion (permission = 'extended')
  - Expected: Manual approval only (no auto-approve)
  - Verify: UI shows "يحتاج موافقة المشرف"

- [ ] **6.11** No relationship editing
  - Setup: User A has HID, User B has no HID (munasib)
  - Action: User A edits User B
  - Expected: Permission = 'none', no edit/suggest buttons

- [ ] **6.12** Admin override
  - Setup: User has role='admin'
  - Action: Admin edits any profile
  - Expected: Permission = 'admin' (direct edit anyone)

- [ ] **6.13** Branch moderator access
  - Setup: User assigned as moderator for HID "1.2"
  - Test: Edit profile with HID "1.2.3" → permission = 'moderator'
  - Test: Edit profile with HID "1.2.3.4" → permission = 'moderator'
  - Test: Edit profile with HID "1.3" → permission follows normal rules
  - Verify: Moderator only has access to their assigned subtree

- [ ] **6.14** Blocked user
  - Setup: User added to `suggestion_blocks` table
  - Action: Attempt to make suggestion
  - Expected: Permission = 'blocked'
  - Expected: Error "تم حظرك من تقديم الاقتراحات"

**Permission Test Matrix**:
```
Relationship      | Expected Permission | Edit Type
------------------|---------------------|------------------
Self              | inner               | Direct
Active Spouse     | inner               | Direct
Ex-Spouse         | family/extended     | Suggest
Parent            | inner               | Direct
Child             | inner               | Direct
Sibling           | inner               | Direct
Grandchild        | inner               | Direct
Great-grandchild  | inner               | Direct
Grandparent       | inner               | Direct
Cousin            | family              | Suggest (auto)
Uncle/Nephew      | family              | Suggest (auto)
Distant Relative  | extended            | Suggest (manual)
No Relationship   | none                | No access
Admin             | admin               | Direct (all)
Blocked           | blocked             | None
```

**Database Verification Queries**:
```sql
-- Test permission function for specific relationships
SELECT
  u.name as user_name,
  t.name as target_name,
  check_family_permission_v4(u.id, t.id) as permission_level
FROM profiles u
CROSS JOIN profiles t
WHERE u.name = 'User A'  -- Replace with test user
  AND t.name = 'User B'  -- Replace with test target
  AND u.deleted_at IS NULL
  AND t.deleted_at IS NULL;

-- Check branch moderator assignments
SELECT
  p.name as moderator_name,
  bm.branch_hid,
  bm.is_active,
  a.name as assigned_by_name,
  bm.created_at
FROM branch_moderators bm
JOIN profiles p ON p.id = bm.user_id
LEFT JOIN profiles a ON a.id = bm.assigned_by
WHERE bm.is_active = true
ORDER BY bm.created_at DESC;

-- Check blocked users
SELECT
  p.name as blocked_user,
  sb.reason,
  b.name as blocked_by,
  sb.created_at
FROM suggestion_blocks sb
JOIN profiles p ON p.id = sb.blocked_user_id
LEFT JOIN profiles b ON b.id = sb.blocked_by
WHERE sb.is_active = true;
```

---

### 7. Edit Suggestions System
**Risk**: Suggestions not created, approval system broken, auto-approve fails.

#### Test Cases:
- [ ] **7.1** Submit suggestion (family circle)
  - Setup: Cousin relationship (family permission)
  - Action: Submit suggestion to change phone number
  - Verify: Suggestion created with status='pending'
  - Verify: Old value captured correctly
  - Verify: New value stored correctly

- [ ] **7.2** Submit suggestion (extended circle)
  - Setup: Distant relative (extended permission)
  - Action: Submit suggestion with reason
  - Verify: Suggestion created
  - Verify: Reason text saved

- [ ] **7.3** Rate limiting (10 suggestions per day)
  - Action: Submit 10 suggestions
  - Verify: All succeed
  - Action: Submit 11th suggestion
  - Expected: Error "تجاوزت الحد اليومي"
  - Verify: User rate limit row updated

- [ ] **7.4** Approve suggestion manually
  - Setup: Pending suggestion
  - Action: Admin approves with notes
  - Verify: Profile field updated with new value
  - Verify: Suggestion status = 'approved'
  - Verify: Reviewer ID and timestamp recorded
  - Verify: Version incremented

- [ ] **7.5** Reject suggestion
  - Setup: Pending suggestion
  - Action: Admin rejects with reason
  - Verify: Profile unchanged
  - Verify: Suggestion status = 'rejected'
  - Verify: Rejection notes saved

- [ ] **7.6** Auto-approve after 48 hours (family circle)
  - Setup: Submit suggestion from family circle user
  - Action: Wait 48+ hours (or manually set created_at)
  - Action: Run `auto_approve_suggestions_v4()`
  - Verify: Suggestion auto-approved
  - Verify: Profile field updated
  - Verify: Status = 'approved'

- [ ] **7.7** No auto-approve for extended circle
  - Setup: Submit suggestion from extended circle user
  - Action: Wait 48+ hours
  - Action: Run auto-approve function
  - Verify: Suggestion still pending (not auto-approved)

- [ ] **7.8** Pending suggestions count
  - Setup: 5 pending suggestions for a profile
  - Action: Call `get_pending_suggestions_count()`
  - Verify: Returns 5
  - Action: Approve 2 suggestions
  - Verify: Count drops to 3

- [ ] **7.9** Profile owner can approve their own suggestions
  - Setup: User A suggests edit to User B's profile
  - Action: User B (profile owner) approves suggestion
  - Verify: Approval succeeds (owner has permission)

**Database Verification Queries**:
```sql
-- Check pending suggestions
SELECT
  s.id,
  s.field_name,
  s.old_value,
  s.new_value,
  s.reason,
  s.status,
  p.name as profile_name,
  sub.name as submitter_name,
  s.created_at,
  AGE(NOW(), s.created_at) as age
FROM profile_edit_suggestions s
JOIN profiles p ON p.id = s.profile_id
JOIN profiles sub ON sub.id = s.submitter_id
WHERE s.status = 'pending'
ORDER BY s.created_at ASC;

-- Check auto-approve candidates (>48 hours old, family circle)
SELECT
  s.id,
  s.field_name,
  p.name as profile,
  sub.name as submitter,
  check_family_permission_v4(s.submitter_id, s.profile_id) as permission,
  AGE(NOW(), s.created_at) as age
FROM profile_edit_suggestions s
JOIN profiles p ON p.id = s.profile_id
JOIN profiles sub ON sub.id = s.submitter_id
WHERE s.status = 'pending'
  AND s.created_at < NOW() - INTERVAL '48 hours'
  AND check_family_permission_v4(s.submitter_id, s.profile_id) = 'family';

-- Check rate limits
SELECT
  p.name,
  rl.daily_suggestions,
  rl.daily_approvals,
  rl.last_suggestion_at,
  rl.last_reset_at
FROM user_rate_limits rl
JOIN profiles p ON p.id = rl.user_id
WHERE rl.daily_suggestions > 0 OR rl.daily_approvals > 0
ORDER BY rl.daily_suggestions DESC;
```

---

## 🔍 Business Logic Tests

These tests verify core family tree functionality.

### 8. HID (Hierarchical ID) System
**Risk**: Wrong HID assignment, duplicate HIDs, broken HID inheritance.

#### Test Cases:
- [ ] **8.1** Root profile HID
  - Setup: Create first profile (founder)
  - Verify: HID = "1"

- [ ] **8.2** First generation children
  - Setup: Founder has HID "1"
  - Action: Add 3 children
  - Verify: HIDs = "1.1", "1.2", "1.3"

- [ ] **8.3** Second generation children
  - Setup: Child "1.2" has children
  - Action: Add 2 grandchildren
  - Verify: HIDs = "1.2.1", "1.2.2"

- [ ] **8.4** Sibling order affects HID
  - Setup: Father has 4 children with sibling_order 1-4
  - Verify: HIDs assigned based on sibling_order
  - Action: Change sibling_order
  - Verify: HIDs update accordingly

- [ ] **8.5** Munasib have NULL HID
  - Setup: Create munasib profile (wife from outside family)
  - Verify: `hid = NULL`
  - Verify: Still appears in marriages
  - Verify: Children inherit father's HID line

- [ ] **8.6** HID uniqueness constraint
  - Action: Attempt to manually set duplicate HID
  - Expected: Database constraint violation
  - Verify: Operation fails

- [ ] **8.7** HID search
  - Setup: Profile with HID "1.2.3.4"
  - Action: Search by HID
  - Verify: Correct profile returned
  - Action: Search by partial HID "1.2"
  - Verify: All descendants in "1.2" subtree returned

**Database Verification Queries**:
```sql
-- Check HID structure
SELECT
  hid,
  name,
  generation,
  father_id IS NOT NULL as has_father,
  mother_id IS NOT NULL as has_mother
FROM profiles
WHERE deleted_at IS NULL
ORDER BY hid;

-- Find duplicate HIDs
SELECT hid, COUNT(*) as count
FROM profiles
WHERE hid IS NOT NULL
  AND deleted_at IS NULL
GROUP BY hid
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Check HID inheritance (children should have parent's HID as prefix)
SELECT
  c.hid as child_hid,
  f.hid as father_hid,
  c.hid LIKE f.hid || '.%' as correct_inheritance
FROM profiles c
JOIN profiles f ON f.id = c.father_id
WHERE c.deleted_at IS NULL
  AND f.deleted_at IS NULL
  AND c.hid IS NOT NULL
  AND f.hid IS NOT NULL;
-- All rows should have correct_inheritance = true
```

---

### 9. Generation Calculation
**Risk**: Wrong generation numbers, broken generation chain.

#### Test Cases:
- [ ] **9.1** Root profile generation
  - Setup: Create founder profile
  - Verify: generation = 1

- [ ] **9.2** First generation children
  - Setup: Founder (generation 1) has children
  - Verify: All children have generation = 2

- [ ] **9.3** Second generation children
  - Setup: Child (generation 2) has children
  - Verify: All grandchildren have generation = 3

- [ ] **9.4** Deep lineage (5+ generations)
  - Setup: Create profiles down to generation 6
  - Verify: Each generation increments correctly

- [ ] **9.5** Munasib generation
  - Setup: Munasib wife has no father
  - Question: What should generation be? NULL or inferred from spouse?
  - Verify: Consistent behavior

**Database Verification Queries**:
```sql
-- Check generation distribution
SELECT generation, COUNT(*) as count
FROM profiles
WHERE deleted_at IS NULL
GROUP BY generation
ORDER BY generation;

-- Verify parent-child generation increments
SELECT
  c.name as child_name,
  c.generation as child_gen,
  f.name as father_name,
  f.generation as father_gen,
  c.generation - f.generation as gen_diff
FROM profiles c
JOIN profiles f ON f.id = c.father_id
WHERE c.deleted_at IS NULL
  AND f.deleted_at IS NULL;
-- All gen_diff should be 1

-- Find generation mismatches
SELECT
  c.id, c.name, c.generation as calc_gen,
  f.generation + 1 as expected_gen
FROM profiles c
JOIN profiles f ON f.id = c.father_id
WHERE c.deleted_at IS NULL
  AND f.deleted_at IS NULL
  AND c.generation != f.generation + 1;
-- Should return 0 rows
```

---

### 10. Search Functions
**Risk**: Missing profiles in search results, incorrect ancestry chains.

#### Test Cases:
- [ ] **10.1** Name chain search (single name)
  - Action: Search for "محمد"
  - Verify: All profiles with name "محمد" returned
  - Verify: Results include full ancestry chain

- [ ] **10.2** Name chain search (2 names - son + father)
  - Action: Search for ["محمد", "علي"]
  - Expected: Only profiles where محمد's father is علي
  - Verify: Ancestry chain matches search pattern

- [ ] **10.3** Name chain search (3 names - grandson + father + grandfather)
  - Action: Search for ["أحمد", "محمد", "علي"]
  - Verify: Only exact matches with 3-generation chain

- [ ] **10.4** Partial name matching
  - Action: Search for "مح" (partial)
  - Verify: Matches محمد, محمود, etc.

- [ ] **10.5** Branch data retrieval
  - Action: Call `get_branch_data(hid='1.2', max_depth=3)`
  - Verify: Returns all descendants up to depth 3
  - Verify: Stops at generation 5 if depth limit reached

- [ ] **10.6** Search performance (large tree)
  - Setup: Tree with 500+ profiles
  - Action: Search with 3-name chain
  - Verify: Results return in <2 seconds

- [ ] **10.7** Empty search results
  - Action: Search for non-existent name
  - Verify: Returns empty array (not error)

**Database Verification Queries**:
```sql
-- Test search_name_chain function
SELECT * FROM search_name_chain(
  ARRAY['محمد', 'علي'],
  10,  -- limit
  0    -- offset
);

-- Test get_branch_data function
SELECT id, name, hid, father_id, mother_id
FROM get_branch_data(
  '1',   -- root HID
  3,     -- max depth
  100    -- max results
);

-- Check search function performance
EXPLAIN ANALYZE
SELECT * FROM search_name_chain(
  ARRAY['محمد', 'علي', 'عبدالله'],
  50,
  0
);
```

---

## 📱 UI/UX Tests

These tests verify the user interface works correctly.

### 11. Profile Display & Editing
**Risk**: UI doesn't reflect data changes, edit modes broken.

#### Test Cases:
- [ ] **11.1** Profile view mode
  - Action: Open ProfileSheet for any profile
  - Verify: All fields display correctly
  - Verify: Name chain built correctly (بن/بنت)
  - Verify: Dates formatted correctly (Gregorian + Hijri)

- [ ] **11.2** Profile edit mode
  - Action: Click "تعديل" with inner permission
  - Verify: All fields become editable
  - Verify: Save button appears
  - Action: Make changes and save
  - Verify: Changes persist after close/reopen

- [ ] **11.3** Suggest edit mode
  - Action: Click "اقتراح تعديل" with family permission
  - Verify: Modal shows current vs new value
  - Action: Submit suggestion
  - Verify: Success message appears
  - Verify: Returns to view mode (no direct edit)

- [ ] **11.4** Permission-based UI
  - Test: Admin sees "تعديل" button
  - Test: Inner circle sees "تعديل" button
  - Test: Family circle sees "اقتراح تعديل" button
  - Test: No permission sees no edit buttons

- [ ] **11.5** Photo upload
  - Action: Upload photo
  - Verify: Thumbnail displays immediately
  - Verify: Full resolution saved
  - Verify: Photo URL persists

- [ ] **11.6** Rich text fields (bio, achievements)
  - Action: Enter multi-paragraph bio with Arabic text
  - Action: Add 5 achievements
  - Verify: Text displays with correct line breaks
  - Verify: No text truncation or corruption

---

### 12. Family Tree Rendering
**Risk**: Tree doesn't display correctly, performance issues, crashes.

#### Test Cases:
- [ ] **12.1** Small tree rendering (1-10 profiles)
  - Action: Load tree with root + 2 generations
  - Verify: All nodes display
  - Verify: Parent-child connections drawn correctly
  - Verify: No visual glitches

- [ ] **12.2** Medium tree rendering (50-100 profiles)
  - Action: Load branch with 3-4 generations
  - Verify: Viewport culling works (only visible nodes rendered)
  - Verify: Smooth scrolling/panning
  - Verify: No lag or stuttering

- [ ] **12.3** Large tree rendering (200+ profiles)
  - Action: Load main tree from root
  - Verify: Branch-based loading works (max depth enforced)
  - Verify: Lazy loading on expand
  - Verify: No crashes or memory issues

- [ ] **12.4** RTL layout
  - Verify: Tree flows right-to-left
  - Verify: Children arranged right-to-left
  - Verify: All text aligned correctly

- [ ] **12.5** Node interactions
  - Action: Tap node to open profile
  - Action: Long-press for quick actions
  - Action: Swipe gestures (if implemented)
  - Verify: All gestures work correctly

- [ ] **12.6** Expand/collapse branches
  - Action: Collapse large branch
  - Verify: Descendants hidden
  - Verify: UI performance remains smooth
  - Action: Re-expand branch
  - Verify: All descendants reappear

---

### 13. Admin Dashboard
**Risk**: Admin features broken, suggestion review fails.

#### Test Cases:
- [ ] **13.1** Dashboard access control
  - Test: Admin user sees dashboard
  - Test: Regular user doesn't see dashboard
  - Test: Super admin sees additional options

- [ ] **13.2** Suggestion review screen
  - Action: Open "مراجعة الاقتراحات"
  - Verify: All pending suggestions listed
  - Verify: Shows submitter name, field, old/new values
  - Action: Approve suggestion
  - Verify: Suggestion removed from pending list
  - Verify: Profile updated

- [ ] **13.3** Permission manager (super admin only)
  - Action: Open "إدارة الصلاحيات"
  - Verify: Search users by name
  - Action: Grant moderator role
  - Verify: User added to branch_moderators table
  - Action: Block user from suggestions
  - Verify: User added to suggestion_blocks table

- [ ] **13.4** Munasib manager
  - Action: Open Munasib Manager
  - Verify: All munasib (hid=NULL) profiles listed
  - Verify: Family statistics display correctly
  - Action: Search munasib by name
  - Verify: Results filter correctly

- [ ] **13.5** Message template manager
  - Action: Open "قوالب الرسائل"
  - Verify: All templates display
  - Action: Edit template message
  - Action: Insert variable {name_chain}
  - Action: Test message
  - Verify: WhatsApp opens with mock data

---

## 📤 Export & External Features

### 14. PDF Export
**Risk**: Broken export, missing data, Arabic rendering issues.

#### Test Cases:
- [ ] **14.1** Full family tree export
  - Action: Export entire tree to PDF
  - Verify: PDF generates successfully
  - Verify: All profiles included
  - Verify: Arabic text renders correctly
  - Verify: Generations organized properly

- [ ] **14.2** Individual profile export
  - Action: Export single profile report
  - Verify: Profile details included
  - Verify: Relationships section complete
  - Verify: Photos included (if present)

- [ ] **14.3** Munasib report export
  - Action: Export munasib report
  - Verify: All munasib profiles included
  - Verify: Marriage connections shown
  - Verify: Family origin statistics included

- [ ] **14.4** Large export performance
  - Setup: Tree with 200+ profiles
  - Action: Export full tree
  - Verify: Export completes without timeout
  - Verify: PDF file size reasonable
  - Verify: No memory crashes

---

### 15. WhatsApp Integration
**Risk**: Message templates broken, variables not replaced.

#### Test Cases:
- [ ] **15.1** Onboarding help message
  - Action: Click "تحتاج مساعدة؟" on onboarding screen
  - Verify: WhatsApp opens with correct message
  - Verify: No variables (static message)

- [ ] **15.2** Article suggestion message
  - Action: Suggest article from news screen
  - Verify: WhatsApp opens with message
  - Verify: {name_chain} replaced with user's ancestry
  - Verify: {phone} replaced with user's phone number

- [ ] **15.3** Contact admin message
  - Action: Open contact admin
  - Verify: Message includes user's name and phone
  - Verify: Variables replaced correctly

- [ ] **15.4** Custom template (admin)
  - Action: Admin customizes template
  - Action: User triggers template
  - Verify: Custom message used (not default)

- [ ] **15.5** Reset template
  - Action: Admin resets template to default
  - Verify: Default message restored
  - Action: User triggers template
  - Verify: Default message used

---

## 🔄 Real-Time & Sync Tests

### 16. Real-Time Subscriptions
**Risk**: Changes not reflected in real-time, stale data displayed.

#### Test Cases:
- [ ] **16.1** Profile update subscription
  - Setup: User A and User B viewing same profile
  - Action: User A edits profile
  - Verify: User B sees changes immediately (no refresh needed)

- [ ] **16.2** New profile added
  - Setup: User viewing family tree
  - Action: Admin adds new child
  - Verify: New node appears in tree automatically

- [ ] **16.3** Profile deleted
  - Setup: User viewing branch
  - Action: Admin deletes profile
  - Verify: Node disappears from tree
  - Verify: Children remain (if not cascaded)

- [ ] **16.4** Marriage added
  - Setup: User viewing profile
  - Action: Admin adds new marriage
  - Verify: Spouse appears in ProfileSheet

---

## 🚀 Performance & Stress Tests

### 17. Database Performance
**Risk**: Slow queries, timeout errors, memory issues.

#### Test Cases:
- [ ] **17.1** get_branch_data() performance
  - Setup: Branch with 100 descendants
  - Action: Call get_branch_data() with max_depth=5
  - Verify: Query completes in <1 second

- [ ] **17.2** search_name_chain() performance
  - Setup: Database with 500+ profiles
  - Action: Search with 3-name chain
  - Verify: Results return in <2 seconds

- [ ] **17.3** Permission check performance
  - Setup: 100 profiles to check
  - Action: Call check_batch_family_permissions()
  - Verify: Batch completes in <500ms
  - Compare: Individual checks would take 8+ seconds

- [ ] **17.4** Cascade delete performance
  - Setup: Branch with 50 descendants
  - Action: Call admin_cascade_delete_profile()
  - Verify: Operation completes in <5 seconds (statement timeout)
  - Verify: All descendants deleted atomically

---

## 📝 Migration & Data Quality Tests

### 18. Database Integrity
**Risk**: Orphaned records, constraint violations, NULL values where required.

#### Test Cases:
- [ ] **18.1** Foreign key integrity
  - Query: Find profiles with father_id that doesn't exist
  - Expected: 0 results
  - Query: Find profiles with mother_id that doesn't exist
  - Expected: 0 results (or NULLs)

- [ ] **18.2** Required field validation
  - Query: Find profiles with NULL name
  - Expected: 0 results
  - Query: Find profiles with NULL gender
  - Expected: 0 results

- [ ] **18.3** Constraint validation
  - Query: Check marriage status values
  - Expected: Only 'current' or 'past'
  - Query: Check role values
  - Expected: Only 'user', 'admin', 'super_admin'

- [ ] **18.4** Soft delete integrity
  - Query: Find marriages where spouse is soft-deleted but marriage is active
  - Expected: 0 results (marriage should be soft-deleted too)

**Comprehensive Integrity Queries**:
```sql
-- 1. Orphaned children (father deleted)
SELECT c.id, c.name, c.father_id
FROM profiles c
WHERE c.father_id IS NOT NULL
  AND c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM profiles f
    WHERE f.id = c.father_id
    AND f.deleted_at IS NULL
  );

-- 2. Invalid marriage status
SELECT id, husband_id, wife_id, status
FROM marriages
WHERE status NOT IN ('current', 'past')
  AND deleted_at IS NULL;

-- 3. Duplicate HIDs
SELECT hid, COUNT(*) as count
FROM profiles
WHERE hid IS NOT NULL
  AND deleted_at IS NULL
GROUP BY hid
HAVING COUNT(*) > 1;

-- 4. Missing required fields
SELECT id, name,
  CASE WHEN gender IS NULL THEN 'no gender' END,
  CASE WHEN hid IS NULL AND father_id IS NOT NULL THEN 'child missing HID' END
FROM profiles
WHERE deleted_at IS NULL
  AND (gender IS NULL OR (hid IS NULL AND father_id IS NOT NULL));

-- 5. Circular references (should be impossible)
WITH RECURSIVE loop_check AS (
  SELECT id, father_id, ARRAY[id] as path, 1 as depth
  FROM profiles
  WHERE deleted_at IS NULL

  UNION ALL

  SELECT p.id, p.father_id, lc.path || p.id, lc.depth + 1
  FROM profiles p
  JOIN loop_check lc ON p.id = lc.father_id
  WHERE p.deleted_at IS NULL
    AND NOT p.id = ANY(lc.path)
    AND lc.depth < 20
)
SELECT * FROM loop_check WHERE id = ANY(path[2:]);
-- Should return 0 rows
```

---

## ✅ Pre-Production Checklist

Before wiping test data and adding real family information:

### Database
- [ ] All 18 permission functions verified operational
- [ ] Field mapping verified for all 41+ profile fields
- [ ] Cascade delete tested with 0, 1-5, 6-20 descendant scenarios
- [ ] Optimistic locking works with version conflicts
- [ ] All foreign key relationships valid
- [ ] No duplicate HIDs in database
- [ ] Marriage status migration (078) complete
- [ ] All soft-deleted profiles have audit trail

### Permissions
- [ ] Inner circle logic tested (self, spouse, parent, child, sibling, descendants)
- [ ] Family circle logic tested (cousins, auto-approve 48hr)
- [ ] Extended circle logic tested (distant relatives, manual approve)
- [ ] Admin/moderator permissions work correctly
- [ ] Blocked users cannot make suggestions
- [ ] Rate limiting enforced (10 suggestions/day)

### Core Features
- [ ] Add child to father works correctly
- [ ] Set mother for child works correctly
- [ ] Create marriage (Al Qefari + Al Qefari) works
- [ ] Create marriage (Al Qefari + Munasib) works
- [ ] Change marriage status (current → past) works
- [ ] HID generation correct for all levels
- [ ] Generation numbers calculated correctly
- [ ] Search by name chain returns correct results

### UI/UX
- [ ] ProfileSheet displays all fields correctly
- [ ] Edit mode saves changes persistently
- [ ] Suggest mode creates suggestions correctly
- [ ] Permission-based buttons display correctly (تعديل vs اقتراح تعديل)
- [ ] Family tree renders without crashes
- [ ] Large trees (200+) perform acceptably
- [ ] RTL layout works correctly

### Admin Features
- [ ] Suggestion review screen works
- [ ] Approve/reject suggestions works
- [ ] Permission manager works (super admin)
- [ ] Branch moderator assignment works
- [ ] User blocking works
- [ ] Munasib manager displays correctly
- [ ] Message template manager works

### External Features
- [ ] PDF export generates successfully
- [ ] WhatsApp messages send with correct variables
- [ ] Photo uploads work and persist
- [ ] Real-time subscriptions work

### Performance
- [ ] get_branch_data() completes <1s for 100 profiles
- [ ] search_name_chain() completes <2s for 500 profiles
- [ ] Batch permission checks complete <500ms
- [ ] Cascade delete completes <5s for 50 descendants
- [ ] No memory leaks or crashes with large data

---

## 🔧 Test Execution Strategy

### Phase 1: Critical Data Integrity (3-5 days)
Run tests 1-5 first (cascade delete, relationships, marriages, locking, field persistence).
**Goal**: Ensure no data loss or corruption possible.

### Phase 2: Security & Permissions (2-3 days)
Run tests 6-7 (permission circles, suggestions).
**Goal**: Ensure users can only access what they should.

### Phase 3: Business Logic (2-3 days)
Run tests 8-10 (HIDs, generations, search).
**Goal**: Ensure family tree logic is correct.

### Phase 4: UI & Experience (2-3 days)
Run tests 11-15 (profile display, tree rendering, admin, exports, WhatsApp).
**Goal**: Ensure good user experience.

### Phase 5: Performance & Polish (1-2 days)
Run tests 16-18 (real-time, performance, integrity).
**Goal**: Ensure system scales and performs well.

**Total Estimated Time**: 10-16 days of thorough testing

---

## 📊 Test Tracking

Use this section to track test execution:

```
[✅] = Passed
[❌] = Failed
[⚠️] = Partial/Needs Review
[⏭️] = Skipped
[🔄] = In Progress
```

**Last Updated**: [Date]
**Tested By**: [Name]
**Test Environment**: [Dev/Staging/Production]

---

## 🐛 Bug Tracking

| Test ID | Issue Description | Severity | Status | Notes |
|---------|-------------------|----------|--------|-------|
| 1.3     | Example bug      | High     | Open   | Details... |

---

**End of Test Plan**

This comprehensive test plan ensures data integrity, security, and functionality before production use.
