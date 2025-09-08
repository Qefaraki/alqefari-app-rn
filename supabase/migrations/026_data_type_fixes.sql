-- 026_data_type_fixes.sql
-- Convert marriages date columns from TEXT to DATE safely

-- ============================================================================
-- 1. Validate existing date data
-- ============================================================================
DO $$
DECLARE
    v_invalid_start_count INT;
    v_invalid_end_count INT;
    v_total_rows INT;
BEGIN
    -- Count total marriages
    SELECT COUNT(*) INTO v_total_rows FROM marriages;
    
    -- Count invalid start dates
    SELECT COUNT(*) INTO v_invalid_start_count
    FROM marriages
    WHERE start_date IS NOT NULL 
      AND start_date != '' 
      AND NOT (start_date ~ '^\d{4}-\d{2}-\d{2}$');
    
    -- Count invalid end dates
    SELECT COUNT(*) INTO v_invalid_end_count
    FROM marriages
    WHERE end_date IS NOT NULL 
      AND end_date != '' 
      AND NOT (end_date ~ '^\d{4}-\d{2}-\d{2}$');
    
    -- Report findings
    IF v_total_rows > 0 THEN
        RAISE NOTICE 'Marriage date validation:';
        RAISE NOTICE '  Total marriages: %', v_total_rows;
        RAISE NOTICE '  Invalid start_date values: %', v_invalid_start_count;
        RAISE NOTICE '  Invalid end_date values: %', v_invalid_end_count;
        
        -- Only proceed if all dates are valid or null/empty
        IF v_invalid_start_count > 0 OR v_invalid_end_count > 0 THEN
            RAISE WARNING 'Found invalid date formats. These will be set to NULL during conversion.';
            
            -- Log invalid dates for review
            RAISE NOTICE 'Invalid start dates:';
            FOR r IN SELECT id, start_date FROM marriages 
                     WHERE start_date IS NOT NULL 
                       AND start_date != '' 
                       AND NOT (start_date ~ '^\d{4}-\d{2}-\d{2}$')
                     LIMIT 10
            LOOP
                RAISE NOTICE '  Marriage %: start_date = %', r.id, r.start_date;
            END LOOP;
            
            RAISE NOTICE 'Invalid end dates:';
            FOR r IN SELECT id, end_date FROM marriages 
                     WHERE end_date IS NOT NULL 
                       AND end_date != '' 
                       AND NOT (end_date ~ '^\d{4}-\d{2}-\d{2}$')
                     LIMIT 10
            LOOP
                RAISE NOTICE '  Marriage %: end_date = %', r.id, r.end_date;
            END LOOP;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 2. Create temporary backup columns
-- ============================================================================
ALTER TABLE marriages 
    ADD COLUMN IF NOT EXISTS start_date_backup TEXT,
    ADD COLUMN IF NOT EXISTS end_date_backup TEXT;

-- Backup existing values
UPDATE marriages 
SET 
    start_date_backup = start_date,
    end_date_backup = end_date;

-- ============================================================================
-- 3. Safely convert TEXT columns to DATE
-- ============================================================================

-- Helper function to safely parse dates
CREATE OR REPLACE FUNCTION safe_parse_date(date_text TEXT)
RETURNS DATE AS $$
BEGIN
    -- Return NULL for empty strings or NULL
    IF date_text IS NULL OR date_text = '' THEN
        RETURN NULL;
    END IF;
    
    -- Try to parse as DATE
    BEGIN
        RETURN date_text::DATE;
    EXCEPTION WHEN OTHERS THEN
        -- Return NULL if parsing fails
        RETURN NULL;
    END;
END;
$$ LANGUAGE plpgsql;

-- Convert columns to DATE type using safe parsing
ALTER TABLE marriages 
    ALTER COLUMN start_date TYPE DATE USING safe_parse_date(start_date),
    ALTER COLUMN end_date TYPE DATE USING safe_parse_date(end_date);

-- ============================================================================
-- 4. Add date validation constraint
-- ============================================================================
ALTER TABLE marriages 
    DROP CONSTRAINT IF EXISTS check_marriage_dates,
    ADD CONSTRAINT check_marriage_dates 
    CHECK (
        start_date IS NULL 
        OR end_date IS NULL 
        OR start_date <= end_date
    );

-- ============================================================================
-- 5. Verify conversion success
-- ============================================================================
DO $$
DECLARE
    v_converted_count INT;
    v_null_count INT;
BEGIN
    -- Count successful conversions
    SELECT COUNT(*) INTO v_converted_count
    FROM marriages
    WHERE (start_date IS NOT NULL OR end_date IS NOT NULL);
    
    -- Count NULLs (including converted invalids)
    SELECT COUNT(*) INTO v_null_count
    FROM marriages
    WHERE start_date IS NULL AND end_date IS NULL;
    
    RAISE NOTICE 'Date conversion complete:';
    RAISE NOTICE '  Marriages with dates: %', v_converted_count;
    RAISE NOTICE '  Marriages without dates: %', v_null_count;
    
    -- Check for data loss
    SELECT COUNT(*) INTO v_converted_count
    FROM marriages
    WHERE (start_date_backup IS NOT NULL AND start_date_backup != '' AND start_date IS NULL)
       OR (end_date_backup IS NOT NULL AND end_date_backup != '' AND end_date IS NULL);
    
    IF v_converted_count > 0 THEN
        RAISE WARNING 'Data loss detected: % marriages had invalid dates converted to NULL', v_converted_count;
        RAISE WARNING 'Original values preserved in start_date_backup and end_date_backup columns';
    END IF;
END $$;

-- ============================================================================
-- 6. Clean up temporary function
-- ============================================================================
DROP FUNCTION IF EXISTS safe_parse_date(TEXT);

-- ============================================================================
-- 7. Optional: Drop backup columns after verification
-- ============================================================================
-- Uncomment these lines after verifying the conversion was successful:
-- ALTER TABLE marriages 
--     DROP COLUMN IF EXISTS start_date_backup,
--     DROP COLUMN IF EXISTS end_date_backup;

-- ============================================================================
-- 8. Update marriage admin functions to handle DATE type
-- ============================================================================
-- The admin_create_marriage and admin_update_marriage functions already handle DATE type
-- They cast from TEXT in parameters to DATE when needed, so no changes required

-- ============================================================================
-- 9. Add migration metadata
-- ============================================================================
COMMENT ON COLUMN marriages.start_date IS 'Marriage start date (DATE type, was TEXT)';
COMMENT ON COLUMN marriages.end_date IS 'Marriage end date - for divorced/widowed status (DATE type, was TEXT)';
COMMENT ON CONSTRAINT check_marriage_dates ON marriages IS 'Ensures start_date <= end_date when both are present';

COMMENT ON SCHEMA public IS 'Migration 026: Data type fixes - Converted marriages date columns from TEXT to DATE with safe parsing and validation';