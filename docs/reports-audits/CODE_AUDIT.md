# Code Audit - Spouse Management System Changes

## Files Modified
1. `src/components/admin/SpouseManager.js`
2. `src/components/InlineSpouseAdder.js`
3. `docs/munasib-system-documentation.md`

## Changes Made

### SpouseManager.js
**Lines 134-148**: Direct Supabase insert replacing RPC call
```javascript
const { data: newPerson, error: createError } = await supabase
  .from('profiles')
  .insert({
    name: newSpouseName.trim(),
    gender: spouseGender,
    generation: person.generation,
    family_origin: familyOrigin,
    hid: null,
    status: 'alive',
    is_root: false,
    sibling_order: 0,
    phone: newSpousePhone.trim() || null,
  })
  .select()
  .single();
```

### InlineSpouseAdder.js
**Lines 84-97**: Similar direct insert pattern
```javascript
const { data: newSpouse, error: createError } = await supabase
  .from('profiles')
  .insert({
    name: spouseName.trim(),
    gender: spouseGender,
    generation: person?.generation || 0,
    family_origin: familyOrigin || null,
    hid: null,
    status: 'alive',
    is_root: false,
    sibling_order: 0,
  })
  .select()
  .single();
```

## Potential Issues Found

### 1. Missing Required Fields
**ISSUE**: Database schema shows these fields are NOT NULL but we're not setting them:
- `created_at` - Usually auto-generated but should verify
- `updated_at` - Usually auto-generated but should verify

### 2. Generation Field
**ISSUE**: In profiles table schema, generation has constraint `CHECK (generation > 0)`
- SpouseManager: Uses `person.generation` (should be okay if person exists)
- InlineSpouseAdder: Uses `person?.generation || 0` ❌ **This will fail constraint!**

### 3. Missing Error User Feedback
**ISSUE**: InlineSpouseAdder only logs to console, doesn't show user-friendly error:
```javascript
catch (error) {
  console.error("Error adding spouse:", error);
  // No Alert.alert() to inform user
}
```

### 4. Inconsistent Default Values
**ISSUE**: Different defaults between two components:
- SpouseManager: No default for generation
- InlineSpouseAdder: Defaults to 0 (invalid)

### 5. No Validation Before Insert
**ISSUE**: No checks for:
- Valid generation value
- Name not empty (handled by trim() but no explicit check)
- Gender is valid ('male' or 'female')

## Critical Fixes Needed

### 1. Fix Generation Default (CRITICAL)
InlineSpouseAdder line 89:
```javascript
// WRONG - violates CHECK constraint
generation: person?.generation || 0

// CORRECT
generation: person?.generation || 1  // Minimum valid generation
```

### 2. Add User Error Feedback
InlineSpouseAdder line 119:
```javascript
catch (error) {
  console.error("Error adding spouse:", error);
  Alert.alert("خطأ", "فشل في إضافة الزوج/الزوجة");
}
```

### 3. Add Validation
Both files should validate before insert:
```javascript
if (!person?.generation || person.generation < 1) {
  throw new Error("Invalid generation value");
}
```

## What's Working Correctly

✅ NULL HID for Munasib identification
✅ family_origin extraction and storage
✅ Direct insert avoids HID generation
✅ Marriage creation after profile creation
✅ Gender assignment based on current person

## Immediate Action Required

1. **Fix generation default in InlineSpouseAdder** - Will cause database constraint violation
2. **Add Alert import to InlineSpouseAdder** - For user feedback
3. **Test with actual data** - Verify all constraints are met

## Database Constraints to Consider
From migration files:
- `generation INT NOT NULL CHECK (generation > 0)`
- `gender TEXT NOT NULL CHECK (gender IN ('male', 'female'))`
- `name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) > 0)`
- `status TEXT NOT NULL DEFAULT 'alive'`