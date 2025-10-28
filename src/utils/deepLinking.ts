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
import { supabase } from '../services/supabase';
import { fetchWithTimeout } from './fetchWithTimeout';

// Share code format: 5 lowercase alphanumeric characters (a-z, 0-9)
// Examples: k7m3x, 37491, abc12
// Capacity: 36^5 = 60,466,176 combinations (supports 100k+ profiles)
export const SHARE_CODE_REGEX = /^[a-z0-9]{5}$/;

// Legacy HID format (kept for backwards compatibility)
export const HID_REGEX = /^[HR][\d.]*\d$/;

/**
 * Validates a share code format
 * @param shareCode - The share code string to validate
 * @returns True if valid share code format
 */
export function validateShareCode(shareCode: string): boolean {
  if (!shareCode || typeof shareCode !== 'string') return false;
  return SHARE_CODE_REGEX.test(shareCode.trim().toLowerCase());
}

/**
 * Validates a Human ID (HID) format (legacy, kept for backwards compatibility)
 * @param hid - The HID string to validate
 * @returns True if valid HID format
 */
export function validateHID(hid: string): boolean {
  if (!hid || typeof hid !== 'string') return false;
  return HID_REGEX.test(hid.trim().toUpperCase());
}

/**
 * Generates a shareable profile link using secure share codes
 * @param shareCode - Target profile's share code (5-char alphanumeric)
 * @param inviterShareCode - Optional inviter's share code for tracking
 * @returns Full URL for sharing (alqefari://profile/k7m3x)
 */
export function generateProfileLink(shareCode: string, inviterShareCode?: string): string {
  if (!validateShareCode(shareCode)) {
    console.warn('[DeepLink] Invalid share code provided to generateProfileLink:', shareCode);
    return '';
  }

  const normalizedCode = shareCode.trim().toLowerCase();
  const baseUrl = `alqefari://profile/${normalizedCode}`;

  // Add inviter tracking if provided
  if (inviterShareCode && validateShareCode(inviterShareCode)) {
    const normalizedInviter = inviterShareCode.trim().toLowerCase();
    return `${baseUrl}?inviter=${normalizedInviter}`;
  }

  return baseUrl;
}

/**
 * Parses share code from various URL formats (with HID fallback for backward compatibility)
 * @param url - URL to parse (universal link or custom scheme)
 * @returns Object with type ('share_code' or 'hid') and value, or null if invalid
 */
export function parseProfileLink(url: string): { type: 'share_code' | 'hid', value: string } | null {
  if (!url) return null;

  try {
    let identifier: string | null = null;

    // Handle custom scheme: alqefari://profile/k7m3x or alqefari://profile/H12345
    if (url.startsWith('alqefari://')) {
      const match = url.match(/alqefari:\/\/profile\/([^?&]+)/);
      if (match && match[1]) {
        identifier = match[1];
      }
    }

    // Handle universal link: https://alqefari.com/profile/k7m3x or https://alqefari.com/profile/H12345
    if (url.includes('alqefari.com/profile/')) {
      const match = url.match(/\/profile\/([^?&]+)/);
      if (match && match[1]) {
        identifier = match[1];
      }
    }

    if (!identifier) return null;

    // Try share code first (new format)
    const shareCode = identifier.toLowerCase();
    if (validateShareCode(shareCode)) {
      return { type: 'share_code', value: shareCode };
    }

    // Fallback to HID for backward compatibility (old QR codes)
    const hid = identifier.toUpperCase();
    if (validateHID(hid)) {
      console.log('[DeepLink] Legacy HID detected, will lookup share_code:', hid);
      return { type: 'hid', value: hid };
    }

    return null;
  } catch (error) {
    console.error('[DeepLink] Error parsing profile link:', error);
    return null;
  }
}

/**
 * Extracts inviter share code from URL query parameters (with HID fallback)
 * @param url - URL to parse
 * @returns Object with type and value, or null if not present
 */
export function parseInviterShareCode(url: string): { type: 'share_code' | 'hid', value: string } | null {
  if (!url) return null;

  try {
    const match = url.match(/[?&]inviter=([^&]+)/);
    if (match && match[1]) {
      const identifier = match[1];

      // Try share code first
      const shareCode = identifier.toLowerCase();
      if (validateShareCode(shareCode)) {
        return { type: 'share_code', value: shareCode };
      }

      // Fallback to HID for backward compatibility
      const hid = identifier.toUpperCase();
      if (validateHID(hid)) {
        console.log('[DeepLink] Legacy inviter HID detected:', hid);
        return { type: 'hid', value: hid };
      }
    }
    return null;
  } catch (error) {
    console.error('[DeepLink] Error parsing inviter share code:', error);
    return null;
  }
}

/**
 * @deprecated Use parseInviterShareCode instead
 * Legacy function kept for backwards compatibility
 */
