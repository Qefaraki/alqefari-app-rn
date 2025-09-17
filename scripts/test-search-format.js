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

async function testSearchFormat() {
  console.log("Testing search result format...\n");

  const { data, error } = await supabase.rpc("search_name_chain", {
    p_names: ["محمد"],
    p_limit: 3,
    p_offset: 0,
  });

  if (error) {
    console.error("Search error:", error);
    return;
  }

  console.log(`Found ${data?.length || 0} results\n`);

  if (data && data.length > 0) {
    console.log("First result structure:");
    console.log(JSON.stringify(data[0], null, 2));

    console.log("\n\nAll results summary:");
    data.forEach((result, i) => {
      console.log(`${i + 1}. Name: ${result.name || "N/A"}`);
      console.log(`   Display Name: ${result.display_name || "N/A"}`);
      console.log(`   ID: ${result.id}`);
      console.log(`   HID: ${result.hid}`);
      console.log(
        `   Branch Path: ${result.branch_path?.join(" ← ") || "N/A"}`,
      );
      console.log("");
    });
  }
}

testSearchFormat().catch(console.error);
