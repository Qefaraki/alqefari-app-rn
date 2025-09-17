import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { phoneAuthService } from "../services/phoneAuth";
import { supabase } from "../services/supabase";
import * as Haptics from "expo-haptics";

// Najdi Sadu Color Palette
const colors = {
  background: "#F9F7F3", // Al-Jass White
  container: "#D1BBA3", // Camel Hair Beige
  text: "#242121", // Sadu Night
  primary: "#A13333", // Najdi Crimson
  secondary: "#D58C4A", // Desert Ochre
  success: "#4CAF50",
  warning: "#FFC107",
  error: "#F44336",
};

const PendingApprovalBanner = ({ user, onStatusChange, onRefresh }) => {
  const [linkRequest, setLinkRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = new Animated.Value(0);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    checkLinkStatus();
    subscribeToUpdates();

    // Entrance animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Pulse animation for pending icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    return () => {
      // Cleanup subscription
    };
  }, []);

  const checkLinkStatus = async () => {
    setLoading(true);
    try {
      const result = await phoneAuthService.getUserLinkRequests();
      if (result.success && result.requests?.length > 0) {
        // Get the most recent request
        const latestRequest = result.requests.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at),
        )[0];

        setLinkRequest(latestRequest);

        // If approved, notify parent
        if (latestRequest.status === "approved" && onStatusChange) {
          onStatusChange("approved", latestRequest);
        }
      }
    } catch (error) {
      console.error("Error checking link status:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    if (!user?.id) return;

    const subscription = supabase
      .channel("link-requests")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profile_link_requests",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = payload.new.status;

          if (newStatus === "approved") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert(
              "🎉 تمت الموافقة!",
              "تم ربط ملفك الشخصي بنجاح. يمكنك الآن تعديل معلوماتك.",
              [
                {
                  text: "ممتاز",
                  onPress: () => onStatusChange?.("approved", payload.new),
                },
              ],
            );
          } else if (newStatus === "rejected") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert(
              "طلب مرفوض",
              payload.new.review_notes ||
                "تم رفض طلب ربط الملف. يرجى التواصل مع المشرف.",
              [
                { text: "إلغاء", style: "cancel" },
                {
                  text: "محاولة أخرى",
                  onPress: () => onStatusChange?.("retry"),
                },
              ],
            );
          }

          setLinkRequest(payload.new);
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await checkLinkStatus();

    if (onRefresh) {
      await onRefresh();
    }

    setRefreshing(false);
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "الآن";
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    return date.toLocaleDateString("ar-SA");
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>جارٍ التحقق من الحالة...</Text>
        </View>
      </View>
    );
  }

  if (!linkRequest) {
    return null;
  }

  const isPending = linkRequest.status === "pending";
  const isRejected = linkRequest.status === "rejected";
  const isApproved = linkRequest.status === "approved";

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim },
        isPending && styles.pendingContainer,
        isRejected && styles.rejectedContainer,
        isApproved && styles.approvedContainer,
      ]}
    >
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.iconContainer,
            isPending && { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Ionicons
            name={
              isPending
                ? "time-outline"
                : isRejected
                  ? "close-circle-outline"
                  : "checkmark-circle-outline"
            }
            size={28}
            color={
              isPending
                ? colors.secondary
                : isRejected
                  ? colors.error
                  : colors.success
            }
          />
        </Animated.View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {isPending && "في انتظار الموافقة"}
            {isRejected && "تم رفض الطلب"}
            {isApproved && "تمت الموافقة"}
          </Text>
          <Text style={styles.subtitle}>
            {isPending && `طلب ربط "${linkRequest.profile_name}" قيد المراجعة`}
            {isRejected &&
              (linkRequest.review_notes || "يرجى التواصل مع المشرف")}
            {isApproved && "ملفك الشخصي مرتبط بحسابك"}
          </Text>
          <Text style={styles.timestamp}>
            {formatTimeAgo(linkRequest.created_at)}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Animated.View
              style={[
                refreshing && {
                  transform: [
                    {
                      rotate: refreshing
                        ? fadeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0deg", "360deg"],
                          })
                        : "0deg",
                    },
                  ],
                },
              ]}
            >
              <Ionicons name="refresh" size={22} color={colors.primary} />
            </Animated.View>
          </TouchableOpacity>

          {isRejected && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => onStatusChange?.("retry")}
            >
              <Text style={styles.retryText}>محاولة أخرى</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {isPending && (
        <View style={styles.infoBar}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.text}
          />
          <Text style={styles.infoText}>
            عادة ما تتم المراجعة خلال ساعة إلى ساعتين
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.container + "40",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pendingContainer: {
    borderColor: colors.secondary + "60",
    backgroundColor: colors.secondary + "10",
  },
  rejectedContainer: {
    borderColor: colors.error + "60",
    backgroundColor: colors.error + "10",
  },
  approvedContainer: {
    borderColor: colors.success + "60",
    backgroundColor: colors.success + "10",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.text + "CC",
    fontFamily: "SF Arabic",
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
    color: colors.text + "80",
    fontFamily: "SF Arabic",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  refreshButton: {
    padding: 8,
  },
  retryButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primary,
    borderRadius: 16,
  },
  retryText: {
    fontSize: 13,
    color: "#FFF",
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  infoText: {
    fontSize: 12,
    color: colors.text + "99",
    fontFamily: "SF Arabic",
    marginLeft: 6,
    flex: 1,
  },
  loadingContainer: {
    padding: 20,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 14,
    color: colors.text + "AA",
    fontFamily: "SF Arabic",
  },
});

export default PendingApprovalBanner;
