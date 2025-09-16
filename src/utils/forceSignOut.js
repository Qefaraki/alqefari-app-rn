import { supabase } from "../services/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function forceCompleteSignOut() {
  console.log("🔴 Force sign out initiated...");

  try {
    // 1. Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.log("Supabase signout error:", error);
    }

    // 2. Clear all AsyncStorage
    await AsyncStorage.clear();
    console.log("✅ AsyncStorage cleared");

    // 3. Clear any session tokens
    await AsyncStorage.multiRemove([
      "supabase.auth.token",
      "supabase.auth.refreshToken",
      "supabase.auth.user",
      "hasSeenOnboarding",
      "linkedProfile",
    ]);

    console.log("✅ Complete sign out successful");
    return true;
  } catch (error) {
    console.error("Force sign out error:", error);
    return false;
  }
}