export function parseInviterHID(url: string): string | null {
  return parseInviterShareCode(url);
}

/**
 * Main deep link handler - finds profile, enriches if needed, opens ProfileViewer
 * Supports both share codes (new) and HIDs (legacy backward compatibility)
 * @param identifier - Target profile's share code or HID object
 * @param inviterIdentifier - Optional inviter's share code or HID object
 */
// Debounce variables
let lastDeepLinkTime = 0;
const DEBOUNCE_MS = 1000;

export async function handleDeepLink(
  identifier: { type: 'share_code' | 'hid', value: string } | string,
  inviterIdentifier?: { type: 'share_code' | 'hid', value: string } | string
): Promise<void> {
  // Support legacy string format for backward compatibility
  const targetId = typeof identifier === 'string'
    ? { type: 'share_code' as const, value: identifier }
    : identifier;

  const inviterId = typeof inviterIdentifier === 'string'
    ? { type: 'share_code' as const, value: inviterIdentifier }
    : inviterIdentifier;

  console.log('[DeepLink] Handling deep link:', {
    targetType: targetId.type,
    targetValue: targetId.value,
    inviterType: inviterId?.type,
    inviterValue: inviterId?.value
  });

  // Debounce: Prevent multiple rapid scans
  const now = Date.now();
  if (now - lastDeepLinkTime < DEBOUNCE_MS) {
    console.log('[DeepLink] Debounced - too fast (1 sec cooldown)');
    return;
  }
  lastDeepLinkTime = now;

  // Check if scanning own profile
  let treeStore = useTreeStore.getState(); // Changed to 'let' for reassignment later
  const currentUserProfile = treeStore.userProfile;

  // Check against both share_code and HID for own profile detection
  const isOwnProfile = targetId.type === 'share_code'
    ? currentUserProfile?.share_code === targetId.value.toLowerCase()
    : currentUserProfile?.hid === targetId.value.toUpperCase();

  if (isOwnProfile) {
    Alert.alert('ملفك الشخصي', 'هذا هو ملفك الشخصي');
    console.log('[DeepLink] User scanned their own profile');
    return;
  }

  // Network guard
  const networkState = await NetInfo.fetch();
  if (!networkState.isConnected) {
    Alert.alert(
      'خطأ في الاتصال',
      'يرجى التحقق من اتصالك بالإنترنت لفتح الرابط'
    );
    return;
  }

  // Edge case 1: Tree not loaded yet
  // Reassign to get fresh state after network check
  treeStore = useTreeStore.getState();
  if (!treeStore.treeData || treeStore.treeData.length === 0) {
    Alert.alert(
      'يتم تحميل الشجرة',
      'يرجى الانتظار حتى يتم تحميل شجرة العائلة ثم المحاولة مرة أخرى.'
    );
    console.log('[DeepLink] Tree not loaded yet');
    return;
  }

  // Validate identifier format
  const isValid = targetId.type === 'share_code'
    ? validateShareCode(targetId.value)
    : validateHID(targetId.value);

  if (!isValid) {
    Alert.alert(
      'رابط غير صالح',
      'معرف الملف الشخصي غير صحيح. يرجى التحقق من الرابط والمحاولة مرة أخرى.'
    );
    return;
  }

  const normalizedValue = targetId.type === 'share_code'
    ? targetId.value.toLowerCase()
    : targetId.value.toUpperCase();

  try {
    // Find profile in tree store or database
    // Reassign to get fresh state before search
    treeStore = useTreeStore.getState();

    let profile;

    if (targetId.type === 'share_code') {
      // New format: lookup by share_code directly
      profile = treeStore.treeData.find((node) => node.share_code === normalizedValue);

      if (!profile) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('share_code', normalizedValue)
          .single();

        if (error || !data) {
          Alert.alert(
            'الملف غير موجود',
            'لم يتم العثور على الملف الشخصي. قد يكون الرابط قديمًا أو غير صحيح.'
          );
          console.error('[DeepLink] Profile not found by share_code:', error);
          return;
        }

        profile = data;
      }
    } else {
      // Legacy format: lookup by HID first, then use share_code
      console.log('[DeepLink] Legacy HID lookup, finding share_code...');
      profile = treeStore.treeData.find((node) => node.hid === normalizedValue);

      if (!profile) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('hid', normalizedValue)
          .single();

        if (error || !data) {
          Alert.alert(
            'الملف غير موجود',
            'لم يتم العثور على الملف الشخصي. قد يكون الرابط قديمًا أو غير صحيح.'
          );
          console.error('[DeepLink] Profile not found by HID:', error);
          return;
        }

        profile = data;
      }

      // For analytics and logging, we still use the share_code going forward
      console.log('[DeepLink] HID→share_code conversion:', normalizedValue, '→', profile.share_code);
    }

    // Edge case 2: Deleted profile
    if (profile.deleted_at !== null) {
      Alert.alert(
        'الملف محذوف',
        'هذا الملف الشخصي محذوف ولا يمكن عرضه.'
      );
      console.log('[DeepLink] Profile is deleted:', profile.id);
      return;
    }

    // Edge case 3: Blocked user (permission check)
    try {
      const { data: permissionLevel, error: permError } = await fetchWithTimeout(
        supabase.rpc('check_family_permission_v4', {
          p_user_id: currentUserProfile?.id,
          p_target_id: profile.id,
        }),
        3000, // 3-second timeout (matches ProfileViewer and useProfilePermissions)
        'Check deep link permission'
      );

      if (permError) {
        throw permError;
      }

      if (permissionLevel === 'blocked' || permissionLevel === 'none') {
        Alert.alert(
          'الوصول محظور',
          'ليس لديك صلاحية لعرض هذا الملف الشخصي.'
        );
        console.log('[DeepLink] User blocked or no permission:', permissionLevel);
        return;
      }
    } catch (error) {
      console.error('[DeepLink] Permission check failed:', error);

      // Distinguish network errors from permission errors
      if (error.message === 'NETWORK_OFFLINE') {
        Alert.alert(
          'لا يوجد اتصال',
          'تحقق من الاتصال بالإنترنت وحاول مرة أخرى.'
        );
        return;
      } else if (error.message?.includes('NETWORK_TIMEOUT')) {
        Alert.alert(
          'انتهت المهلة',
          'استغرق التحقق من الصلاحيات وقتاً طويلاً. حاول مرة أخرى.'
        );
        return;
      } else {
        // Unknown error - allow navigation (permissive fallback for deep links)
        console.warn('[DeepLink] Permission check failed, allowing navigation as fallback');
      }
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
    treeStore.setSelectedPersonId(profile.id);

    // Log QR scan analytics (non-blocking)
    try {
      let sharerId = null;

      // Find sharer profile ID if inviter identifier provided
      if (inviterId) {
        if (inviterId.type === 'share_code') {
          const normalizedInviterCode = inviterId.value.toLowerCase();
          const sharerProfile = treeStore.treeData.find((node) => node.share_code === normalizedInviterCode);
          if (sharerProfile) {
            sharerId = sharerProfile.id;
          } else {
            const { data: sharerData } = await supabase
              .from('profiles')
              .select('id')
              .eq('share_code', normalizedInviterCode)
              .single();
            if (sharerData) {
              sharerId = sharerData.id;
            }
          }
        } else {
          // Legacy HID format
          const normalizedInviterHID = inviterId.value.toUpperCase();
          const sharerProfile = treeStore.treeData.find((node) => node.hid === normalizedInviterHID);
          if (sharerProfile) {
            sharerId = sharerProfile.id;
          } else {
            const { data: sharerData } = await supabase
              .from('profiles')
              .select('id')
              .eq('hid', normalizedInviterHID)
              .single();
            if (sharerData) {
              sharerId = sharerData.id;
            }
          }
        }
      }

      // Insert analytics event
      // NOTE: scanner_id is set to current user's profile ID (enforced by RLS policy)
      const { error: analyticsError } = await supabase.from('profile_share_events').insert({
        profile_id: profile.id,
        sharer_id: sharerId,
        scanner_id: currentUserProfile?.id, // Who performed the scan (tied to auth.uid() in RLS)
        share_method: 'qr_scan',
        shared_at: new Date().toISOString(),
      });

      if (analyticsError) {
        // Check if rate limit exceeded (server-side enforcement)
        if (analyticsError.message && analyticsError.message.includes('Rate limit')) {
          Alert.alert(
            'كثرة المحاولات',
            'لقد تجاوزت الحد الأقصى لمسح رموز QR (20 مسحاً كل 5 دقائق). يرجى الانتظار قليلاً.'
          );
          console.log('[DeepLink] Rate limit exceeded for user:', currentUserProfile?.id);
          return; // Stop processing - don't open profile
        }

        // Other analytics errors are non-critical (don't block user)
        console.warn('[DeepLink] Analytics logging failed (non-critical):', analyticsError.message);
      } else {
        console.log('[DeepLink] QR scan analytics logged:', {
          profileId: profile.id,
          sharerId,
          scannerId: currentUserProfile?.id,
        });
      }
    } catch (analyticsErr) {
      // Non-blocking: analytics failure shouldn't affect user experience
      console.warn('[DeepLink] Analytics error:', analyticsErr);
    }
  } catch (error) {
    console.error('[DeepLink] Failed to handle deep link:', error);
    Alert.alert(
      'خطأ',
      'حدث خطأ أثناء فتح الملف الشخصي. يرجى المحاولة مرة أخرى لاحقًا.'
    );
  }
}
