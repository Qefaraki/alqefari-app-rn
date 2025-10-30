/**
 * ShareProfileSheet Component
 *
 * Elevated share experience inspired by top-tier consumer apps.
 * Presents a rich profile hero, polished QR code card, and contextual quick actions.
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

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ProfileQRCode from './ProfileQRCode';
import {
  shareProfile,
  copyProfileLink,
} from '../../services/profileSharing';
import tokens from '../ui/tokens';
import { getTitleAbbreviation } from '../../services/professionalTitleService';
import { useTreeStore } from '../../stores/useTreeStore';
import { generateProfileLink } from '../../utils/deepLinking';
import { isValidSupabasePhotoUrl } from '../../utils/urlValidation';

const COLORS = {
  background: tokens.colors.najdi.background,
  surface: tokens.colors.surface,
  surfaceMuted: 'rgba(255,255,255,0.94)',
  surfaceSubtle: 'rgba(255,255,255,0.8)',
  textPrimary: tokens.colors.najdi.text,
  textSecondary: tokens.colors.najdi.textMuted,
  accent: tokens.colors.najdi.primary,
  accentSoft: tokens.colors.najdi.secondary,
  highlight: tokens.colors.najdi.focus || '#957EB5',
  outline: 'rgba(36,33,33,0.08)',
  success: tokens.colors.success,
};

const SPACING = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

const EMBLEM_IMAGE = require('../../../assets/logo/Alqefari Emblem (Transparent).png');
const HERO_PATTERN_SOURCE = require('../../../assets/sadu_patterns/png/9.png');
const HERO_PATTERN_SEGMENTS = 4;
const constructCommonName = (person, nodesMap) => {
  if (!person) return '';

  if (!nodesMap || !(nodesMap instanceof Map) || nodesMap.size === 0) {
    console.warn('[ShareProfileSheet] Invalid or empty nodesMap, cannot construct lineage for:', person?.id);
    const safeName = person?.name?.trim();
    return safeName ? `${safeName} القفاري` : 'القفاري';
  }

  const ancestors = [];
  const visited = new Set();
  let currentId = person.father_id;
  const MAX_DEPTH = 20;
  let depth = 0;

  while (currentId && depth < MAX_DEPTH) {
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

  const firstConnector = person.gender?.toLowerCase() === 'female' ? 'بنت' : 'بن';
  const [firstAncestor, ...rest] = ancestors;

  let chain = `${firstConnector} ${firstAncestor}`;
  rest.forEach((ancestor) => {
    chain += ` ${ancestor}`;
  });

  return `${chain} القفاري`;
};

const getProfileInitial = (name = '') => {
  const trimmed = name.trim();
  if (!trimmed) return 'الق';

  const segments = trimmed.split(/\s+/);
  const first = segments[0]?.charAt(0) || '';
  const second = segments.slice(1).find((segment) => segment?.charAt(0))?.charAt(0) || '';

  return (first + second).trim() || first || 'الق';
};

export default function ShareProfileSheet({
  visible,
  onClose,
  profile,
  mode = 'share',
  inviterProfile,
}) {
  const [shareLoading, setShareLoading] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const copyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const nodesMap = useTreeStore((s) => s.nodesMap);

  const displayName = useMemo(() => {
    const firstName = profile?.name || '';
    const abbrev = getTitleAbbreviation(profile);
    const baseName = abbrev ? `${abbrev} ${firstName}` : firstName;
    return baseName || 'أحد أفراد القفاري';
  }, [profile]);

  const lineage = useMemo(() => {
    try {
      if (!profile) return '';

      if (profile.common_name) return `${profile.common_name} القفاري`;

      if (profile.name_chain || profile.fullNameChain) {
        const fullChain = profile.name_chain || profile.fullNameChain;
        const firstName = profile.name || '';

        if (fullChain.startsWith(firstName)) {
          const chainWithoutFirstName = fullChain.substring(firstName.length).trim();
          return chainWithoutFirstName || 'القفاري';
        }

        return fullChain;
      }

      return constructCommonName(profile, nodesMap);
    } catch (error) {
      console.error('[ShareProfileSheet] Lineage construction failed:', error);
      return 'القفاري';
    }
  }, [profile, nodesMap]);

  const metadata = useMemo(() => {
    const segments = [];

    if (profile?.kunya) {
      segments.push(profile.kunya);
    }
    if (profile?.generation) {
      const genText = `الجيل ${
        profile.generation === 1 ? 'الأول' :
        profile.generation === 2 ? 'الثاني' :
        profile.generation === 3 ? 'الثالث' :
        profile.generation === 4 ? 'الرابع' :
        profile.generation === 5 ? 'الخامس' :
        `${profile.generation}`
      }`;
      segments.push(genText);
    }

    return segments.join(' • ');
  }, [profile]);

  const profileLink = useMemo(() => {
    if (!profile?.share_code) return '';
    return generateProfileLink(profile.share_code, inviterProfile?.share_code) || '';
  }, [profile?.share_code, inviterProfile?.share_code]);

  const hasValidPhoto = useMemo(() => {
    if (!profile?.photo_url) return false;
    return isValidSupabasePhotoUrl(profile.photo_url);
  }, [profile?.photo_url]);

  const heroInitial = useMemo(() => getProfileInitial(profile?.name), [profile?.name]);

  const handleShare = useCallback(async () => {
    if (!profile) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShareLoading(true);
      await shareProfile(profile, mode, inviterProfile);
      setTimeout(() => {
        if (typeof onClose === 'function') {
          onClose();
        }
      }, 500);
    } catch (error) {
      console.error('[ShareSheet] Share failed:', error);
    } finally {
      setShareLoading(false);
    }
  }, [profile, mode, inviterProfile, onClose]);

  const handleCopyLink = useCallback(async () => {
    if (!profile) return;

    try {
      Haptics.selectionAsync();
      const copied = await copyProfileLink(profile, inviterProfile);

      if (copied) {
        setCopyFeedback('تم النسخ بنجاح');

        if (copyTimerRef.current) {
          clearTimeout(copyTimerRef.current);
        }
        copyTimerRef.current = setTimeout(() => {
          setCopyFeedback('');
        }, 2500);
      }
    } catch (error) {
      console.error('[ShareSheet] Copy link failed:', error);
      setCopyFeedback('');
    }
  }, [profile, inviterProfile]);

  const handleOpenLink = useCallback(async () => {
    if (!profileLink) return;

    try {
      Haptics.selectionAsync();
      await Linking.openURL(profileLink);
    } catch (error) {
      console.error('[ShareSheet] Failed to open link:', error);
      Alert.alert('خطأ', 'تعذر فتح الرابط');
    }
  }, [profileLink]);

  const QuickActionButton = ({
    icon,
    iconColor = COLORS.accent,
    label,
    detail,
    onPress,
    disabled,
    trailing,
  }) => (
    <TouchableOpacity
      style={[
        styles.quickActionButton,
        disabled && styles.quickActionButtonDisabled,
      ]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
    >
      <View
        style={[
          styles.quickActionIcon,
          { backgroundColor: iconColor + '22' },
        ]}
      >
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.quickActionCopy}>
        <Text style={styles.quickActionLabel}>
          {label}
        </Text>
        {detail ? (
          <Text
            style={styles.quickActionDetail}
            numberOfLines={2}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing || (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.textSecondary}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      transparent={false}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.backgroundGradient} />

        <Image
          source={EMBLEM_IMAGE}
          style={styles.emblemWatermark}
          resizeMode="contain"
        />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-down"
              size={26}
              color={COLORS.textPrimary}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            شارك الملف
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroPatternRow}>
              {Array.from({ length: HERO_PATTERN_SEGMENTS }).map((_, index) => (
                <Image
                  key={`hero-pattern-${index}`}
                  source={HERO_PATTERN_SOURCE}
                  style={styles.heroPatternImage}
                  resizeMode="cover"
                  accessible={false}
                />
              ))}
            </View>
            <View style={styles.avatarWrapper}>
              {hasValidPhoto ? (
                <Image
                  source={{ uri: profile.photo_url }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{heroInitial}</Text>
                </View>
              )}
            </View>

            <Text
              style={styles.heroName}
              numberOfLines={1}
            >
              {displayName}
            </Text>

            {lineage ? (
              <Text
                style={styles.heroLineage}
                numberOfLines={2}
              >
                {lineage}
              </Text>
            ) : null}

            {metadata ? (
              <Text
                style={styles.heroMetadata}
                numberOfLines={1}
              >
                {metadata}
              </Text>
            ) : null}

            <View style={styles.qrWrapper}>
              <ProfileQRCode
                shareCode={profile?.share_code}
                profileId={profile?.id}
                inviterShareCode={inviterProfile?.share_code}
                mode={mode}
                emblemSource={EMBLEM_IMAGE}
                size={240}
              />
            </View>

            {profileLink ? (
              <TouchableOpacity
                style={styles.linkChip}
                activeOpacity={0.7}
                onPress={handleOpenLink}
              >
                <Ionicons
                  name="link-outline"
                  size={18}
                  color={COLORS.accent}
                />
                <Text
                  style={styles.linkText}
                  numberOfLines={1}
                >
                  {profileLink.replace(/^https?:\/\//, '')}
                </Text>
                <Ionicons
                  name="open-outline"
                  size={18}
                  color={COLORS.accent}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.quickActionsCard}>
            <View style={styles.quickActionsList}>
              <QuickActionButton
                icon="share-outline"
                label="مشاركة عبر التطبيقات"
                detail="أرسل الرابط لأي منصة."
                onPress={handleShare}
                disabled={!profileLink || shareLoading}
                trailing={
                  shareLoading ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                  ) : null
                }
              />
              <QuickActionButton
                icon="copy-outline"
                label="نسخ الرابط"
                detail={copyFeedback || 'انسخ الرابط فوراً.'}
                onPress={handleCopyLink}
                disabled={!profileLink}
                trailing={
                  copyFeedback ? (
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  ) : null
                }
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
  },
  emblemWatermark: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    width: 160,
    height: 160,
    opacity: 0.05,
    tintColor: COLORS.textPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  heroCard: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 28,
    paddingVertical: SPACING.xl,
    paddingTop: SPACING.xl + 30,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    marginBottom: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  heroPatternRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
    flexDirection: 'row',
  },
  heroPatternImage: {
    flex: 1,
    height: '100%',
    width: undefined,
    opacity: 0.22,
  },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.surface,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceSubtle,
  },
  avatarInitial: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.accent,
  },
  heroName: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  heroLineage: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
    lineHeight: 22,
  },
  heroMetadata: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accentSoft,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  qrWrapper: {
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.xs,
    borderRadius: 18,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surfaceSubtle,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.accent,
    writingDirection: 'ltr',
  },
  quickActionsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  quickActionsList: {
    gap: SPACING.sm,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.surfaceMuted,
    gap: SPACING.md,
  },
  quickActionButtonDisabled: {
    opacity: 0.5,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionCopy: {
    flex: 1,
    gap: 4,
    alignItems: 'flex-start',
  },
  quickActionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'left',
  },
  quickActionDetail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    textAlign: 'left',
  },
});
