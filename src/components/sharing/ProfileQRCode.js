/**
 * ProfileQRCode Component
 *
 * Generates and displays a QR code for profile sharing.
 * Includes deferred rendering to prevent UI blocking and loading skeleton.
 *
 * Usage:
 * <ProfileQRCode
 *   hid="H12345"
 *   inviterHid="H67890"
 *   mode="share"
 * />
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { generateProfileLink } from '../../utils/deepLinking';
import tokens from '../ui/tokens';

const COLORS = {
  alJassWhite: tokens.colors.najdi.background,  // #F9F7F3
  saduNight: tokens.colors.najdi.text,          // #242121
  najdiCrimson: tokens.colors.najdi.primary,    // #A13333
};

export default function ProfileQRCode({
  hid,
  inviterHid,
  mode = 'share',
  size = 208, // Fits in 240px container with 16px padding
}) {
  const [qrReady, setQrReady] = useState(false);
  const [qrError, setQrError] = useState(false);

  // Generate the profile link
  const profileLink = generateProfileLink(hid, inviterHid);

  // Defer QR generation to next frame to prevent UI blocking
  useEffect(() => {
    if (!hid) {
      setQrError(true);
      return;
    }

    const timer = setTimeout(() => {
      setQrReady(true);
    }, 16); // 16ms = 1 frame at 60fps

    return () => clearTimeout(timer);
  }, [hid]);

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
        backgroundColor="#FFFFFF"           // Background: Pure white
        ecl="M"                             // Error correction level: Medium (15%)
        enableLinearGradient={false}
        quietZone={0}                       // Padding handled by container
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
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
