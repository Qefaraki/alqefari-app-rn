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
  const { user, isAdmin, isLoading } = useAuth();
  const [appState, setAppState] = useState('determining'); // 'determining', 'onboarding', 'authenticated', 'guest'
  const [hasCheckedLocal, setHasCheckedLocal] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false); // Track if onboarding was completed

  // INSTANT local check for first-time users (no network calls)
  useEffect(() => {
    const checkLocalState = async () => {
      try {
        // These checks are instant (< 10ms)
        const [hasCompletedOnboarding, authToken] = await Promise.all([
          AsyncStorage.getItem('hasCompletedOnboarding'),
          AsyncStorage.getItem('supabase.auth.token')
        ]);

        console.log('[DEBUG] Local check - onboarding:', hasCompletedOnboarding, 'token:', !!authToken);

        // Store whether onboarding was completed
        setOnboardingCompleted(hasCompletedOnboarding === 'true');

        // Instant routing decision based on local data only
        if (hasCompletedOnboarding === null || hasCompletedOnboarding !== 'true') {
          // First time user OR didn't complete onboarding
          setAppState('onboarding');
        } else if (authToken) {
          // Has token cached AND completed onboarding
          setAppState('authenticated');
        } else {
          // Has completed onboarding but no token - guest mode
          setAppState('guest');
        }
        setHasCheckedLocal(true);
      } catch (error) {
        console.error('[DEBUG] Local check error:', error);
        // Default to guest mode on error
        setAppState('guest');
        setHasCheckedLocal(true);
      }
    };

    checkLocalState();
  }, []);

  // Update app state when auth completes (but don't block on it)
  useEffect(() => {
    if (!isLoading && hasCheckedLocal) {
      // Auth has completed loading in background
      if (user && onboardingCompleted) {
        // Only switch to authenticated if onboarding was completed
        setAppState('authenticated');
      } else if (user && !onboardingCompleted) {
        // User exists but onboarding not complete - stay in onboarding
        setAppState('onboarding');
      } else if (appState === 'determining') {
        // Only switch to guest if we haven't already made a decision
        setAppState('guest');
      }
    }
  }, [isLoading, user, hasCheckedLocal, appState, onboardingCompleted]);

  // Don't wait for auth - make instant decision based on local state
  if (!hasCheckedLocal) {
    // This should only show for a few milliseconds while AsyncStorage loads
    return null;
  }



  // Show onboarding for first-time users
  if (appState === 'onboarding') {
    console.log('[DEBUG] Showing onboarding');
    return (
      <NavigationIndependentTree>
        <NavigationContainer>
          <AuthNavigator
            setIsGuest={() => {
              setAppState('guest');
            }}
            setUser={(newUser) => {
              // When user successfully signs in, mark onboarding complete
              AsyncStorage.setItem('hasCompletedOnboarding', 'true');
              setAppState('authenticated');
            }}
          />
        </NavigationContainer>
      </NavigationIndependentTree>
    );
  }

  // Show tabs immediately - auth loads in background
  console.log('[DEBUG] Showing tabs - appState:', appState, 'isAdmin:', isAdmin);

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
        <Icon sf={{ default: "tree", selected: "tree.fill" }} />
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
        <TabLayout />
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
    <ErrorBoundary>
      <AuthProvider>
        <AppWithProviders />
      </AuthProvider>
    </ErrorBoundary>
  );
}
