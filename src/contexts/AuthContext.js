import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../services/supabase";

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('[DEBUG AuthContext] Mounting AuthProvider, calling checkAuth');
    checkAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[DEBUG AuthContext] Auth state changed:', event, 'session:', !!session);
        if (session?.user) {
          setUser(session.user);
          await checkAdminStatus(session.user);
        } else {
          setUser(null);
          setIsAdmin(false);
        }
        // CRITICAL FIX: Always set isLoading to false when auth state changes
        console.log('[DEBUG AuthContext] Setting isLoading to false from auth state change');
        setIsLoading(false);
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    console.log('[DEBUG AuthContext] checkAuth starting');

    // Hard 1-second timeout that ALWAYS resolves
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.log('[DEBUG AuthContext] Auth check timed out, continuing anyway');
        resolve({ data: { user: null } });
      }, 1000);
    });

    try {
      // Race between actual auth check and timeout
      const result = await Promise.race([
        supabase.auth.getUser().catch(err => {
          console.error('[DEBUG AuthContext] getUser error:', err);
          return { data: { user: null } };
        }),
        timeoutPromise
      ]);

      const user = result?.data?.user;
      console.log('[DEBUG AuthContext] getUser result:', user ? 'User found' : 'No user');

      if (user) {
        setUser(user);
        // Check admin status but don't wait for it
        checkAdminStatus(user).catch(err =>
          console.error('[DEBUG AuthContext] Admin check error:', err)
        );
      }
    } catch (error) {
      // This should never happen with our setup, but just in case
      console.error('[DEBUG AuthContext] Unexpected error:', error);
    } finally {
      // ALWAYS set isLoading to false no matter what
      console.log('[DEBUG AuthContext] Setting isLoading to false (guaranteed)');
      setIsLoading(false);
    }
  };

  const checkAdminStatus = async (user) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    // Never show admin for anonymous users
    if (user.is_anonymous) {
      setIsAdmin(false);
      return;
    }

    try {
      // Use RPC function to bypass RLS issues
      const { data, error } = await supabase
        .rpc('is_admin');

      if (error) {
        console.log("Admin check error:", error);
        setIsAdmin(false);
      } else {
        console.log("Admin check for user:", user.id, "Result:", data, "Email:", user.email);
        setIsAdmin(data === true);
      }
    } catch (error) {
      console.log("Admin check exception:", error);
      setIsAdmin(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        checkAuth,
        checkAdminStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};