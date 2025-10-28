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

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ProfileQRCode from './ProfileQRCode';
import { shareProfile } from '../../services/profileSharing';
import tokens from '../ui/tokens';
import { getTitleAbbreviation } from '../../services/professionalTitleService';
import { useTreeStore } from '../../stores/useTreeStore';
import { LinearGradient } from 'expo-linear-gradient';

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

// Emblem for watermark
const EMBLEM_IMAGE = require('../../../assets/logo/Alqefari Emblem (Transparent).png');

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
  const [shareLoading, setShareLoading] = useState(false);

  // Share handler (opens iOS native share sheet)
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

  // Access nodesMap from tree store
  const nodesMap = useTreeStore((s) => s.nodesMap);

  // Display first name with professional title (e.g., "د. محمد" or just "محمد")
  const displayName = useMemo(() => {
    const firstName = profile?.name || '';
    const abbrev = getTitleAbbreviation(profile);
    return abbrev ? `${abbrev} ${firstName}` : firstName;
  }, [profile]);

  // Construct lineage chain (strip first name from name_chain)
  const lineage = useMemo(() => {
    try {
      if (!profile) return '';

      // If common_name exists, use it
      if (profile.common_name) return `${profile.common_name} القفاري`;

      // If name_chain exists, strip first name from it
      if (profile.name_chain || profile.fullNameChain) {
        const fullChain = profile.name_chain || profile.fullNameChain;
        const firstName = profile.name || '';

        // Remove first name from chain (e.g., "محمد بن عبدالله القفاري" → "بن عبدالله القفاري")
        // Note: name_chain already includes "القفاري" at the end, don't add it again
        if (fullChain.startsWith(firstName)) {
          const chainWithoutFirstName = fullChain.substring(firstName.length).trim();
          return chainWithoutFirstName || 'القفاري';
        }

        // If first name doesn't match, return full chain as-is
        return fullChain;
      }

      // Fall back to constructing from nodesMap
      return constructCommonName(profile, nodesMap);
    } catch (error) {
      console.error('[ShareProfileSheet] Lineage construction failed:', error);
      return 'القفاري';
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      transparent={false}
    >
      <SafeAreaView style={styles.modalContainer}>
        {/* Subtle Background Gradient */}
        <LinearGradient
          colors={['#F9F7F3', '#F5F2EA']}
          style={styles.backgroundGradient}
        />

        {/* Emblem Watermark - Subtle branding */}
        <Image
          source={EMBLEM_IMAGE}
          style={styles.emblemWatermark}
          resizeMode="contain"
        />

        {/* Close Button */}
        <View style={styles.closeButtonContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={28} color={COLORS.saduNight} />
          </TouchableOpacity>
        </View>

        <View style={styles.container}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {/* First name with optional professional title */}
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
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

        {/* Share Button (iOS native style) */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.7}
            disabled={shareLoading}
          >
            {shareLoading ? (
              <ActivityIndicator size="small" color={COLORS.surface} />
            ) : (
              <>
                <Ionicons
                  name="share-outline"
                  size={22}
                  color={COLORS.surface}
                  style={styles.buttonIcon}
                />
                <Text style={styles.shareButtonText}>
                  مشاركة
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },

  // Profile Header Section
  profileHeader: {
    alignItems: 'center',
    marginTop: SPACING.xxxl,
    marginBottom: 48,
    paddingHorizontal: SPACING.xl,
  },
  name: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.saduNight,
    textAlign: 'center',
    maxWidth: '90%',
    marginBottom: SPACING.xs,
    letterSpacing: 0.37,
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
    color: COLORS.desertOchre,
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
    marginTop: SPACING.lg,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    backgroundColor: COLORS.najdiCrimson,
    borderRadius: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonIcon: {
    marginEnd: SPACING.sm,
  },
  shareButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.surface,
    letterSpacing: -0.41,
  },

  // Background Gradient
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: -1,
  },

  // Emblem Watermark
  emblemWatermark: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    width: 120,
    height: 120,
    opacity: 0.04,
    tintColor: COLORS.saduNight,
    zIndex: 0,
  },
});
