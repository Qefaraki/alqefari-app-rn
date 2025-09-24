#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deployFamilyOrigin() {
  console.log("🚀 Deploying family_origin tracking to Supabase...\n");

  try {
    // Read the migration file
    const sqlPath = path.join(__dirname, "..", "supabase", "migrations", "030_add_family_origin_tracking.sql");
    const sql = await fs.readFile(sqlPath, "utf8");

    // Split by semicolons and execute each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      console.log("Executing:", statement.substring(0, 50) + "...");

      // Use the admin_execute_sql function
      const { data, error } = await supabase.rpc("admin_execute_sql", {
        query: statement + ";"
      });

      if (error) {
        console.error("❌ Error:", error.message);
        // Try direct execution as fallback
        const { error: directError } = await supabase.from("_sql").select().single().eq("query", statement);
        if (directError) {
          console.error("Direct execution also failed:", directError.message);
        }
      } else {
        console.log("✅ Success");
      }
    }

    // Test the deployment
    console.log("\n📋 Testing deployment...");
    const { data: test, error: testError } = await supabase
      .from("profiles")
      .select("id, name, family_origin")
      .is("hid", null)
      .limit(3);

    if (testError) {
      console.log("⚠️ Warning: Could not verify deployment:", testError.message);
    } else {
      console.log("✅ Deployment successful! Sample data:");
      test?.forEach((row) => {
        console.log(`   ${row.name}: family_origin = ${row.family_origin || "NULL"}`);
      });
    }

    // Test the functions
    console.log("\n📋 Testing functions...");
    const { data: statsTest, error: statsError } = await supabase.rpc(
      "get_family_connection_stats"
    );

    if (statsError) {
      console.log("⚠️ Stats function error:", statsError.message);
    } else {
      console.log("✅ Stats function working. Found", statsTest?.length || 0, "families");
    }

  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  }
}

deployFamilyOrigin();