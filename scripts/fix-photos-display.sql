-- Fix photos without proper primary status
UPDATE profile_photos 
SET is_primary = false 
WHERE is_primary IS NULL;

-- Ensure at least one primary photo per profile
WITH primary_photos AS (
  SELECT DISTINCT ON (profile_id) 
    id, profile_id
  FROM profile_photos
  WHERE profile_id IN (
    SELECT profile_id 
    FROM profile_photos 
    GROUP BY profile_id 
    HAVING NOT bool_or(is_primary)
  )
  ORDER BY profile_id, created_at ASC
)
UPDATE profile_photos
SET is_primary = true
WHERE id IN (SELECT id FROM primary_photos);