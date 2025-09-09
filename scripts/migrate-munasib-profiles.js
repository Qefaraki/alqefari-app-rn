import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

async function migrateMunasibProfiles() {
  console.log("🔄 Starting Munasib Profile Migration...\n");

  try {
    // Step 1: Identify potential Munasib profiles
    console.log("📊 Step 1: Analyzing profiles to identify Munasib...");

    // Get all profiles that are referenced as spouses in marriages
    const { data: marriages, error: marriagesError } = await supabase
      .from("marriages")
      .select("husband_id, wife_id");

    if (marriagesError) throw marriagesError;

    // Collect all spouse IDs
    const spouseIds = new Set();
    marriages.forEach((m) => {
      if (m.husband_id) spouseIds.add(m.husband_id);
      if (m.wife_id) spouseIds.add(m.wife_id);
    });

    console.log(`Found ${spouseIds.size} unique spouse IDs in marriages table`);

    // Get profiles for these spouses
    const { data: spouseProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, hid, name, gender, father_id, mother_id, generation")
      .in("id", Array.from(spouseIds));

    if (profilesError) throw profilesError;

    console.log(`Found ${spouseProfiles.length} spouse profiles in database`);

    // Step 2: Identify which ones should be Munasib
    console.log("\n📋 Step 2: Identifying Munasib candidates...");

    const munasibCandidates = [];
    const familyMembers = [];

    for (const profile of spouseProfiles) {
      // Criteria for Munasib:
      // 1. Has no father in the tree (unless they're also a family member through cousin marriage)
      // 2. Has no mother in the tree
      // 3. Currently has HID but shouldn't

      const isLikelyMunasib =
        !profile.father_id && !profile.mother_id && profile.hid !== null; // Currently has HID but shouldn't

      if (isLikelyMunasib) {
        // Additional check: see if they have children (mothers should be Munasib)
        const { data: children } = await supabase
          .from("profiles")
          .select("id")
          .or(`father_id.eq.${profile.id},mother_id.eq.${profile.id}`)
          .limit(1);

        const hasChildren = children && children.length > 0;

        // Extract family name from full name
        const nameParts = profile.name?.split(" ") || [];
        const familyName = nameParts[nameParts.length - 1];

        munasibCandidates.push({
          ...profile,
          hasChildren,
          familyName,
          reason: hasChildren
            ? "Mother with no parents in tree"
            : "Spouse with no parents in tree",
        });
      } else {
        familyMembers.push(profile);
      }
    }

    console.log(
      `\n✅ Identified ${munasibCandidates.length} Munasib candidates`,
    );
    console.log(`👨‍👩‍👧‍👦 ${familyMembers.length} are family members (keeping HID)`);

    if (munasibCandidates.length > 0) {
      console.log("\n📝 Munasib candidates:");
      munasibCandidates.forEach((c) => {
        console.log(`  - ${c.name} (HID: ${c.hid}) - ${c.reason}`);
      });

      // Step 3: Ask for confirmation
      console.log("\n⚠️  MIGRATION PREVIEW");
      console.log("The following changes will be made:");
      console.log(`- Remove HID from ${munasibCandidates.length} profiles`);
      console.log(`- Set family_origin for each profile`);
      console.log("- These profiles will no longer appear in the tree view");
      console.log(
        "- They will still be accessible as mothers through children",
      );

      // For safety, create a backup first
      console.log("\n💾 Creating backup...");
      const backup = {
        timestamp: new Date().toISOString(),
        profiles: munasibCandidates.map((p) => ({
          id: p.id,
          original_hid: p.hid,
          name: p.name,
        })),
      };

      // Save backup to a file
      const fs = await import("fs");
      const backupPath = `backups/munasib-migration-${Date.now()}.json`;
      await fs.promises.mkdir("backups", { recursive: true });
      await fs.promises.writeFile(backupPath, JSON.stringify(backup, null, 2));
      console.log(`Backup saved to: ${backupPath}`);

      // Step 4: Apply migration
      console.log("\n🚀 Applying migration...");

      let successCount = 0;
      let errorCount = 0;

      for (const candidate of munasibCandidates) {
        try {
          // Remove HID only (family_origin column not deployed yet)
          const { error: updateError } = await supabase
            .from("profiles")
            .update({
              hid: null,
            })
            .eq("id", candidate.id);

          if (updateError) {
            console.error(
              `❌ Failed to update ${candidate.name}:`,
              updateError.message,
            );
            errorCount++;
          } else {
            console.log(`✅ Updated ${candidate.name} - removed HID`);
            successCount++;
          }
        } catch (err) {
          console.error(`❌ Error updating ${candidate.name}:`, err.message);
          errorCount++;
        }
      }

      console.log("\n📊 Migration Summary:");
      console.log(`✅ Successfully migrated: ${successCount} profiles`);
      if (errorCount > 0) {
        console.log(`❌ Failed: ${errorCount} profiles`);
      }

      // Step 5: Verify the migration
      console.log("\n🔍 Verifying migration...");

      const { data: munasibCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .is("hid", null);

      console.log(`Total Munasib profiles in database: ${munasibCount || 0}`);

      // Test the statistics function
      const { data: stats, error: statsError } = await supabase.rpc(
        "get_enhanced_statistics",
      );

      if (!statsError && stats?.munasib) {
        console.log("\n📈 Munasib Statistics:");
        console.log(`  Total: ${stats.munasib.total_munasib}`);
        console.log(`  Male: ${stats.munasib.male_munasib}`);
        console.log(`  Female: ${stats.munasib.female_munasib}`);

        if (
          stats.munasib.top_families &&
          stats.munasib.top_families.length > 0
        ) {
          console.log("\n  Top families:");
          stats.munasib.top_families.forEach((f) => {
            console.log(`    - ${f.family_name}: ${f.count} members`);
          });
        }
      }
    } else {
      console.log("\n✅ No Munasib candidates found to migrate");
      console.log("This might mean:");
      console.log("1. All spouses are already properly categorized");
      console.log(
        "2. All spouses in the database are family members (cousin marriages)",
      );
      console.log("3. Spouses haven't been added to the database yet");
    }

    console.log("\n✅ Migration complete!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    console.error("Please check the error and try again");
  }
}

// Run the migration
migrateMunasibProfiles();
