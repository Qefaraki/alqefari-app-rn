import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

import { supabase } from "./supabase";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.notificationListener = null;
    this.responseListener = null;
  }

  // Initialize notifications
  async initialize() {
    try {
      // Check if physical device
      if (!Device.isDevice) {
        return null;
      }

      // Get existing permission status
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not granted
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Push notification permissions not granted");
        return null;
      }

      // Get push token
      const token = await this.getExpoPushToken();

      // Store token in user profile
      if (token) {
        await this.savePushToken(token);
      }

      // Setup notification listeners
      this.setupListeners();

      return token;
    } catch (error) {
      console.error("Error initializing notifications:", error);
      return null;
    }
  }

  // Get Expo push token
  async getExpoPushToken() {
    try {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        console.log("Project ID not found");
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      return token.data;
    } catch (error) {
      console.error("Error getting push token:", error);
      return null;
    }
  }

  // Save push token to database
  async savePushToken(token) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Upsert token to push_tokens table
      const { error } = await supabase
        .from("push_tokens")
        .upsert({
          user_id: user.id,
          token: token,
          platform: Device.osName?.toLowerCase() || 'unknown',
          is_active: true,
          last_used: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,token'
        });

      if (error) {
        console.error("Error saving push token:", error);
      } else {
        console.log("Push token saved successfully");
      }
    } catch (error) {
      console.error("Error in savePushToken:", error);
    }
  }

  // Setup notification listeners
  setupListeners() {
    // Handle notifications when app is in foreground
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("Notification received:", notification);
        this.handleIncomingNotification(notification);
      },
    );

    // Handle notification taps
    this.responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification tapped:", response);
        this.handleNotificationResponse(response);
      });
  }

  // Handle incoming notification
  handleIncomingNotification(notification) {
    const { data } = notification.request.content;

    // Update local state based on notification type
    if (data?.type === "link_request_approved") {
      // Trigger profile refresh
      this.onApprovalReceived?.(data);
    } else if (data?.type === "link_request_rejected") {
      // Show rejection message
      this.onRejectionReceived?.(data);
    } else if (data?.type === "new_link_request" && data?.isAdmin) {
      // Update admin badge
      this.onNewRequestReceived?.(data);
    }
  }

  // Handle notification tap/response
  handleNotificationResponse(response) {
    const { data } = response.notification.request.content;

    // Navigate based on notification type
    if (data?.type === "link_request_approved") {
      this.navigateToProfile?.(data.profileId);
    } else if (data?.type === "new_link_request" && data?.isAdmin) {
      this.navigateToAdminRequests?.();
    }
  }

  // Send local notification (for testing and in-app events)
  async scheduleLocalNotification(title, body, data = {}, trigger = null) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: "default",
        },
        trigger: trigger || null, // null = immediate
      });
      return id;
    } catch (error) {
      console.error("Error scheduling notification:", error);
      return null;
    }
  }

  // Cancel notification
  async cancelNotification(notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  // Cancel all notifications
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  // Get badge count
  async getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
  }

  // Set badge count
  async setBadgeCount(count) {
    return await Notifications.setBadgeCountAsync(count);
  }

  // Clear badge
  async clearBadge() {
    return await Notifications.setBadgeCountAsync(0);
  }

  // Check if notifications are enabled
  async areNotificationsEnabled() {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  }

  // Request notification permissions
  async requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  }

  // Cleanup listeners
  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  // Set navigation callbacks
  setNavigationCallbacks(callbacks) {
    this.navigateToProfile = callbacks.navigateToProfile;
    this.navigateToAdminRequests = callbacks.navigateToAdminRequests;
  }

  // Set event callbacks
  setEventCallbacks(callbacks) {
    this.onApprovalReceived = callbacks.onApprovalReceived;
    this.onRejectionReceived = callbacks.onRejectionReceived;
    this.onNewRequestReceived = callbacks.onNewRequestReceived;
  }
}

// Create singleton instance
const notificationService = new NotificationService();

// Notification types for consistency
export const NotificationTypes = {
  LINK_REQUEST_APPROVED: "link_request_approved",
  LINK_REQUEST_REJECTED: "link_request_rejected",
  NEW_LINK_REQUEST: "new_link_request",
  PROFILE_UPDATED: "profile_updated",
  NEW_FAMILY_MEMBER: "new_family_member",
  ADMIN_MESSAGE: "admin_message",
};

// Helper function to send push notification via Supabase Edge Function
export async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const { data: result, error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        userId,
        title,
        body,
        data,
        priority: 'high',
        sound: 'default'
      },
    });

    if (error) {
      console.error("Error sending push notification:", error);
      return false;
    }

    console.log('Push notification result:', result);
    return result?.sent > 0;
  } catch (error) {
    console.error("Error in sendPushNotification:", error);
    return false;
  }
}

// Helper to notify admins of new request
export async function notifyAdminsOfNewRequest(requestData) {
  try {
    // Get all admin users
    const { data: admins, error } = await supabase
      .from("profiles")
      .select("user_id")
      .in("role", ["admin", "super_admin"])
      .not("user_id", "is", null);

    if (error) throw error;

    // Send notification to each admin
    const notifications = admins.map((admin) =>
      sendPushNotification(
        admin.user_id,
        "طلب ربط جديد",
        `طلب من ${requestData.name_chain} لربط ملفه الشخصي`,
        {
          type: NotificationTypes.NEW_LINK_REQUEST,
          requestId: requestData.id,
          isAdmin: true,
        },
      ),
    );

    await Promise.all(notifications);
    return true;
  } catch (error) {
    console.error("Error notifying admins:", error);
    return false;
  }
}

// Helper to notify user of approval
export async function notifyUserOfApproval(userId, profileData) {
  return sendPushNotification(
    userId,
    "تمت الموافقة! 🎉",
    "تم ربط ملفك الشخصي بنجاح. يمكنك الآن تعديل معلوماتك.",
    {
      type: NotificationTypes.LINK_REQUEST_APPROVED,
      profileId: profileData.id,
    },
  );
}

// Helper to notify user of rejection
export async function notifyUserOfRejection(userId, reason = "") {
  return sendPushNotification(
    userId,
    "تم رفض الطلب",
    reason ||
      "تم رفض طلب ربط الملف. يرجى التواصل مع المشرف للمزيد من المعلومات.",
    {
      type: NotificationTypes.LINK_REQUEST_REJECTED,
      reason,
    },
  );
}

export default notificationService;
