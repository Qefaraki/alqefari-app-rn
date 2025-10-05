import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import tokens from '../../../ui/tokens';

const InfoCard = ({ title, children, hint, collapsible = false, expanded = true, onToggle }) => {
  const handleToggle = () => {
    // Haptic feedback for native iOS feel
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle?.();
  };

  // Collapsed state
  if (collapsible && !expanded) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>{title}</Text>
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={handleToggle}
            style={styles.expandButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-down"
              size={20}
              color={tokens.colors.najdi.primary}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Expanded state
  return (
    <View style={styles.container}>
      {/* Header with optional collapse */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
        {collapsible && (
          <TouchableOpacity
            onPress={handleToggle}
            style={styles.expandButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-up"
              size={20}
              color={tokens.colors.najdi.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Divider (subtle, iOS-style) */}
      <View style={styles.divider} />

      {/* Content area */}
      <View style={styles.body}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: tokens.colors.najdi.background, // Al-Jass White
    borderRadius: tokens.radii.md, // 12px
    paddingHorizontal: tokens.spacing.md, // 16px
    paddingTop: tokens.spacing.md, // 16px
    paddingBottom: tokens.spacing.lg, // 20px
    marginBottom: tokens.spacing.md, // 16px

    // iOS-style elevation
    ...tokens.shadow.ios,

    // Subtle Najdi border
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container + '40', // Camel Hair 40%
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.sm, // 12px
    gap: tokens.spacing.sm,
  },

  headerTextContainer: {
    flex: 1,
    gap: tokens.spacing.xxs, // 4px
  },

  title: {
    fontSize: 17, // iOS body
    fontWeight: '600',
    color: tokens.colors.najdi.text, // Sadu Night
    lineHeight: 22,
  },

  hint: {
    fontSize: 13, // iOS caption1
    fontWeight: '400',
    color: tokens.colors.najdi.textMuted,
    lineHeight: 18,
  },

  divider: {
    height: 1,
    backgroundColor: tokens.colors.najdi.container + '20', // Very subtle
    marginVertical: tokens.spacing.sm, // 12px
  },

  body: {
    gap: tokens.spacing.sm, // 12px between children
  },

  expandButton: {
    width: tokens.touchTarget.minimum, // 44px
    height: tokens.touchTarget.minimum,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -tokens.spacing.xs, // Optical alignment
  },
});

export default InfoCard;
