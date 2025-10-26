import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import tokens from './tokens';

/**
 * Google Maps-style navigation pills under search bar
 * 
 * Provides quick navigation to:
 * 1. Root node (الجذر) 
 * 2. Main Generation 2 branches with descendant counts
 * 
 * Features:
 * - Horizontal scrolling for multiple G2 branches
 * - Visual divider between root and G2 pills
 * - Descendant count badges
 * - Haptic feedback on selection
 * - Full RTL support with Najdi Sadu design
 * 
 * @component
 * @example
 * <NavigationPills 
 *   onNavigate={navigateToNode} 
 *   nodes={treeNodes}
 * />
 */
const NavigationPills = ({ onNavigate, nodes = [], style }) => {
  const insets = useSafeAreaInsets();
  
  // Extract navigation data with memoization
  const navigationData = useMemo(() => {
    if (!nodes || nodes.length === 0) {
      return { rootNode: null, g2Branches: [] };
    }

    // Find root node (generation 1, no father_id)
    const rootNode = nodes.find(n => !n.father_id && n.generation === 1);

    // Find main G2 branches (generation 2 with children, sorted by sibling order)
    const g2Branches = nodes
      .filter(n => n.generation === 2 && (n._hasChildren || hasDescendants(n.id, nodes)))
      .sort((a, b) => (a.sibling_order || 0) - (b.sibling_order || 0))
      .map(node => ({
        id: node.id,
        name: extractFirstName(node.name),
        fullName: node.name,
        descendantCount: calculateDescendantCount(node.id, nodes)
      }));

    return { rootNode, g2Branches };
  }, [nodes]);

  const { rootNode, g2Branches } = navigationData;

  // Don't render if no data available
  if (!rootNode && g2Branches.length === 0) {
    return null;
  }

  const handlePillPress = (nodeId, nodeName) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    console.log('🧭 Navigation pill pressed:', nodeName);
    onNavigate(nodeId);
  };

  return (
    <View style={[styles.container, { top: insets.top + 60 }, style]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {/* Root Node Pill */}
        {rootNode && (
          <TouchableOpacity
            style={[styles.pill, styles.rootPill]}
            onPress={() => handlePillPress(rootNode.id, getRootDisplayName(rootNode))}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`الانتقال إلى ${rootNode.name}`}
          >
            <Text style={[styles.pillText, styles.rootPillText]} numberOfLines={1}>
              {getRootDisplayName(rootNode)}
            </Text>
          </TouchableOpacity>
        )}

        {/* Divider */}
        {rootNode && g2Branches.length > 0 && (
          <View style={styles.divider} />
        )}

        {/* G2 Branch Pills */}
        {g2Branches.map((branch, index) => (
          <TouchableOpacity
            key={branch.id}
            style={[styles.pill, styles.branchPill]}
            onPress={() => handlePillPress(branch.id, branch.name)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`الانتقال إلى فرع ${branch.fullName}`}
          >
            <View style={styles.pillContent}>
              <Text style={[styles.pillText, styles.branchPillText]} numberOfLines={1}>
                {branch.name}
              </Text>
              {branch.descendantCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {branch.descendantCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Helper function to get root node display name
const getRootDisplayName = (rootNode) => {
  if (!rootNode || !rootNode.name) return 'الجذر';
  
  // For root node, extract the main name part before parentheses
  // Example: "سليمان (ابو القفارات)" -> "سليمان"
  const name = rootNode.name.trim();
  const beforeParentheses = name.split('(')[0].trim();
  
  // If no parentheses or name is short, return first name
  if (beforeParentheses === name || beforeParentheses.length <= 10) {
    return extractFirstName(beforeParentheses) || 'الجذر';
  }
  
  return extractFirstName(beforeParentheses) || 'الجذر';
};

// Helper function to extract first name from full Arabic name
const extractFirstName = (fullName) => {
  if (!fullName) return '';
  // Split by space and take the first part
  return fullName.trim().split(' ')[0];
};

// Helper function to check if a node has descendants
const hasDescendants = (nodeId, nodes) => {
  return nodes.some(node => 
    node.father_id === nodeId || 
    node.mother_id === nodeId
  );
};

// Helper function to calculate total descendant count
const calculateDescendantCount = (nodeId, nodes) => {
  const directChildren = nodes.filter(node => 
    node.father_id === nodeId || node.mother_id === nodeId
  );
  
  let totalCount = directChildren.length;
  
  // Recursively count descendants
  directChildren.forEach(child => {
    totalCount += calculateDescendantCount(child.id, nodes);
  });
  
  return totalCount;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 11, // Just below SearchBar's zIndex: 12
    elevation: 11,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 8,
    backgroundColor: `${tokens.colors.najdi.background}95`, // Semi-transparent Al-Jass White
    borderRadius: 20,
    
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    minHeight: 32,
    
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  rootPill: {
    backgroundColor: tokens.colors.najdi.primary,
  },
  branchPill: {
    backgroundColor: tokens.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container,
  },
  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
    textAlign: 'center',
  },
  rootPillText: {
    color: tokens.colors.surface,
  },
  branchPillText: {
    color: tokens.colors.najdi.text,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: tokens.radii.sm,
    backgroundColor: `${tokens.colors.najdi.secondary}20`,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.najdi.secondary,
    fontFamily: 'SF Arabic',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: `${tokens.colors.najdi.textMuted}30`,
    marginHorizontal: 4,
  },
});

export default NavigationPills;