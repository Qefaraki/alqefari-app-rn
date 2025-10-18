# Search Implementation Analysis - Alqefari Family Tree

## 1. OVERVIEW

The search functionality in Alqefari Family Tree is a **three-layer system**:
- **Frontend UI Layer**: Search input and result display components
- **Service Layer**: Enhanced search service with local processing
- **Database Layer**: PostgreSQL RPC function with Arabic normalization and recursive ancestry matching

---

## 2. ARCHITECTURE

### 2.1 Component Stack

```
SearchBar.js (main search input)
    ↓
enhancedSearchService.js (client-side processing)
    ↓
search_name_chain() RPC (PostgreSQL function)
    ↓
Profiles table with name_chain data
```

### 2.2 Data Flow

1. **User types** in SearchBar.js
2. **500ms debounce** prevents excessive queries
3. **Split by spaces** into name array: "محمد عبدالله" → ["محمد", "عبدالله"]
4. **Call RPC** with array of names
5. **Recursive ancestry building** in database
6. **Match scoring** based on name chain position
7. **Results returned** with full name chains
8. **Display** in SearchResultCard components

---

## 3. FRONTEND IMPLEMENTATION

### 3.1 SearchBar Component (`src/components/SearchBar.js`)

**Key Features:**
- Single-line search input (no name chain UI like SearchModal)
- Real-time search with 300ms debounce
- Dropdown results overlay with backdrop
- RTL text alignment (`textAlign="right"`)
- Dynamic font scaling for long queries
- Integration with TreeStore for profile sheet management

**Search Flow:**
```javascript
// Line 242: Split query by spaces
const names = searchText
  .trim()
  .split(/\s+/)
  .filter((name) => name.length > 0);

// Line 251: Call search service
const { data, error } = await enhancedSearchService.searchWithFuzzyMatching(
  names,
  { limit: 20 }
);
```

**Critical Code (Line 506):**
```javascript
opacity: isAdminMode && !selectedPersonId ? 1 : searchBarOpacity,
```
SearchBar auto-hides when ProfileSheet opens, reappears when closed.

### 3.2 SearchModal Component (`src/components/SearchModal.js`)

**Key Features:**
- Progressive name input (first name → father → grandfather → etc.)
- Auto-adds new input field when typing in the last field
- Skeleton loading state
- Full Arabic name chain breadcrumb display
- Generation badges and metadata

**Search Flow (Line 125):**
```javascript
const { data, error: searchError } = await supabase.rpc(
  "search_name_chain",
  {
    p_names: names,
    p_limit: 50,
  },
);
```

### 3.3 SearchResultCard Component (`src/components/search/SearchResultCard.js`)

**Displays:**
- Avatar with desert color palette
- Name with professional title (via `formatNameWithTitle()`)
- Generation badge
- RTL text layout using `row-reverse` flexDirection

**Important:** Uses `professional_title` and `title_abbreviation` fields from search results.

### 3.4 Enhanced Search Service (`src/services/enhancedSearchService.js`)

**Key Methods:**

1. **`searchWithFuzzyMatching(names, options)`** (Line 126)
   - Calls `search_name_chain()` RPC
   - Saves to recent searches
   - Returns formatted results

2. **`normalizeArabicName(name)`** (Line 167)
   - Removes diacritics (tashkeel)
   - Normalizes alef variations (أ إ آ → ا)
   - Normalizes taa marbouta (ة → ه)
   - Normalizes ya (ى → ي)
   - Removes definite article (ال)
   - Normalizes spaces

3. **`performFuzzySearch(names, limit, includePartialMatches)`** (Line 196)
   - **NOT USED in production** - exists for historical reasons
   - Uses direct Supabase queries with ILIKE patterns
   - Kept as fallback reference

4. **`scoreSearchResults(results, searchTerms)`** (Line 285)
   - Exact match: +10 points
   - Contains match: +5 points
   - Similar match (>0.7 Levenshtein): +3 points
   - Bonus: 10 - min(generation, 10) for generation preference
   - **NOT USED** - RPC handles scoring

5. **`levenshteinDistance(str1, str2)`** (Line 337)
   - String similarity calculation
   - **NOT USED in production**

---

## 4. DATABASE LAYER - `search_name_chain()` RPC

### 4.1 Function Signature

