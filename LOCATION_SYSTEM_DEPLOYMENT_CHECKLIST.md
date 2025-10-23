# Location System Deployment Checklist

**Status:** ⚠️ READY AFTER CRITICAL FIX
**Date:** October 23, 2025
**Total Migrations:** 5 (4 existing + 1 critical fix)

---

## 🚨 CRITICAL FIX REQUIRED

**Missing Unique Constraint Breaks UPSERT**

The seeding script will fail without this fix. Apply immediately:

```bash
# Migration already created at:
# supabase/migrations/20251023150361_add_place_standards_unique_constraint.sql

# Apply via MCP (from Claude Code):
mcp__supabase__apply_migration
```

**What it does:** Adds unique index on `place_name_en` to enable UPSERT operations.

**Impact:** Without this, seedLocationData.js will fail with "no unique constraint" error.

---

## ✅ Pre-Deployment Verification

### 1. Check for Existing Data Conflicts

```sql
-- Verify no duplicate place names (should return 0 rows)
SELECT place_name_en, COUNT(*)
FROM place_standards
GROUP BY place_name_en
HAVING COUNT(*) > 1;
```

**Expected:** 0 rows (no conflicts)

**If conflicts found:** Clean data before applying unique constraint.

---

### 2. Check for Malformed JSONB

```sql
-- Verify no existing malformed location data (should return 0 rows)
SELECT id, birth_place_normalized
FROM profiles
WHERE birth_place_normalized IS NOT NULL
  AND NOT (birth_place_normalized ? 'city' OR birth_place_normalized ? 'country');
```

**Expected:** 0 rows (no malformed data)

**If found:** Clean data:
```sql
UPDATE profiles
SET birth_place_normalized = NULL
WHERE birth_place_normalized IS NOT NULL
  AND NOT (birth_place_normalized ? 'city' OR birth_place_normalized ? 'country');
```

---

## 🚀 Deployment Steps

### Step 1: Apply All Migrations (IN ORDER)

**Already Applied (verify):**
1. ✅ `20251023150357_add_location_normalization.sql` (217 lines)
2. ✅ `20251023150358_add_location_normalized_to_admin_update.sql` (100 lines)
3. ✅ `20251023150359_add_location_to_get_branch_data.sql` (161 lines)
4. ✅ `20251023150360_add_location_validation_constraints.sql` (108 lines)

**MUST APPLY NOW:**
5. ⚠️ **`20251023150361_add_place_standards_unique_constraint.sql`** (CRITICAL FIX)

**Command:**
```bash
# Use MCP tool from Claude Code
mcp__supabase__apply_migration
```

---

### Step 2: Run Seeding Script

```bash
node scripts/seedLocationData.js
```

**Expected Output:**
```
🌍 Starting location data seeding...

1️⃣ Inserting/Updating Saudi Arabia...
✅ Saudi Arabia processed (ID: X)

2️⃣ Inserting/Updating Saudi cities...
✅ 26 Saudi cities processed

3️⃣ Inserting/Updating Gulf countries...
✅ United Arab Emirates
✅ Kuwait
✅ Bahrain
✅ Qatar
✅ Oman

4️⃣ Inserting/Updating Arab countries...
✅ Palestine (فلسطين - NOT Israel)
✅ Jordan
✅ Egypt
✅ Lebanon
✅ Syria
✅ Iraq
✅ Yemen
✅ Morocco
✅ Algeria
✅ Tunisia
✅ Libya
✅ Sudan

5️⃣ Inserting/Updating Western education destinations...
✅ United States
✅ United Kingdom
✅ Australia
✅ Canada
✅ Germany
✅ France
✅ Italy
✅ Spain
✅ Japan
✅ South Korea
✅ China
✅ Malaysia

6️⃣ Inserting/Updating other countries...
✅ 8 other countries processed

🎉 Seeding complete!
Total: 27 Saudi places + 44 countries
```

**Verify Count:**
```sql
SELECT region, place_type, COUNT(*)
FROM place_standards
GROUP BY region, place_type
ORDER BY region;
```

**Expected:**
```
saudi    | country | 1
saudi    | city    | 26
gulf     | country | 5
arab     | country | 12
western  | country | 12
other    | country | 8
```

**Total:** 64 locations

---

### Step 3: Test Idempotency

**Re-run seeding script:**
```bash
node scripts/seedLocationData.js
```

**Expected:** Script succeeds with no errors, no new duplicates created.

**Verify count unchanged:**
```sql
SELECT COUNT(*) FROM place_standards;
-- Should still be 64
```

---

### Step 4: Test in App

**Profile Editor Test:**

1. Open profile editor
2. Scroll to "مكان الميلاد" (birth place) field
3. Type "رياض" (partial Arabic text)
4. **Verify:**
   - ✅ Loading skeleton appears (3 gray items)
   - ✅ After ~350ms, autocomplete suggestions appear
   - ✅ "الرياض" appears at top (Saudi priority)
   - ✅ Red location icon shown (Saudi region)
   - ✅ "Riyadh" shown in gray (English name)

