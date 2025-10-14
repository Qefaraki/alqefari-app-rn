import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import { ar } from "date-fns/locale";
import * as Haptics from "expo-haptics";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContextSimple";
import AsyncStorage from "@react-native-async-storage/async-storage";
import subscriptionManager from "../services/subscriptionManager";
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { NAJDI_COLORS } from "../constants/najdiColors";
import { Notification, NotificationType, NOTIFICATION_TYPE_ALIASES } from "../types/notifications";

// iOS Standard Typography Scale
const TYPOGRAPHY = {
  largeTitle: 34,
  title1: 28,
  title2: 22,
  title3: 20,
  headline: 17,
  body: 17,
  callout: 16,
  subheadline: 15,
  footnote: 13,
  caption1: 12,
  caption2: 11,
};

// Get icon and color for notification type
const getNotificationStyle = (type: NotificationType): { icon: string; color: string } => {
  switch (type) {
    case 'link_request_approved':
      return { icon: "checkmark-circle", color: NAJDI_COLORS.success };
    case 'link_request_rejected':
      return { icon: "close-circle", color: NAJDI_COLORS.error };
    case 'link_request_pending':
      return { icon: "time", color: NAJDI_COLORS.secondary };
    case 'new_link_request':
    case 'new_profile_link_request':
      return { icon: "person-add", color: NAJDI_COLORS.primary };
    case 'admin_message':
      return { icon: "megaphone", color: NAJDI_COLORS.primary };
    case 'family_update':
    case 'profile_updated':
      return { icon: "people", color: NAJDI_COLORS.secondary };
    case 'system_message':
      return { icon: "information-circle", color: NAJDI_COLORS.text };
    default:
      return { icon: "notifications", color: NAJDI_COLORS.text };
  }
};

interface DateGroup {
  label: string;
  notifications: Notification[];
}

// Group notifications by date
const groupNotificationsByDate = (notifications: Notification[]): DateGroup[] => {
  const groups: Record<string, DateGroup> = {};

  notifications.forEach(notification => {
    const date = new Date(notification.createdAt);
    let dateKey: string;
    let dateLabel: string;

    if (isToday(date)) {
      dateKey = 'today';
      dateLabel = 'اليوم';
    } else if (isYesterday(date)) {
      dateKey = 'yesterday';
      dateLabel = 'أمس';
    } else {
      dateKey = format(date, 'yyyy-MM-dd');
      dateLabel = format(date, 'd MMMM', { locale: ar });
    }

    if (!groups[dateKey]) {
      groups[dateKey] = {
        label: dateLabel,
        notifications: [],
      };
    }

    groups[dateKey].notifications.push(notification);
  });

  // Sort groups by date (newest first)
  const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
    if (a === 'today') return -1;
    if (b === 'today') return 1;
    if (a === 'yesterday') return -1;
    if (b === 'yesterday') return 1;
    return b.localeCompare(a);
  });

  return sortedGroups.map(([, value]) => value);
};

interface NotificationCenterProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToAdmin?: (openLinkRequests: boolean) => void;
}

