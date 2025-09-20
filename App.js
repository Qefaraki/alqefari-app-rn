import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  I18nManager,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import TreeView from "./src/components/TreeView";
import ProfileSheetWrapper from "./src/components/ProfileSheetWrapper";
import PendingApprovalBanner from "./src/components/PendingApprovalBanner";
import { AdminModeProvider } from "./src/contexts/AdminModeContext";
import { SettingsProvider } from "./src/contexts/SettingsContext";
import AdminDashboard from "./src/screens/AdminDashboardUltraOptimized";
import SettingsModal from "./src/components/SettingsModal";
import AuthNavigator from "./src/navigation/AuthNavigator";
import GuestNavigator from "./src/navigation/GuestNavigator";
import { supabase } from "./src/services/supabase";
import { phoneAuthService } from "./src/services/phoneAuth";
import { useSharedValue } from "react-native-reanimated";
import { useTreeStore } from "./src/stores/useTreeStore";
import "./global.css";

// RTL is now configured at the native level in:
// - iOS: AppDelegate.swift
// - Android: MainActivity.kt
// This ensures RTL is enabled before React Native initializes

const Stack = createStackNavigator();

// Main app component (after authentication)
function MainApp({
  navigation,
  user,
  isGuest,
  onSignOut,
  linkedProfile,
  linkStatus,
  onLinkStatusChange,
  onRefreshLinkStatus,
}) {
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasNetworkError, setHasNetworkError] = useState(false);
  const initializeProfileSheetProgress = useTreeStore(
    (s) => s.initializeProfileSheetProgress,
  );
  const progress = useSharedValue(0);

  useEffect(() => {
    initializeProfileSheetProgress(progress);
  }, [initializeProfileSheetProgress, progress]);

  // Use the link status change handler from props
  const handleLinkStatusChange = (newStatus) => {
    if (onLinkStatusChange) {
      onLinkStatusChange(newStatus);
    }
  };

  const handleSignOut = async () => {
    Alert.alert("تسجيل الخروج", "هل أنت متأكد من رغبتك في تسجيل الخروج؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "تسجيل الخروج",
        style: "destructive",
        onPress: async () => {
          // Sign out from Supabase
          const { error } = await supabase.auth.signOut();
          if (error) {
            console.error("Sign out error:", error);
          }
          // Call the parent's onSignOut to reset state
          if (onSignOut) {
            onSignOut();
          }
        },
      },
    ]);
  };

  const handleAdminLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: "admin@test.com",
        password: "testadmin123",
      });

      if (error) {
        Alert.alert("Login Error", error.message);
      } else {
        Alert.alert("Success", "Logged in as test admin!");
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <SettingsProvider>
      <AdminModeProvider>
        <BottomSheetModalProvider>
          <View className="flex-1">
            <StatusBar style="dark" />

            {/* Admin Quick Login (for testing) - Bottom right circular button */}
            {!user && (
              <TouchableOpacity
                onPress={handleAdminLogin}
                style={{
                  position: "absolute",
                  bottom: 20, // Moved down to not overlay navigation
                  right: 16,
                  zIndex: 10,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#A13333", // Najdi Crimson
                  justifyContent: "center",
                  alignItems: "center",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <Ionicons
                  name="key"
                  size={20}
                  color="#F9F7F3" // Al-Jass White
                />
              </TouchableOpacity>
            )}

            {/* Guest Mode Banner - Removed per user request */}

            {/* Tree View */}
            <View className="flex-1">
              {/* Pending Approval Banner */}
              {user && linkStatus === "pending" && (
                <PendingApprovalBanner
                  user={user}
                  onStatusChange={handleLinkStatusChange}
                  onRefresh={onRefreshLinkStatus}
                />
              )}

              <TreeView
                setProfileEditMode={setProfileEditMode}
                onNetworkStatusChange={setHasNetworkError}
                user={user}
                isGuest={isGuest}
                onAdminDashboard={() => setShowAdminDashboard(true)}
                onSettingsOpen={() => setShowSettings(true)}
              />
            </View>

            {/* Profile Sheet */}
            <ProfileSheetWrapper editMode={profileEditMode} />

            {/* Admin Dashboard Modal */}
            <Modal
              visible={showAdminDashboard}
              animationType="slide"
              presentationStyle="fullScreen"
              onRequestClose={() => setShowAdminDashboard(false)}
            >
              <AdminDashboard
                user={user}
                onClose={() => setShowAdminDashboard(false)}
              />
            </Modal>

            {/* Settings Modal */}
            <SettingsModal
              visible={showSettings}
              onClose={() => setShowSettings(false)}
            />
          </View>
        </BottomSheetModalProvider>
      </AdminModeProvider>
    </SettingsProvider>
  );
}

// Root App Component
export default function App() {
  // Start with loading true - we need to check auth state first
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [linkedProfile, setLinkedProfile] = useState(null);
  const [linkStatus, setLinkStatus] = useState(null);
  const [profileCheckComplete, setProfileCheckComplete] = useState(false);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      // Quick check for cached session first
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // No session - go straight to onboarding
        setUser(null);
        setIsGuest(false);
        setIsLoading(false);
        return;
      }

      // Session exists - set user immediately to avoid blocking
      setUser(session.user);
      setIsGuest(session.user?.user_metadata?.isGuest || false);

      // For non-guests, check profile in background (don't block)
      if (session.user && !session.user?.user_metadata?.isGuest) {
        // Don't await - let it run in background
        checkProfileLinkingStatus(session.user).catch(console.error);
      } else {
        setProfileCheckComplete(true);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Auth check error:", error);
      // On error, assume no user and show onboarding
      setUser(null);
      setIsGuest(false);
      setIsLoading(false);
    }
  };

  const checkProfileLinkingStatus = async (user) => {
    try {
      // Check if user has linked profile
      const profile = await phoneAuthService.checkProfileLink(user);
      setLinkedProfile(profile);

      if (profile) {
        setLinkStatus("approved");
      } else {
        // Check for pending requests
        const result = await phoneAuthService.getUserLinkRequests();
        if (result.success && result.requests?.length > 0) {
          const latestRequest = result.requests.sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at),
          )[0];
          setLinkStatus(latestRequest.status);
        } else {
          setLinkStatus(null);
        }
      }
      setProfileCheckComplete(true);
    } catch (error) {
      console.error("Error checking profile link status:", error);
      setLinkStatus(null);
      setProfileCheckComplete(true);
    }
  };

  // Listen for auth changes
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        setIsGuest(session?.user?.user_metadata?.isGuest || false);

        // If user logs out, force them back to onboarding
        if (_event === "SIGNED_OUT") {
          setUser(null);
          setIsGuest(false);
          setLinkedProfile(null);
          setLinkStatus(null);
          setProfileCheckComplete(false);
        } else if (session?.user && !session?.user?.user_metadata?.isGuest) {
          // Check profile linking when user signs in
          await checkProfileLinkingStatus(session.user);
        }
      },
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Show splash screen ONLY during initial auth check
  // This prevents the app from jumping to tree view
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#030303", // Match onboarding background
        }}
      >
        <ActivityIndicator size="large" color="#A13333" />
        <Text style={{ marginTop: 16, fontSize: 16, color: "#F9F7F3" }}>
          جاري التحميل...
        </Text>
      </View>
    );
  }

  // Check if user needs to complete profile linking
  // A user is "incomplete" if they're authenticated but have no linked profile and no pending request
  const needsProfileLinking =
    user &&
    !isGuest &&
    !linkedProfile &&
    linkStatus === null &&
    profileCheckComplete;

  // Determine navigation state based on auth
  // CRITICAL: This is where we decide what to show
  const shouldShowOnboarding = !user && !isGuest; // Show onboarding for new users
  const shouldShowGuestExperience = isGuest; // Guest mode (explore without auth)
  const shouldShowMainApp = user && !isGuest; // Full app for authenticated users

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {shouldShowOnboarding || needsProfileLinking ? (
            // Show authentication flow for new users or incomplete profiles
            <Stack.Screen name="Auth">
              {(props) => (
                <AuthNavigator
                  {...props}
                  setIsGuest={setIsGuest}
                  setUser={setUser}
                />
              )}
            </Stack.Screen>
          ) : shouldShowGuestExperience ? (
            // Show limited guest experience with its own navigator
            <Stack.Screen name="Guest">
              {(props) => (
                <GuestNavigator
                  {...props}
                  onExitGuestMode={() => {
                    setIsGuest(false);
                    setUser(null);
                  }}
                />
              )}
            </Stack.Screen>
          ) : shouldShowMainApp ? (
            // Show full app ONLY for authenticated users
            <Stack.Screen name="Main">
              {(props) => (
                <MainApp
                  {...props}
                  user={user}
                  isGuest={false}
                  linkedProfile={linkedProfile}
                  linkStatus={linkStatus}
                  onLinkStatusChange={async (newStatus) => {
                    setLinkStatus(newStatus);
                    if (newStatus === "approved") {
                      // Reload profile when approved
                      const profile =
                        await phoneAuthService.checkProfileLink(user);
                      setLinkedProfile(profile);
                    }
                  }}
                  onRefreshLinkStatus={() => {
                    // Refresh link status when user manually refreshes
                    if (user && !isGuest) {
                      checkProfileLinkingStatus(user);
                    }
                  }}
                  onSignOut={() => {
                    // Clear state to show onboarding
                    setUser(null);
                    setIsGuest(false);
                    setLinkedProfile(null);
                    setLinkStatus(null);
                    setProfileCheckComplete(false);
                  }}
                />
              )}
            </Stack.Screen>
          ) : (
            // Fallback - shouldn't happen but show onboarding as safe default
            <Stack.Screen name="Auth">
              {(props) => (
                <AuthNavigator
                  {...props}
                  setIsGuest={setIsGuest}
                  setUser={setUser}
                />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
