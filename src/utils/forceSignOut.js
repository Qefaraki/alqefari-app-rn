import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTreeStore } from "../stores/useTreeStore";

/**
 * Force complete sign out with retry logic for poor network conditions
 * NOTE: This does NOT call supabase.auth.signOut() - that's handled by AuthContext
 * This function only clears local state and storage
 */
export async function forceCompleteSignOut(maxRetries = 3) {
  console.log("🔴 Force clear local state initiated...");
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // 1. Clear all app state and caches
      try {
        // Clear TreeStore state
        const treeStore = useTreeStore.getState();
        treeStore.setTreeData([]);  // Use correct method name
        treeStore.setSelectedPersonId(null);
        treeStore.setStage({ x: 0, y: 0, scale: 1 });  // Reset camera position
        treeStore.setIsAnimating(false);

        // Clear any other global stores if they exist
        console.log("✅ App state cleared");
      } catch (e) {
        console.log("Error clearing app state:", e);
        // Continue even if store clearing fails
      }

      // 2. Clear all AsyncStorage with specific keys first
      try {
        // Try to remove specific keys first (more reliable)
        await AsyncStorage.multiRemove([
          "supabase.auth.token",
          "supabase.auth.refreshToken",
          "supabase.auth.user",
          "hasSeenOnboarding",
          "hasCompletedOnboarding",  // Critical: Clear this to force onboarding screen
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
        console.log("✅ Specific keys removed");
      } catch (e) {
        console.log("Warning: Some keys may not have been removed:", e);
      }

      // 3. Then try to clear all AsyncStorage as backup
      try {
        await AsyncStorage.clear();
        console.log("✅ AsyncStorage fully cleared");
      } catch (e) {
        console.log("Warning: Full AsyncStorage clear failed:", e);
        // If full clear fails, at least we removed the important keys above
      }

      console.log("✅ Local state cleared successfully");
      return true;
    } catch (error) {
      retries++;
      console.error(`Force clear attempt ${retries} failed:`, error);

      if (retries >= maxRetries) {
        console.error("Max retries reached. Force clear failed.");
        throw error;
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, retries - 1), 5000);
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return false;
}
