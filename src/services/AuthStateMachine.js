/**
 * AuthStateMachine - Single source of truth for authentication state
 *
 * This state machine handles all authentication flows and edge cases,
 * providing a predictable and maintainable auth system.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// All possible authentication states
export const AuthStates = {
  // Initial states
  INITIALIZING: 'INITIALIZING',           // App is starting, checking stored session

  // Unauthenticated states
  UNAUTHENTICATED: 'UNAUTHENTICATED',     // No user session
  ONBOARDING: 'ONBOARDING',               // Showing onboarding screens
  PHONE_AUTH: 'PHONE_AUTH',               // Entering phone number
  OTP_VERIFICATION: 'OTP_VERIFICATION',   // Entering OTP code

  // Authenticated states
  AUTHENTICATED: 'AUTHENTICATED',         // User signed in, checking profile (deprecated - use specific states)
  AUTHENTICATED_NO_PROFILE: 'AUTHENTICATED_NO_PROFILE', // User signed in but has no profile at all
  AUTHENTICATED_WITH_PROFILE: 'AUTHENTICATED_WITH_PROFILE', // User signed in and has profile
  PROFILE_LINKING: 'PROFILE_LINKING',     // Selecting/creating profile
  PENDING_APPROVAL: 'PENDING_APPROVAL',   // Waiting for admin approval
  PROFILE_LINKED: 'PROFILE_LINKED',       // Has complete profile

  // Special states
  GUEST_MODE: 'GUEST_MODE',               // Browsing without account
  ERROR: 'ERROR',                         // Error state with recovery options
  SESSION_EXPIRED: 'SESSION_EXPIRED',     // Token expired, needs refresh
};

// Valid transitions between states
const StateTransitions = {
  [AuthStates.INITIALIZING]: [
    AuthStates.UNAUTHENTICATED,
    AuthStates.AUTHENTICATED,
    AuthStates.GUEST_MODE,
    AuthStates.ERROR,
  ],

  [AuthStates.UNAUTHENTICATED]: [
    AuthStates.ONBOARDING,
    AuthStates.PHONE_AUTH,  // Allow direct phone auth
    AuthStates.AUTHENTICATED,  // Allow for direct sign in
    AuthStates.AUTHENTICATED_NO_PROFILE,  // New user signed in
    AuthStates.AUTHENTICATED_WITH_PROFILE,  // Existing user signed in
    AuthStates.PROFILE_LINKED,  // Allow for existing sessions
    AuthStates.PROFILE_LINKING,  // Allow for users needing to link
    AuthStates.PENDING_APPROVAL,  // Allow for pending users
    AuthStates.GUEST_MODE,
    AuthStates.ERROR,
  ],

  [AuthStates.ONBOARDING]: [
    AuthStates.PHONE_AUTH,
    AuthStates.GUEST_MODE,
    AuthStates.UNAUTHENTICATED,
  ],

  [AuthStates.PHONE_AUTH]: [
    AuthStates.OTP_VERIFICATION,
    AuthStates.ONBOARDING,
    AuthStates.ERROR,
  ],

  [AuthStates.OTP_VERIFICATION]: [
    AuthStates.AUTHENTICATED,
    AuthStates.AUTHENTICATED_NO_PROFILE,
    AuthStates.AUTHENTICATED_WITH_PROFILE,
    AuthStates.PROFILE_LINKED,
    AuthStates.PROFILE_LINKING,
    AuthStates.PENDING_APPROVAL,
    AuthStates.PHONE_AUTH,
    AuthStates.ERROR,
  ],

  [AuthStates.AUTHENTICATED]: [
    AuthStates.PROFILE_LINKED,
    AuthStates.PROFILE_LINKING,
    AuthStates.PENDING_APPROVAL,
    AuthStates.AUTHENTICATED,  // Allow self-transition for retries
    AuthStates.AUTHENTICATED_NO_PROFILE,
    AuthStates.AUTHENTICATED_WITH_PROFILE,
    AuthStates.UNAUTHENTICATED,
    AuthStates.SESSION_EXPIRED,
  ],

  [AuthStates.AUTHENTICATED_NO_PROFILE]: [
    AuthStates.PROFILE_LINKING,
    AuthStates.PENDING_APPROVAL,
    AuthStates.UNAUTHENTICATED,
    AuthStates.SESSION_EXPIRED,
  ],

  [AuthStates.AUTHENTICATED_WITH_PROFILE]: [
    AuthStates.PROFILE_LINKED,
    AuthStates.PENDING_APPROVAL,
    AuthStates.UNAUTHENTICATED,
    AuthStates.SESSION_EXPIRED,
  ],

  [AuthStates.PROFILE_LINKING]: [
    AuthStates.PENDING_APPROVAL,
    AuthStates.PROFILE_LINKED,
    AuthStates.AUTHENTICATED,
    AuthStates.ERROR,
  ],

  [AuthStates.PENDING_APPROVAL]: [
    AuthStates.PROFILE_LINKED,
    AuthStates.PENDING_APPROVAL,  // Allow self-transition for refresh
    AuthStates.UNAUTHENTICATED,
  ],

  [AuthStates.PROFILE_LINKED]: [
    AuthStates.PROFILE_LINKED,  // Allow self-transition for refresh
    AuthStates.UNAUTHENTICATED,
    AuthStates.SESSION_EXPIRED,
  ],

  [AuthStates.GUEST_MODE]: [
    AuthStates.ONBOARDING,
    AuthStates.PHONE_AUTH,
    AuthStates.UNAUTHENTICATED,
  ],

  [AuthStates.ERROR]: [
    AuthStates.INITIALIZING,
    AuthStates.UNAUTHENTICATED,
  ],

  [AuthStates.SESSION_EXPIRED]: [
    AuthStates.AUTHENTICATED,
    AuthStates.UNAUTHENTICATED,
  ],
};

class AuthStateMachine {
  constructor() {
    this.currentState = AuthStates.INITIALIZING;
    this.previousState = null;
    this.stateData = {};
    this.listeners = new Set();
    this.errorRetryCount = 0;
    this.maxRetries = 3;
  }

  // Get current state
  getState() {
    return {
      current: this.currentState,
      previous: this.previousState,
      data: this.stateData,
    };
  }

  // Subscribe to state changes
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners of state change
  notifyListeners() {
    this.listeners.forEach(listener => {
      listener(this.getState());
    });
  }

  // Validate state transition
  canTransition(toState) {
    const validTransitions = StateTransitions[this.currentState] || [];
    return validTransitions.includes(toState);
  }

  // Transition to new state
  async transition(toState, data = {}) {
    console.log(`[AuthStateMachine] Transition request from ${this.currentState} to ${toState}`, data);

    // If already in the target state, just update the data
    if (this.currentState === toState) {
      console.log(`[AuthStateMachine] Already in state ${toState}, updating data only`);
      this.stateData = { ...this.stateData, ...data };
      await this.persistState();
      this.notifyListeners();
      return true;
    }

    if (!this.canTransition(toState)) {
      console.error(`[AuthStateMachine] Invalid transition from ${this.currentState} to ${toState}`);
      return false;
    }

    this.previousState = this.currentState;
    this.currentState = toState;
    this.stateData = { ...this.stateData, ...data };

    // Persist state for recovery
    await this.persistState();

    // Handle state-specific side effects
    await this.handleStateEffects(toState);

    this.notifyListeners();
    return true;
  }

  // Handle side effects for state transitions
  async handleStateEffects(state) {
    switch (state) {
      case AuthStates.UNAUTHENTICATED:
        // Clear all auth data
        await AsyncStorage.multiRemove([
          'hasCompletedOnboarding',
          'isGuestMode',
          'authState',
        ]);
        this.stateData = {};
        break;

      case AuthStates.GUEST_MODE:
        await AsyncStorage.setItem('isGuestMode', 'true');
        await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
        break;

      case AuthStates.PROFILE_LINKED:
        await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
        await AsyncStorage.removeItem('isGuestMode');
        break;

      case AuthStates.SESSION_EXPIRED:
        // Try to refresh session
        await this.handleSessionRefresh();
        break;

      case AuthStates.ERROR:
        // Implement exponential backoff for retries
        this.errorRetryCount++;
        if (this.errorRetryCount < this.maxRetries) {
          setTimeout(() => this.recoverFromError(), Math.pow(2, this.errorRetryCount) * 1000);
        }
        break;
    }
  }

  // Initialize auth state on app start
  async initialize() {
    try {
      console.log('[AuthStateMachine] Initializing...');

      // Check for existing session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[AuthStateMachine] Session check error:', error);
        return this.transition(AuthStates.ERROR, { error: error.message });
      }

      // Check stored preferences
      const [hasCompletedOnboarding, isGuestMode, storedAuthState] = await Promise.all([
        AsyncStorage.getItem('hasCompletedOnboarding'),
        AsyncStorage.getItem('isGuestMode'),
        AsyncStorage.getItem('authState'),
      ]);

      // Restore from stored state if exists
      let restoredState = null;
      if (storedAuthState) {
        try {
          const stored = JSON.parse(storedAuthState);
          if (Date.now() - stored.timestamp < 24 * 60 * 60 * 1000) { // 24 hours
            this.currentState = stored.state;
            this.stateData = stored.data;
            restoredState = stored.state;
            console.log('[AuthStateMachine] Restored state:', restoredState);
          }
        } catch (e) {
          console.error('[AuthStateMachine] Failed to restore state:', e);
        }
      }

      // Determine target state based on session
      if (session) {
        // User is authenticated
        const profile = await this.checkUserProfile(session.user.id);
        let targetState = null;
        let targetData = {};

        if (profile?.linked_profile_id) {
          targetState = AuthStates.PROFILE_LINKED;
          targetData = { user: session.user, profile };
        } else if (profile?.status === 'pending') {
          targetState = AuthStates.PENDING_APPROVAL;
          targetData = { user: session.user, profile };
        } else if (profile) {
          // Has profile but not linked to family tree
          targetState = AuthStates.PROFILE_LINKING;
          targetData = { user: session.user, profile };
        } else {
          // No profile at all - use specific state
          targetState = AuthStates.AUTHENTICATED_NO_PROFILE;
          targetData = { user: session.user };
        }

        // Only transition if needed
        if (targetState) {
          return this.transition(targetState, targetData);
        }
      } else if (isGuestMode === 'true') {
        return this.transition(AuthStates.GUEST_MODE);
      } else if (hasCompletedOnboarding === 'true') {
        return this.transition(AuthStates.UNAUTHENTICATED);
      } else {
        return this.transition(AuthStates.UNAUTHENTICATED);
      }
    } catch (error) {
      console.error('[AuthStateMachine] Initialization error:', error);
      return this.transition(AuthStates.ERROR, { error: error.message });
    }
  }

  // Check user profile status
  async checkUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, name, role, hid')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[AuthStateMachine] Profile check error:', error);
      }

      // Check for pending link requests
      if (data) {
        const { data: linkRequest } = await supabase
          .from('profile_link_requests')
          .select('status')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .single();

        if (linkRequest) {
          data.status = 'pending';
        }

        // Consider profile linked if they have an HID
        data.linked_profile_id = data.hid ? data.id : null;
      }

      return data;
    } catch (error) {
      console.error('[AuthStateMachine] Profile check failed:', error);
      return null;
    }
  }

  // Handle session refresh
  async handleSessionRefresh() {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();

      if (session) {
        const profile = await this.checkUserProfile(session.user.id);

        if (profile?.linked_profile_id) {
          return this.transition(AuthStates.PROFILE_LINKED, {
            user: session.user,
            profile
          });
        } else {
          return this.transition(AuthStates.AUTHENTICATED, {
            user: session.user
          });
        }
      } else {
        return this.transition(AuthStates.UNAUTHENTICATED);
      }
    } catch (error) {
      console.error('[AuthStateMachine] Session refresh failed:', error);
      return this.transition(AuthStates.UNAUTHENTICATED);
    }
  }

  // Recover from error state
  async recoverFromError() {
    console.log('[AuthStateMachine] Attempting error recovery...');
    this.errorRetryCount = 0;
    return this.initialize();
  }

  // Persist current state for recovery
  async persistState() {
    try {
      const stateToStore = {
        state: this.currentState,
        data: this.stateData,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem('authState', JSON.stringify(stateToStore));
    } catch (error) {
      console.error('[AuthStateMachine] Failed to persist state:', error);
    }
  }

  // Sign in with phone
  async signInWithPhone(phone) {
    if (this.currentState !== AuthStates.PHONE_AUTH) {
      console.error('[AuthStateMachine] Invalid state for phone sign in');
      return false;
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          channel: 'sms',
        }
      });

      if (error) throw error;

      return this.transition(AuthStates.OTP_VERIFICATION, { phone });
    } catch (error) {
      console.error('[AuthStateMachine] Phone sign in failed:', error);
      return this.transition(AuthStates.ERROR, { error: error.message });
    }
  }

  // Verify OTP
  async verifyOTP(phone, otp) {
    if (this.currentState !== AuthStates.OTP_VERIFICATION) {
      console.error('[AuthStateMachine] Invalid state for OTP verification');
      return false;
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });

      if (error) throw error;

      // Don't transition here - the auth listener in AuthContext will handle it
      // This prevents race conditions and ensures single source of truth
      console.log('[AuthStateMachine] OTP verified successfully, waiting for auth listener to handle transition');
      return true;
    } catch (error) {
      console.error('[AuthStateMachine] OTP verification failed:', error);
      return this.transition(AuthStates.ERROR, { error: error.message });
    }
  }

  // Sign out
  async signOut() {
    try {
      await supabase.auth.signOut();
      return this.transition(AuthStates.UNAUTHENTICATED);
    } catch (error) {
      console.error('[AuthStateMachine] Sign out failed:', error);
      return this.transition(AuthStates.ERROR, { error: error.message });
    }
  }

  // Enter guest mode
  async enterGuestMode() {
    return this.transition(AuthStates.GUEST_MODE);
  }

  // Exit guest mode
  async exitGuestMode() {
    await AsyncStorage.removeItem('isGuestMode');
    return this.transition(AuthStates.ONBOARDING);
  }

  // Start onboarding
  async startOnboarding() {
    if (this.currentState === AuthStates.UNAUTHENTICATED) {
      return this.transition(AuthStates.ONBOARDING);
    }
    return false;
  }

  // Navigate to phone auth
  async navigateToPhoneAuth() {
    if (this.currentState === AuthStates.ONBOARDING ||
        this.currentState === AuthStates.GUEST_MODE) {
      return this.transition(AuthStates.PHONE_AUTH);
    }
    return false;
  }

  // Link profile
  async linkProfile(profileId) {
    if (this.currentState !== AuthStates.AUTHENTICATED &&
        this.currentState !== AuthStates.PROFILE_LINKING) {
      console.error('[AuthStateMachine] Invalid state for profile linking');
      return false;
    }

    try {
      // Implementation depends on your profile linking logic
      return this.transition(AuthStates.PENDING_APPROVAL, { profileId });
    } catch (error) {
      console.error('[AuthStateMachine] Profile linking failed:', error);
      return this.transition(AuthStates.ERROR, { error: error.message });
    }
  }

  // Get navigation screen for current state
  getScreenForState() {
    switch (this.currentState) {
      case AuthStates.INITIALIZING:
        return 'Loading';
      case AuthStates.UNAUTHENTICATED:
      case AuthStates.ONBOARDING:
        return 'Onboarding';
      case AuthStates.PHONE_AUTH:
        return 'PhoneAuth';
      case AuthStates.OTP_VERIFICATION:
        return 'OTPVerification';
      case AuthStates.AUTHENTICATED: // Deprecated - but fallback to ProfileLinking
      case AuthStates.AUTHENTICATED_NO_PROFILE:
      case AuthStates.PROFILE_LINKING:
        return 'ProfileLinking';
      case AuthStates.AUTHENTICATED_WITH_PROFILE:
      case AuthStates.PROFILE_LINKED:
      case AuthStates.GUEST_MODE:
        return 'MainApp';
      case AuthStates.PENDING_APPROVAL:
        return 'ContactAdmin';
      case AuthStates.ERROR:
        return 'Error';
      case AuthStates.SESSION_EXPIRED:
        return 'Loading';
      default:
        return 'Onboarding';
    }
  }

  // Check if user can access main app
  canAccessMainApp() {
    return [
      AuthStates.PROFILE_LINKED,
      AuthStates.GUEST_MODE,
    ].includes(this.currentState);
  }

  // Check if user is authenticated
  isAuthenticated() {
    return [
      AuthStates.AUTHENTICATED,
      AuthStates.PROFILE_LINKING,
      AuthStates.PENDING_APPROVAL,
      AuthStates.PROFILE_LINKED,
    ].includes(this.currentState);
  }

  // Reset state machine
  reset() {
    this.currentState = AuthStates.INITIALIZING;
    this.previousState = null;
    this.stateData = {};
    this.errorRetryCount = 0;
  }
}

// Export singleton instance
export default new AuthStateMachine();