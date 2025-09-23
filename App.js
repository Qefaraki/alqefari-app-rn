import "./src/utils/suppressWarnings"; // Suppress known warnings
import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TreeView from "./src/components/TreeView";
import ProfileSheetWrapper from "./src/components/ProfileSheetWrapper";
import PendingApprovalBanner from "./src/components/PendingApprovalBanner";
import { AdminModeProvider } from "./src/contexts/AdminModeContext";
import { SettingsProvider } from "./src/contexts/SettingsContext";
import AdminDashboard from "./src/screens/AdminDashboardUltraOptimized";
import SettingsPage from "./src/screens/SettingsPage";
import AuthNavigator from "./src/navigation/AuthNavigator";
import GuestNavigator from "./src/navigation/GuestNavigator";
import NativeTabBar from "./src/components/NativeTabBar";
import { supabase } from "./src/services/supabase";
import { phoneAuthService } from "./src/services/phoneAuth";
import notificationService from "./src/services/notifications";
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
  user,
  isGuest,
  onSignOut,
  linkedProfile,
  linkStatus,
  onLinkStatusChange,
}) {
  const [activeTab, setActiveTab] = useState("tree");
  const [selectedNode, setSelectedNode] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const initializeProfileSheetProgress = useTreeStore(
    (s) => s.initializeProfileSheetProgress,
  );
  const progress = useSharedValue(0);

  useEffect(() => {
    initializeProfileSheetProgress(progress);
  }, [initializeProfileSheetProgress, progress]);

  // Check admin status
  useEffect(() => {
    if (user) {
      checkAdminStatus();
    } else {
      setIsAdmin(false);
    }
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .single();

      setIsAdmin(!!data && !error);
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
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
          <View style={{ flex: 1 }}>
            <StatusBar style="dark" />

            {/* Admin Quick Login (for testing) - Moved up to avoid tab bar */}
            {!user && (
              <TouchableOpacity
                onPress={handleAdminLogin}
                style={{
                  position: "absolute",
                  bottom: 100, // Moved up to avoid tab bar
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

            {/* Tab Content */}
            <View style={{ flex: 1, marginBottom: 85 }}>
              {activeTab === "tree" && (
                <>
                  {/* Pending Approval Banner */}
                  {user && linkStatus === "pending" && (
                    <PendingApprovalBanner
                      user={user}
                      onStatusChange={onLinkStatusChange}
                    />
                  )}
                  <TreeView
                    user={user}
                    isGuest={isGuest}
                    onAdminDashboard={() => setActiveTab("settings")}
                    onSettingsOpen={() => setActiveTab("settings")}
                  />
                  <ProfileSheetWrapper />
                </>
              )}
              {activeTab === "settings" && (
                <>
                  {isAdmin ? (
                    <AdminDashboard
                      user={user}
                      onClose={() => setActiveTab("tree")}
                    />
                  ) : (
                    <SettingsPage
                      user={user}
                      navigation={{ goBack: () => setActiveTab("tree") }}
                    />
                  )}
                </>
              )}
              {activeTab === "profile" && (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    padding: 32,
                  }}
                >
                  {!user || isGuest ? (
                    <>
                      <Ionicons
                        name="person-outline"
                        size={80}
                        color="#A13333"
                      />
                      <Text
                        style={{
                          fontSize: 24,
                          fontWeight: "700",
                          color: "#242121",
                          marginTop: 16,
                          fontFamily: "SF Arabic",
                        }}
                      >
                        ملفك الشخصي
                      </Text>
                      <Text
                        style={{
                          fontSize: 16,
                          color: "#736372",
                          marginTop: 8,
                          textAlign: "center",
                          fontFamily: "SF Arabic",
                        }}
                      >
                        سجل دخولك لعرض ملفك الشخصي
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="construct" size={80} color="#D58C4A" />
                      <Text
                        style={{
                          fontSize: 24,
                          fontWeight: "700",
                          color: "#242121",
                          marginTop: 16,
                          fontFamily: "SF Arabic",
                        }}
                      >
                        قريباً
                      </Text>
                      <Text
                        style={{
                          fontSize: 16,
                          color: "#736372",
                          marginTop: 8,
                          textAlign: "center",
                          fontFamily: "SF Arabic",
                        }}
                      >
                        نعمل على تطوير صفحة الملف الشخصي
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>

            {/* Native Tab Bar with iOS 26 Liquid Glass / Android Material */}
            <NativeTabBar activeTab={activeTab} onTabPress={setActiveTab} />
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
    // Check auth state on mount
    checkAuthState();
    // Initialize notifications
    initializeNotifications();

    // Clean up function to handle app state changes
    return () => {
      notificationService.cleanup();
    };
  }, []);

  // Initialize push notifications
  const initializeNotifications = async () => {
    try {
      // Initialize notification service
      const token = await notificationService.initialize();
      if (token) {
        console.log("Push notifications initialized");
      }

      // Set navigation callbacks (will be set up later with navigation ref)
      notificationService.setNavigationCallbacks({
        navigateToProfile: (profileId) => {
          console.log("Navigate to profile:", profileId);
        },
        navigateToAdminRequests: () => {
          console.log("Navigate to admin requests");
        },
      });

      // Set event callbacks
      notificationService.setEventCallbacks({
        onApprovalReceived: async (data) => {
          // Refresh profile link status when approved
          if (user) {
            await checkProfileLinkingStatus(user);
          }
        },
        onRejectionReceived: (data) => {
          // Update link status to rejected
          setLinkStatus("rejected");
        },
        onNewRequestReceived: (data) => {
          // Update admin badge count
          console.log("New request received:", data);
        },
      });
    } catch (error) {
      console.error("Failed to initialize notifications:", error);
    }
  };

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

      // CRITICAL: Validate the session is still valid
      // This prevents showing TreeView with stale sessions
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        // Session is invalid/expired - clear it and show onboarding
        console.log("Invalid session detected, clearing...");
        await supabase.auth.signOut();
        setUser(null);
        setIsGuest(false);
        setIsLoading(false);
        return;
      }

      // Session is valid - NOW we can set the user
      setUser(user);
      setIsGuest(user?.user_metadata?.isGuest || false);

      // For non-guests, check profile BEFORE showing the app
      if (user && !user?.user_metadata?.isGuest) {
        // Wait for profile check to complete
        await checkProfileLinkingStatus(user);
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
        // Validate session on auth state changes too
        if (session && _event !== "SIGNED_OUT") {
          // Verify the session is still valid
          const {
            data: { user },
            error,
          } = await supabase.auth.getUser();
          if (error || !user) {
            // Invalid session - sign out
            await supabase.auth.signOut();
            return;
          }
        }

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
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}
