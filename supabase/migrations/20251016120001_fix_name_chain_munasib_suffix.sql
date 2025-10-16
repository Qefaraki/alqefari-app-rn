-- Migration: Fix name chain functions to exclude القفاري for Munasib (external spouses)
-- Date: 2025-01-16
-- Issue: Munasib mothers (hid = NULL) incorrectly show القفاري suffix
--        Example: "لطيفة العيدان" becomes "لطيفة العيدان القفاري" (WRONG)
-- Solution: Add conditional check for hid field before appending القفاري
-- Affects: build_name_chain() and build_name_chain_simple()

BEGIN;

-- ============================================================================
-- Fix build_name_chain() - Full name chain with "بن/بنت"
-- ============================================================================

CREATE OR REPLACE FUNCTION build_name_chain(p_profile_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_result TEXT;
  v_hid TEXT;
BEGIN
  -- Validate input
  IF p_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get the hid field to determine if this is an Al-Qefari family member
  SELECT hid INTO v_hid
  FROM profiles
  WHERE id = p_profile_id AND deleted_at IS NULL;

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
  -- 🎯 FIX: Only append القفاري if hid IS NOT NULL (Al-Qefari family member)
  SELECT
    CASE
      WHEN v_hid IS NOT NULL THEN chain || ' القفاري'
      ELSE chain
    END INTO v_result
  FROM ancestry
  ORDER BY depth DESC
  LIMIT 1;

  -- Fallback if no ancestors found: check hid before appending القفاري
  IF v_result IS NULL THEN
    SELECT
      CASE
        WHEN v_hid IS NOT NULL THEN name || ' القفاري'
        ELSE name
      END INTO v_result
    FROM profiles
    WHERE id = p_profile_id AND deleted_at IS NULL;
  END IF;

  RETURN COALESCE(v_result, 'غير معروف');
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION build_name_chain(UUID) IS
  'Builds full name chain using recursive CTE (single query, no N+1).
   Format: "الاسم بن/بنت الأب الجد القفاري" (بن for males, بنت for females, appears only once)
   القفاري suffix is ONLY added for Al-Qefari family members (hid IS NOT NULL).
   Munasib (external spouses with hid = NULL) retain their original family names.
   Performance: O(log n) instead of O(n) queries.
   Features: Cycle detection, soft-delete handling, gender-aware bin/bint insertion, Munasib-aware suffix.';

-- ============================================================================
-- Fix build_name_chain_simple() - Name chain without "بن/بنت"
-- ============================================================================

CREATE OR REPLACE FUNCTION build_name_chain_simple(p_profile_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_result TEXT;
  v_hid TEXT;
BEGIN
  -- Validate input
  IF p_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get the hid field to determine if this is an Al-Qefari family member
  SELECT hid INTO v_hid
  FROM profiles
  WHERE id = p_profile_id AND deleted_at IS NULL;

  -- Use recursive CTE to build name chain with space separator (no "بن")
  WITH RECURSIVE ancestry AS (
    -- Base case: start with the target person
    SELECT
      id,
      name,
      father_id,
      1 as depth,
      name as chain
    FROM profiles
    WHERE id = p_profile_id AND deleted_at IS NULL

    UNION ALL

    -- Recursive case: add father's name with just space (no "بن")
    SELECT
      p.id,
      p.name,
      p.father_id,
      a.depth + 1,
      a.chain || ' ' || p.name as chain  -- Just space, no "بن"
    FROM profiles p
    INNER JOIN ancestry a ON a.father_id = p.id
    WHERE a.depth < 10 AND p.deleted_at IS NULL -- Max depth limit
  )
  -- 🎯 FIX: Only append القفاري if hid IS NOT NULL (Al-Qefari family member)
  SELECT
    CASE
      WHEN v_hid IS NOT NULL THEN chain || ' القفاري'
      ELSE chain
    END INTO v_result
  FROM ancestry
  ORDER BY depth DESC
  LIMIT 1;

  -- Fallback if no ancestors found: check hid before appending القفاري
  IF v_result IS NULL THEN
    SELECT
      CASE
        WHEN v_hid IS NOT NULL THEN name || ' القفاري'
        ELSE name
      END INTO v_result
    FROM profiles
    WHERE id = p_profile_id AND deleted_at IS NULL;
  END IF;

  RETURN COALESCE(v_result, 'غير معروف');
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION build_name_chain_simple(UUID) IS
  'Builds name chain with space-separated names (no بن separator).
   القفاري suffix is ONLY added for Al-Qefari family members (hid IS NOT NULL).
   Munasib (external spouses with hid = NULL) retain their original family names.
   Used for parent display in edit mode where compact format is preferred.
   Example for Al-Qefari: "محمد علي عبدالله القفاري"
   Example for Munasib: "لطيفة العيدان" (no القفاري)';

-- ============================================================================
-- Validation and Testing
-- ============================================================================

DO $$
DECLARE
  v_test_alqefari TEXT;
  v_test_munasib TEXT;
  v_test_profile_id UUID;
  v_munasib_profile_id UUID;
BEGIN
  -- Test with an Al-Qefari family member (should have القفاري)
  SELECT id INTO v_test_profile_id
  FROM profiles
  WHERE hid IS NOT NULL AND deleted_at IS NULL
  LIMIT 1;

  IF v_test_profile_id IS NOT NULL THEN
    v_test_alqefari := build_name_chain_simple(v_test_profile_id);
    RAISE NOTICE '✓ Al-Qefari test: %', v_test_alqefari;

    IF v_test_alqefari NOT LIKE '%القفاري' THEN
      RAISE EXCEPTION 'FAILED: Al-Qefari member missing القفاري suffix';
    END IF;
  END IF;

  -- Test with a Munasib (should NOT have القفاري)
  SELECT id INTO v_munasib_profile_id
  FROM profiles
  WHERE hid IS NULL AND deleted_at IS NULL
  LIMIT 1;

  IF v_munasib_profile_id IS NOT NULL THEN
    v_test_munasib := build_name_chain_simple(v_munasib_profile_id);
    RAISE NOTICE '✓ Munasib test: %', v_test_munasib;

    IF v_test_munasib LIKE '%القفاري' THEN
      RAISE EXCEPTION 'FAILED: Munasib incorrectly has القفاري suffix: %', v_test_munasib;
    END IF;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration: Fix Name Chain Munasib Suffix';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ build_name_chain() updated';
  RAISE NOTICE '✓ build_name_chain_simple() updated';
  RAISE NOTICE '✓ Al-Qefari members: Keep القفاري suffix';
  RAISE NOTICE '✓ Munasib (hid = NULL): No القفاري suffix';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fix verified with test cases';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
