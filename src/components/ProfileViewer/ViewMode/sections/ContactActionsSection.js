/**
 * ContactActionsSection Component - Pattern 5 (Action Cards)
 *
 * Quick-action card grid for phone and email
 * - Two-column layout (call / email)
 * - Large touch targets (44px minimum)
 * - Camel Hair Beige card backgrounds
 * - Najdi Crimson icons
 * - Tap-to-call and tap-to-email integration
 * - Token system for styling
 *
 * Usage:
 * <ContactActionsSection
 *   phone="+966501234567"
 *   email="user@example.com"
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
import tokens, { useAccessibilitySize } from '../../../ui/tokens';

const { colors, spacing, profileViewer } = tokens;
const { contactActions } = profileViewer;

const ContactActionsSection = ({ phone = null, email = null }) => {
  const { shouldUseAlternateLayout } = useAccessibilitySize();

  // Guard: if no contact info, don't render
  if (!phone && !email) {
    return null;
  }

  const handleCall = useCallback(() => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('خطأ', 'تعذر فتح تطبيق الهاتف');
    });
  }, [phone]);

  const handleEmail = useCallback(() => {
    if (!email) return;
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert('خطأ', 'تعذر فتح تطبيق البريد');
    });
  }, [email]);

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
          gap: contactActions.cardGap,
          justifyContent: 'space-between',
        },
        // Handle flexible 1 or 2 column layout
        actionCardContainer: {
          flex: 1,
          minHeight: contactActions.cardHeight,
        },
        actionCard: {
          flex: 1,
          backgroundColor: colors.najdi.container,
          borderRadius: tokens.radii.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: contactActions.cardHeight,
        },
        actionCardDisabled: {
          opacity: 0.5,
        },
        iconContainer: {
          marginBottom: spacing.xs,
        },
        icon: {
          color: colors.najdi.primary,  // Najdi Crimson
        },
        label: {
          fontSize: contactActions.labelFontSize,
          fontWeight: contactActions.labelFontWeight,
          color: colors.najdi.text,
          textAlign: 'center',
          marginBottom: 4,
        },
        value: {
          fontSize: contactActions.valueFontSize,
          fontWeight: contactActions.valueFontWeight,
          color: colors.najdi.textMuted,
          textAlign: 'center',
          numberOfLines: 1,
        },
        valueAccessibility: {
          fontSize: tokens.typography.callout.fontSize,
        },
      }),
    [shouldUseAlternateLayout]
  );

  return (
    <View style={styles.container}>
      <View style={styles.gridContainer}>
        {/* Phone/Call Card */}
        {phone && (
          <View style={styles.actionCardContainer}>
            <TouchableOpacity
              style={[styles.actionCard]}
              onPress={handleCall}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`اتصال برقم ${phone}`}
            >
              <View style={styles.iconContainer}>
                <Ionicons
                  name="call-outline"
                  size={contactActions.iconSize}
                  style={styles.icon}
                  accessible={false}
                />
              </View>
              <Text style={styles.label}>اتصال</Text>
              <Text
                style={[
                  styles.value,
                  shouldUseAlternateLayout && styles.valueAccessibility,
                ]}
                numberOfLines={1}
              >
                {phone}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Email Card */}
        {email && (
          <View style={styles.actionCardContainer}>
            <TouchableOpacity
              style={[styles.actionCard]}
              onPress={handleEmail}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`إرسال بريد إلى ${email}`}
            >
              <View style={styles.iconContainer}>
                <Ionicons
                  name="mail-outline"
                  size={contactActions.iconSize}
                  style={styles.icon}
                  accessible={false}
                />
              </View>
              <Text style={styles.label}>بريد</Text>
              <Text
                style={[
                  styles.value,
                  shouldUseAlternateLayout && styles.valueAccessibility,
                ]}
                numberOfLines={1}
              >
                {email}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

export default React.memo(ContactActionsSection, (prevProps, nextProps) => {
  return prevProps.phone === nextProps.phone && prevProps.email === nextProps.email;
});
