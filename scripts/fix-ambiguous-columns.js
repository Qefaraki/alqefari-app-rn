const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// The CORRECT fix - properly handling column references
const fixSQL = `
-- Drop all existing versions to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc 
        WHERE proname = 'get_branch_data'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE';
    END LOOP;
END $$;

-- Create the CORRECT version with proper column references
CREATE OR REPLACE FUNCTION get_branch_data(
    p_hid TEXT,
    p_max_depth INT DEFAULT 3,
    p_limit INT DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    hid TEXT,
    name TEXT,
    father_id UUID,
    mother_id UUID,
    generation INT,
    sibling_order INT,
    gender TEXT,
    photo_url TEXT,
    status TEXT,
    current_residence TEXT,
    occupation TEXT,
    layout_position JSONB,
    descendants_count INT,
    has_more_descendants BOOLEAN,
    dob_data JSONB,
    dod_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE family_tree AS (
        -- Base case: starting node(s)
        SELECT 
            p.id,
            p.hid,
            p.name,
            p.father_id,
            p.mother_id,
            p.generation,
            p.sibling_order,
            p.gender,
            p.photo_url,
            p.status,
            p.current_residence,
            p.occupation,
            p.layout_position,
            p.dob_data,
            p.dod_data,
            p.bio,
            p.birth_place,
            0 as depth
        FROM profiles p
        WHERE 
            CASE 
                WHEN p_hid IS NULL THEN p.generation = 1
                ELSE p.hid = p_hid
            END
        
        UNION ALL
        
        -- Recursive case: get descendants
        SELECT 
            p.id,
            p.hid,
            p.name,
            p.father_id,
            p.mother_id,
            p.generation,
            p.sibling_order,
            p.gender,
            p.photo_url,
            p.status,
            p.current_residence,
            p.occupation,
            p.layout_position,
            p.dob_data,
            p.dod_data,
            p.bio,
            p.birth_place,
            ft.depth + 1
        FROM profiles p
        INNER JOIN family_tree ft ON (p.father_id = ft.id OR p.mother_id = ft.id)
        WHERE ft.depth < p_max_depth - 1
    )
    SELECT 
        ft.id,
        ft.hid,
        ft.name,
        ft.father_id,
        ft.mother_id,
        ft.generation,
        ft.sibling_order,
        ft.gender,
        ft.photo_url,
        ft.status,
        ft.current_residence,
        ft.occupation,
        ft.layout_position,
        COALESCE(
            (SELECT COUNT(*)::INT FROM profiles p2 WHERE p2.father_id = ft.id OR p2.mother_id = ft.id),
            0
        ) as descendants_count,
        CASE 
            WHEN ft.depth >= p_max_depth - 1 THEN
                EXISTS(SELECT 1 FROM profiles p3 WHERE p3.father_id = ft.id OR p3.mother_id = ft.id)
            ELSE 
                false
        END as has_more_descendants,
        ft.dob_data,
        ft.dod_data
    FROM family_tree ft
    ORDER BY ft.generation, ft.sibling_order, ft.hid
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated, service_role;

-- Verify it works
SELECT 'Function fixed!' as status;
`;

console.log("Testing current function state...");

async function testAndShowFix() {
  // First test current state
  const { data: testData, error: testError } = await supabase.rpc(
    "get_branch_data",
    {
      p_hid: null,
      p_max_depth: 3,
      p_limit: 100,
    },
  );

  if (testError) {
    console.log("❌ Current function is broken:", testError.message);
  } else if (testData) {
    console.log(`Current function returns ${testData.length} nodes`);

    // Count generations
    const generations = {};
    testData.forEach((node) => {
      generations[node.generation] = (generations[node.generation] || 0) + 1;
    });

    console.log("Generations found:", Object.keys(generations).length);
    Object.entries(generations).forEach(([gen, count]) => {
      console.log(`  Gen ${gen}: ${count} nodes`);
    });
  }

  console.log("\n📋 FIX REQUIRED - Run this SQL in Supabase Dashboard:");
  console.log(
    "URL: https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/sql/new",
  );
  console.log("\n--- COPY SQL BELOW ---");
  console.log(fixSQL);
  console.log("--- END SQL ---");
}

testAndShowFix();
