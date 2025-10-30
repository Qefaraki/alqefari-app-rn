/**
 * ProfileQRCode Component
 *
 * Generates and displays a QR code for profile sharing with smart logo fallback.
 * Includes deferred rendering to prevent UI blocking and loading skeleton.
 *
 * Logo Strategy: Emblem → Profile photo → Minimal placeholder
 *
 * Usage:
 * <ProfileQRCode
 *   shareCode="k7m3x"  // 5-char share code for link generation
 *   profileId="uuid-1234-5678"  // Required: For caching (unique for all profiles)
 *   inviterShareCode="abc12"  // Optional: Inviter's share code
 *   mode="share"
 *   emblemSource={require('...')}  // Optional: Local emblem image (overrides photoUrl)
 *   photoUrl="https://..."  // Optional: Profile photo for QR center
 * />
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { generateProfileLink } from '../../utils/deepLinking';
import { isValidSupabasePhotoUrl } from '../../utils/urlValidation';
import { getCachedLogo, cacheLogo } from '../../utils/qrLogoCache';
import tokens from '../ui/tokens';

const COLORS = {
  alJassWhite: tokens.colors.najdi.background,  // #F9F7F3
  saduNight: tokens.colors.najdi.text,          // #242121
  najdiCrimson: tokens.colors.najdi.primary,    // #A13333
  surface: tokens.colors.surface,               // #FFFFFF
};

export default function ProfileQRCode({
  shareCode, // 5-char share code for link generation
  profileId, // Profile ID for caching (required - unique for all profiles including Munasib)
  inviterShareCode, // Optional: Inviter's share code
  mode = 'share',
  size = 280, // Optimal scanning size - fits iPhone SE (375px) with proper margins
  photoUrl, // Optional: Profile photo URL for QR center logo
  emblemSource, // Optional: Local emblem image source (overrides photoUrl)
}) {
  const [qrReady, setQrReady] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [logoSource, setLogoSource] = useState(null);
  const [logoLoading, setLogoLoading] = useState(true);
  const [cacheChecked, setCacheChecked] = useState(false);
  const [usedCache, setUsedCache] = useState(false);

  // Generate the profile link using share code
  const profileLink = generateProfileLink(shareCode, inviterShareCode);

  // Defer QR generation to next frame to prevent UI blocking
  useEffect(() => {
    if (!shareCode) {
      setQrError(true);
      return;
    }

    // Validate that link was generated successfully
    if (!profileLink || profileLink.length === 0) {
      console.error('[QRCode] Failed to generate profile link for share code:', shareCode);
      setQrError(true);
      return;
    }

    const timer = setTimeout(() => {
      setQrReady(true);
    }, 16); // 16ms = 1 frame at 60fps

    return () => clearTimeout(timer);
  }, [shareCode, profileLink]);

  // Cache check - runs first to avoid async logo loading
  useEffect(() => {
    async function checkCache() {
      try {
        const cached = await getCachedLogo(profileId, photoUrl);
        if (cached) {
          console.log('[QRCode] Logo cache hit');

          // Restore logoSource from cache
          if (cached.logoSource === 'placeholder') {
            setLogoSource(null);
          } else if (cached.logoSource?.uri) {
            setLogoSource(cached.logoSource);
          } else {
            setLogoSource(null);
          }

          setLogoLoading(false);
          setQrReady(true);
          setUsedCache(true);
        }
      } catch (error) {
        console.warn('[QRCode] Cache check failed:', error.message);
        // Proceed to normal loading
      } finally {
        setCacheChecked(true); // Always allow logo loading to proceed
      }
    }

    checkCache();
  }, [profileId, photoUrl]);

  // Smart logo fallback: emblem → profile photo → placeholder
  useEffect(() => {
    // Guards to prevent race condition
    if (usedCache) return; // Skip if cache was used
    if (!cacheChecked) return; // Wait for cache check

    async function loadLogo() {
      setLogoLoading(true);
      setLogoSource(null);

      // Strategy 1: Use emblem if provided (local asset, no validation needed)
      if (emblemSource) {
        try {
          console.log('[QRCode] ✅ Using emblem as logo');
          setLogoSource(emblemSource);
          setLogoLoading(false);
          return;
        } catch (error) {
          console.warn('[QRCode] ❌ Emblem failed, trying profile photo:', error);
        }
      }

      // Strategy 2: Try profile photo (with security validation)
      if (photoUrl) {
        // SECURITY: Only allow HTTPS URLs from Supabase storage
        // This prevents: file:// URIs, data: URIs, external domains, XSS attacks
        if (isValidSupabasePhotoUrl(photoUrl)) {
          try {
            console.log('[QRCode] Testing profile photo:', photoUrl);
            await Image.prefetch(photoUrl);
            setLogoSource({ uri: photoUrl });
            console.log('[QRCode] ✅ Using profile photo as logo');
            setLogoLoading(false);

            // Cache the result (fire-and-forget, don't await)
            cacheLogo(profileId, photoUrl, { uri: photoUrl }, 'photo')
              .catch(err => console.warn('[QRCode] Cache write failed:', err.message));
            return;
          } catch (error) {
            console.log('[QRCode] ❌ Profile photo failed, using placeholder:', error);
          }
        } else {
          console.warn('[QRCode] ❌ Invalid photo URL (not Supabase storage), using placeholder:', photoUrl);
          console.warn('[QRCode] Expected format: https://<project>.supabase.co/storage/v1/object/...');
        }
      }

      // Strategy 3: Fall back to placeholder overlay
      try {
        console.log('[QRCode] ✅ Using placeholder overlay');
        setLogoSource(null);

        // Cache placeholder decision (fire-and-forget)
        cacheLogo(profileId, photoUrl, 'placeholder', 'placeholder')
          .catch(err => console.warn('[QRCode] Cache write failed:', err.message));
      } catch (error) {
        console.error('[QRCode] ❌ Placeholder decision failed, using plain QR:', error);
        setLogoSource(null);

        // Cache 'none' decision (fire-and-forget)
        cacheLogo(profileId, photoUrl, null, 'none')
          .catch(err => console.warn('[QRCode] Cache write failed:', err.message));
      }

      setLogoLoading(false);
    }

    loadLogo();
  }, [emblemSource, photoUrl, cacheChecked, usedCache]);

  // Error state
  if (qrError || !shareCode) {
    return (
      <View style={[styles.container, { width: size + 32, height: size + 32 }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠</Text>
          <Text style={styles.errorMessage}>فشل إنشاء رمز الاستجابة</Text>
        </View>
      </View>
    );
  }

  // Loading state (shimmer skeleton)
  if (!qrReady) {
    return (
      <View style={[styles.container, { width: size + 32, height: size + 32 }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.najdiCrimson} />
        </View>
      </View>
    );
  }

  // QR Code ready
  const isPhotoLogo = Boolean(logoSource && logoSource.uri);
  const isEmblemLogo = Boolean(logoSource && !logoSource.uri && emblemSource);

  // Larger size for emblem, standard size for photos
  const emblemTargetRatio = 0.58; // Target absolute coverage relative to QR size
  const overlaySize = isEmblemLogo ? size * 0.5 : size * 0.26;

  // No border radius for emblem (square), circular for photos
  const overlayRadius = isEmblemLogo ? overlaySize * 0.05 : overlaySize * 0.33;
  const overlayRelative = overlaySize / size || 1;
  const emblemScale = isEmblemLogo
    ? Math.min(1.12, emblemTargetRatio / overlayRelative)
    : 1;

  const placeholderLabel = shareCode ? shareCode.toUpperCase().slice(0, 2) : 'QR';

  return (
    <View style={[styles.container, { width: size + 32, height: size + 32 }]}>
      <QRCode
        value={profileLink}
        size={size}
        color={COLORS.saduNight}           // Foreground: Sadu Night
        backgroundColor={COLORS.surface}    // Background: Pure white
        ecl="H"                             // Error correction level: High (30%) for center overlay
        enableLinearGradient={false}
        quietZone={0}                       // Padding handled by container
      />
      <View
        pointerEvents="none"
        style={[
          styles.centerOverlay,
          {
            width: overlaySize,
            height: overlaySize,
            borderRadius: overlayRadius,
          },
        ]}
      >
        <View style={[styles.centerGloss, { borderRadius: overlayRadius }]}>
          {isEmblemLogo ? (
            <Image
              source={logoSource}
              style={[
                styles.centerEmblem,
                {
                  transform: [{ scale: emblemScale }],
                },
              ]}
              resizeMode="contain"
            />
          ) : isPhotoLogo ? (
            <Image
              source={logoSource}
              style={[
                styles.centerImage,
                {
                  borderRadius: overlayRadius * 0.82,
                },
              ]}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.centerPlaceholder}>
              <Text style={styles.centerPlaceholderLabel}>{placeholderLabel}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 18,
    justifyContent: 'center',
    alignItems: 'center',
    // Layered shadow (iOS-style depth)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  centerGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  centerImage: {
    width: '100%',
    height: '100%',
  },
  centerEmblem: {
    width: '98%',
    height: '98%',
  },
  centerPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  centerPlaceholderLabel: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: COLORS.saduNight,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 32,
  },
  errorMessage: {
    fontSize: 13,
    color: COLORS.saduNight,
    textAlign: 'center',
  },
});
