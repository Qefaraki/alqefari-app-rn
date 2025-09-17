require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.NEXT_PUBLIC_alqefariSUPABASE_ANON_KEY,
);

async function testProfileSearch() {
  console.log("Testing profile search function...\n");

  // Test with a sample name
  const testName = "محمد";

  console.log(`Searching for: ${testName}\n`);

  const { data, error } = await supabase.rpc("search_profiles_by_name_chain", {
    p_name_chain: testName,
  });

  if (error) {
    console.error("Error:", error);
    return;
  }

  if (data && data.length > 0) {
    console.log(`Found ${data.length} results:\n`);

    // Show first 3 results
    data.slice(0, 3).forEach((profile, index) => {
      console.log(`Result ${index + 1}:`);
      console.log(`  Name: ${profile.name}`);
      console.log(`  Full Chain: ${profile.full_chain}`);
      console.log(`  Generation: ${profile.generation}`);
      console.log(`  Match Score: ${profile.match_score}%`);
      console.log(`  Match Quality: ${profile.match_quality}`);
      console.log("---");
    });
  } else {
    console.log("No results found");
  }
}

testProfileSearch();
