require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.NEXT_PUBLIC_alqefariSUPABASE_ANON_KEY,
);

async function debugNameChain() {
  console.log("=== DEBUGGING NAME CHAIN SEARCH ===\n");

  // First, let's see what columns the function actually returns
  console.log("1. Testing what the function returns...");

  const { data, error } = await supabase.rpc("search_profiles_by_name_chain", {
    p_name_chain: "محمد",
  });

  if (error) {
    console.error("Error calling function:", error);
    return;
  }

  if (data && data.length > 0) {
    console.log("\nFirst result structure:");
    console.log("Available fields:", Object.keys(data[0]));
    console.log("\nFirst result data:");
    console.log(JSON.stringify(data[0], null, 2));

    // Now let's manually build a name chain for comparison
    console.log("\n2. Manually building name chain for comparison...");

    const profile = data[0];
    if (profile.id) {
      // Get the full profile with ancestors
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profile.id)
        .single();

      if (profileData) {
        console.log("\nProfile name:", profileData.name);
        console.log("Profile father_id:", profileData.father_id);

        // Try to build chain manually
        let currentId = profileData.father_id;
        let chain = [profileData.name];
        let depth = 0;

        while (currentId && depth < 10) {
          const { data: parent } = await supabase
            .from("profiles")
            .select("id, name, father_id")
            .eq("id", currentId)
            .single();

          if (parent) {
            chain.push(parent.name);
            currentId = parent.father_id;
            depth++;
          } else {
            break;
          }
        }

        chain.push("القفاري");
        const manualChain = chain.join(" ");

        console.log("\nManually built chain:", manualChain);
        console.log("Function returned chain:", profile.full_chain);
        console.log("Are they the same?", manualChain === profile.full_chain);
      }
    }

    // Check if the issue is in the frontend
    console.log("\n3. Checking what phoneAuthService expects...");
    console.log("The function returns these fields:", Object.keys(data[0]));
    console.log(
      "The frontend expects: id, name, full_chain, generation, has_auth, match_quality, match_score, etc.",
    );
  } else {
    console.log("No results returned");
  }
}

debugNameChain();
