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

      // Check if user profile has admin role
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
        setIsAdminMode(false);
      } else if (!profile) {
        // No profile exists for this user yet
        console.log('No profile found for user:', user.email);
        setIsAdmin(false);
        setIsAdminMode(false);
      } else {
        const hasAdminRole = profile.role === 'admin';
        setIsAdmin(hasAdminRole);
        
        // If not admin, ensure admin mode is off
        if (!hasAdminRole) {
          setIsAdminMode(false);
        }
        
        // Log role info for debugging
        console.log('User role info:', {
          userId: user.id,
          email: user.email,
          role: profile.role,
          isAdmin: hasAdminRole
        });
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
      const newMode = !isAdminMode;
      console.log('AdminModeContext: Toggling admin mode from', isAdminMode, 'to', newMode);
      setIsAdminMode(newMode);
    } else {
      console.log('AdminModeContext: Cannot toggle admin mode - user is not admin');
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