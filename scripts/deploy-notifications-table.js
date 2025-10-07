const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
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

async function deployNotificationsTable() {
  console.log("Deploying notifications table system...\n");

  try {
    // Read the migration SQL
    const sqlPath = path.join(__dirname, "..", "migrations", "016_create_notifications_system.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    console.log("Executing SQL migration...");

    // Execute the SQL via Supabase client
    // We need to split the SQL into individual statements and execute them
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error("Error executing SQL:", error.message);

      // Try alternative: execute via REST API
      console.log("\nTrying alternative method via REST API...");
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ query_text: sql })
      });

      if (response.ok) {
        console.log("✅ Migration deployed successfully via REST API!");
      } else {
        const errorText = await response.text();
        console.error("REST API failed:", errorText);

        // Final fallback: provide manual instructions
        console.log("\n⚠️  Automatic deployment failed. Manual deployment required:");
        console.log("1. Go to Supabase Dashboard → SQL Editor");
        console.log("2. Copy the contents of migrations/016_create_notifications_system.sql");
        console.log("3. Paste and run in SQL Editor");
        console.log("\nThe SQL file is ready at: migrations/016_create_notifications_system.sql");
        process.exit(1);
      }
    } else {
      console.log("✅ Migration deployed successfully!");
    }

    // Verify the table exists
    console.log("\nVerifying deployment...");
    const { data: tableCheck, error: checkError } = await supabase
      .from('notifications')
      .select('*')
      .limit(1);

    if (checkError && checkError.code === '42P01') {
      console.error("❌ Table 'notifications' not found. Deployment may have failed.");
      console.log("\n📋 Manual deployment required:");
      console.log("Copy migrations/016_create_notifications_system.sql to Supabase Dashboard → SQL Editor");
      process.exit(1);
    } else if (checkError) {
      console.warn("⚠️  Table verification inconclusive:", checkError.message);
    } else {
      console.log("✅ Table 'notifications' exists and is accessible!");
    }

    // Check for helper functions
    console.log("\nVerifying functions...");
    const { data: funcTest, error: funcError } = await supabase
      .rpc('get_unread_notification_count', { p_user_id: '00000000-0000-0000-0000-000000000000' });

    if (funcError && funcError.code === '42883') {
      console.error("❌ Function 'get_unread_notification_count' not found");
      console.log("This may indicate partial deployment. Please run SQL manually.");
      process.exit(1);
    } else if (funcError) {
      console.warn("⚠️  Function test inconclusive:", funcError.message);
    } else {
      console.log("✅ Helper functions deployed successfully!");
    }

    console.log("\n🎉 Notifications system fully deployed!");
    console.log("\nNext steps:");
    console.log("1. Restart your Expo app");
    console.log("2. Badge subscription errors should be resolved");
    console.log("3. Test by creating a profile link request");

  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

deployNotificationsTable();
