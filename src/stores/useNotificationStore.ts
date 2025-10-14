/**
 * Notification Store
 *
 * Zustand store for managing notification state across the app
 * Handles:
 * - Notification list
 * - Unread count
 * - Real-time subscriptions
 * - Mark as read/unread
 * - Broadcast notifications
 */

import { create } from 'zustand';
import { supabase } from '../services/supabase';
import type { ExtendedNotification, Notification } from '../types/notifications';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface NotificationStore {
  // State
  notifications: ExtendedNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  lastFetch: number | null;
  subscription: RealtimeChannel | null;

  // Actions
  loadNotifications: (force?: boolean) => Promise<void>;
  markAsRead: (notificationId: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  deleteNotification: (notificationId: string) => Promise<boolean>;
  refreshUnreadCount: () => Promise<void>;
  subscribeToNotifications: (userId: string) => void;
  unsubscribeFromNotifications: () => void;
  reset: () => void;
}

const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  // Initial state
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  lastFetch: null,
  subscription: null,

  // Load notifications from database
  loadNotifications: async (force = false) => {
    const state = get();

    // Check cache unless force reload
    if (!force && state.lastFetch && Date.now() - state.lastFetch < CACHE_TTL) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Fetch notifications using the view with related data
      const { data, error } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const notifications = (data || []) as ExtendedNotification[];

      // Calculate unread count
      const unreadCount = notifications.filter((n) => !n.is_read).length;

      set({
        notifications,
        unreadCount,
        isLoading: false,
        lastFetch: Date.now(),
      });
    } catch (error: any) {
      console.error('Error loading notifications:', error);
      set({
        error: error.message || 'Failed to load notifications',
        isLoading: false,
      });
    }
  },

  // Mark single notification as read
  markAsRead: async (notificationId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return false;

      const { data, error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data) {
        // Optimistic update
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      }

      return !!data;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  },

  // Mark all notifications as read
  markAllAsRead: async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return false;

      const { data, error } = await supabase.rpc('mark_all_notifications_read', {
        p_user_id: user.id,
      });

      if (error) throw error;

      // Optimistic update
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          is_read: true,
          read_at: new Date().toISOString(),
        })),
        unreadCount: 0,
      }));

      return true;
    } catch (error) {
      console.error('Error marking all as read:', error);
      return false;
    }
  },

  // Delete notification (soft delete on UI, expires on backend)
  deleteNotification: async (notificationId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return false;

      // Optimistic update first
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== notificationId),
        unreadCount: state.notifications.find((n) => n.id === notificationId)?.is_read
          ? state.unreadCount
          : Math.max(0, state.unreadCount - 1),
      }));

      // Delete from database (or mark as expired)
      const { error } = await supabase
        .from('notifications')
        .update({ expires_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      // Reload on error to restore state
      get().loadNotifications(true);
      return false;
    }
  },

  // Refresh unread count only (lightweight)
  refreshUnreadCount: async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase.rpc('get_unread_notification_count', {
        p_user_id: user.id,
      });

      if (error) throw error;

      set({ unreadCount: data || 0 });
    } catch (error) {
      console.error('Error refreshing unread count:', error);
    }
  },

  // Subscribe to real-time notification updates
  subscribeToNotifications: (userId: string) => {
    const state = get();

    // Clean up existing subscription
    if (state.subscription) {
      state.subscription.unsubscribe();
    }

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;

          set((state) => ({
            notifications: [newNotification as ExtendedNotification, ...state.notifications],
            unreadCount: state.unreadCount + 1,
          }));

          // Trigger badge update
          // You can add notification service call here if needed
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updatedNotification = payload.new as Notification;

          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === updatedNotification.id
                ? ({ ...n, ...updatedNotification } as ExtendedNotification)
                : n
            ),
          }));

          // Recalculate unread count
          get().refreshUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const deletedId = payload.old.id;

          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== deletedId),
          }));

          get().refreshUnreadCount();
        }
      )
      .subscribe();

    set({ subscription: channel });
  },

  // Unsubscribe from real-time updates
  unsubscribeFromNotifications: () => {
    const state = get();

    if (state.subscription) {
      state.subscription.unsubscribe();
      set({ subscription: null });
    }
  },

  // Reset store (on logout)
  reset: () => {
    const state = get();

    // Clean up subscription
    if (state.subscription) {
      state.subscription.unsubscribe();
    }

    set({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      lastFetch: null,
      subscription: null,
    });
  },
}));

// Helper hook for unread count only (optimized for header badge)
export function useUnreadCount() {
  return useNotificationStore((state) => state.unreadCount);
}

// Helper hook for loading state
export function useNotificationsLoading() {
  return useNotificationStore((state) => state.isLoading);
}
