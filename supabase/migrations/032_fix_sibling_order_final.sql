-- Final fix for sibling ordering based on HID
-- This ensures sibling_order matches actual birth order
-- HID format: parent.child where lower number = older

-- Fix all sibling orders based on HID
WITH sibling_groups AS (
  SELECT 
    id,
    father_id,
    mother_id,
    hid,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(father_id, mother_id) 
      ORDER BY 
        -- Order by the numeric value of the last HID segment
        CAST(
          SPLIT_PART(hid, '.', array_length(string_to_array(hid, '.'), 1))
          AS INTEGER
        ) ASC
    ) - 1 AS correct_order
  FROM profiles
  WHERE (father_id IS NOT NULL OR mother_id IS NOT NULL)
  AND deleted_at IS NULL
  AND hid IS NOT NULL
)
UPDATE profiles p
SET sibling_order = sg.correct_order
FROM sibling_groups sg
WHERE p.id = sg.id
AND p.sibling_order != sg.correct_order;

-- Add comment to document the field
COMMENT ON COLUMN profiles.sibling_order IS 'Birth order among siblings. 0 = oldest (firstborn), incrementing for younger siblings. This is the single source of truth for age ordering.';

-- Ensure new children get proper sibling_order
CREATE OR REPLACE FUNCTION assign_sibling_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Only assign if not already set
  IF NEW.sibling_order IS NULL THEN
    -- Get the next available sibling_order
    SELECT COALESCE(MAX(sibling_order), -1) + 1
    INTO NEW.sibling_order
    FROM profiles
    WHERE COALESCE(father_id, mother_id) = COALESCE(NEW.father_id, NEW.mother_id)
    AND deleted_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new profiles
DROP TRIGGER IF EXISTS assign_sibling_order_trigger ON profiles;
CREATE TRIGGER assign_sibling_order_trigger
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION assign_sibling_order();