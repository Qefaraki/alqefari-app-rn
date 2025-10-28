-- Migration: Add share_code column for secure, professional profile deep links
-- Purpose: Replace HID exposure in URLs with 5-character alphanumeric codes
-- Capacity: 36^5 = 60,466,176 combinations (supports 100k+ profiles)
-- Format: lowercase alphanumeric (a-z, 0-9)
-- Example: alqefari://profile/k7m3x instead of alqefari://profile/H12345

-- Step 1: Add share_code column (nullable initially for population)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS share_code VARCHAR(5);

-- Step 2: Create index for fast lookups (critical for deep link parsing)
CREATE INDEX IF NOT EXISTS idx_profiles_share_code ON profiles(share_code);

-- Step 3: Generate share codes for existing profiles with collision handling
-- Uses MD5 hash with row number for uniqueness guarantee
DO $$
DECLARE
  profile_record RECORD;
  new_code TEXT;
  attempt INT;
  max_attempts INT := 100;
BEGIN
  FOR profile_record IN SELECT id FROM profiles WHERE share_code IS NULL ORDER BY id LOOP
    attempt := 0;
    LOOP
      -- Generate code from UUID + attempt counter
      new_code := LOWER(
        SUBSTRING(
          MD5(profile_record.id::text || attempt::text),
          1, 5
        )
      );

      -- Check if unique
      IF NOT EXISTS (SELECT 1 FROM profiles WHERE share_code = new_code) THEN
        UPDATE profiles SET share_code = new_code WHERE id = profile_record.id;
        EXIT;
      END IF;

      -- Increment attempt
      attempt := attempt + 1;
      IF attempt >= max_attempts THEN
        RAISE EXCEPTION 'Failed to generate unique share code for profile % after % attempts', profile_record.id, max_attempts;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Step 4: Make it NOT NULL after populating
ALTER TABLE profiles
ALTER COLUMN share_code SET NOT NULL;

-- Step 5: Add unique constraint
ALTER TABLE profiles
ADD CONSTRAINT unique_share_code UNIQUE (share_code);

-- Step 6: Add format validation (only lowercase alphanumeric, exactly 5 chars)
ALTER TABLE profiles
ADD CONSTRAINT check_share_code_format
CHECK (share_code ~ '^[a-z0-9]{5}$');

-- Step 7: Function to generate unique share code for new profiles
CREATE OR REPLACE FUNCTION generate_share_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  max_attempts INT := 10;
  attempt INT := 0;
BEGIN
  -- Generate from UUID hash with attempt counter for collision handling
  LOOP
    new_code := LOWER(
      SUBSTRING(
        MD5(NEW.id::text || attempt::text),
        1, 5
      )
    );

    -- Check if unique (collision detection)
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE share_code = new_code) THEN
      NEW.share_code := new_code;
      EXIT;
    END IF;

    -- Increment attempt counter
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique share code after % attempts', max_attempts;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Trigger for new profile inserts
DROP TRIGGER IF EXISTS set_share_code_on_insert ON profiles;
CREATE TRIGGER set_share_code_on_insert
BEFORE INSERT ON profiles
FOR EACH ROW
WHEN (NEW.share_code IS NULL)
EXECUTE FUNCTION generate_share_code();

-- Verification: Check that all profiles have unique share codes
DO $$
DECLARE
  total_profiles INT;
  profiles_with_codes INT;
  duplicate_codes INT;
BEGIN
  SELECT COUNT(*) INTO total_profiles FROM profiles;
  SELECT COUNT(*) INTO profiles_with_codes FROM profiles WHERE share_code IS NOT NULL;
  SELECT COUNT(*) INTO duplicate_codes FROM (
    SELECT share_code FROM profiles GROUP BY share_code HAVING COUNT(*) > 1
  ) duplicates;

  RAISE NOTICE 'Migration verification:';
  RAISE NOTICE '  Total profiles: %', total_profiles;
  RAISE NOTICE '  Profiles with share codes: %', profiles_with_codes;
  RAISE NOTICE '  Duplicate share codes: %', duplicate_codes;

  IF total_profiles != profiles_with_codes THEN
    RAISE EXCEPTION 'Not all profiles have share codes!';
  END IF;

  IF duplicate_codes > 0 THEN
    RAISE EXCEPTION 'Duplicate share codes detected!';
  END IF;
END $$;
