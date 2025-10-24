-- Migration: Support partial dates (year-only)
-- Purpose: Allow storing dates with only year component (month/day optional)
-- Enables simplified date picker UX for users who only know birth year
-- Backward compatible: Existing complete dates remain valid
-- Date: 2024-10-24

-- Update the validation function to support partial dates
-- Previous behavior: Enforced complete dates (year + month + day)
-- New behavior: Year is required, month/day are optional
CREATE OR REPLACE FUNCTION public.validate_date_jsonb(date_data jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
    IF date_data IS NULL THEN
        RETURN TRUE;
    END IF;

    IF jsonb_typeof(date_data) != 'object' THEN
        RETURN FALSE;
    END IF;

    -- Validate Gregorian calendar (if present)
    IF date_data ? 'gregorian' THEN
        IF NOT (jsonb_typeof(date_data->'gregorian') = 'object') THEN
            RETURN FALSE;
        END IF;

        -- Year is required
        IF NOT (date_data->'gregorian' ? 'year') THEN
            RETURN FALSE;
        END IF;

        -- Validate year range if present
        BEGIN
            IF NOT ((date_data->'gregorian'->>'year')::INT BETWEEN 1800 AND 2200) THEN
                RETURN FALSE;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RETURN FALSE;
        END;

        -- If month is provided, validate it (optional)
        IF date_data->'gregorian' ? 'month' THEN
            BEGIN
                IF NOT ((date_data->'gregorian'->>'month')::INT BETWEEN 1 AND 12) THEN
                    RETURN FALSE;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                RETURN FALSE;
            END;
        END IF;

        -- If day is provided, validate it (optional, only if month present)
        IF date_data->'gregorian' ? 'day' THEN
            BEGIN
                IF NOT ((date_data->'gregorian'->>'day')::INT BETWEEN 1 AND 31) THEN
                    RETURN FALSE;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                RETURN FALSE;
            END;
        END IF;
    END IF;

    -- Validate Hijri calendar (if present)
    IF date_data ? 'hijri' THEN
        IF NOT (jsonb_typeof(date_data->'hijri') = 'object') THEN
            RETURN FALSE;
        END IF;

        -- Year is required
        IF NOT (date_data->'hijri' ? 'year') THEN
            RETURN FALSE;
        END IF;

        -- Validate year range if present
        BEGIN
            IF NOT ((date_data->'hijri'->>'year')::INT BETWEEN 1 AND 2000) THEN
                RETURN FALSE;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RETURN FALSE;
        END;

        -- If month is provided, validate it (optional)
        IF date_data->'hijri' ? 'month' THEN
            BEGIN
                IF NOT ((date_data->'hijri'->>'month')::INT BETWEEN 1 AND 12) THEN
                    RETURN FALSE;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                RETURN FALSE;
            END;
        END IF;

        -- If day is provided, validate it (optional, only if month present)
        IF date_data->'hijri' ? 'day' THEN
            BEGIN
                IF NOT ((date_data->'hijri'->>'day')::INT BETWEEN 1 AND 30) THEN
                    RETURN FALSE;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                RETURN FALSE;
            END;
        END IF;
    END IF;

    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$function$;

-- Update table column comments to document partial date support
COMMENT ON COLUMN profiles.dob_data IS
'Birth date information stored as JSONB. Supports both complete and partial dates.
Complete date example: {"gregorian": {"year": 1985, "month": 3, "day": 15}, "hijri": {"year": 1405, "month": 6, "day": 23}, "approximate": false}
Partial date example (year-only): {"gregorian": {"year": 1960}, "approximate": true}
Month and day fields are optional. Partial dates always have "approximate": true to indicate uncertainty.
Store only what the user entered - do not convert between calendars for partial dates.';

COMMENT ON COLUMN profiles.dod_data IS
'Death date information stored as JSONB. Same structure as dob_data - supports complete and partial dates.
Partial dates are indicated by missing month/day fields and "approximate": true flag.';
