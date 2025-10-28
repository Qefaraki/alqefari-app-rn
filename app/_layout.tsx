import "../global.css"; // Import global CSS for NativeWind styles
import React, { useEffect, Component, useRef } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../src/contexts/AuthContextSimple";
import { AdminModeProvider } from "../src/contexts/AdminModeContext";
import { SettingsProvider } from "../src/contexts/SettingsContext";
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import BrandedErrorScreen from "../src/components/ui/BrandedErrorScreen";
import Toast from 'react-native-toast-message';
import { useNetworkStore } from "../src/stores/networkStore";
import NetworkStatusIndicator from "../src/components/NetworkStatusIndicator";
import subscriptionManager from "../src/services/subscriptionManager";
import * as Linking from 'expo-linking';
import { handleDeepLink, parseProfileLink, parseInviterShareCode } from '../src/utils/deepLinking';
import { featureFlags } from '../src/config/featureFlags';

// Keep the splash screen visible while we determine auth state
SplashScreen.preventAutoHideAsync();

// Error Boundary to catch and display any silent errors
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    console.error('[DEBUG ErrorBoundary] Caught error:', error);
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[DEBUG ErrorBoundary] Error details:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <BrandedErrorScreen
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={() => this.setState({ hasError: false, error: null, errorInfo: null })}
        />
      );
    }

    return this.props.children;
  }
}

function RootLayoutNav() {
  const { user, profile, isLoading, hasCompletedOnboarding, isGuestMode, isPendingApproval } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const lastNavigationRef = useRef<string | null>(null);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if we're ready to make routing decisions
  const isReady = !isLoading && hasCompletedOnboarding !== null;

  // Initialize network monitoring on app start
  useEffect(() => {
    const networkStore = useNetworkStore.getState();
    networkStore.initialize();

    // Initialize subscription manager network listener
    // This allows graceful pause/resume of all subscriptions on network changes
    subscriptionManager.initializeNetworkListener();

    // Cleanup listeners on unmount
    return () => {
      networkStore.cleanup();
      subscriptionManager.cleanup();
    };
  }, []);

  // Deep linking setup - Handle QR code scans and profile links
  useEffect(() => {
    if (!featureFlags.enableDeepLinking) {
      console.log('[DeepLink] Feature disabled');
      return;
    }

    let isMounted = true;

    // Handle app opened via deep link (cold start)
    const handleInitialURL = async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url && isMounted) {
          console.log('[DeepLink] Initial URL (cold start):', url);
          const shareCode = parseProfileLink(url);
          const inviterShareCode = parseInviterShareCode(url);
          if (shareCode) {
            // Wait for auth and tree to be ready
            if (!isLoading && user) {
              setTimeout(() => handleDeepLink(shareCode, inviterShareCode), 1000);
            }
          }
        }
      } catch (error) {
        console.error('[DeepLink] Initial URL error:', error);
      }
    };

    // Handle app already open (warm start)
    const subscription = Linking.addEventListener('url', async (event) => {
      if (!isMounted) return;
      console.log('[DeepLink] URL event (warm start):', event.url);
      const shareCode = parseProfileLink(event.url);
      const inviterShareCode = parseInviterShareCode(event.url);
      if (shareCode) {
        await handleDeepLink(shareCode, inviterShareCode);
      }
    });

    handleInitialURL();

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [isLoading, user]);

  // Hide splash screen when ready
  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  // Navigation logic based on authentication state
  useEffect(() => {
    if (!isReady) return;

    // Clear any pending navigation
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }

    // Debounce navigation to prevent rapid redirects
    navigationTimeoutRef.current = setTimeout(() => {
      const inAuthGroup = segments[0] === '(auth)';
      const inAppGroup = segments[0] === '(app)';
      const currentPath = segments.join('/');

      // SIMPLE LOGIC: If authenticated but no profile → profile-linking. If profile exists → app
      // CRITICAL FIX: Force boolean values to prevent security vulnerability
      const hasProfile = Boolean(profile && profile.id);
      const hasPendingRequest = Boolean(isPendingApproval);

      // Security check: Ensure profile belongs to current user
      const isProfileValid = Boolean(profile && user && profile.user_id === user.id);

      const isAuthenticatedNoProfile = Boolean(user && !hasProfile && !hasPendingRequest);
      const isAuthenticatedWithPending = Boolean(user && !hasProfile && hasPendingRequest);
      const isFullyAuthenticated = Boolean(user && isProfileValid);
      const shouldBeInApp = Boolean(isFullyAuthenticated || isGuestMode || isAuthenticatedWithPending);

      // Prevent duplicate navigations
      const preventNavigation = (destination: string) => {
        if (lastNavigationRef.current === destination) {
          return true;
        }
        lastNavigationRef.current = destination;
        return false;
      };

      // Handle authenticated user without profile - go to profile-linking
      if (isAuthenticatedNoProfile && currentPath !== '(auth)/profile-linking') {
        const destination = '/(auth)/profile-linking';
        if (!preventNavigation(destination)) {
          // Pass user data as URL parameter
          const userParam = encodeURIComponent(JSON.stringify(user));
          router.replace(`${destination}?user=${userParam}`);
        }
        return;
      }

      // Handle main app vs auth routing
      if (shouldBeInApp && !inAppGroup) {
        const destination = '/(app)/';
        if (!preventNavigation(destination)) {
          router.replace(destination);
        }
      } else if (!shouldBeInApp && !inAuthGroup) {
        // This handles both unauthenticated users and authenticated users without profiles
        const destination = '/(auth)/';
        if (!preventNavigation(destination)) {
          router.replace(destination);
        }
      }
    }, 100); // 100ms debounce

    // Cleanup timeout on unmount or deps change
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, [user, profile, hasCompletedOnboarding, isGuestMode, isPendingApproval, isReady, segments]);

  // Return slot which will render the appropriate route group
  // NetworkStatusIndicator banner shows globally when offline
  return (
    <>
      <NetworkStatusIndicator mode="banner" dismissible />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
          <SettingsProvider>
            <AdminModeProvider>
              <BottomSheetModalProvider>
                <RootLayoutNav />
              </BottomSheetModalProvider>
            </AdminModeProvider>
          </SettingsProvider>
        </AuthProvider>
      </ErrorBoundary>
      <Toast />
    </GestureHandlerRootView>
  );
}