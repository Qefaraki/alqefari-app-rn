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

---

## 🔄 Batch Operations Pattern

When updating multiple profiles atomically (e.g., reordering children), use batch RPCs with version validation:

### ✅ CORRECT: Batch RPC (Atomic + Version-Safe)

```javascript
// Reorder children atomically with version validation
const { data, error } = await supabase.rpc('admin_batch_reorder_children', {
  p_reorder_operations: [
    { id: 'uuid1', new_sibling_order: 0, version: 1 },
    { id: 'uuid2', new_sibling_order: 1, version: 2 }
  ],
  p_parent_id: parentId
});

if (error) {
  // Version conflict detected - another user edited
  console.error('Concurrent edit detected:', error);
} else {
  // All children updated atomically with new versions
  console.log(`Updated ${data.updated_count} children`);
}
```

### ❌ WRONG: RPC Loop (10-25x Slower + Data Corruption Risk)

```javascript
// ❌ DO NOT DO THIS!
const updates = children.map((child, index) =>
  supabase.rpc('admin_update_profile', {
    p_id: child.id,
    p_updates: { sibling_order: index },
    p_version: child.version
  })
);

await Promise.all(updates);
// Problems:
// - If child 5/10 fails, children 1-4 already updated (partial failure)
// - 10 RPC calls instead of 1 (10x slower)
// - 10 audit log entries instead of 1 grouped entry
// - No atomic guarantee
```

### ❌ WRONG: Direct Update (No Version Check = Data Corruption)

```javascript
// ❌ NEVER DO THIS!
await supabase
  .from('profiles')
  .update({ sibling_order: newOrder })
  .eq('id', childId);
// No version validation - concurrent edits will overwrite each other!
```

---

## admin_batch_reorder_children() RPC

**Location:** `supabase/migrations/20251026010000_admin_batch_reorder_children.sql`

**Purpose:** Atomically reorder children with version validation and permission checks

**Features:**
- ✅ Optimistic locking via version field
- ✅ Single permission check on parent (not N+1 loop)
- ✅ Advisory lock prevents concurrent reorders
- ✅ Operation group integration for grouped undo
- ✅ Comprehensive input validation (5 edge cases)
- ✅ Version increment after successful update
- ✅ Performance: <200ms for 50 children

**Parameters:**

```javascript
{
  p_reorder_operations: JSONB,  // Array of {id, new_sibling_order, version}
  p_parent_id: UUID             // Parent whose children to reorder
}
```

**Returns:**

```json
{
  "success": true,
  "operation_group_id": "uuid",
  "updated_count": 5,
  "batch_size": 5,
  "duration_ms": 87
}
```

**Error Handling:**

| Error | Cause | Action |
|-------|-------|--------|
| `version mismatch` | Another user edited child | Reload and retry |
| `Permission denied` | User can't edit parent | Show error, don't retry |
| `Child doesn't belong to parent` | Invalid parent-child relationship | Data integrity issue, contact admin |
| `Duplicate sibling_order` | Input validation failed | Report bug, check input |
| `Concurrent operation` | Another reorder in progress | Wait and retry |

**Usage in RelationshipManagerV2:**

```javascript
const handleChildrenReorder = async (newOrder) => {
  const previousOrder = [...children]; // Backup
  setChildren(newOrder);  // Optimistic update

  try {
    const reorderOps = newOrder.map((child, index) => ({
      id: child.id,
      new_sibling_order: index,
      version: child.version ?? 1  // Handles null/undefined
    }));

    const { data, error } = await supabase.rpc('admin_batch_reorder_children', {
      p_reorder_operations: reorderOps,
      p_parent_id: profile.id
    });

    if (error) {
      setChildren(previousOrder);  // Rollback on error
      // User-friendly error message
      if (error.message.includes('version')) {
        Alert.alert('خطأ', 'تم تحديث البيانات من قبل مستخدم آخر');
      }
      return;
    }

    // Success - reload to get fresh versions
    loadChildren();
  } catch (error) {
    setChildren(previousOrder);
    console.error('Reorder failed:', error);
  }
};
```

---

## Affected Components

**Version Field Required:**
- ✅ **ChildrenManager.js** (line 52) - SELECT includes version
- ✅ **QuickAddOverlay.js** (line 181) - Defensive fallback `version ?? 1`
- ✅ **RelationshipManagerV2.js** (line 177) - SELECT includes version
- ✅ **TabFamily.js** - Uses `get_profile_family_data()` RPC (returns all fields)

