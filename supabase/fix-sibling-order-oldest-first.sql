-- Fix sibling ordering to be oldest first (lower sibling_order = older)
-- Age hierarchy: 0 = oldest, 1 = second oldest, etc.

WITH sibling_groups AS (
  SELECT 
    id,
    father_id,
    mother_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(father_id, mother_id) 
      ORDER BY created_at ASC  -- Oldest first (earliest created_at gets lowest number)
    ) - 1 AS new_order
  FROM profiles
  WHERE father_id IS NOT NULL OR mother_id IS NOT NULL
)
UPDATE profiles p
SET sibling_order = sg.new_order
FROM sibling_groups sg
WHERE p.id = sg.id;

-- Verify the update
SELECT 
  name,
  sibling_order,
  created_at,
  father_id
FROM profiles
WHERE father_id IS NOT NULL
ORDER BY father_id, sibling_order
LIMIT 20;
