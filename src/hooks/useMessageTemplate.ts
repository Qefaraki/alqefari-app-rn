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
import { Alert } from 'react-native';
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
      const merged = {
        ...profile,
        phone: user?.phone || profile?.phone,
      };

      // DEBUG: Show merge result when no userData
      console.log('[mergeUserData] No userData - using profile + user.phone:', {
        user_id: user?.id,
        user_phone: user?.phone,
        profile_id: profile?.id,
        profile_name: profile?.name,
        profile_phone: profile?.phone,
        merged_phone: merged.phone,
      });

      return merged;
    }

    // If userData provided, merge with auth phone
    const merged = {
      ...userData,
      phone: user?.phone || userData?.phone,
    };

    // DEBUG: Show merge result with userData
    console.log('[mergeUserData] With userData - merging user.phone:', {
      user_id: user?.id,
      user_phone: user?.phone,
      userData_id: userData?.id,
      userData_name: userData?.name,
      userData_phone: userData?.phone,
      merged_name: merged?.name,
      merged_phone: merged?.phone,
    });

    return merged;
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

      // DEBUG: Show hook's user and profile data
      Alert.alert(
        'DEBUG: Hook Data',
        `User ID: ${user?.id || 'NULL'}\nUser Phone: ${user?.phone || 'NULL'}\n\nProfile ID: ${profile?.id || 'NULL'}\nProfile Name: ${profile?.name || 'NULL'}\nProfile Phone: ${profile?.phone || 'NULL'}\n\nMerged Name: ${mergedData?.name || 'NULL'}\nMerged Phone: ${mergedData?.phone || 'NULL'}`,
        [{ text: 'Continue', onPress: async () => {
          const message = await templateService.getMessageWithData(templateId, mergedData);

          // Show final message
          Alert.alert(
            'DEBUG: Final Message',
            message.substring(0, 200),
            [{ text: 'Send', onPress: async () => {
              await adminContactService.openAdminWhatsApp(message);
            }}]
          );
        }}]
      );

      // Return dummy success for now (actual sending happens in alert callback)
      return { success: true };
    },
    [mergeUserData, user, profile]
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
