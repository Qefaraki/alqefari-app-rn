import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFunction() {
  console.log("Checking if admin_get_enhanced_statistics function exists...\n");

  // Try to call it directly without auth to see the error
  const { data, error } = await supabase.rpc("admin_get_enhanced_statistics");

  if (error) {
    if (error.message.includes("Unauthorized")) {
      console.log("✓ Function exists! (Got authorization error as expected)");
      console.log("  The function requires admin authentication to run.\n");
    } else if (error.message.includes("Could not find")) {
      console.log("✗ Function does not exist yet");
      console.log("  Need to deploy the function to Supabase.\n");
    } else {
      console.log("? Unexpected error:", error.message);
    }
  } else {
    console.log("✓ Function exists and returned data!");
    console.log("  Data:", JSON.stringify(data, null, 2));
  }

  // Also check the old function
  console.log("\nChecking old admin_get_statistics function...");
  const { error: oldError } = await supabase.rpc("admin_get_statistics");

  if (oldError) {
    if (oldError.message.includes("Unauthorized")) {
      console.log("✓ Old function exists");
    } else if (oldError.message.includes("Could not find")) {
      console.log("✗ Old function does not exist");
    } else {
      console.log("? Unexpected error:", oldError.message);
    }
  }

  process.exit(0);
}

checkFunction();
