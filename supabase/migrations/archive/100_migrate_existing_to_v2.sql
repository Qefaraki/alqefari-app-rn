-- Migration Script: Transform existing v1 schema to v2 normalized schema
-- This script safely migrates existing data without losing any information

-- Step 1: Backup existing data
CREATE TABLE IF NOT EXISTS profiles_backup_v1 AS 
SELECT * FROM profiles;

CREATE TABLE IF NOT EXISTS marriages_backup_v1 AS 
SELECT * FROM marriages WHERE EXISTS (SELECT 1 FROM marriages LIMIT 1);

-- Step 2: Add new columns first (safe operation)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS descendants_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tree_meta JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dob_data JSONB,
  ADD COLUMN IF NOT EXISTS dod_data JSONB,
  ADD COLUMN IF NOT EXISTS social_media_links JSONB DEFAULT '{}';

-- Step 3: Migrate date data from text to JSONB
UPDATE profiles
SET 
  dob_data = CASE 
    WHEN birth_date IS NOT NULL AND birth_date != '' THEN
      jsonb_build_object(
        'hijri', jsonb_build_object('year', birth_date::int),
        'display', birth_date || 'هـ'
      )
    ELSE NULL
  END,
  dod_data = CASE 
    WHEN death_date IS NOT NULL AND death_date != '' THEN
      jsonb_build_object(
        'hijri', jsonb_build_object('year', death_date::int),
        'display', death_date || 'هـ'
      )
    ELSE NULL
  END
WHERE (birth_date IS NOT NULL OR death_date IS NOT NULL);

-- Step 4: Migrate social media data
UPDATE profiles
SET social_media_links = jsonb_strip_nulls(
  COALESCE(social_media_links, '{}'::jsonb) || 
  jsonb_build_object(
    'twitter', twitter,
    'instagram', instagram,
    'linkedin', linkedin,
    'website', website
  )
)
WHERE twitter IS NOT NULL 
   OR instagram IS NOT NULL 
   OR linkedin IS NOT NULL 
   OR website IS NOT NULL;

-- Step 5: Ensure HID is not null (generate for null values)
-- First, update root nodes (no father_id)
WITH root_nodes AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM profiles
  WHERE hid IS NULL AND father_id IS NULL
)
UPDATE profiles p
SET hid = 'R' || rn.rn
FROM root_nodes rn
WHERE p.id = rn.id;

-- Then update child nodes recursively
DO $$
DECLARE
  updated_count INT;
BEGIN
  LOOP
    WITH nodes_to_update AS (
      SELECT 
        child.id,
        parent.hid || '.' || ROW_NUMBER() OVER (
          PARTITION BY child.father_id 
          ORDER BY child.sibling_order, child.created_at
        ) as new_hid
      FROM profiles child
      JOIN profiles parent ON child.father_id = parent.id
      WHERE child.hid IS NULL AND parent.hid IS NOT NULL
    )
    UPDATE profiles p
    SET hid = n.new_hid
    FROM nodes_to_update n
    WHERE p.id = n.id;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    EXIT WHEN updated_count = 0;
  END LOOP;
END $$;

-- Step 6: Drop redundant columns (after data is safely migrated)
ALTER TABLE profiles
  DROP COLUMN IF EXISTS spouse_count,
  DROP COLUMN IF EXISTS spouse_names,
  DROP COLUMN IF EXISTS twitter,
  DROP COLUMN IF EXISTS instagram,
  DROP COLUMN IF EXISTS linkedin,
  DROP COLUMN IF EXISTS website,
  DROP COLUMN IF EXISTS birth_date,
  DROP COLUMN IF EXISTS death_date;

-- Step 7: Add constraints (only after data is clean)
-- First check if the constraint doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_hid_format'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT check_hid_format 
      CHECK (hid ~ '^[R]?\d+(\.\d+)*$');
  END IF;
END $$;

-- Step 8: Make HID not null
ALTER TABLE profiles
  ALTER COLUMN hid SET NOT NULL;

