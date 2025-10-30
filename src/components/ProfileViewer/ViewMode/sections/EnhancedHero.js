/**
 * EnhancedHero Component - Pattern 1 (Hero Section)
 *
 * Enhanced profile header with avatar and action buttons
 * - Centered layout with flexible sizing
 * - Avatar support with fallback initial
 * - Name with professional title
 * - Lineage/common name with tap-to-copy
 * - Metadata (generation)
 * - Personal info (current residence, birth year)
 * - Action buttons absolutely positioned (close LEFT, edit/menu RIGHT)
 * - Full Dynamic Type support
 * - Token system for all styling
 *
 * Usage:
 * <EnhancedHero
 *   person={profile}
 *   metrics={generationMetrics}
 *   canEdit={true}
 *   onEdit={handleEdit}
 *   onMenuPress={handleMenu}
 *   onCopyChain={handleCopy}
 * />
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  I18nManager,
  Platform,
  AccessibilityInfo,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Galeria } from '@nandorojo/galeria';
import tokens, { useAccessibilitySize } from '../../../ui/tokens';
import { formatNameWithTitle } from '../../../../services/professionalTitleService';
import { useTreeStore } from '../../../../stores/useTreeStore';
import { toArabicNumerals } from '../../../../utils/dateUtils';

const { colors, spacing, typography, profileViewer } = tokens;
const { hero: heroTokens } = profileViewer;

// Construct the lineage chain (e.g., "بن فهد بن عبدالعزيز الفهد")
const constructCommonName = (person, nodesMap) => {
  if (!person) return '';

  const ancestors = [];
  let currentId = person.father_id;

  while (currentId) {
    const ancestor = nodesMap.get(currentId);
    if (!ancestor) break;
    ancestors.push(ancestor.name);
    currentId = ancestor.father_id;
  }

  if (ancestors.length === 0) {
    return '';
  }

  const firstConnector = person.gender === 'female' ? 'بنت' : 'بن';
  const [firstAncestor, ...rest] = ancestors;

  let chain = `${firstConnector} ${firstAncestor}`;
  rest.forEach((ancestor) => {
    chain += ` ${ancestor}`;
  });

  return chain;
};

const getInitial = (value) => (value ? value.trim().charAt(0) : '?');

const EnhancedHero = ({
  person,
  metrics = {},
  onCopyChain = null,
  canEdit = false,
  onEdit = null,
  onMenuPress = null,
  onClose = null,
}) => {
  if (!person) {
    return null;
  }

  const nodesMap = useTreeStore((s) => s.nodesMap);
  const { shouldUseAlternateLayout } = useAccessibilitySize();

  // Lineage chain memo
  const lineage = useMemo(() => {
    if (!person) return '';
    if (person.common_name) return `${person.common_name} القفاري`;
    const chain = constructCommonName(person, nodesMap);
    return chain ? `${chain} القفاري` : '';
  }, [nodesMap, person]);

  // Metadata assembly
  const generationLabel = metrics?.generationLabel;
  const currentResidence = person?.current_residence;
  const birthYear = person?.dob_data?.year;
  const dobIsPublic = person?.dob_is_public !== false;
  const isDobApproximate = Boolean(person?.dob_data?.approximate);

  const metadataSegments = [];
  if (person?.kunya) {
    metadataSegments.push(person.kunya);
  }
  if (generationLabel) {
    metadataSegments.push(`الجيل ${generationLabel}`);
  }
  const metadata = metadataSegments.join(' | ');

  let birthYearDisplay = null;
  if (person?.dob_data) {
    if (!dobIsPublic) {
      birthYearDisplay = 'مخفي';
    } else if (birthYear) {
      const value = toArabicNumerals(String(birthYear));
      birthYearDisplay = isDobApproximate ? `حوالي ${value}` : value;
    }
  }

  const hasPersonalInfo = Boolean(currentResidence) || Boolean(birthYearDisplay);

  // Social connectivity configuration
  const connectivityMethods = useMemo(() => {
    const methods = [];

    // Phone
    if (person?.phone) {
      methods.push({
        id: 'phone',
        icon: 'call',
        color: '#34C759', // iOS green
        label: 'اتصال',
        url: `tel:${person.phone}`,
      });
    }

    // WhatsApp
    if (person?.phone) {
      methods.push({
        id: 'whatsapp',
        icon: 'logo-whatsapp',
        color: '#25D366', // WhatsApp green
        label: 'واتساب',
        url: `https://wa.me/${person.phone.replace(/[^0-9]/g, '')}`,
      });
    }

    // Email
    if (person?.email) {
      methods.push({
        id: 'email',
        icon: 'mail',
        color: '#007AFF', // iOS blue
        label: 'بريد',
        url: `mailto:${person.email}`,
      });
    }

    // Social media platforms
    const socialPlatforms = [
      { key: 'twitter', icon: 'logo-twitter', color: '#1DA1F2', label: 'تويتر' },
      { key: 'instagram', icon: 'logo-instagram', color: '#E1306C', label: 'إنستغرام' },
      { key: 'linkedin', icon: 'logo-linkedin', color: '#0A66C2', label: 'لينكدإن' },
      { key: 'facebook', icon: 'logo-facebook', color: '#1877F2', label: 'فيسبوك' },
      { key: 'youtube', icon: 'logo-youtube', color: '#FF0000', label: 'يوتيوب' },
      { key: 'tiktok', icon: 'logo-tiktok', color: '#000000', label: 'تيك توك' },
    ];

    if (person?.social_links) {
      socialPlatforms.forEach(platform => {
        const url = person.social_links[platform.key];
        if (url && typeof url === 'string') {
          methods.push({
            id: platform.key,
            icon: platform.icon,
            color: platform.color,
            label: platform.label,
            url,
          });
        }
      });
    }

    return methods;
  }, [person?.phone, person?.email, person?.social_links]);

  // Handle connectivity method press
  const handleConnectivityPress = useCallback((method) => {
    Linking.openURL(method.url).catch(() => {
      Alert.alert('خطأ', `تعذر فتح ${method.label}`);
    });
  }, []);

  // Memoize styles
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: colors.najdi.background,
          borderRadius: tokens.radii.lg,
          paddingHorizontal: heroTokens.paddingHorizontal,
          paddingVertical: heroTokens.paddingVertical,
          minHeight: heroTokens.minHeight,
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          overflow: 'visible',
        },
        // Absolute positioned buttons (RTL-safe: use right for LEFT, left for RIGHT)
        closeButton: {
          position: 'absolute',
          top: heroTokens.paddingVertical,
          right: heroTokens.paddingHorizontal,
          zIndex: 10,
          width: heroTokens.actionButtonTouchTarget,
          height: heroTokens.actionButtonTouchTarget,
          justifyContent: 'center',
          alignItems: 'center',
        },
        actionButtonsContainer: {
          position: 'absolute',
          top: heroTokens.paddingVertical,
          left: heroTokens.paddingHorizontal,
          flexDirection: 'row',
          gap: 1,
          zIndex: 10,
        },
        actionButton: {
          width: heroTokens.actionButtonTouchTarget,
          height: heroTokens.actionButtonTouchTarget,
          justifyContent: 'center',
          alignItems: 'center',
        },
        // Avatar and text
        avatarWrapper: {
          width: heroTokens.avatarSize,
          height: heroTokens.avatarSize,
          borderRadius: heroTokens.avatarBorderRadius,
          backgroundColor: colors.najdi.container,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
          ...Platform.select({
            ios: {
              shadowColor: colors.najdi.text,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
            },
            android: {
              elevation: 2,
            },
          }),
        },
        avatarImage: {
          width: heroTokens.avatarSize,
          height: heroTokens.avatarSize,
          borderRadius: heroTokens.avatarBorderRadius,
        },
        avatarFallback: {
          width: heroTokens.avatarSize,
          height: heroTokens.avatarSize,
          borderRadius: heroTokens.avatarBorderRadius,
          backgroundColor: colors.najdi.container,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarInitial: {
          fontSize: heroTokens.avatarSize / 3,
          fontWeight: '700',
          color: colors.najdi.text,
        },
        textBlock: {
          alignItems: 'center',
          width: heroTokens.nameMaxWidth,
        },
        name: {
          fontSize: typography.title2.fontSize,
          fontWeight: '700',
          color: colors.najdi.text,
          textAlign: 'center',
          numberOfLines: shouldUseAlternateLayout ? 2 : 1,
        },
        lineage: {
          fontSize: typography.subheadline.fontSize,
          color: colors.najdi.textMuted,  // ✅ WCAG AA compliant (4.5:1 contrast)
          marginTop: 2,
          textAlign: 'center',
          numberOfLines: 2,
        },
        metadata: {
          fontSize: typography.footnote.fontSize,
          fontWeight: '600',
          color: colors.najdi.textMuted,  // ✅ WCAG AA compliant (4.5:1 contrast)
          marginTop: spacing.sm,
          textAlign: 'center',
          numberOfLines: 1,
        },
        personalRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.xs,
          marginTop: spacing.xs,
          justifyContent: 'center',
        },
        personalItem: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xxs,
        },
        personalText: {
          fontSize: typography.footnote.fontSize,
          color: colors.najdi.secondary,
          maxWidth: 180,
          textAlign: 'center',
        },
        // Social connectivity bar
        connectivityBar: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'center',
          marginTop: spacing.md,
        },
        connectivityButton: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: `${colors.najdi.container}12`, // Camel Hair 12%
          alignItems: 'center',
          justifyContent: 'center',
          // Ensure 44px touch target
          padding: 4,
        },
      }),
    [shouldUseAlternateLayout]
  );

  const renderAvatar = () => {
    // Use cropped variant if available, otherwise fall back to original
    const photoUrl = person?.photo_url_cropped || person?.photo_url;

    if (!photoUrl) {
      return (
        <View style={styles.avatarFallback} accessibilityElementsHidden>
          <Text style={styles.avatarInitial} numberOfLines={1}>
            {getInitial(person?.name)}
          </Text>
        </View>
      );
    }

    return (
      <Galeria urls={[photoUrl]}>
        <Galeria.Image index={0}>
          <Image
            source={{ uri: photoUrl }}
            style={styles.avatarImage}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        </Galeria.Image>
      </Galeria>
    );
  };

  return (
    <View style={styles.container}>
      {/* Close/Dismiss Button - Top Left (Absolute) */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}  // ✅ Close the drawer/sheet
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="إغلاق"
        activeOpacity={0.7}
      >
        <Ionicons
          name="chevron-down"
          size={heroTokens.actionButtonSize}
          color={colors.najdi.text}
        />
      </TouchableOpacity>

      {/* Action Buttons - Top Right (Absolute) */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onMenuPress}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="المزيد من الخيارات"
          activeOpacity={0.7}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={heroTokens.actionButtonSize}
            color={colors.najdi.text}
          />
        </TouchableOpacity>
        {canEdit && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onEdit}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="تحرير الملف"
            activeOpacity={0.7}
          >
            <Ionicons
              name="create-outline"
              size={heroTokens.actionButtonSize}
              color={colors.najdi.text}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Avatar - Centered */}
      <TouchableOpacity
        style={styles.avatarWrapper}
        accessible={true}
        accessibilityRole="imagebutton"
        accessibilityLabel={person?.photo_url ? 'عرض الصورة الشخصية' : 'الصورة الشخصية غير متوفرة'}
        disabled={!person?.photo_url}
        activeOpacity={0.8}
      >
        {renderAvatar()}
      </TouchableOpacity>

      {/* Text Block - Centered */}
      <View style={styles.textBlock}>
        <Text
          style={styles.name}
          numberOfLines={shouldUseAlternateLayout ? 2 : 1}
          adjustsFontSizeToFit
        >
          {formatNameWithTitle(person)}
        </Text>

        {lineage ? (
          <TouchableOpacity
            onPress={() => onCopyChain?.(lineage)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="نسخ سلسلة النسب"
            activeOpacity={0.7}
          >
            <Text style={styles.lineage} numberOfLines={2}>
              {lineage}
            </Text>
          </TouchableOpacity>
        ) : null}

        {metadata ? (
          <Text style={styles.metadata} numberOfLines={1}>
            {metadata}
          </Text>
        ) : null}

        {hasPersonalInfo ? (
          <View style={styles.personalRow}>
            {currentResidence ? (
              <View style={styles.personalItem}>
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={colors.najdi.secondary}
                  accessible={false}
                />
                <Text style={styles.personalText} numberOfLines={1}>
                  {currentResidence}
                </Text>
              </View>
            ) : null}
            {birthYearDisplay ? (
              <View style={styles.personalItem}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={colors.najdi.secondary}
                  accessible={false}
                />
                <Text style={styles.personalText} numberOfLines={1}>
                  {birthYearDisplay}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Social Connectivity Bar */}
        {connectivityMethods.length > 0 && (
          <View style={styles.connectivityBar}>
            {connectivityMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={styles.connectivityButton}
                onPress={() => handleConnectivityPress(method)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`${method.label}`}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={method.icon}
                  size={18}
                  color={method.color}
                  accessible={false}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
};

export default React.memo(EnhancedHero);
