import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { AppState } from "react-native";
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
  const appState = useRef(AppState.currentState);

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
        console.log('[DEBUG AuthContext] Setting isLoading to false from auth state change');
        setIsLoading(false);
      }
    );

    // Handle app state changes to manage auth refresh
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('[DEBUG AuthContext] App state changed:', appState.current, '->', nextAppState);

      // App has come to the foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[DEBUG AuthContext] App came to foreground, starting auto refresh');
        supabase.auth.startAutoRefresh();
      }

      // App has gone to the background
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('[DEBUG AuthContext] App went to background, stopping auto refresh');
        supabase.auth.stopAutoRefresh();
      }

      appState.current = nextAppState;
    });

    return () => {
      authListener?.subscription?.unsubscribe();
      appStateSubscription?.remove();
    };
  }, []);

  const checkAuth = async () => {
    console.log('[DEBUG AuthContext] checkAuth starting');

    // Use getSession for instant response (no network call)
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      console.log('[DEBUG AuthContext] getSession result:', session ? 'Session found' : 'No session', error ? `Error: ${error.message}` : '');

      if (session?.user) {
        setUser(session.user);
        console.log('[DEBUG AuthContext] User from session:', session.user.email || session.user.phone);

        // Check admin status in background
        checkAdminStatus(session.user).catch(err =>
          console.error('[DEBUG AuthContext] Admin check error:', err)
        );

        // Refresh user data in background (don't wait for it)
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            console.log('[DEBUG AuthContext] Fresh user data received');
            setUser(user);
          }
        }).catch(err => {
          console.error('[DEBUG AuthContext] Background user refresh error:', err);
        });
      } else {
        console.log('[DEBUG AuthContext] No valid session found');
        setUser(null);
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('[DEBUG AuthContext] Error getting session:', error);
      setUser(null);
      setIsAdmin(false);
    } finally {
      console.log('[DEBUG AuthContext] Setting isLoading to false');
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