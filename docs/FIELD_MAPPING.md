# Profile Field Mapping - Maintenance Checklist

## 🔒 CRITICAL: Version Field for Concurrent Edit Protection

**⚠️ When loading children for editing, ALWAYS include the `version` field!**

The `version` field enables **optimistic locking** to prevent concurrent edit conflicts. This is CRITICAL for:
- QuickAddOverlay (quick child management)
- Any modal that edits existing profiles
- Batch operations like reordering

### What Happens Without Version Field:
- ❌ All children default to `version: 1`
- ❌ Two users can edit simultaneously without conflict detection
- ❌ Last save wins (data corruption)

### Safe Query Pattern:
```javascript
// ✅ CORRECT: Include version
const { data } = await supabase
  .from("profiles")
  .select(`id, name, version, gender, mother_id, ...`)
  .or(`father_id.eq.${parentId},mother_id.eq.${parentId}`)
  .is("deleted_at", null);

// ❌ WRONG: Missing version
const { data } = await supabase
  .from("profiles")
  .select(`id, name, gender, mother_id, ...`)  // ← Missing version!
  .or(`father_id.eq.${parentId},mother_id.eq.${parentId}`);
```

### Affected Components:
- **ChildrenManager.js** (line 42-54) - Must SELECT version ✅
- **DraggableChildrenList.js** - Check if loads children independently
- **Any custom child-loading query** - Must include version

### Detection:
Developer mode will log a warning if version is missing:
```
[QuickAdd] ⚠️ Child missing version field - concurrent edits will not be protected!
```

---

## ⚠️ CRITICAL WARNING: Schema Mismatch Can Break Search!

**On January 16, 2025, search broke completely because `search_name_chain()` was missing `professional_title` and `title_abbreviation` fields.**

Frontend code (`SearchBar.js` line 530) calls `formatNameWithTitle(item)` which expects these fields. Without them, the function couldn't format names and search appeared broken.

**On October 18, 2025, search ranking was fixed** (Migration 20251018150000) - the multi-term scoring algorithm was completely rewritten with position-aware contiguous sequence matching. Now "إبراهيم سليمان علي" correctly returns Ibrahim first, then his children, then grandchildren.

**Lesson:** When modifying RPC functions, ALWAYS verify the RETURNS TABLE schema matches what the frontend expects!

## Problem This Solves

**Every time you add a field to the `profiles` table, you MUST update multiple RPC functions or the field will save but disappear on reload.**

This happened with:
- ✅ `professional_title` & `title_abbreviation` (Migrations 012 & 013)
- ✅ `achievements` & `timeline` (Migration 015)
- ❌ **Search broke** when these fields were removed from `search_name_chain()` (January 2025)

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
| birth_place_normalized | ✅ | ✅ | ❌ | ✅ |
| current_residence | ✅ | ✅ | ❌ | ✅ |
| current_residence_normalized | ✅ | ✅ | ❌ | ✅ |
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
**⚠️ CRITICAL: This function has 4 SELECT statements - must update ALL 4!**
```sql
DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT);

CREATE OR REPLACE FUNCTION search_name_chain(...)
RETURNS TABLE (
    -- ... existing fields ...
    favorite_color TEXT  -- ✅ ADD HERE (1/4)
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    -- Base case
    SELECT
        -- ... existing fields ...
        p.favorite_color  -- ✅ ADD HERE (2/4)
    FROM profiles p

    UNION ALL

    -- Recursive case
    SELECT
        -- ... existing fields ...
        a.favorite_color  -- ✅ ADD HERE (3/4) - Use 'a.' not 'parent.'!
    FROM ancestry a
    JOIN profiles parent ON (...)
  ),
  matches AS (
    SELECT DISTINCT ON (m.id)
        -- ... existing fields ...
        m.favorite_color  -- ✅ ADD HERE (Could be 'a.favorite_color' depending on migration)
    FROM ancestry m
  )
  SELECT
      -- ... existing fields ...
      m.favorite_color  -- ✅ ADD HERE (4/4)
  FROM matches m;
END;
$$;
```

**Common Bug:** Forgetting to add field in the recursive SELECT (step 3/4). This causes the field to be NULL for all profiles except generation 1!

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

### Admin: admin_list_permission_users()

**Added:** Migration `20251016120000_admin_list_permission_users_v2.sql`

Optimized RPC for Permission Manager with pagination, role filtering, and search. Consolidates 4 separate queries into 1 efficient function.

**Returns:**
- `id`, `hid`, `full_name_chain` (built via `build_name_chain()`)
- `phone`, `user_role` (aliased from `role`)
- `photo_url`, `generation`
- `professional_title`, `title_abbreviation`
- `total_count` (for pagination)