**Batch Reorder RPC:**
- ✅ **RelationshipManagerV2.js** (line 319) - Uses `admin_batch_reorder_children()`
- ✅ **DraggableChildrenList.js** - Calls `handleChildrenReorder()`
- See `migrations/015_comprehensive_profile_fields.sql` for complete example

---

## 🚀 Performance Optimization: Structural vs Non-Structural Fields

**Status:** ✅ Implemented (October 27, 2025) - Fast path for photo updates

### Problem Solved

Profile picture changes were causing 200-500ms freezes due to:
1. O(n²) nested loop in image prefetch (2.5M lookups for 3000-node tree)
2. Full tree recalculation on every field update (filtering, sorting)
3. Cascading re-renders triggering expensive prefetch

### Solution: Field-Type Detection

The `updateNode()` method in `useTreeStore.js` now automatically detects field types and uses different update paths:

**Structural Fields** (Full Recalculation):
```javascript
const structuralFields = ['father_id', 'munasib_id', 'sibling_order', 'deleted_at'];
```
- Require filtering deleted nodes
- Require sorting by sibling_order
- Affect tree layout or visibility
- Uses **full recalculation path**

**Non-Structural Fields** (Fast Path):
```javascript
// Examples: photo_url, professional_title, title_abbreviation, name, dates, bio, etc.
```
- Don't affect tree structure
- Don't require filtering or sorting
- Use **fast path** (shallow array update only)
- **~90-98% faster** than full recalculation

### Implementation Details

**File:** `src/stores/useTreeStore.js` (lines 104-173)

```javascript
updateNode: (nodeId, updatedData) => {
  // Auto-detect structural vs non-structural
  const isStructural = Object.keys(updatedData).some(key =>
    structuralFields.includes(key)
  );

  if (isStructural) {
    // Full path: filter + sort
    const newTreeData = Array.from(newNodesMap.values())
      .filter(n => !n.deleted_at)
      .sort((a, b) => (a.sibling_order || 0) - (b.sibling_order || 0));
  } else {
    // Fast path: map only
    const newTreeData = state.treeData.map((node) =>
      node.id === nodeId ? updatedNode : node
    );
  }
}
```

### Prefetch Optimization

**File:** `src/components/TreeView.js` (lines 1183-1236)

**Before (O(n²)):**
```javascript
const parent = nodes.find((n) => n.id === node.father_id);  // O(n) search
const children = nodes.filter((n) => n.father_id === node.id);  // O(n) search
```

**After (O(1)):**
```javascript
const parent = indices.idToNode.get(node.father_id);  // O(1) Map lookup
const children = indices.parentToChildren.get(node.id) || [];  // O(1) Map lookup
```

**Debouncing:** 300ms delay prevents rapid-fire updates during batch operations

### Performance Impact

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Photo change (50 nodes) | 50ms | <5ms | **90%** |
| Photo change (3000 nodes) | 500ms | <20ms | **96%** |
| 5 rapid changes | 2500ms | <60ms | **98%** |
| Prefetch O(n²) loop | 2.5M lookups | O(n) lookups | **99.9%** |

### Developer Mode Logging

When `__DEV__` is true, console logs show which path is used:

```javascript
// Fast path
[TreeStore] Fast path update for 123: ['photo_url'] (~0.3% faster)

// Structural path
[TreeStore] Structural update for 456: ['sibling_order', 'deleted_at']

// Prefetch timing
[TreeView] Prefetch completed in 3.24ms (487 visible nodes, 6 URLs to preload)
```

### Adding New Fields

When adding a new field to `profiles`:
1. **Default:** Field uses **fast path** (no action needed)
2. **If structural** (affects tree layout/visibility):
   - Add field name to `structuralFields` array in `useTreeStore.js` line 120
   - Example: If adding `is_hidden` field that filters nodes from view

### Related Documentation

📖 **Complete technical documentation:** [`/docs/TREEVIEW_PERFORMANCE_OPTIMIZATION.md`](TREEVIEW_PERFORMANCE_OPTIMIZATION.md)

Includes:
- Detailed root cause analysis
- Implementation details for all 3 phases
- Performance benchmarks & testing checklist
- Developer mode logging guide
- Rollback strategies

**Files Modified:**
- `src/stores/useTreeStore.js` - Field detection & fast path logic
- `src/components/TreeView.js` - Prefetch optimization & debouncing
- `src/hooks/useDebounce.ts` - Reusable debounce hook
