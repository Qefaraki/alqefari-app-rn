import "../global.css"; // Import global CSS for NativeWind styles
import React from "react";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS, Platform } from "react-native";
import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { AdminModeProvider } from "../src/contexts/AdminModeContext";
import { SettingsProvider } from "../src/contexts/SettingsContext";

function TabLayout() {
  const { isAdmin, isLoading } = useAuth();

  // Don't render tabs until auth is loaded
  if (isLoading) {
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

      <NativeTabs.Trigger name="settings">
        <Label>الإعدادات</Label>
        <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Label>الملف</Label>
        <Icon
          sf={{
            default: "person.crop.circle",
            selected: "person.crop.circle.fill",
          }}
        />
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
