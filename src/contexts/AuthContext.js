import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  const [hasLinkedProfile, setHasLinkedProfile] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    console.log('[DEBUG AuthContext] Mounting AuthProvider, calling checkAuth');
    checkAuth();

    // Listen for auth changes - NO async/await per Supabase docs!
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[DEBUG AuthContext] Auth state changed:', event, 'session:', !!session);

        // Skip INITIAL_SESSION event as we handle that in checkAuth()
        if (event === 'INITIAL_SESSION') {
          console.log('[DEBUG AuthContext] Skipping INITIAL_SESSION (handled by checkAuth)');
          return;
        }

        // Quick state updates only - no async operations
        if (session?.user) {
          setUser(session.user);
          setIsLoading(false);

          // Defer heavy operations outside the callback per Supabase docs
          setTimeout(() => {
            checkAdminStatus(session.user);
            checkProfileStatus(session.user);
          }, 0);
        } else {
          setUser(null);
          setIsAdmin(false);
          setHasLinkedProfile(false);
          setHasPendingRequest(false);
          setIsLoading(false);
        }
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

    try {
      // Simple getSession - trust Supabase's built-in handling
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.log('[DEBUG AuthContext] getSession error:', error.message);
      }

      if (session?.user) {
        console.log('[DEBUG AuthContext] Session found for user:', session.user.email || session.user.phone);
        setUser(session.user);

        // Load cached profile status immediately for faster UI
        await loadCachedAuthState();

        // Check admin and profile status in background (non-blocking)
        setTimeout(() => {
          checkAdminStatus(session.user);
          checkProfileStatus(session.user);
        }, 0);
      } else {
        console.log('[DEBUG AuthContext] No session found');
        // Clear everything when no session
        setUser(null);
        setIsAdmin(false);
        setHasLinkedProfile(false);
        setHasPendingRequest(false);
        await clearAuthCache();
      }
    } catch (error) {
      console.error('[DEBUG AuthContext] Error in checkAuth:', error);

      // Try to get the cached Supabase session directly
      try {
        const cachedSessionStr = await AsyncStorage.getItem('supabase.auth.token');
        if (cachedSessionStr) {
          const cachedSession = JSON.parse(cachedSessionStr);
          if (cachedSession?.currentSession?.user) {
            console.log('[DEBUG AuthContext] Found cached Supabase session for offline use');
            setUser(cachedSession.currentSession.user);
            // Load cached profile status
            await loadCachedAuthState();
          } else {
            // No cached session, check our auth cache
            const hasCachedAuth = await loadCachedAuthState();
            if (!hasCachedAuth) {
              // Only reset if no cache exists
              setUser(null);
              setIsAdmin(false);
              setHasLinkedProfile(false);
              setHasPendingRequest(false);
            }
          }
        } else {
          // No Supabase cache, try our cache
          const hasCachedAuth = await loadCachedAuthState();
          if (!hasCachedAuth) {
            setUser(null);
            setIsAdmin(false);
            setHasLinkedProfile(false);
            setHasPendingRequest(false);
          }
        }
      } catch (cacheError) {
        console.error('[DEBUG AuthContext] Failed to load cached session:', cacheError);
        setUser(null);
        setIsAdmin(false);
        setHasLinkedProfile(false);
        setHasPendingRequest(false);
      }
    } finally {
      console.log('[DEBUG AuthContext] Initial auth check complete');
      setIsLoading(false);
    }
  };

  const checkProfileStatus = async (user) => {
    if (!user) {
      setHasLinkedProfile(false);
      setHasPendingRequest(false);
      return false;
    }

    try {
      // Check if user has a linked profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const hasProfile = !!profile && !error;
      console.log('[DEBUG AuthContext] Profile check for user:', user.id, 'Has profile:', hasProfile);
      setHasLinkedProfile(hasProfile);

      // If no linked profile, check for pending request
      if (!hasProfile) {
        const { data: pendingRequest, error: requestError } = await supabase
          .from('profile_link_requests')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .single();

        const hasPending = !!pendingRequest && !requestError;
        console.log('[DEBUG AuthContext] Pending request check:', hasPending);
        setHasPendingRequest(hasPending);
      } else {
        setHasPendingRequest(false);
      }

      // Cache the profile status for offline use
      const pendingStatus = !hasProfile ? hasPending : false;
      await saveAuthCache(user, hasProfile, pendingStatus);

      return hasProfile;
    } catch (error) {
      console.log('[DEBUG AuthContext] Profile check error (likely offline):', error);
      // Don't immediately set to false - check cache first
      const cached = await loadCachedAuthState();
      if (!cached) {
        // Only set to false if no cache exists
        setHasLinkedProfile(false);
        setHasPendingRequest(false);
      }
      return false;
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
        // Check cache on error
        const cachedAdmin = await AsyncStorage.getItem('authCache_isAdmin');
        if (cachedAdmin !== null) {
          setIsAdmin(JSON.parse(cachedAdmin));
        } else {
          setIsAdmin(false);
        }
      } else {
        console.log("Admin check for user:", user.id, "Result:", data, "Email:", user.email);
        setIsAdmin(data === true);
        // Cache admin status
        await AsyncStorage.setItem('authCache_isAdmin', JSON.stringify(data === true));
      }
    } catch (error) {
      console.log("Admin check exception:", error);
      // Check cache on exception
      const cachedAdmin = await AsyncStorage.getItem('authCache_isAdmin');
      if (cachedAdmin !== null) {
        setIsAdmin(JSON.parse(cachedAdmin));
      } else {
        setIsAdmin(false);
      }
    }
  };

  // Helper function to save auth cache
  const saveAuthCache = async (user, hasProfile, hasPending) => {
    try {
      await AsyncStorage.multiSet([
        ['authCache_userId', user.id],
        ['authCache_hasLinkedProfile', JSON.stringify(hasProfile)],
        ['authCache_hasPendingRequest', JSON.stringify(hasPending)],
        ['authCache_lastUpdated', new Date().toISOString()],
      ]);
      console.log('[DEBUG AuthContext] Auth cache saved');
    } catch (error) {
      console.error('[DEBUG AuthContext] Failed to save auth cache:', error);
    }
  };

  // Helper function to load cached auth state
  const loadCachedAuthState = async () => {
    try {
      const [[, userId], [, hasProfile], [, hasPending], [, isAdminCached], [, lastUpdated]] =
        await AsyncStorage.multiGet([
          'authCache_userId',
          'authCache_hasLinkedProfile',
          'authCache_hasPendingRequest',
          'authCache_isAdmin',
          'authCache_lastUpdated',
        ]);

      if (userId && lastUpdated) {
        // Check if cache is recent (within 7 days)
        const cacheAge = Date.now() - new Date(lastUpdated).getTime();
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

        if (cacheAge < sevenDaysInMs) {
          console.log('[DEBUG AuthContext] Using cached auth state from', lastUpdated);

          if (hasProfile !== null) {
            setHasLinkedProfile(JSON.parse(hasProfile));
          }
          if (hasPending !== null) {
            setHasPendingRequest(JSON.parse(hasPending));
          }
          if (isAdminCached !== null) {
            setIsAdmin(JSON.parse(isAdminCached));
          }

          return true; // Cache was loaded
        } else {
          console.log('[DEBUG AuthContext] Auth cache expired');
        }
      }
    } catch (error) {
      console.error('[DEBUG AuthContext] Failed to load auth cache:', error);
    }
    return false; // No cache or failed to load
  };

  // Helper function to clear auth cache
  const clearAuthCache = async () => {
    try {
      await AsyncStorage.multiRemove([
        'authCache_userId',
        'authCache_hasLinkedProfile',
        'authCache_hasPendingRequest',
        'authCache_isAdmin',
        'authCache_lastUpdated',
      ]);
      console.log('[DEBUG AuthContext] Auth cache cleared');
    } catch (error) {
      console.error('[DEBUG AuthContext] Failed to clear auth cache:', error);
    }
  };

  // Add sign out function to clear cache
  const signOut = async () => {
    await clearAuthCache();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        hasLinkedProfile,
        hasPendingRequest,
        isLoading,
        checkAuth,
        checkAdminStatus,
        checkProfileStatus,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};