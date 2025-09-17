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

async function analyzeSpouses() {
  console.log("Analyzing spouses in marriages...\n");

  // Get all marriages
  const { data: marriages } = await supabase.from("marriages").select("*");

  console.log(`Total marriages: ${marriages?.length || 0}\n`);

  if (!marriages || marriages.length === 0) {
    console.log("No marriages found");
    process.exit(0);
  }

  // Collect all spouse IDs
  const husbandIds = marriages.map((m) => m.husband_id).filter(Boolean);
  const wifeIds = marriages.map((m) => m.wife_id).filter(Boolean);
  const allSpouseIds = [...new Set([...husbandIds, ...wifeIds])];

  console.log(`Unique husbands: ${new Set(husbandIds).size}`);
  console.log(`Unique wives: ${new Set(wifeIds).size}`);
  console.log(`Total unique people in marriages: ${allSpouseIds.length}\n`);

  // Get profiles for all spouses
  const { data: spouseProfiles } = await supabase
    .from("profiles")
    .select("id, display_name, hid, gender")
    .in("id", allSpouseIds);

  console.log(`Found ${spouseProfiles?.length || 0} spouse profiles\n`);

  // Analyze by HID
  const byHID = {};
  const noHID = [];

  spouseProfiles?.forEach((profile) => {
    if (profile.hid) {
      const hidPrefix = profile.hid.substring(0, 4); // Get first 4 chars of HID
      byHID[hidPrefix] = (byHID[hidPrefix] || 0) + 1;
    } else {
      noHID.push(profile);
    }
  });

  console.log("Spouses grouped by HID prefix:");
  Object.entries(byHID)
    .sort((a, b) => b[1] - a[1])
    .forEach(([prefix, count]) => {
      console.log(`  HID starts with "${prefix}": ${count} people`);
    });

  console.log(`\nSpouses with NO HID: ${noHID.length}`);
  if (noHID.length > 0) {
    console.log("These are the TRUE Munasib (married into family):");
    noHID.slice(0, 10).forEach((p) => {
      console.log(`  - ${p.display_name} (${p.gender})`);
    });
  }

  // Now let's see who the no-HID people married
  if (noHID.length > 0) {
    const noHIDIds = noHID.map((p) => p.id);

    // Find marriages involving no-HID people
    const { data: munasibMarriages } = await supabase
      .from("marriages")
      .select("*")
      .or(
        `husband_id.in.(${noHIDIds.join(",")}),wife_id.in.(${noHIDIds.join(",")})`,
      );

    console.log(
      `\nMarriages involving no-HID people: ${munasibMarriages?.length || 0}`,
    );

    // Get the Alqefari family members they married
    const alqefariSpouseIds = [];
    munasibMarriages?.forEach((m) => {
      if (noHIDIds.includes(m.husband_id)) {
        alqefariSpouseIds.push(m.wife_id);
      } else {
        alqefariSpouseIds.push(m.husband_id);
      }
    });

    const { data: alqefariSpouses } = await supabase
      .from("profiles")
      .select("id, display_name, hid")
      .in("id", alqefariSpouseIds);

    console.log(
      `\nAlqefari family members married to outsiders: ${alqefariSpouses?.length || 0}`,
    );
    alqefariSpouses?.slice(0, 5).forEach((p) => {
      console.log(`  - ${p.display_name} (HID: ${p.hid})`);
    });
  }

  process.exit(0);
}

analyzeSpouses();
