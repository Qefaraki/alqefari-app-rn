/**
 * Photo Approval System Configuration
 * Centralized constants for PhotoApprovalManager
 * Extracted per audit recommendation (solution-auditor A- grade)
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Photo Display Configuration
 */
export const PHOTO_CONFIG = {
  // Photo size for side-by-side comparison
  // Formula: (SCREEN_WIDTH - padding) / 2 photos
  size: (SCREEN_WIDTH - 80) / 2,

  // Container padding between photos
  containerPadding: 80,

  // Minimum photo size (fallback for small screens)
  minSize: 100,
};

/**
 * Network Configuration
 */
export const NETWORK_CONFIG = {
  // Timeout for all photo approval network requests (ms)
  requestTimeout: 3000,

  // Description: 3-second timeout matches useProfilePermissions
  // and prevents hanging on slow/flaky networks
};

/**
 * Rejection Reason Configuration
 */
export const REJECTION_REASON_CONFIG = {
  // Maximum character length for custom rejection reason
  maxLength: 5000,

  // Multiline input configuration
  multiline: true,
  numberOfLines: 3,

  // Placeholder text
  placeholder: 'مثال: الصورة غير واضحة، يرجى رفع صورة بجودة أعلى',
  placeholderTextColor: '#A3A3A3',
};

/**
 * Modal Configuration
 */
export const MODAL_CONFIG = {
  // Animation type for all modals
  animationType: 'slide',

  // Presentation style (iOS)
  presentationStyle: 'pageSheet',

  // Enable backdrop dismiss
  backdropDismiss: true,
};

/**
 * Refresh Configuration
 */
export const REFRESH_CONFIG = {
  // Colors for pull-to-refresh indicator
  colors: ['#A13333'], // Najdi Crimson
  tintColor: '#A13333',

  // Auto-refresh interval (disabled by default)
  autoRefreshInterval: null,
};

/**
 * Empty State Configuration
 */
export const EMPTY_STATE_CONFIG = {
  icon: 'images-outline',
  iconSize: 64,
  title: 'لا توجد طلبات قيد المراجعة',
  subtitle: 'جميع طلبات تغيير الصور تمت مراجعتها',
};

/**
 * Error State Configuration
 */
export const ERROR_CONFIG = {
  // Network timeout error
  networkTimeout: {
    title: 'انتهت المهلة',
    message: 'فشل تحميل البيانات. تحقق من الاتصال بالإنترنت.',
  },

  // Generic load error
  loadError: {
    title: 'خطأ',
    message: 'فشل تحميل طلبات تغيير الصور',
  },

  // Image load error placeholders
  placeholders: {
    old: 'لا توجد صورة',
    new: 'فشل تحميل الصورة',
    oldIcon: 'person-circle-outline',
    newIcon: 'alert-circle-outline',
  },
};

/**
 * Action Button Configuration
 */
export const BUTTON_CONFIG = {
  // Processing state
  disabledOpacity: 0.5,

  // Haptic feedback
  enableHaptics: true,

  // Button labels
  labels: {
    approve: 'موافقة',
    reject: 'رفض',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    useCustomReason: 'استخدام السبب المخصص',
  },
};

/**
 * Validation Rules
 */
export const VALIDATION_RULES = {
  // Minimum custom reason length (optional, can be 0)
  minReasonLength: 0,

  // Maximum rejection reason length (server-side enforced)
  maxReasonLength: REJECTION_REASON_CONFIG.maxLength,

  // Require reason selection (template or custom)
  requireReason: false, // Optional in current implementation
};

/**
 * RPC Function Names
 */
export const RPC_FUNCTIONS = {
  listRequests: 'list_pending_photo_requests',
  listTemplates: 'list_photo_rejection_templates',
  approve: 'approve_photo_change',
  reject: 'reject_photo_change',
};

/**
 * Database Table Names
 */
export const TABLE_NAMES = {
  requests: 'photo_change_requests',
  templates: 'photo_rejection_templates',
};

/**
 * Request Status Values
 */
export const REQUEST_STATUS = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
  expired: 'expired',
  cancelled: 'cancelled',
};

/**
 * Accessibility Configuration
 */
export const ACCESSIBILITY_CONFIG = {
  // Button roles
  buttonRole: 'button',

  // Hints for approve/reject actions
  hints: {
    approve: 'قبول طلب تغيير الصورة',
    reject: 'فتح قائمة أسباب الرفض',
    cancel: 'إلغاء العملية',
    confirmReject: 'رفض الصورة وإرسال إشعار للمستخدم',
    selectTemplate: 'اختر قالب الرفض',
    useCustomReason: 'تأكيد استخدام سبب الرفض المخصص',
  },
};

/**
 * Export all configs as a single object (optional convenience)
 */
export default {
  PHOTO_CONFIG,
  NETWORK_CONFIG,
  REJECTION_REASON_CONFIG,
  MODAL_CONFIG,
  REFRESH_CONFIG,
  EMPTY_STATE_CONFIG,
  ERROR_CONFIG,
  BUTTON_CONFIG,
  VALIDATION_RULES,
  RPC_FUNCTIONS,
  TABLE_NAMES,
  REQUEST_STATUS,
  ACCESSIBILITY_CONFIG,
};
