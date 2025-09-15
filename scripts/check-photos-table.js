import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPhotosTable() {
  console.log("Checking profile_photos table...");

  // Get all photos
  const { data: photos, error } = await supabase
    .from("profile_photos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching photos:", error);
    return;
  }

  console.log(`Found ${photos?.length || 0} recent photos:`);
  photos?.forEach((photo) => {
    console.log(`- ID: ${photo.id}`);
    console.log(`  Profile: ${photo.profile_id}`);
    console.log(`  URL: ${photo.photo_url}`);
    console.log(`  Storage Path: ${photo.storage_path}`);
    console.log(`  Primary: ${photo.is_primary}`);
    console.log("---");
  });

  // Check storage bucket
  console.log("\nChecking storage bucket 'profile-photos'...");
  const { data: files, error: storageError } = await supabase.storage
    .from("profile-photos")
    .list("profiles", { limit: 10 });

  if (storageError) {
    console.error("Error checking storage:", storageError);
  } else {
    console.log(`Found ${files?.length || 0} folders in storage`);
  }
}

checkPhotosTable().catch(console.error);
