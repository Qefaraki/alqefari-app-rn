const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  console.log(
    "Make sure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixUserRoles() {
  console.log("Fixing user_roles references...");

  // First, check if user_roles table exists
  const { data: tables, error: tablesError } = await supabase
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_name", "user_roles");

  if (tables && tables.length > 0) {
    console.log("user_roles table exists, migrating data...");

    // Migrate any existing user_roles to profiles.role
    const { error: migrateError } = await supabase.rpc("admin_execute_sql", {
      p_sql: `
        UPDATE profiles p
        SET role = ur.role
        FROM user_roles ur
        WHERE p.id = ur.user_id
        AND p.role IS NULL;
      `,
    });

    if (migrateError) {
      console.error("Migration error:", migrateError);
    }
  }

  // Now update all functions to use profiles.role instead of user_roles
  console.log("Updating admin functions...");

  const functions = [
    "admin_get_statistics",
    "admin_validation_dashboard",
    "admin_auto_fix_issues",
  ];

  for (const funcName of functions) {
    console.log(`Checking ${funcName}...`);

    // Get function definition
    const { data: funcDef, error: funcError } = await supabase
      .rpc("admin_execute_sql", {
        p_sql: `
        SELECT pg_get_functiondef(oid) as definition
        FROM pg_proc
        WHERE proname = '${funcName}'
        LIMIT 1;
      `,
      })
      .single();

    if (funcError) {
      console.log(`Function ${funcName} might not exist or can't be accessed`);
      continue;
    }

    if (
      funcDef &&
      funcDef.definition &&
      funcDef.definition.includes("user_roles")
    ) {
      console.log(`Updating ${funcName} to use profiles.role...`);

      // Replace user_roles references
      const newDef = funcDef.definition
        .replace(/FROM user_roles ur/g, "FROM profiles")
        .replace(/WHERE ur\.user_id = auth\.uid\(\)/g, "WHERE id = auth.uid()")
        .replace(/AND ur\.role = 'admin'/g, "AND role = 'admin'");

      const { error: updateError } = await supabase.rpc("admin_execute_sql", {
        p_sql: newDef,
      });

      if (updateError) {
        console.error(`Error updating ${funcName}:`, updateError);
      } else {
        console.log(`✓ Updated ${funcName}`);
      }
    }
  }

  console.log("Fix completed!");
}

fixUserRoles().catch(console.error);
