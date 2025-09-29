import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import * as Haptics from "expo-haptics";
import subscriptionManager from "../services/subscriptionManager";

// Najdi Sadu Color System
const colors = {
  background: "#F9F7F3",
  primary: "#A13333",
  text: "#242121",
  white: "#FFFFFF",
};

export default function NotificationBadge({ onPress }) {
  const { user, isAdmin } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const subscriptionRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    loadUnreadCount();
    setupRealtimeSubscription();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [user, isAdmin]);

  const setupRealtimeSubscription = async () => {
    if (!user) return;

    try {
      // Subscribe to notifications for real-time badge updates
      const subscription = await subscriptionManager.subscribe({
        channelName: `notification-badge-${user.id}`,
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
        event: '*',
        onUpdate: (payload) => {
          console.log('🔔 Badge notification update:', payload);
          // Reload count on any notification change
          loadUnreadCount();

          // Vibrate on new notification
          if (payload.eventType === 'INSERT') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        },
        onError: (error) => {
          console.error('Badge subscription error:', error);
        },
        component: { id: 'NotificationBadge' }
      });

      subscriptionRef.current = subscription;
    } catch (error) {
      console.error('Failed to setup badge subscription:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      if (!user) return;

      // Count unread notifications from the new notifications table
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      setUnreadCount(count || 0);

      // Also count pending requests for admins (backward compatibility)
      if (isAdmin) {
        const { count: pendingCount } = await supabase
          .from("profile_link_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        // Show the higher count (notifications or pending requests)
        const totalCount = Math.max(count || 0, pendingCount || 0);
        setUnreadCount(totalCount);
      }
    } catch (error) {
      console.error("Error loading unread count:", error);
    }
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress}>
      <Ionicons name="notifications-outline" size={24} color={colors.text} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    padding: 8,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "SF Arabic",
  },
});