import React from 'react';
import { View, StyleSheet } from 'react-native';
import Shimmer from './Shimmer';
import tokens from '../tokens';

/**
 * HeroSkeleton - Loading skeleton for ProfileViewer Hero section
 * Matches Hero.js structure with photo, name, lineage, and metrics
 */
const HeroSkeleton = ({ withPhoto = true }) => {
  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel="جاري تحميل الملف الشخصي"
      accessibilityRole="progressbar"
    >
      {/* Hero Photo */}
      {withPhoto && (
        <View style={styles.photoWrapper}>
          <Shimmer
            width="100%"
            height={220}
            borderRadius={0}
          />
        </View>
      )}

      <View style={styles.body}>
        {/* Name */}
        <View style={styles.nameRow}>
          <Shimmer
            width="60%"
            height={32}
            borderRadius={tokens.radii.sm}
          />
          {!withPhoto && (
            <View style={styles.actionsPlaceholder}>
              <Shimmer width={40} height={40} borderRadius={20} />
            </View>
          )}
        </View>

        {/* Lineage / Common Name */}
        <View style={styles.chainRow}>
          <Shimmer
            width="75%"
            height={18}
            borderRadius={tokens.radii.sm}
          />
        </View>

        {/* Bio lines (optional) */}
        <View style={styles.bioContainer}>
          <Shimmer
            width="100%"
            height={16}
            borderRadius={tokens.radii.sm}
            style={styles.bioLine}
          />
          <Shimmer
            width="90%"
            height={16}
            borderRadius={tokens.radii.sm}
            style={styles.bioLine}
          />
          <Shimmer
            width="70%"
            height={16}
            borderRadius={tokens.radii.sm}
          />
        </View>

        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          <Shimmer
            width={100}
            height={64}
            borderRadius={tokens.radii.md}
            style={styles.metricPill}
          />
          <Shimmer
            width={100}
            height={64}
            borderRadius={tokens.radii.md}
            style={styles.metricPill}
          />
          <Shimmer
            width={100}
            height={64}
            borderRadius={tokens.radii.md}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: tokens.colors.najdi.background, // #F9F7F3
  },
  photoWrapper: {
    height: 220,
    backgroundColor: tokens.colors.najdi.container + '30',
  },
  body: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionsPlaceholder: {
    marginLeft: 12,
  },
  chainRow: {
    marginBottom: 12,
  },
  bioContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  bioLine: {
    marginBottom: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  metricPill: {
    flex: 1,
    maxWidth: 120,
  },
});

export default HeroSkeleton;
