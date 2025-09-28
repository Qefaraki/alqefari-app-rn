import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import * as Haptics from "expo-haptics";

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

  useEffect(() => {
    if (!user) return;

    loadUnreadCount();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel("notification-badge")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profile_link_requests",
        },
        loadUnreadCount
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, isAdmin]);

  const loadUnreadCount = async () => {
    try {
      if (!user) return;

      let count = 0;

      if (isAdmin) {
        // For admins - count pending requests
        const { count: pendingCount } = await supabase
          .from("profile_link_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .eq("admin_viewed", false);

        count = pendingCount || 0;
      } else {
        // For regular users - count unread status changes
        const { data: requests } = await supabase
          .from("profile_link_requests")
          .select("status, approval_seen, rejection_seen")
          .eq("user_id", user.id)
          .in("status", ["approved", "rejected"]);

        if (requests) {
          count = requests.filter(r => {
            if (r.status === "approved" && !r.approval_seen) return true;
            if (r.status === "rejected" && !r.rejection_seen) return true;
            return false;
          }).length;
        }
      }

      setUnreadCount(count);
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