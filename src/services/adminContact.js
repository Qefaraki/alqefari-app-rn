/**
 * Admin Contact Service
 *
 * Manages the admin WhatsApp contact number that can be configured
 * by admins and used throughout the app for support/contact features.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

const ADMIN_WHATSAPP_KEY = 'admin_whatsapp_number';
const DEFAULT_ADMIN_NUMBER = '+966539266345'; // Default fallback number
const ONBOARDING_HELP_MESSAGE_KEY = 'admin_onboarding_help_message';
const DEFAULT_ONBOARDING_MESSAGE = 'مرحباً، أحتاج مساعدة في استخدام تطبيق شجرة عائلة القفاري';
const ARTICLE_SUGGESTION_MESSAGE_KEY = 'admin_article_suggestion_message';
const DEFAULT_ARTICLE_SUGGESTION = 'أود اقتراح مقال للنشر';

class AdminContactService {
  constructor() {
    this.cachedNumber = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Get the configured admin WhatsApp number
   * Returns the stored number or default if not configured
   */
  async getAdminWhatsAppNumber() {
    // Check cache first
    const now = Date.now();
    if (this.cachedNumber && this.cacheTimestamp && (now - this.cacheTimestamp < this.CACHE_DURATION)) {
      return this.cachedNumber;
    }

    try {
      const storedNumber = await AsyncStorage.getItem(ADMIN_WHATSAPP_KEY);
      const number = storedNumber || DEFAULT_ADMIN_NUMBER;

      // Update cache
      this.cachedNumber = number;
      this.cacheTimestamp = now;

      return number;
    } catch (error) {
      console.error('Error getting admin WhatsApp number:', error);
      return DEFAULT_ADMIN_NUMBER;
    }
  }

  /**
   * Set the admin WhatsApp number (admin only)
   * @param {string} number - WhatsApp number in international format (e.g., +966501234567)
   */
  async setAdminWhatsAppNumber(number) {
    try {
      // Validate number format (basic validation)
      const cleanNumber = this.formatWhatsAppNumber(number);
      if (!this.isValidWhatsAppNumber(cleanNumber)) {
        throw new Error('Invalid WhatsApp number format');
      }

      await AsyncStorage.setItem(ADMIN_WHATSAPP_KEY, cleanNumber);

      // Clear cache to force refresh
      this.cachedNumber = null;
      this.cacheTimestamp = null;

      return { success: true, number: cleanNumber };
    } catch (error) {
      console.error('Error setting admin WhatsApp number:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Format WhatsApp number to international format
   * @param {string} number - Input number
   * @returns {string} Formatted number
   */
  formatWhatsAppNumber(number) {
    // Remove all non-digit characters except +
    let cleaned = number.replace(/[^\d+]/g, '');

    // Ensure it starts with + for international format
    if (!cleaned.startsWith('+')) {
      // Assume Saudi number if no country code
      if (cleaned.startsWith('966')) {
        cleaned = '+' + cleaned;
      } else if (cleaned.startsWith('05')) {
        // Convert Saudi local format to international
        cleaned = '+966' + cleaned.substring(1);
      } else if (cleaned.startsWith('5')) {
        // Handle short format
        cleaned = '+966' + cleaned;
      } else {
        // Default to adding +
        cleaned = '+' + cleaned;
      }
    }

    return cleaned;
  }

  /**
   * Validate WhatsApp number format
   * @param {string} number - Number to validate
   * @returns {boolean} Is valid
   */
  isValidWhatsAppNumber(number) {
    // Basic validation: starts with + and has 10-15 digits
    const regex = /^\+\d{10,15}$/;
    return regex.test(number);
  }

  /**
   * Open WhatsApp chat with admin
   * @param {string} message - Optional pre-filled message
   */
  async openAdminWhatsApp(message = '') {
    try {
      const number = await this.getAdminWhatsAppNumber();
      const cleanNumber = number.replace(/[^\d]/g, ''); // Remove all non-digits for URL

      // Encode message for URL
      const encodedMessage = encodeURIComponent(message);

      // Create WhatsApp URL
      let whatsappUrl;
      if (Platform.OS === 'ios') {
        // iOS URL scheme
        whatsappUrl = `whatsapp://send?phone=${cleanNumber}&text=${encodedMessage}`;
      } else {
        // Android and web URL
        whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
      }

      // Check if WhatsApp is installed
      const canOpen = await Linking.canOpenURL(whatsappUrl);

      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        return { success: true };
      } else {
        // Fallback to web WhatsApp
        const webUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
        await Linking.openURL(webUrl);
        return { success: true, usedWeb: true };
      }
    } catch (error) {
      console.error('Error opening WhatsApp:', error);

      // Try web version as last resort
      try {
        const number = await this.getAdminWhatsAppNumber();
        const cleanNumber = number.replace(/[^\d]/g, '');
        const webUrl = `https://wa.me/${cleanNumber}`;
        await Linking.openURL(webUrl);
        return { success: true, fallback: true };
      } catch (fallbackError) {
        return { success: false, error: fallbackError.message };
      }
    }
  }

  /**
   * Get formatted display number for UI
   * @returns {string} Formatted number for display
   */
  async getDisplayNumber() {
    const number = await this.getAdminWhatsAppNumber();

    // Format for display (e.g., +966 50 123 4567)
    if (number.startsWith('+966')) {
      const localNumber = number.substring(4);
      if (localNumber.length >= 9) {
        return `+966 ${localNumber.substring(0, 2)} ${localNumber.substring(2, 5)} ${localNumber.substring(5)}`;
      }
    }

    return number;
  }

  /**
   * Clear cached number (useful when signing out)
   */
  clearCache() {
    this.cachedNumber = null;
    this.cacheTimestamp = null;
  }

  /**
   * Get the onboarding help message
   * Returns the stored message or default if not configured
   */
  async getOnboardingHelpMessage() {
    try {
      const storedMessage = await AsyncStorage.getItem(ONBOARDING_HELP_MESSAGE_KEY);
      return storedMessage || DEFAULT_ONBOARDING_MESSAGE;
    } catch (error) {
      console.error('Error getting onboarding help message:', error);
      return DEFAULT_ONBOARDING_MESSAGE;
    }
  }

  /**
   * Set the onboarding help message (admin only)
   * @param {string} message - The help message to show on onboarding screen
   */
  async setOnboardingHelpMessage(message) {
    try {
      if (!message || message.trim() === '') {
        throw new Error('Message cannot be empty');
      }

      await AsyncStorage.setItem(ONBOARDING_HELP_MESSAGE_KEY, message.trim());
      return { success: true, message: message.trim() };
    } catch (error) {
      console.error('Error setting onboarding help message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Open WhatsApp with onboarding help message
   */
  async openOnboardingHelp() {
    const message = await this.getOnboardingHelpMessage();
    return await this.openAdminWhatsApp(message);
  }

  /**
   * Get the article suggestion message template
   * Returns the stored message or default if not configured
   */
  async getArticleSuggestionMessage() {
    try {
      const storedMessage = await AsyncStorage.getItem(ARTICLE_SUGGESTION_MESSAGE_KEY);
      return storedMessage || DEFAULT_ARTICLE_SUGGESTION;
    } catch (error) {
      console.error('Error getting article suggestion message:', error);
      return DEFAULT_ARTICLE_SUGGESTION;
    }
  }

  /**
   * Set the article suggestion message template (admin only)
   * @param {string} message - The message template to show when suggesting articles
   */
  async setArticleSuggestionMessage(message) {
    try {
      if (!message || message.trim() === '') {
        throw new Error('Message cannot be empty');
      }

      await AsyncStorage.setItem(ARTICLE_SUGGESTION_MESSAGE_KEY, message.trim());
      return { success: true, message: message.trim() };
    } catch (error) {
      console.error('Error setting article suggestion message:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Open WhatsApp to suggest an article with user info
   * @param {object} userProfile - User profile containing name_chain and phone
   */
  async openWhatsAppForArticleSuggestion(userProfile) {
    try {
      // Get the template message
      const template = await this.getArticleSuggestionMessage();

      // Extract user info
      const nameChain = userProfile?.name_chain || 'غير محدد';
      const phone = userProfile?.phone || 'غير محدد';

      // Format the complete message
      const message = `${template}

الاسم: ${nameChain}
الجوال: ${phone}

`;

      return await this.openAdminWhatsApp(message);
    } catch (error) {
      console.error('Error opening WhatsApp for article suggestion:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export default new AdminContactService();