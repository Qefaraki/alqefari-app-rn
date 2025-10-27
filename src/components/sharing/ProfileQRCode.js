/**
 * ProfileQRCode Component
 *
 * Generates and displays a QR code for profile sharing with smart logo fallback.
 * Includes deferred rendering to prevent UI blocking and loading skeleton.
 *
 * Logo Strategy: Profile photo → Emblem → Plain QR
 *
 * Usage:
 * <ProfileQRCode
 *   hid="H12345"
 *   inviterHid="H67890"
 *   mode="share"
 *   photoUrl="https://..."  // Optional: Profile photo for QR center
 * />
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { generateProfileLink } from '../../utils/deepLinking';
import tokens from '../ui/tokens';

const COLORS = {
  alJassWhite: tokens.colors.najdi.background,  // #F9F7F3
  saduNight: tokens.colors.najdi.text,          // #242121
  najdiCrimson: tokens.colors.najdi.primary,    // #A13333
  surface: tokens.colors.surface,               // #FFFFFF
};

export default function ProfileQRCode({
  hid,
  inviterHid,
  mode = 'share',
  size = 240, // Optimal scanning size - fits iPhone SE (375px) with proper margins
  photoUrl, // Optional: Profile photo URL for QR center logo
}) {
  const [qrReady, setQrReady] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [logoSource, setLogoSource] = useState(null);
  const [logoLoading, setLogoLoading] = useState(true);

  // Generate the profile link
  const profileLink = generateProfileLink(hid, inviterHid);

  // Defer QR generation to next frame to prevent UI blocking
  useEffect(() => {
    if (!hid) {
      setQrError(true);
      return;
    }

    // Validate that link was generated successfully
    if (!profileLink || profileLink.length === 0) {
      console.error('[QRCode] Failed to generate profile link for HID:', hid);
      setQrError(true);
      return;
    }

    const timer = setTimeout(() => {
      setQrReady(true);
    }, 16); // 16ms = 1 frame at 60fps

    return () => clearTimeout(timer);
  }, [hid, profileLink]);

  // Smart logo fallback: profile photo → emblem → none
  useEffect(() => {
    async function loadLogo() {
      setLogoLoading(true);
      setLogoSource(null);

      // Strategy 1: Try profile photo
      if (photoUrl) {
        try {
          console.log('[QRCode] Testing profile photo:', photoUrl);
          await Image.prefetch(photoUrl);
          setLogoSource({ uri: photoUrl });
          console.log('[QRCode] ✅ Using profile photo as logo');
          setLogoLoading(false);
          return;
        } catch (error) {
          console.log('[QRCode] ❌ Profile photo failed, trying emblem:', error);
        }
      }

      // Strategy 2: Fall back to emblem
      try {
        const emblemLogo = require('../../../assets/logo/Alqefari Emblem (Transparent).png');
        setLogoSource(emblemLogo);
        console.log('[QRCode] ✅ Using emblem as logo');
      } catch (error) {
        console.error('[QRCode] ❌ Emblem not found, using plain QR:', error);
        setLogoSource(null);
      }

      setLogoLoading(false);
    }

    loadLogo();
  }, [photoUrl]);

  // Error state
  if (qrError || !hid) {
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
  return (
    <View style={[styles.container, { width: size + 32, height: size + 32 }]}>
      <QRCode
        value={profileLink}
        size={size}
        color={COLORS.saduNight}           // Foreground: Sadu Night
        backgroundColor={COLORS.surface}    // Background: Pure white
        ecl="M"                             // Error correction level: Medium (15%)
        enableLinearGradient={false}
        quietZone={0}                       // Padding handled by container
        logo={logoSource}                   // Smart fallback: photo → emblem → none
        logoSize={logoSource ? size * 0.25 : 0}  // 25% of QR size (60px for 240px QR)
        logoBackgroundColor={COLORS.surface} // White background for logo
        logoMargin={2}                       // Small margin around logo
        logoBorderRadius={logoSource && logoSource.uri ? 30 : 0}  // Rounded for photos, square for emblem
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
