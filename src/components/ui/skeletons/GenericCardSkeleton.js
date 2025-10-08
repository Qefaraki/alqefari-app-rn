import React from 'react';
import { View, StyleSheet } from 'react-native';
import Shimmer from './Shimmer';
import tokens from '../tokens';

/**
 * GenericCardSkeleton - Reusable loading skeleton for InfoCard-based components
 * Used for PersonalCard, DatesCard, ProfessionalCard, ContactCard, etc.
 */
const GenericCardSkeleton = ({ rows = 3, titleWidth = 100 }) => {
  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel="جاري تحميل البطاقة"
      accessibilityRole="progressbar"
    >
      {/* Title */}
      <Shimmer
        width={titleWidth}
        height={22}
        borderRadius={tokens.radii.sm}
        style={styles.title}
      />

      {/* Divider */}
      <View style={styles.divider} />

      {/* Field rows */}
      <View style={styles.body}>
        {Array.from({ length: rows }).map((_, index) => (
          <View key={`row-skeleton-${index}`} style={styles.row}>
            {/* Field label */}
            <Shimmer
              width={80 + (index * 10)}
              height={17}
              borderRadius={tokens.radii.sm}
            />
            {/* Field value (wider) */}
            <Shimmer
              width="100%"
              height={17}
              borderRadius={tokens.radii.sm}
              style={styles.value}
            />
          </View>
        ))}
      </View>
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
  title: {
    marginBottom: tokens.spacing.sm, // 12px
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.najdi.container + '20',
    marginVertical: tokens.spacing.sm, // 12px
  },
  body: {
    gap: tokens.spacing.md, // 16px between rows
  },
  row: {
    gap: tokens.spacing.xs, // 8px between label and value
  },
  value: {
    marginTop: 4,
  },
});

export default GenericCardSkeleton;