5. Select "الرياض" from suggestions
6. **Verify:**
   - ✅ Field shows "الرياض"
   - ✅ No warning message
   - ✅ Suggestions close

7. Type freeform text "قرية صغيرة"
8. **Verify:**
   - ✅ Warning appears: "لم نجد مطابقة. يمكنك المتابعة بهذا النص أو اختر من القائمة."
   - ✅ Can still save (semi-required)

9. Save profile
10. **Verify:**
    - ✅ No errors
    - ✅ Success message

11. Close and reopen profile
12. **Verify:**
    - ✅ birth_place shows saved value
    - ✅ Data persists

---

### Step 5: Verify Database State

**Check RPC functions work:**

```sql
-- Test autocomplete
SELECT * FROM search_place_autocomplete('رياض', 8);
-- Should return الرياض (Riyadh) and other matches

-- Test statistics
SELECT * FROM get_location_statistics();
-- Should return aggregated counts by location
```

**Check get_branch_data includes location fields:**

```sql
SELECT id, name, birth_place, birth_place_normalized
FROM get_branch_data('1', 3, 100)
WHERE birth_place IS NOT NULL
LIMIT 5;
```

**Expected:** All 4 location fields present in results.

---

## 📊 Post-Deployment Monitoring

### Performance Checks

**Monitor INSERT/UPDATE performance:**
```sql
-- Check query performance
EXPLAIN ANALYZE
UPDATE profiles
SET birth_place = 'الرياض',
    birth_place_normalized = '{"original": "الرياض", "city": {"ar": "الرياض", "en": "Riyadh", "id": 1}, "country": {"ar": "السعودية", "en": "Saudi Arabia", "code": "SA", "id": 999}, "confidence": 1.0}'
WHERE id = 'test-uuid';
```

**Expected:** Execution time < 50ms (JSONB indexes add ~5-10ms overhead)

**Monitor search logs:**
- Track failed autocomplete searches
- Add missing alternate_names for common variations
- Extend normalize_arabic_text() if patterns emerge

---

## 🐛 Troubleshooting

### Issue: Seeding Script Fails with "no unique constraint"

**Symptom:**
```
Error: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

**Cause:** Migration 20251023150361 not applied.

**Fix:**
```bash
# Apply the unique constraint migration
mcp__supabase__apply_migration
```

---

### Issue: Constraint Violation on Migration 20251023150360

**Symptom:**
```
ERROR: check constraint "check_birth_place_normalized_schema" is violated
```

**Cause:** Existing malformed JSONB data in profiles table.

**Fix:**
```sql
-- Find malformed data
SELECT id, birth_place_normalized
FROM profiles
WHERE birth_place_normalized IS NOT NULL
  AND NOT (birth_place_normalized ? 'city' OR birth_place_normalized ? 'country');

-- Clean it
UPDATE profiles
SET birth_place_normalized = NULL
WHERE birth_place_normalized IS NOT NULL
  AND NOT (birth_place_normalized ? 'city' OR birth_place_normalized ? 'country');

-- Re-apply migration
```

---

### Issue: Autocomplete Not Working

**Symptom:** User types in LocationInput but no suggestions appear.

**Possible Causes:**

1. **Seeding not run:** No data in place_standards table.
   ```sql
   SELECT COUNT(*) FROM place_standards;
   -- Should be 64
   ```

2. **RPC function error:** Check Supabase logs for errors.

3. **Network issue:** Check browser console for failed API calls.

---

### Issue: Location Data Not Persisting

**Symptom:** User saves profile but birth_place disappears on reload.

**Possible Causes:**

1. **admin_update_profile() missing fields:** Verify migration 20251023150358 applied.
   ```sql
   -- Check function signature
   SELECT proname, prosrc
   FROM pg_proc
   WHERE proname = 'admin_update_profile';
   -- Should include birth_place and birth_place_normalized in UPDATE statement
   ```

2. **get_branch_data() missing fields:** Verify migration 20251023150359 applied.
   ```sql
   -- Check function signature
   SELECT proname, prosrc
   FROM pg_proc
   WHERE proname = 'get_branch_data';
   -- Should include birth_place in RETURNS TABLE
   ```

---

## ✅ Success Criteria

- [ ] All 5 migrations applied successfully
- [ ] 64 locations seeded (verified count)
- [ ] Idempotency test passed (re-run script)
- [ ] Autocomplete works in app
- [ ] Location data persists across saves
- [ ] No performance degradation (< 50ms saves)
- [ ] No constraint violations in production

---

## 📚 Documentation References

- **Full Audit Report:** `LOCATION_SYSTEM_AUDIT_REPORT.md`
- **Field Mapping Guide:** `docs/FIELD_MAPPING.md` (lines 288-406)
- **Component Usage:** `src/components/admin/fields/LocationInput.js`
- **Seeding Script:** `scripts/seedLocationData.js`

---

**Last Updated:** 2025-10-23
**Status:** ⚠️ READY AFTER CRITICAL FIX (apply migration 20251023150361)
