/**
 * Deferred Deep Linking
 *
 * Handles deep links for non-authenticated users by storing them in AsyncStorage
 * until after authentication completes. Links expire after 7 days.
 *
 * Flow:
 * 1. User clicks link while not logged in → saved to AsyncStorage
 * 2. User completes auth/onboarding → link is consumed and opened
 * 3. Expired links (>7 days) are automatically ignored
 *
 * @module deepLinkDeferred
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFERRED_LINK_KEY = '@najdi_sadu/deferred_profile_link';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type DeferredLinkSource = 'qr' | 'link' | 'share' | 'invite';

export interface DeferredLink {
  hid: string;
  inviterHid?: string;
  source: DeferredLinkSource;
  timestamp: number;
  expiresAt: number;
}

/**
 * Saves a deferred deep link for non-authenticated users
 * @param hid - Target profile's HID
 * @param source - Link source for analytics
 * @param inviterHid - Optional inviter's HID
 */
export async function saveDeferredLink(
  hid: string,
  source: DeferredLinkSource,
  inviterHid?: string
): Promise<void> {
  try {
    const now = Date.now();
    const deferredLink: DeferredLink = {
      hid: hid.toUpperCase(),
      inviterHid: inviterHid?.toUpperCase(),
      source,
      timestamp: now,
      expiresAt: now + SEVEN_DAYS_MS,
    };

    await AsyncStorage.setItem(DEFERRED_LINK_KEY, JSON.stringify(deferredLink));

    console.log('[DeferredLink] Saved deferred link:', {
      hid: deferredLink.hid,
      source,
      expiresIn: '7 days',
    });
  } catch (error) {
    console.error('[DeferredLink] Failed to save deferred link:', error);
    throw error;
  }
}

/**
 * Retrieves and clears a deferred deep link
 * @returns Deferred link object or null if none exists/expired
 */
export async function consumeDeferredLink(): Promise<DeferredLink | null> {
  try {
    const stored = await AsyncStorage.getItem(DEFERRED_LINK_KEY);

    if (!stored) {
      return null;
    }

    const deferredLink: DeferredLink = JSON.parse(stored);

    // Check expiration
    if (Date.now() > deferredLink.expiresAt) {
      console.log('[DeferredLink] Expired deferred link, ignoring:', {
        hid: deferredLink.hid,
        age: Math.floor((Date.now() - deferredLink.timestamp) / (24 * 60 * 60 * 1000)) + ' days',
      });
      await clearDeferredLink();
      return null;
    }

    // Clear from storage (consume once)
    await clearDeferredLink();

    console.log('[DeferredLink] Consumed deferred link:', {
      hid: deferredLink.hid,
      source: deferredLink.source,
      age: Math.floor((Date.now() - deferredLink.timestamp) / 1000) + ' seconds',
    });

    return deferredLink;
  } catch (error) {
    console.error('[DeferredLink] Failed to consume deferred link:', error);
    return null;
  }
}

/**
 * Clears any stored deferred link
 */
export async function clearDeferredLink(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEFERRED_LINK_KEY);
  } catch (error) {
    console.error('[DeferredLink] Failed to clear deferred link:', error);
  }
}
