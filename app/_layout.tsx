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
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [debugInfo, setDebugInfo] = useState({ startTime: Date.now(), states: [] });

  // DEBUG: Track state changes
  useEffect(() => {
    const state = {
      time: Date.now() - debugInfo.startTime,
      isCheckingAuth,
      isLoading,
      hasUser: !!user,
      shouldShowOnboarding,
      loadingTimeout
    };
    console.log('[DEBUG _layout]', JSON.stringify(state));
    setDebugInfo(prev => ({ ...prev, states: [...prev.states.slice(-10), state] }));
  }, [isCheckingAuth, isLoading, user, shouldShowOnboarding, loadingTimeout]);

  // Add timeout to prevent infinite loading
  useEffect(() => {
    console.log('[DEBUG _layout] Setting up 5 second timeout for loading state');
    const timer = setTimeout(() => {
      if (isCheckingAuth || isLoading) {
        console.error('[DEBUG _layout] TIMEOUT: Still loading after 5 seconds!');
        console.error('[DEBUG _layout] States history:', debugInfo.states);
        setLoadingTimeout(true);
        setIsCheckingAuth(false);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Optimistic auth check - only for initial load, not hot reload
  useEffect(() => {
    console.log('[DEBUG _layout] Initial mount - user:', user, 'isLoading:', isLoading);

    // If AuthContext already has a user (e.g., during hot reload), skip AsyncStorage check
    if (user) {
      console.log('[DEBUG _layout] User exists, skipping AsyncStorage check');
      setIsCheckingAuth(false);
      setShouldShowOnboarding(false);
      return;
    }

    // Only check AsyncStorage if AuthContext doesn't have user yet
    if (isLoading) {
      console.log('[DEBUG _layout] AuthContext still loading, checking AsyncStorage');
      checkOptimisticAuth();
    } else {
      // AuthContext finished loading with no user
      console.log('[DEBUG _layout] AuthContext loaded with no user');
      setIsCheckingAuth(false);
      setShouldShowOnboarding(true);
    }
  }, []); // Only run once on mount

  const checkOptimisticAuth = async () => {
    console.log('[DEBUG _layout] checkOptimisticAuth starting');
    try {
      // Quick check for cached auth session (< 50ms)
      const keys = await AsyncStorage.getAllKeys();
      console.log('[DEBUG _layout] AsyncStorage keys:', keys.length);

      const supabaseAuthKey = keys.find(key => key.includes("supabase.auth"));
      console.log('[DEBUG _layout] Found supabase auth key:', !!supabaseAuthKey);

      let hasSession = false;
      if (supabaseAuthKey) {
        const sessionData = await AsyncStorage.getItem(supabaseAuthKey);
        hasSession = sessionData !== null && sessionData !== "null";
        console.log('[DEBUG _layout] Session exists:', hasSession, 'data length:', sessionData?.length);
      }

      if (!hasSession) {
        // No session in storage, but wait for AuthContext to confirm
        console.log('[DEBUG _layout] No session in storage');
        setIsCheckingAuth(false);
      } else {
        // Session exists - optimistically hide onboarding
        console.log('[DEBUG _layout] Session exists, hiding onboarding');
        setIsCheckingAuth(false);
      }
    } catch (error) {
      console.error('[DEBUG _layout] Error checking cached auth:', error);
      // Error checking cache - wait for AuthContext
      setIsCheckingAuth(false);
    }
  };

  // Update when auth state changes - this is the source of truth
  useEffect(() => {
    console.log('[DEBUG _layout] Auth state changed - isLoading:', isLoading, 'user:', !!user);

    // AuthContext has finished loading
    if (!isLoading) {
      console.log('[DEBUG _layout] AuthContext finished loading');
      setIsCheckingAuth(false);

      // Set onboarding based on actual user state
      if (!user) {
        console.log('[DEBUG _layout] No user, showing onboarding');
        setShouldShowOnboarding(true);
      } else {
        console.log('[DEBUG _layout] User exists, hiding onboarding');
        setShouldShowOnboarding(false);
      }
    }
  }, [user, isLoading]);

  // Show onboarding screen (no tabs)
  if (shouldShowOnboarding) {
    return (
      <NavigationIndependentTree>
        <NavigationContainer>
          <AuthNavigator
            setIsGuest={() => {}}
            setUser={(newUser) => {
              // When user successfully signs in, hide onboarding
              setShouldShowOnboarding(false);
            }}
          />
        </NavigationContainer>
      </NavigationIndependentTree>
    );
  }

  // CRITICAL: Replace null with visible loading screen to debug white screen issue
  if (isCheckingAuth || isLoading) {
    console.log('[DEBUG _layout] LOADING SCREEN SHOWN - isCheckingAuth:', isCheckingAuth, 'isLoading:', isLoading);

    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A13333" />
        <Text style={styles.loadingText}>جاري التحميل...</Text>
        <Text style={styles.debugText}>
          {`Checking: ${isCheckingAuth}\nLoading: ${isLoading}\nTimeout: ${loadingTimeout}`}
        </Text>
        {loadingTimeout && (
          <View style={styles.timeoutWarning}>
            <Text style={styles.timeoutText}>
              ⚠️ Loading timeout - stuck in loading state!
            </Text>
            <Text style={styles.debugText}>
              Check console for debug logs
            </Text>
          </View>
        )}
      </View>
    );
  }

  console.log('[DEBUG _layout] RENDERING TABS - isAdmin:', isAdmin, 'Platform:', Platform.OS);

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
