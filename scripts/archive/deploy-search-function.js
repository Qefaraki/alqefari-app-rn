const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  console.error("URL:", supabaseUrl ? "Found" : "Missing");
  console.error("Service Key:", supabaseServiceKey ? "Found" : "Missing");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function deploySearchFunction() {
  try {
    console.log("Deploying Arabic name chain search function...");

    // Read the SQL file
    const sqlPath = path.join(
      __dirname,
      "..",
      "supabase",
      "migrations",
      "036_create_name_chain_search.sql",
    );
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    // Split SQL into individual statements
    const statements = sqlContent
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ";";
      console.log(`\nExecuting statement ${i + 1}/${statements.length}...`);

      // Extract first few words for logging
      const preview = statement.substring(0, 50).replace(/\n/g, " ");
      console.log(`Preview: ${preview}...`);

      const { data, error } = await supabase.rpc("admin_execute_sql", {
        p_sql: statement,
      });

      if (error) {
        // Try alternative approach
        const { data: data2, error: error2 } = await supabase
          .from("_sql_executor")
          .insert({ sql: statement })
          .select();

        if (error2) {
          console.error(`Error executing statement ${i + 1}:`, error2.message);
          throw error2;
        }
      }

      console.log(`✓ Statement ${i + 1} executed successfully`);
    }

    console.log("\n✅ Search function deployed successfully!");

    // Test the function
    console.log("\nTesting search function...");
    const { data: testData, error: testError } = await supabase.rpc(
      "search_name_chain",
      {
        p_names: ["محمد"],
        p_limit: 5,
      },
    );

    if (testError) {
      console.error("Test failed:", testError.message);
    } else {
      console.log(
        `✓ Search function working! Found ${testData?.length || 0} results for "محمد"`,
      );
    }
  } catch (error) {
    console.error("Deployment failed:", error.message);
    process.exit(1);
  }
}

deploySearchFunction();
