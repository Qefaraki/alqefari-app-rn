-- Migration 078: Simplify Marriage Status Values
-- Purpose: Replace stigmatizing terms with neutral language
-- Changes: 'married'/'divorced'/'widowed' → 'current'/'past'

BEGIN;

-- Step 1: Update existing status values
UPDATE marriages
SET status = 'current'
WHERE status = 'married';

UPDATE marriages
SET status = 'past'
WHERE status IN ('divorced', 'widowed');

-- Step 2: Drop old constraint
ALTER TABLE marriages DROP CONSTRAINT IF EXISTS marriages_status_check;

-- Step 3: Add new constraint with simplified values
ALTER TABLE marriages
ADD CONSTRAINT marriages_status_check
CHECK (status IN ('current', 'past'));

-- Step 4: Update default value for new records
ALTER TABLE marriages
ALTER COLUMN status SET DEFAULT 'current';

-- Step 5: Add comment explaining the change
COMMENT ON COLUMN marriages.status IS
  'Marriage status: current (active marriage) or past (ended marriage).
   Replaces old values: married→current, divorced/widowed→past.
   Uses neutral language to avoid cultural stigma.';

-- Step 6: Validation
DO $$
DECLARE
  v_old_statuses_count INT;
  v_current_count INT;
  v_past_count INT;
BEGIN
  -- Check no old status values remain
  SELECT COUNT(*) INTO v_old_statuses_count
  FROM marriages
  WHERE status IN ('married', 'divorced', 'widowed');

  IF v_old_statuses_count > 0 THEN
    RAISE EXCEPTION 'Migration 078 failed: % old status values still exist', v_old_statuses_count;
  END IF;

  -- Count new status values
  SELECT COUNT(*) INTO v_current_count FROM marriages WHERE status = 'current';
  SELECT COUNT(*) INTO v_past_count FROM marriages WHERE status = 'past';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 078: Marriage Status Simplified';
  RAISE NOTICE '========================================';
  RAISE NOTICE '  ✓ Updated constraint: current/past only';
  RAISE NOTICE '  ✓ Current marriages: %', v_current_count;
  RAISE NOTICE '  ✓ Past marriages: %', v_past_count;
  RAISE NOTICE '  ✓ Removed stigmatizing terms';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