-- Step 9: Create validation functions if they don't exist
CREATE OR REPLACE FUNCTION validate_date_jsonb(date_data JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  IF date_data IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check basic structure
  IF NOT (date_data ? 'hijri' OR date_data ? 'gregorian') THEN
    RETURN false;
  END IF;
  
  -- Validate Hijri date if present
  IF date_data ? 'hijri' THEN
    IF NOT (date_data->'hijri' ? 'year') THEN
      RETURN false;
    END IF;
    -- Year should be reasonable (1-1500)
    IF (date_data->'hijri'->>'year')::int < 1 OR 
       (date_data->'hijri'->>'year')::int > 1500 THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Validate Gregorian date if present
  IF date_data ? 'gregorian' THEN
    IF NOT (date_data->'gregorian' ? 'year') THEN
      RETURN false;
    END IF;
    -- Year should be reasonable (600-2100)
    IF (date_data->'gregorian'->>'year')::int < 600 OR 
       (date_data->'gregorian'->>'year')::int > 2100 THEN
      RETURN false;
    END IF;
  END IF;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION validate_social_media_jsonb(links JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  IF links IS NULL THEN
    RETURN true;
  END IF;
  
  -- Must be an object
  IF jsonb_typeof(links) != 'object' THEN
    RETURN false;
  END IF;
  
  -- All values must be strings (URLs)
  FOR key, value IN SELECT * FROM jsonb_each(links)
  LOOP
    IF jsonb_typeof(value) != 'string' THEN
      RETURN false;
    END IF;
  END LOOP;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 10: Add validation constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_dob_data'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT check_dob_data 
      CHECK (validate_date_jsonb(dob_data));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_dod_data'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT check_dod_data 
      CHECK (validate_date_jsonb(dod_data));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_social_media'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT check_social_media 
      CHECK (validate_social_media_jsonb(social_media_links));
  END IF;
END $$;

-- Step 11: Create necessary indexes
CREATE INDEX IF NOT EXISTS idx_profiles_hid ON profiles(hid);
CREATE INDEX IF NOT EXISTS idx_profiles_father_id ON profiles(father_id);
CREATE INDEX IF NOT EXISTS idx_profiles_generation ON profiles(generation);
CREATE INDEX IF NOT EXISTS idx_profiles_layout_position ON profiles USING GIN (layout_position);

-- Step 12: Update search vectors
UPDATE profiles SET search_vector = NULL;
-- The trigger will repopulate on next update

-- Step 13: Create queue tables if they don't exist
CREATE TABLE IF NOT EXISTS layout_recalc_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  node_id UUID REFERENCES profiles(id),
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  error TEXT,
  retry_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON layout_recalc_queue(status, queued_at);

-- Step 14: Queue initial layout recalculation for nodes without positions
INSERT INTO layout_recalc_queue (node_id, status)
SELECT id, 'pending'
FROM profiles
WHERE layout_position IS NULL
ON CONFLICT DO NOTHING;

-- Final verification
DO $$
DECLARE
  profile_count INT;
  migrated_dates INT;
  migrated_social INT;
  missing_hid INT;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM profiles;
  SELECT COUNT(*) INTO migrated_dates FROM profiles WHERE dob_data IS NOT NULL;
  SELECT COUNT(*) INTO migrated_social FROM profiles WHERE jsonb_typeof(social_media_links) = 'object';
  SELECT COUNT(*) INTO missing_hid FROM profiles WHERE hid IS NULL;
  
  RAISE NOTICE 'Migration Summary:';
  RAISE NOTICE '- Total profiles: %', profile_count;
  RAISE NOTICE '- Migrated dates: %', migrated_dates;
  RAISE NOTICE '- Migrated social media: %', migrated_social;
  RAISE NOTICE '- Missing HIDs: %', missing_hid;
  
  IF missing_hid > 0 THEN
    RAISE EXCEPTION 'Migration failed: % profiles still have NULL HIDs', missing_hid;
  END IF;
END $$;

-- Success message
RAISE NOTICE 'Migration completed successfully! Original data backed up in profiles_backup_v1';