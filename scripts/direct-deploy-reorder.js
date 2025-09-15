#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function deployAndTest() {
  console.log("🚀 Deploying reorder_children function...\n");

  // First, let's check if there's an existing admin function we can use
  try {
    // Try using admin_exec_sql if it exists
    const { data: execResult, error: execError } = await supabase.rpc(
      "admin_exec_sql",
      {
        p_sql: `
        -- Drop and recreate the function to ensure it's properly registered
        DROP FUNCTION IF EXISTS public.reorder_children(UUID, JSONB);
        
        CREATE OR REPLACE FUNCTION public.reorder_children(
          p_parent_id UUID,
          p_child_orders JSONB
        )
        RETURNS JSONB
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
          v_child JSONB;
          v_updated_count INT := 0;
        BEGIN
          -- Validate input
          IF p_parent_id IS NULL OR p_child_orders IS NULL THEN
            RETURN jsonb_build_object(
              'success', false,
              'error', 'Missing required parameters'
            );
          END IF;

          -- Update each child's order
          FOR v_child IN SELECT * FROM jsonb_array_elements(p_child_orders)
          LOOP
            UPDATE profiles
            SET 
              sibling_order = (v_child->>'new_order')::INT,
              updated_at = NOW()
            WHERE 
              id = (v_child->>'id')::UUID
              AND (father_id = p_parent_id OR mother_id = p_parent_id)
              AND sibling_order != (v_child->>'new_order')::INT;
              
            IF FOUND THEN
              v_updated_count := v_updated_count + 1;
            END IF;
          END LOOP;

          RETURN jsonb_build_object(
            'success', true,
            'updated_count', v_updated_count
          );
        EXCEPTION WHEN OTHERS THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
          );
        END;
        $$;

        -- Grant permissions
        GRANT EXECUTE ON FUNCTION public.reorder_children TO anon;
        GRANT EXECUTE ON FUNCTION public.reorder_children TO authenticated;
      `,
      },
    );

    if (!execError) {
      console.log("✅ Function deployed via admin_exec_sql\n");
    } else {
      console.log(
        "⚠️  admin_exec_sql not available, trying alternative method...\n",
      );
    }
  } catch (err) {
    console.log("⚠️  Could not use admin function, but that's okay\n");
  }

  // Wait a moment for schema cache to update
  console.log("⏳ Waiting for schema cache to update...\n");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Now test if the function is available
  console.log("🧪 Testing reorder_children function...\n");

  try {
    const { data, error } = await supabase.rpc("reorder_children", {
      p_parent_id: "00000000-0000-0000-0000-000000000000",
      p_child_orders: [],
    });

    if (error) {
      console.error("❌ Function test failed:", error.message);
      console.log("\n🔧 Troubleshooting tips:");
      console.log("1. Try refreshing the Supabase dashboard");
      console.log(
        "2. Go to SQL Editor and run: SELECT reorder_children('00000000-0000-0000-0000-000000000000'::UUID, '[]'::JSONB);",
      );
      console.log(
        "3. If it works there, the function exists but API cache needs refresh",
      );
      console.log("4. You may need to restart your app or wait a few minutes");
    } else {
      console.log("✅ Function is working!");
      console.log("Response:", data);
      console.log("\n🎉 Success! The RPC function is now available.");
    }
  } catch (err) {
    console.error("Error testing function:", err);
  }

  // Also test with anon key to ensure it works from the app
  console.log("\n🧪 Testing with anon key (as the app would)...\n");

  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey) {
    const anonSupabase = createClient(supabaseUrl, anonKey);

    try {
      const { data, error } = await anonSupabase.rpc("reorder_children", {
        p_parent_id: "00000000-0000-0000-0000-000000000000",
        p_child_orders: [],
      });

      if (error) {
        console.error("❌ Anon key test failed:", error.message);
      } else {
        console.log("✅ Function works with anon key!");
        console.log("Response:", data);
      }
    } catch (err) {
      console.error("Error with anon key:", err);
    }
  }
}

deployAndTest();
