# Profile Field Mapping - Maintenance Checklist

## Problem This Solves

**Every time you add a field to the `profiles` table, you MUST update multiple RPC functions or the field will save but disappear on reload.**

This happened with:
- ✅ `professional_title` & `title_abbreviation` (Migrations 012 & 013)
- ✅ `achievements` & `timeline` (Migration 015)

## The Rule: "Add Once, Update Everywhere"

When you add a **new column** to the `profiles` table, you **MUST** update these 4 locations:

### ☑️ Checklist

- [ ] **1. profiles table** - Add the column (CREATE or ALTER TABLE)
- [ ] **2. get_branch_data()** - Add to RETURNS TABLE and all SELECT statements
- [ ] **3. search_name_chain()** - Add to RETURNS TABLE and all SELECT statements
- [ ] **4. admin_update_profile()** - Add to UPDATE statement whitelist
- [ ] **5. Test** - Verify field persists across save/reload in app

## Current Field Coverage (as of Migration 015)

### ✅ Complete Coverage - These fields work everywhere:

| Field | Database | get_branch_data | search_name_chain | admin_update_profile |
|-------|----------|-----------------|-------------------|---------------------|
| **Core** | | | | |
| id | ✅ | ✅ | ✅ | ✅ |
| hid | ✅ | ✅ | ✅ | ✅ |
| name | ✅ | ✅ | ✅ | ✅ |
| father_id | ✅ | ✅ | ✅ | ✅ |
| mother_id | ✅ | ✅ | ✅ | ✅ |
| generation | ✅ | ✅ | ✅ | ✅ |
| sibling_order | ✅ | ✅ | ✅ | ✅ |
| **Names** | | | | |
| kunya | ✅ | ✅ | ✅ | ✅ |
| nickname | ✅ | ✅ | ❌ | ✅ |
| professional_title | ✅ | ✅ | ✅ | ✅ |
| title_abbreviation | ✅ | ✅ | ✅ | ✅ |
| **Basic Info** | | | | |
| gender | ✅ | ✅ | ✅ | ✅ |
| status | ✅ | ✅ | ✅ | ✅ |
| photo_url | ✅ | ✅ | ✅ | ✅ |
| **Dates** | | | | |
| dob_data | ✅ | ✅ | ✅ | ✅ |
| dod_data | ✅ | ✅ | ✅ | ✅ |
| dob_is_public | ✅ | ✅ | ❌ | ✅ |
| **Location & Work** | | | | |
| birth_place | ✅ | ✅ | ❌ | ✅ |
| current_residence | ✅ | ✅ | ❌ | ✅ |
| occupation | ✅ | ✅ | ❌ | ✅ |
| education | ✅ | ✅ | ❌ | ✅ |
| **Contact** | | | | |
| phone | ✅ | ✅ | ✅ | ✅ |
| email | ✅ | ✅ | ✅ | ✅ |
| **Rich Content** | | | | |
| bio | ✅ | ✅ | ✅ | ✅ |
| achievements | ✅ | ✅ | ✅ | ✅ |
| timeline | ✅ | ✅ | ✅ | ✅ |
| social_media_links | ✅ | ✅ | ❌ | ✅ |
| **System** | | | | |
| layout_position | ✅ | ✅ | ❌ | ❌ |
| descendants_count | ✅ | ✅ | ❌ | ❌ |
| version | ✅ | ✅ | ❌ | ❌ |
| profile_visibility | ✅ | ✅ | ❌ | ✅ |
| role | ✅ | ✅ | ❌ | ✅ |
| user_id | ✅ | ✅ | ❌ | ❌ |
| family_origin | ✅ | ✅ | ❌ | ❌ |
| created_at | ✅ | ✅ | ❌ | ❌ |
| updated_at | ✅ | ✅ | ❌ | ❌ |
| deleted_at | ✅ | ❌ | ❌ | ❌ |

## Step-by-Step: Adding a New Field

### Example: Adding `favorite_color TEXT` field

#### Step 1: Add to Database
```sql
-- migration/XXX_add_favorite_color.sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS favorite_color TEXT;
```

