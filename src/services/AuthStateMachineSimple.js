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
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener({
      state: this.currentState,
      user: this.user,
      profile: this.profile
    }));
  }

  async initialize() {
    console.log('[AuthStateMachine] Initializing...');

    try {
      // Check guest mode first
      const isGuestMode = await AsyncStorage.getItem('isGuestMode');
      if (isGuestMode === 'true') {
        console.log('[AuthStateMachine] Restoring guest mode');
        this.currentState = AuthStates.GUEST_MODE;
        this.notify();
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
      } else {
        console.log('[AuthStateMachine] No session found');
        this.currentState = AuthStates.UNAUTHENTICATED;
      }
    } catch (error) {
      console.error('[AuthStateMachine] Error initializing:', error);
      this.currentState = AuthStates.UNAUTHENTICATED;
    }

    this.notify();
  }

  async signIn(user, profile = null) {
    console.log('[AuthStateMachine] User signed in');
    this.user = user;
    this.profile = profile;
    this.currentState = AuthStates.AUTHENTICATED;
    this.notify();
  }

  async signOut() {
    console.log('[AuthStateMachine] Signing out');
    this.user = null;
    this.profile = null;
    this.currentState = AuthStates.UNAUTHENTICATED;

    // Clear stored data
    await AsyncStorage.multiRemove([
      'hasCompletedOnboarding',
      'isGuestMode'
    ]);

    this.notify();
  }

  async enterGuestMode() {
    console.log('[AuthStateMachine] Entering guest mode');
    await AsyncStorage.setItem('isGuestMode', 'true');
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    this.currentState = AuthStates.GUEST_MODE;
    this.notify();
  }

  async exitGuestMode() {
    console.log('[AuthStateMachine] Exiting guest mode');
    await AsyncStorage.removeItem('isGuestMode');
    await AsyncStorage.removeItem('hasCompletedOnboarding');
    this.currentState = AuthStates.UNAUTHENTICATED;
    this.notify();
  }

  getState() {
    return {
      state: this.currentState,
      user: this.user,
      profile: this.profile
    };
  }

  // Helper to check if user has linked profile
  hasLinkedProfile() {
    return this.profile?.linked_profile_id != null;
  }

  // Helper to check if pending approval
  isPendingApproval() {
    return this.profile?.status === 'pending';
  }
}

// Export singleton instance
export default new AuthStateMachine();