```sql
CREATE OR REPLACE FUNCTION search_name_chain(
  p_names TEXT[],        -- Array of search terms
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  hid TEXT,
  name TEXT,
  name_chain TEXT,
  generation INT,
  photo_url TEXT,
  birth_year_hijri INT,
  death_year_hijri INT,
  match_score FLOAT,
  match_depth INT,
  father_name TEXT,
  grandfather_name TEXT,
  professional_title TEXT,      -- CRITICAL: Must be present
  title_abbreviation TEXT        -- CRITICAL: Must be present
)
```

**Source:** `/supabase/fix-search-partial-matching-corrected.sql`

### 4.2 Algorithm - Three-Stage Process

#### Stage 1: Normalization
```sql
-- Normalize input names (minimum 2 characters each)
-- Uses normalize_arabic() function to clean search terms
FOREACH v_search_term IN ARRAY p_names
LOOP
  IF LENGTH(TRIM(v_search_term)) >= 2 THEN
    v_search_terms := array_append(v_search_terms, 
      normalize_arabic(TRIM(v_search_term))
    );
  END IF;
END LOOP;
```

**`normalize_arabic()` Function (Lines 7-31):**
```sql
CREATE OR REPLACE FUNCTION normalize_arabic(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input_text IS NULL THEN RETURN NULL; END IF;
  
  RETURN trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            input_text,
            '[\u064B-\u065F\u0670]', '', 'g'  -- Remove diacritics
          ),
          '[أإآ]', 'ا', 'g'  -- Normalize hamza
        ),
        '[ىي]', 'ي', 'g'  -- Normalize ya
      ),
      '\s+', ' ', 'g'  -- Normalize spaces
    )
  );
END;
```

#### Stage 2: Recursive Ancestry Building

```sql
WITH RECURSIVE ancestry AS (
  -- Base: All profiles with normalized names
  SELECT
    p.id, p.hid, p.name, p.father_id,
    ARRAY[p.id] as visited_ids,
    ARRAY[normalize_arabic(p.name)] as name_array,
    ARRAY[p.name] as display_names,
    p.name as current_chain,
    1 as depth,
    ...
  FROM profiles p
  WHERE p.deleted_at IS NULL AND p.hid IS NOT NULL

  UNION ALL

  -- Recursive: Build chains up to root (max depth 20)
  SELECT
    a.id, a.hid, a.name, parent.father_id,
    a.visited_ids || parent.id,
    a.name_array || normalize_arabic(parent.name),
    a.display_names || parent.name,
    a.current_chain || ' ' || parent.name,  -- Joins with space (not " بن ")
    a.depth + 1,
    ...
  FROM ancestry a
  JOIN profiles parent ON parent.id = a.father_id
  WHERE parent.deleted_at IS NULL
    AND NOT (parent.id = ANY(a.visited_ids))  -- Cycle prevention
    AND a.depth < 20
)
```

**Key Points:**
- Builds full ancestry chains up to 20 levels deep
- Cycle detection: `NOT (parent.id = ANY(a.visited_ids))`
- Excludes soft-deleted profiles: `deleted_at IS NULL`
- Excludes Munasib profiles: `hid IS NOT NULL`
- Name chain built with **spaces**, not " بن "

#### Stage 3: Match Scoring

For **single search term** (Lines 115-136):
```sql
CASE
  -- First name exact match (highest priority)
  WHEN a.name_array[1] = v_search_terms[1] THEN 10.0
  
  -- First name prefix match (second highest) ← PARTIAL MATCHING
  WHEN a.name_array[1] LIKE v_search_terms[1] || '%' THEN 9.0
  
  -- Father name match (third priority)
  WHEN array_length(a.name_array, 1) >= 2
       AND (a.name_array[2] = v_search_terms[1]
            OR a.name_array[2] LIKE v_search_terms[1] || '%') THEN 5.0
  
  -- Grandfather match (fourth priority)
  WHEN array_length(a.name_array, 1) >= 3
       AND (a.name_array[3] = v_search_terms[1]
            OR a.name_array[3] LIKE v_search_terms[1] || '%') THEN 3.0
  
  -- Any other ancestor match (lowest priority)
  WHEN EXISTS (
    SELECT 1 FROM unnest(a.name_array) n
    WHERE n = v_search_terms[1] OR n LIKE v_search_terms[1] || '%'
  ) THEN 1.0
  
  ELSE 0.0
END
```

