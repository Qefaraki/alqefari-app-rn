import { supabase } from "../services/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTreeStore } from "../stores/useTreeStore";

export async function forceCompleteSignOut() {
  console.log("🔴 Force sign out initiated...");

  try {
    // 1. Clear all app state and caches
    try {
      // Clear TreeStore state
      const treeStore = useTreeStore.getState();
      treeStore.setNodes([]);
      treeStore.setSelectedPersonId(null);
      treeStore.setExpandedBranches(new Set());
      treeStore.setLayoutCache({});
      treeStore.setProfileData({});

      // Clear any other global stores if they exist
      console.log("✅ App state cleared");
    } catch (e) {
      console.log("Error clearing app state:", e);
    }

    // 2. Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.log("Supabase signout error:", error);
    }

    // 3. Clear all AsyncStorage
    await AsyncStorage.clear();
    console.log("✅ AsyncStorage cleared");

    // 4. Clear any session tokens and onboarding flags
    await AsyncStorage.multiRemove([
      "supabase.auth.token",
      "supabase.auth.refreshToken",
      "supabase.auth.user",
      "hasSeenOnboarding",
      "hasCompletedOnboarding",  // Clear this to force onboarding screen
      "isGuestMode",  // Clear guest mode flag
      "linkedProfile",
      // Clear auth cache
      "authCache_userId",
      "authCache_hasLinkedProfile",
      "authCache_hasPendingRequest",
      "authCache_isAdmin",
      "authCache_lastUpdated",
      // Clear news cache
      "newsCache",
      "newsCacheTimestamp",
      // Clear profile cache
      "profileCache",
      "cacheTimestamp",
      // Clear validation cache
      "validationCache",
      // Clear any search history
      "recentSearches",
      "searchHistory",
    ]);

    console.log("✅ Complete sign out successful");
    return true;
  } catch (error) {
    console.error("Force sign out error:", error);
    return false;
  }
}
