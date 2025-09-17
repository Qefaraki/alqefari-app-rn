# get_branch_data Function - Critical Documentation

## ⚠️ WARNING: This is the most critical function in the entire system

The tree view depends entirely on this function. Breaking it breaks the entire app.

## What Happened (The Disaster of Sept 2025)

### Timeline of Events

1. **Original State**: Function worked perfectly, loaded 700+ profiles instantly
2. **Goal**: Add date fields (`dob_data`, `dod_data`) for calendar preference feature
3. **First Mistake**: Used `p.*` in recursive CTE → "ambiguous column" errors
4. **Second Mistake**: Added complex aggregations to "fix" it → timeouts
5. **Third Mistake**: Multiple attempts with increasingly complex queries → total breakdown
6. **Resolution**: Reverted to simple original logic with just date fields added

### Root Causes of the Failure

1. **Over-engineering**: Adding unnecessary complexity (COUNT OVER, aggregation CTEs)
2. **Not understanding the original**: The function was already optimized
3. **Ignoring performance**: Recursive CTEs with aggregations explode exponentially
4. **Breaking what works**: Trying to "improve" instead of minimal changes

## How get_branch_data Actually Works

### Core Purpose

Fetches a branch of the family tree starting from a given node (or root) with depth limiting to prevent loading entire database.

### Function Signature

```sql
get_branch_data(
    p_hid TEXT,           -- HID to start from (NULL = root nodes)
    p_max_depth INT,      -- How deep to traverse (default 3)
    p_limit INT           -- Max nodes to return (default 100)
)
RETURNS TABLE (
    -- 17 essential fields only - DO NOT ADD MORE
)
```

### Critical Behaviors

#### When p_hid IS NULL:

- Returns all generation = 1 profiles (root nodes)
- Excludes test profiles (HID starting with 'R' or name = 'Test Admin')
- This is how the app loads the initial tree

#### When p_hid = 'some_value':

- Returns that specific node and its descendants
- Traverses down p_max_depth levels
- Used when expanding branches or zooming into subtrees

### The Working Query Structure

```sql
WITH RECURSIVE branch AS (
    -- Base case: Simple SELECT with explicit columns
    SELECT
        p.id, p.hid, p.name, ...  -- EXPLICIT columns, never p.*
        0 as relative_depth
    FROM profiles p
    WHERE [conditions]

    UNION ALL

    -- Recursive: Simple JOIN on parent relationships
    SELECT
        p.id, p.hid, p.name, ...  -- SAME explicit columns
        b.relative_depth + 1
    FROM profiles p
    INNER JOIN branch b ON p.father_id = b.id OR p.mother_id = b.id
    WHERE p.deleted_at IS NULL
    AND b.relative_depth < p_max_depth - 1
)
SELECT [columns] FROM branch
ORDER BY generation, sibling_order
LIMIT p_limit;
```

## Performance Constraints

### With 700+ Profiles

- Function MUST return in < 1 second
- Recursive depth typically 3-5 levels max
- Each level can have 10-50 nodes

### What Makes It Slow (NEVER DO THESE)

1. **COUNT() OVER (PARTITION BY ...)** - Runs for EVERY row at EVERY level
2. **Aggregation CTEs** - Additional full table scans
3. **Complex JOINs in recursion** - Exponential growth
4. **Using p.\* with JOINs** - Causes ambiguous column errors

### What Keeps It Fast

1. **Simple recursive structure** - Just parent-child traversal
2. **Explicit column lists** - No ambiguity, clear what's selected
3. **Pre-calculated fields** - `descendants_count` stored in profiles table
4. **Filtered indexes** - `WHERE deleted_at IS NULL` indexes
5. **Early termination** - `relative_depth < p_max_depth - 1`

## Database Indexes Required

```sql
CREATE INDEX idx_profiles_generation ON profiles(generation) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_father_id ON profiles(father_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_mother_id ON profiles(mother_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_profiles_hid ON profiles(hid) WHERE deleted_at IS NULL;
```

## Fields That MUST Be Returned

The app expects exactly these fields in this order:

