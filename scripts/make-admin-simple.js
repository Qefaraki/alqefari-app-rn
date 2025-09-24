import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = "f387f27e-0fdb-4379-b474-668c0edfc3d1";

async function makeAdmin() {
  try {
    // Check if already admin
    const { data: existingAdmin } = await supabase
      .from("admin_users")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (existingAdmin) {
      console.log("User is already an admin");
      process.exit();
      return;
    }

    // Add as admin with phone number in email field
    const { data, error } = await supabase
      .from("admin_users")
      .insert([
        {
          user_id: userId,
          email: "+966501669043"
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
    console.error("Error:", error);
  }

  process.exit();
}

makeAdmin();