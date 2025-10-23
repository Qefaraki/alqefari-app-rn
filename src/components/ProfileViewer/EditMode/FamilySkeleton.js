/**
 * FamilySkeleton Component
 *
 * Skeleton loading states for TabFamily.js.
 * Provides visual feedback during data loading to improve perceived performance.
 *
 * Features:
 * - Matches actual component layout structure
 * - Shimmer animation via base Skeleton component
 * - ParentSkeleton, SpouseSkeleton, ChildSkeleton sub-components
 * - SectionCardSkeleton wrapper for consistent sections
 *
 * @module FamilySkeleton
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Skeleton from '../../ui/Skeleton';
import tokens from '../../ui/tokens';

/**
 * SectionCardSkeleton - Skeleton wrapper for section cards
 * Matches SectionCard layout from FamilyHelpers.js
 */
const SectionCardSkeleton = ({ children }) => (
  <View style={styles.sectionCard}>
    {/* Section Header Skeleton */}
    <View style={styles.sectionHeader}>
      <Skeleton width={40} height={40} borderRadius={12} style={styles.sectionIcon} />
      <View style={styles.sectionTitleContainer}>
        <Skeleton width={120} height={20} borderRadius={8} />
      </View>
      <Skeleton width={40} height={28} borderRadius={12} />
    </View>

    {/* Section Body */}
    <View style={styles.sectionBody}>{children}</View>
  </View>
);

/**
 * ParentSkeleton - Skeleton for parent profile card
 * Matches ParentProfileCard layout from FamilyHelpers.js
 */
const ParentSkeleton = () => (
  <View style={styles.parentCard}>
    <View style={styles.parentHeader}>
      {/* Avatar */}
      <Skeleton width={56} height={56} borderRadius={28} />
      {/* Details */}
      <View style={styles.parentDetails}>
        <Skeleton width={60} height={13} borderRadius={6} style={{ marginBottom: 6 }} />
        <Skeleton width="80%" height={17} borderRadius={8} />
      </View>
    </View>
  </View>
);

/**
 * SpouseSkeleton - Skeleton for spouse/marriage card
 * Matches SpouseRow layout
 */
const SpouseSkeleton = () => (
  <View style={styles.memberCard}>
    <View style={styles.memberHeader}>
      {/* Avatar */}
      <Skeleton width={52} height={52} borderRadius={26} />
      {/* Details */}
      <View style={styles.memberDetails}>
        <View style={styles.memberTitleRow}>
          <Skeleton width="70%" height={17} borderRadius={8} />
          <Skeleton width={20} height={20} borderRadius={10} />
        </View>
        <Skeleton width="50%" height={13} borderRadius={6} style={{ marginTop: 4 }} />
      </View>
    </View>
  </View>
);

/**
 * ChildSkeleton - Skeleton for child profile card
 * Matches ChildRow layout
 */
const ChildSkeleton = () => (
  <View style={styles.memberCard}>
    <View style={styles.memberHeader}>
      {/* Avatar */}
      <Skeleton width={52} height={52} borderRadius={26} />
      {/* Details */}
      <View style={styles.memberDetails}>
        <View style={styles.memberTitleRow}>
          <Skeleton width="65%" height={17} borderRadius={8} />
          <Skeleton width={20} height={20} borderRadius={10} />
        </View>
        <Skeleton width="40%" height={13} borderRadius={6} style={{ marginTop: 4 }} />
      </View>
    </View>
  </View>
);

/**
 * FamilySkeleton - Complete skeleton loading state for TabFamily
 * Shows structure of parents, spouses, and children sections while data loads
 */
const FamilySkeleton = () => {
  return (
    <View style={styles.container}>
      {/* Parents Section */}
      <SectionCardSkeleton>
        <View style={styles.parentGrid}>
          <ParentSkeleton />
          <ParentSkeleton />
        </View>
      </SectionCardSkeleton>

      {/* Spouses Section */}
      <SectionCardSkeleton>
        <View style={styles.sectionStack}>
          <SpouseSkeleton />
          <SpouseSkeleton />
        </View>
        {/* Footer skeleton (Add Spouse button area) */}
        <View style={styles.sectionFooter}>
          <Skeleton width="100%" height={44} borderRadius={16} />
        </View>
      </SectionCardSkeleton>

      {/* Children Section */}
      <SectionCardSkeleton>
        <View style={styles.sectionStack}>
          <ChildSkeleton />
          <ChildSkeleton />
          <ChildSkeleton />
        </View>
        {/* Footer skeleton (Add Child button area) */}
        <View style={styles.sectionFooter}>
          <Skeleton width="100%" height={44} borderRadius={16} />
        </View>
      </SectionCardSkeleton>
    </View>
  );
};

/**
 * Styles matching TabFamily.js and FamilyHelpers.js layouts
 * Uses same spacing, radii, and structure for seamless transition
 */
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xxl,
  },

  // Section Card Skeleton
  sectionCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: tokens.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: `${tokens.colors.najdi.border}40`,
  },
  sectionIcon: {
    marginLeft: 12,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionBody: {
    padding: 20,
  },
  sectionFooter: {
    padding: 20,
    paddingTop: 0,
  },
  sectionStack: {
    gap: tokens.spacing.sm,
  },

  // Parent Card Skeleton
  parentGrid: {
    flexDirection: 'column',
    gap: tokens.spacing.sm,
  },
  parentCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: tokens.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  parentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  parentDetails: {
    flex: 1,
  },

  // Member Card Skeleton (Spouse/Child)
  memberCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${tokens.colors.najdi.container  }33`,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  memberDetails: {
    flex: 1,
    gap: tokens.spacing.xxs,
  },
  memberTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.xs,
  },
});

// Export individual skeleton components for flexibility
export { ParentSkeleton, SpouseSkeleton, ChildSkeleton, SectionCardSkeleton };

// Export main component as default
export default FamilySkeleton;
