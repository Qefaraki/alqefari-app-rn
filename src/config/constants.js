// App configuration constants
// These should ideally come from environment variables

export const APP_CONFIG = {
  // Admin contact information
  ADMIN_WHATSAPP: process.env.EXPO_PUBLIC_ADMIN_WHATSAPP || "+966500000000", // Default placeholder

  // Rate limiting
  RATE_LIMIT: {
    PROFILE_REQUEST: {
      MAX_ATTEMPTS: 3,
      WINDOW_MS: 3600000, // 1 hour
    },
    LOGIN_ATTEMPT: {
      MAX_ATTEMPTS: 5,
      WINDOW_MS: 900000, // 15 minutes
    },
  },

  // Request limits
  MAX_ADDITIONAL_INFO_LENGTH: 500,
  MAX_NAME_CHAIN_LENGTH: 200,

  // Response times
  REQUEST_TIMEOUT: 30000, // 30 seconds

  // Feature flags
  ENABLE_WHATSAPP: true,
  ENABLE_PUSH_NOTIFICATIONS: true,

  // Admin settings
  DEFAULT_REVIEW_TIME_HOURS: 48,
};

// Validation patterns
export const VALIDATION_PATTERNS = {
  SAUDI_PHONE: /^(05\d{8}|(\+966|966)5\d{8})$/,
  ARABIC_TEXT: /[\u0600-\u06FF]/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: "خطأ في الاتصال. يرجى التحقق من الإنترنت والمحاولة مرة أخرى.",
  VALIDATION_ERROR: "يرجى التحقق من البيانات المدخلة.",
  RATE_LIMIT: "لقد تجاوزت الحد المسموح. يرجى المحاولة لاحقاً.",
  PHONE_INVALID: "يرجى إدخال رقم هاتف سعودي صحيح (05XXXXXXXX)",
  NAME_CHAIN_INVALID: "يرجى إدخال الاسم الكامل باللغة العربية",
  DUPLICATE_REQUEST: "لديك طلب قيد المراجعة بالفعل. يرجى الانتظار.",
  GENERIC_ERROR: "حدث خطأ. يرجى المحاولة مرة أخرى.",
};
