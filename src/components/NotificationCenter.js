import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  SafeAreaView,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import * as Haptics from "expo-haptics";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Najdi Sadu Color System
const colors = {
  background: "#F9F7F3",    // Al-Jass White
  container: "#D1BBA3",      // Camel Hair Beige
  text: "#242121",          // Sadu Night
  primary: "#A13333",       // Najdi Crimson
  secondary: "#D58C4A",     // Desert Ochre
  muted: "#24212199",       // Sadu Night 60%
  success: "#22C55E",
  warning: "#D58C4A",
  error: "#EF4444",
  info: "#3B82F6",
  border: "#D1BBA340",
};

// Notification types
const NotificationTypes = {
  LINK_REQUEST_APPROVED: "link_request_approved",
  LINK_REQUEST_REJECTED: "link_request_rejected",
  LINK_REQUEST_PENDING: "link_request_pending",
  NEW_LINK_REQUEST: "new_link_request",
  ADMIN_MESSAGE: "admin_message",
  FAMILY_UPDATE: "family_update",
};

// Get icon and color for notification type
const getNotificationStyle = (type) => {
  switch (type) {
    case NotificationTypes.LINK_REQUEST_APPROVED:
      return { icon: "checkmark-circle", color: colors.success };
    case NotificationTypes.LINK_REQUEST_REJECTED:
      return { icon: "close-circle", color: colors.error };
    case NotificationTypes.LINK_REQUEST_PENDING:
      return { icon: "time", color: colors.warning };
    case NotificationTypes.NEW_LINK_REQUEST:
      return { icon: "person-add", color: colors.info };
    case NotificationTypes.ADMIN_MESSAGE:
      return { icon: "megaphone", color: colors.primary };
    case NotificationTypes.FAMILY_UPDATE:
      return { icon: "people", color: colors.secondary };
    default:
      return { icon: "notifications", color: colors.text };
  }
};

