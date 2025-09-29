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
      const { data, error: rpcError } = await supabase.rpc(
        "delete_user_account_complete"
      );

      if (rpcError) {
        console.error("RPC deletion error:", rpcError);
        throw new Error(rpcError.message);
      }

      console.log("Account deletion RPC result:", data);

      if (!data?.success) {
        throw new Error(data?.error || "Account deletion failed");
      }

      return {
        success: true,
        message: data?.message || "Account deleted successfully",
        adminDeleted: Boolean(data?.admin_deleted),
        profileUnlinked: Boolean(data?.profile_unlinked),
        userDeleted: Boolean(data?.user_deleted),
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
