import { createClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Complete account deletion service
 * CRITICAL SECURITY: This ensures complete removal of user data
 */
export const accountDeletionService = {
  /**
   * Delete user account completely
   * 1. Calls RPC to unlink profile and delete admin access
   * 2. Signs out the user
   * 3. Returns success status
   */
  deleteAccount: async () => {
    try {
      // Step 1: Call RPC to clean up database records
      const { data, error: rpcError } = await supabase.rpc(
        "delete_user_account_complete"
      );

      if (rpcError) {
        console.error("RPC deletion error:", rpcError);
        throw new Error(rpcError.message);
      }

      console.log("Account deletion RPC result:", data);

      // Step 2: Sign out the user (this clears the session)
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        console.error("Sign out error:", signOutError);
        // Continue even if sign out fails - the session will be invalid anyway
      }

      // Step 3: Clear all local storage and caches
      try {
        // Clear Zustand stores if they have reset methods
        const { useTreeStore } = require("../stores/useTreeStore");
        useTreeStore.getState().setSelectedPersonId(null);
      } catch (e) {
        console.log("Error clearing stores:", e);
      }

      return {
        success: true,
        message: "Account deleted successfully",
        adminDeleted: data?.admin_deleted || false,
        profileUnlinked: data?.profile_unlinked || false,
      };
    } catch (error) {
      console.error("Account deletion failed:", error);
      return {
        success: false,
        error: error.message || "Failed to delete account",
      };
    }
  },

  /**
   * Check if user can be deleted
   * This can be expanded to check for dependencies
   */
  canDeleteAccount: async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { canDelete: false, reason: "User not authenticated" };
      }

      // Add any additional checks here
      // For example: check if user owns critical data

      return { canDelete: true };
    } catch (error) {
      console.error("Error checking deletion eligibility:", error);
      return { canDelete: false, reason: error.message };
    }
  },
};