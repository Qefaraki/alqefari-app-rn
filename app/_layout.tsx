import "../global.css"; // Import global CSS for NativeWind styles
import React, { useState, useEffect, Component } from "react";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS, Platform, View, Text, StyleSheet, Button } from "react-native";
import { NavigationContainer, NavigationIndependentTree } from "@react-navigation/native";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { AdminModeProvider } from "../src/contexts/AdminModeContext";
import { SettingsProvider } from "../src/contexts/SettingsContext";
import AuthNavigator from "../src/navigation/AuthNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BrandedSplashLoader from "../src/components/ui/BrandedSplashLoader";
import BrandedErrorScreen from "../src/components/ui/BrandedErrorScreen";

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

function TabLayout() {
  const { user, isAdmin, hasLinkedProfile, hasPendingRequest, isLoading } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [isGuestMode, setIsGuestMode] = useState<boolean | null>(null);

  // Check onboarding and guest mode status
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('hasCompletedOnboarding'),
      AsyncStorage.getItem('isGuestMode')
    ]).then(([onboardingValue, guestValue]) => {
      setOnboardingCompleted(onboardingValue === 'true');
      setIsGuestMode(guestValue === 'true');
      console.log('[DEBUG] Onboarding check:', onboardingValue === 'true', 'Guest mode:', guestValue === 'true');
    });
  }, []);

  // Auto-complete onboarding if user has linked profile
  useEffect(() => {
    if (user && hasLinkedProfile && !onboardingCompleted) {
      console.log('[DEBUG] User has linked profile, auto-completing onboarding');
      AsyncStorage.setItem('hasCompletedOnboarding', 'true').then(() => {
        setOnboardingCompleted(true);
      });
      AsyncStorage.removeItem('isGuestMode').then(() => {
        setIsGuestMode(false);
      });
    }
    // Also handle the case where user has pending request
    if (user && hasPendingRequest && !onboardingCompleted) {
      console.log('[DEBUG] User has pending request, marking onboarding complete');
      AsyncStorage.setItem('hasCompletedOnboarding', 'true').then(() => {
        setOnboardingCompleted(true);
      });
      AsyncStorage.removeItem('isGuestMode').then(() => {
        setIsGuestMode(false);
      });
    }
  }, [user, hasLinkedProfile, hasPendingRequest, onboardingCompleted]);

  // No need for emergency timeout - trust Supabase's auth handling

  // Determine app state based on AuthContext (single source of truth)
  const getAppState = () => {
    // Still loading - wait for auth
    if (isLoading) {
      return 'loading';
    }

    // Still loading local storage flags
    if (onboardingCompleted === null || isGuestMode === null) {
      return 'loading';
    }

    // If onboarding is already completed, never show it again
    if (onboardingCompleted === true) {
      // Check what type of user this is
      if (user && hasLinkedProfile) {
        console.log('[DEBUG] Authenticated with profile');
        return 'authenticated';
      }

      if (user && hasPendingRequest) {
        console.log('[DEBUG] Authenticated with pending request');
        return 'authenticated-pending';
      }

      if (isGuestMode === true) {
        console.log('[DEBUG] Guest mode');
        return 'guest';
      }

      // Onboarding completed but waiting for auth to load
      if (!user) {
        console.log('[DEBUG] Onboarding completed, waiting for auth');
        return 'loading'; // Keep loading until auth resolves
      }

      // User signed in but no profile yet (shouldn't happen if onboarding completed properly)
      console.log('[DEBUG] Onboarding completed but no profile - showing tabs anyway');
      return 'authenticated';
    }

    // Onboarding not completed - decide based on auth state

    // If user is authenticated AND has linked profile, show tabs
    if (user && hasLinkedProfile) {
      console.log('[DEBUG] Authenticated with profile');
      return 'authenticated';
    }

    // If user is authenticated AND has a pending request, show tabs (waiting for approval)
    if (user && hasPendingRequest) {
      console.log('[DEBUG] Authenticated with pending request');
      return 'authenticated-pending';
    }

    // If user is authenticated but NO linked profile AND NO pending request, continue onboarding
    if (user && !hasLinkedProfile && !hasPendingRequest) {
      console.log('[DEBUG] Authenticated but needs to complete profile setup');
      return 'onboarding';
    }

    // If explicitly in guest mode, show tabs
    if (isGuestMode === true) {
      console.log('[DEBUG] Guest mode');
      return 'guest';
    }

    // Not authenticated and not guest = show onboarding
    console.log('[DEBUG] Not authenticated - show onboarding');
    return 'onboarding';
  };

  const appState = getAppState();

  // Show loading screen while checking auth and onboarding
  if (appState === 'loading') {
    console.log('[DEBUG] Loading auth and onboarding status...');
    return (
      <BrandedSplashLoader />
    );
  }



  // Show onboarding for first-time users or authenticated users without profiles
  if (appState === 'onboarding') {
    console.log('[DEBUG] Showing onboarding - user:', !!user, 'hasProfile:', hasLinkedProfile);
    return (
      <NavigationIndependentTree>
        <NavigationContainer>
          <AuthNavigator
            setIsGuest={async () => {
              await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
              await AsyncStorage.setItem('isGuestMode', 'true');
              setOnboardingCompleted(true);
              setIsGuestMode(true);
            }}
            setUser={async (newUser) => {
              // When user successfully signs in, clear guest mode but DON'T mark onboarding complete yet
              // Onboarding is only complete after profile linking
              await AsyncStorage.removeItem('isGuestMode'); // Clear guest mode on sign in
              setIsGuestMode(false);
              // Do NOT set hasCompletedOnboarding here - wait for profile linking
            }}
          />
        </NavigationContainer>
      </NavigationIndependentTree>
    );
  }

  // Show tabs - user state is managed by AuthContext
  console.log('[DEBUG] Showing tabs - user:', !!user, 'isAdmin:', isAdmin, 'hasPendingRequest:', hasPendingRequest);

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      labelStyle={{
        color: DynamicColorIOS({
          dark: "white",
          light: "black",
        }),
      }}
      tintColor={DynamicColorIOS({
        dark: "#A13333",
        light: "#A13333",
      })}
    >
      <NativeTabs.Trigger name="index">
        <Label>الشجرة</Label>
        <Icon src={require("../assets/AlqefariEmblem-TabIcon.png")} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="news">
        <Label>الأخبار</Label>
        <Icon sf={{ default: "newspaper", selected: "newspaper.fill" }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Label>الإعدادات</Label>
        <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
      </NativeTabs.Trigger>

      {/* Admin tab - iOS only, hidden for non-admins */}
      {Platform.OS === "ios" && (
        <NativeTabs.Trigger name="admin" hidden={!isAdmin}>
          <Label>الإدارة</Label>
          <Icon
            sf={{
              default: "shield",
              selected: "shield.fill",
            }}
          />
        </NativeTabs.Trigger>
      )}
    </NativeTabs>
  );
}

function AppWithProviders() {
  return (
    <SettingsProvider>
      <AdminModeProvider>
        <BottomSheetModalProvider>
          <TabLayout />
        </BottomSheetModalProvider>
      </AdminModeProvider>
    </SettingsProvider>
  );
}

// Add styles for the loading screen and error boundary
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F7F3',
    padding: 20,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    color: '#242121',
  },
  debugText: {
    marginTop: 10,
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
    textAlign: 'center',
  },
  timeoutWarning: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#ffeeee',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ff6666',
  },
  timeoutText: {
    color: '#cc0000',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default function RootLayout() {
  console.log('[DEBUG RootLayout] Rendering root layout');

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
          <AppWithProviders />
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
