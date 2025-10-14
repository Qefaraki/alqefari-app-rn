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
  ADMIN_BROADCAST: 'admin_broadcast', // NEW: Broadcast notifications from super admins
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
  admin_broadcast: 'admin_broadcast', // Broadcast notifications
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
  // Broadcast-specific fields
  broadcast_id?: string;
  sent_by_profile_id?: string;
  criteria?: BroadcastCriteria;
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
  // Broadcast-specific fields
  broadcast_id?: string | null;
  recipient_metadata?: Record<string, any>;
  priority?: 'normal' | 'high' | 'urgent';
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
  BROADCAST_EXPIRY_DAYS: 90, // Broadcasts have longer retention
  MAX_BROADCAST_RECIPIENTS: 1000, // Maximum recipients per broadcast
} as const;

// ============================================================================
// BROADCAST NOTIFICATION TYPES
// ============================================================================

/**
 * Broadcast targeting criteria
 */
export interface BroadcastCriteria {
  type: 'all' | 'role' | 'gender' | 'location' | 'custom';
  values?: string[];
}

/**
 * Broadcast recipient preview
 */
export interface BroadcastRecipient {
  user_id: string;
  profile_id: string;
  name: string;
  phone: string | null;
  hid: string | null;
}

/**
 * Broadcast message (metadata)
 */
export interface BroadcastMessage {
  id: string;
  title: string;
  body: string;
  sent_by: string;
  sent_at: string;
  target_criteria: BroadcastCriteria;
  total_recipients: number;
  delivered_count: number;
  read_count: number;
  priority: 'normal' | 'high' | 'urgent';
  expires_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Broadcast statistics
 */
export interface BroadcastStatistics {
  broadcast_id: string;
  total_recipients: number;
  delivered_count: number;
  read_count: number;
  read_percentage: number;
  unread_count: number;
  sent_at: string;
  title: string;
  body: string;
}

/**
 * Broadcast history item (with sender info)
 */
export interface BroadcastHistoryItem {
  id: string;
  title: string;
  body: string;
  sender_name: string;
  sender_id: string;
  sent_at: string;
  total_recipients: number;
  delivered_count: number;
  read_count: number;
  read_percentage: number;
  target_criteria: BroadcastCriteria;
  priority: 'normal' | 'high' | 'urgent';
}

/**
 * Create broadcast parameters
 */
export interface CreateBroadcastParams {
  title: string;
  body: string;
  criteria: BroadcastCriteria;
  priority?: 'normal' | 'high' | 'urgent';
  expiresAt?: string;
}

/**
 * Create broadcast response
 */
export interface CreateBroadcastResponse {
  success: boolean;
  broadcast_id: string;
  total_recipients: number;
  delivered_count: number;
  sent_at: string;
  message: string;
}
