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

async function testSearchAndNavigation() {
  console.log("Testing search and navigation flow...\n");

  // 1. Test search function
  console.log('1. Testing search for "محمد"...');
  const { data: searchResults, error: searchError } = await supabase.rpc(
    "search_name_chain",
    { p_search_term: "محمد" },
  );

  if (searchError) {
    console.error("Search error:", searchError);
    return;
  }

  console.log(`Found ${searchResults?.length || 0} results`);
  if (searchResults && searchResults.length > 0) {
    console.log("First 3 results:");
    searchResults.slice(0, 3).forEach((r) => {
      console.log(`  - ${r.display_name} (ID: ${r.id}, HID: ${r.hid})`);
    });
  }

  // 2. Test loading branch data for a result
  if (searchResults && searchResults.length > 0) {
    const testNode = searchResults[0];
    console.log(
      `\n2. Testing branch loading for "${testNode.display_name}" (HID: ${testNode.hid})...`,
    );

    const { data: branchData, error: branchError } = await supabase.rpc(
      "get_branch_data",
      {
        p_hid: testNode.hid,
        p_max_depth: 5,
        p_limit: 200,
      },
    );

    if (branchError) {
      console.error("Branch loading error:", branchError);
      return;
    }

    console.log(`Loaded ${branchData?.length || 0} nodes in branch`);

    // Check if the searched node is in the branch
    const nodeInBranch = branchData?.find((n) => n.id === testNode.id);
    console.log(
      `Target node ${nodeInBranch ? "IS" : "IS NOT"} in loaded branch`,
    );

    if (nodeInBranch) {
      console.log("Node details:", {
        name: nodeInBranch.name,
        id: nodeInBranch.id,
        hid: nodeInBranch.hid,
        parent_id: nodeInBranch.parent_id,
      });
    }
  }

  console.log("\n✅ Search and navigation test complete");
}

testSearchAndNavigation().catch(console.error);