#### Step 2: Update get_branch_data()
```sql
DROP FUNCTION IF EXISTS get_branch_data(TEXT, INT, INT);

CREATE OR REPLACE FUNCTION get_branch_data(...)
RETURNS TABLE(
    -- ... existing fields ...
    favorite_color TEXT,  -- ✅ ADD HERE
    -- ... rest of fields ...
)
AS $function$
BEGIN
    RETURN QUERY
    WITH RECURSIVE branch AS (
        -- Base case
        SELECT
            -- ... existing fields ...
            p.favorite_color,  -- ✅ ADD HERE
            -- ... rest ...
        FROM profiles p

        UNION ALL

        -- Recursive case
        SELECT
            -- ... existing fields ...
            p.favorite_color,  -- ✅ ADD HERE
            -- ... rest ...
        FROM profiles p
        INNER JOIN branch b ON (...)
    )
    SELECT
        -- ... existing fields ...
        b.favorite_color,  -- ✅ ADD HERE
        -- ... rest ...
    FROM branch b;
END;
$function$;
```

#### Step 3: Update search_name_chain()
```sql
DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT);

CREATE OR REPLACE FUNCTION search_name_chain(...)
RETURNS TABLE (
    -- ... existing fields ...
    favorite_color TEXT  -- ✅ ADD HERE
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    SELECT
        -- ... existing fields ...
        p.favorite_color  -- ✅ ADD HERE
    FROM profiles p

    UNION ALL

    SELECT
        -- ... existing fields ...
        a.favorite_color  -- ✅ ADD HERE
    FROM ancestry a
    JOIN profiles parent ON (...)
  ),
  matches AS (
    SELECT DISTINCT ON (m.id)
        -- ... existing fields ...
        m.favorite_color  -- ✅ ADD HERE
    FROM ancestry m
  )
  SELECT
      -- ... existing fields ...
      m.favorite_color  -- ✅ ADD HERE
  FROM matches m;
END;
$$;
```

#### Step 4: Update admin_update_profile()
```sql
CREATE OR REPLACE FUNCTION admin_update_profile(...)
AS $$
BEGIN
    UPDATE profiles SET
        -- ... existing fields ...
        favorite_color = CASE WHEN p_updates ? 'favorite_color'
                              THEN (p_updates->>'favorite_color')::TEXT
                              ELSE favorite_color END,  -- ✅ ADD HERE
        -- ... rest ...
    WHERE id = p_id;
END;
$$;
```

#### Step 5: Test in App
1. Open profile editor
2. Add a favorite color
3. Save
4. Close and reopen profile
5. ✅ Verify favorite_color is still there

## Common Mistakes

### ❌ DON'T: Add field only to table
```sql
ALTER TABLE profiles ADD COLUMN new_field TEXT;
-- Field will save but disappear on reload!
```

### ❌ DON'T: Forget the recursive SELECT
```sql
-- Base case
SELECT p.new_field FROM profiles p
UNION ALL
-- Recursive - MISSING new_field here! ❌
SELECT p.other_field FROM profiles p
```

### ✅ DO: Update all 3 places in each RPC
```sql
-- 1. RETURNS TABLE definition
RETURNS TABLE(new_field TEXT)

-- 2. Base case SELECT
SELECT p.new_field FROM profiles p

-- 3. Recursive case SELECT
SELECT p.new_field FROM profiles p INNER JOIN branch b

-- 4. Final SELECT
SELECT b.new_field FROM branch b
```

## Helper Functions

### Optional: get_full_profile_by_id()

Use this function when you need **ALL** fields (like in profile editor):

```javascript
// Instead of this:
const { data } = await supabase.rpc('get_branch_data', { p_hid: '1' });

// Use this for editing:
const { data } = await supabase.rpc('get_full_profile_by_id', { p_id: profileId });
```

Returns **every** field in the profiles table automatically.

## Why This Matters

### Before Migration 015:
```javascript
// Save
await supabase.rpc('admin_update_profile', {
  p_updates: { achievements: ['Award 1', 'Award 2'] }
});
// ✅ Saves to database

// Reload
const profile = await supabase.rpc('get_branch_data', {...});
console.log(profile.achievements);  // ❌ undefined!
```

### After Migration 015:
```javascript
// Save
await supabase.rpc('admin_update_profile', {
  p_updates: { achievements: ['Award 1', 'Award 2'] }
});
// ✅ Saves to database

// Reload
const profile = await supabase.rpc('get_branch_data', {...});
console.log(profile.achievements);  // ✅ ['Award 1', 'Award 2']
```

## Quick Reference

**Adding a field? Update these files:**
1. `migrations/XXX_your_migration.sql` - Table + all 3 RPC functions
2. This file (`docs/FIELD_MAPPING.md`) - Update the coverage table
3. Test the field in the profile editor

**Questions?**
- Check Migration 015 as reference
- See `migrations/012_add_titles_to_rpc_functions.sql` for title fields example
- See `migrations/015_comprehensive_profile_fields.sql` for complete example
