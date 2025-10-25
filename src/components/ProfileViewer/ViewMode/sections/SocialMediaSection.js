/**
 * SocialMediaSection Component - Pattern 3 Variant (Social Media Icons)
 *
 * Displays social media links in a grid layout with icons and labels
 * - Icon + label grid layout
 * - Touch targets exceed 44px minimum
 * - Flexible grid sizing
 * - Dynamic Type support for labels
 * - Token system for styling
 *
 * Usage:
 * <SocialMediaSection
 *   socialLinks={{
 *     twitter: 'https://twitter.com/username',
 *     instagram: 'https://instagram.com/username',
 *   }}
 * />
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tokens, { useAccessibilitySize } from '../../ui/tokens';

const { colors, spacing, typography, profileViewer } = tokens;
const { social: socialTokens } = profileViewer;

// Social media platform configurations
const SOCIAL_PLATFORMS = {
  twitter: {
    label: 'تويتر',
    icon: 'logo-twitter',
    color: '#1DA1F2',
  },
  instagram: {
    label: 'إنستغرام',
    icon: 'logo-instagram',
    color: '#E1306C',
  },
  facebook: {
    label: 'فيسبوك',
    icon: 'logo-facebook',
    color: '#1877F2',
  },
  linkedin: {
    label: 'لينكدإن',
    icon: 'logo-linkedin',
    color: '#0A66C2',
  },
  youtube: {
    label: 'يوتيوب',
    icon: 'logo-youtube',
    color: '#FF0000',
  },
  tiktok: {
    label: 'تيك توك',
    icon: 'logo-tiktok',
    color: '#000000',
  },
};

const SocialMediaSection = ({ socialLinks = {} }) => {
  const { shouldUseAlternateLayout } = useAccessibilitySize();

  // Filter available social links
  const availableLinks = useMemo(() => {
    return Object.entries(socialLinks)
      .filter(([, url]) => url && typeof url === 'string')
      .map(([platform, url]) => ({
        platform,
        url,
        ...SOCIAL_PLATFORMS[platform],
      }))
      .filter((link) => SOCIAL_PLATFORMS[link.platform]); // Only include known platforms
  }, [socialLinks]);

  // Guard: if no social links, don't render
  if (availableLinks.length === 0) {
    return null;
  }

  const handleSocialPress = useCallback(
    (platform, url) => {
      Linking.openURL(url).catch(() => {
        Alert.alert(
          'خطأ',
          `تعذر فتح ${SOCIAL_PLATFORMS[platform]?.label || platform}`
        );
      });
    },
    []
  );

  // Memoize styles
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          marginVertical: spacing.sm,
        },
        gridContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: socialTokens.gridGap,
          justifyContent: 'flex-start',
        },
        socialItem: {
          minWidth: socialTokens.gridItemMinWidth,
          alignItems: 'center',
          justifyContent: 'center',
        },
        iconButton: {
          width: 44,  // Touch target
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.03)',
          marginBottom: spacing.xs,
        },
        label: {
          fontSize: socialTokens.labelFontSize,
          fontWeight: socialTokens.labelFontWeight,
          color: colors.najdi.text,
          textAlign: 'center',
          numberOfLines: 1,
        },
        labelAccessibility: {
          // Slightly smaller for accessibility mode
          fontSize: typography.caption1.fontSize,
        },
      }),
    [shouldUseAlternateLayout]
  );

  return (
    <View style={styles.container}>
      <View style={styles.gridContainer}>
        {availableLinks.map((link) => (
          <View key={link.platform} style={styles.socialItem}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => handleSocialPress(link.platform, link.url)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`فتح ${link.label}`}
              activeOpacity={0.7}
            >
              <Ionicons
                name={link.icon}
                size={socialTokens.iconSize}
                color={link.color}
              />
            </TouchableOpacity>
            <Text
              style={[
                styles.label,
                shouldUseAlternateLayout && styles.labelAccessibility,
              ]}
              numberOfLines={1}
            >
              {link.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default React.memo(SocialMediaSection);
