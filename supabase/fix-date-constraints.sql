-- Fix date validation to support historical dates and the current data structure

-- First, drop the existing constraints
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS check_dob_data,
  DROP CONSTRAINT IF EXISTS check_dod_data;

-- Create an updated validation function that supports historical dates
CREATE OR REPLACE FUNCTION validate_date_jsonb(date_data JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- NULL is valid (optional field)
    IF date_data IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Check basic structure
    IF jsonb_typeof(date_data) != 'object' THEN
        RETURN FALSE;
    END IF;
    
    -- Validate Hijri date if present (nested structure)
    IF date_data ? 'hijri' AND date_data->'hijri' IS NOT NULL THEN
        IF NOT (
            jsonb_typeof(date_data->'hijri') = 'object' AND
            (date_data->'hijri'->>'year')::INT BETWEEN 1 AND 9999 AND  -- Extended range for historical dates
            (date_data->'hijri'->>'month')::INT BETWEEN 1 AND 12 AND
            (date_data->'hijri'->>'day')::INT BETWEEN 1 AND 30
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Validate Hijri date if present (flat structure for backwards compatibility)
    IF date_data ? 'hijri_year' THEN
        IF NOT (
            (date_data->>'hijri_year')::INT BETWEEN 1 AND 9999 AND  -- Extended range
            (date_data->>'hijri_month')::INT BETWEEN 1 AND 12 AND
            (date_data->>'hijri_day')::INT BETWEEN 1 AND 30
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Validate Gregorian date if present (nested structure)
    IF date_data ? 'gregorian' AND date_data->'gregorian' IS NOT NULL THEN
        IF NOT (
            jsonb_typeof(date_data->'gregorian') = 'object' AND
            (date_data->'gregorian'->>'year')::INT BETWEEN 1 AND 9999  -- Extended range for historical dates
        ) THEN
            RETURN FALSE;
        END IF;
        
        -- Check month and day
        IF date_data->'gregorian' ? 'month' THEN
            IF NOT ((date_data->'gregorian'->>'month')::INT BETWEEN 1 AND 12) THEN
                RETURN FALSE;
            END IF;
        END IF;
        
        IF date_data->'gregorian' ? 'day' THEN
            IF NOT ((date_data->'gregorian'->>'day')::INT BETWEEN 1 AND 31) THEN
                RETURN FALSE;
            END IF;
        END IF;
    END IF;
    
    -- Validate Gregorian date if present (flat structure for backwards compatibility)
    IF date_data ? 'year' THEN
        IF NOT (
            (date_data->>'year')::INT BETWEEN 1 AND 9999  -- Extended range
        ) THEN
            RETURN FALSE;
        END IF;
        
        IF date_data ? 'month' THEN
            IF NOT ((date_data->>'month')::INT BETWEEN 1 AND 12) THEN
                RETURN FALSE;
            END IF;
        END IF;
        
        IF date_data ? 'day' THEN
            IF NOT ((date_data->>'day')::INT BETWEEN 1 AND 31) THEN
                RETURN FALSE;
            END IF;
        END IF;
    END IF;
    
    -- At least one date field should be present (relaxed check for compatibility)
    IF NOT (
        date_data ? 'hijri' OR 
        date_data ? 'gregorian' OR 
        date_data ? 'year' OR 
        date_data ? 'hijri_year'
    ) THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Return false if any casting or validation fails
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Re-add the constraints with the updated validation
ALTER TABLE profiles 
  ADD CONSTRAINT check_dob_data CHECK (validate_date_jsonb(dob_data)),
  ADD CONSTRAINT check_dod_data CHECK (validate_date_jsonb(dod_data));

-- Add comment explaining the validation
COMMENT ON FUNCTION validate_date_jsonb IS 'Validates date JSONB structure. Supports both flat (legacy) and nested formats. Allows historical dates from year 1 to 9999 in both Hijri and Gregorian calendars.';