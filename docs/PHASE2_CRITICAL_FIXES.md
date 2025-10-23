# Phase 2 Critical Fixes - October 23, 2025

## Overview

Two critical bugs were discovered and fixed during Phase 2 Day 6 completion:

1. **React Hooks Error** - Component rendering crash
2. **RPC Filter Bug** - Tree completely broken, no profiles visible

Both issues are now resolved and the app is functional.

---

## Fix 1: React Hooks Error

**Error**: `Error: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.`

**Status**: ✅ FIXED

### Root Cause

`useEffect` hook (shimmer animation) was placed **AFTER** an early return statement in TreeView.js:

```javascript
// ❌ WRONG - Hook after return
if (networkError) {
  return <NetworkErrorView />; // Line 3374
}

useEffect(() => {
  // Shimmer animation
}, [showSkeleton]); // Line 3385
```

This violates React's **Rules of Hooks** - all hooks must be called in the same order on every render.

### Solution

Moved the `useEffect` hook **BEFORE** all early returns:

```javascript
// ✅ CORRECT - Hook before any returns
useEffect(() => {
  // Shimmer animation
}, [showSkeleton]); // Line 3372

if (networkError) {
  return <NetworkErrorView />; // Line 3395
}
```

**File**: `src/components/TreeView.js:3372-3403`

**Commit**: `8ca62e558` - "fix: Move shimmer useEffect before early return"

---

## Fix 2: RPC Filter Bug (Tree Completely Broken)

**Error**: `Error loading root node: null` - RPC returns empty array

**Status**: ✅ FIXED

### Root Cause

Migration `20251023150359_add_location_to_get_branch_data.sql` incorrectly filtered out profiles with HIDs starting with 'R':

```sql
-- ❌ WRONG - Excludes all R% profiles (real family tree)
WHERE (p_hid IS NULL AND p.generation = 1
       AND p.hid NOT LIKE 'R%' AND p.hid NOT LIKE 'TEST%')
```

**Impact**:
- Root node `R1` excluded
- All descendants `R1.1`, `R1.1.1`, etc. excluded
- `getBranchData(null, 1, 1)` returned `[]` (empty)
- Entire tree completely broken

### Investigation Process

1. **App logs** showed `rootError: null` but validation failed
2. **Direct SQL** confirmed generation 1 profile exists: `R1` (سليمان)
3. **RPC test** returned empty: `SELECT * FROM get_branch_data(NULL, 1, 1) → []`
4. **Function inspection** revealed incorrect `p.hid NOT LIKE 'R%'` filter

### Solution

Created migration `20251023150400_fix_get_branch_data_r_prefix_filter.sql`:

**Changes**:
1. ✅ Removed incorrect `R%` filter (only keep `TEST%` filter)
2. ✅ Restored `max_depth` limit to 15 (was reduced to 10)
3. ✅ Added missing fields: `kunya`, `nickname`, `full_name_chain`, `professional_title`, etc.
4. ✅ Increased limit to 10,000 (frontend uses 5,000)
5. ✅ Added proper soft delete filtering (`deleted_at IS NULL`)
6. ✅ Fixed deduplication logic for cousin marriages

**Correct filter**:
```sql
-- ✅ CORRECT - Only exclude TEST profiles
WHERE p.hid IS NOT NULL
  AND p.deleted_at IS NULL
  AND p.hid NOT LIKE 'TEST%'  -- Only TEST%, NOT R%!
  AND ((p_hid IS NULL AND p.generation = 1) OR ...)
```

**Verification**:
```sql
-- Root node returns correctly
SELECT * FROM get_branch_data(NULL, 1, 1);
-- Result: id=1c51bbf4..., hid=R1, name=سليمان ✅

-- Full tree loads (2,114 profiles)
SELECT COUNT(*) FROM get_branch_data(NULL, 15, 5000);
-- Result: 2114 ✅
```

**Migration**: `supabase/migrations/20251023150400_fix_get_branch_data_r_prefix_filter.sql`

