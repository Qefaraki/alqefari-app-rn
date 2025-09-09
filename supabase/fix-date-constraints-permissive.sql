-- Remove ALL date validation constraints for maximum flexibility
-- This allows any date between years 1-2200 for both calendars

-- Drop existing constraints
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS check_dob_data,
  DROP CONSTRAINT IF EXISTS check_dod_data;

-- Create extremely permissive validation function
CREATE OR REPLACE FUNCTION validate_date_jsonb(date_data JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- NULL is valid
    IF date_data IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Must be an object
    IF jsonb_typeof(date_data) != 'object' THEN
        RETURN FALSE;
    END IF;
    
    -- That's it! Any object is valid
    -- All actual validation happens in the app layer
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Re-add constraints with permissive validation
ALTER TABLE profiles 
  ADD CONSTRAINT check_dob_data CHECK (validate_date_jsonb(dob_data)),
  ADD CONSTRAINT check_dod_data CHECK (validate_date_jsonb(dod_data));

COMMENT ON FUNCTION validate_date_jsonb IS 'Permissive date validation - accepts any JSONB object. Actual validation happens in application layer to support historical dates 1-2200 in both Hijri and Gregorian calendars.';