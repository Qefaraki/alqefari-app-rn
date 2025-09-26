import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../services/supabase";
import profilesService from "../services/profiles";
import { useTreeStore } from "../stores/useTreeStore";

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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isPreloadingTree, setIsPreloadingTree] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    console.log('[DEBUG AuthContext] Mounting AuthProvider, calling checkAuth');
    checkAuth();

    // Listen for auth changes - NO async/await per Supabase docs!
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[DEBUG AuthContext] Auth state changed:', event, 'session:', !!session);

        if (event === 'INITIAL_SESSION') {
          // Handle initial session properly
          console.log('[DEBUG AuthContext] INITIAL_SESSION received');
          if (session?.user) {
            setUser(session.user);
            // Don't set loading false - wait for profile check in checkAuth
          } else {
            setUser(null);
            setIsAdmin(false);
            setHasLinkedProfile(false);
            setHasPendingRequest(false);
            // No user on initial load, can stop loading
            if (!initialLoadComplete) {
              setIsLoading(false);
              setInitialLoadComplete(true);
            }
          }
        } else if (initialLoadComplete) {
          // Only handle subsequent auth changes after initial load
          if (event === 'SIGNED_IN' && session?.user) {
            setUser(session.user);
            // Defer profile checks and tree preloading
            setTimeout(() => {
              checkAdminStatus(session.user);
              checkProfileStatus(session.user);
              preloadTreeData(); // Preload tree data on sign in
            }, 0);
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setIsAdmin(false);
            setHasLinkedProfile(false);
            setHasPendingRequest(false);
            clearAuthCache();
          }
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

        // Start preloading tree data immediately (fire and forget)
        preloadTreeData();

        // Load cached state first for faster initial render
        await loadCachedAuthState();

        // Then fetch fresh data in parallel
        await Promise.all([
          checkProfileStatus(session.user),
          checkAdminStatus(session.user)
        ]);
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
      setInitialLoadComplete(true);
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

      // Declare hasPending outside if block to fix scope issue
      let hasPending = false;

      // If no linked profile, check for pending request
      if (!hasProfile) {
        const { data: pendingRequest, error: requestError } = await supabase
          .from('profile_link_requests')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .single();

        hasPending = !!pendingRequest && !requestError;
        console.log('[DEBUG AuthContext] Pending request check:', hasPending);
        setHasPendingRequest(hasPending);
      } else {
        setHasPendingRequest(false);
      }

      // Cache the profile status for offline use
      await saveAuthCache(user, hasProfile, hasPending);

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

  // Preload tree data for faster navigation
  const preloadTreeData = async () => {
    try {
      setIsPreloadingTree(true);
      const startTime = Date.now();
      console.log('[DEBUG AuthContext] Starting tree data preload');

      // First get the root node (generation 1)
      const { data: rootData, error: rootError } =
        await profilesService.getBranchData(null, 1, 1);

      if (rootError || !rootData || rootData.length === 0) {
        console.log('[DEBUG AuthContext] Failed to preload root node');
        setIsPreloadingTree(false);
        return;
      }

      const rootNode = rootData[0];

      // Load same data that TreeView would load (8 depth, 500 nodes)
      const { data: treeData, error: treeError } =
        await profilesService.getBranchData(rootNode.hid, 8, 500);

      if (treeError || !treeData) {
        console.log('[DEBUG AuthContext] Failed to preload tree data');
        setIsPreloadingTree(false);
        return;
      }

      // Store in tree store for instant access
      const setTreeData = useTreeStore.getState().setTreeData;
      setTreeData(treeData);

      const loadTime = Date.now() - startTime;
      console.log('[DEBUG AuthContext] Tree data preloaded successfully:', treeData.length, 'nodes in', loadTime, 'ms');
    } catch (error) {
      console.error('[DEBUG AuthContext] Error preloading tree data:', error);
    } finally {
      setIsPreloadingTree(false);
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
        isPreloadingTree,
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