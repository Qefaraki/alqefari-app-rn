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

      // First try the view, then fallback to checking profiles.role directly
      const { data: adminCheck, error } = await supabase
        .from("is_current_user_admin")
        .select("is_admin")
        .single();

      if (error) {
        // Fallback: Check profiles.role directly if view doesn't exist
        console.log("Admin view not found, checking profiles.role directly");
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        const hasAdminRole = profile?.role === "admin";
        setIsAdmin(hasAdminRole);
        // For testing, temporarily set admin to true
        setIsAdmin(true);
        setIsAdminMode(true);
      } else if (!adminCheck) {
        setIsAdmin(false);
        setIsAdminMode(false);
      } else {
        const hasAdminRole = adminCheck.is_admin;
        setIsAdmin(hasAdminRole);

        // If not admin, ensure admin mode is off
        if (!hasAdminRole) {
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
