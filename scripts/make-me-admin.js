import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ezkioroyhzpavmbfavyn.supabase.co";
const supabaseServiceKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6a2lvcm95aHpwYXZtYmZhdnluIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQ5MjYyMCwiZXhwIjoyMDcyMDY4NjIwfQ.2h9_O6pJRUO3sxXeLBD6TisomoY_bjMdbouvs2Cen4k";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function makeAdmin() {
  console.log("🔑 Making you an admin...\n");

  try {
    // First, find any existing profiles and make the first one admin
    const { data: profiles, error: fetchError } = await supabase
      .from("profiles")
      .select("id, name, role")
      .limit(5);

    if (fetchError) {
      console.error("❌ Error fetching profiles:", fetchError);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log("⚠️  No profiles found in database");
      return;
    }

    console.log("📋 Found profiles:");
    profiles.forEach((p) => {
      console.log(
        `  - ${p.name || "Unknown"} (${p.id}): ${p.role || "member"}`,
      );
    });

    // Make the first profile an admin
    const targetProfile = profiles[0];
    console.log(
      `\n🎯 Making ${targetProfile.name || "profile"} (${targetProfile.id}) an admin...`,
    );

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", targetProfile.id);

    if (updateError) {
      console.error("❌ Error updating profile:", updateError);
      return;
    }

    console.log("✅ Profile updated to admin role!");

    // Verify the update
    const { data: updated, error: verifyError } = await supabase
      .from("profiles")
      .select("id, name, role")
      .eq("id", targetProfile.id)
      .single();

    if (verifyError) {
      console.error("⚠️  Could not verify update:", verifyError);
    } else {
      console.log(`\n✨ Success! ${updated.name} is now an ${updated.role}`);
      console.log("📱 You can now use admin features in the app!");
    }
  } catch (err) {
    console.error("❌ Unexpected error:", err);
  }
}

makeAdmin();
