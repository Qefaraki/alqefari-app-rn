/**
 * AdminModeContext - Provides admin mode state and role checking
 *
 * NOTE (v4.3 - January 2025):
 * The mode toggle (isAdminMode) is now primarily for UI indicators only.
 * Actual permissions (like QuickAdd access, edit rights) are role-based, not mode-based.
 *
 * Use this context for:
 * - SystemStatusIndicator visibility
 * - Other admin UI element visibility
 * - Visual state indicators
 *
 * For permission checks, use profile.role directly:
 * - profile?.role === 'super_admin' → Full access
 * - profile?.role === 'admin' → Admin access
 * - profile?.role === 'moderator' → Branch moderator access
 * - profile?.role === 'user' or null → Regular user
 */

import React, { createContext, useState, useContext, useEffect } from "react";
import { supabase } from "../services/supabase";

const AdminModeContext = createContext({
  isAdminMode: false,
  isAdmin: false,
  toggleAdminMode: () => {},
  loading: true,
});

export const useAdminMode = () => {
  const context = useContext(AdminModeContext);
  if (!context) {
    throw new Error("useAdminMode must be used within AdminModeProvider");
  }
  return context;
};

export const AdminModeProvider = ({ children }) => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminRole();

    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkAdminRole();
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkAdminRole = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        setIsAdminMode(false);
        setLoading(false);
        return;
      }

      // Primary method: Check profiles.role directly
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile && !profileError) {
        const hasAdminRole = profile.role === "admin" || profile.role === "super_admin";
        setIsAdmin(hasAdminRole);
        if (hasAdminRole) {
          setIsAdminMode(true); // Auto-enable admin mode for admins
        }
      } else {
        // Fallback: Try the view
        const { data: adminCheck, error: viewError } = await supabase
          .from("is_current_user_admin")
          .select("is_admin")
          .single();

        if (!viewError && adminCheck) {
          setIsAdmin(adminCheck.is_admin);
          if (adminCheck.is_admin) {
            setIsAdminMode(true);
          }
        } else {
          console.log("Could not verify admin status, defaulting to false");
          setIsAdmin(false);
          setIsAdminMode(false);
        }
      }
    } catch (error) {
      setIsAdmin(false);
      setIsAdminMode(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminMode = () => {
    if (isAdmin) {
      const newMode = !isAdminMode;
      setIsAdminMode(newMode);
    }
  };

  const value = {
    isAdminMode,
    isAdmin,
    toggleAdminMode,
    loading,
  };

  return (
    <AdminModeContext.Provider value={value}>
      {children}
    </AdminModeContext.Provider>
  );
};

export default AdminModeContext;
