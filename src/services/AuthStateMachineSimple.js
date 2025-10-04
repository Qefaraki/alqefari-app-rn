/**
 * Simplified Auth State Machine
 *
 * Core states only:
 * - INITIALIZING: Checking stored auth state
 * - UNAUTHENTICATED: No active session
 * - AUTHENTICATED: Has active session
 * - GUEST_MODE: Guest access
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { featureFlags } from '../config/featureFlags';

export const AuthStates = {
  INITIALIZING: 'INITIALIZING',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  AUTHENTICATED: 'AUTHENTICATED',
  GUEST_MODE: 'GUEST_MODE',
};

class AuthStateMachine {
  constructor() {
    this.currentState = AuthStates.INITIALIZING;
    this.user = null;
    this.profile = null;
    this.listeners = [];
    this.isInitialized = false;
    this.lastNotifiedState = null;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify(forceNotify = false) {
    // Only notify if state actually changed or forced
    const currentStateString = JSON.stringify({
      state: this.currentState,
      userId: this.user?.id,
      profileId: this.profile?.id
    });

    if (!forceNotify && this.lastNotifiedState === currentStateString) {
      console.log('[AuthStateMachine] Skipping duplicate notification');
      return;
    }

    this.lastNotifiedState = currentStateString;
    this.listeners.forEach(listener => listener({
      state: this.currentState,
      user: this.user,
      profile: this.profile
    }));
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('[AuthStateMachine] Already initialized, skipping');
      return;
    }

    console.log('[AuthStateMachine] Initializing...');
    this.isInitialized = true;

    try {
      // Check guest mode first
      const isGuestMode = await AsyncStorage.getItem('isGuestMode');
      if (isGuestMode === 'true') {
        console.log('[AuthStateMachine] Restoring guest mode');
        this.currentState = AuthStates.GUEST_MODE;
        this.notify(true); // Force notify
        return;
      }

      // Check for existing session
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        console.log('[AuthStateMachine] Session found, user authenticated');
        this.user = session.user;

        // Try to get profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        this.profile = profile;
        this.currentState = AuthStates.AUTHENTICATED;

        // Sync onboarding status with profile link status
        if (profile?.linked_profile_id) {
          await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
        } else {
          await AsyncStorage.removeItem('hasCompletedOnboarding');
        }
      } else {
        console.log('[AuthStateMachine] No session found');
        this.currentState = AuthStates.UNAUTHENTICATED;
      }
    } catch (error) {
      console.error('[AuthStateMachine] Error initializing:', error);
      this.currentState = AuthStates.UNAUTHENTICATED;
    }

    this.notify(true); // Force notify
  }

  async signIn(user, profile = null) {
    console.log('[AuthStateMachine] User signed in', { userId: user?.id, hasProfile: !!profile });
    this.user = user;
    this.profile = profile;
    this.currentState = AuthStates.AUTHENTICATED;

    // Check for pending link request if no profile
    if (!profile && user && featureFlags.profileLinkRequests) {
      try {
        const { data: pendingRequest } = await supabase
          .from('profile_link_requests')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .single();

        if (pendingRequest) {
          // Mark as having a pending request
          this.profile = { status: 'pending' };
          console.log('[AuthStateMachine] User has pending link request');
        }
      } catch (error) {
        // No pending request or error - that's ok
      }
    }

    // Simple: has profile = completed onboarding
    if (profile && profile.id) {
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    } else {
      await AsyncStorage.removeItem('hasCompletedOnboarding');
    }

    this.notify(true); // Force notify
  }

  async signOut() {
    console.log('[AuthStateMachine] Signing out - clearing ALL data');
    this.user = null;
    this.profile = null;
    this.currentState = AuthStates.UNAUTHENTICATED;

    // Clear ALL stored data to prevent data bleeding between sessions
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys);
      console.log('[AuthStateMachine] Cleared all AsyncStorage keys:', keys.length);
    } catch (error) {
      console.error('[AuthStateMachine] Error clearing storage:', error);
      // Fallback to specific keys
      await AsyncStorage.multiRemove([
        'hasCompletedOnboarding',
        'isGuestMode',
        'supabase.auth.token'
      ]);
    }

    this.notify(true); // Force notify
  }

  async enterGuestMode() {
    console.log('[AuthStateMachine] Entering guest mode');
    try {
      await AsyncStorage.setItem('isGuestMode', 'true');
    } catch (error) {
      console.error('[AuthStateMachine] Error setting guest mode:', error);
      // Still enter guest mode even if storage fails
    }
    // Guest mode is separate from onboarding - don't conflate them
    this.currentState = AuthStates.GUEST_MODE;
    this.notify(true); // Force notify
  }

  async exitGuestMode() {
    console.log('[AuthStateMachine] Exiting guest mode');
    await AsyncStorage.removeItem('isGuestMode');
    await AsyncStorage.removeItem('hasCompletedOnboarding');
    this.currentState = AuthStates.UNAUTHENTICATED;
    this.notify(true); // Force notify
  }

  getState() {
    return {
      state: this.currentState,
      user: this.user,
      profile: this.profile
    };
  }

  // Helper to check if user has a profile
  hasLinkedProfile() {
    return this.profile?.id != null;
  }

  // Helper to check if pending approval
  isPendingApproval() {
    return this.profile?.status === 'pending';
  }
}

// Export singleton instance
export default new AuthStateMachine();
