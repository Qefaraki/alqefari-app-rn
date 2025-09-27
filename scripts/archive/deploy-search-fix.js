const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

async function deploySearchFix() {
  console.log("Deploying search function fix...");

  const sql = `
-- Fix search function to use actual birth date columns
-- The profiles table uses dob_data JSONB, not birth_year_hijri

-- Drop the existing function first
DROP FUNCTION IF EXISTS search_name_chain(TEXT[], INT, INT);

-- Recreate with correct column references
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
BEGIN
  -- Normalize input names for better matching
  SELECT array_agg(normalize_arabic(unnest))
  INTO v_normalized_names
  FROM unnest(p_names);
  
  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    -- Base case: start with all profiles
    SELECT 
      p.id,
      p.hid,
      p.name,
      p.father_id,
      ARRAY[p.id] as visited_ids,  -- Cycle detection
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
      a.visited_ids || parent.id,  -- Track visited to prevent cycles
      a.name_array || normalize_arabic(parent.name),
      a.display_names || parent.name,
      a.current_chain || ' بن ' || parent.name,
      a.depth + 1,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri
    FROM ancestry a
    JOIN profiles parent ON parent.id = a.father_id
    WHERE parent.deleted_at IS NULL
      AND NOT (parent.id = ANY(a.visited_ids))  -- Prevent cycles
      AND a.depth < 20  -- Safety limit to prevent infinite recursion
  ),
  matches AS (
    -- Find matches and calculate scores
    SELECT DISTINCT ON (m.id)
      m.id,
      m.hid,
      m.name,
      -- Build display chain
      CASE 
        WHEN array_length(m.display_names, 1) > 1 THEN
          array_to_string(m.display_names[1:least(array_length(m.display_names, 1), 5)], ' بن ')
        ELSE m.name
      END as name_chain,
      m.generation,
      m.photo_url,
      m.birth_year_hijri,
      m.death_year_hijri,
      -- Calculate match score
      CASE 
        WHEN m.name_array[1:array_length(v_normalized_names, 1)] = v_normalized_names THEN 3.0
        WHEN m.name_array[1:array_length(v_normalized_names, 1)] @> v_normalized_names THEN 2.5
        WHEN m.name_array @> v_normalized_names THEN 2.0
        ELSE 1.0
      END as match_score,
      -- Match depth (how many names matched)
      CASE 
        WHEN m.name_array[1:array_length(v_normalized_names, 1)] = v_normalized_names 
        THEN array_length(v_normalized_names, 1)
        ELSE cardinality(m.name_array & v_normalized_names)
      END as match_depth,
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
      -- Match conditions
      (
        -- Exact prefix match
        m.name_array[1:array_length(v_normalized_names, 1)] = v_normalized_names
        OR
        -- Contains all names in sequence
        m.name_array @> v_normalized_names
      )
    ORDER BY m.id, m.depth DESC  -- Take the deepest chain for each person
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
    m.match_score,
    m.match_depth,
    m.father_name,
    m.grandfather_name
  FROM matches m
  ORDER BY 
    m.match_score DESC,
    m.match_depth DESC,
    m.generation ASC,
    m.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION search_name_chain(TEXT[], INT, INT) TO authenticated, anon;

-- Add comment
COMMENT ON FUNCTION search_name_chain IS 'Search profiles by Arabic name chains with full ancestry, using JSONB date fields';
  `;

  try {
    const { data, error } = await supabase.rpc("execute_sql", {
      sql_text: sql,
    });

    if (error) {
      console.error("Error executing SQL:", error);
      // Try direct approach
      console.log("Trying direct SQL execution...");

      // Split by statements and execute each
      const statements = sql
        .split(";")
        .filter((s) => s.trim())
        .map((s) => s.trim() + ";");

      for (const statement of statements) {
        if (
          statement.includes("DROP FUNCTION") ||
          statement.includes("CREATE OR REPLACE FUNCTION") ||
          statement.includes("GRANT") ||
          statement.includes("COMMENT")
        ) {
          const { error: stmtError } = await supabase.rpc("admin_execute_sql", {
            p_sql: statement,
          });

          if (stmtError) {
            console.error("Statement error:", stmtError);
          } else {
            console.log("✓ Statement executed successfully");
          }
        }
      }
    } else {
      console.log("✅ Search function fixed successfully!");
    }

    // Test the function
    console.log("\nTesting search function...");
    const { data: testData, error: testError } = await supabase.rpc(
      "search_name_chain",
      {
        p_names: ["محمد"],
        p_limit: 5,
      },
    );

    if (testError) {
      console.error("❌ Test failed:", testError);
    } else {
      console.log("✅ Search function working!");
      console.log(`Found ${testData?.length || 0} results`);
    }
  } catch (err) {
    console.error("Deployment failed:", err);
  }
}

deploySearchFix();
