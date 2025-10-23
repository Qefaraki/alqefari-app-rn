import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import tokens from './tokens';

/**
 * Pinterest-inspired TabBar component with animated underline indicator
 *
 * Replaces native tabs with minimal, modern design that matches Najdi Sadu
 * aesthetic. Features smooth spring animations and full RTL support.
 *
 * @component
 * @example
 * const tabs = [
 *   { id: 'pending', label: 'قيد المراجعة' },
 *   { id: 'approved', label: 'مقبولة' },
 *   { id: 'rejected', label: 'مرفوضة' },
 * ];
 *
 * <TabBar
 *   tabs={tabs}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 * />
 */
const TabBar = ({
  tabs,
  activeTab,
  onTabChange,
  style,
  indicatorColor = tokens.colors.najdi.primary,
  showDivider = true,
}) => {
  const [tabLayouts, setTabLayouts] = useState({});
  const indicatorPosition = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;

  // Animate indicator when activeTab changes
  useEffect(() => {
    const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
    const layout = tabLayouts[activeIndex];

    if (layout) {
      Animated.parallel([
        // Animate horizontal position with spring for natural iOS feel
        Animated.spring(indicatorPosition, {
          toValue: layout.x,
          useNativeDriver: false,
          tension: 120,    // iOS-standard spring tension
          friction: 10,    // Smooth damping
          velocity: 2,     // Initial velocity for snappy feel
        }),
        // Animate width to match active tab label width
        Animated.spring(indicatorWidth, {
          toValue: layout.width,
          useNativeDriver: false,
          tension: 120,
          friction: 10,
        }),
      ]).start();
    }
  }, [activeTab, tabLayouts]);

  const handleTabPress = (tabId) => {
    onTabChange(tabId);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.tabRow}>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => handleTabPress(tab.id)}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setTabLayouts(prev => ({
                  ...prev,
                  [index]: { x, width }
                }));
              }}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Text
                style={[
                  styles.label,
                  isActive && styles.activeLabel,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Animated underline indicator */}
      <Animated.View
        style={[
          styles.indicator,
          {
            backgroundColor: indicatorColor,
            width: indicatorWidth,
            transform: [{ translateX: indicatorPosition }],
          },
        ]}
      />

      {/* Optional hairline divider below tabs */}
      {showDivider && <View style={styles.divider} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    minHeight: tokens.touchTarget.minimum,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
  },
  label: {
    fontSize: tokens.typography.body.fontSize,
    fontWeight: '400',
    fontFamily: 'SF Arabic',
    // Inactive text: 60% opacity (Sadu Night with alpha)
    color: tokens.colors.najdi.text,
    opacity: 0.6,
  },
  activeLabel: {
    // Active text: full opacity, semi-bold weight
    fontWeight: '600',
    opacity: 1,
    color: tokens.colors.najdi.text,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: tokens.colors.najdi.primary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.najdi.text,
    opacity: 0.1,
  },
});

export default TabBar;
