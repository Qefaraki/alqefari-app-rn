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
import subscriptionManager from "../services/subscriptionManager";

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

// Legacy/alias mapping for notification type values coming from the backend
const NotificationTypeAliases = {
  profile_link_approved: NotificationTypes.LINK_REQUEST_APPROVED,
  profile_link_rejected: NotificationTypes.LINK_REQUEST_REJECTED,
  link_approved: NotificationTypes.LINK_REQUEST_APPROVED,
  link_rejected: NotificationTypes.LINK_REQUEST_REJECTED,
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
  const [subscriptionError, setSubscriptionError] = useState(false);
  const subscriptionRef = useRef(null);
  const subscriptionTimeoutRef = useRef(null);

  // Animation values
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🔍 [NotificationCenter] useEffect triggered - visible:', visible, 'user:', !!user);

    if (visible && user) {
      console.log('🔍 [NotificationCenter] Opening notification center...');

      // Load notifications first (shows cached data quickly)
      console.log('🔍 [NotificationCenter] Loading notifications...');
      loadNotifications();

      // Setup subscription in background (non-blocking)
      console.log('🔍 [NotificationCenter] Scheduling subscription setup...');
      setTimeout(() => {
        console.log('🔍 [NotificationCenter] Setting up realtime subscription...');
        setupRealtimeSubscription();
      }, 100);

      // Animate in
      console.log('🔍 [NotificationCenter] Starting animations...');
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
      ]).start(() => {
        console.log('🔍 [NotificationCenter] Animation complete');
      });
    } else {
      // Clean up subscription and timeout when closing
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }
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
  }, [visible, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }
    };
  }, []);

  // Setup real-time subscription for notifications
  const setupRealtimeSubscription = async () => {
    console.log('🔍 [NotificationCenter] setupRealtimeSubscription called - user:', !!user);
    if (!user) return;

    // Clear any existing error state
    setSubscriptionError(false);

    try {
      console.log('🔍 [NotificationCenter] Creating subscription promise...');
      // Set a timeout for subscription attempt (10 seconds)
      const subscriptionPromise = subscriptionManager.subscribe({
        channelName: `notification-center-${user.id}`, // Unique channel name for notification center
        table: 'notifications',  // Using the actual table name, not the view
        filter: `user_id=eq.${user.id}`,
        event: '*',
        onUpdate: (payload) => {
          console.log('📬 New notification received:', payload);

          // Reload notifications on any change
          loadNotifications();

          // Show haptic feedback for new notifications
          if (payload.eventType === 'INSERT') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        },
        onError: (error) => {
          console.error('Notification subscription error:', error);
          // Set error state but don't retry infinitely
          setSubscriptionError(true);
        },
        component: { id: 'NotificationCenter' } // For WeakMap tracking
      });

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        subscriptionTimeoutRef.current = setTimeout(() => {
          reject(new Error('Subscription timeout after 10 seconds'));
        }, 10000);
      });

      // Race between subscription and timeout
      console.log('🔍 [NotificationCenter] Racing subscription vs timeout...');
      const subscription = await Promise.race([subscriptionPromise, timeoutPromise]);

      // Clear timeout if subscription succeeded
      console.log('🔍 [NotificationCenter] Subscription succeeded, clearing timeout...');
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }

      subscriptionRef.current = subscription;
      console.log('✅ [NotificationCenter] Real-time notifications subscription active');
    } catch (error) {
      console.error('Failed to setup notification subscription:', error);
      setSubscriptionError(true);

      // Clear timeout on error
      if (subscriptionTimeoutRef.current) {
        clearTimeout(subscriptionTimeoutRef.current);
        subscriptionTimeoutRef.current = null;
      }

      // Don't block UI - user can still see cached notifications
    }
  };

  // Load notifications from local storage and database
  const loadNotifications = async () => {
    console.log('🔍 [NotificationCenter] loadNotifications called');
    setLoading(true);
    try {
      console.log('🔍 [NotificationCenter] Loading from AsyncStorage...');
      // Load from local storage first for quick display
      const cached = await AsyncStorage.getItem(`notifications_${user?.id}`);
      if (cached) {
        const parsedNotifications = JSON.parse(cached);
        setNotifications(parsedNotifications);
        updateUnreadCount(parsedNotifications);
      }

      // Then fetch fresh data from the new notifications table
      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch notifications from the new notifications table
      console.log('🔍 [NotificationCenter] Fetching from Supabase...');
      const { data: dbNotifications, error } = await supabase
        .from("user_notifications")  // Using the view that includes related data
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      console.log('🔍 [NotificationCenter] Supabase response - error:', error, 'data length:', dbNotifications?.length);

      if (error) {
        console.error("❌ [NotificationCenter] Error fetching notifications:", error);
        setLoading(false);
        return;
      }

      // Transform database notifications to our format
      const notificationsList = (dbNotifications || []).map(notif => {
        const rawType = (notif.type || '').toLowerCase();
        const normalizedType = NotificationTypeAliases[rawType] || rawType;

        return {
          id: notif.id,
          type: normalizedType,
          title: notif.title,
          body: notif.body,
          data: notif.data || {},
          createdAt: notif.created_at,
          read: notif.is_read,
          profileName: notif.related_profile_name,
          profilePhoto: notif.related_profile_photo,
        };
      });

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

    // Update in database
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updatedNotifications);
    setUnreadCount(0);

    await AsyncStorage.setItem(
      `notifications_${user?.id}`,
      JSON.stringify(updatedNotifications)
    );

    // Mark all as read in database
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }

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
              <>
                {subscriptionError && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="warning-outline" size={16} color={colors.warning} />
                    <Text style={styles.errorBannerText}>
                      التحديثات التلقائية غير متاحة حالياً
                    </Text>
                  </View>
                )}
                {notifications.map(renderNotification)}
              </>
            ) : (
              <>
                {subscriptionError && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="warning-outline" size={16} color={colors.warning} />
                    <Text style={styles.errorBannerText}>
                      التحديثات التلقائية غير متاحة حالياً
                    </Text>
                  </View>
                )}
                {renderEmptyState()}
              </>
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
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${colors.warning}15`,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${colors.warning}30`,
  },
  errorBannerText: {
    fontSize: 14,
    color: colors.text,
    fontFamily: "SF Arabic",
    marginLeft: 8,
    flex: 1,
  },
});
