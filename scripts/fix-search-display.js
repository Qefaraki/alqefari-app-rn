const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

async function fixSearchDisplay() {
  console.log(
    "Fixing search display to remove 'بن' and show clean name chains...",
  );

  const sql = `
-- Drop and recreate the search function with clean name chains
DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT);

CREATE OR REPLACE FUNCTION search_name_chain(
  p_names TEXT[],
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  hid TEXT,
  name TEXT,
  name_chain TEXT,
  generation INT,
  photo_url TEXT,
  birth_year_hijri INT,
  death_year_hijri INT,
  match_score FLOAT,
  match_depth INT,
  father_name TEXT,
  grandfather_name TEXT
) AS $$
DECLARE
  v_normalized_names TEXT[];
  v_search_length INT;
BEGIN
  -- Normalize input names for better matching
  SELECT array_agg(normalize_arabic(unnest))
  INTO v_normalized_names
  FROM unnest(p_names);
  
  v_search_length := array_length(v_normalized_names, 1);
  
  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    -- Base case: start with all profiles
    SELECT 
      p.id,
      p.hid,
      p.name,
      p.father_id,
      ARRAY[p.id] as visited_ids,
      ARRAY[normalize_arabic(p.name)] as name_array,
      ARRAY[p.name] as display_names,
      p.name as current_chain,
      1 as depth,
      p.generation,
      p.photo_url,
      -- Extract year from JSONB dob_data
      CASE 
        WHEN p.dob_data->>'hijri' IS NOT NULL 
        THEN (p.dob_data->'hijri'->>'year')::INT
        ELSE NULL
      END as birth_year_hijri,
      -- Extract year from JSONB dod_data
      CASE 
        WHEN p.dod_data->>'hijri' IS NOT NULL 
        THEN (p.dod_data->'hijri'->>'year')::INT
        ELSE NULL
      END as death_year_hijri
    FROM profiles p
    WHERE p.deleted_at IS NULL
    
    UNION ALL
    
    -- Recursive case: build complete chains up to root
    SELECT 
      a.id,
      a.hid,
      a.name,
      parent.father_id,
      a.visited_ids || parent.id,
      a.name_array || normalize_arabic(parent.name),
      a.display_names || parent.name,
      -- Just concatenate with space, no 'بن'
      a.current_chain || ' ' || parent.name,
      a.depth + 1,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri
    FROM ancestry a
    JOIN profiles parent ON parent.id = a.father_id
    WHERE parent.deleted_at IS NULL
      AND NOT (parent.id = ANY(a.visited_ids))
      AND a.depth < 20
  ),
  matches AS (
    SELECT DISTINCT ON (m.id)
      m.id,
      m.hid,
      m.name,
      -- Build display chain with just spaces
      CASE 
        WHEN array_length(m.display_names, 1) > 1 THEN
          array_to_string(m.display_names[1:least(array_length(m.display_names, 1), 5)], ' ')
        ELSE m.name
      END as name_chain,
      m.generation,
      m.photo_url,
      m.birth_year_hijri,
      m.death_year_hijri,
      -- Calculate match score
      CASE 
        -- Exact prefix match (names match from beginning)
        WHEN m.name_array[1:v_search_length] = v_normalized_names THEN 3.0::FLOAT
        -- All search names present in order
        WHEN m.name_array @> v_normalized_names THEN 2.0::FLOAT
        -- Partial match
        ELSE 1.0::FLOAT
      END as match_score,
      -- Count how many names matched
      (
        SELECT COUNT(*)::INT
        FROM unnest(v_normalized_names) AS search_name
        WHERE search_name = ANY(m.name_array)
      ) as match_depth,
      -- Father and grandfather names for display
      CASE WHEN array_length(m.display_names, 1) > 1 
        THEN m.display_names[2] 
        ELSE NULL 
      END as father_name,
      CASE WHEN array_length(m.display_names, 1) > 2 
        THEN m.display_names[3] 
        ELSE NULL 
      END as grandfather_name
    FROM ancestry m
    WHERE 
      -- Must have at least one matching name
      EXISTS (
        SELECT 1 
        FROM unnest(v_normalized_names) AS search_name
        WHERE search_name = ANY(m.name_array)
      )
      AND (
        -- Either exact prefix match
        m.name_array[1:v_search_length] = v_normalized_names
        OR
        -- Or contains all search names in sequence
        m.name_array @> v_normalized_names
        OR
        -- Or for single name search, just match anywhere
        (v_search_length = 1 AND v_normalized_names[1] = ANY(m.name_array))
      )
    ORDER BY m.id, m.depth DESC
  )
  SELECT 
    m.id,
    m.hid,
    m.name,
    m.name_chain,
    m.generation,
    m.photo_url,
    m.birth_year_hijri,
    m.death_year_hijri,
    m.match_score::FLOAT,
    m.match_depth,
    m.father_name,
    m.grandfather_name
  FROM matches m
  ORDER BY 
    m.match_score DESC,
    m.match_depth DESC,
    m.generation DESC,
    m.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_name_chain(TEXT[], INT, INT) TO authenticated, anon;

-- Test the function
SELECT * FROM search_name_chain(ARRAY['محمد'], 5, 0);
  `;

  // Write to file for clipboard
  const fs = require("fs");
  fs.writeFileSync("/tmp/fix_search_display.sql", sql);

  console.log("✅ SQL saved to /tmp/fix_search_display.sql");
  console.log("📋 Copying to clipboard...");

  const { exec } = require("child_process");
  exec("cat /tmp/fix_search_display.sql | pbcopy", (error) => {
    if (error) {
      console.error("Failed to copy to clipboard:", error);
    } else {
      console.log("✅ SQL copied to clipboard!");
      console.log("\n📝 Instructions:");
      console.log("1. Go to Supabase Dashboard");
      console.log("2. Navigate to SQL Editor");
      console.log("3. Paste the SQL (it's in your clipboard)");
      console.log("4. Click 'Run' to execute");
      console.log("\nThis will:");
      console.log("- Remove 'بن' from name chains");
      console.log("- Show clean space-separated names like: محمد عبدالله سالم");
    }
  });
}

fixSearchDisplay();
