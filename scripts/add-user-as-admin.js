import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = "f387f27e-0fdb-4379-b474-668c0edfc3d1";

async function addUserAsAdmin() {
  try {
    // First check if user exists in profiles table
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error("Error checking profile:", profileError);
      return;
    }

    if (!profile) {
      console.error("User not found in profiles table");
      return;
    }

    console.log("Found profile:", profile.name);

    // Check if already admin
    const { data: existingAdmin, error: checkError } = await supabase
      .from("admins")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (existingAdmin) {
      console.log("User is already an admin");
      return;
    }

    // Add as admin
    const { data, error } = await supabase
      .from("admins")
      .insert([
        {
          user_id: userId,
          profile_id: profile.id,
          permissions: {
            view_all: true,
            edit_all: true,
            manage_admins: true,
            import_export: true,
            review_submissions: true
          }
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Error adding admin:", error);
    } else {
      console.log("Successfully added user as admin:", data);
    }
  } catch (error) {
    console.error("Unexpected error:", error);
  }

  process.exit();
}

addUserAsAdmin();