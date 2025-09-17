-- Fix sibling ordering using HID as the source of truth
-- HID format: parent.child where lower child number = older
-- Example: 1.1 is older than 1.2, 1.2 is older than 1.3, etc.

WITH sibling_groups AS (
  SELECT 
    id,
    father_id,
    mother_id,
    hid,
    name,
    -- Extract the last segment of HID (the child number)
    -- For HID like '1.9.6.4', this gets '4'
    CAST(
      SPLIT_PART(hid, '.', array_length(string_to_array(hid, '.'), 1))
      AS INTEGER
    ) as hid_child_number,
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
SELECT 
  name,
  hid,
  hid_child_number,
  sibling_order as old_order,
  correct_order as new_order
FROM profiles p
JOIN sibling_groups sg ON p.id = sg.id
WHERE father_id = '1c4e095f-b054-4dbd-8663-87e359c28f67'  -- سليمان's children as example
ORDER BY correct_order;

-- Now apply the fix to ALL profiles
WITH sibling_groups AS (
  SELECT 
    id,
    father_id,
    mother_id,
    hid,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(father_id, mother_id) 
      ORDER BY 
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
WHERE p.id = sg.id;

-- Show results
SELECT 'Updated sibling_order for all profiles based on HID' as status;
