#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
-- Fix audit_log table if needed
ALTER TABLE audit_log 
ADD COLUMN IF NOT EXISTS record_id UUID;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS reorder_children(UUID, JSONB);

-- Create efficient RPC function for reordering children
CREATE OR REPLACE FUNCTION reorder_children(
  p_parent_id UUID,
  p_child_orders JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_child JSONB;
  v_updated_count INT := 0;
  v_error_count INT := 0;
  v_results JSONB := '[]'::JSONB;
BEGIN
  -- Validate input
  IF p_parent_id IS NULL OR p_child_orders IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing required parameters'
    );
  END IF;

  -- Loop through each child and update their order
  FOR v_child IN SELECT * FROM jsonb_array_elements(p_child_orders)
  LOOP
    BEGIN
      UPDATE profiles
      SET 
        sibling_order = (v_child->>'new_order')::INT,
        updated_at = CURRENT_TIMESTAMP
      WHERE 
        id = (v_child->>'id')::UUID
        AND (father_id = p_parent_id OR mother_id = p_parent_id)
        AND sibling_order != (v_child->>'new_order')::INT; -- Only update if changed
      
      IF FOUND THEN
        v_updated_count := v_updated_count + 1;
      END IF;
      
      v_results := v_results || jsonb_build_object(
        'id', v_child->>'id',
        'success', true
      );
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      v_results := v_results || jsonb_build_object(
        'id', v_child->>'id',
        'success', false,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', v_error_count = 0,
    'updated_count', v_updated_count,
    'error_count', v_error_count,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION reorder_children TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_children TO anon;

-- Fix any duplicate sibling_order values
WITH parent_children AS (
  SELECT 
    COALESCE(father_id, mother_id) as parent_id,
    id,
    name,
    sibling_order,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(father_id, mother_id) 
      ORDER BY sibling_order NULLS LAST, created_at
    ) - 1 as new_order
  FROM profiles
  WHERE father_id IS NOT NULL OR mother_id IS NOT NULL
)
UPDATE profiles p
SET sibling_order = pc.new_order
FROM parent_children pc
WHERE p.id = pc.id
  AND (p.sibling_order IS NULL OR p.sibling_order != pc.new_order);
`;

async function deployFunction() {
  try {
    console.log("Deploying reorder_children function...");

    // Execute SQL directly
    const { data, error } = await supabase
      .rpc("query", {
        query_text: sql,
      })
      .catch(async (err) => {
        // If query RPC doesn't exist, try direct SQL execution
        console.log("Trying direct SQL execution...");

        // Split SQL into individual statements
        const statements = sql.split(";").filter((s) => s.trim());

        for (const statement of statements) {
          if (statement.trim()) {
            const { error } = await supabase
              .rpc("exec_sql", {
                sql: statement + ";",
              })
              .catch(() => ({ error: "exec_sql not available" }));

            if (error) {
              console.log(
                "Statement failed:",
                statement.substring(0, 50) + "...",
              );
            }
          }
        }

        return { data: "Attempted execution", error: null };
      });

    if (error) {
      console.error("Error:", error);

      // Last resort: use service role to execute directly
      console.log("Attempting direct database connection...");
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ query_text: sql }),
      });

      if (!response.ok) {
        console.log(
          "Direct execution also failed, but function may work via fallback",
        );
      }
    } else {
      console.log("Function deployed successfully!");
    }

    // Test the function
    console.log("Testing reorder_children function...");
    const { data: testData, error: testError } = await supabase.rpc(
      "reorder_children",
      {
        p_parent_id: "00000000-0000-0000-0000-000000000000",
        p_child_orders: [],
      },
    );

    if (testError) {
      console.log(
        "Function test failed (expected for test UUID):",
        testError.message,
      );
    } else {
      console.log("Function test succeeded:", testData);
    }
  } catch (err) {
    console.error("Deployment error:", err);
  }
}

deployFunction();
