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

async function checkMarriagesData() {
  console.log("Checking marriages data structure...\n");

  // 1. Check marriages table
  const { data: marriages, error: e1 } = await supabase
    .from("marriages")
    .select("*")
    .limit(5);

  console.log(`Sample marriages (${marriages?.length || 0} shown):`, marriages);

  // 2. Count total marriages
  const { count: marriageCount } = await supabase
    .from("marriages")
    .select("*", { count: "exact", head: true });

  console.log(`\nTotal marriages in database: ${marriageCount}`);

  // 3. Check marriages with munasib field
  const { data: munasibMarriages, count: munasibCount } = await supabase
    .from("marriages")
    .select("id, munasib", { count: "exact" })
    .not("munasib", "is", null);

  console.log(`\nMarriages with munasib field filled: ${munasibCount || 0}`);
  if (munasibMarriages && munasibMarriages.length > 0) {
    console.log("Sample munasib values:", munasibMarriages.slice(0, 5));
  }

  // 4. Check spouse profiles with HID = 2000
  const { data: spousesHID2000 } = await supabase
    .from("profiles")
    .select("id, display_name, hid")
    .eq("hid", "2000");

  console.log(`\nProfiles with HID = 2000: ${spousesHID2000?.length || 0}`);
  if (spousesHID2000 && spousesHID2000.length > 0) {
    console.log("Sample:", spousesHID2000.slice(0, 3));
  }

  // 5. Check if profiles are linked in marriages
  if (marriages && marriages.length > 0) {
    const spouseIds = new Set();
    marriages.forEach((m) => {
      if (m.husband_id) spouseIds.add(m.husband_id);
      if (m.wife_id) spouseIds.add(m.wife_id);
      if (m.spouse1_id) spouseIds.add(m.spouse1_id);
      if (m.spouse2_id) spouseIds.add(m.spouse2_id);
    });

    console.log(`\nUnique people in marriages: ${spouseIds.size}`);

    // Get their profiles
    const { data: marriedProfiles } = await supabase
      .from("profiles")
      .select("id, display_name, hid")
      .in("id", Array.from(spouseIds))
      .order("hid");

    // Group by HID
    const byHID = {};
    marriedProfiles?.forEach((p) => {
      const hid = p.hid || "NULL";
      byHID[hid] = (byHID[hid] || 0) + 1;
    });

    console.log("\nMarried people by HID:");
    Object.entries(byHID).forEach(([hid, count]) => {
      console.log(`  HID ${hid}: ${count} people`);
    });
  }

  process.exit(0);
}

checkMarriagesData();