**Parameters:**
- `p_search_query TEXT` - Search by name chain (optional)
- `p_role_filter TEXT` - Filter by role: `super_admin`, `admin`, `moderator`, or `NULL` for all (optional)
- `p_limit INT` - Page size (default: 50)
- `p_offset INT` - Pagination offset (default: 0)

**Usage:**
```javascript
const { data, error } = await supabase.rpc('admin_list_permission_users', {
  p_search_query: 'محمد',
  p_role_filter: 'admin',
  p_limit: 50,
  p_offset: 0
});

// Extract total count from first row
const totalCount = data[0]?.total_count || 0;
```

**Permission:** Admin/super_admin only (checked in function)

## Location System (October 2025)

**Migration:** `20251023150357_add_location_normalization.sql` + support migrations

Hybrid system for flexible location input with statistical aggregation capabilities.

### Features

- **Flexible Input:** Users can type cities, countries, or freeform text
- **Normalized Reference:** Automatic matching to place_standards database with structured JSONB
- **Arabic-First Search:** Normalizes Hamza, Teh Marbuta, diacritics, and alternative spellings
- **Hierarchical Data:** Cities linked to countries via parent_id
- **Regional Prioritization:** Saudi cities (order 500-999) → Gulf (2000-2099) → Arab (3000-3099) → Western (4000-4099) → Other (5000+)

### Database Tables

**place_standards** - Reference table for all locations
```
id, place_name (ar), place_name_en, place_type (city/country),
parent_id (for cities), country_code (ISO 2-letter),
region (saudi/gulf/arab/western/other), display_order, alternate_names[], latitude, longitude
```

**profiles.birth_place** - User-entered text (flexible, user-controlled)
**profiles.birth_place_normalized** - Structured JSONB reference
```jsonb
{
  "original": "الرياض",
  "city": {"ar": "الرياض", "en": "Riyadh", "id": 1},
  "country": {"ar": "السعودية", "en": "Saudi Arabia", "code": "SA", "id": 999},
  "confidence": 1.0
}
```

Same structure for **current_residence** and **current_residence_normalized**.

### RPC Functions

**search_place_autocomplete(p_query, p_limit)** - Arabic-first autocomplete
```javascript
const { data } = await supabase.rpc('search_place_autocomplete', {
  p_query: 'رياض',     // User input (Arabic normalized internally)
  p_limit: 8            // Max 8 suggestions
});
// Returns: { id, display_name, display_name_en, region, country_name, normalized_data }
```

**get_location_statistics()** - Aggregate data by normalized location
```javascript
const { data } = await supabase.rpc('get_location_statistics');
// Returns: { location_ar, location_en, location_type, birth_count, residence_count, total_count }
```

### Component: LocationInput

**Location:** `src/components/admin/fields/LocationInput.js`

**Features:**
- Debounced search (350ms for smooth typing)
- Request sequence tracking (prevents stale results)
- Skeleton loading UI (while searching)
- Semi-required validation (warns if no match found)
- Regional color coding for suggestions
- Supports freeform input or structured selection

**Usage:**
```javascript
<LocationInput
  label="مكان الميلاد"
  value={draft?.birth_place || ''}
  onChange={(text) => updateField('birth_place', text)}
  normalizedValue={draft?.birth_place_normalized}
  onNormalizedChange={(data) => updateField('birth_place_normalized', data)}
  placeholder="مثال: الرياض، جدة، السعودية..."
/>
```

### Data Integrity

**Validation Constraints:**
- `birth_place_normalized` must have either city or country reference
- If city present: must have ar, en, id (and optional country link)
- If country present: must have ar, en, code, id
- confidence must be 0-1 numeric value
- place_standards records validated for valid names, type, region, display_order

**Indexes:**
- `idx_profiles_birth_place_city_id` - Efficient city-based aggregation
- `idx_profiles_birth_place_country_id` - Efficient country-based aggregation
- `idx_place_standards_name` - Fast Arabic lookups
- `idx_place_standards_order` - Efficient priority ordering

### Example: Using Location Data

**In ProfileViewer/TabDetails.js:**
```javascript
import LocationInput from '../../admin/fields/LocationInput';

<LocationInput
  label="مكان الميلاد"
  value={draft?.birth_place}
  onChange={(text) => updateField('birth_place', text)}
  normalizedValue={draft?.birth_place_normalized}
  onNormalizedChange={(data) => updateField('birth_place_normalized', data)}
/>
```

**Seeding Data:**
```bash
node scripts/seedLocationData.js
```

Uses UPSERT for idempotency (safe to run multiple times). Seeds:
- 27 Saudi places (26 cities + 1 country)
- 5 Gulf countries
- 12 Arab countries (including Palestine PS)
- 12 Western education destinations (USA, UK, Australia, Canada first)
- 8 Other countries

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
