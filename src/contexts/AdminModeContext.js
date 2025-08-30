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

      // Check if user has admin role
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select(`
          role_id,
          roles!inner(name)
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
        setIsAdminMode(false);
      } else {
        const hasAdminRole = roles?.some(r => 
          r.roles?.name === 'SUPER_ADMIN' || r.roles?.name === 'BRANCH_ADMIN'
        );
        setIsAdmin(hasAdminRole || false);
        
        // If not admin, ensure admin mode is off
        if (!hasAdminRole) {
          setIsAdminMode(false);
        }
      }
    } catch (error) {
      console.error('Error in checkAdminRole:', error);
      setIsAdmin(false);
      setIsAdminMode(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminMode = () => {
    if (isAdmin) {
      setIsAdminMode(prev => !prev);
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