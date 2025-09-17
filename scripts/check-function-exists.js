#!/usr/bin/env node

import pkg from "pg";
const { Client } = pkg;
import dotenv from "dotenv";

dotenv.config();

// Build connection string from environment variables
const host = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(
  "https://",
  "",
).replace(".supabase.co", "");
const password =
  process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!host || !password) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const connectionString = `postgresql://postgres.${host}:${password}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

async function checkFunction() {
  const client = new Client({ connectionString });

  try {
    console.log("Connecting to database...");
    await client.connect();

    // Check if function exists
    const result = await client.query(`
      SELECT 
        routine_name,
        routine_type,
        data_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_name = 'reorder_children'
    `);

    if (result.rows.length > 0) {
      console.log("✅ Function exists in database:", result.rows[0]);

      // Test the function
      const testResult = await client.query(`
        SELECT reorder_children(
          '00000000-0000-0000-0000-000000000000'::UUID,
          '[]'::JSONB
        ) as result
      `);

      console.log("✅ Function test result:", testResult.rows[0].result);
    } else {
      console.log("❌ Function does not exist in database");
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
}

checkFunction();
