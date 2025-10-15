-- Migration: Backfill Missing HIDs for Existing Profiles
-- Date: 2025-10-15
-- Purpose: Fix 14 children created via batch save without HID (Bug #13 data cleanup)
--
-- Background:
-- - Children created before Bug #13 fix don't have HID values
-- - These children are invisible on tree (get_branch_data filters hid IS NOT NULL)
-- - Need to retroactively assign HIDs based on parent lineage
--
-- Logic:
-- 1. Find children without HID who have at least one parent
-- 2. Determine which parent has HID (father priority, then mother)
-- 3. Generate child HID using generate_next_hid(parent_hid)
-- 4. Update child's HID field
--
-- Edge Cases:
-- - Both parents are Munasib (hid IS NULL) → child stays NULL (by design)
-- - Parent has no HID → skip (shouldn't happen, but safety check)

DO $$
DECLARE
  v_child_record RECORD;
  v_parent_hid TEXT;
  v_new_hid TEXT;
  v_updated_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting HID backfill migration...';

  -- Find all children without HID who have at least one parent
  FOR v_child_record IN
    SELECT
      c.id,
      c.name,
      c.gender,
      c.father_id,
      c.mother_id,
      f.hid AS father_hid,
      m.hid AS mother_hid
    FROM profiles c
    LEFT JOIN profiles f ON c.father_id = f.id
    LEFT JOIN profiles m ON c.mother_id = m.id
    WHERE c.hid IS NULL
      AND c.deleted_at IS NULL
      AND (c.father_id IS NOT NULL OR c.mother_id IS NOT NULL)
    ORDER BY c.created_at
  LOOP
    -- Determine which parent has HID (father priority)
    IF v_child_record.father_hid IS NOT NULL THEN
      v_parent_hid := v_child_record.father_hid;
    ELSIF v_child_record.mother_hid IS NOT NULL THEN
      v_parent_hid := v_child_record.mother_hid;
    ELSE
      -- Both parents are Munasib (no HID) - child should stay NULL
      RAISE NOTICE 'Skipped profile % (%) - both parents are Munasib',
        v_child_record.name, v_child_record.id;
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Generate new HID from parent
    v_new_hid := generate_next_hid(v_parent_hid);

    -- Update child's HID
    UPDATE profiles
    SET hid = v_new_hid,
        updated_at = NOW()
    WHERE id = v_child_record.id;

    RAISE NOTICE 'Updated profile % (%): HID = %',
      v_child_record.name, v_child_record.id, v_new_hid;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'HID backfill migration completed';
  RAISE NOTICE 'Updated: % profiles', v_updated_count;
  RAISE NOTICE 'Skipped: % profiles (Munasib children)', v_skipped_count;
  RAISE NOTICE '===========================================';

  -- Verify: Check if any males still have NULL HID (excluding Munasib)
  DECLARE
    v_remaining_males INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_remaining_males
    FROM profiles c
    LEFT JOIN profiles f ON c.father_id = f.id
    LEFT JOIN profiles m ON c.mother_id = m.id
    WHERE c.hid IS NULL
      AND c.deleted_at IS NULL
      AND c.gender = 'male'
      AND (f.hid IS NOT NULL OR m.hid IS NOT NULL);

    IF v_remaining_males > 0 THEN
      RAISE WARNING 'VERIFICATION FAILED: % male profiles still have NULL HID', v_remaining_males;
    ELSE
      RAISE NOTICE 'VERIFICATION PASSED: All eligible males have HID';
    END IF;
  END;
END $$;
