const { Client } = require("pg");
require("dotenv").config();

// Try different connection strings
const connectionStrings = [
  // Direct connection
  `postgresql://postgres:Khaled11221984$$@db.ezkioroyhzpavmbfavyn.supabase.co:5432/postgres`,
  // Pooler connection
  `postgresql://postgres.ezkioroyhzpavmbfavyn:Khaled11221984$$@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
  // Transaction pooler
  `postgresql://postgres.ezkioroyhzpavmbfavyn:Khaled11221984$$@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
];

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

async function tryConnection(connectionString, index) {
  console.log(`\nAttempt ${index + 1}: Trying connection...`);
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("✅ Connected successfully!");

    // Execute the fix
    console.log("Executing SQL fix...");
    await client.query(fixSQL);
    console.log("✅ SQL executed successfully!");

    // Test the function
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'get_branch_data' 
      AND column_name IN ('dob_data', 'dod_data')
    `);

    // Alternative test
    const funcTest = await client.query(`
      SELECT * FROM get_branch_data(NULL, 1, 1)
    `);

    if (funcTest.fields) {
      const fieldNames = funcTest.fields.map((f) => f.name);
      console.log(`\nFunction returns ${fieldNames.length} fields`);
      console.log(
        `Has dob_data: ${fieldNames.includes("dob_data") ? "✅" : "❌"}`,
      );
      console.log(
        `Has dod_data: ${fieldNames.includes("dod_data") ? "✅" : "❌"}`,
      );

      if (fieldNames.includes("dob_data") && fieldNames.includes("dod_data")) {
        console.log("\n🎉 SUCCESS! Date fields are now working!");
        return true;
      }
    }

    await client.end();
    return false;
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    try {
      await client.end();
    } catch (e) {}
    return false;
  }
}

async function main() {
  console.log("Attempting to fix get_branch_data function directly...");

  for (let i = 0; i < connectionStrings.length; i++) {
    const success = await tryConnection(connectionStrings[i], i);
    if (success) {
      console.log("\n✅ Fix applied successfully!");
      console.log("Dates should now display in the ProfileSheet.");
      return;
    }
  }

  console.log("\n❌ All connection attempts failed.");
  console.log("\n📋 MANUAL FIX REQUIRED:");
  console.log(
    "1. Go to: https://supabase.com/dashboard/project/ezkioroyhzpavmbfavyn/sql/new",
  );
  console.log("2. Copy the SQL from: /supabase/deploy-date-fix.sql");
  console.log("3. Click Run");
}

main().catch(console.error);
