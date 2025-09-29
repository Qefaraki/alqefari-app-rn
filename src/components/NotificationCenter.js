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
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow, isToday, isYesterday, format, startOfDay } from "date-fns";
import { ar } from "date-fns/locale";
import * as Haptics from "expo-haptics";
import { supabase } from "../services/supabase";
import { useAuth } from "../contexts/AuthContextSimple";
import AsyncStorage from "@react-native-async-storage/async-storage";
import subscriptionManager from "../services/subscriptionManager";
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Najdi Sadu Color System
const colors = {
  background: "#F9F7F3",    // Al-Jass White
  container: "#D1BBA3",      // Camel Hair Beige
  text: "#242121",          // Sadu Night
  primary: "#A13333",       // Najdi Crimson
  secondary: "#D58C4A",     // Desert Ochre
  muted: "#24212199",       // Sadu Night 60%
  white: "#FFFFFF",
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
  new_profile_link_request: NotificationTypes.NEW_LINK_REQUEST, // Map backend type to our type
  profile_link_request: NotificationTypes.NEW_LINK_REQUEST, // Alternative mapping
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

// Group notifications by date
const groupNotificationsByDate = (notifications) => {
  const groups = {};

  notifications.forEach(notification => {
    const date = new Date(notification.createdAt);
    let dateKey;
    let dateLabel;

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

  return sortedGroups.map(([key, value]) => value);
};

export default function NotificationCenter({ visible, onClose, onNavigateToAdmin }) {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionError, setSubscriptionError] = useState(false);
  const subscriptionRef = useRef(null);
  const subscriptionTimeoutRef = useRef(null);
  const swipeableRefs = useRef({});

  // Animation value for fade in/out
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

      // Animate in with fade
      console.log('🔍 [NotificationCenter] Starting animations...');
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
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

  const deleteNotification = async (notificationId) => {
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

  const renderNotification = (notification) => {
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
        >
          <Ionicons name="trash-outline" size={24} color={colors.white} />
        </TouchableOpacity>
      );
    };

    const handleNotificationPress = () => {
      console.log('[NotificationCenter] Press - Type:', notification.type, 'isAdmin:', isAdmin);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (!notification.read) {
        markAsRead(notification.id);
      }

      // Handle notification tap based on type
      console.log('[NotificationCenter] Checking conditions:');
      console.log('  - notification.type:', notification.type);
      console.log('  - NotificationTypes.NEW_LINK_REQUEST:', NotificationTypes.NEW_LINK_REQUEST);
      console.log('  - Type matches:', notification.type === NotificationTypes.NEW_LINK_REQUEST);
      console.log('  - isAdmin:', isAdmin);
      console.log('  - Both conditions:', notification.type === NotificationTypes.NEW_LINK_REQUEST && isAdmin);

      if (notification.type === NotificationTypes.NEW_LINK_REQUEST && isAdmin) {
        console.log('[NotificationCenter] ✓ Conditions met - Navigating to admin dashboard with link requests');

        // Use the callback if provided (when opened from Settings)
        if (onNavigateToAdmin) {
          console.log('[NotificationCenter] Using onNavigateToAdmin callback');
          onNavigateToAdmin(true); // Pass true to open link requests
        } else {
          // Fallback to direct navigation
          console.log('[NotificationCenter] Using direct navigation');
          onClose();

          setTimeout(() => {
            console.log('[NotificationCenter] Executing navigation to admin');
            try {
              router.push({
                pathname: '/(app)/admin',
                params: {
                  openLinkRequests: 'true'
                }
              });
              console.log('[NotificationCenter] Navigation command sent');
            } catch (error) {
              console.error('[NotificationCenter] Navigation error:', error);
            }
          }, 100);
        }
      } else if (notification.type === NotificationTypes.LINK_REQUEST_PENDING) {
        // For users who submitted a request, show their status
        onClose();
        router.push('/profile-linking');
      } else if (notification.type === NotificationTypes.LINK_REQUEST_APPROVED) {
        // For approved requests, go to home/profile
        onClose();
        router.push('/');
      } else if (notification.type === NotificationTypes.LINK_REQUEST_REJECTED) {
        // For rejected requests, show contact admin screen
        onClose();
        router.push('/contact-admin');
      } else if (notification.type === NotificationTypes.ADMIN_MESSAGE) {
        // Navigate to messages or home page
        onClose();
        router.push('/');
      }
    };

    // Re-enable swipeable with proper touch handling
    return (
      <Swipeable
        ref={(ref) => (swipeableRefs.current[notification.id] = ref)}
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
        >
          {!notification.read && <View style={styles.unreadDot} />}
          <View style={styles.notificationContent}>
            <Text style={styles.notificationTitle}>{notification.title}</Text>
            <Text style={styles.notificationBody} numberOfLines={2}>{notification.body}</Text>
            <Text style={styles.notificationTime}>{timeAgo}</Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderDateGroup = (group) => {
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
        <Ionicons name="notifications-off" size={48} color={colors.muted} />
      </View>
      <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
      <Text style={styles.emptySubtitle}>ستظهر الإشعارات الجديدة هنا</Text>
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
          {
            opacity: fadeAnim,
          },
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
                />
                <Text style={styles.headerTitle}>الإشعارات</Text>
                {unreadCount > 0 && (
                  <View style={styles.headerBadge}>
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
                  >
                    <Ionicons
                      name={unreadCount > 0 ? "checkmark-done" : "trash-outline"}
                      size={22}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                >
                  <Ionicons name="close" size={28} color={colors.text} />
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
                  tintColor={colors.primary}
                />
              }
            >
              {loading && notifications.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>جاري التحميل...</Text>
                </View>
              ) : notifications.length > 0 ? (
                <View style={styles.notificationsList}>
                  {subscriptionError && (
                    <View style={styles.errorBanner}>
                      <Ionicons name="warning-outline" size={16} color={colors.warning} />
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
    backgroundColor: colors.background,
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
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  emblem: {
    width: 44,
    height: 44,
    tintColor: colors.text,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: colors.text,
    fontFamily: "SF Arabic",
  },
  headerBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
    marginLeft: 12,
  },
  headerBadgeText: {
    color: colors.white,
    fontSize: 12,
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
  },
  closeButton: {
    padding: 8,
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
    fontSize: 15,
    fontWeight: "600",
    color: colors.muted,
    fontFamily: "SF Arabic",
    marginTop: 20,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  notificationItem: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 12,
    marginTop: 6,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: "SF Arabic",
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: "SF Arabic",
  },
  deleteAction: {
    backgroundColor: colors.error,
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
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${colors.container}20`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    fontFamily: "SF Arabic",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.muted,
    fontFamily: "SF Arabic",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  loadingText: {
    fontSize: 15,
    color: colors.muted,
    fontFamily: "SF Arabic",
    marginTop: 12,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${colors.warning}15`,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 10,
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