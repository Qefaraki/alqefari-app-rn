import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "../services/supabase";
import AuthStateMachine, { AuthStates } from "../services/AuthStateMachine";
import subscriptionManager from "../services/subscriptionManager";
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
  const profileSubscriptionRef = useRef(null);
  const isHandlingAuthChangeRef = useRef(false); // Prevent duplicate handling
  const lastEventRef = useRef(null); // Track last handled event

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
        console.log('[DEBUG AuthContext] Auth state change:', event, 'Current state:', AuthStateMachine.currentState);

        // Prevent duplicate handling of the same event
        if (isHandlingAuthChangeRef.current) {
          console.log('[DEBUG AuthContext] Already handling auth change, skipping duplicate event');
          return;
        }

        // Skip if this is the same event we just handled
        if (lastEventRef.current === event && lastEventRef.current === 'SIGNED_IN') {
          console.log('[DEBUG AuthContext] Duplicate SIGNED_IN event, skipping');
          return;
        }

        isHandlingAuthChangeRef.current = true;
        lastEventRef.current = event;

        // Skip INITIAL_SESSION as it's handled by initialize()
        if (event === 'INITIAL_SESSION') {
          console.log('[DEBUG AuthContext] Skipping INITIAL_SESSION (handled by initialize)');
          isHandlingAuthChangeRef.current = false; // Reset flag
          return;
        }

        try {
          switch (event) {
            case 'SIGNED_IN':
              // Handle sign in from any state
              if (session?.user) {
                console.log('[DEBUG AuthContext] User signed in, checking profile...');
                const profile = await AuthStateMachine.checkUserProfile(session.user.id);
                console.log('[DEBUG AuthContext] Profile check result:', profile);

                // Determine the appropriate state based on profile
                if (profile?.linked_profile_id) {
                  console.log('[DEBUG AuthContext] User has linked profile, transitioning to PROFILE_LINKED');
                  await AuthStateMachine.transition(AuthStates.PROFILE_LINKED, {
                    user: session.user,
                    profile
                  });
                } else if (profile?.status === 'pending') {
                  console.log('[DEBUG AuthContext] User has pending approval, transitioning to PENDING_APPROVAL');
                  await AuthStateMachine.transition(AuthStates.PENDING_APPROVAL, {
                    user: session.user,
                    profile
                  });
                } else if (profile) {
                  console.log('[DEBUG AuthContext] User has profile but not linked, transitioning to PROFILE_LINKING');
                  await AuthStateMachine.transition(AuthStates.PROFILE_LINKING, {
                    user: session.user,
                    profile
                  });
                } else {
                  console.log('[DEBUG AuthContext] User has no profile, transitioning to AUTHENTICATED_NO_PROFILE');
                  await AuthStateMachine.transition(AuthStates.AUTHENTICATED_NO_PROFILE, {
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
        } finally {
          // Always reset the flag after handling
          isHandlingAuthChangeRef.current = false;
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
      if (profileSubscriptionRef.current) {
        profileSubscriptionRef.current.unsubscribe();
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

  // React to profile updates pushed from Supabase (e.g., admin approving link requests)
  useEffect(() => {
    const subscribeToProfileUpdates = async () => {
      if (!user?.id) {
        if (profileSubscriptionRef.current) {
          profileSubscriptionRef.current.unsubscribe();
          profileSubscriptionRef.current = null;
        }
        return;
      }

      if (profileSubscriptionRef.current) {
        profileSubscriptionRef.current.unsubscribe();
        profileSubscriptionRef.current = null;
      }

      profileSubscriptionRef.current = await subscriptionManager.subscribe({
        channelName: `auth-profile-watch-${user.id}`,
        table: 'profiles',
        filter: `user_id=eq.${user.id}`,
        event: '*',
        component: { id: 'AuthContextProfileSubscription' },
        onUpdate: async () => {
          try {
            const refreshedProfile = await AuthStateMachine.checkUserProfile(user.id);

            if (!refreshedProfile) {
              return;
            }

            let targetState = null;
            const targetData = { user, profile: refreshedProfile };

            if (refreshedProfile?.linked_profile_id) {
              targetState = AuthStates.PROFILE_LINKED;
            } else if (refreshedProfile?.status === 'pending') {
              targetState = AuthStates.PENDING_APPROVAL;
            } else {
              targetState = AuthStates.PROFILE_LINKING;
            }

            if (targetState) {
              await AuthStateMachine.transition(targetState, targetData);
            }
          } catch (error) {
            console.error('[AuthContext] Failed to refresh profile after realtime update:', error);
          }
        },
        onError: (error) => {
          console.error('[AuthContext] Profile subscription error:', error);
        }
      });
    };

    subscribeToProfileUpdates();

    return () => {
      if (profileSubscriptionRef.current) {
        profileSubscriptionRef.current.unsubscribe();
        profileSubscriptionRef.current = null;
      }
    };
  }, [user?.id]);

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
