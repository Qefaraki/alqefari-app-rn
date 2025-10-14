/**
 * Notification System Types
 *
 * TypeScript interfaces for the notification system
 */

export const NOTIFICATION_TYPES = {
  LINK_REQUEST_APPROVED: 'link_request_approved',
  LINK_REQUEST_REJECTED: 'link_request_rejected',
  NEW_LINK_REQUEST: 'new_profile_link_request',
  LINK_REQUEST_PENDING: 'link_request_pending',
  PROFILE_UPDATED: 'profile_updated',
  NEW_FAMILY_MEMBER: 'new_family_member',
  ADMIN_MESSAGE: 'admin_message',
  SYSTEM_MESSAGE: 'system_message',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

/**
 * Legacy/alias mapping for notification type values coming from the backend
 * Maps old database trigger notification types to standardized frontend types
 */
export const NOTIFICATION_TYPE_ALIASES: Record<string, NotificationType> = {
  profile_link_approved: 'link_request_approved',
  profile_link_rejected: 'link_request_rejected',
  link_approved: 'link_request_approved',
  link_rejected: 'link_request_rejected',
  new_profile_link_request: 'new_profile_link_request',
  profile_link_request: 'new_profile_link_request',
  // Direct mappings for types that match
  link_request_approved: 'link_request_approved',
  link_request_rejected: 'link_request_rejected',
  link_request_pending: 'link_request_pending',
  profile_updated: 'profile_updated',
  new_family_member: 'new_family_member',
  admin_message: 'admin_message',
  system_message: 'system_message',
};

/**
 * Notification data payload structure
 */
export interface NotificationData {
  request_id?: string;
  profile_id?: string;
  requester_phone?: string;
  is_admin_notification?: boolean;
  approved_at?: string;
  rejected_at?: string;
  reason?: string;
  [key: string]: any; // Allow additional fields
}

/**
 * Core notification interface matching database schema
 */
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationData;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
  related_profile_id: string | null;
  related_request_id: string | null;
  push_sent: boolean;
  push_sent_at: string | null;
  push_error: string | null;
}

/**
 * Extended notification with related data from view
 */
export interface ExtendedNotification extends Notification {
  related_profile_name?: string;
  related_profile_photo?: string;
  request_name_chain?: string;
  request_phone?: string;
}

/**
 * Notification display properties (icon, color, etc.)
 */
export interface NotificationStyle {
  icon: string;
  color: string;
  bgColor: string;
}

/**
 * Push token interface
 */
export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  is_active: boolean;
  last_used: string;
  created_at: string;
  updated_at: string;
}

/**
 * Notification creation parameters
 */
export interface CreateNotificationParams {
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
  related_profile_id?: string | null;
  related_request_id?: string | null;
}

/**
 * Type guard to check if a string is a valid notification type
 */
export function isValidNotificationType(type: string): type is NotificationType {
  return Object.values(NOTIFICATION_TYPES).includes(type as NotificationType);
}

/**
 * Notification list response (for pagination)
 */
export interface NotificationListResponse {
  notifications: ExtendedNotification[];
  hasMore: boolean;
  oldestCreatedAt: string | null;
}

/**
 * Notification count response
 */
export interface NotificationCountResponse {
  count: number;
}

/**
 * Notification configuration constants
 */
export const NOTIFICATION_CONFIG = {
  MAX_FETCH: 50,
  PAGE_SIZE: 20,
  CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
  DEDUP_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
  EXPIRY_DAYS: 30,
  CLEANUP_READ_DAYS: 7,
} as const;
