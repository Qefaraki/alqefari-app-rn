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
 * Parses share code from various URL formats
 * @param url - URL to parse (universal link or custom scheme)
 * @returns Extracted share code or null if invalid
 */
export function parseProfileLink(url: string): string | null {
  if (!url) return null;

  try {
    // Handle custom scheme: alqefari://profile/k7m3x
    if (url.startsWith('alqefari://')) {
      const match = url.match(/alqefari:\/\/profile\/([^?&]+)/);
      if (match && match[1]) {
        const shareCode = match[1].toLowerCase();
        return validateShareCode(shareCode) ? shareCode : null;
      }
    }

    // Handle universal link: https://alqefari.com/profile/k7m3x
    if (url.includes('alqefari.com/profile/')) {
      const match = url.match(/\/profile\/([^?&]+)/);
      if (match && match[1]) {
        const shareCode = match[1].toLowerCase();
        return validateShareCode(shareCode) ? shareCode : null;
      }
    }

    return null;
  } catch (error) {
    console.error('[DeepLink] Error parsing profile link:', error);
    return null;
  }
}

/**
 * Extracts inviter share code from URL query parameters
 * @param url - URL to parse
 * @returns Inviter share code or null if not present
 */
export function parseInviterShareCode(url: string): string | null {
  if (!url) return null;

  try {
    const match = url.match(/[?&]inviter=([^&]+)/);
    if (match && match[1]) {
      const inviterShareCode = match[1].toLowerCase();
      return validateShareCode(inviterShareCode) ? inviterShareCode : null;
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
 * @param shareCode - Target profile's share code (5-char alphanumeric)
 * @param inviterShareCode - Optional inviter's share code
 */
// Debounce variables
let lastDeepLinkTime = 0;
const DEBOUNCE_MS = 1000;

export async function handleDeepLink(shareCode: string, inviterShareCode?: string): Promise<void> {
  console.log('[DeepLink] Handling deep link:', { shareCode, inviterShareCode });

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
  if (currentUserProfile?.share_code === shareCode.toLowerCase()) {
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

  // Validate share code
  if (!validateShareCode(shareCode)) {
    Alert.alert(
      'رابط غير صالح',
      'رمز المشاركة غير صحيح. يرجى التحقق من الرابط والمحاولة مرة أخرى.'
    );
    return;
  }

  const normalizedShareCode = shareCode.toLowerCase();

  try {
    // Find profile in tree store by share_code
    // Reassign to get fresh state before search
    treeStore = useTreeStore.getState();
    let profile = treeStore.treeData.find((node) => node.share_code === normalizedShareCode);

    if (!profile) {
      // Profile not in current tree view - search in database by share_code
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('share_code', normalizedShareCode)
        .single();

      if (error || !data) {
        Alert.alert(
          'الملف غير موجود',
          'لم يتم العثور على الملف الشخصي. قد يكون الرابط قديمًا أو غير صحيح.'
        );
        console.error('[DeepLink] Profile not found:', error);
        return;
      }

      profile = data;
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

      // Find sharer profile ID if inviterShareCode provided
      if (inviterShareCode) {
        const normalizedInviterCode = inviterShareCode.toLowerCase();
        const sharerProfile = treeStore.treeData.find((node) => node.share_code === normalizedInviterCode);
        if (sharerProfile) {
          sharerId = sharerProfile.id;
        } else {
          // Search database if not in tree
          const { data: sharerData } = await supabase
            .from('profiles')
            .select('id')
            .eq('share_code', normalizedInviterCode)
            .single();
          if (sharerData) {
            sharerId = sharerData.id;
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
