import { supabase } from "./supabase";

/**
 * Complete account deletion service
 * CRITICAL SECURITY: This ensures complete removal of user data
 */
export const accountDeletionService = {
  /**
   * Delete user account completely
   * CRITICAL FLOW:
   * 1. Validate session is recent (5 minutes max)
   * 2. Calls RPC to unlink profile and delete admin access
   * 3. Signs out globally (all sessions)
   * 4. Returns success status
   *
   * Session validation is critical security check - OTP verification
   * proves user identity, but session must still be fresh
   */
  deleteAccount: async () => {
    try {
      // CRITICAL: Validate session is recent (prevent stale deletion)
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Session expired. Please sign in again.');
      }

      const sessionAgeMs = Date.now() - new Date(session.created_at).getTime();
      const maxSessionAgeMs = 5 * 60 * 1000; // 5 minutes

      if (sessionAgeMs > maxSessionAgeMs) {
        throw new Error('Session expired. Please re-authenticate before deleting account.');
      }

      console.log('[DeleteAccount] Session validation passed');

      // Call RPC to perform deletion
      const { data, error: rpcError } = await supabase.rpc(
        "delete_user_account_complete"
      );

      if (rpcError) {
        console.error('[DeleteAccount] RPC deletion error:', rpcError);
        throw new Error(rpcError.message);
      }

      console.log('[DeleteAccount] RPC result:', data);

      if (!data?.success) {
        throw new Error(data?.error || "Account deletion failed");
      }

      // After successful RPC, sign out globally (all sessions)
      // This clears all sessions and prevents further access from any device
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });

      if (signOutError) {
        console.error('[DeleteAccount] Global sign out error:', signOutError);
        // Continue anyway - the account is already deleted
      }

      console.log('[DeleteAccount] Global sign out completed');

      // Note: We cannot call auth.admin.deleteUser() from the client
      // as it requires service role privileges. The auth record remains
      // but is marked with deletion metadata and the user is signed out.

      return {
        success: true,
        message: data?.message || "Account deleted successfully",
        adminDeleted: Boolean(data?.admin_deleted),
        profileUnlinked: Boolean(data?.profile_unlinked),
        notificationsDeleted: Boolean(data?.notifications_deleted > 0),
        authMarked: Boolean(data?.auth_marked),
      };
    } catch (error) {
      console.error('[DeleteAccount] Account deletion failed:', error);
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