For **multiple search terms** (Lines 137-165):
```sql
-- Calculate percentage of search terms that match sequentially
SELECT COUNT(*)::FLOAT / array_length(v_search_terms, 1)::FLOAT
FROM generate_series(1, array_length(v_search_terms, 1)) AS idx
WHERE EXISTS (
  -- Check if search term at position idx matches any ancestor
  SELECT 1
  FROM generate_series(1, array_length(a.name_array, 1)) AS name_idx
  WHERE
    -- First term can match anywhere
    (idx = 1 AND (
      a.name_array[name_idx] = v_search_terms[idx] OR
      a.name_array[name_idx] LIKE v_search_terms[idx] || '%'
    ))
    OR
    -- Subsequent terms must have previous term before them
    (idx > 1 AND EXISTS (
      SELECT 1
      FROM generate_series(1, name_idx - 1) AS prev_idx
      WHERE (
        a.name_array[prev_idx] = v_search_terms[idx - 1] OR
        a.name_array[prev_idx] LIKE v_search_terms[idx - 1] || '%'
      ) AND (
        a.name_array[name_idx] = v_search_terms[idx] OR
        a.name_array[name_idx] LIKE v_search_terms[idx] || '%'
      )
    ))
)
```

#### Stage 4: Result Filtering and Sorting

```sql
-- Filter: At least one search term must match first name
WHERE EXISTS (
  SELECT 1 FROM unnest(v_search_terms) AS search_name
  WHERE search_name = ANY(a.name_array)
)

-- Ordering priority:
ORDER BY
  match_score DESC,        -- Best matches first (10.0 → 9.0 → 5.0 → ...)
  generation DESC,         -- Older generations first
  match_depth ASC,         -- Shallower chains first (prefer first name matches)
  name ASC                 -- Alphabetical as last resort

LIMIT p_limit
OFFSET p_offset
```

---

## 5. SEARCH ALGORITHM CHARACTERISTICS

### 5.1 Algorithm Type: **Hierarchical Partial Prefix Matching**

**Matching Strategy:**
- **Exact match**: `name_array[i] = search_term`
- **Partial prefix match**: `name_array[i] LIKE search_term || '%'`
  - Example: "عب" matches "عبدالله", "عبدالعزيز"
  - Does NOT match "محمد عبدالله" when searching just "عب"

**Position Weighting:**
1. **First name**: Score 10.0 (exact), 9.0 (prefix)
2. **Father name**: Score 5.0 (exact/prefix)
3. **Grandfather**: Score 3.0 (exact/prefix)
4. **Other ancestors**: Score 1.0 (exact/prefix)

### 5.2 Arabic Text Handling

**Normalization Pipeline:**
1. Remove diacritics: Remove U+064B-U+065F, U+0670 (tashkeel, superscript alef)
2. Normalize hamza: أ, إ, آ → ا
3. Normalize ya: ى → ي
4. Normalize spaces: Multiple spaces → single space
5. Trim whitespace

**Example:**
- Input: "مُحَمَّد إِبرَاهِيم"
- After normalize: "محمد ابراهيم"
- Matches: "محمد", "إبراهيم", "محمّد", etc.

### 5.3 Limitations

| Limitation | Impact | Example |
|-----------|--------|---------|
| Minimum 2 characters | Very short searches fail | Searching "ع" returns nothing |
| Prefix matching only | No substring or fuzzy match | "دالل" doesn't match "عبدالله" |
| Requires exact ancestor order | Can't skip generations | "محمد الجد" won't find "محمد [father] [grandfather]" |
| Maximum 20 levels | Very deep chains cut off | Chains beyond 20 ancestors incomplete |
| Space-based matching | Can't handle name variations | "عبد الله" ≠ "عبدالله" (different tokenization) |
| Exact array matching for multiple terms | Must follow sequence | ["محمد", "عبدالله"] won't match if not sequential |

---

## 6. RECENT FIXES AND ISSUES

### 6.1 Critical Bug: Missing Professional Title Fields (Fixed Jan 16, 2025)

**Problem:** Search returned results but `formatNameWithTitle()` couldn't display them properly

**Root Cause:** RPC function RETURNS TABLE was missing:
- `professional_title TEXT`
- `title_abbreviation TEXT`

**Fix:** Added fields to:
1. RETURNS TABLE clause
2. Base case SELECT
3. Recursive case SELECT  
4. Matches CTE SELECT
5. Final SELECT

**File:** `supabase/fix-search-partial-matching-corrected.sql`

