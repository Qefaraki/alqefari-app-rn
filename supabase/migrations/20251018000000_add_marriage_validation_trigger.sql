-- Migration: add_marriage_validation_trigger
-- Purpose: Enforce cousin marriage validation rules at database level
-- Prevents backwards cousin marriages and missing munasib values

-- Create trigger function to validate marriage data
CREATE OR REPLACE FUNCTION validate_marriage_munasib()
RETURNS TRIGGER AS $$
DECLARE
  v_husband_hid TEXT;
  v_wife_hid TEXT;
  v_husband_family_origin TEXT;
  v_wife_family_origin TEXT;
  v_is_cousin_marriage BOOLEAN;
  v_munasib_spouse_family TEXT;
BEGIN
  -- Skip validation for soft-deleted marriages
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get HID and family_origin for both spouses
  SELECT NULLIF(TRIM(hid), ''), NULLIF(TRIM(family_origin), '')
  INTO v_husband_hid, v_husband_family_origin
  FROM profiles
  WHERE id = NEW.husband_id
    AND deleted_at IS NULL;

  SELECT NULLIF(TRIM(hid), ''), NULLIF(TRIM(family_origin), '')
  INTO v_wife_hid, v_wife_family_origin
  FROM profiles
  WHERE id = NEW.wife_id
    AND deleted_at IS NULL;

  -- Determine if this is a cousin marriage (both spouses have HID)
  v_is_cousin_marriage := (v_husband_hid IS NOT NULL AND v_wife_hid IS NOT NULL);

  IF v_is_cousin_marriage THEN
    -- COUSIN MARRIAGE: munasib MUST be NULL
    IF NEW.munasib IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid cousin marriage: munasib must be NULL when both spouses are Al-Qefari family members (both have HID). Husband HID: %, Wife HID: %, Attempted munasib: %',
        v_husband_hid, v_wife_hid, NEW.munasib;
    END IF;
  ELSE
    -- REGULAR MARRIAGE: munasib MUST be set to the family_origin of the non-Al-Qefari spouse

    -- Find the munasib spouse's family_origin
    IF v_husband_hid IS NULL THEN
      v_munasib_spouse_family := v_husband_family_origin;
    ELSIF v_wife_hid IS NULL THEN
      v_munasib_spouse_family := v_wife_family_origin;
    ELSE
      -- This shouldn't happen (both have HID = cousin marriage), but handle defensively
      v_munasib_spouse_family := NULL;
    END IF;

    -- Validate munasib field matches the family_origin
    IF v_munasib_spouse_family IS NULL THEN
      RAISE EXCEPTION 'Invalid marriage: munasib spouse (without HID) must have family_origin set. Husband HID: %, Wife HID: %, Husband family_origin: %, Wife family_origin: %',
        v_husband_hid, v_wife_hid, v_husband_family_origin, v_wife_family_origin;
    END IF;

    IF NULLIF(TRIM(NEW.munasib), '') IS NULL THEN
      RAISE EXCEPTION 'Invalid marriage: munasib field must be set for marriages with external spouses. Expected munasib: %, Husband HID: %, Wife HID: %',
        v_munasib_spouse_family, v_husband_hid, v_wife_hid;
    END IF;

    IF TRIM(NEW.munasib) != TRIM(v_munasib_spouse_family) THEN
      RAISE EXCEPTION 'Invalid marriage: munasib field does not match external spouse family_origin. Expected: %, Got: %, Husband HID: %, Wife HID: %',
        v_munasib_spouse_family, NEW.munasib, v_husband_hid, v_wife_hid;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on marriages table
DROP TRIGGER IF EXISTS validate_marriage_munasib_trigger ON marriages;

CREATE TRIGGER validate_marriage_munasib_trigger
  BEFORE INSERT OR UPDATE ON marriages
  FOR EACH ROW
  EXECUTE FUNCTION validate_marriage_munasib();

-- Add helpful comment
COMMENT ON FUNCTION validate_marriage_munasib() IS 'Validates marriage munasib field based on spouse HID values. Cousin marriages (both have HID) must have munasib=NULL. Regular marriages (one without HID) must have munasib set to the external spouse family_origin.';

-- Log successful migration
DO $$
BEGIN
  RAISE NOTICE 'Marriage validation trigger created successfully';
  RAISE NOTICE 'Cousin marriages (both spouses have HID): munasib = NULL';
  RAISE NOTICE 'Regular marriages (one spouse without HID): munasib = family_origin of external spouse';
END $$;
