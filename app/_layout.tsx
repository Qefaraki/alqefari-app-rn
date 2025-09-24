import "../global.css"; // Import global CSS for NativeWind styles
import React, { useState, useEffect } from "react";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS, Platform, View } from "react-native";
import { NavigationContainer, NavigationIndependentTree } from "@react-navigation/native";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { AdminModeProvider } from "../src/contexts/AdminModeContext";
import { SettingsProvider } from "../src/contexts/SettingsContext";
import AuthNavigator from "../src/navigation/AuthNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";

function TabLayout() {
  const { user, isAdmin, isLoading } = useAuth();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);

  // Optimistic auth check - only for initial load, not hot reload
  useEffect(() => {
    // If AuthContext already has a user (e.g., during hot reload), skip AsyncStorage check
    if (user) {
      setIsCheckingAuth(false);
      setShouldShowOnboarding(false);
      return;
    }

    // Only check AsyncStorage if AuthContext doesn't have user yet
    if (isLoading) {
      checkOptimisticAuth();
    } else {
      // AuthContext finished loading with no user
      setIsCheckingAuth(false);
      setShouldShowOnboarding(true);
    }
  }, []); // Only run once on mount

  const checkOptimisticAuth = async () => {
    try {
      // Quick check for cached auth session (< 50ms)
      const keys = await AsyncStorage.getAllKeys();
      const supabaseAuthKey = keys.find(key => key.includes("supabase.auth"));

      let hasSession = false;
      if (supabaseAuthKey) {
        const sessionData = await AsyncStorage.getItem(supabaseAuthKey);
        hasSession = sessionData !== null && sessionData !== "null";
      }

      if (!hasSession) {
        // No session in storage, but wait for AuthContext to confirm
        // Don't immediately show onboarding yet
        setIsCheckingAuth(false);
      } else {
        // Session exists - optimistically hide onboarding
        setIsCheckingAuth(false);
      }
    } catch (error) {
      console.log("Error checking cached auth:", error);
      // Error checking cache - wait for AuthContext
      setIsCheckingAuth(false);
    }
  };

  // Update when auth state changes - this is the source of truth
  useEffect(() => {
    // AuthContext has finished loading
    if (!isLoading) {
      setIsCheckingAuth(false);

      // Set onboarding based on actual user state
      if (!user) {
        setShouldShowOnboarding(true);
      } else {
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

  // Don't render anything while checking auth
  if (isCheckingAuth || isLoading) {
    return null;
  }

  console.log("TabLayout rendering - isAdmin:", isAdmin, "Platform:", Platform.OS);

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

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppWithProviders />
    </AuthProvider>
  );
}
