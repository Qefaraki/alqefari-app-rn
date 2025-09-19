import React, { useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from "react-native";
import Svg, { Line, Rect, Circle } from "react-native-svg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * Dynamic tree skeleton that matches actual tree structure
 * Can progressively enhance from generic to structure-based
 */
const TreeSkeletonDynamic = ({ structure }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Shimmer animation
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false, // We need to animate opacity
        }),
      ]),
    );
    shimmer.start();

    return () => shimmer.stop();
  }, [structure]); // Re-run when structure changes

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  // If we have structure data, render exact skeleton
  if (structure && structure.nodes) {
    // Find bounds for centering
    const nodes = structure.nodes;
    const minX = Math.min(...nodes.map((n) => n.x)) - 100;
    const maxX = Math.max(...nodes.map((n) => n.x)) + 100;
    const minY = Math.min(...nodes.map((n) => n.y)) - 100;
    const maxY = Math.max(...nodes.map((n) => n.y)) + 100;

    const svgWidth = maxX - minX;
    const svgHeight = maxY - minY;

    // Calculate centering offset
    const offsetX = (SCREEN_WIDTH - svgWidth) / 2 - minX;
    const offsetY = SCREEN_HEIGHT * 0.3 - minY; // Center vertically with offset

    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            width: svgWidth,
            height: svgHeight,
          }}
        >
          <Svg width={svgWidth} height={svgHeight}>
            {/* Render connections first */}
            {nodes.map((node, index) => {
              // Find parent node to draw connection
              const parent = nodes.find((n) =>
                structure.nodes.some(
                  (child) => child.id === node.id && n.id !== node.id,
                ),
              );

              if (parent) {
                return (
                  <Line
                    key={`line-${index}`}
                    x1={node.x + offsetX}
                    y1={node.y + offsetY - 20}
                    x2={parent.x + offsetX}
                    y2={parent.y + offsetY + 20}
                    stroke="#D1BBA340"
                    strokeWidth="2"
                  />
                );
              }
              return null;
            })}

            {/* Render nodes */}
            {nodes.map((node, index) => {
              const isFocus = node.isFocus;
              const hasPhoto = node.hasPhoto;
              const nodeWidth = hasPhoto ? 85 : 60;
              const nodeHeight = hasPhoto ? 90 : 35;

              return (
                <Animated.G
                  key={node.id || `node-${index}`}
                  opacity={shimmerOpacity}
                >
                  {/* Node background */}
                  <Rect
                    x={node.x + offsetX - nodeWidth / 2}
                    y={node.y + offsetY - nodeHeight / 2}
                    width={nodeWidth}
                    height={nodeHeight}
                    fill="#E8E4DD"
                    stroke={isFocus ? "#A13333" : "#D1BBA340"}
                    strokeWidth={isFocus ? 2 : 1}
                    rx={8}
                  />

                  {/* Photo placeholder if has photo */}
                  {hasPhoto && (
                    <Circle
                      cx={node.x + offsetX}
                      cy={node.y + offsetY - 10}
                      r={25}
                      fill="#D1BBA320"
                    />
                  )}

                  {/* Text placeholder */}
                  <Rect
                    x={node.x + offsetX - 25}
                    y={node.y + offsetY + (hasPhoto ? 25 : -6)}
                    width={50}
                    height={12}
                    fill="#D1BBA320"
                    rx={6}
                  />
                </Animated.G>
              );
            })}
          </Svg>
        </ScrollView>
      </Animated.View>
    );
  }

  // Fallback: Generic skeleton (Phase 1)
  return (
    <Animated.View
      style={[styles.container, styles.genericContainer, { opacity: fadeAnim }]}
    >
      <View style={styles.row}>
        <View style={[styles.genericNode, styles.ancestorNode]} />
      </View>

      <View style={styles.verticalLine} />

      <View style={styles.row}>
        <View style={[styles.genericNode, styles.parentNode]} />
      </View>

      <View style={styles.verticalLine} />

      <View style={styles.row}>
        <View
          style={[styles.genericNode, styles.siblingNode, { opacity: 0.4 }]}
        />
        <View style={styles.horizontalLine} />
        <View style={[styles.genericNode, styles.focusNode]} />
        <View style={styles.horizontalLine} />
        <View
          style={[styles.genericNode, styles.siblingNode, { opacity: 0.4 }]}
        />
      </View>

      <View style={styles.verticalLine} />

      <View style={styles.row}>
        <View style={[styles.genericNode, styles.childNode]} />
        <View
          style={[styles.genericNode, styles.childNode, { marginLeft: 20 }]}
        />
      </View>

      <Animated.View
        style={[
          styles.shimmerOverlay,
          {
            opacity: shimmerOpacity,
          },
        ]}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F7F3",
  },
  genericContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  genericNode: {
    backgroundColor: "#E8E4DD",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1BBA340",
  },
  ancestorNode: {
    width: 80,
    height: 90,
  },
  parentNode: {
    width: 85,
    height: 90,
  },
  focusNode: {
    width: 85,
    height: 90,
    borderColor: "#A1333350",
    borderWidth: 2,
  },
  siblingNode: {
    width: 60,
    height: 35,
  },
  childNode: {
    width: 70,
    height: 35,
  },
  verticalLine: {
    width: 2,
    height: 40,
    backgroundColor: "#D1BBA340",
    alignSelf: "center",
  },
  horizontalLine: {
    width: 30,
    height: 2,
    backgroundColor: "#D1BBA340",
    marginHorizontal: 10,
  },
  shimmerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF30",
  },
});

export default TreeSkeletonDynamic;
