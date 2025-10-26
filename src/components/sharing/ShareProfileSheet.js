/**
 * ShareProfileSheet Component
 *
 * Reusable bottom sheet for sharing profiles via QR code, link copy, and WhatsApp.
 * Supports two modes:
 * - 'share': For existing members (linked or not, alive or deceased)
 * - 'invite': For non-linked, living members (can join app)
 *
 * Usage:
 * <ShareProfileSheet
 *   visible={showShare}
 *   onClose={() => setShowShare(false)}
 *   profile={selectedProfile}
 *   mode="share"
 *   inviterProfile={currentUserProfile}
 * />
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Image,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ProfileQRCode from './ProfileQRCode';
import { shareProfile, copyProfileLink } from '../../services/profileSharing';
import tokens from '../ui/tokens';

const COLORS = {
  alJassWhite: tokens.colors.najdi.background,      // #F9F7F3
  camelHairBeige: tokens.colors.najdi.container,    // #D1BBA3
  saduNight: tokens.colors.najdi.text,              // #242121
  najdiCrimson: tokens.colors.najdi.primary,        // #A13333
  desertOchre: tokens.colors.najdi.secondary,       // #D58C4A
  textMuted: tokens.colors.najdi.textMuted,         // #736372
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export default function ShareProfileSheet({
  visible,
  onClose,
  profile,
  mode = 'share', // 'share' | 'invite'
  inviterProfile,
}) {
  const bottomSheetRef = useRef(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Snap points: compact (42%) and expanded (85%) for accessibility
  const snapPoints = useMemo(() => ['42%', '85%'], []);

  // Control sheet visibility based on visible prop
  useEffect(() => {
    if (visible) {
      // Open sheet when visible becomes true
      bottomSheetRef.current?.snapToIndex(0);
    } else {
      // Close sheet when visible becomes false
      bottomSheetRef.current?.close();
    }
  }, [visible]);

  // Handle sheet changes
  const handleSheetChanges = useCallback((index) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  // Copy link handler
  const handleCopyLink = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const success = await copyProfileLink(profile, inviterProfile);

      if (success) {
        setCopySuccess(true);
        showToast();

        // Reset success state after 2 seconds
        setTimeout(() => setCopySuccess(false), 2000);
      }
    } catch (error) {
      console.error('[ShareSheet] Copy failed:', error);
    }
  }, [profile, inviterProfile]);

  // Share handler
  const handleShare = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShareLoading(true);

      await shareProfile(profile, mode, inviterProfile);

      // Close sheet after successful share
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('[ShareSheet] Share failed:', error);
    } finally {
      setShareLoading(false);
    }
  }, [profile, mode, inviterProfile, onClose]);

  // Toast animation
  const showToast = useCallback(() => {
    Animated.sequence([
      Animated.spring(toastOpacity, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [toastOpacity]);

  // Get display name (fallback chain)
  const displayName = useMemo(() => {
    return profile?.name_chain || profile?.first_name || 'مجهول';
  }, [profile]);

  // Get metadata text (HID + Generation)
  const metadataText = useMemo(() => {
    const parts = [];

    if (profile?.hid) {
      parts.push(profile.hid);
    }

    if (profile?.generation) {
      const genText = `الجيل ${profile.generation === 1 ? 'الأول' :
                                 profile.generation === 2 ? 'الثاني' :
                                 profile.generation === 3 ? 'الثالث' :
                                 profile.generation === 4 ? 'الرابع' :
                                 profile.generation === 5 ? 'الخامس' :
                                 `${profile.generation}`}`;
      parts.push(genText);
    }

    return parts.join(' • ');
  }, [profile]);

  // Button text based on mode
  const shareButtonText = useMemo(() => {
    return mode === 'invite' ? 'إرسال دعوة' : 'مشاركة عبر واتساب';
  }, [mode]);

  if (!visible) {
    return null;
  }

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      onChange={handleSheetChanges}
      enablePanDownToClose
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <View style={styles.container}>
        {/* Profile Header */}
        <View style={styles.header}>
          {/* Profile Photo */}
          <View style={styles.photoContainer}>
            {profile?.photo_url ? (
              <Image
                source={{ uri: profile.photo_url }}
                style={styles.photo}
              />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Text style={styles.photoInitial}>
                  {displayName.charAt(0)}
                </Text>
              </View>
            )}
          </View>

          {/* Name */}
          <Text style={styles.name} numberOfLines={2}>
            {displayName}
          </Text>

          {/* Metadata (HID + Generation) */}
          {metadataText && (
            <Text style={styles.metadata}>{metadataText}</Text>
          )}
        </View>

        {/* QR Code */}
        <View style={styles.qrSection}>
          <ProfileQRCode
            hid={profile?.hid}
            inviterHid={inviterProfile?.hid}
            mode={mode}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          {/* Copy Link Button (Primary) */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCopyLink}
            activeOpacity={0.7}
          >
            <Ionicons
              name="copy-outline"
              size={20}
              color={COLORS.saduNight}
              style={styles.buttonIcon}
            />
            <Text style={styles.primaryButtonText}>
              نسخ الرابط
            </Text>
          </TouchableOpacity>

          {/* Share Button (Secondary) */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleShare}
            activeOpacity={0.7}
            disabled={shareLoading}
          >
            {shareLoading ? (
              <ActivityIndicator size="small" color={COLORS.desertOchre} />
            ) : (
              <>
                <Ionicons
                  name="share-social-outline"
                  size={20}
                  color={COLORS.desertOchre}
                  style={styles.buttonIcon}
                />
                <Text style={styles.secondaryButtonText}>
                  {shareButtonText}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Success Toast */}
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              transform: [
                {
                  translateY: toastOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>تم النسخ ✓</Text>
        </Animated.View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: COLORS.alJassWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  handleIndicator: {
    backgroundColor: COLORS.camelHairBeige,
    width: 48,
    height: 5,
    borderRadius: 999,
    opacity: 0.4,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },

  // Header Section
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  photoContainer: {
    marginBottom: SPACING.md,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: COLORS.camelHairBeige,
  },
  photoPlaceholder: {
    backgroundColor: COLORS.camelHairBeige,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoInitial: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.saduNight,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.saduNight,
    textAlign: 'center',
    maxWidth: '90%',
    marginBottom: SPACING.xs,
  },
  metadata: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // QR Code Section
  qrSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },

  // Action Buttons
  actions: {
    gap: SPACING.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    backgroundColor: COLORS.camelHairBeige,
    borderRadius: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  buttonIcon: {
    marginEnd: SPACING.sm,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.saduNight,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: SPACING.md,
    borderWidth: 1.5,
    borderColor: `${COLORS.camelHairBeige}40`, // 25% opacity
    paddingHorizontal: SPACING.xl,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.desertOchre,
  },

  // Toast
  toast: {
    position: 'absolute',
    bottom: SPACING.xxl,
    alignSelf: 'center',
    backgroundColor: COLORS.najdiCrimson,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
  },
  toastText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
