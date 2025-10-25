/**
 * Phone Utilities - WhatsApp Integration
 * Formats phone numbers for wa.me/ deep linking
 */

/**
 * Formats phone number for WhatsApp deep linking (wa.me/{phone})
 *
 * Handles multiple formats:
 * - +966 50 123 4567 (Saudi with spaces)
 * - +966501234567 (Saudi no spaces)
 * - 0501234567 (Saudi local format)
 * - 966501234567 (Saudi without +)
 *
 * Returns: +966501234567 (wa.me/ compatible format)
 *
 * @param {string} phone - Raw phone number from database
 * @returns {string} Formatted phone number for wa.me/ links, or original if invalid
 */
export const formatPhoneForWhatsApp = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Remove all whitespace and non-numeric characters except +
  let cleaned = phone.replace(/\s/g, '').replace(/[\(\)]/g, '');

  // If starts with 0 (Saudi local format), convert to +966
  // 0501234567 → 966501234567 → +966501234567
  if (cleaned.startsWith('0')) {
    cleaned = '966' + cleaned.substring(1);
  }

  // If doesn't start with +, add it
  // 966501234567 → +966501234567
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  // Validate: must be +966 (Saudi) or other valid format
  // wa.me/ works with any E.164 format, but we primarily support Saudi (+966)
  if (!/^\+\d{10,15}$/.test(cleaned)) {
    if (__DEV__) {
      console.warn(`[phoneUtils] Invalid phone format after cleanup: ${phone} → ${cleaned}`);
    }
    return '';
  }

  return cleaned;
};

/**
 * Builds WhatsApp deep link URL
 *
 * @param {string} phone - Raw phone number
 * @returns {string} Full wa.me/ URL, or empty string if phone is invalid
 */
export const buildWhatsAppUrl = (phone) => {
  const formatted = formatPhoneForWhatsApp(phone);
  if (!formatted) return '';
  return `https://wa.me/${formatted.substring(1)}`; // Remove + for wa.me/ URL
};

/**
 * Validates if phone number is suitable for WhatsApp
 *
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if phone can be used for WhatsApp
 */
export const isValidWhatsAppPhone = (phone) => {
  return Boolean(formatPhoneForWhatsApp(phone));
};

/**
 * Formats phone for display purposes (adds spaces for readability)
 * Used for showing phone numbers in UI (not for linking)
 *
 * Example: +966501234567 → +966 50 123 4567
 *
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone for display
 */
export const formatPhoneForDisplay = (phone) => {
  const formatted = formatPhoneForWhatsApp(phone);
  if (!formatted) return phone || '';

  // Saudi format: +966 XX XXX XXXX
  if (formatted.startsWith('+966') && formatted.length === 13) {
    // +966 50 123 4567
    return `${formatted.substring(0, 4)} ${formatted.substring(4, 6)} ${formatted.substring(6, 9)} ${formatted.substring(9)}`;
  }

  return formatted;
};

export default {
  formatPhoneForWhatsApp,
  buildWhatsAppUrl,
  isValidWhatsAppPhone,
  formatPhoneForDisplay,
};
