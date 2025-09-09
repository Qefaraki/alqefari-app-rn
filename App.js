import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { View, Text, TouchableOpacity, Alert, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import TreeView from "./src/components/TreeView";
import ProfileSheet from "./src/components/ProfileSheet";
import { AdminModeProvider } from "./src/contexts/AdminModeContext";
import { SettingsProvider } from "./src/contexts/SettingsContext";
import CompactAdminBar from "./src/components/admin/CompactAdminBar";
import AdminDashboard from "./src/screens/AdminDashboard";
import SettingsModal from "./src/components/SettingsModal";
import { supabase } from "./src/services/supabase";
import { checkAndCreateAdminProfile } from "./src/utils/checkAdminProfile";
import { useTreeStore } from "./src/stores/useTreeStore";
import "./global.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [profileEditMode, setProfileEditMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId);

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

  const handleCheckAdminProfile = async () => {
    const result = await checkAndCreateAdminProfile();
    if (result.success) {
      Alert.alert("Success", "Admin profile is ready!");
    } else {
      Alert.alert(
        "Error",
        result.error?.message || "Failed to check/create admin profile",
      );
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

              {/* Settings Icon - Top Left (Hidden when profile is open) */}
              {!selectedPersonId && !profileEditMode && (
                <View
                  style={{
                    position: "absolute",
                    top: 60,
                    left: 16,
                    zIndex: 10,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setShowSettings(true)}
                    style={{
                      backgroundColor: "white",
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      justifyContent: "center",
                      alignItems: "center",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    <Ionicons
                      name="settings-outline"
                      size={24}
                      color="#374151"
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* Compact Admin Bar - Only when logged in */}
              <View className="pt-12">
                {user && (
                  <CompactAdminBar
                    user={user}
                    onControlPanelPress={() => setShowAdminDashboard(true)}
                    onUserPress={() => {
                      Alert.alert("Account", user.email, [
                        {
                          text: "Check Admin Profile",
                          onPress: handleCheckAdminProfile,
                        },
                        {
                          text: "Sign Out",
                          onPress: handleSignOut,
                          style: "destructive",
                        },
                        { text: "Cancel", style: "cancel" },
                      ]);
                    }}
                  />
                )}
              </View>

              {/* Login Button - Floating when not logged in */}
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
                <TreeView setProfileEditMode={setProfileEditMode} />
              </View>

              {/* Profile Sheet */}
              <ProfileSheet editMode={profileEditMode} />

              {/* Admin Dashboard Modal */}
              <Modal
                visible={showAdminDashboard}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setShowAdminDashboard(false)}
              >
                <AdminDashboard
                  navigation={{
                    goBack: () => setShowAdminDashboard(false),
                    navigate: (screen, params) => {
                      console.log("Navigate to:", screen, params);
                      // Handle navigation here
                    },
                  }}
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
