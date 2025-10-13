# Pre-Production Test Plan - Executive Summary

**Document**: [`PRE_PRODUCTION_TEST_PLAN.md`](PRE_PRODUCTION_TEST_PLAN.md)

---

## 🎯 Purpose

Before wiping test data and adding real Al Qefari family information, we need to thoroughly test all critical features to prevent data loss, corruption, or the need for structural changes later.

---

## 📊 Test Coverage Overview

| Category | Test Areas | Risk Level | Est. Time |
|----------|-----------|------------|-----------|
| **Data Integrity** | 5 test suites (122 test cases) | 🔴 Critical | 3-5 days |
| **Security & Permissions** | 2 test suites (35 test cases) | 🔴 Critical | 2-3 days |
| **Business Logic** | 3 test suites (28 test cases) | 🟡 High | 2-3 days |
| **UI/UX** | 3 test suites (24 test cases) | 🟢 Medium | 2-3 days |
| **Performance & Quality** | 5 test suites (18 test cases) | 🟡 High | 1-2 days |

**Total**: 18 test suites, 227+ individual test cases, **10-16 days estimated**

---

## 🚨 Critical Tests (Must Pass Before Production)

### 1. Cascade Delete System ⚠️ **HIGHEST RISK**
- **Why Critical**: Could accidentally delete entire family branches
- **Test**: Delete profiles with 0, 1-5, 6-20, 100+ descendants
- **Verify**: Soft delete, audit trail, permission checks, recovery possible
- **Status**: 🔄 **8 test cases**

### 2. Parent-Child Relationships
- **Why Critical**: Broken family connections, orphaned profiles
- **Test**: Add/remove parents, change mothers, delete with children
- **Verify**: No orphans, references preserved, warnings shown
- **Status**: 🔄 **6 test cases**

### 3. Marriage System & Munasib
- **Why Critical**: Lost spouse connections, munasib data integrity
- **Test**: Al Qefari + Al Qefari, Al Qefari + Munasib, status changes
- **Verify**: HID=NULL for munasib, children linked correctly
- **Status**: 🔄 **7 test cases**

### 4. Optimistic Locking (Version Control)
- **Why Critical**: Lost edits, concurrent edit overwrites
- **Test**: Version conflicts, concurrent edits, NULL version fallback
- **Verify**: Version increments, conflicts rejected gracefully
- **Status**: 🔄 **5 test cases**

### 5. Field Persistence (Field Mapping)
- **Why Critical**: Fields save but disappear on reload
- **Test**: All 41+ profile fields (core, names, dates, location, contact, rich content)
- **Verify**: All fields persist after save/reload cycle
- **Status**: 🔄 **8 test cases covering 41+ fields**

### 6. Permission Circle Logic
- **Why Critical**: Users can edit profiles they shouldn't, or can't edit when they should
- **Test**: Inner (self, spouse, parent, child, sibling, descendants), family (cousins), extended (distant)
- **Verify**: Correct permission level, correct UI buttons (تعديل vs اقتراح تعديل)
- **Status**: 🔄 **14 test cases**

---

## 📋 Test Execution Priority

### **Phase 1: Critical Data Integrity** (Days 1-5)
Run first to ensure no data loss is possible:
- ✅ Cascade Delete System (Test Suite 1)
- ✅ Parent-Child Relationships (Test Suite 2)
- ✅ Marriage System & Munasib (Test Suite 3)
- ✅ Optimistic Locking (Test Suite 4)
- ✅ Field Persistence (Test Suite 5)

**Goal**: Prove data won't be lost, corrupted, or orphaned.

---

### **Phase 2: Security & Permissions** (Days 6-8)
Run second to ensure correct access control:
- ✅ Permission Circle Logic (Test Suite 6)
- ✅ Edit Suggestions System (Test Suite 7)

**Goal**: Prove users can only access what they should.

---

### **Phase 3: Business Logic** (Days 9-11)
Run third to ensure family tree logic is correct:
- ✅ HID (Hierarchical ID) System (Test Suite 8)
- ✅ Generation Calculation (Test Suite 9)
- ✅ Search Functions (Test Suite 10)

**Goal**: Prove family tree relationships and structure work correctly.

---

### **Phase 4: UI & Experience** (Days 12-14)
Run fourth to ensure good user experience:
- ✅ Profile Display & Editing (Test Suite 11)
- ✅ Family Tree Rendering (Test Suite 12)
- ✅ Admin Dashboard (Test Suite 13)
- ✅ PDF Export (Test Suite 14)
- ✅ WhatsApp Integration (Test Suite 15)

**Goal**: Prove UI reflects data correctly and is usable.

---

### **Phase 5: Performance & Polish** (Days 15-16)
Run last to ensure system scales:
- ✅ Real-Time Subscriptions (Test Suite 16)
- ✅ Database Performance (Test Suite 17)
- ✅ Database Integrity (Test Suite 18)

**Goal**: Prove system performs well with real-world data volumes.

---

## 🔍 Key Database Verification Queries

These queries should be run regularly during testing:

### Check Soft-Deleted Profiles
```sql
SELECT id, name, hid, deleted_at
FROM profiles
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC LIMIT 20;
```

