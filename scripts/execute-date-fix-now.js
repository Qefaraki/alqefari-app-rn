const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

// Use service role key for admin access
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const fixSQL = `
-- Fix get_branch_data to include date fields
DROP FUNCTION IF EXISTS get_branch_data(TEXT, INT, INT);

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
        -- Base case
        SELECT 
            p.*,
            0 as depth
        FROM profiles p
        WHERE 
            CASE 
                WHEN p_hid IS NULL THEN p.generation = 1
                ELSE p.hid = p_hid
            END
        
        UNION ALL
        
        -- Recursive case
        SELECT 
            p.*,
            ft.depth + 1
        FROM profiles p
        INNER JOIN family_tree ft ON p.father_id = ft.id OR p.mother_id = ft.id
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
            (SELECT COUNT(*)::INT FROM profiles WHERE father_id = ft.id OR mother_id = ft.id),
            0
        ) as descendants_count,
        CASE 
            WHEN ft.depth >= p_max_depth - 1 THEN
                EXISTS(SELECT 1 FROM profiles WHERE father_id = ft.id OR mother_id = ft.id)
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

GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated;
`;

async function executeFix() {
  console.log("Executing date fix with service role key...\n");

  try {
    // First check if admin_execute_sql exists
    const { data: testAdmin, error: adminError } = await supabase.rpc(
      "admin_execute_sql",
      {
        sql: "SELECT 1",
      },
    );

    if (!adminError) {
      // Use admin_execute_sql
      console.log("Using admin_execute_sql function...");
      const { error: execError } = await supabase.rpc("admin_execute_sql", {
        sql: fixSQL,
      });

      if (execError) {
        console.error("Execution error:", execError);
        console.log("\nTrying alternative approach...");
      } else {
        console.log("✅ SQL executed successfully via admin function!");
      }
    }
  } catch (e) {
    console.log("admin_execute_sql not available, trying direct approach...");
  }

  // Test if it worked
  console.log("\nTesting updated function...");
  const { data, error } = await supabase.rpc("get_branch_data", {
    p_hid: null,
    p_max_depth: 1,
    p_limit: 1,
  });

  if (error) {
    console.error("Function test error:", error);
    return;
  }

  if (data && data[0]) {
    const fields = Object.keys(data[0]);
    const hasDobData = fields.includes("dob_data");
    const hasDodData = fields.includes("dod_data");

    console.log(`Function returns ${fields.length} fields`);
    console.log(`Has dob_data: ${hasDobData ? "✅" : "❌"}`);
    console.log(`Has dod_data: ${hasDodData ? "✅" : "❌"}`);

    if (hasDobData && hasDodData) {
      console.log("\n🎉 SUCCESS! Dates are now working!");
      console.log("The ProfileSheet should now display dates correctly.");

      if (data[0].dob_data) {
        console.log(`\nSample data - ${data[0].name}:`);
        console.log(`Birth: ${JSON.stringify(data[0].dob_data)}`);
      }
    } else {
      console.log("\n⚠️ Date fields still not included");
      console.log("Manual intervention required in Supabase Dashboard");
    }
  }
}

executeFix().catch(console.error);
