/**
 * Message Template Service
 *
 * Core service for managing WhatsApp message templates.
 * Handles CRUD operations, variable replacement, and testing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { buildNameChain } from '../../utils/nameChainBuilder';
import { getTemplateById, getAllTemplates } from './templateRegistry';
import { supabase } from '../supabase';
import {
  MessageTemplate,
  TemplateWithValue,
  TemplateOperationResult,
  TemplateValidationResult,
} from './types';

class MessageTemplateService {
  /**
   * Get template message (custom or default)
   */
  async getTemplateMessage(templateId: string): Promise<string> {
    const template = getTemplateById(templateId);
    if (!template) {
      console.error(`[TemplateService] Template not found: ${templateId}`);
      return '';
    }

    try {
      const customMessage = await AsyncStorage.getItem(template.storageKey);
      const message = customMessage || template.defaultMessage;

      console.log(`[TemplateService] Retrieved message for ${templateId}:`, message.substring(0, 50) + '...');
      return message;
    } catch (error) {
      console.error(`[TemplateService] Error getting template ${templateId}:`, error);
      return template.defaultMessage;
    }
  }

  /**
   * Set custom template message
   */
  async setTemplateMessage(
    templateId: string,
    message: string
  ): Promise<TemplateOperationResult> {
    const template = getTemplateById(templateId);
    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      };
    }

    if (!message || message.trim() === '') {
      return {
        success: false,
        error: 'Message cannot be empty',
      };
    }

    try {
      await AsyncStorage.setItem(template.storageKey, message.trim());
      console.log(`[TemplateService] Saved message for ${templateId}`);

      return {
        success: true,
        message: message.trim(),
      };
    } catch (error) {
      console.error(`[TemplateService] Error setting template ${templateId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reset template to default message
   */
  async resetTemplate(templateId: string): Promise<TemplateOperationResult> {
    const template = getTemplateById(templateId);
    if (!template) {
      return {
        success: false,
        error: 'Template not found',
      };
    }

    try {
      await AsyncStorage.removeItem(template.storageKey);
      console.log(`[TemplateService] Reset template ${templateId} to default`);

      return {
        success: true,
        message: template.defaultMessage,
      };
    } catch (error) {
      console.error(`[TemplateService] Error resetting template ${templateId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all templates with their current values
   */
  async getAllTemplatesWithValues(): Promise<TemplateWithValue[]> {
    const templates = getAllTemplates();
    const templatesWithValues: TemplateWithValue[] = [];

    for (const template of templates) {
      const currentMessage = await this.getTemplateMessage(template.id);
      const isCustomized = currentMessage !== template.defaultMessage;

      templatesWithValues.push({
        ...template,
        currentMessage,
        isCustomized,
      });
    }

    return templatesWithValues;
  }

  /**
   * Replace variables in message with actual user data
   */
  async replaceVariables(message: string, userData: any): Promise<string> {
    if (!userData) {
      console.warn('[TemplateService] No userData provided for variable replacement');
      return message;
    }

    // DEBUG: Log what data we received
    console.log('[TemplateService.replaceVariables] Starting replacement...');
    console.log('[TemplateService.replaceVariables] Received userData:', {
      name: userData?.name,
      phone: userData?.phone,
      father_id: userData?.father_id,
      hid: userData?.hid,
    });
    console.log('[TemplateService.replaceVariables] Template message:', message);

    let processedMessage = message;

    // Name Chain - fetch all profiles to build proper ancestry (same pattern as SettingsPageModern)
    if (processedMessage.includes('{name_chain}')) {
      try {
        // Fetch all profiles from database to traverse ancestry
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id, name, father_id, gender');

        // Build full name chain using buildNameChain utility
        const nameChain = buildNameChain(userData, allProfiles || []) ||
                          userData?.name ||
                          'الاسم غير متوفر';

        processedMessage = processedMessage.replace(/{name_chain}/g, nameChain);
        console.log('[TemplateService] Replaced {name_chain} with:', nameChain);
      } catch (error) {
        console.error('[TemplateService] Error fetching profiles for name chain:', error);
        // Fallback to just the name if database fetch fails
        const fallbackName = userData?.name || 'الاسم غير متوفر';
        processedMessage = processedMessage.replace(/{name_chain}/g, fallbackName);
      }
    }

    // First name only
    if (processedMessage.includes('{first_name}')) {
      const firstName = userData?.name || 'غير محدد';
      processedMessage = processedMessage.replace(/{first_name}/g, firstName);
    }

    // Phone
    if (processedMessage.includes('{phone}')) {
      const phone = userData?.phone || 'رقم الجوال غير متوفر';
      processedMessage = processedMessage.replace(/{phone}/g, phone);
      console.log('[TemplateService] Replaced {phone} with:', phone);
    }

    // HID (Hierarchical ID)
    if (processedMessage.includes('{hid}')) {
      const hid = userData?.hid || 'غير محدد';
      processedMessage = processedMessage.replace(/{hid}/g, hid);
    }

    // Gender (Arabic)
    if (processedMessage.includes('{gender}')) {
      const gender =
        userData?.gender === 'male' ? 'ذكر' :
        userData?.gender === 'female' ? 'أنثى' :
        'غير محدد';
      processedMessage = processedMessage.replace(/{gender}/g, gender);
    }

    // Father name
    if (processedMessage.includes('{father_name}')) {
      const fatherName = userData?.father_name || 'غير محدد';
      processedMessage = processedMessage.replace(/{father_name}/g, fatherName);
    }

    // Mother name
    if (processedMessage.includes('{mother_name}')) {
      const motherName = userData?.mother_name || 'غير محدد';
      processedMessage = processedMessage.replace(/{mother_name}/g, motherName);
    }

    // Birth year (Hijri)
    if (processedMessage.includes('{birth_year}')) {
      const birthYear = userData?.birth_hijri_year || 'غير محدد';
      processedMessage = processedMessage.replace(/{birth_year}/g, birthYear);
    }

    // Death year (Hijri)
    if (processedMessage.includes('{death_year}')) {
      const deathYear = userData?.death_hijri_year || 'غير محدد';
      processedMessage = processedMessage.replace(/{death_year}/g, deathYear);
    }

    // Date (current date in Arabic)
    if (processedMessage.includes('{date}')) {
      const date = new Date().toLocaleDateString('ar-SA');
      processedMessage = processedMessage.replace(/{date}/g, date);
    }

    // Hijri date (if available)
    if (processedMessage.includes('{hijri_date}')) {
      // TODO: Implement Hijri date conversion if needed
      const hijriDate = 'التاريخ الهجري';
      processedMessage = processedMessage.replace(/{hijri_date}/g, hijriDate);
    }

    // Time (current time in Arabic)
    if (processedMessage.includes('{time}')) {
      const time = new Date().toLocaleTimeString('ar-SA');
      processedMessage = processedMessage.replace(/{time}/g, time);
    }

    console.log('[TemplateService.replaceVariables] Variable replacement completed');
    console.log('[TemplateService.replaceVariables] Final message:', processedMessage);

    // DEBUG: Show exactly what was replaced
    const replacedVars: string[] = [];
    if (message.includes('{name_chain}')) replacedVars.push('name_chain');
    if (message.includes('{first_name}')) replacedVars.push('first_name');
    if (message.includes('{phone}')) replacedVars.push('phone');
    if (message.includes('{hid}')) replacedVars.push('hid');
    console.log('[TemplateService.replaceVariables] Variables replaced:', replacedVars.join(', '));

    return processedMessage;
  }

  /**
   * Get message with variables replaced
   */
  async getMessageWithData(
    templateId: string,
    userData: any
  ): Promise<string> {
    // DEBUG: Show what userData was received
    console.log('[TemplateService.getMessageWithData] Received userData:', {
      id: userData?.id,
      name: userData?.name,
      phone: userData?.phone,
      father_id: userData?.father_id,
      hid: userData?.hid,
    });

    const template = await this.getTemplateMessage(templateId);
    const messageWithData = await this.replaceVariables(template, userData);

    console.log(`[TemplateService] Generated message for ${templateId}:`,
      messageWithData.substring(0, 100) + '...');

    return messageWithData;
  }

  /**
   * Validate template message
   */
  validateTemplate(
    template: MessageTemplate,
    message: string
  ): TemplateValidationResult {
    const errors: string[] = [];
    const missingVariables: string[] = [];

    // Check for required variables
    for (const variable of template.variables) {
      if (variable.required && !message.includes(variable.key)) {
        missingVariables.push(variable.key);
        errors.push(`المتغير المطلوب ${variable.key} غير موجود في الرسالة`);
      }
    }

    // Check for unknown variables (variables not in template definition)
    const variablePattern = /{([^}]+)}/g;
    const foundVariables = message.match(variablePattern) || [];
    const knownVariableKeys = template.variables.map(v => v.key);

    for (const foundVar of foundVariables) {
      if (!knownVariableKeys.includes(foundVar)) {
        errors.push(`المتغير ${foundVar} غير معرّف في القالب`);
      }
    }

    return {
      valid: errors.length === 0,
      missingVariables,
      errors,
    };
  }

  /**
   * Get template configuration (metadata only)
   */
  getTemplateConfig(templateId: string): MessageTemplate | undefined {
    return getTemplateById(templateId);
  }

  /**
   * Check if template has been customized
   */
  async isTemplateCustomized(templateId: string): Promise<boolean> {
    const template = getTemplateById(templateId);
    if (!template) return false;

    try {
      const customMessage = await AsyncStorage.getItem(template.storageKey);
      return customMessage !== null && customMessage !== template.defaultMessage;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all custom templates (reset to defaults)
   */
  async clearAllCustomTemplates(): Promise<TemplateOperationResult> {
    try {
      const templates = getAllTemplates();

      for (const template of templates) {
        await AsyncStorage.removeItem(template.storageKey);
      }

      console.log('[TemplateService] Cleared all custom templates');
      return {
        success: true,
        message: 'تم إعادة تعيين جميع القوالب للإعدادات الافتراضية',
      };
    } catch (error) {
      console.error('[TemplateService] Error clearing templates:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export default new MessageTemplateService();
