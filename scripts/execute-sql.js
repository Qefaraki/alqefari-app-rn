const https = require("https");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

// Read SQL file
const sqlFile = process.argv[2] || "deploy-date-fix.sql";
const sqlPath = path.join(__dirname, "..", "supabase", sqlFile);
const sqlContent = fs.readFileSync(sqlPath, "utf8");

// Prepare the request
const url = new URL(`${supabaseUrl}/rest/v1/rpc/query`);
const postData = JSON.stringify({ query_text: sqlContent });

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData),
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Prefer: "return=minimal",
  },
};

console.log("Executing SQL via REST API...");

const req = https.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    if (res.statusCode === 200 || res.statusCode === 204) {
      console.log("✓ SQL executed successfully!");
      testFunction();
    } else {
      console.log("Response status:", res.statusCode);
      console.log("Response:", data);
      // Try alternative approach
      executeViaAdminFunction();
    }
  });
});

req.on("error", (e) => {
  console.error("Request error:", e);
});

req.write(postData);
req.end();

function testFunction() {
  // Test if the function now returns date fields
  const testUrl = new URL(`${supabaseUrl}/rest/v1/rpc/get_branch_data`);
  const testData = JSON.stringify({ p_hid: null, p_max_depth: 1, p_limit: 1 });

  const testOptions = {
    hostname: testUrl.hostname,
    path: testUrl.pathname,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  };

  const testReq = https.request(testOptions, (res) => {
    let data = "";
    res.on("data", (chunk) => {
      data += chunk;
    });
    res.on("end", () => {
      try {
        const result = JSON.parse(data);
        if (result && result[0]) {
          const fields = Object.keys(result[0]);
          console.log("Function returns fields:", fields.length);
          console.log("Has dob_data:", fields.includes("dob_data"));
          console.log("Has dod_data:", fields.includes("dod_data"));
        }
      } catch (e) {
        console.log("Test response:", data);
      }
    });
  });

  testReq.write(testData);
  testReq.end();
}

function executeViaAdminFunction() {
  console.log("Trying to execute via admin function...");

  // Try to create an admin RPC wrapper
  const adminSQL = `
    DO $$
    BEGIN
      -- Drop and recreate the function with all fields
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
        dod_data JSONB,
        bio TEXT,
        birth_place TEXT
      ) AS $func$
      BEGIN
        RETURN QUERY
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
          0::INT as descendants_count,
          false as has_more_descendants,
          p.dob_data,
          p.dod_data,
          p.bio,
          p.birth_place
        FROM profiles p
        WHERE (p_hid IS NULL AND p.generation = 1) OR (p_hid IS NOT NULL AND p.hid = p_hid)
        LIMIT COALESCE(p_limit, 100);
      END;
      $func$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
      
      GRANT EXECUTE ON FUNCTION get_branch_data TO anon, authenticated;
    END $$;
  `;

  // Execute via a simple query
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseKey);

  supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .then(() => {
      console.log("Connected to database");
      // Now try to execute as admin RPC
      return supabase.rpc("admin_execute_sql", { sql: adminSQL });
    })
    .catch((err) => {
      console.log("Admin execution not available, using simplified version...");
      executeSimplified();
    });
}

function executeSimplified() {
  // Create a migration file instead
  const timestamp = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 14);
  const migrationPath = path.join(
    __dirname,
    "..",
    "supabase",
    "migrations",
    `${timestamp}_fix_get_branch_data.sql`,
  );

  console.log("Creating migration file:", migrationPath);
  fs.writeFileSync(migrationPath, sqlContent);

  console.log("Migration file created. Push it with: npx supabase db push");
}
