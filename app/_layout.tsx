import "../global.css"; // Import global CSS for NativeWind styles
import React, { useState, useEffect, Component } from "react";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS, Platform, View, Text, StyleSheet, Button, AppState } from "react-native";
import { NavigationContainer, NavigationIndependentTree } from "@react-navigation/native";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { AuthStates } from "../src/services/AuthStateMachine";
import { AdminModeProvider } from "../src/contexts/AdminModeContext";
import { SettingsProvider } from "../src/contexts/SettingsContext";
import AuthNavigator from "../src/navigation/AuthNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import BrandedErrorScreen from "../src/components/ui/BrandedErrorScreen";
import notificationService from "../src/services/notifications";
import { router } from "expo-router";

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

function TabLayout() {
  const { authState, user, isAdmin, isGuestMode, isLoading, stateMachine } = useAuth();
  const [notificationInitialized, setNotificationInitialized] = useState(false);

  // Initialize notifications when user is authenticated
  useEffect(() => {
    const initializeNotifications = async () => {
      if (user && authState === AuthStates.PROFILE_LINKED && !notificationInitialized) {
        console.log('[DEBUG] Initializing notification service for user');

        try {
          // Initialize the notification service
          await notificationService.initialize();

          // Set up navigation callbacks
          notificationService.setNavigationCallbacks({
            navigateToProfile: (profileId) => {
              console.log('[DEBUG] Navigate to profile:', profileId);
              // Navigate to settings/profile tab
              router.replace("/settings");
            },
            navigateToAdminRequests: () => {
              console.log('[DEBUG] Navigate to admin requests');
              // Navigate to admin tab if admin
              if (isAdmin) {
                router.replace("/admin");
              }
            },
          });

          // Set up event callbacks
          notificationService.setEventCallbacks({
            onApprovalReceived: (data) => {
              console.log('[DEBUG] Approval notification received:', data);
              // Refresh profile data (handled by AuthContext)
            },
            onRejectionReceived: (data) => {
              console.log('[DEBUG] Rejection notification received:', data);
              // Could show alert or update UI
            },
            onNewRequestReceived: (data) => {
              console.log('[DEBUG] New request notification received:', data);
              // Update badge count (handled by NotificationBadge component)
            },
          });

          setNotificationInitialized(true);
          console.log('[DEBUG] Notification service initialized successfully');
        } catch (error) {
          console.error('[DEBUG] Error initializing notifications:', error);
        }
      }
    };

    initializeNotifications();
  }, [user, isGuestMode, isAdmin, notificationInitialized]);

  // Handle app state changes for badge updates
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && user) {
        // Clear badge when app comes to foreground
        notificationService.clearBadge();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [user]);

  // Cleanup notification listeners on unmount
  useEffect(() => {
    return () => {
      if (notificationInitialized) {
        notificationService.cleanup();
      }
    };
  }, [notificationInitialized]);

  // Hide splash screen when auth state is determined
  useEffect(() => {
    if (!isLoading && authState !== AuthStates.INITIALIZING) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, authState]);

  // Log auth state changes for debugging
  useEffect(() => {
    console.log('[DEBUG] Auth state changed:', authState);
    console.log('[DEBUG] User:', !!user, 'Admin:', isAdmin);
  }, [authState, user, isAdmin]);

  // Handle navigation based on auth state
  const shouldShowTabs = () => {
    return [
      AuthStates.PROFILE_LINKED,
      AuthStates.GUEST_MODE,
    ].includes(authState);
  };

  const shouldShowAuth = () => {
    return [
      AuthStates.UNAUTHENTICATED,
      AuthStates.ONBOARDING,
      AuthStates.PHONE_AUTH,
      AuthStates.OTP_VERIFICATION,
      AuthStates.PROFILE_LINKING,
      AuthStates.AUTHENTICATED,
      AuthStates.PENDING_APPROVAL,
    ].includes(authState);
  };

  // Show loading while initializing
  if (isLoading || authState === AuthStates.INITIALIZING) {
    console.log('[DEBUG] Loading auth state...');
    return null; // Keep splash screen visible
  }

  // Show auth flow for unauthenticated or onboarding states
  if (shouldShowAuth()) {
    console.log('[DEBUG] Showing auth flow - state:', authState);
    return (
      <NavigationIndependentTree>
        <NavigationContainer>
          <AuthNavigator
            setIsGuest={async () => {
              await stateMachine.enterGuestMode();
            }}
            setUser={async (newUser) => {
              // Handled by state machine
            }}
          />
        </NavigationContainer>
      </NavigationIndependentTree>
    );
  }

  // Show main app tabs for authenticated users with profiles or guest mode
  if (shouldShowTabs()) {
    console.log('[DEBUG] Showing main app - state:', authState);

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

  // Handle error state
  if (authState === AuthStates.ERROR) {
    console.log('[DEBUG] Auth error state');
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>حدث خطأ في المصادقة</Text>
        <Button title="إعادة المحاولة" onPress={() => stateMachine.recoverFromError()} />
      </View>
    );
  }

  // Fallback - shouldn't reach here
  console.warn('[DEBUG] Unexpected auth state:', authState);
  return null;
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F7F3',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#242121',
    marginBottom: 20,
    textAlign: 'center',
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
