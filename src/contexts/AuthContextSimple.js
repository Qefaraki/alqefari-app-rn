/**
 * Simplified Auth Context
 *
 * Manages authentication state without manual navigation.
 * Navigation is handled by conditional rendering in _layout.tsx
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabase';
import AuthStateMachine, { AuthStates } from '../services/AuthStateMachineSimple';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(AuthStates.INITIALIZING);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(null);
  const isInitializedRef = useRef(false);
  const isProcessingAuthEventRef = useRef(false);
  const lastAuthEventRef = useRef(null);

  // Initialize auth state
  useEffect(() => {
    if (isInitializedRef.current) {
      console.log('[AuthContext] Already initialized, skipping');
      return;
    }

    const initializeAuth = async () => {
      console.log('[AuthContext] Initializing auth...');
      isInitializedRef.current = true;

      // Check onboarding status with error handling
      const checkOnboarding = async () => {
        try {
          const value = await AsyncStorage.getItem('hasCompletedOnboarding');
          setHasCompletedOnboarding(value === 'true');
          console.log('[AuthContext] hasCompletedOnboarding:', value === 'true');
        } catch (error) {
          console.error('[AuthContext] Error checking onboarding status:', error);
          setHasCompletedOnboarding(false); // Default to false on error
        }
      };
      await checkOnboarding();

      // Subscribe to state machine changes
      const unsubscribe = AuthStateMachine.subscribe(async (state) => {
        console.log('[AuthContext] State changed:', state);
        setAuthState(state.state);
        setUser(state.user);
        setProfile(state.profile);
        setIsLoading(false);

        // Re-check onboarding when auth state changes
        await checkOnboarding();
      });

      // Initialize state machine
      await AuthStateMachine.initialize();

      // Listen for auth changes
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('[AuthContext] Auth event:', event);

          // Prevent duplicate event processing
          const eventKey = `${event}-${session?.user?.id || 'no-user'}`;
          if (isProcessingAuthEventRef.current && lastAuthEventRef.current === eventKey) {
            console.log('[AuthContext] Skipping duplicate event:', eventKey);
            return;
          }

          isProcessingAuthEventRef.current = true;
          lastAuthEventRef.current = eventKey;

          try {
            switch (event) {
              case 'INITIAL_SESSION':
                // Skip - already handled by AuthStateMachine.initialize()
                console.log('[AuthContext] Skipping INITIAL_SESSION (handled by initialize)');
                break;

              case 'SIGNED_IN':
                if (session?.user) {
                try {
                  // Get user profile (handle missing profile gracefully)
                  const { data: profiles, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('user_id', session.user.id);

                  // Get first profile or null (no error for new users)
                  const profile = profiles?.[0] || null;

                  if (error && error.code !== 'PGRST116') {
                    // Only log real errors, not "no rows found"
                    console.error('[AuthContext] Error fetching profile:', error);
                  }

                  // AuthStateMachine.signIn handles onboarding status
                  await AuthStateMachine.signIn(session.user, profile);
                } catch (error) {
                  console.error('[AuthContext] Error during sign in:', error);
                  // Still attempt to sign in with just the user
                  await AuthStateMachine.signIn(session.user, null);
                }
              }
              break;

            case 'SIGNED_OUT':
              await AuthStateMachine.signOut();
              break;

              case 'TOKEN_REFRESHED':
                console.log('[AuthContext] Token refreshed');
                break;
            }
          } finally {
            // Reset the processing flag after a short delay to allow for batch processing
            setTimeout(() => {
              isProcessingAuthEventRef.current = false;
            }, 100);
          }
        }
      );

      // Cleanup
      return () => {
        unsubscribe();
        authListener.subscription.unsubscribe();
      };
    };

    initializeAuth();
  }, []);

  // Context value
  const value = {
    // State
    authState,
    user,
    profile,
    isLoading,
    hasCompletedOnboarding,

    // Computed values
    isAuthenticated: authState === AuthStates.AUTHENTICATED,
    isGuestMode: authState === AuthStates.GUEST_MODE,
    hasLinkedProfile: AuthStateMachine.hasLinkedProfile(),
    isPendingApproval: AuthStateMachine.isPendingApproval(),
    isAdmin: profile?.role === 'admin' || profile?.role === 'super_admin',

    // Actions
    signOut: async () => {
      // First sign out from Supabase to clear session
      await supabase.auth.signOut();
      // Then clear our state machine and storage
      await AuthStateMachine.signOut();
      // Force clear onboarding status
      await AsyncStorage.removeItem('hasCompletedOnboarding');
      // Reset local state
      setUser(null);
      setProfile(null);
      setHasCompletedOnboarding(null);
    },

    enterGuestMode: async () => {
      await AuthStateMachine.enterGuestMode();
    },

    exitGuestMode: async () => {
      await AuthStateMachine.exitGuestMode();
    },

    // Direct access to state machine for compatibility
    stateMachine: AuthStateMachine
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}