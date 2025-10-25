/**
 * EnhancedHero Component - Pattern 1 (Hero Section)
 *
 * Enhanced profile header with avatar and action buttons
 * - Centered layout with flexible sizing
 * - Avatar support with fallback initial
 * - Name with professional title
 * - Lineage/common name with tap-to-copy
 * - Metadata (generation, siblings count)
 * - Personal info (birth place, birth year)
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

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  I18nManager,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Galeria } from '@nandorojo/galeria';
import tokens, { useAccessibilitySize } from '../../ui/tokens';
import { formatNameWithTitle } from '../../../services/professionalTitleService';
import { useTreeStore } from '../../../stores/useTreeStore';
import { toArabicNumerals } from '../../../utils/dateUtils';

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
  const siblingsCount = metrics?.siblingsCount ?? person?.siblings_count ?? 0;
  const birthPlace = person?.birth_place;
  const birthYear = person?.dob_data?.year;
  const dobIsPublic = person?.dob_is_public !== false;
  const isDobApproximate = Boolean(person?.dob_data?.approximate);

  const metadataSegments = [];
  if (generationLabel) {
    metadataSegments.push(`الجيل ${generationLabel}`);
  }
  if (siblingsCount > 0) {
    const formatted = toArabicNumerals(String(siblingsCount));
    metadataSegments.push(`${formatted} إخوة`);
  }
  const metadata = metadataSegments.join(' • ');

  let birthYearDisplay = null;
  if (person?.dob_data) {
    if (!dobIsPublic) {
      birthYearDisplay = 'مخفي';
    } else if (birthYear) {
      const value = toArabicNumerals(String(birthYear));
      birthYearDisplay = isDobApproximate ? `حوالي ${value}` : value;
    }
  }

  const hasPersonalInfo = Boolean(birthPlace) || Boolean(birthYearDisplay);

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
        // Absolute positioned buttons (top-left and top-right)
        closeButton: {
          position: 'absolute',
          top: heroTokens.paddingVertical,
          left: heroTokens.paddingHorizontal,
          zIndex: 10,
          width: heroTokens.actionButtonTouchTarget,
          height: heroTokens.actionButtonTouchTarget,
          justifyContent: 'center',
          alignItems: 'center',
        },
        actionButtonsContainer: {
          position: 'absolute',
          top: heroTokens.paddingVertical,
          right: heroTokens.paddingHorizontal,
          flexDirection: 'row',
          gap: heroTokens.headerSpacing,
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
          fontSize: typography.title3.fontSize,
          fontWeight: '700',
          color: colors.najdi.text,
          textAlign: 'center',
          numberOfLines: shouldUseAlternateLayout ? 2 : 1,
        },
        lineage: {
          fontSize: typography.subheadline.fontSize,
          color: `${colors.najdi.text}B3`,
          marginTop: spacing.xs,
          textAlign: 'center',
          numberOfLines: 2,
        },
        metadata: {
          fontSize: typography.footnote.fontSize,
          fontWeight: '600',
          color: `${colors.najdi.text}D9`,
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
      }),
    [shouldUseAlternateLayout]
  );

  const renderAvatar = () => {
    if (!person?.photo_url) {
      return (
        <View style={styles.avatarFallback} accessibilityElementsHidden>
          <Text style={styles.avatarInitial} numberOfLines={1}>
            {getInitial(person?.name)}
          </Text>
        </View>
      );
    }

    return (
      <Galeria urls={[person.photo_url]}>
        <Galeria.Image index={0}>
          <Image
            source={{ uri: person.photo_url }}
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
        onPress={onMenuPress}
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
            {birthPlace ? (
              <View style={styles.personalItem}>
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={colors.najdi.secondary}
                  accessible={false}
                />
                <Text style={styles.personalText} numberOfLines={1}>
                  {birthPlace}
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
      </View>
    </View>
  );
};

export default React.memo(EnhancedHero);