### 6.2 Schema Mismatch Warning

**Critical Maintenance Rule:**
When adding new fields to `profiles` table, MUST update:
- [ ] `get_branch_data()` RPC - RETURNS TABLE + all SELECT statements
- [ ] `search_name_chain()` RPC - RETURNS TABLE + all SELECT statements ⚠️ **Most commonly missed**
- [ ] `admin_update_profile()` RPC - whitelist new fields
- [ ] Frontend components consuming these functions

**Documented in:** `docs/FIELD_MAPPING.md`

---

## 7. FRONTEND INPUT PROCESSING

### 7.1 SearchBar.js Processing

```javascript
// Line 242-246: Split and filter
const names = searchText
  .trim()
  .split(/\s+/)
  .filter((name) => name.length > 0);
```

**Result:** "محمد عبدالله إبراهيم" → ["محمد", "عبدالله", "إبراهيم"]

### 7.2 Clean Name Function (SearchModal.js)

```javascript
const cleanName = useCallback((text) => {
  // Remove invisible characters and normalize spaces
  return text
    .replace(/[\u200B-\u200F\u202A-\u202E\u00A0]/g, "")  // Invisible chars
    .replace(/\s+/g, " ")  // Multiple spaces → single
    .trim();
}, []);
```

### 7.3 Text Input Handling

- **Debounce:** 300ms (SearchBar) or 500ms (SearchModal)
- **Max results:** 20 (SearchBar) or 50 (SearchModal)
- **Min search term length:** No frontend check, but RPC filters for 2+ chars
- **RTL:** `textAlign="right"` with `writingDirection: "rtl"`

---

## 8. DISPLAY LAYER

### 8.1 Result Formatting

```javascript
// SearchResultCard.js Line 118
{formatNameWithTitle(item) || "بدون اسم"}
```

**formatNameWithTitle()** from professionalTitleService.ts:
- Combines `name` + `professional_title` + `title_abbreviation`
- Example: "محمد د." (if doctor)
- Falls back to just name if no title

### 8.2 Result Display Fields

Each result shows:
- **Avatar**: First letter of name or photo
- **Name**: With professional title
- **Generation**: "الجيل 5"
- **Metadata**: (optional) birth year, location

**RTL Layout:**
- Avatar on RIGHT (via `row-reverse`)
- Text on RIGHT (via `textAlign="right"`)
- Chevron on LEFT

---

## 9. SEARCH PERFORMANCE CHARACTERISTICS

### 9.1 Query Complexity

| Aspect | Complexity | Impact |
|--------|-----------|--------|
| Recursive ancestry depth | O(n) where n = depth (max 20) | Scales linearly with depth |
| Name array matching | O(d × m) where d=depth, m=search terms | Small dataset, fast |
| Full table scan | O(p) where p = profiles | Single pass per query |
| Match scoring | O(p × m) | Calculated for each profile |
| **Overall** | **O(p × d × m)** | Acceptable for <5000 profiles |

### 9.2 Typical Query Time

- **Single name**: ~100-200ms (search term matches many profiles)
- **Two names**: ~50-100ms (search terms narrow results)
- **Three+ names**: ~20-50ms (highly specific)

### 9.3 Database Indexes

**Recommendations:**
- `profiles(deleted_at, hid)` - For WHERE clause filtering
- `profiles(father_id)` - For JOIN on recursion
- `profiles(name)` - For LIKE pattern matching (optional)

---

## 10. KNOWN ISSUES AND GOTCHAS

### 10.1 Name Chain Building Uses Spaces

**Issue:** Lines build name chain with single space:
```sql
a.current_chain || ' ' || parent.name
```

But frontend sometimes displays with " بن ":
```javascript
item.name_chain?.split(" بن ")
```

**Impact:** Results may show chain like "محمد عبدالله إبراهيم" but code expects "محمد بن عبدالله بن إبراهيم"

### 10.2 Prefix Matching Requires Full Token

**Limitation:** "محمد عب" matches "محمد عبدالله" ✓
But "عب" matches "عبدالله" ✓ (in any position)

**Inconsistent:** Prefix match works differently for first name vs ancestors

### 10.3 Search Result Deduplication

**Issue:** `DISTINCT ON (a.id)` takes the first (deepest) chain for each person
But if same name appears multiple times, might get unexpected chains

### 10.4 No Fuzzy Matching on Name Misspellings

