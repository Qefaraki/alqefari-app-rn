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

async function debugSearchNode() {
  const targetId = "ae91d122-165e-4284-ad0a-c6a6b2748591";
  const targetHid = "1.2.6.2.3.2.1";

  console.log("Debugging search node issue...\n");
  console.log("Target node:");
  console.log("  ID:", targetId);
  console.log("  HID:", targetHid);

  // 1. Check if the node exists in profiles
  console.log("\n1. Checking if node exists in profiles table...");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", targetId)
    .single();

  if (profileError) {
    console.log("  ❌ Node not found in profiles:", profileError.message);
  } else {
    console.log("  ✅ Node found in profiles:");
    console.log("    Name:", profile.name);
    console.log("    HID:", profile.hid);
    console.log("    Father ID:", profile.father_id);
  }

  // 2. Test get_branch_data with the HID
  console.log("\n2. Testing get_branch_data with HID", targetHid);
  const { data: branchData, error: branchError } = await supabase.rpc(
    "get_branch_data",
    {
      p_hid: targetHid,
      p_max_depth: 2,
      p_limit: 10,
    },
  );

  if (branchError) {
    console.log("  ❌ Branch data error:", branchError);
  } else {
    console.log(`  ✅ Branch returned ${branchData?.length || 0} nodes`);
    if (branchData && branchData.length > 0) {
      const hasTarget = branchData.some((n) => n.id === targetId);
      console.log(`  Target node in results: ${hasTarget ? "✅" : "❌"}`);

      // Show the HIDs returned
      console.log("  HIDs returned:", branchData.map((n) => n.hid).slice(0, 5));
    }
  }

  // 3. Load from root with depth 9 like the app does
  console.log("\n3. Loading from root with depth 9 (like the search does)...");

  // First get root
  const { data: rootData, error: rootError } = await supabase.rpc(
    "get_branch_data",
    {
      p_hid: null,
      p_max_depth: 1,
      p_limit: 1,
    },
  );

  if (rootError || !rootData || rootData.length === 0) {
    console.log("  ❌ Could not get root");
    return;
  }

  const rootHid = rootData[0].hid;
  console.log("  Root HID:", rootHid);

  // Load with depth 9
  const { data: fullTree, error: treeError } = await supabase.rpc(
    "get_branch_data",
    {
      p_hid: rootHid,
      p_max_depth: 9,
      p_limit: 500,
    },
  );

  if (treeError) {
    console.log("  ❌ Tree load error:", treeError);
  } else {
    console.log(`  ✅ Loaded ${fullTree?.length || 0} nodes`);

    if (fullTree && fullTree.length > 0) {
      const hasTarget = fullTree.some((n) => n.id === targetId);
      console.log(`  Target node in tree: ${hasTarget ? "✅" : "❌"}`);

      // Check depth distribution
      const depthCounts = {};
      fullTree.forEach((n) => {
        const depth = n.hid.split(".").length;
        depthCounts[depth] = (depthCounts[depth] || 0) + 1;
      });

      console.log("\n  Depth distribution:");
      Object.keys(depthCounts)
        .sort((a, b) => a - b)
        .forEach((depth) => {
          console.log(`    Depth ${depth}: ${depthCounts[depth]} nodes`);
        });

      // Find nodes at depth 7 (same as target)
      const depth7Nodes = fullTree.filter((n) => n.hid.split(".").length === 7);
      console.log(`\n  Nodes at depth 7: ${depth7Nodes.length}`);
      if (depth7Nodes.length > 0 && depth7Nodes.length <= 10) {
        depth7Nodes.forEach((n) => {
          console.log(`    ${n.hid}: ${n.name}`);
        });
      }
    }
  }

  // 4. Check the actual path to this node
  console.log("\n4. Checking the path to target node...");
  if (profile) {
    let currentId = profile.father_id;
    let depth = 1;
    const path = [profile.name];

    while (currentId && depth < 10) {
      const { data: parent } = await supabase
        .from("profiles")
        .select("id, name, father_id, hid")
        .eq("id", currentId)
        .single();

      if (parent) {
        path.unshift(parent.name);
        console.log(`  Depth ${depth}: ${parent.name} (HID: ${parent.hid})`);
        currentId = parent.father_id;
      } else {
        break;
      }
      depth++;
    }

    console.log("\n  Full path:", path.join(" ← "));
  }
}

debugSearchNode().catch(console.error);
