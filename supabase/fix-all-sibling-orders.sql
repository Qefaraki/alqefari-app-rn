-- Fix ALL sibling ordering to ensure oldest = 0, youngest = highest number
-- This assumes older profiles were created first (using created_at as proxy for age)

WITH sibling_groups AS (
  SELECT 
    id,
    father_id,
    mother_id,
    created_at,
    name,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(father_id, mother_id) 
      ORDER BY created_at ASC  -- Oldest first (earliest created_at = oldest child)
    ) - 1 AS correct_order
  FROM profiles
  WHERE (father_id IS NOT NULL OR mother_id IS NOT NULL)
  AND deleted_at IS NULL
)
UPDATE profiles p
SET sibling_order = sg.correct_order
FROM sibling_groups sg
WHERE p.id = sg.id
AND p.sibling_order != sg.correct_order;  -- Only update if different

-- Show count of updated records
SELECT 'Updated sibling_order for ' || COUNT(*) || ' profiles' as result
FROM profiles p
JOIN sibling_groups sg ON p.id = sg.id
WHERE p.sibling_order != sg.correct_order;
