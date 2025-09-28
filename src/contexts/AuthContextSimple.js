/**
 * Simplified Auth Context
 *
 * Manages authentication state without manual navigation.
 * Navigation is handled by conditional rendering in _layout.tsx
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
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

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('[AuthContext] Initializing auth...');

      // Subscribe to state machine changes
      const unsubscribe = AuthStateMachine.subscribe((state) => {
        console.log('[AuthContext] State changed:', state);
        setAuthState(state.state);
        setUser(state.user);
        setProfile(state.profile);
        setIsLoading(false);
      });

      // Initialize state machine
      await AuthStateMachine.initialize();

      // Listen for auth changes
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('[AuthContext] Auth event:', event);

          switch (event) {
            case 'SIGNED_IN':
              if (session?.user) {
                // Get user profile
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('user_id', session.user.id)
                  .single();

                await AuthStateMachine.signIn(session.user, profile);

                // Set onboarding complete if profile is linked
                if (profile?.linked_profile_id) {
                  await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
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

    // Computed values
    isAuthenticated: authState === AuthStates.AUTHENTICATED,
    isGuestMode: authState === AuthStates.GUEST_MODE,
    hasLinkedProfile: AuthStateMachine.hasLinkedProfile(),
    isPendingApproval: AuthStateMachine.isPendingApproval(),
    isAdmin: profile?.role === 'admin' || profile?.role === 'super_admin',

    // Actions
    signOut: async () => {
      await supabase.auth.signOut();
      await AuthStateMachine.signOut();
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