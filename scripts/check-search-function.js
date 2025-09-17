import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSearchFunctions() {
  console.log("Checking search functions in database...\n");

  // Query to find all functions with 'search' in the name
  const { data, error } = await supabase
    .from("pg_proc")
    .select("proname")
    .ilike("proname", "%search%");

  if (error) {
    // Try a different approach - query the information schema
    console.log("Trying alternative query...");

    const sql = `
      SELECT routine_name, routine_schema, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name ILIKE '%search%'
    `;

    const { data: funcData, error: funcError } = await supabase
      .from("profiles")
      .select("id")
      .limit(0); // Just to test connection

    if (funcError) {
      console.error("Connection error:", funcError);
    } else {
      console.log("Connection works, but cannot query function list directly");
    }
  } else {
    console.log("Found functions:", data);
  }

  // Try calling the function directly with different signatures
  console.log("\nTrying different function signatures...\n");

  // Try 1: Single text parameter
  console.log("1. Trying search_name_chain(TEXT)...");
  const { data: data1, error: error1 } = await supabase.rpc(
    "search_name_chain",
    { p_search_term: "محمد" },
  );

  if (error1) {
    console.log("   Error:", error1.message);
  } else {
    console.log("   Success! Found", data1?.length || 0, "results");
  }

  // Try 2: Array parameter
  console.log("\n2. Trying search_name_chain(TEXT[])...");
  const { data: data2, error: error2 } = await supabase.rpc(
    "search_name_chain",
    { p_names: ["محمد"] },
  );

  if (error2) {
    console.log("   Error:", error2.message);
  } else {
    console.log("   Success! Found", data2?.length || 0, "results");
  }

  // Try 3: Multiple parameters
  console.log("\n3. Trying search_name_chain(TEXT[], INT, INT)...");
  const { data: data3, error: error3 } = await supabase.rpc(
    "search_name_chain",
    {
      p_names: ["محمد"],
      p_limit: 20,
      p_offset: 0,
    },
  );

  if (error3) {
    console.log("   Error:", error3.message);
  } else {
    console.log("   Success! Found", data3?.length || 0, "results");
    if (data3 && data3.length > 0) {
      console.log("   First result:", data3[0].display_name);
    }
  }
}

checkSearchFunctions().catch(console.error);
