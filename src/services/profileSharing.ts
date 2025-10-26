/**
 * Profile Sharing Service
 *
 * Handles all profile sharing operations including:
 * - Link copying to clipboard
 * - Native share sheet
 * - WhatsApp deep linking
 * - Share analytics logging
 *
 * @module profileSharing
 */

import { Alert, Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { generateProfileLink } from '../utils/deepLinking';
import { supabase } from './supabase';

/**
 * Copies profile link to clipboard
 * @param profile - Target profile object
 * @param inviterProfile - Optional inviter profile for tracking
 * @returns True if successful
 */
export async function copyProfileLink(
  profile: any,
  inviterProfile?: any
): Promise<boolean> {
  try {
    if (!profile?.hid) {
      console.error('[ProfileSharing] Cannot copy link - profile missing HID');
      return false;
    }

    const link = generateProfileLink(profile.hid, inviterProfile?.hid);

    if (!link) {
      Alert.alert('خطأ', 'فشل إنشاء رابط المشاركة');
      return false;
    }

    await Clipboard.setStringAsync(link);

    // Log share event for analytics (non-blocking)
    logShareEvent(profile.id, 'copy_link', inviterProfile?.id).catch((err) =>
      console.warn('[ProfileSharing] Failed to log share event:', err)
    );

    return true;
  } catch (error) {
    console.error('[ProfileSharing] Copy failed:', error);
    Alert.alert('خطأ', 'فشل نسخ الرابط');
    return false;
  }
}

/**
 * Shares profile via native share sheet or WhatsApp
 * @param profile - Target profile object
 * @param mode - 'share' or 'invite'
 * @param inviterProfile - Optional inviter profile for tracking
 */
export async function shareProfile(
  profile: any,
  mode: 'share' | 'invite',
  inviterProfile?: any
): Promise<void> {
  try {
    if (!profile?.hid) {
      console.error('[ProfileSharing] Cannot share - profile missing HID');
      Alert.alert('خطأ', 'لا يمكن مشاركة الملف الشخصي');
      return;
    }

    const link = generateProfileLink(profile.hid, inviterProfile?.hid);

    if (!link) {
      Alert.alert('خطأ', 'فشل إنشاء رابط المشاركة');
      return;
    }

    const message = getShareMessage(profile, mode, inviterProfile);

    // For invite mode, prefer WhatsApp if available
    if (mode === 'invite') {
      const canOpenWhatsApp = await Linking.canOpenURL('whatsapp://');

      if (canOpenWhatsApp) {
        await shareViaWhatsApp(message, link, profile, inviterProfile);
        return;
      }
    }

    // Fallback to native share sheet
    const isAvailable = await Sharing.isAvailableAsync();

    if (isAvailable) {
      await Sharing.shareAsync(link, {
        dialogTitle: message,
      });

      // Log share event (non-blocking)
      logShareEvent(profile.id, 'native_share', inviterProfile?.id).catch((err) =>
        console.warn('[ProfileSharing] Failed to log share event:', err)
      );
    } else {
      // Last resort: copy to clipboard
      await copyProfileLink(profile, inviterProfile);
      Alert.alert('تم النسخ', 'تم نسخ الرابط. يمكنك لصقه في أي تطبيق للمشاركة.');
    }
  } catch (error) {
    console.error('[ProfileSharing] Share failed:', error);
    Alert.alert('خطأ', 'فشلت عملية المشاركة');
  }
}

/**
 * Generates Arabic share message based on mode
 * @param profile - Target profile
 * @param mode - 'share' or 'invite'
 * @param inviterProfile - Optional inviter profile
 * @returns Formatted Arabic message
 */
function getShareMessage(
  profile: any,
  mode: 'share' | 'invite',
  inviterProfile?: any
): string {
  const name = profile.name_chain || profile.first_name || 'أحد أفراد العائلة';

  if (mode === 'invite') {
    if (inviterProfile) {
      const inviterName = inviterProfile.name_chain || inviterProfile.first_name;
      return `${inviterName} يدعوك للانضمام إلى شجرة عائلة القفاري ومشاهدة ملف ${name}`;
    }
    return `ادعوك للانضمام إلى شجرة عائلة القفاري ومشاهدة ملف ${name}`;
  }

  // Share mode
  return `شاهد ملف ${name} في شجرة عائلة القفاري`;
}

/**
 * Opens WhatsApp with pre-filled message and link
 * @param message - Arabic message text
 * @param link - Profile link URL
 * @param profile - Target profile
 * @param inviterProfile - Optional inviter profile
 */
async function shareViaWhatsApp(
  message: string,
  link: string,
  profile: any,
  inviterProfile?: any
): Promise<void> {
  try {
    // Encode message + link for WhatsApp
    const fullMessage = `${message}\n\n${link}`;
    const encodedMessage = encodeURIComponent(fullMessage);

    // WhatsApp deep link (no phone number = open WhatsApp with message ready)
    const whatsappUrl = `whatsapp://send?text=${encodedMessage}`;

    const canOpen = await Linking.canOpenURL(whatsappUrl);

    if (canOpen) {
      await Linking.openURL(whatsappUrl);

      // Log WhatsApp share (non-blocking)
      logShareEvent(profile.id, 'whatsapp', inviterProfile?.id).catch((err) =>
        console.warn('[ProfileSharing] Failed to log share event:', err)
      );
    } else {
      // Fallback if WhatsApp not installed (shouldn't happen as we check before calling)
      await copyProfileLink(profile, inviterProfile);
      Alert.alert(
        'واتساب غير متوفر',
        'تم نسخ الرابط. يمكنك لصقه في أي تطبيق للمشاركة.'
      );
    }
  } catch (error) {
    console.error('[ProfileSharing] WhatsApp share failed:', error);
    // Fallback to copy
    await copyProfileLink(profile, inviterProfile);
    Alert.alert('تم النسخ', 'تم نسخ الرابط بدلاً من ذلك');
  }
}

/**
 * Logs share event to analytics table (non-blocking)
 * @param profileId - Target profile UUID
 * @param shareMethod - Share method used
 * @param sharerId - Optional sharer profile UUID
 */
async function logShareEvent(
  profileId: string,
  shareMethod: string,
  sharerId?: string
): Promise<void> {
  try {
    const { error } = await supabase.from('profile_share_events').insert({
      profile_id: profileId,
      sharer_id: sharerId || null,
      share_method: shareMethod,
      shared_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('[ProfileSharing] Analytics logging failed (non-critical):', error.message);
    }
  } catch (error) {
    // Non-blocking: analytics failure shouldn't affect user experience
    console.warn('[ProfileSharing] Analytics error:', error);
  }
}
