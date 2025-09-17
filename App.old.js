import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  I18nManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import TreeView from "./src/components/TreeView";
import ProfileSheetWrapper from "./src/components/ProfileSheetWrapper";
import { AdminModeProvider } from "./src/contexts/AdminModeContext";
import { SettingsProvider } from "./src/contexts/SettingsContext";
import AdminDashboard from "./src/screens/AdminDashboardUltraOptimized";
import SettingsModal from "./src/components/SettingsModal";
import { supabase } from "./src/services/supabase";
import { useSharedValue } from "react-native-reanimated";
import { checkAndCreateAdminProfile } from "./src/utils/checkAdminProfile";
import { useTreeStore } from "./src/stores/useTreeStore";
import "./global.css";

// RTL is now configured at the native level in:
// - iOS: AppDelegate.swift
// - Android: MainActivity.kt
// This ensures RTL is enabled before React Native initializes

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasNetworkError, setHasNetworkError] = useState(false);
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId);
  const initializeProfileSheetProgress = useTreeStore(
    (s) => s.initializeProfileSheetProgress,
  );
  const progress = useSharedValue(0);

  useEffect(() => {
    initializeProfileSheetProgress(progress);
  }, [initializeProfileSheetProgress, progress]);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleTestLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
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
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <AdminModeProvider>
          <BottomSheetModalProvider>
            <View className="flex-1">
              <StatusBar style="dark" />

              {/* Login Button - Floating when not logged in and network is available */}
              {!user && !hasNetworkError && (
                <View
                  style={{
                    position: "absolute",
                    top: 60,
                    right: 16,
                    zIndex: 10,
                  }}
                >
                  <TouchableOpacity
                    onPress={handleTestLogin}
                    disabled={loading}
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
                      style={{
                        color: "white",
                        fontSize: 14,
                        fontWeight: "600",
                      }}
                    >
                      {loading ? "Loading..." : "Admin"}
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

              {/* Profile Sheet - uses wrapper to conditionally show modern editor */}
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
    </GestureHandlerRootView>
  );
}
