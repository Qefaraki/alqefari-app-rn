/**
 * SimpleTreeSkeleton - Loading placeholder for family tree
 *
 * Phase 2 Day 8 - Extracted from TreeView.js (lines 3421-3599)
 *
 * Displays a tree-like skeleton structure while the actual tree data loads.
 * Uses Najdi Sadu color palette with shimmer animation for visual feedback.
 *
 * Structure:
 * - Root node (120x70px) at top center
 * - Generation 2: 4 nodes (70x50px) in horizontal row
 * - Generation 3: 3 branches (2+3+2 nodes, 45x35px each)
 * - Generation 4: 8 small nodes (30x25px, faded)
 * - Connection lines between generations
 *
 * Design:
 * - Background: Al-Jass White (#F9F7F3)
 * - Nodes: Camel Hair Beige with varying opacities (25-40%)
 * - Lines: Camel Hair Beige 25% (#D1BBA325)
 * - Shimmer: Animated opacity from 0.3 to 1.0
 *
 * Animation:
 * - Uses react-native Animated for shimmer effect
 * - Loop: 0.3 → 1.0 → 0.3 (1s each direction)
 * - Applied to node cards for loading feedback
 *
 * KNOWN PATTERNS (AS-IS for Phase 2):
 * - Requires shimmerAnim from parent (Animated.Value)
 * - Uses react-native View/Animated components
 * - Hardcoded dimensions matching actual tree node sizes
 */

import React from 'react';
import { View, Animated as RNAnimated } from 'react-native';

export interface SimpleTreeSkeletonProps {
  // Shimmer animation value from parent
  shimmerAnim: RNAnimated.Value;
}

/**
 * SimpleTreeSkeleton component
 *
 * Renders a tree-like loading placeholder with shimmer animation.
 * Shows 4 generations with realistic tree structure.
 *
 * @param props - Skeleton props
 * @returns Tree skeleton View
 */
export const SimpleTreeSkeleton: React.FC<SimpleTreeSkeletonProps> = ({ shimmerAnim }) => {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#F9F7F3',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
      }}
    >
      {/* Root node at center top */}
      <View style={{ alignItems: 'center', marginTop: -100 }}>
        <RNAnimated.View
          style={{
            width: 120,
            height: 70,
            backgroundColor: '#D1BBA340',
            borderRadius: 10,
            borderWidth: 2,
            borderColor: '#D1BBA330',
            opacity: shimmerAnim,
          }}
        />

        {/* Main vertical line from root */}
        <View
          style={{
            width: 2,
            height: 50,
            backgroundColor: '#D1BBA325',
            marginTop: -2,
          }}
        />
      </View>

      {/* Second generation with horizontal connector */}
      <View style={{ alignItems: 'center', marginTop: -2 }}>
        {/* Horizontal connector line */}
        <View
          style={{
            width: 300,
            height: 2,
            backgroundColor: '#D1BBA325',
            position: 'absolute',
            top: 0,
          }}
        />

        {/* Second gen nodes */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            width: 320,
            marginTop: -1,
          }}
        >
          {[...Array(4)].map((_, i) => (
            <View key={`gen2-wrapper-${i}`} style={{ alignItems: 'center' }}>
              {/* Small vertical line to node */}
              <View
                style={{
                  width: 2,
                  height: 20,
                  backgroundColor: '#D1BBA325',
                }}
              />
              <RNAnimated.View
                style={{
                  width: 70,
                  height: 50,
                  backgroundColor: '#D1BBA335',
                  borderRadius: 8,
                  borderWidth: 1.5,
                  borderColor: '#D1BBA325',
                  opacity: shimmerAnim,
                }}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Third generation with multiple branches */}
      <View style={{ marginTop: 30, width: '100%' }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingHorizontal: 10,
          }}
        >
          {/* Left branch */}
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 100,
                height: 2,
                backgroundColor: '#D1BBA320',
                marginBottom: 10,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[...Array(2)].map((_, i) => (
                <RNAnimated.View
                  key={`gen3-left-${i}`}
                  style={{
                    width: 45,
                    height: 35,
                    backgroundColor: '#D1BBA330',
                    borderRadius: 6,
                    opacity: shimmerAnim.interpolate({
                      inputRange: [0.3, 1],
                      outputRange: [0.3, 0.8],
                    }),
                  }}
                />
              ))}
            </View>
          </View>

          {/* Center branch */}
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 80,
                height: 2,
                backgroundColor: '#D1BBA320',
                marginBottom: 10,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[...Array(3)].map((_, i) => (
                <RNAnimated.View
                  key={`gen3-center-${i}`}
                  style={{
                    width: 45,
                    height: 35,
                    backgroundColor: '#D1BBA330',
                    borderRadius: 6,
                    opacity: shimmerAnim.interpolate({
                      inputRange: [0.3, 1],
                      outputRange: [0.3, 0.8],
                    }),
                  }}
                />
              ))}
            </View>
          </View>

          {/* Right branch */}
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 100,
                height: 2,
                backgroundColor: '#D1BBA320',
                marginBottom: 10,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[...Array(2)].map((_, i) => (
                <RNAnimated.View
                  key={`gen3-right-${i}`}
                  style={{
                    width: 45,
                    height: 35,
                    backgroundColor: '#D1BBA330',
                    borderRadius: 6,
                    opacity: shimmerAnim.interpolate({
                      inputRange: [0.3, 1],
                      outputRange: [0.3, 0.8],
                    }),
                  }}
                />
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* Fourth generation hint (faded) */}
      <View style={{ marginTop: 30, alignItems: 'center', opacity: 0.3 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[...Array(8)].map((_, i) => (
            <View
              key={`gen4-${i}`}
              style={{
                width: 30,
                height: 25,
                backgroundColor: '#D1BBA320',
                borderRadius: 4,
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

// Export constants for testing
export const SKELETON_CONSTANTS = {
  ROOT_WIDTH: 120,
  ROOT_HEIGHT: 70,
  GEN2_WIDTH: 70,
  GEN2_HEIGHT: 50,
  GEN2_COUNT: 4,
  GEN3_WIDTH: 45,
  GEN3_HEIGHT: 35,
  GEN3_LEFT_COUNT: 2,
  GEN3_CENTER_COUNT: 3,
  GEN3_RIGHT_COUNT: 2,
  GEN4_WIDTH: 30,
  GEN4_HEIGHT: 25,
  GEN4_COUNT: 8,
  BACKGROUND_COLOR: '#F9F7F3',
  NODE_COLOR_40: '#D1BBA340',
  NODE_COLOR_35: '#D1BBA335',
  NODE_COLOR_30: '#D1BBA330',
  NODE_COLOR_20: '#D1BBA320',
  LINE_COLOR: '#D1BBA325',
  BORDER_COLOR: '#D1BBA330',
};
