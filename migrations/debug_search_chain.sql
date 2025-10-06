-- Debug query to diagnose search name chain issue
-- This tests what search_name_chain returns for different query lengths

-- Test 1: Two-letter search (should show problem)
SELECT
  '2-letter query' as test,
  id,
  name,
  name_chain,
  professional_title,
  title_abbreviation,
  match_score,
  match_depth
FROM search_name_chain(ARRAY['عل'], 10, 0)
ORDER BY match_score DESC
LIMIT 5;

-- Test 2: Three-letter search (should work correctly)
SELECT
  '3-letter query' as test,
  id,
  name,
  name_chain,
  professional_title,
  title_abbreviation,
  match_score,
  match_depth
FROM search_name_chain(ARRAY['علي'], 10, 0)
ORDER BY match_score DESC
LIMIT 5;

-- Test 3: Check if ancestry CTE is building full chains
-- This directly queries the ancestry CTE logic to see depth
WITH RECURSIVE ancestry AS (
  SELECT
    p.id,
    p.name,
    p.father_id,
    ARRAY[p.name] as display_names,
    1 as depth
  FROM profiles p
  WHERE p.deleted_at IS NULL
    AND p.name LIKE 'علي%'

  UNION ALL

  SELECT
    a.id,
    a.name,
    parent.father_id,
    a.display_names || parent.name,
    a.depth + 1
  FROM ancestry a
  JOIN profiles parent ON parent.id = a.father_id
  WHERE parent.deleted_at IS NULL
    AND a.depth < 20
)
SELECT
  'Ancestry depth check' as test,
  id,
  name,
  depth,
  array_length(display_names, 1) as chain_length,
  array_to_string(display_names[1:least(array_length(display_names, 1), 5)], ' بن ') as built_chain
FROM ancestry
ORDER BY id, depth DESC
LIMIT 10;
