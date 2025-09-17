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

async function testEnhancedStats() {
  console.log("Testing enhanced statistics function...\n");

  // First sign in as admin (حصة)
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: "hesah@example.com",
      password: "hesah123",
    });

  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  console.log("✓ Signed in as admin\n");

  // Call the enhanced statistics function
  const { data: stats, error: statsError } = await supabase.rpc(
    "admin_get_enhanced_statistics",
  );

  if (statsError) {
    console.error("Error calling enhanced stats:", statsError);
    return;
  }

  console.log("✓ Enhanced statistics retrieved successfully!\n");

  // Display basic stats
  console.log("📊 Basic Statistics:");
  console.log(`   Total profiles: ${stats.basic.total_profiles}`);
  console.log(`   Male: ${stats.basic.male_count}`);
  console.log(`   Female: ${stats.basic.female_count}`);
  console.log(`   Living: ${stats.basic.living_count}`);
  console.log(`   Deceased: ${stats.basic.deceased_count}\n`);

  // Display data quality
  console.log("📈 Data Quality:");
  console.log(
    `   With birth dates: ${stats.data_quality.with_birth_date} (${stats.data_quality.birth_date_percentage}%)`,
  );
  console.log(
    `   With photos: ${stats.data_quality.with_photos} (${stats.data_quality.photo_percentage}%)\n`,
  );

  // Display family metrics
  console.log("👨‍👩‍👧‍👦 Family Metrics:");
  console.log(`   Unique fathers: ${stats.family.unique_fathers}`);
  console.log(`   Unique mothers: ${stats.family.unique_mothers}`);
  console.log(`   Total marriages: ${stats.family.total_marriages}`);
  console.log(`   Divorced: ${stats.family.divorced_count}\n`);

  // Display Munasib stats (NEW!)
  console.log("🔗 منتسبين (Married-in Family):");
  console.log(`   Total Munasib: ${stats.munasib.total_munasib}`);
  console.log(`   Male Munasib: ${stats.munasib.male_munasib}`);
  console.log(`   Female Munasib: ${stats.munasib.female_munasib}`);
  console.log(`   With parent info: ${stats.munasib.munasib_with_parents}\n`);

  // Display activity
  console.log("📅 Recent Activity:");
  console.log(`   Added last week: ${stats.activity.added_last_week}`);
  console.log(`   Added last month: ${stats.activity.added_last_month}`);
  console.log(`   Updated last week: ${stats.activity.updated_last_week}\n`);

  if (
    stats.activity.recent_profiles &&
    stats.activity.recent_profiles.length > 0
  ) {
    console.log("   Recent additions:");
    stats.activity.recent_profiles.slice(0, 3).forEach((profile) => {
      console.log(
        `   - ${profile.name} (${new Date(profile.created_at).toLocaleDateString("ar-SA")})`,
      );
    });
  }

  process.exit(0);
}

testEnhancedStats();