1. `id` - UUID
2. `hid` - TEXT (Hierarchical ID)
3. `name` - TEXT
4. `father_id` - UUID
5. `mother_id` - UUID
6. `generation` - INT
7. `sibling_order` - INT
8. `gender` - TEXT
9. `photo_url` - TEXT
10. `status` - TEXT
11. `current_residence` - TEXT
12. `occupation` - TEXT
13. `layout_position` - JSONB
14. `descendants_count` - INT (from profiles table, NOT calculated)
15. `has_more_descendants` - BOOLEAN
16. `dob_data` - JSONB (date of birth)
17. `dod_data` - JSONB (date of death)

## How descendants_count Works

- **Stored in profiles table** - Pre-calculated during profile updates
- **NOT calculated in query** - This would be extremely expensive
- **Updated via triggers** - When children are added/removed
- Just use `COALESCE(b.descendants_count, 0)::INT`

## The has_more_descendants Flag

Only checks if we're at max depth AND there are more children:

```sql
CASE
    WHEN b.relative_depth = p_max_depth - 1 THEN
        EXISTS(
            SELECT 1 FROM profiles c
            WHERE (c.father_id = b.id OR c.mother_id = b.id)
            AND c.deleted_at IS NULL
            LIMIT 1  -- Important: LIMIT 1 for performance
        )
    ELSE FALSE
END as has_more_descendants
```

## Testing the Function

### Basic Health Check

```sql
-- Should return root nodes quickly
SELECT COUNT(*) FROM get_branch_data(NULL, 3, 100);

-- Should return specific branch
SELECT COUNT(*) FROM get_branch_data('1', 3, 100);

-- Check performance
EXPLAIN ANALYZE SELECT * FROM get_branch_data(NULL, 3, 100);
```

### Expected Performance

- NULL query: < 100ms for ~10 root nodes
- Specific HID: < 500ms for ~100 nodes
- Deep recursion (depth 5): < 1 second

## Common Mistakes to Avoid

### ❌ NEVER: Add Complex Aggregations

```sql
-- BAD: This will timeout with large datasets
COUNT(c.id) OVER (PARTITION BY p.id) as child_count
```

### ❌ NEVER: Use p.\* with JOINs

```sql
-- BAD: Causes ambiguous column errors
SELECT p.*, 0 as relative_depth
FROM profiles p
LEFT JOIN profiles c ON ...
```

### ❌ NEVER: Calculate descendants_count in query

```sql
-- BAD: Extremely expensive
(SELECT COUNT(*) FROM profiles WHERE father_id = b.id) as descendants_count
```

### ❌ NEVER: Add unnecessary fields

The app only needs the 17 fields listed above. Adding more:

- Increases data transfer
- May cause type mismatches
- Slows down the query

## Correct Way to Modify

If you MUST modify this function:

1. **Backup first**: Save the current working version
2. **Minimal changes**: Only change what's absolutely necessary
3. **Test locally**: With full dataset, not just a few records
4. **Check performance**: Use EXPLAIN ANALYZE
5. **Verify all paths**: Test NULL, specific HID, deep recursion
6. **Keep it simple**: Resist the urge to "optimize" or add features

## Migration History

- **011_create_safe_access_functions.sql**: Original simple version
- **025_consistency_fixes.sql**: Added search_path security
- **033_fix_get_branch_data.sql**: Added NULL handling and dates (introduced complexity)
- **034_fix_ambiguous_columns.sql**: Attempted fix (made it worse)
- **035_emergency_fix_get_branch_data.sql**: Current working version

## Emergency Recovery

If the function breaks again:

1. **Check this working version** (as of Sept 2025):
   - Simple recursive CTE
   - Explicit column lists
   - No aggregations during recursion
   - Pre-calculated descendants_count

2. **Symptoms of a broken function**:
   - "ambiguous column" errors → Using p.\* with JOINs
   - Timeouts → Complex aggregations or missing indexes
   - Missing nodes → WHERE clause problems
   - Type errors → Return columns don't match declaration

3. **Quick fix template** in `/supabase/restore-simple-branch-data.sql`

## Remember

> "The best code is no code. The second best is simple code. Complex code is a liability."

This function has worked perfectly for months. It doesn't need "improvements". If you need additional data, fetch it separately rather than complicating this critical path.

**When in doubt, keep it simple.**
