import "../global.css"; // Import global CSS for NativeWind styles
import React, { useState, useEffect, Component } from "react";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS, Platform, View, Text, ActivityIndicator, StyleSheet, Button } from "react-native";
import { NavigationContainer, NavigationIndependentTree } from "@react-navigation/native";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { AdminModeProvider } from "../src/contexts/AdminModeContext";
import { SettingsProvider } from "../src/contexts/SettingsContext";
import AuthNavigator from "../src/navigation/AuthNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Error Detected!</Text>
          <Text style={styles.errorMessage}>
            {this.state.error && this.state.error.toString()}
          </Text>
          <Text style={styles.errorStack}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </Text>
          <Button
            title="Reset App"
            onPress={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          />
        </View>
      );
    }

    return this.props.children;
  }
}

function TabLayout() {
  const { user, isAdmin, hasLinkedProfile, isLoading } = useAuth();
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

  // Emergency timeout - if auth takes too long, show app anyway
  const [authTimeout, setAuthTimeout] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('[DEBUG] Auth timeout - showing app anyway after 2 seconds');
      setAuthTimeout(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Determine app state based on AuthContext (single source of truth)
  const getAppState = () => {
    // Still loading onboarding status - but only wait briefly
    if ((onboardingCompleted === null || isGuestMode === null) && !authTimeout) {
      return 'loading';
    }

    // If user is authenticated AND has linked profile, show tabs
    if (user && hasLinkedProfile) {
      console.log('[DEBUG] Showing tabs - authenticated user with profile:', user.email || user.phone);
      return 'authenticated';
    }

    // If user is authenticated but NO linked profile, continue onboarding
    if (user && !hasLinkedProfile) {
      console.log('[DEBUG] Authenticated but no profile - continuing onboarding');
      return 'onboarding';
    }

    // If explicitly in guest mode, show tabs
    if (isGuestMode === true) {
      console.log('[DEBUG] Showing tabs - explicit guest mode');
      return 'guest';
    }

    // Not authenticated and not guest = show onboarding
    // This includes: first time users, signed out users, etc.
    console.log('[DEBUG] Not authenticated, not guest - showing onboarding');
    return 'onboarding';
  };

  const appState = getAppState();

  // Only show loading for a VERY brief moment while checking onboarding
  if (appState === 'loading') {
    console.log('[DEBUG] Brief wait for onboarding check...');
    return null;
  }



  // Show onboarding for first-time users
  if (appState === 'onboarding') {
    console.log('[DEBUG] Showing onboarding');
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
  console.log('[DEBUG] Showing tabs - user:', !!user, 'isAdmin:', isAdmin);

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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#cc0000',
    marginBottom: 20,
  },
  errorMessage: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  errorStack: {
    fontSize: 10,
    color: '#666',
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
    marginBottom: 30,
    maxHeight: 200,
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
