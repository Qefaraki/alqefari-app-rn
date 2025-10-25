/**
 * BioSection Component - Pattern 2 (Bio with Expand)
 *
 * Wikipedia-style biography with character limit and expand button
 * - 1000 character max (for rich biographical storytelling)
 * - Shows 150 character preview with "Read More" button
 * - Full text display when expanded
 * - Dynamic Type support for all text sizes
 * - Token system for styling
 *
 * Usage:
 * <BioSection
 *   bio="This is a long biography..."
 *   onBioPress={() => openBioEditor()}
 * />
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import tokens, { useAccessibilitySize } from '../../ui/tokens';

const { colors, spacing, typography, profileViewer } = tokens;
const { bio: bioTokens } = profileViewer;

const BioSection = ({ bio = '', onBioPress = null }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { shouldUseAlternateLayout } = useAccessibilitySize();

  // Reset expansion state when bio changes (user navigates to different profile)
  React.useEffect(() => {
    setIsExpanded(false);
  }, [bio]);

  // Determine if bio should be truncated
  const shouldTruncate = bio && bio.length > bioTokens.previewChars && !isExpanded;
  const displayedBio = shouldTruncate
    ? bio.substring(0, bioTokens.previewChars) + '…'
    : bio;

  // Memoize styles
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingHorizontal: bioTokens.containerPadding,
          paddingVertical: bioTokens.containerMarginVertical,
          marginVertical: bioTokens.containerMarginVertical,
        },
        bioText: {
          fontSize: typography.body.fontSize,
          fontWeight: '400',
          lineHeight: 22,
          color: colors.najdi.text,
          marginBottom: bio && (shouldTruncate || isExpanded) ? spacing.sm : 0,
          // Support unlimited line wrapping
          numberOfLines: 0,
        },
        bioAccessibilityText: {
          // In accessibility mode, ensure readability
          fontSize: typography.callout.fontSize,
          lineHeight: 21,
        },
        expandButton: {
          minHeight: bioTokens.expandButtonHeight,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        },
        expandButtonText: {
          fontSize: bioTokens.expandButtonFontSize,
          fontWeight: bioTokens.expandButtonFontWeight,
          color: colors.najdi.primary,
        },
        emptyState: {
          paddingVertical: spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        emptyStateText: {
          fontSize: typography.footnote.fontSize,
          fontWeight: '400',
          color: colors.najdi.textMuted,
        },
      }),
    [shouldTruncate, isExpanded, bio]
  );

  // Guard: if no bio, don't render
  if (!bio) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Bio text with unlimited wrapping */}
      <Text
        style={[
          styles.bioText,
          shouldUseAlternateLayout && styles.bioAccessibilityText,
        ]}
        numberOfLines={0}  // Unlimited wrapping
        selectable={true}  // Allow selection for copying
        accessibilityLabel={`السيرة الذاتية: ${displayedBio}`}
      >
        {displayedBio}
      </Text>

      {/* Expand/Collapse button (shown only if text is truncated or expanded) */}
      {shouldTruncate || isExpanded ? (
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setIsExpanded(!isExpanded)}
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? 'إخفاء السيرة الذاتية' : 'عرض السيرة الذاتية كاملة'}
          accessibilityHint={isExpanded ? 'سيتم إخفاء بقية النص' : 'سيتم عرض السيرة الذاتية كاملة'}
        >
          <Text style={styles.expandButtonText}>
            {isExpanded ? 'اقرأ أقل' : 'اقرأ أكثر'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default React.memo(BioSection);