export default function NotificationCenter({ visible, onClose }) {
  const { user, isAdmin } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Animation values
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      loadNotifications();
      // Animate in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_WIDTH,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Load notifications from local storage and database
  const loadNotifications = async () => {
    setLoading(true);
    try {
      // Load from local storage first for quick display
      const cached = await AsyncStorage.getItem(`notifications_${user?.id}`);
      if (cached) {
        const parsedNotifications = JSON.parse(cached);
        setNotifications(parsedNotifications);
        updateUnreadCount(parsedNotifications);
      }

      // Then fetch fresh data
      if (!user) {
        setLoading(false);
        return;
      }

      const notificationsList = [];

      // For regular users - get their link request status changes
      if (!isAdmin) {
        const { data: requests } = await supabase
          .from("profile_link_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (requests) {
          requests.forEach(request => {
            // Add notification for each status
            if (request.status === "approved") {
              notificationsList.push({
                id: `approved_${request.id}`,
                type: NotificationTypes.LINK_REQUEST_APPROVED,
                title: "تمت الموافقة! 🎉",
                body: "تم ربط ملفك الشخصي بنجاح",
                data: { profileId: request.profile_id },
                createdAt: request.approved_at || request.updated_at,
                read: request.approval_seen || false,
              });
            } else if (request.status === "rejected") {
              notificationsList.push({
                id: `rejected_${request.id}`,
                type: NotificationTypes.LINK_REQUEST_REJECTED,
                title: "تم رفض الطلب",
                body: request.rejection_reason || "يرجى التواصل مع المشرف",
                createdAt: request.rejected_at || request.updated_at,
                read: request.rejection_seen || false,
              });
            } else if (request.status === "pending") {
              notificationsList.push({
                id: `pending_${request.id}`,
                type: NotificationTypes.LINK_REQUEST_PENDING,
                title: "طلبك قيد المراجعة",
                body: `تم إرسال طلب ربط: ${request.name_chain}`,
                createdAt: request.created_at,
                read: true, // Always read since user created it
              });
            }
          });
        }
      }

      // For admins - get new link requests
      if (isAdmin) {
        const { data: requests } = await supabase
          .from("profile_link_requests")
          .select(`
            *,
            profile:profile_id(name)
          `)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(20);

        if (requests) {
          requests.forEach(request => {
            notificationsList.push({
              id: `new_request_${request.id}`,
              type: NotificationTypes.NEW_LINK_REQUEST,
              title: "طلب ربط جديد",
              body: `من: ${request.name_chain || request.profile?.name || "غير محدد"}`,
              data: { requestId: request.id },
              createdAt: request.created_at,
              read: request.admin_viewed || false,
            });
          });
        }
      }

      // Sort by date (newest first)
      notificationsList.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      );

      setNotifications(notificationsList);
      updateUnreadCount(notificationsList);

      // Cache notifications
      await AsyncStorage.setItem(
        `notifications_${user.id}`,
        JSON.stringify(notificationsList)
      );
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
    setLoading(false);
  };

  const updateUnreadCount = (notificationsList) => {
    const unread = notificationsList.filter(n => !n.read).length;
    setUnreadCount(unread);
  };

  const markAsRead = async (notificationId) => {
    const updatedNotifications = notifications.map(n =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    setNotifications(updatedNotifications);
    updateUnreadCount(updatedNotifications);

    // Update in storage
    await AsyncStorage.setItem(
      `notifications_${user?.id}`,
      JSON.stringify(updatedNotifications)
    );

    // Update in database if needed
    // ... database update logic
  };

  const markAllAsRead = async () => {
    const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updatedNotifications);
    setUnreadCount(0);

    await AsyncStorage.setItem(
      `notifications_${user?.id}`,
      JSON.stringify(updatedNotifications)
    );

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const clearAll = async () => {
    setNotifications([]);
    setUnreadCount(0);
    await AsyncStorage.removeItem(`notifications_${user?.id}`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const renderNotification = (notification) => {
    const { icon, color } = getNotificationStyle(notification.type);
    const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
      addSuffix: true,
      locale: ar,
    });

    return (
      <TouchableOpacity
        key={notification.id}
        style={[
          styles.notificationItem,
          !notification.read && styles.unreadNotification,
        ]}
        onPress={() => {
          if (!notification.read) {
            markAsRead(notification.id);
          }
          // Handle notification tap based on type
          // ... navigation logic
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.notificationIcon, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle}>{notification.title}</Text>
          <Text style={styles.notificationBody}>{notification.body}</Text>
          <Text style={styles.notificationTime}>{timeAgo}</Text>
        </View>
        {!notification.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-off-outline" size={64} color={colors.muted} />
      <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
      <Text style={styles.emptySubtitle}>ستظهر الإشعارات الجديدة هنا</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity style={styles.backdropTouch} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>الإشعارات</Text>
            {unreadCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>

          {/* Actions */}
          {notifications.length > 0 && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={markAllAsRead}
                disabled={unreadCount === 0}
              >
                <Text style={[
                  styles.actionText,
                  unreadCount === 0 && styles.disabledActionText
                ]}>
                  تحديد الكل كمقروء
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={clearAll}>
                <Text style={styles.actionText}>مسح الكل</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Notifications List */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          >
            {loading && notifications.length === 0 ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>جاري التحميل...</Text>
              </View>
            ) : notifications.length > 0 ? (
              notifications.map(renderNotification)
            ) : (
              renderEmptyState()
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  backdropTouch: {
    flex: 1,
  },
  container: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: colors.background,
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginLeft: 12,
  },
  headerBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  headerBadgeText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SF Arabic",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionButton: {
    padding: 4,
  },
  actionText: {
    fontSize: 14,
    color: colors.primary,
    fontFamily: "SF Arabic",
  },
  disabledActionText: {
    color: colors.muted,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unreadNotification: {
    backgroundColor: `${colors.primary}08`,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 2,
  },
  notificationBody: {
    fontSize: 14,
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: "SF Arabic",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "SF Arabic",
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  loadingText: {
    fontSize: 16,
    color: colors.muted,
    fontFamily: "SF Arabic",
  },
});