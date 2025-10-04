/**
 * useMessageTemplate Hook
 *
 * Easy access to message template system from any component.
 * Automatically merges auth user data (phone) with profile data.
 *
 * Usage:
 *   const { getMessage, getMessageWithData } = useMessageTemplate();
 *   const message = await getMessage('onboarding_help');
 *   const messageWithData = await getMessageWithData('article_suggestion', userProfile);
 */

import { useCallback } from 'react';
import templateService from '../services/messageTemplates';
import adminContactService from '../services/adminContact';
import { useAuth } from '../contexts/AuthContextSimple';

export function useMessageTemplate() {
  const { user, profile } = useAuth();

  /**
   * Merge auth user data with profile data
   * CRITICAL: Phone is in user.phone (auth), not profile.phone (database)
   */
  const mergeUserData = useCallback((userData: any) => {
    // If no userData provided, use current profile + user
    if (!userData) {
      return {
        ...profile,
        phone: user?.phone || profile?.phone,
      };
    }

    // If userData provided, merge with auth phone
    return {
      ...userData,
      phone: user?.phone || userData?.phone,
    };
  }, [user, profile]);

  /**
   * Get template message (custom or default)
   */
  const getMessage = useCallback(async (templateId: string): Promise<string> => {
    return await templateService.getTemplateMessage(templateId);
  }, []);

  /**
   * Get message with variables replaced
   * Automatically merges auth phone with userData
   */
  const getMessageWithData = useCallback(
    async (templateId: string, userData?: any): Promise<string> => {
      const mergedData = mergeUserData(userData);
      console.log('[useMessageTemplate] Merged data:', {
        name: mergedData?.name,
        phone: mergedData?.phone,
        user_phone: user?.phone,
        profile_phone: profile?.phone,
      });
      return await templateService.getMessageWithData(templateId, mergedData);
    },
    [mergeUserData, user, profile]
  );

  /**
   * Open WhatsApp with template message
   * Automatically merges auth phone with userData
   */
  const openWhatsApp = useCallback(
    async (templateId: string, userData?: any) => {
      const mergedData = mergeUserData(userData);
      const message = await templateService.getMessageWithData(templateId, mergedData);

      return await adminContactService.openAdminWhatsApp(message);
    },
    [mergeUserData]
  );

  /**
   * Save custom template message
   */
  const saveMessage = useCallback(
    async (templateId: string, message: string) => {
      return await templateService.setTemplateMessage(templateId, message);
    },
    []
  );

  /**
   * Reset template to default
   */
  const resetTemplate = useCallback(async (templateId: string) => {
    return await templateService.resetTemplate(templateId);
  }, []);

  /**
   * Check if template is customized
   */
  const isCustomized = useCallback(async (templateId: string): Promise<boolean> => {
    return await templateService.isTemplateCustomized(templateId);
  }, []);

  return {
    getMessage,
    getMessageWithData,
    openWhatsApp,
    saveMessage,
    resetTemplate,
    isCustomized,
  };
}

export default useMessageTemplate;