export default function NotificationCenter({ visible, onClose, onNavigateToAdmin }: NotificationCenterProps) {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const swipeableRefs = useRef<Record<string, any>>({});

  // Animation value for fade in/out
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && user) {
      // Create abort controller for cleanup
      abortControllerRef.current = new AbortController();

      // Load notifications first (shows cached data quickly)
      loadNotifications();

      // Setup subscription in background (non-blocking)
      setTimeout(() => {
        setupRealtimeSubscription();
      }, 100);

      // Animate in with fade
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      // Clean up subscription when closing
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      // Animate out with fade
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  // Setup real-time subscription for notifications
  const setupRealtimeSubscription = async () => {
    if (!user || abortControllerRef.current?.signal.aborted) return;

    // Clear any existing error state
    setSubscriptionError(false);

    try {
      const subscription = await subscriptionManager.subscribe({
        channelName: `notification-center-${user.id}`,
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
        event: '*',
        onUpdate: (payload) => {
          // Check if aborted before processing
          if (abortControllerRef.current?.signal.aborted) return;

          // Reload notifications on any change
          loadNotifications();

          // Show haptic feedback for new notifications
          if (payload.eventType === 'INSERT') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        },
        onError: (error) => {
          console.error('Notification subscription error:', error);
          if (!abortControllerRef.current?.signal.aborted) {
            setSubscriptionError(true);
          }
        },
        component: { id: 'NotificationCenter' }
      });

      if (!abortControllerRef.current?.signal.aborted) {
        subscriptionRef.current = subscription;
      }
    } catch (error) {
      console.error('Failed to setup notification subscription:', error);
      if (!abortControllerRef.current?.signal.aborted) {
        setSubscriptionError(true);
      }
    }
  };

  // Load notifications from local storage and database
  const loadNotifications = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load from local storage first for quick display
      const cached = await AsyncStorage.getItem(`notifications_${user.id}`);
      if (cached && !abortControllerRef.current?.signal.aborted) {
        const parsedNotifications = JSON.parse(cached);
        setNotifications(parsedNotifications);
        updateUnreadCount(parsedNotifications);
      }

      // Fetch from database
      const { data: dbNotifications, error } = await supabase
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching notifications:", error);
        setLoading(false);
        return;
      }

      if (abortControllerRef.current?.signal.aborted) return;

      // Transform database notifications to our format
      const notificationsList: Notification[] = (dbNotifications || []).map(notif => {
        const rawType = (notif.type || '').toLowerCase();
        const normalizedType = NOTIFICATION_TYPE_ALIASES[rawType] || rawType as NotificationType;

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

  const updateUnreadCount = (notificationsList: Notification[]) => {
    const unread = notificationsList.filter(n => !n.read).length;
    setUnreadCount(unread);
  };

  const markAsRead = async (notificationId: string) => {
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
        .update({ is_read: true, read_at: new Date().toISOString() })
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
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user?.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const deleteNotification = async (notificationId: string) => {
    // Remove from local state
    const updatedNotifications = notifications.filter(n => n.id !== notificationId);
    setNotifications(updatedNotifications);
    updateUnreadCount(updatedNotifications);

    // Update in storage
    await AsyncStorage.setItem(
      `notifications_${user?.id}`,
      JSON.stringify(updatedNotifications)
    );

    // Delete from database
    try {
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const clearAll = async () => {
    Alert.alert(
      "مسح جميع الإشعارات",
      "هل أنت متأكد من مسح جميع الإشعارات؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "مسح الكل",
          style: "destructive",
          onPress: async () => {
            setNotifications([]);
            setUnreadCount(0);
            await AsyncStorage.removeItem(`notifications_${user?.id}`);

            // Delete all from database
            try {
              await supabase
                .from('notifications')
                .delete()
                .eq('user_id', user?.id);
            } catch (error) {
              console.error('Error clearing all notifications:', error);
            }

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ],
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const renderNotification = (notification: Notification) => {
    const { icon, color } = getNotificationStyle(notification.type);
    const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
      addSuffix: true,
      locale: ar,
    });

    const renderRightActions = () => {
      return (
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            deleteNotification(notification.id);
          }}
          accessibilityLabel="حذف الإشعار"
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={24} color={NAJDI_COLORS.white} />
        </TouchableOpacity>
      );
    };

    const handleNotificationPress = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!notification.read) {
        markAsRead(notification.id);
      }

      // Handle notification tap based on type
      if ((notification.type === 'new_link_request' || notification.type === 'new_profile_link_request') && isAdmin) {
        // Use the callback if provided (when opened from Settings)
        if (onNavigateToAdmin) {
          onNavigateToAdmin(true);
        } else {
          // Fallback to direct navigation
          onClose();
          setTimeout(() => {
            router.push({
              pathname: '/(app)/admin',
              params: { openLinkRequests: 'true' }
            });
          }, 100);
        }
      } else if (notification.type === 'link_request_pending') {
        onClose();
        router.push('/profile-linking');
      } else if (notification.type === 'link_request_approved') {
        onClose();
        router.push('/');
      } else if (notification.type === 'link_request_rejected') {
        onClose();
        router.push('/contact-admin');
      } else if (notification.type === 'admin_message') {
        onClose();
        router.push('/');
      }
    };

    return (
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.current[notification.id] = ref;
        }}
        renderRightActions={renderRightActions}
        overshootRight={false}
        key={notification.id}
        shouldCancelWhenOutside={false}
        onSwipeableOpen={() => {
          // Close other open swipeables
          Object.keys(swipeableRefs.current).forEach(key => {
            if (key !== notification.id && swipeableRefs.current[key]) {
              swipeableRefs.current[key].close();
            }
          });
        }}
      >
        <TouchableOpacity
          style={styles.notificationItem}
          onPress={handleNotificationPress}
          activeOpacity={0.95}
          accessibilityLabel={`${notification.title}. ${notification.body}. ${timeAgo}`}
          accessibilityRole="button"
          accessibilityState={{ selected: !notification.read }}
        >
          {!notification.read && (
            <View
              style={styles.unreadDot}
              accessibilityLabel="إشعار غير مقروء"
            />
          )}
          <View style={styles.iconContainer}>
            <Ionicons name={icon as any} size={24} color={color} />
          </View>
          <View style={styles.notificationContent}>
            <Text style={[styles.notificationTitle, !notification.read && styles.notificationTitleUnread]}>
              {notification.title}
            </Text>
            <Text style={styles.notificationBody} numberOfLines={2}>
              {notification.body}
            </Text>
            <Text style={styles.notificationTime}>{timeAgo}</Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderDateGroup = (group: DateGroup) => {
    return (
      <View key={group.label}>
        <Text style={styles.dateHeader}>{group.label}</Text>
        {group.notifications.map(renderNotification)}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Image
          source={require('../../assets/logo/AlqefariEmblem.png')}
          style={styles.emptyEmblem}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
      <Text style={styles.emptySubtitle}>
        ستصلك إشعارات عن التحديثات المهمة{'\n'}
        في شجرة عائلة القفاري
      </Text>
    </View>
  );

  const renderSkeletonLoader = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeletonItem}>
          <View style={styles.skeletonIcon} />
          <View style={styles.skeletonContent}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonBody} />
            <View style={styles.skeletonTime} />
          </View>
        </View>
      ))}
    </View>
  );

  const notificationGroups = groupNotificationsByDate(notifications);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <Animated.View
        style={[
          styles.container,
          { opacity: fadeAnim },
        ]}
      >
        <SafeAreaView style={styles.safeArea}>
          <GestureHandlerRootView style={styles.gestureRoot}>
            {/* Header - Settings Style */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Image
                  source={require('../../assets/logo/AlqefariEmblem.png')}
                  style={styles.emblem}
                  resizeMode="contain"
                  accessibilityLabel="شعار عائلة القفاري"
                />
                <Text style={styles.headerTitle}>الإشعارات</Text>
                {unreadCount > 0 && (
                  <View
                    style={styles.headerBadge}
                    accessibilityLabel={`${unreadCount} إشعار غير مقروء`}
                  >
                    <Text style={styles.headerBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </View>
              <View style={styles.headerActions}>
                {notifications.length > 0 && (
                  <TouchableOpacity
                    style={styles.headerActionButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (unreadCount > 0) {
                        markAllAsRead();
                      } else {
                        clearAll();
                      }
                    }}
                    accessibilityLabel={unreadCount > 0 ? "تعليم الكل كمقروء" : "مسح جميع الإشعارات"}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={unreadCount > 0 ? "checkmark-done" : "trash-outline"}
                      size={22}
                      color={NAJDI_COLORS.text}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  accessibilityLabel="إغلاق"
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={28} color={NAJDI_COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Notifications List */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={NAJDI_COLORS.primary}
                />
              }
            >
              {loading && notifications.length === 0 ? (
                renderSkeletonLoader()
              ) : notifications.length > 0 ? (
                <View style={styles.notificationsList}>
                  {subscriptionError && (
                    <View style={styles.errorBanner}>
                      <Ionicons name="warning-outline" size={16} color={NAJDI_COLORS.secondary} />
                      <Text style={styles.errorBannerText}>
                        التحديثات التلقائية غير متاحة حالياً
                      </Text>
                    </View>
                  )}
                  {notificationGroups.map(renderDateGroup)}
                </View>
              ) : (
                renderEmptyState()
              )}
            </ScrollView>
          </GestureHandlerRootView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAJDI_COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  gestureRoot: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: NAJDI_COLORS.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  emblem: {
    width: 44,
    height: 44,
    tintColor: NAJDI_COLORS.text,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.largeTitle,
    fontWeight: "700",
    color: NAJDI_COLORS.text,
    fontFamily: "SF Arabic",
  },
  headerBadge: {
    backgroundColor: NAJDI_COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
    marginLeft: 12,
  },
  headerBadgeText: {
    color: NAJDI_COLORS.white,
    fontSize: TYPOGRAPHY.caption1,
    fontWeight: "700",
    fontFamily: "SF Arabic",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActionButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  notificationsList: {
    paddingTop: 8,
  },
  dateHeader: {
    fontSize: TYPOGRAPHY.subheadline,
    fontWeight: "600",
    color: NAJDI_COLORS.muted,
    fontFamily: "SF Arabic",
    marginTop: 20,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  notificationItem: {
    backgroundColor: NAJDI_COLORS.white,
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 44,
    shadowColor: NAJDI_COLORS.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NAJDI_COLORS.primary,
    marginRight: 12,
    marginTop: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${NAJDI_COLORS.container}40`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: TYPOGRAPHY.callout,
    fontWeight: "400",
    color: NAJDI_COLORS.text,
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  notificationTitleUnread: {
    fontWeight: "600",
  },
  notificationBody: {
    fontSize: TYPOGRAPHY.subheadline,
    color: NAJDI_COLORS.muted,
    fontFamily: "SF Arabic",
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: TYPOGRAPHY.footnote,
    color: NAJDI_COLORS.muted,
    fontFamily: "SF Arabic",
  },
  deleteAction: {
    backgroundColor: NAJDI_COLORS.error,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "100%",
    borderRadius: 12,
    marginVertical: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${NAJDI_COLORS.container}30`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    padding: 20,
  },
  emptyEmblem: {
    width: 80,
    height: 80,
    tintColor: NAJDI_COLORS.container,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.title3,
    fontWeight: "600",
    color: NAJDI_COLORS.text,
    fontFamily: "SF Arabic",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.subheadline,
    color: NAJDI_COLORS.muted,
    fontFamily: "SF Arabic",
    textAlign: "center",
    lineHeight: 22,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${NAJDI_COLORS.secondary}15`,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${NAJDI_COLORS.secondary}30`,
  },
  errorBannerText: {
    fontSize: TYPOGRAPHY.subheadline,
    color: NAJDI_COLORS.text,
    fontFamily: "SF Arabic",
    marginLeft: 8,
    flex: 1,
  },
  // Skeleton loading states
  skeletonContainer: {
    paddingTop: 20,
  },
  skeletonItem: {
    backgroundColor: NAJDI_COLORS.white,
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NAJDI_COLORS.container,
    opacity: 0.3,
    marginRight: 12,
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonTitle: {
    height: 16,
    backgroundColor: NAJDI_COLORS.container,
    opacity: 0.3,
    borderRadius: 4,
    marginBottom: 8,
    width: '70%',
  },
  skeletonBody: {
    height: 14,
    backgroundColor: NAJDI_COLORS.container,
    opacity: 0.3,
    borderRadius: 4,
    marginBottom: 8,
    width: '90%',
  },
  skeletonTime: {
    height: 12,
    backgroundColor: NAJDI_COLORS.container,
    opacity: 0.3,
    borderRadius: 4,
    width: '30%',
  },
});
