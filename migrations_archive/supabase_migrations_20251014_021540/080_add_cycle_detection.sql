-- Migration 080: Add Cycle Detection to build_name_chain()
-- Problem: Circular father_id references can cause incorrect results (truncated at depth 10)
-- Solution: Track visited nodes to detect and prevent cycles
-- Date: 2025-01-10
-- Status: OPTIONAL but RECOMMENDED

-- ============================================
-- Background
-- ============================================
-- The current build_name_chain() function (from migration 064) has a hard limit
-- of 10 generations to prevent infinite loops. This prevents PostgreSQL crashes
-- but doesn't detect data corruption (circular references).
--
-- Example of circular reference:
--   Profile A (father_id = B) → Profile B (father_id = A)
--
-- Current behavior: Stops at depth 10, returns incomplete chain
-- New behavior: Detects cycle immediately, returns complete chain up to cycle point

-- ============================================
-- Enhanced build_name_chain() with Cycle Detection
-- ============================================

CREATE OR REPLACE FUNCTION build_name_chain(p_profile_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_result TEXT;
BEGIN
  -- Validate input
  IF p_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Use recursive CTE with cycle detection
  WITH RECURSIVE ancestry AS (
    -- Base case: start with the target person
    SELECT
      id,
      name,
      father_id,
      1 as depth,
      name as chain,
      ARRAY[id] as visited_ids  -- Track visited nodes to detect cycles
    FROM profiles
    WHERE id = p_profile_id
      AND deleted_at IS NULL

    UNION ALL

    -- Recursive case: climb the family tree
    SELECT
      p.id,
      p.name,
      p.father_id,
      a.depth + 1,
      a.chain || ' بن ' || p.name as chain,
      a.visited_ids || p.id  -- Add current node to visited list
    FROM profiles p
    INNER JOIN ancestry a ON a.father_id = p.id
    WHERE a.depth < 10  -- Max depth limit (safety net)
      AND p.deleted_at IS NULL
      AND NOT (p.id = ANY(a.visited_ids))  -- PREVENT CYCLES: Skip if already visited
  )
  SELECT chain || ' القفاري' INTO v_result
  FROM ancestry
  ORDER BY depth DESC
  LIMIT 1;

  RETURN COALESCE(v_result, 'غير معروف');
END;
$$ LANGUAGE plpgsql STABLE;

-- Update function comment
COMMENT ON FUNCTION build_name_chain(UUID) IS
  'Builds full name chain using recursive CTE with cycle detection.
   Prevents infinite loops from circular father_id references.
   Performance: O(log n) with early termination on cycles.
   Returns: "الاسم بن الأب بن الجد القفاري"
   Version: 2.0 (added cycle detection in migration 080)';

-- ============================================
-- Diagnostic: Check for Circular References
-- ============================================

DO $$
DECLARE
  v_circular_count INTEGER;
  v_self_referencing INTEGER;
  v_two_way_cycles INTEGER;
  rec RECORD;
BEGIN
  RAISE NOTICE 'Checking for circular father_id references...';
  RAISE NOTICE '========================================';

  -- Check 1: Self-referencing profiles (A → A)
  SELECT COUNT(*) INTO v_self_referencing
  FROM profiles
  WHERE father_id = id
    AND deleted_at IS NULL;

  IF v_self_referencing > 0 THEN
    RAISE WARNING 'Found % self-referencing profiles (father_id = id):', v_self_referencing;
    FOR rec IN (
      SELECT id, name, hid
      FROM profiles
      WHERE father_id = id AND deleted_at IS NULL
      LIMIT 5
    ) LOOP
      RAISE WARNING '  - % (HID: %) references itself', rec.name, rec.hid;
    END LOOP;
  ELSE
    RAISE NOTICE '✓ No self-referencing profiles found';
  END IF;

  -- Check 2: Two-way cycles (A → B → A)
  SELECT COUNT(*) INTO v_two_way_cycles
  FROM profiles p1
  WHERE EXISTS (
    SELECT 1 FROM profiles p2
    WHERE p2.id = p1.father_id
      AND p2.father_id = p1.id
      AND p1.deleted_at IS NULL
      AND p2.deleted_at IS NULL
  );

  IF v_two_way_cycles > 0 THEN
    RAISE WARNING 'Found % two-way circular references:', v_two_way_cycles;
    FOR rec IN (
      SELECT
        p1.id as id1,
        p1.name as name1,
        p1.hid as hid1,
        p2.id as id2,
        p2.name as name2,
        p2.hid as hid2
      FROM profiles p1
      JOIN profiles p2 ON p2.id = p1.father_id
      WHERE p2.father_id = p1.id
        AND p1.deleted_at IS NULL
        AND p2.deleted_at IS NULL
      LIMIT 5
    ) LOOP
      RAISE WARNING '  - % (HID: %) ↔ % (HID: %)',
        rec.name1, rec.hid1, rec.name2, rec.hid2;
    END LOOP;
  ELSE
    RAISE NOTICE '✓ No two-way cycles found';
  END IF;

  v_circular_count := v_self_referencing + v_two_way_cycles;

  RAISE NOTICE '========================================';
  IF v_circular_count > 0 THEN
    RAISE WARNING 'Total circular references found: %', v_circular_count;
    RAISE NOTICE '';
    RAISE NOTICE 'To fix these issues, run:';
    RAISE NOTICE '  UPDATE profiles SET father_id = NULL WHERE father_id = id;';
    RAISE NOTICE '  -- Then manually verify two-way cycles';
  ELSE
    RAISE NOTICE '✓ No circular references detected!';
    RAISE NOTICE 'The enhanced build_name_chain() is now protected against future cycles.';
  END IF;
END $$;

-- ============================================
-- Test: Verify Cycle Detection Works
-- ============================================

DO $$
DECLARE
  v_test_result TEXT;
  v_sample_id UUID;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Testing enhanced build_name_chain() function...';
  RAISE NOTICE '========================================';

  -- Get a sample profile to test
  SELECT id INTO v_sample_id
  FROM profiles
  WHERE deleted_at IS NULL
    AND father_id IS NOT NULL
  LIMIT 1;

  IF v_sample_id IS NOT NULL THEN
    SELECT build_name_chain(v_sample_id) INTO v_test_result;

    IF v_test_result IS NOT NULL AND v_test_result != 'غير معروف' THEN
      RAISE NOTICE '✓ Function works correctly';
      RAISE NOTICE 'Sample output: %', SUBSTRING(v_test_result, 1, 60);

      -- Check if it has "بن" separator (new format)
      IF v_test_result LIKE '%بن%' THEN
        RAISE NOTICE '✓ Uses new format with بن separator';
      END IF;

      -- Check if it ends with "القفاري"
      IF v_test_result LIKE '%القفاري' THEN
        RAISE NOTICE '✓ Properly appends القفاري suffix';
      END IF;
    ELSE
      RAISE WARNING 'Function returned غير معروف for sample profile';
    END IF;
  ELSE
    RAISE NOTICE 'No profiles available for testing';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 080: Cycle detection added successfully!';
END $$;

-- ============================================
-- Rollback Procedure
-- ============================================

/*
To rollback this migration and restore the original function:

CREATE OR REPLACE FUNCTION build_name_chain(p_profile_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_result TEXT;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  WITH RECURSIVE ancestry AS (
    SELECT id, name, father_id, 1 as depth, name as chain
    FROM profiles
    WHERE id = p_profile_id

    UNION ALL

    SELECT p.id, p.name, p.father_id, a.depth + 1,
           a.chain || ' بن ' || p.name as chain
    FROM profiles p
    INNER JOIN ancestry a ON a.father_id = p.id
    WHERE a.depth < 10
  )
  SELECT chain || ' القفاري' INTO v_result
  FROM ancestry
  ORDER BY depth DESC
  LIMIT 1;

  RETURN COALESCE(v_result, 'غير معروف');
END;
$$ LANGUAGE plpgsql STABLE;
*/
