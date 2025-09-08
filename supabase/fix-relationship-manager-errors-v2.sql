-- Fix for RelationshipManagerV2 errors - Version 2
-- This script adds the missing columns and functions needed

-- 1. Create marriage_status type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'marriage_status') THEN
        CREATE TYPE marriage_status AS ENUM ('married', 'divorced', 'widowed', 'separated');
    END IF;
END$$;

-- 2. Add status column to marriages if it doesn't exist
ALTER TABLE marriages 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'married';

-- 3. Add is_current column to marriages table if it doesn't exist
ALTER TABLE marriages 
ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT false;

-- Update existing marriages to set is_current based on status
UPDATE marriages 
SET is_current = (status = 'married')
WHERE is_current IS NULL;

-- 4. Create the admin_get_person_wives function
CREATE OR REPLACE FUNCTION admin_get_person_wives(p_person_id UUID)
RETURNS TABLE (
  id UUID,
  wife_id UUID,
  wife_name TEXT,
  status TEXT,
  is_current BOOLEAN,
  children_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.wife_id,
    p.name AS wife_name,
    m.status,
    m.is_current,
    (
      SELECT COUNT(*)::INTEGER
      FROM profiles c
      WHERE c.mother_id = m.wife_id 
      AND c.father_id = p_person_id
    ) AS children_count
  FROM marriages m
  JOIN profiles p ON p.id = m.wife_id
  WHERE m.husband_id = p_person_id
  ORDER BY m.is_current DESC, m.created_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_get_person_wives(UUID) TO authenticated;

-- 5. Ensure sibling_order column exists in profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS sibling_order INTEGER DEFAULT 0;

-- Update existing siblings to have sequential ordering (use created_at instead of birth_date)
WITH sibling_groups AS (
  SELECT 
    id,
    father_id,
    mother_id,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(father_id, mother_id) 
      ORDER BY created_at
    ) - 1 AS new_order
  FROM profiles
  WHERE father_id IS NOT NULL OR mother_id IS NOT NULL
)
UPDATE profiles p
SET sibling_order = sg.new_order
FROM sibling_groups sg
WHERE p.id = sg.id
AND p.sibling_order = 0; -- Only update if not already set

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_sibling_order 
ON profiles(father_id, sibling_order) 
WHERE father_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marriages_is_current 
ON marriages(husband_id, is_current) 
WHERE is_current = true;

-- Done!
SELECT 'Migrations applied successfully!' AS status;
