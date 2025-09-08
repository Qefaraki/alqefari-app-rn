import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../services/supabase';

const AdminModeContext = createContext({
  isAdminMode: false,
  isAdmin: false,
  toggleAdminMode: () => {},
  loading: true,
});

export const useAdminMode = () => {
  const context = useContext(AdminModeContext);
  if (!context) {
    throw new Error('useAdminMode must be used within AdminModeProvider');
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
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAdmin(false);
        setIsAdminMode(false);
        setLoading(false);
        return;
      }

      // Check if user has admin privileges via the is_current_user_admin view
      const { data: adminCheck, error } = await supabase
        .from('is_current_user_admin')
        .select('is_admin')
        .single();

      if (error || !adminCheck) {
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