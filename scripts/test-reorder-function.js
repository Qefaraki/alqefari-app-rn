#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testReorderFunction() {
  console.log("Testing reorder_children function...");

  try {
    // Test with empty array (safe test)
    const { data, error } = await supabase.rpc("reorder_children", {
      p_parent_id: "00000000-0000-0000-0000-000000000000",
      p_child_orders: [],
    });

    if (error) {
      console.error("❌ Function call failed:", error.message);
      console.log("Function not available via RPC, app will use fallback");
    } else {
      console.log("✅ Function call succeeded!");
      console.log("Response:", data);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

testReorderFunction();
