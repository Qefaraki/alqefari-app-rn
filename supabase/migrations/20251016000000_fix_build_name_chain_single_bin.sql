-- Migration: Fix build_name_chain to add "بن" only once
-- Date: 2025-10-16
-- Issue: Name chains show "محمد بن عبدالله بن سليمان" instead of "محمد بن عبدالله سليمان"
-- Solution: Add has_bin flag to track if بن was added, only add it for first ancestor

CREATE OR REPLACE FUNCTION build_name_chain(p_profile_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_result TEXT;
BEGIN
  -- Validate input
  IF p_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Use recursive CTE to build name chain with single "بن" or "بنت"
  WITH RECURSIVE ancestry AS (
    -- Base case: start with the target person
    SELECT
      id,
      name,
      gender,
      father_id,
      1 as depth,
      name as chain,
      ARRAY[id] as id_path,  -- Track visited IDs for cycle detection
      FALSE as has_bin       -- Track if "بن/بنت" was added
    FROM profiles
    WHERE id = p_profile_id AND deleted_at IS NULL

    UNION ALL

    -- Recursive case: climb the family tree
    SELECT
      p.id,
      p.name,
      p.gender,
      p.father_id,
      a.depth + 1,
      -- Add "بن" (male) or "بنت" (female) for first ancestor, then just space
      CASE
        WHEN NOT a.has_bin THEN
          a.chain ||
          CASE
            WHEN a.gender = 'female' THEN ' بنت '
            ELSE ' بن '
          END ||
          p.name
        ELSE a.chain || ' ' || p.name
      END as chain,
      a.id_path || p.id,     -- Add current ID to path
      TRUE                    -- Mark that we've added "بن/بنت"
    FROM profiles p
    INNER JOIN ancestry a ON a.father_id = p.id
    WHERE
      a.depth < 10                          -- Max depth limit
      AND p.deleted_at IS NULL              -- Skip soft-deleted ancestors
      AND NOT (p.id = ANY(a.id_path))       -- Prevent circular references
  )
  SELECT chain || ' القفاري' INTO v_result
  FROM ancestry
  ORDER BY depth DESC
  LIMIT 1;

  -- Fallback if no ancestors found: just name + القفاري
  IF v_result IS NULL THEN
    SELECT name || ' القفاري' INTO v_result
    FROM profiles
    WHERE id = p_profile_id AND deleted_at IS NULL;
  END IF;

  RETURN COALESCE(v_result, 'غير معروف');
END;
$$ LANGUAGE plpgsql STABLE;

-- Update function documentation
COMMENT ON FUNCTION build_name_chain(UUID) IS
  'Builds full name chain using recursive CTE (single query, no N+1).
   Format: "الاسم بن/بنت الأب الجد القفاري" (بن for males, بنت for females, appears only once)
   Performance: O(log n) instead of O(n) queries.
   Features: Cycle detection, soft-delete handling, gender-aware bin/bint insertion.';

-- Backfill existing cached chains (optional - can be run separately if slow)
-- UPDATE profiles
-- SET full_chain = build_name_chain(id)
-- WHERE full_chain IS NOT NULL AND deleted_at IS NULL;