**Commit**: `d55b2d628` - "fix(database): Remove incorrect R% HID filter"

---

## Testing Performed

### Fix 1 (Hooks)
- ✅ Component renders without hooks error
- ✅ Network error state still works correctly
- ✅ Shimmer animation runs on skeleton load

### Fix 2 (RPC)
- ✅ RPC returns root node: `get_branch_data(NULL, 1, 1)` → 1 profile
- ✅ Full tree loads: `get_branch_data(NULL, 15, 5000)` → 2,114 profiles
- ✅ All fields present: `kunya`, `full_name_chain`, `location_normalized`
- ✅ TEST profiles excluded, R profiles included
- ✅ Soft deleted profiles excluded

---

## Debug Logging Added

Enhanced debug logging in `TreeView.js:928-940` to diagnose RPC issues:

```javascript
console.log("=== ROOT NODE DEBUG ===");
console.log("rootError:", rootError);
console.log("rootData type:", typeof rootData);
console.log("rootData is array?:", Array.isArray(rootData));
console.log("rootData length:", rootData?.length);
console.log("rootData value:", JSON.stringify(rootData, null, 2));
console.log("Validation checks:");
console.log("  - rootError?", !!rootError);
console.log("  - !rootData?", !rootData);
console.log("  - !Array.isArray?", !Array.isArray(rootData));
console.log("  - length === 0?", rootData?.length === 0);
console.log("======================");
```

**Purpose**: Identifies which exact validation condition fails during tree loading.

**Status**: Can be removed after confirming app stability.

---

## Impact Assessment

### Before Fixes
- ❌ App crashed on load with React hooks error
- ❌ Tree completely broken (empty array from RPC)
- ❌ No profiles visible on tree screen
- ❌ "Error loading root node: null" shown repeatedly

### After Fixes
- ✅ App loads without crashes
- ✅ Tree RPC returns 2,114 profiles
- ✅ Root node (R1) loads correctly
- ✅ Full family tree visible
- ✅ All fields present (name chain, locations, titles)

---

## Lessons Learned

### 1. React Hooks Ordering
- **Rule**: ALL hooks must be called before ANY early returns
- **Pattern**: Place all `useState`, `useEffect`, `useCallback`, etc. at component top
- **Validation**: Check for early returns after hook declarations

### 2. Migration Testing
- **Problem**: Migration applied successfully but had logic bug
- **Solution**: Always test migrations with realistic data before applying
- **Verification**: Run SELECT queries matching frontend usage patterns

### 3. HID Naming Convention
- **Family profiles**: `R1`, `R1.1`, `R1.1.1` (R = Root lineage)
- **Test profiles**: `TEST1`, `TEST2` (excluded from queries)
- **Filter rule**: Exclude `TEST%` only, NEVER exclude `R%`

---

## Related Files

**Code**:
- `src/components/TreeView.js` (lines 3372-3403, 928-940)
- `src/services/profiles.js` (getBranchData wrapper)

**Migrations**:
- `supabase/migrations/20251023150400_fix_get_branch_data_r_prefix_filter.sql` (fix)
- `supabase/migrations/20251023150359_add_location_to_get_branch_data.sql` (broke)
- `supabase/migrations/20251018180331_increase_get_branch_data_max_depth.sql` (base)

**Documentation**:
- `docs/PHASE2_PROGRESS_SUMMARY.md` (Phase 2 status)
- `docs/PHASE2_DAY6_COMPLETE.md` (Day 6 extraction)

---

## Next Steps

1. **Monitor app logs** for any remaining issues
2. **Remove debug logging** after confirming stability (TreeView.js:928-940)
3. **Continue Phase 2** - Extract remaining high-priority components
4. **Integration phase** - Wire extracted components into TreeView.js

---

**Status**: ✅ Both critical bugs fixed, app functional, tree loading correctly

**Date**: October 23, 2025
**Risk Level**: LOW (issues resolved, migrations applied)
**Confidence**: 95% (verified with direct SQL and app testing)