### Find Orphaned Children
```sql
SELECT c.id, c.name, c.father_id
FROM profiles c
WHERE c.father_id IS NOT NULL
  AND c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM profiles f
    WHERE f.id = c.father_id AND f.deleted_at IS NULL
  );
```

### Verify Marriage Status Values
```sql
SELECT DISTINCT status FROM marriages WHERE deleted_at IS NULL;
-- Should only return: 'current', 'past'
```

### Check Duplicate HIDs
```sql
SELECT hid, COUNT(*) as count
FROM profiles
WHERE hid IS NOT NULL AND deleted_at IS NULL
GROUP BY hid
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

### Check Permission Function Health
```sql
SELECT proname as function_name
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
AND (proname LIKE '%permission%' OR proname LIKE '%suggestion%')
ORDER BY proname;
-- Should return 18 functions
```

---

## ⚠️ Known Risks & Mitigation

### Risk 1: Cascade Delete Could Delete Large Branches
**Mitigation**:
- Test with 0, 1-5, 6-20, 100+ descendants
- Verify 100-descendant limit enforced
- Verify audit trail allows recovery
- Test permission validation across all descendants

### Risk 2: Concurrent Edits Could Overwrite Changes
**Mitigation**:
- Test optimistic locking with version conflicts
- Test row-level locking (FOR UPDATE NOWAIT)
- Verify graceful error messages

### Risk 3: Fields Could Disappear After Reload
**Mitigation**:
- Test all 41+ fields for persistence
- Verify RPC function coverage (get_branch_data, search_name_chain, admin_update_profile)
- Run comprehensive field mapping checklist

### Risk 4: Wrong Users Could Get Edit Access
**Mitigation**:
- Test all permission circles (inner, family, extended, admin, moderator, blocked, none)
- Test with real family relationships
- Verify UI buttons match permission level

---

## 📈 Success Criteria

Before adding real family data, **ALL** of these must pass:

### Data Integrity
- [ ] No orphaned profiles after any delete operation
- [ ] All soft-deleted profiles have audit trail with batch_id
- [ ] All marriage statuses are 'current' or 'past' (not legacy values)
- [ ] No duplicate HIDs in database
- [ ] All 41+ profile fields persist after save/reload
- [ ] Version conflicts handled gracefully

### Permissions
- [ ] Inner circle users can direct edit (self, spouse, parents, children, siblings, descendants)
- [ ] Family circle users see 48hr auto-approve message
- [ ] Extended circle users see manual approval required
- [ ] Blocked users cannot make suggestions
- [ ] Rate limiting enforced (10 suggestions/day)
- [ ] Admin/moderator permissions work correctly

### Business Logic
- [ ] HIDs generated correctly for all generations
- [ ] Generation numbers calculated correctly
- [ ] Search returns all expected results
- [ ] Parent-child relationships preserved
- [ ] Munasib (hid=NULL) handled correctly

### Performance
- [ ] get_branch_data() completes <1s for 100 profiles
- [ ] search_name_chain() completes <2s for 500 profiles
- [ ] Cascade delete completes <5s for 50 descendants
- [ ] Batch permission checks complete <500ms
- [ ] No memory leaks or crashes with large trees

### UI/UX
- [ ] ProfileSheet displays all fields correctly
- [ ] Permission-based buttons correct (تعديل vs اقتراح تعديل)
- [ ] Family tree renders without crashes
- [ ] Admin dashboard features work
- [ ] PDF export generates successfully
- [ ] WhatsApp messages send with correct variables

---

## 🛠️ Tools & Resources

### Testing Database Queries
- Use Supabase MCP: `mcp__supabase__query` tool
- Or: `node scripts/execute-sql.js test-queries.sql`
- Or: Supabase Dashboard SQL Editor

### Testing UI Features
- Use Expo dev server: `npm start`
- Test on physical iOS device (for RTL and gestures)
- Use React Native Debugger for state inspection

### Monitoring Performance
- Enable slow query logging in Supabase
- Use `EXPLAIN ANALYZE` for query performance
- Monitor memory usage during large tree rendering

### Documentation Reference
- **Full Test Plan**: [`PRE_PRODUCTION_TEST_PLAN.md`](PRE_PRODUCTION_TEST_PLAN.md)
- **Permission System**: [`PERMISSION_SYSTEM_V4.md`](PERMISSION_SYSTEM_V4.md)
- **Soft Delete Pattern**: [`SOFT_DELETE_PATTERN.md`](SOFT_DELETE_PATTERN.md)
- **Field Mapping**: [`FIELD_MAPPING.md`](FIELD_MAPPING.md)
- **Migration Guide**: [`MIGRATION_GUIDE.md`](MIGRATION_GUIDE.md)

---

## 📞 Next Steps

1. **Review this summary** and full test plan
2. **Prioritize which tests to run first** (recommend Phase 1: Critical Data Integrity)
3. **Set up test environment** (staging database with realistic test data)
4. **Execute tests systematically** (document results as you go)
5. **Fix any issues found** before moving to next phase
6. **Run full integrity check** before wiping test data

**Questions or concerns?** Review the full test plan for detailed test cases and verification queries.

---

**Status**: 🚨 **DRAFT - Testing Not Started**

**Last Updated**: [Date]
