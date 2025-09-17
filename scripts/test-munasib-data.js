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

async function testMunasibData() {
  console.log("Testing Munasib (married-in family) data...\n");

  // 1. Check profiles without HID
  const { data: noHidProfiles, error: e1 } = await supabase
    .from("profiles")
    .select("id, display_name, gender, hid")
    .is("hid", null);

  console.log(`Profiles without HID: ${noHidProfiles?.length || 0}`);

  // 2. Check marriages
  const { data: marriages, error: e2 } = await supabase
    .from("marriages")
    .select("id, spouse1_id, spouse2_id");

  console.log(`Total marriages: ${marriages?.length || 0}`);

  // 3. Find profiles without HID that are in marriages (Munasib)
  if (marriages && marriages.length > 0) {
    const marriageSpouseIds = new Set();
    marriages.forEach((m) => {
      if (m.spouse1_id) marriageSpouseIds.add(m.spouse1_id);
      if (m.spouse2_id) marriageSpouseIds.add(m.spouse2_id);
    });

    console.log(`\nUnique people in marriages: ${marriageSpouseIds.size}`);

    // Get details of married people without HID
    const { data: munasibPeople } = await supabase
      .from("profiles")
      .select("id, display_name, gender, hid")
      .is("hid", null)
      .in("id", Array.from(marriageSpouseIds));

    console.log(
      `\nMunasib (married-in without HID): ${munasibPeople?.length || 0}`,
    );

    if (munasibPeople && munasibPeople.length > 0) {
      console.log("\nTop 5 Munasib people:");
      munasibPeople.slice(0, 5).forEach((p) => {
        console.log(`- ${p.display_name} (${p.gender})`);
      });

      // Group by family name (last name)
      const familyCounts = {};
      munasibPeople.forEach((person) => {
        const nameParts = person.display_name?.split(" ") || [];
        const familyName = nameParts[nameParts.length - 1] || "غير محدد";
        familyCounts[familyName] = (familyCounts[familyName] || 0) + 1;
      });

      const sortedFamilies = Object.entries(familyCounts).sort(
        (a, b) => b[1] - a[1],
      );

      console.log("\nTop families married into Alqefari:");
      sortedFamilies.slice(0, 5).forEach(([name, count], i) => {
        const percentage = ((count / munasibPeople.length) * 100).toFixed(1);
        console.log(`${i + 1}. ${name}: ${count} people (${percentage}%)`);
      });
    }
  }

  // 4. Check if we have people WITH HID in marriages (should be Alqefari family)
  const { data: alqefariMarried } = await supabase
    .from("profiles")
    .select("id, display_name, hid")
    .not("hid", "is", null)
    .in(
      "id",
      marriages?.flatMap((m) => [m.spouse1_id, m.spouse2_id].filter(Boolean)) ||
        [],
    );

  console.log(
    `\nAlqefari family members in marriages: ${alqefariMarried?.length || 0}`,
  );

  process.exit(0);
}

testMunasibData();
