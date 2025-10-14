import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContextSimple";
import * as Haptics from "expo-haptics";
import subscriptionManager from "../services/subscriptionManager";
import { featureFlags } from "../config/featureFlags";
import { NAJDI_COLORS } from "../constants/najdiColors";

// iOS Standard Typography
const TYPOGRAPHY = {
  caption2: 11,
  caption1: 12,
};

interface NotificationBadgeProps {
  onPress: () => void;
}

export default function NotificationBadge({ onPress }: NotificationBadgeProps) {
  const { user, isAdmin } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const subscriptionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!user) return;

    // Create abort controller for cleanup
    abortControllerRef.current = new AbortController();

    loadUnreadCount();

    // Delay subscription setup to not block UI
    const setupTimer = setTimeout(() => {
      if (!abortControllerRef.current?.signal.aborted) {
        setupRealtimeSubscription();
      }
    }, 100);

    return () => {
      // Cleanup
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      clearTimeout(setupTimer);

      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [user, isAdmin]);

  const setupRealtimeSubscription = async () => {
    if (!user || abortControllerRef.current?.signal.aborted) return;

    try {
      const subscription = await subscriptionManager.subscribe({
        channelName: `badge-updates-${user.id}`,
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
        event: '*',
        onUpdate: (payload) => {
          // Check if aborted before processing
          if (abortControllerRef.current?.signal.aborted) return;

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

      if (!abortControllerRef.current?.signal.aborted) {
        subscriptionRef.current = subscription;
      } else {
        // If aborted while waiting, unsubscribe immediately
        subscription?.unsubscribe();
      }
    } catch (error) {
      console.error('Failed to setup badge subscription:', error);
      // Don't block UI - badge can still work without real-time updates
    }
  };

  const loadUnreadCount = async () => {
    try {
      if (!user || abortControllerRef.current?.signal.aborted) return;

      // Count unread notifications from the new notifications table
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (error) {
        console.error("Error loading unread count:", error);
        return;
      }

      if (abortControllerRef.current?.signal.aborted) return;

      setUnreadCount(count || 0);

      // Also count pending requests for admins (backward compatibility)
      if (isAdmin && featureFlags.profileLinkRequests) {
        const { count: pendingCount, error: pendingError } = await supabase
          .from("profile_link_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        if (pendingError) {
          console.error("Error loading pending requests count:", pendingError);
          return;
        }

        if (abortControllerRef.current?.signal.aborted) return;

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
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      accessibilityLabel={
        unreadCount > 0
          ? `الإشعارات. لديك ${unreadCount} إشعار غير مقروء`
          : "الإشعارات. لا توجد إشعارات جديدة"
      }
      accessibilityRole="button"
      accessibilityHint="افتح مركز الإشعارات"
    >
      <Ionicons name="notifications-outline" size={24} color={NAJDI_COLORS.text} />
      {unreadCount > 0 && (
        <View
          style={styles.badge}
          accessibilityLabel={`${unreadCount} إشعار جديد`}
        >
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
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: NAJDI_COLORS.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: NAJDI_COLORS.background,
  },
  badgeText: {
    color: NAJDI_COLORS.white,
    fontSize: TYPOGRAPHY.caption2,
    fontWeight: "700",
    fontFamily: "SF Arabic",
  },
});
