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
import { AdminModeProvider } from "./src/contexts/AdminModeContext";
import { SettingsProvider } from "./src/contexts/SettingsContext";
import AdminDashboard from "./src/screens/AdminDashboardUltraOptimized";
import SettingsModal from "./src/components/SettingsModal";
import AuthNavigator from "./src/navigation/AuthNavigator";
import { supabase } from "./src/services/supabase";
import { phoneAuthService } from "./src/services/phoneAuth";
import { useSharedValue } from "react-native-reanimated";
import { useTreeStore } from "./src/stores/useTreeStore";
import "./global.css";

// Force RTL for the entire app
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// Check if RTL is actually enabled
if (!I18nManager.isRTL) {
  console.warn("RTL is not enabled. Using hardcoded RTL styles instead.");
}

const Stack = createStackNavigator();

// Main app component (after authentication)
function MainApp({ navigation, user, isGuest, onSignOut }) {
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasNetworkError, setHasNetworkError] = useState(false);
  const [linkedProfile, setLinkedProfile] = useState(null);
  const initializeProfileSheetProgress = useTreeStore(
    (s) => s.initializeProfileSheetProgress,
  );
  const progress = useSharedValue(0);

  useEffect(() => {
    initializeProfileSheetProgress(progress);
  }, [initializeProfileSheetProgress, progress]);

  // Check if user has linked profile
  useEffect(() => {
    if (user) {
      checkLinkedProfile();
    }
  }, [user]);

  const checkLinkedProfile = async () => {
    const profile = await phoneAuthService.checkProfileLink(user);
    setLinkedProfile(profile);
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

            {/* User Info Bar */}
            {(user || isGuest) && (
              <View
                style={{
                  position: "absolute",
                  top: 50,
                  left: 16,
                  right: 16,
                  zIndex: 10,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.95)",
                  padding: 12,
                  borderRadius: 12,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flex: 1,
                  }}
                >
                  {linkedProfile && !isGuest ? (
                    <>
                      <Ionicons
                        name="person-circle"
                        size={24}
                        color="#007AFF"
                      />
                      <Text
                        style={{
                          marginLeft: 8,
                          fontSize: 14,
                          fontWeight: "600",
                        }}
                      >
                        {linkedProfile.name}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="eye-outline" size={24} color="#666" />
                      <Text
                        style={{ marginLeft: 8, fontSize: 14, color: "#666" }}
                      >
                        {isGuest ? "وضع الضيف" : "وضع المشاهدة فقط"}
                      </Text>
                    </>
                  )}
                </View>

                <TouchableOpacity onPress={handleSignOut}>
                  <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            )}

            {/* Admin Quick Login (for testing) */}
            {!user && (
              <View
                style={{
                  position: "absolute",
                  top: 60,
                  right: 16,
                  zIndex: 10,
                }}
              >
                <TouchableOpacity
                  onPress={handleAdminLogin}
                  style={{
                    backgroundColor: "#007AFF",
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    flexDirection: "row",
                    alignItems: "center",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                >
                  <Ionicons
                    name="key"
                    size={16}
                    color="white"
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={{ color: "white", fontSize: 14, fontWeight: "600" }}
                  >
                    Admin
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Tree View */}
            <View className="flex-1">
              <TreeView
                setProfileEditMode={setProfileEditMode}
                onNetworkStatusChange={setHasNetworkError}
                user={user}
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
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      // Get current session first
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Then get the user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // If there's a mismatch (session but no user), clear everything
      if (session && !user) {
        await supabase.auth.signOut();
        setUser(null);
        setIsGuest(false);
      } else {
        setUser(user);
        setIsGuest(user?.user_metadata?.isGuest || false);
      }
    } catch (error) {
      console.error("Auth check error:", error);
      // On error, assume no user
      setUser(null);
      setIsGuest(false);
    } finally {
      setInitializing(false);
    }
  };

  // Listen for auth changes
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setIsGuest(session?.user?.user_metadata?.isGuest || false);

        // If user logs out, force them back to onboarding
        if (_event === "SIGNED_OUT") {
          setUser(null);
          setIsGuest(false);
        }
      },
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  if (initializing) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f5f5f5",
        }}
      >
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 16, fontSize: 16, color: "#666" }}>
          جاري التحميل...
        </Text>
      </View>
    );
  }

  // Simple logic: If no user (not even guest), show onboarding
  // If user exists (real or guest), show main app
  const shouldShowOnboarding = !user && !isGuest;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {shouldShowOnboarding ? (
            // Show authentication flow when no user at all
            <Stack.Screen name="Auth">
              {(props) => (
                <AuthNavigator
                  {...props}
                  setIsGuest={setIsGuest}
                  setUser={setUser}
                />
              )}
            </Stack.Screen>
          ) : (
            // Show main app for logged in users or guests
            <Stack.Screen name="Main">
              {(props) => (
                <MainApp
                  {...props}
                  user={user}
                  isGuest={isGuest}
                  onSignOut={() => {
                    // Clear state to show onboarding
                    setUser(null);
                    setIsGuest(false);
                  }}
                />
              )}
            </Stack.Screen>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
