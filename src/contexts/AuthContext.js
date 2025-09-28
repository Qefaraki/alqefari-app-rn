import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../services/supabase";
import AuthStateMachine, { AuthStates } from "../services/AuthStateMachine";
import * as SplashScreen from 'expo-splash-screen';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(AuthStateMachine.getState());
  const [isLoading, setIsLoading] = useState(true);
  const unsubscribeRef = useRef(null);
  const authListenerRef = useRef(null);

  useEffect(() => {
    console.log('[DEBUG AuthContext] Mounting AuthProvider');

    // Subscribe to state machine changes
    unsubscribeRef.current = AuthStateMachine.subscribe((newState) => {
      console.log('[DEBUG AuthContext] State machine changed:', newState);
      setAuthState(newState);

      // Hide splash when ready
      if (newState.current !== AuthStates.INITIALIZING) {
        setIsLoading(false);
        SplashScreen.hideAsync();
      }
    });

    // Initialize the state machine
    const initializeAuth = async () => {
      await AuthStateMachine.initialize();

      // Setup Supabase auth listener
      authListenerRef.current = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[DEBUG AuthContext] Auth state change:', event);

        switch (event) {
          case 'SIGNED_IN':
            if (AuthStateMachine.currentState === AuthStates.OTP_VERIFICATION) {
              // OTP verification successful
              const profile = await AuthStateMachine.checkUserProfile(session.user.id);

              if (profile?.linked_profile_id) {
                await AuthStateMachine.transition(AuthStates.PROFILE_LINKED, {
                  user: session.user,
                  profile
                });
              } else if (profile?.status === 'pending') {
                await AuthStateMachine.transition(AuthStates.PENDING_APPROVAL, {
                  user: session.user
                });
              } else {
                await AuthStateMachine.transition(AuthStates.PROFILE_LINKING, {
                  user: session.user
                });
              }
            }
            break;

          case 'SIGNED_OUT':
            await AuthStateMachine.transition(AuthStates.UNAUTHENTICATED);
            break;

          case 'TOKEN_REFRESHED':
            // Token refreshed successfully
            console.log('[DEBUG AuthContext] Token refreshed');
            break;

          case 'USER_UPDATED':
            // User data updated
            const currentState = AuthStateMachine.getState();
            if (currentState.data.user) {
              currentState.data.user = session.user;
            }
            break;
        }
      });
    };

    initializeAuth();

    // Cleanup
    return () => {
      console.log('[DEBUG AuthContext] Unmounting AuthProvider');
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (authListenerRef.current) {
        authListenerRef.current.data.subscription.unsubscribe();
      }
    };
  }, []);

  // Computed values based on state
  const user = authState.data?.user || null;
  const profile = authState.data?.profile || null;

  const hasLinkedProfile = authState.current === AuthStates.PROFILE_LINKED;
  const hasPendingRequest = authState.current === AuthStates.PENDING_APPROVAL;
  const isGuestMode = authState.current === AuthStates.GUEST_MODE;
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isSuperAdmin = profile?.role === 'super_admin';

  // Auth actions
  const signInWithPhone = async (phone) => {
    await AuthStateMachine.navigateToPhoneAuth();
    return AuthStateMachine.signInWithPhone(phone);
  };

  const verifyOTP = async (phone, otp) => {
    return AuthStateMachine.verifyOTP(phone, otp);
  };

  const signOut = async () => {
    return AuthStateMachine.signOut();
  };

  const enterGuestMode = async () => {
    return AuthStateMachine.enterGuestMode();
  };

  const exitGuestMode = async () => {
    return AuthStateMachine.exitGuestMode();
  };

  const linkProfile = async (profileId) => {
    return AuthStateMachine.linkProfile(profileId);
  };

  const startOnboarding = async () => {
    return AuthStateMachine.startOnboarding();
  };

  const value = {
    // State
    authState: authState.current,
    authStateData: authState.data,
    isLoading,

    // User data
    user,
    profile,
    hasLinkedProfile,
    hasPendingRequest,
    isGuestMode,
    isAdmin,
    isSuperAdmin,

    // Actions
    signInWithPhone,
    verifyOTP,
    signOut,
    enterGuestMode,
    exitGuestMode,
    linkProfile,
    startOnboarding,

    // State machine access (for advanced usage)
    stateMachine: AuthStateMachine,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};