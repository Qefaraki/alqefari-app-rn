import React from 'react';
import { View, StyleSheet } from 'react-native';
import Shimmer from './Shimmer';
import tokens from '../tokens';

/**
 * FamilyCardSkeleton - Loading skeleton for FamilyCard
 * Matches InfoCard wrapper with horizontal family tiles
 */
const FamilyCardSkeleton = ({ tileCount = 4 }) => {
  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel="جاري تحميل بطاقة العائلة"
      accessibilityRole="progressbar"
    >
      {/* Title */}
      <Shimmer
        width={80}
        height={22}
        borderRadius={tokens.radii.sm}
        style={styles.title}
      />

      {/* Divider */}
      <View style={styles.divider} />

      {/* Horizontal row of family tiles */}
      <View style={styles.familyRow}>
        {Array.from({ length: tileCount }).map((_, index) => (
          <View key={`tile-skeleton-${index}`} style={styles.tile}>
            {/* Avatar circle */}
            <Shimmer
              width={40}
              height={40}
              borderRadius={20}
              style={styles.avatar}
            />
            {/* Name */}
            <Shimmer
              width={70}
              height={16}
              borderRadius={tokens.radii.sm}
              style={styles.tileName}
            />
            {/* Label (optional, alternating) */}
            {index % 3 === 0 && (
              <Shimmer
                width={50}
                height={14}
                borderRadius={tokens.radii.sm}
              />
            )}
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
  familyRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 12,
  },
  tile: {
    alignItems: 'center',
    gap: 8,
    width: 80,
  },
  avatar: {
    marginBottom: 4,
  },
  tileName: {
    marginBottom: 4,
  },
});

export default FamilyCardSkeleton;
