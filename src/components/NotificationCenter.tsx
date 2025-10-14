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

// Get icon and color for notification type (iOS-style outline icons)
const getNotificationStyle = (type: NotificationType): { icon: string; color: string } => {
  switch (type) {
    case 'link_request_approved':
      return { icon: "checkmark-circle-outline", color: NAJDI_COLORS.success };
    case 'link_request_rejected':
      return { icon: "close-circle-outline", color: NAJDI_COLORS.error };
    case 'link_request_pending':
      return { icon: "time-outline", color: NAJDI_COLORS.secondary };
    case 'new_link_request':
    case 'new_profile_link_request':
      return { icon: "person-add-outline", color: NAJDI_COLORS.primary };
    case 'admin_message':
      return { icon: "megaphone-outline", color: NAJDI_COLORS.primary };
    case 'family_update':
    case 'profile_updated':
      return { icon: "people-outline", color: NAJDI_COLORS.secondary };
    case 'system_message':
      return { icon: "information-circle-outline", color: NAJDI_COLORS.text };
    default:
      return { icon: "notifications-outline", color: NAJDI_COLORS.text };
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

  const renderNotification = (notification: Notification, isLast: boolean) => {
    const { icon, color } = getNotificationStyle(notification.type);
    const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
      addSuffix: true,
      locale: ar,
    });

    const renderRightActions = () => {
      return (
        <View style={styles.swipeActionsContainer}>
          {!notification.read && (
            <TouchableOpacity
              style={styles.markReadAction}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                markAsRead(notification.id);
                // Close swipeable after marking as read
                swipeableRefs.current[notification.id]?.close();
              }}
              accessibilityLabel="تعليم كمقروء"
              accessibilityRole="button"
            >
              <Ionicons name="checkmark" size={24} color={NAJDI_COLORS.white} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.deleteAction}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              deleteNotification(notification.id);
            }}
            accessibilityLabel="حذف الإشعار"
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={22} color={NAJDI_COLORS.white} />
          </TouchableOpacity>
        </View>
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
        friction={2}
        rightThreshold={40}
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
          style={[
            styles.notificationItem,
            !isLast && styles.notificationItemWithBorder,
          ]}
          onPress={handleNotificationPress}
          activeOpacity={0.7}
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
          <Ionicons
            name={icon as any}
            size={24}
            color={color}
            style={styles.notificationIcon}
          />
          <View style={styles.notificationContent}>
            <Text style={[styles.notificationTitle, !notification.read && styles.notificationTitleUnread]}>
              {notification.title}
            </Text>
            <Text style={styles.notificationBody} numberOfLines={2}>
              {notification.body}
            </Text>
            <View style={styles.notificationMeta}>
              <Text style={styles.notificationTime}>{timeAgo}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderDateGroup = (group: DateGroup) => {
    return (
      <View key={group.label}>
        <Text style={styles.dateHeader}>{group.label}</Text>
        <View style={styles.groupContainer}>
          {group.notifications.map((notification, index) =>
            renderNotification(notification, index === group.notifications.length - 1)
          )}
        </View>
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
      {/* Today group skeleton */}
      <Text style={styles.dateHeader}>اليوم</Text>
      <View style={styles.skeletonGroup}>
        {[1, 2, 3].map((i) => (
          <View key={`today-${i}`} style={[styles.skeletonItem, i === 3 && styles.skeletonItemLast]}>
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonContent}>
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonBody} />
              <View style={styles.skeletonTime} />
            </View>
          </View>
        ))}
      </View>

      {/* Earlier group skeleton */}
      <Text style={styles.dateHeader}>أقدم</Text>
      <View style={styles.skeletonGroup}>
        {[1, 2].map((i) => (
          <View key={`earlier-${i}`} style={[styles.skeletonItem, i === 2 && styles.skeletonItemLast]}>
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonContent}>
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonBody} />
              <View style={styles.skeletonTime} />
            </View>
          </View>
        ))}
      </View>
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
            {/* Header - iOS Navigation Bar Style */}
            <View style={styles.header}>
              {/* Large Title with Badge */}
              <View style={styles.headerLeft}>
                <Image
                  source={require('../../assets/logo/AlqefariEmblem.png')}
                  style={styles.emblem}
                  resizeMode="contain"
                  accessibilityLabel="شعار عائلة القفاري"
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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

              {/* iOS Toolbar - Text Buttons */}
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
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={styles.headerActionText}>
                      {unreadCount > 0 ? "قراءة الكل" : "مسح الكل"}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  accessibilityLabel="إغلاق"
                  accessibilityRole="button"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.closeButtonText}>تم</Text>
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
  // iOS-style navigation bar
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: NAJDI_COLORS.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${NAJDI_COLORS.text}20`,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  emblem: {
    width: 32,
    height: 32,
    tintColor: NAJDI_COLORS.text,
    marginRight: 8,
  },
  // iOS Large Title style
  headerTitle: {
    fontSize: TYPOGRAPHY.largeTitle,
    fontWeight: "700",
    color: NAJDI_COLORS.text,
    fontFamily: "SF Arabic",
    marginBottom: 8,
  },
  headerBadge: {
    backgroundColor: NAJDI_COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  headerBadgeText: {
    color: NAJDI_COLORS.white,
    fontSize: TYPOGRAPHY.caption2,
    fontWeight: "700",
    fontFamily: "SF Arabic",
  },
  // iOS toolbar style
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    minHeight: 44,
    justifyContent: "center",
  },
  headerActionText: {
    fontSize: TYPOGRAPHY.body,
    color: NAJDI_COLORS.primary,
    fontFamily: "SF Arabic",
    fontWeight: "400",
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    minHeight: 44,
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: TYPOGRAPHY.body,
    color: NAJDI_COLORS.primary,
    fontFamily: "SF Arabic",
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 32,
  },
  notificationsList: {
    // Groups of notifications - no padding needed, groups handle it
  },
  // iOS-style section header (sticky)
  dateHeader: {
    fontSize: TYPOGRAPHY.footnote,
    fontWeight: "600",
    color: NAJDI_COLORS.muted,
    fontFamily: "SF Arabic",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 32,
    backgroundColor: NAJDI_COLORS.background,
  },
  // iOS Inset Grouped List Container
  groupContainer: {
    backgroundColor: NAJDI_COLORS.white,
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  // Individual notification list item (iOS style - no card)
  notificationItem: {
    backgroundColor: NAJDI_COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 72,
  },
  notificationItemWithBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${NAJDI_COLORS.text}10`,
  },
  // iOS blue dot for unread
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: NAJDI_COLORS.primary,
    marginRight: 12,
    marginTop: 8,
  },
  notificationIcon: {
    marginRight: 12,
    marginTop: 4,
  },
  notificationContent: {
    flex: 1,
  },
  // iOS two-line list item text hierarchy
  notificationTitle: {
    fontSize: TYPOGRAPHY.body,
    fontWeight: "400",
    color: NAJDI_COLORS.text,
    fontFamily: "SF Arabic",
    marginBottom: 2,
  },
  notificationTitleUnread: {
    fontWeight: "600",
  },
  notificationBody: {
    fontSize: TYPOGRAPHY.subheadline,
    color: NAJDI_COLORS.muted,
    fontFamily: "SF Arabic",
    lineHeight: 20,
    marginBottom: 4,
  },
  // iOS-style right-aligned timestamp
  notificationMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notificationTime: {
    fontSize: TYPOGRAPHY.footnote,
    color: NAJDI_COLORS.muted,
    fontFamily: "SF Arabic",
  },
  // iOS swipe actions
  swipeActionsContainer: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  deleteAction: {
    backgroundColor: NAJDI_COLORS.error,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
  },
  markReadAction: {
    backgroundColor: NAJDI_COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
  },
  swipeActionIcon: {
    // Icon styling handled inline
  },
  // iOS-style empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 120,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${NAJDI_COLORS.container}20`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyEmblem: {
    width: 64,
    height: 64,
    tintColor: NAJDI_COLORS.container,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.title2,
    fontWeight: "600",
    color: NAJDI_COLORS.text,
    fontFamily: "SF Arabic",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: TYPOGRAPHY.body,
    color: NAJDI_COLORS.muted,
    fontFamily: "SF Arabic",
    textAlign: "center",
    lineHeight: 24,
  },
  // Subtle inline banner (iOS style)
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${NAJDI_COLORS.secondary}10`,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  errorBannerText: {
    fontSize: TYPOGRAPHY.footnote,
    color: NAJDI_COLORS.muted,
    fontFamily: "SF Arabic",
    marginLeft: 8,
    flex: 1,
  },
  // iOS-style skeleton (shimmer effect would be ideal)
  skeletonContainer: {
    paddingTop: 20,
  },
  skeletonGroup: {
    backgroundColor: NAJDI_COLORS.white,
    marginHorizontal: 16,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 16,
  },
  skeletonItem: {
    backgroundColor: NAJDI_COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${NAJDI_COLORS.text}10`,
  },
  skeletonItemLast: {
    borderBottomWidth: 0,
  },
  skeletonIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: NAJDI_COLORS.container,
    opacity: 0.2,
    marginRight: 12,
    marginTop: 2,
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonTitle: {
    height: 17,
    backgroundColor: NAJDI_COLORS.container,
    opacity: 0.2,
    borderRadius: 4,
    marginBottom: 8,
    width: '65%',
  },
  skeletonBody: {
    height: 15,
    backgroundColor: NAJDI_COLORS.container,
    opacity: 0.2,
    borderRadius: 4,
    marginBottom: 6,
    width: '90%',
  },
  skeletonTime: {
    height: 13,
    backgroundColor: NAJDI_COLORS.container,
    opacity: 0.2,
    borderRadius: 4,
    width: '25%',
  },
});
