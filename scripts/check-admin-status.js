import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const userId = "f387f27e-0fdb-4379-b474-668c0edfc3d1";

async function checkAdmin() {
  try {
    // Check in admin_users table
    const { data, error } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", userId)
      .single();

    console.log("Query result:", { data, error });

    if (data) {
      console.log("User IS an admin in admin_users table");
    } else {
      console.log("User is NOT an admin");
    }
  } catch (error) {
    console.error("Error:", error);
  }

  process.exit();
}

checkAdmin();