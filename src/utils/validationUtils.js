// Validation utilities for the app

/**
 * Validates Saudi phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid Saudi number
 */
export const validateSaudiPhone = (phone) => {
  // Remove spaces and Arabic/English digits normalization
  const normalizedPhone = phone
    .replace(/\s/g, "")
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

  // Saudi phone patterns: 05XXXXXXXX or +9665XXXXXXXX or 9665XXXXXXXX
  const saudiPhoneRegex = /^(05\d{8}|(\+966|966)5\d{8})$/;
  return saudiPhoneRegex.test(normalizedPhone);
};

/**
 * Sanitizes text input to prevent XSS
 * @param {string} text - Text to sanitize
 * @returns {string} - Sanitized text
 */
export const sanitizeInput = (text) => {
  if (!text) return "";

  return text
    .replace(/[<>]/g, "") // Remove HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .trim()
    .substring(0, 500); // Limit length
};

/**
 * Formats phone number for display
 * @param {string} phone - Phone number to format
 * @returns {string} - Formatted phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return "";

  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("966")) {
    // +966 5X XXX XXXX
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 12)}`;
  } else if (cleaned.startsWith("05")) {
    // 05XX XXX XXXX
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 11)}`;
  }

  return phone;
};

/**
 * Validates name chain format
 * @param {string} nameChain - Name chain to validate
 * @returns {boolean} - True if valid
 */
export const validateNameChain = (nameChain) => {
  if (!nameChain || nameChain.trim().length < 3) return false;

  // Check for Arabic characters
  const arabicRegex = /[\u0600-\u06FF]/;
  if (!arabicRegex.test(nameChain)) return false;

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /(.)\1{5,}/, // Same character repeated 6+ times
    /\d{10,}/, // Phone numbers
    /https?:\/\//i, // URLs
  ];

  return !suspiciousPatterns.some((pattern) => pattern.test(nameChain));
};

/**
 * Rate limiting check for requests
 * @param {string} userId - User ID
 * @param {string} action - Action being performed
 * @returns {boolean} - True if allowed, false if rate limited
 */
const rateLimitMap = new Map();
export const checkRateLimit = (
  userId,
  action,
  maxAttempts = 3,
  windowMs = 60000,
) => {
  const key = `${userId}:${action}`;
  const now = Date.now();

  const attempts = rateLimitMap.get(key) || [];
  const recentAttempts = attempts.filter((time) => now - time < windowMs);

  if (recentAttempts.length >= maxAttempts) {
    return false;
  }

  recentAttempts.push(now);
  rateLimitMap.set(key, recentAttempts);
  return true;
};
