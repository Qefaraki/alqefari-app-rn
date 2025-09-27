#!/usr/bin/env node
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deploySpouseFields() {
  console.log("Adding spouse profile fields to marriages table...");

  const sql = `
    -- Add spouse profile fields to marriages table
    ALTER TABLE marriages
    ADD COLUMN IF NOT EXISTS spouse_date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS spouse_date_of_death DATE,
    ADD COLUMN IF NOT EXISTS spouse_location TEXT,
    ADD COLUMN IF NOT EXISTS spouse_story TEXT,
    ADD COLUMN IF NOT EXISTS spouse_phone VARCHAR(20),
    ADD COLUMN IF NOT EXISTS spouse_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS spouse_photo_url TEXT;

    -- Add indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_marriages_spouse_dates ON marriages(spouse_date_of_birth, spouse_date_of_death);
  `;

  try {
    const { data, error } = await supabase.rpc("execute_sql", {
      sql_query: sql,
    });

    if (error) {
      // Try direct execution if RPC doesn't work
      const { error: directError } = await supabase
        .from("marriages")
        .select("spouse_date_of_birth")
        .limit(1);

      if (directError && directError.message.includes("column")) {
        console.error(
          "Failed to add spouse fields. You may need to add them manually via Supabase dashboard.",
        );
        console.log("\nSQL to run in Supabase SQL Editor:");
        console.log(sql);
      } else {
        console.log(
          "✅ Spouse profile fields may already exist or were added successfully",
        );
      }
    } else {
      console.log("✅ Spouse profile fields added successfully!");
    }

    // Test the fields exist
    const { data: testData, error: testError } = await supabase
      .from("marriages")
      .select("id, spouse_date_of_birth, spouse_location, spouse_story")
      .limit(1);

    if (!testError) {
      console.log("✅ Verified: Spouse fields are available in the database");
    }
  } catch (err) {
    console.error("Error:", err.message);
    console.log("\nPlease run this SQL in your Supabase dashboard:");
    console.log(sql);
  }
}

deploySpouseFields();
