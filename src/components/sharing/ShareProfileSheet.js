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

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ProfileQRCode from './ProfileQRCode';
import { shareProfile, copyProfileLink } from '../../services/profileSharing';
import tokens from '../ui/tokens';
import { formatNameWithTitle } from '../../services/professionalTitleService';
import { useTreeStore } from '../../stores/useTreeStore';

const COLORS = {
  alJassWhite: tokens.colors.najdi.background,      // #F9F7F3
  camelHairBeige: tokens.colors.najdi.container,    // #D1BBA3
  saduNight: tokens.colors.najdi.text,              // #242121
  najdiCrimson: tokens.colors.najdi.primary,        // #A13333
  desertOchre: tokens.colors.najdi.secondary,       // #D58C4A
  textMuted: tokens.colors.najdi.textMuted,         // #736372
  surface: tokens.colors.surface,                   // #FFFFFF
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

// TODO: Extract constructCommonName to shared utility (duplicated in 4 files)
// See: EnhancedHero.js, CompactHero.js, Hero.js, ShareProfileSheet.js
const constructCommonName = (person, nodesMap) => {
  if (!person) return '';

  // CRITICAL: nodesMap can be undefined during progressive loading (Phase 3B)
  // or invalid due to store initialization timing issues. Always validate before use.
  if (!nodesMap || !(nodesMap instanceof Map) || nodesMap.size === 0) {
    console.warn('[ShareProfileSheet] Invalid or empty nodesMap, cannot construct lineage for:', person?.id);
    const safeName = person?.name?.trim();
    return safeName ? `${safeName} القفاري` : 'القفاري';
  }

  const ancestors = [];
  // Cycle detection prevents infinite loops from data corruption (e.g., profile.father_id = profile.id)
  const visited = new Set();
  let currentId = person.father_id;
  const MAX_DEPTH = 20; // Prevent infinite loops on corrupted data
  let depth = 0;

  while (currentId && depth < MAX_DEPTH) {
    // Check for circular references
    if (visited.has(currentId)) {
      console.error(`[ShareProfileSheet] Circular reference detected in lineage for ${person.id}`);
      break;
    }

    const ancestor = nodesMap.get(currentId);
    if (!ancestor) {
      console.warn(`[ShareProfileSheet] Ancestor ${currentId} missing at depth ${depth}. Possible progressive loading issue.`);
      break;
    }

    visited.add(currentId);
    ancestors.push(ancestor.name);
    currentId = ancestor.father_id;
    depth++;
  }

  if (depth >= MAX_DEPTH) {
    console.warn('[ShareProfileSheet] Lineage chain exceeded max depth for profile:', person?.id);
  }

  if (ancestors.length === 0) return '';

  // Case-insensitive check handles database inconsistencies ("Female" vs "female")
  const firstConnector = person.gender?.toLowerCase() === 'female' ? 'بنت' : 'بن';
  const [firstAncestor, ...rest] = ancestors;

  let chain = `${firstConnector} ${firstAncestor}`;
  rest.forEach((ancestor) => {
    chain += ` ${ancestor}`; // ✅ SPACE ONLY, NO "بن"
  });

  return `${chain} القفاري`;
};

export default function ShareProfileSheet({
  visible,
  onClose,
  profile,
  mode = 'share', // 'share' | 'invite'
  inviterProfile,
}) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

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

  // Access nodesMap from tree store
  const nodesMap = useTreeStore((s) => s.nodesMap);

  // Format name with professional title
  const formattedName = useMemo(() => {
    return formatNameWithTitle(profile);
  }, [profile]);

  // Construct lineage chain
  const lineage = useMemo(() => {
    try {
      if (!profile) return '';
      if (profile.common_name) return `${profile.common_name} القفاري`;
      return constructCommonName(profile, nodesMap);
    } catch (error) {
      console.error('[ShareProfileSheet] Lineage construction failed:', error);
      // Three-tier fallback: full lineage → name+family → family only
      const safeName = profile?.name?.trim();
      return safeName ? `${safeName} القفاري` : 'القفاري';
    }
  }, [profile, nodesMap]);

  // Build metadata (kunya + generation)
  const metadataSegments = [];
  if (profile?.kunya) {
    metadataSegments.push(profile.kunya);
  }
  if (profile?.generation) {
    const genText = `الجيل ${profile.generation === 1 ? 'الأول' :
                             profile.generation === 2 ? 'الثاني' :
                             profile.generation === 3 ? 'الثالث' :
                             profile.generation === 4 ? 'الرابع' :
                             profile.generation === 5 ? 'الخامس' :
                             `${profile.generation}`}`;
    metadataSegments.push(genText);
  }
  const metadata = metadataSegments.join(' | ');

  // Button text based on mode
  const shareButtonText = useMemo(() => {
    return mode === 'invite' ? 'إرسال دعوة' : 'مشاركة عبر واتساب';
  }, [mode]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      transparent={false}
    >
      <SafeAreaView style={styles.modalContainer}>
        {/* Close Button */}
        <View style={styles.closeButtonContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={28} color={COLORS.saduNight} />
          </TouchableOpacity>
        </View>

        <View style={styles.container}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {/* Name with professional title */}
          <Text style={styles.name} numberOfLines={2}>
            {formattedName}
          </Text>

          {/* Lineage chain */}
          {lineage ? (
            <Text style={styles.lineage} numberOfLines={2}>
              {lineage}
            </Text>
          ) : null}

          {/* Metadata (kunya + generation) */}
          {metadata ? (
            <Text style={styles.metadata} numberOfLines={1}>
              {metadata}
            </Text>
          ) : null}
        </View>

        {/* QR Code */}
        <View style={styles.qrSection}>
          <ProfileQRCode
            hid={profile?.hid}
            inviterHid={inviterProfile?.hid}
            mode={mode}
            photoUrl={profile?.photo_url}
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
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.alJassWhite,
  },
  closeButtonContainer: {
    paddingTop: SPACING.sm,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: SPACING.md,
    marginEnd: SPACING.lg,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },

  // Profile Header Section
  profileHeader: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: SPACING.md,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.saduNight,
    textAlign: 'center',
    maxWidth: '90%',
    marginBottom: SPACING.xs,
  },
  lineage: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: '90%',
    marginTop: SPACING.xs,  // 4px (minimum design system unit)
    marginBottom: SPACING.xs,
  },
  metadata: {
    fontSize: 13,
    fontWeight: '600',
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
    gap: SPACING.lg,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    backgroundColor: COLORS.camelHairBeige,
    borderRadius: SPACING.md,  // 12px from local constants (line 52)
    paddingHorizontal: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
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
    backgroundColor: COLORS.surface,
    borderRadius: SPACING.md,  // 12px from local constants (line 52)
    borderWidth: 1.5,
    borderColor: `${COLORS.camelHairBeige}40`,
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
