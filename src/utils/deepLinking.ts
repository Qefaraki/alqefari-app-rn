/**
 * Deep Linking Utilities
 *
 * Handles profile link generation, parsing, and navigation for deep linking system.
 * Supports universal links (https://alqefari.com/profile/HID) and custom scheme (alqefari://).
 *
 * Features:
 * - HID validation (H-format: H1-H999999, R-format: R1, R1.1, R1.1.1, etc.)
 * - Profile link generation with optional inviter tracking
 * - Deep link handling with network guard and progressive loading integration
 * - Enrichment for non-enriched profiles before navigation
 *
 * @module deepLinking
 */

import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTreeStore } from '../stores/useTreeStore';
import profilesService from '../services/profiles';

// HID format: H or R followed by digits or dot-separated digits
// Examples: H1, H12345, R1, R1.1, R1.1.1.1.1.1
// H-format: Standard profiles (H1 to H999999)
// R-format: Root node branch profiles (R1, R1.1, R1.1.1, etc.)
export const HID_REGEX = /^[HR][\d.]*\d$/;

/**
 * Validates a Human ID (HID) format
 * @param hid - The HID string to validate
 * @returns True if valid HID format
 */
export function validateHID(hid: string): boolean {
  if (!hid || typeof hid !== 'string') return false;
  return HID_REGEX.test(hid.trim().toUpperCase());
}

/**
 * Generates a shareable profile link
 * @param hid - Target profile's HID
 * @param inviterHid - Optional inviter's HID for tracking
 * @returns Full URL for sharing (https://alqefari.com/profile/HID)
 */
export function generateProfileLink(hid: string, inviterHid?: string): string {
  if (!validateHID(hid)) {
    console.warn('[DeepLink] Invalid HID provided to generateProfileLink:', hid);
    return '';
  }

  const normalizedHID = hid.trim().toUpperCase();
  const baseUrl = `https://alqefari.com/profile/${normalizedHID}`;

  // Add inviter tracking if provided
  if (inviterHid && validateHID(inviterHid)) {
    const normalizedInviter = inviterHid.trim().toUpperCase();
    return `${baseUrl}?inviter=${normalizedInviter}`;
  }

  return baseUrl;
}

/**
 * Parses HID from various URL formats
 * @param url - URL to parse (universal link or custom scheme)
 * @returns Extracted HID or null if invalid
 */
export function parseProfileLink(url: string): string | null {
  if (!url) return null;

  try {
    // Handle custom scheme: alqefari://profile/H12345
    if (url.startsWith('alqefari://')) {
      const match = url.match(/alqefari:\/\/profile\/([^?&]+)/);
      if (match && match[1]) {
        const hid = match[1].toUpperCase();
        return validateHID(hid) ? hid : null;
      }
    }

    // Handle universal link: https://alqefari.com/profile/H12345
    if (url.includes('alqefari.com/profile/')) {
      const match = url.match(/\/profile\/([^?&]+)/);
      if (match && match[1]) {
        const hid = match[1].toUpperCase();
        return validateHID(hid) ? hid : null;
      }
    }

    return null;
  } catch (error) {
    console.error('[DeepLink] Error parsing profile link:', error);
    return null;
  }
}

/**
 * Extracts inviter HID from URL query parameters
 * @param url - URL to parse
 * @returns Inviter HID or null if not present
 */
export function parseInviterHID(url: string): string | null {
  if (!url) return null;

  try {
    const match = url.match(/[?&]inviter=([^&]+)/);
    if (match && match[1]) {
      const inviterHid = match[1].toUpperCase();
      return validateHID(inviterHid) ? inviterHid : null;
    }
    return null;
  } catch (error) {
    console.error('[DeepLink] Error parsing inviter HID:', error);
    return null;
  }
}

/**
 * Main deep link handler - finds profile, enriches if needed, opens ProfileViewer
 * @param hid - Target profile's HID
 * @param inviterHid - Optional inviter's HID
 */
export async function handleDeepLink(hid: string, inviterHid?: string): Promise<void> {
  console.log('[DeepLink] Handling deep link:', { hid, inviterHid });

  // Network guard
  const networkState = await NetInfo.fetch();
  if (!networkState.isConnected) {
    Alert.alert(
      'خطأ في الاتصال',
      'يرجى التحقق من اتصالك بالإنترنت لفتح الرابط'
    );
    return;
  }

  // Validate HID
  if (!validateHID(hid)) {
    Alert.alert(
      'رابط غير صالح',
      'معرف الملف الشخصي غير صحيح. يرجى التحقق من الرابط والمحاولة مرة أخرى.'
    );
    return;
  }

  const normalizedHID = hid.toUpperCase();

  try {
    // Find profile in tree store by HID
    const treeStore = useTreeStore.getState();
    let profile = treeStore.treeData.find((node) => node.hid === normalizedHID);

    if (!profile) {
      // Profile not in current tree view - search in database
      const { data, error } = await profilesService.searchProfiles(normalizedHID, {
        limit: 1,
        exact: true,
      });

      if (error || !data || data.length === 0) {
        Alert.alert(
          'الملف غير موجود',
          'لم يتم العثور على الملف الشخصي. قد يكون الرابط قديمًا أو غير صحيح.'
        );
        return;
      }

      profile = data[0];
    }

    // Check if profile needs enrichment (Progressive Loading Phase 3B)
    const isEnriched = Boolean(
      profile.photo_url !== undefined &&
      profile.bio !== undefined &&
      profile.version !== undefined
    );

    if (!isEnriched) {
      console.log('[DeepLink] Profile not enriched, enriching now:', profile.id);
      const { data: enrichedProfiles } = await profilesService.enrichVisibleNodes([profile.id]);
      if (enrichedProfiles && enrichedProfiles.length > 0) {
        profile = enrichedProfiles[0];
        // Update tree store with enriched data
        treeStore.updateNode(profile.id, profile);
      }
    }

    // Open ProfileViewer
    console.log('[DeepLink] Opening profile:', profile.id, profile.name);
    treeStore.openProfileViewer(profile);

    // Log inviter analytics if provided
    if (inviterHid) {
      console.log('[DeepLink] Profile accessed via invite from:', inviterHid);
      // TODO: Log to profile_access_log table for analytics
    }
  } catch (error) {
    console.error('[DeepLink] Failed to handle deep link:', error);
    Alert.alert(
      'خطأ',
      'حدث خطأ أثناء فتح الملف الشخصي. يرجى المحاولة مرة أخرى لاحقًا.'
    );
  }
}
