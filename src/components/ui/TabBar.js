import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import tokens from './tokens';

/**
 * Pinterest-inspired TabBar component with static underline indicator
 *
 * Replaces native tabs with minimal, modern design that matches Najdi Sadu
 * aesthetic. Static indicator for better RTL support and simplicity.
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

  // Get active tab layout for static indicator positioning
  const activeIndex = tabs.findIndex(tab => tab.id === activeTab);
  const activeLayout = tabLayouts[activeIndex];

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

      {/* Static underline indicator */}
      {activeLayout && (
        <View
          style={[
            styles.indicator,
            {
              backgroundColor: indicatorColor,
              width: activeLayout.width,
              left: activeLayout.x,
            },
          ]}
        />
      )}

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
    minHeight: 44,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
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
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.najdi.primary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.najdi.text,
    opacity: 0.1,
  },
});

export default TabBar;
