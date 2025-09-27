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

const searchWrapperSQL = `
-- Create a simple wrapper function that takes a single search term
-- and splits it into an array for the main search function
CREATE OR REPLACE FUNCTION search_name_chain(
  p_search_term TEXT
) RETURNS TABLE (
  id UUID,
  hid TEXT,
  name VARCHAR(255),
  display_name TEXT,
  parent_id UUID,
  generation INT,
  birth_year_hijri INT,
  branch_path TEXT[]
) AS $$
BEGIN
  -- Clean and split the search term
  -- Remove "بن" prefix if present and split by spaces
  DECLARE
    cleaned_term TEXT;
    search_names TEXT[];
  BEGIN
    -- Remove leading "بن" if present
    cleaned_term := TRIM(p_search_term);
    IF cleaned_term LIKE 'بن %' THEN
      cleaned_term := SUBSTRING(cleaned_term FROM 4);
    END IF;
    
    -- Split by spaces to get individual names
    search_names := string_to_array(TRIM(cleaned_term), ' ');
    
    -- Call the main search function with the array
    RETURN QUERY
    SELECT * FROM search_name_chain(search_names, 20, 0);
  END;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_name_chain(TEXT) TO anon, authenticated;
`;

async function deploySearchWrapper() {
  console.log("Deploying search wrapper function...\n");

  try {
    // Deploy via RPC
    const { data, error } = await supabase.rpc("execute_sql", {
      sql: searchWrapperSQL,
    });

    if (error) {
      console.error("Error deploying search wrapper:", error);
      return;
    }

    console.log("✅ Search wrapper function deployed successfully");

    // Test the wrapper
    console.log("\nTesting search wrapper...");
    const { data: testResults, error: testError } = await supabase.rpc(
      "search_name_chain",
      { p_search_term: "محمد" },
    );

    if (testError) {
      console.error("Test error:", testError);
    } else {
      console.log(`Found ${testResults?.length || 0} results`);
      if (testResults && testResults.length > 0) {
        console.log("First result:", testResults[0].display_name);
      }
    }
  } catch (err) {
    console.error("Deployment failed:", err);
  }
}

deploySearchWrapper();
