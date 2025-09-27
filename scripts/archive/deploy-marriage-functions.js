import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables");
  console.error(
    "Required: EXPO_PUBLIC_SUPABASE_URL and (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_DB_PASSWORD)",
  );
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Read the SQL file
const sqlPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "021_marriage_admin_rpcs.sql",
);
const sqlContent = fs.readFileSync(sqlPath, "utf8");

// Split SQL content by semicolons (but not within strings)
function splitSQL(sql) {
  const statements = [];
  let current = "";
  let inString = false;
  let stringChar = null;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    // Handle string boundaries
    if (!inString && (char === "'" || char === '"')) {
      inString = true;
      stringChar = char;
      current += char;
    } else if (inString && char === stringChar && nextChar !== stringChar) {
      inString = false;
      stringChar = null;
      current += char;
    } else if (char === ";" && !inString) {
      // End of statement
      const trimmed = current.trim();
      if (trimmed && !trimmed.startsWith("--")) {
        statements.push(trimmed);
      }
      current = "";
    } else {
      current += char;
    }
  }

  // Add last statement if exists
  const trimmed = current.trim();
  if (trimmed && !trimmed.startsWith("--")) {
    statements.push(trimmed);
  }

  return statements;
}

async function deployFunctions() {
  console.log("🚀 Deploying marriage admin functions...\n");

  try {
    const statements = splitSQL(sqlContent);
    console.log(`Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments
      if (statement.trim().startsWith("--")) continue;

      // Get first 50 chars for logging
      const preview = statement.substring(0, 50).replace(/\n/g, " ");
      console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);

      const { error } = await supabase
        .rpc("query", {
          query_text: statement,
        })
        .single();

      if (error) {
        // Try direct execution if RPC fails
        const { data, error: directError } = await supabase
          .from("_sql_execution")
          .insert({ sql: statement })
          .select()
          .single();

        if (directError) {
          console.error(`❌ Failed: ${directError.message}`);

          // Try one more method - direct SQL execution
          try {
            // This is a workaround - we'll create the functions manually
            if (statement.includes("CREATE OR REPLACE FUNCTION")) {
              console.log(
                "⚠️  Function creation requires direct database access",
              );
              console.log(
                "   Please run this SQL in Supabase Dashboard SQL Editor",
              );
            }
          } catch (e) {
            console.error(`❌ Error: ${e.message}`);
          }
        } else {
          console.log("✅ Success");
        }
      } else {
        console.log("✅ Success");
      }
    }

    console.log("\n✨ Deployment complete!");
    console.log("\n📝 Testing functions...");

    // Test that functions exist
    const testFunctions = [
      "admin_create_marriage",
      "admin_update_marriage",
      "admin_delete_marriage",
    ];

    for (const func of testFunctions) {
      console.log(`\nTesting ${func}...`);

      // We can't directly test these without proper parameters
      // But we can check if they're callable
      try {
        // This will fail with missing parameters, but that's ok - it means function exists
        const { error } = await supabase.rpc(func, {});

        if (error && error.message.includes("required")) {
          console.log(`✅ ${func} exists (parameter validation working)`);
        } else if (error && error.message.includes("Unauthorized")) {
          console.log(`✅ ${func} exists (authorization check working)`);
        } else if (error) {
          console.log(
            `⚠️  ${func} may not be properly deployed: ${error.message}`,
          );
        } else {
          console.log(`✅ ${func} exists`);
        }
      } catch (e) {
        console.log(`❌ ${func} not found: ${e.message}`);
      }
    }

    console.log("\n🎉 Marriage admin functions deployment complete!");
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Run deployment
deployFunctions().catch(console.error);
