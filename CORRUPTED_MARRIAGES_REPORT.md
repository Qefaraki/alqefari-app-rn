# Corrupted Marriages Report

**Generated:** 2025-10-18
**Issue:** Cousin marriage validation bug created backwards marriages

---

## Summary

Found **1 corrupted marriage** in the database:

- **Marriage ID:** `23323b59-dd91-4839-b24f-b05c71603edb`
- **Created:** 2025-10-18 12:48:01
- **Issue Type:** BACKWARDS_COUSIN

---

## Details

### Corrupted Marriage

- **Husband:** أمين (ID: `c8549317-edc2-41fb-8040-830958fa9f80`)
  - HID: `NULL` (munasib profile)
  - family_origin: `NULL` ⚠️ **MISSING**
  - Gender: male

- **Wife:** ريم (ID: `0bef61dd-d8a1-43cb-af75-20500102b3af`)
  - HID: `R1.2.1.1.1.1.2` (Al-Qefari family member)
  - family_origin: `NULL` (correct for Al-Qefari)
  - Gender: female

- **Marriage Data:**
  - munasib: `NULL` ⚠️ **SHOULD HAVE FAMILY NAME**
  - status: `current`
  - deleted_at: `NULL` (active)

---

## Root Cause

The husband "أمين" is a munasib profile (external spouse) but was created without:
1. `family_origin` field (should contain family name like "العثمان")
2. `munasib` field in marriages table (should match family_origin)

This happened because the validation in `SpouseManager.js:197-199` only checked:
```javascript
selectedSpouse.hid !== null
```

This check failed to distinguish between:
- **Al-Qefari members**: `hid !== null` ✅
- **Munasib profiles**: `hid === null` ✅ (but also need `family_origin !== null`)
- **ERROR STATE**: `hid === null AND family_origin === null` ❌ **THIS IS THE BUG**

---

## Recommended Action

**MANUAL REVIEW REQUIRED:**

User "عبدالعزيز" (HID: R1.2.1.1.1.1.1) needs to provide:
1. The full name of "أمين" including family name (e.g., "أمين محمد العثمان")
2. Confirm if this is a valid marriage or a test entry

**Once confirmed, fix with:**

```sql
-- Update husband profile with correct family_origin
UPDATE profiles
SET family_origin = 'العثمان'  -- Replace with actual family name
WHERE id = 'c8549317-edc2-41fb-8040-830958fa9f80';

-- Update marriage with correct munasib field
UPDATE marriages
SET munasib = 'العثمان'  -- Must match family_origin
WHERE id = '23323b59-dd91-4839-b24f-b05c71603edb';
```

**OR if this is a test/invalid entry:**

```sql
-- Soft delete the marriage
UPDATE marriages
SET deleted_at = NOW()
WHERE id = '23323b59-dd91-4839-b24f-b05c71603edb';

-- Optionally soft delete the husband profile if no other marriages
UPDATE profiles
SET deleted_at = NOW()
WHERE id = 'c8549317-edc2-41fb-8040-830958fa9f80'
  AND NOT EXISTS (
    SELECT 1 FROM marriages m
    WHERE (m.husband_id = 'c8549317-edc2-41fb-8040-830958fa9f80'
           OR m.wife_id = 'c8549317-edc2-41fb-8040-830958fa9f80')
      AND m.id != '23323b59-dd91-4839-b24f-b05c71603edb'
      AND m.deleted_at IS NULL
  );
```

---

## Prevention

**Fixes Applied:**

1. ✅ **SpouseManager.js** - Added defensive HID validation:
   - Now checks BOTH person.hid AND spouse.hid before marking as cousin marriage
   - Added detailed console logging in dev mode
   - Prevents creating marriages with `munasib: null` for non-family spouses

2. ✅ **SpouseRow.js** - Added null safety checks:
   - Validates `spouse?.id` before navigation
   - Validates `spouseData?.marriage_id` before deletion
   - Shows user-friendly error messages instead of crashing

**Future Prevention:**

Consider adding database constraint:
```sql
-- Ensure munasib profiles have family_origin
ALTER TABLE profiles ADD CONSTRAINT check_munasib_family_origin
  CHECK (hid IS NOT NULL OR family_origin IS NOT NULL);

-- Ensure marriages have munasib if one spouse is non-Al-Qefari
-- (This is complex due to cousin marriage logic, needs careful design)
```

---

## Testing Checklist

After fix is deployed, test these scenarios:

- [ ] Create cousin marriage (both Al-Qefari) → `munasib: NULL` ✅
- [ ] Create regular marriage (one munasib) → `munasib: "family_name"` ✅
- [ ] Try to delete corrupted marriage → No crash ✅
- [ ] Try to visit corrupted spouse → No crash, shows error ✅
- [ ] Verify SpouseRow shows correct UI for both types ✅

---

**Status:** ⚠️ Waiting for user confirmation on "أمين" profile
