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
  const subscriptionTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (!user) return;

    loadUnreadCount();
    // Delay subscription setup to not block UI
    const setupTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setupRealtimeSubscription();
      }
    }, 100);

    return () => {
      isMountedRef.current = false;
      clearTimeout(setupTimer);

      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }

      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [user, isAdmin]);

  const setupRealtimeSubscription = async () => {
    if (!user || !isMountedRef.current) return;

    try {
      // Create subscription promise
      const subscriptionPromise = subscriptionManager.subscribe({
        channelName: `badge-updates-${user.id}`, // Changed to avoid conflict with notification center
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
        event: '*',
        onUpdate: (payload) => {
          if (!isMountedRef.current) return;

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
          // Don't retry or block UI on error
        },
        component: { id: 'NotificationBadge' }
      });

      // Create timeout promise (5 seconds for badge - shorter than notification center)
      const timeoutPromise = new Promise((_, reject) => {
        subscriptionTimeoutRef.current = setTimeout(() => {
          reject(new Error('Badge subscription timeout after 5 seconds'));
        }, 5000);
      });

      // Race between subscription and timeout
      const subscription = await Promise.race([subscriptionPromise, timeoutPromise]);

      // Clear timeout if subscription succeeded
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }

      if (isMountedRef.current) {
        subscriptionRef.current = subscription;
      }
    } catch (error) {
      console.error('Failed to setup badge subscription:', error);

      // Clear timeout on error
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }

      // Don't block UI - badge can still work without real-time updates
    }
  };

  const loadUnreadCount = async () => {
    try {
      if (!user || !isMountedRef.current) return;

      // Count unread notifications from the new notifications table
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (!isMountedRef.current) return;

      setUnreadCount(count || 0);

      // Also count pending requests for admins (backward compatibility)
      if (isAdmin) {
        const { count: pendingCount } = await supabase
          .from("profile_link_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        if (!isMountedRef.current) return;

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