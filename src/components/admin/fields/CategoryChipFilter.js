import React, { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import tokens from '../../ui/tokens';

/**
 * CategoryChipFilter Component
 *
 * Horizontal scrollable chips for filtering location results by region.
 * Designed for iOS-style minimal aesthetic with Najdi Sadu colors.
 *
 * Features:
 * - Active/inactive chip states (Crimson vs. White)
 * - Count badges for each category
 * - Scroll horizontally for many categories
 * - RTL-friendly (auto-mirrored by React Native)
 * - Smooth transitions between active states
 */
const CategoryChipFilter = ({
  categories,      // Array of { id, label, count, enabled? }
  activeCategory,  // Currently selected category ID
  onCategoryChange, // Callback(categoryId)
  style,          // Additional container styles
}) => {
  const scaleAnims = useRef({}).current;

  const handleCategoryPress = useCallback((categoryId) => {
    // Trigger scale animation
    if (!scaleAnims[categoryId]) {
      scaleAnims[categoryId] = new Animated.Value(1);
    }

    Animated.sequence([
      Animated.timing(scaleAnims[categoryId], {
        toValue: 0.95,
        duration: 100,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnims[categoryId], {
        toValue: 1,
        friction: 5,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();

    onCategoryChange(categoryId);
  }, [onCategoryChange, scaleAnims]);

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((category) => {
          const isActive = activeCategory === category.id;
          const isDisabled = category.enabled === false;

          // Initialize animation value if not exists
          if (!scaleAnims[category.id]) {
            scaleAnims[category.id] = new Animated.Value(1);
          }

          return (
            <Animated.View
              key={category.id}
              style={{
                transform: [{ scale: scaleAnims[category.id] }],
              }}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.chip,
                  isActive ? styles.chipActive : styles.chipInactive,
                  isDisabled && styles.chipDisabled,
                  pressed && !isDisabled && styles.chipPressed,
                ]}
                onPress={() => handleCategoryPress(category.id)}
                disabled={isDisabled}
                android_ripple={
                  isDisabled ? undefined : {
                    color: `${tokens.colors.najdi.primary  }20`,
                    radius: 50,
                  }
                }
              >
                <Text
                  style={[
                    styles.label,
                    isActive ? styles.labelActive : styles.labelInactive,
                    isDisabled && styles.labelDisabled,
                  ]}
                >
                  {category.label}
                </Text>

                {/* Count badge */}
                {category.count !== undefined && (
                  <View
                    style={[
                      styles.countBadge,
                      isActive ? styles.countBadgeActive : styles.countBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.count,
                        isActive ? styles.countActive : styles.countInactive,
                        isDisabled && styles.countDisabled,
                      ]}
                    >
                      {category.count}
                    </Text>
                  </View>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    backgroundColor: tokens.colors.najdi.background,
  },

  scrollContent: {
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
  },

  // ============================================================================
  // Chip States
  // ============================================================================

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xxs,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.full,
    minHeight: tokens.touchTarget.minimum,
    justifyContent: 'center',
  },

  chipActive: {
    backgroundColor: tokens.colors.najdi.primary,
    borderWidth: 0,
    shadowColor: tokens.colors.najdi.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  chipInactive: {
    backgroundColor: tokens.colors.najdi.background,
    borderWidth: 1,
    borderColor: `${tokens.colors.najdi.container  }40`,
  },

  chipDisabled: {
    opacity: 0.5,
  },

  chipPressed: {
    opacity: 0.8,
  },

  // ============================================================================
  // Text Styles
  // ============================================================================

  label: {
    fontSize: 15,
    fontWeight: '500',
  },

  labelActive: {
    color: tokens.colors.najdi.background,
  },

  labelInactive: {
    color: tokens.colors.najdi.text,
  },

  labelDisabled: {
    color: tokens.colors.najdi.textMuted,
  },

  countBadge: {
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.xxs,
    paddingVertical: 2,
  },

  countBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },

  countBadgeInactive: {
    backgroundColor: 'transparent',
  },

  count: {
    fontSize: 13,
    fontWeight: '600',
  },

  countActive: {
    color: tokens.colors.najdi.background,
  },

  countInactive: {
    color: tokens.colors.najdi.textMuted,
  },

  countDisabled: {
    color: `${tokens.colors.najdi.textMuted  }80`,
  },
});

CategoryChipFilter.propTypes = {
  categories: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      count: PropTypes.number,
      enabled: PropTypes.bool,
    })
  ).isRequired,
  activeCategory: PropTypes.string.isRequired,
  onCategoryChange: PropTypes.func.isRequired,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

CategoryChipFilter.defaultProps = {
  style: undefined,
};

export default CategoryChipFilter;