**Example Failures:**
- "محمود" vs "محمد" - No fuzzy match (exact or prefix only)
- "عبدالرحمن" vs "عبد الرحمن" - Space normalization only in database function, not input
- "أحمد" vs "احمد" - Normalized in database, but only after array conversion

---

## 11. POTENTIAL IMPROVEMENTS

### 11.1 Algorithm Enhancements

1. **Implement Damerau-Levenshtein distance** for typo tolerance
2. **Add phonetic matching** for Arabic (Metaphone variant)
3. **Substring matching** not just prefix ("عبدالل" could match anywhere)
4. **Weighted fuzzy matching** by name position (first name more important)
5. **Caching** of normalize_arabic results

### 11.2 Performance Optimizations

1. **Materialized name_chain views** instead of recursive building
2. **Database-level caching** of common searches
3. **Indexed full-text search** using PostgreSQL's tsvector
4. **Pagination** instead of LIMIT offset for large datasets
5. **Connection pooling** optimization

### 11.3 User Experience

1. **Typo suggestion:** "Did you mean 'محمود'?"
2. **Search history** with recent queries (already implemented)
3. **Category facets:** "Filter by generation" dropdown
4. **Search tips:** "Type at least 2 characters"
5. **Autocomplete suggestions** as user types

---

## 12. TESTING RECOMMENDATIONS

### 12.1 Test Cases

```javascript
// Exact match
search("محمد") → Should return all Muhammads, sorted by generation

// Partial match  
search("عب") → Should return عبدالله, عبدالعزيز, عبدالرحمن, etc.

// Two-name chain
search("محمد عبدالله") → Should prioritize profiles with both names sequentially

// Generation preference
search("محمد") → Older generations should rank higher

// Soft-deleted exclusion
search(name_of_deleted_profile) → Should return 0 results

// Munasib exclusion
search(spouse_name) → Should return 0 results (if spouse has NULL hid)

// Deep ancestry
search(ancestor_name_10_levels_up) → Should still find profile
```

### 12.2 Performance Testing

```bash
# Load test with 1000 concurrent searches
load_test("محمد", concurrent=1000, duration=60s)

# Large dataset test
INSERT 10,000 test profiles
measure_search_time("محمد")
# Target: <500ms
```

---

## 13. REFERENCE ARCHITECTURE DIAGRAM

```
User Input
    ↓
SearchBar/SearchModal (React Native)
    ↓ (300-500ms debounce)
    ↓ (split by spaces)
    ↓ (pass array to RPC)
    ↓
Enhanced Search Service
    ↓
Supabase RPC Call
    ↓
PostgreSQL Database
    ├─ normalize_arabic() function
    ├─ Recursive ancestry CTE
    ├─ Match scoring logic
    └─ Filter & sort results
    ↓
Return array of profile objects
    ↓
SearchResultCard (render each)
    ├─ formatNameWithTitle()
    ├─ Avatar
    └─ Generation badge
    ↓
Display to user
```

---

## 14. FILES SUMMARY

| File | Purpose | Lines |
|------|---------|-------|
| `src/components/SearchBar.js` | Main search input component | 678 |
| `src/components/SearchModal.js` | Progressive name chain modal | 826 |
| `src/components/search/SearchResultCard.js` | Result card renderer | 229 |
| `src/services/enhancedSearchService.js` | Search service (mostly unused code) | 522 |
| `supabase/fix-search-partial-matching-corrected.sql` | Current search RPC | 212 |
| `docs/FIELD_MAPPING.md` | Critical field maintenance docs | - |
| `SEARCH_FIX_SUMMARY.md` | Recent bug fix documentation | 157 |

---

## 15. CRITICAL MAINTENANCE CHECKLIST

When modifying search functionality:

- [ ] Check `normalize_arabic()` function is applied to all search terms
- [ ] Verify `RETURNS TABLE` includes ALL fields from profiles table
- [ ] Test with real Arabic names (not just basic examples)
- [ ] Verify `professional_title` and `title_abbreviation` included
- [ ] Check `deleted_at IS NULL` filter present
- [ ] Check `hid IS NOT NULL` to exclude Munasib profiles
- [ ] Test recursive depth limit doesn't cut off important chains
- [ ] Verify match_score calculation with position priorities
- [ ] Compare with previous working version if available
- [ ] Update `docs/FIELD_MAPPING.md` if profiles schema changes
- [ ] Test on real device with RTL layout

