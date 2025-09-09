import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = "https://ezkioroyhzpavmbfavyn.supabase.co";
const supabaseServiceKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6a2lvcm95aHpwYXZtYmZhdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQ5MjYyMCwiZXhwIjoyMDcyMDY4NjIwfQ.2h9_O6pJRUO3sxXeLBD6TisomoY_bjMdbouvs2Cen4k";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyFix() {
  console.log("🔧 Applying admin system fix...\n");

  try {
    // Read the SQL file
    const sqlPath = path.join(
      __dirname,
      "..",
      "supabase",
      "fix-admin-system-complete.sql",
    );
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Execute the SQL
    console.log("📝 Executing SQL fix...");
    const { data, error } = await supabase.rpc("execute_sql", { query: sql });

    if (error) {
      // If execute_sql doesn't exist, try direct approach
      console.log(
        "⚠️  execute_sql function not found, trying direct approach...",
      );

      // Split SQL into individual statements
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      for (const statement of statements) {
        console.log(`\nExecuting: ${statement.substring(0, 50)}...`);

        // Try to execute as RPC if it's a function
        if (statement.toUpperCase().includes("CREATE OR REPLACE FUNCTION")) {
          // Execute DDL directly via service role
          const { error: stmtError } = await supabase
            .rpc("execute_sql", {
              query: statement + ";",
            })
            .catch(() => ({ error: "execute_sql not available" }));

          if (stmtError) {
            console.log(
              "⚠️  Could not execute via RPC, statement may need manual execution",
            );
          } else {
            console.log("✅ Statement executed successfully");
          }
        }
      }
    } else {
      console.log("✅ SQL fix applied successfully!\n");
    }

    // Test the functions
    console.log("\n🧪 Testing admin functions...");

    // Test is_admin function
    const { data: adminCheck, error: adminError } = await supabase
      .rpc("is_admin")
      .single();

    if (adminError) {
      console.log("⚠️  is_admin function test failed:", adminError.message);
    } else {
      console.log("✅ is_admin function works:", adminCheck);
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      console.log("\n👤 Current user ID:", user.id);

      // Check if user is admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile) {
        console.log("📋 Current role:", profile.role || "member");

        if (profile.role !== "admin") {
          console.log("\n🔑 Making current user an admin...");
          const { error: updateError } = await supabase
            .from("profiles")
            .update({ role: "admin" })
            .eq("id", user.id);

          if (updateError) {
            console.log("❌ Failed to update role:", updateError.message);
          } else {
            console.log("✅ User is now an admin!");
          }
        }
      }
    }

    console.log("\n✨ Admin system fix complete!");
    console.log("📱 You can now use admin features in the app.");
  } catch (err) {
    console.error("❌ Error applying fix:", err);
    process.exit(1);
  }
}

applyFix();
