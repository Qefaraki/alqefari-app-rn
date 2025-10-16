/**
 * Push Notification Service
 *
 * Handles Expo push token registration and notification permissions
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications are handled when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Register push notification token for the current user
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<{success: boolean, token?: string, error?: string}>}
 */
export async function registerPushToken(userId) {
  try {
    // Only register on physical devices (not simulators/emulators)
    if (!Device.isDevice) {
      console.log('[PushNotifications] Skipping - running on simulator/emulator');
      return {
        success: true,
        message: 'Simulator/emulator - push notifications not available'
      };
    }

    // Request notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Ask for permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // User denied permission
    if (finalStatus !== 'granted') {
      console.log('[PushNotifications] Permission denied by user');
      return {
        success: false,
        error: 'Permission denied for push notifications'
      };
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'a7c36d9e-d0c4-4cd3-a695-74e26ebdddf8', // Your Expo project ID
    });

    const token = tokenData.data;

    if (!token) {
      console.error('[PushNotifications] Failed to get push token');
      return {
        success: false,
        error: 'Failed to get Expo push token'
      };
    }

    console.log('[PushNotifications] Got Expo push token:', token);

    // Register token in database
    const { error: dbError } = await supabase
      .from('push_tokens')
      .upsert({
        user_id: userId,
        token: token,
        platform: Platform.OS,
        is_active: true,
        last_used: new Date().toISOString()
      }, {
        onConflict: 'user_id,token',
        ignoreDuplicates: false
      });

    if (dbError) {
      console.error('[PushNotifications] Database error:', dbError);
      return {
        success: false,
        error: `Failed to save token: ${dbError.message}`
      };
    }

    console.log('[PushNotifications] Successfully registered token for user:', userId);

    return {
      success: true,
      token: token
    };

  } catch (error) {
    console.error('[PushNotifications] Error registering push token:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Unregister push notification token for the current user
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function unregisterPushToken(userId) {
  try {
    // Get current token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'a7c36d9e-d0c4-4cd3-a695-74e26ebdddf8',
    });

    const token = tokenData.data;

    if (!token) {
      return { success: true, message: 'No token to unregister' };
    }

    // Mark token as inactive in database
    const { error } = await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('token', token);

    if (error) {
      console.error('[PushNotifications] Error unregistering token:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log('[PushNotifications] Successfully unregistered token for user:', userId);

    return { success: true };

  } catch (error) {
    console.error('[PushNotifications] Error unregistering push token:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Set up notification response listener (when user taps a notification)
 * @param {Function} handler - Callback function to handle notification tap
 * @returns {Subscription} Notification subscription
 */
export function addNotificationResponseListener(handler) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

/**
 * Set up notification received listener (when notification arrives while app is foregrounded)
 * @param {Function} handler - Callback function to handle notification received
 * @returns {Subscription} Notification subscription
 */
export function addNotificationReceivedListener(handler) {
  return Notifications.addNotificationReceivedListener(handler);
}

export default {
  registerPushToken,
  unregisterPushToken,
  addNotificationResponseListener,
  addNotificationReceivedListener
};
