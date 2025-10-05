import React, { useState, useEffect } from "react";
import { AppState, Platform } from "react-native";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { DynamicColorIOS } from "react-native";
import { useAuth } from "../../src/contexts/AuthContextSimple";
import notificationService from "../../src/services/notifications";
import { router } from "expo-router";

export default function AppLayout() {
  const { user, isAdmin, isGuestMode, isAuthenticated } = useAuth();
  const [notificationInitialized, setNotificationInitialized] = useState(false);

  // Initialize notifications when user is authenticated
  useEffect(() => {
    const initializeNotifications = async () => {
      if (user && isAuthenticated && !notificationInitialized) {
        try {
          await notificationService.initialize();

          notificationService.setNavigationCallbacks({
            navigateToProfile: (profileId) => {
              router.replace("/settings");
            },
            navigateToAdminRequests: () => {
              if (isAdmin) {
                router.replace("/admin");
              }
            },
          });

          notificationService.setEventCallbacks({
            onApprovalReceived: (data) => {
              // Handle approval notification
            },
            onRejectionReceived: (data) => {
              // Handle rejection notification
            },
            onNewRequestReceived: (data) => {
              // Handle new request notification
            },
          });

          setNotificationInitialized(true);
        } catch (error) {
          console.error('Error initializing notifications:', error);
        }
      }
    };

    initializeNotifications();
  }, [user, isGuestMode, isAdmin, notificationInitialized, isAuthenticated]);

  // Handle app state changes for badge updates
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active' && user) {
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
        <Icon src={require("../../assets/AlqefariEmblem-TabIcon.png")} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="news">
        <Label>الأخبار</Label>
        <Icon sf={{ default: "newspaper", selected: "newspaper.fill" }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Label>الإعدادات</Label>
        <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
      </NativeTabs.Trigger>

      {Platform.OS === "ios" && (
        <NativeTabs.Trigger name="admin" hidden={!isAdmin}>
          <Label>الإدارة</Label>
          <Icon
            sf={{
              default: "star",
              selected: "star.fill",
            }}
          />
        </NativeTabs.Trigger>
      )}
    </NativeTabs>
  );
}