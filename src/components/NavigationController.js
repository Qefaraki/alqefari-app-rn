/**
 * NavigationController - State-Driven Navigation System
 *
 * This component listens to authentication state changes and automatically
 * navigates to the appropriate screen. It's the single source of truth for
 * navigation decisions, eliminating race conditions and stuck states.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { AuthStates } from '../services/AuthStateMachine';

// Complete mapping of states to screens
const STATE_TO_SCREEN_MAP = {
  [AuthStates.INITIALIZING]: null, // Stay on splash
  [AuthStates.UNAUTHENTICATED]: 'Onboarding',
  [AuthStates.ONBOARDING]: 'Onboarding',
  [AuthStates.PHONE_AUTH]: 'PhoneAuth',
  [AuthStates.OTP_VERIFICATION]: 'PhoneAuth', // Same screen, different step
  [AuthStates.AUTHENTICATED]: 'ProfileLinking', // User needs to link profile
  [AuthStates.AUTHENTICATED_NO_PROFILE]: 'ProfileLinking', // Clear intent
  [AuthStates.PROFILE_LINKING]: 'ProfileLinking',
  [AuthStates.PENDING_APPROVAL]: 'ContactAdmin',
  [AuthStates.PROFILE_LINKED]: null, // Main app (handled by root layout)
  [AuthStates.GUEST_MODE]: null, // Main app (handled by root layout)
  [AuthStates.SESSION_EXPIRED]: 'Onboarding',
  [AuthStates.ERROR]: 'Onboarding', // Fallback to onboarding
};

// States that should reset the navigation stack
const RESET_STACK_STATES = [
  AuthStates.UNAUTHENTICATED,
  AuthStates.AUTHENTICATED,
  AuthStates.PROFILE_LINKED,
  AuthStates.GUEST_MODE,
  AuthStates.SESSION_EXPIRED,
];

export default function NavigationController() {
  const navigation = useNavigation();
  const { authState, authStateData, user } = useAuth();
  const lastNavigatedStateRef = useRef(null);
  const isNavigatingRef = useRef(false);

  // Get the current route name
  const getCurrentRouteName = useCallback(() => {
    const state = navigation.getState();
    if (!state || !state.routes || state.routes.length === 0) {
      return null;
    }
    return state.routes[state.index]?.name;
  }, [navigation]);

  // Navigate based on state
  const navigateToScreen = useCallback((screenName, params = {}) => {
    if (isNavigatingRef.current) {
      console.log('[NavigationController] Already navigating, skipping');
      return;
    }

    const currentRoute = getCurrentRouteName();
    console.log(`[NavigationController] Current: ${currentRoute}, Target: ${screenName}, State: ${authState}`);

    // Don't navigate if already on the correct screen
    if (currentRoute === screenName) {
      console.log('[NavigationController] Already on target screen');
      return;
    }

    isNavigatingRef.current = true;

    try {
      // Determine if we should reset the stack
      if (RESET_STACK_STATES.includes(authState)) {
        // Reset the entire navigation stack
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: screenName, params }],
          })
        );
        console.log(`[NavigationController] Reset stack to ${screenName}`);
      } else {
        // Regular navigation
        navigation.navigate(screenName, params);
        console.log(`[NavigationController] Navigated to ${screenName}`);
      }
    } catch (error) {
      console.error('[NavigationController] Navigation error:', error);
    } finally {
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 500); // Debounce navigation
    }
  }, [authState, navigation, getCurrentRouteName]);

  // Main effect: Handle state-based navigation
  useEffect(() => {
    // Skip if still initializing
    if (authState === AuthStates.INITIALIZING) {
      console.log('[NavigationController] Still initializing, skipping');
      return;
    }

    // Skip if we've already handled this state
    if (lastNavigatedStateRef.current === authState) {
      console.log('[NavigationController] Already handled this state');
      return;
    }

    // Get target screen for current state
    const targetScreen = STATE_TO_SCREEN_MAP[authState];

    // null means the main app will handle it (tabs)
    if (targetScreen === null) {
      console.log(`[NavigationController] State ${authState} handled by main app`);
      lastNavigatedStateRef.current = authState;
      return;
    }

    // undefined means unknown state
    if (targetScreen === undefined) {
      console.error(`[NavigationController] Unknown state: ${authState}`);
      return;
    }

    // Prepare navigation params based on state
    let navigationParams = {};

    if (targetScreen === 'ProfileLinking') {
      // Pass user data to ProfileLinking screen
      navigationParams = {
        user: user || authStateData?.user,
        fromAuth: true,
      };
    } else if (targetScreen === 'ContactAdmin') {
      navigationParams = {
        reason: authStateData?.profile?.status || 'pending',
        user: user || authStateData?.user,
      };
    }

    // Delay navigation slightly to ensure state has settled
    const navigationTimer = setTimeout(() => {
      navigateToScreen(targetScreen, navigationParams);
      lastNavigatedStateRef.current = authState;
    }, 100);

    return () => clearTimeout(navigationTimer);
  }, [authState, authStateData, user, navigateToScreen]);

  // Handle special cases: Back navigation prevention
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Prevent going back during critical states
      const preventBackStates = [
        AuthStates.OTP_VERIFICATION,
        AuthStates.PROFILE_LINKING,
        AuthStates.PENDING_APPROVAL,
      ];

      if (preventBackStates.includes(authState)) {
        console.log('[NavigationController] Preventing back navigation during:', authState);
        e.preventDefault();
      }
    });

    return unsubscribe;
  }, [navigation, authState]);

  // This component doesn't render anything
  return null;
}