import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Dimensions,
  ActivityIndicator,
  StyleSheet,
  Text,
} from 'react-native';
import {
  Canvas,
  Group,
  Line,
  RoundedRect,
  Image as SkiaImage,
  Circle,
  vec,
  Blur,
  Text as SkiaText,
  useFont,
  Skia,
} from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import {
  useSharedValue,
  useDerivedValue,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  clamp,
} from 'react-native-reanimated';
import { useFocusedTreeData } from '../hooks/useFocusedTreeData';
import { calculateTreeLayout } from '../utils/treeLayout';
import { useCachedSkiaImage } from '../hooks/useCachedSkiaImage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const VIEWPORT_MARGIN = 500;
const NODE_WIDTH = 50;
const NODE_HEIGHT = 60;
const PHOTO_SIZE = 36;
const LINE_COLOR = '#D1BBA340';
const LINE_WIDTH = 2;
const CORNER_RADIUS = 6;

// Glow effect colors
const GLOW_COLOR = '#A13333';
const GLOW_INTENSITY = 0.8;
const GLOW_RADIUS = 15;

// Arabic font setup
const SF_ARABIC_ASSET = require('../../assets/fonts/SF Arabic Regular.ttf');

const SimplifiedTreeView = ({ focusPersonId }) => {
  const { nodes, loading, error, centerNode } = useFocusedTreeData(focusPersonId, 4);

  // Camera state
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  // Animation state for glow
  const glowOpacity = useSharedValue(0.5);
  const glowScale = useSharedValue(1);

  // Arabic font
  const arabicFont = useFont(SF_ARABIC_ASSET, 10);

  // Calculate tree layout
  const { layoutNodes, connections } = useMemo(() => {
    if (nodes.length === 0) return { layoutNodes: [], connections: [] };

    const layout = calculateTreeLayout(nodes);
    return {
      layoutNodes: layout.nodes,
      connections: layout.connections,
    };
  }, [nodes]);

  // Center on the focused person when data loads
  useEffect(() => {
    if (!centerNode || layoutNodes.length === 0) return;

    const targetNode = layoutNodes.find(n => n.id === focusPersonId);
    if (targetNode) {
      // Calculate center position
      const targetX = -targetNode.x * 1.2 + SCREEN_WIDTH / 2;
      const targetY = -targetNode.y * 1.2 + SCREEN_HEIGHT / 2 - 100; // Offset for modal header

      // Animate to center
      translateX.value = withSpring(targetX, {
        damping: 20,
        stiffness: 90,
      });
      translateY.value = withSpring(targetY, {
        damping: 20,
        stiffness: 90,
      });
      scale.value = withSpring(1.2, {
        damping: 20,
        stiffness: 90,
      });
      savedScale.value = 1.2;
      savedTranslateX.value = targetX;
      savedTranslateY.value = targetY;

      // Start glow animation
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1000 }),
          withTiming(0.3, { duration: 1000 })
        ),
        -1,
        true
      );

      glowScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    }
  }, [centerNode, layoutNodes, focusPersonId]);

  // Saved translation values
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    });

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 0.3, 2.5);
    });

  // Composed gesture
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // Render a single node
  const renderNode = useCallback((node) => {
    const isSelected = node.id === focusPersonId;
    const hasPhoto = !!node.photo_url;
    const nodeWidth = hasPhoto ? NODE_WIDTH : 40;
    const nodeHeight = hasPhoto ? NODE_HEIGHT : 35;

    return (
      <Group key={node.id} transform={[{ translateX: node.x }, { translateY: node.y }]}>
        {/* Glow effect for selected node */}
        {isSelected && (
          <>
            {/* Outer glow shadow */}
            <RoundedRect
              x={-nodeWidth / 2 - 3}
              y={-nodeHeight / 2 - 3}
              width={nodeWidth + 6}
              height={nodeHeight + 6}
              r={CORNER_RADIUS + 2}
              color={GLOW_COLOR}
              opacity={0.5}
            >
              <Blur blur={8} />
            </RoundedRect>

            {/* Inner glow border */}
            <RoundedRect
              x={-nodeWidth / 2 - 2}
              y={-nodeHeight / 2 - 2}
              width={nodeWidth + 4}
              height={nodeHeight + 4}
              r={CORNER_RADIUS + 1}
              color={GLOW_COLOR}
              style="stroke"
              strokeWidth={3}
              opacity={0.9}
            />
          </>
        )}

        {/* Node background */}
        <RoundedRect
          x={-nodeWidth / 2}
          y={-nodeHeight / 2}
          width={nodeWidth}
          height={nodeHeight}
          r={CORNER_RADIUS}
          color="#F9F7F3"
        />

        {/* Node border */}
        <RoundedRect
          x={-nodeWidth / 2}
          y={-nodeHeight / 2}
          width={nodeWidth}
          height={nodeHeight}
          r={CORNER_RADIUS}
          style="stroke"
          strokeWidth={isSelected ? 2 : 1}
          color={isSelected ? GLOW_COLOR : '#D1BBA340'}
        />

        {/* Photo if available */}
        {hasPhoto && node.photo_url && (
          <NodePhoto
            url={node.photo_url}
            x={-PHOTO_SIZE / 2}
            y={-nodeHeight / 2 + 4}
            size={PHOTO_SIZE}
          />
        )}

        {/* Name text - centered below photo or in middle of node */}
        {arabicFont && node.name && (
          <SkiaText
            x={0}
            y={hasPhoto ? nodeHeight / 2 - 8 : 3}
            text={node.name}
            font={arabicFont}
            color="#242121"
            origin={{ x: 0, y: 0 }}
          />
        )}
      </Group>
    );
  }, [focusPersonId, arabicFont]);

  // Render connections
  const renderConnections = useCallback(() => {
    return connections.map((conn, index) => (
      <Line
        key={`conn-${index}`}
        p1={vec(conn.from.x, conn.from.y)}
        p2={vec(conn.to.x, conn.to.y)}
        color={LINE_COLOR}
        style="stroke"
        strokeWidth={LINE_WIDTH}
      />
    ));
  }, [connections]);

  // For now, show all nodes (optimize viewport culling later)
  const visibleNodes = layoutNodes;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A13333" />
          <Text style={styles.loadingText}>جاري تحميل شجرة العائلة...</Text>
        </View>
      </View>
    );
  }

  if (error || layoutNodes.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>حدث خطأ في تحميل البيانات</Text>
        </View>
      </View>
    );
  }

  // Use derived values for Skia transforms
  const transform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.container}>
        <Canvas style={styles.canvas}>
          <Group transform={transform}>
            {/* Render connections first (behind nodes) */}
            {renderConnections()}

            {/* Render nodes */}
            {visibleNodes.map(renderNode)}
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
};

// Component for loading and caching node photos
const NodePhoto = React.memo(({ url, x, y, size }) => {
  const image = useCachedSkiaImage(url);

  if (!image) {
    // Show placeholder circle while loading
    return (
      <Circle
        cx={x + size / 2}
        cy={y + size / 2}
        r={size / 2}
        color="#D1BBA320"
      />
    );
  }

  // Create circular clip path
  const clipPath = Skia.Path.Make();
  clipPath.addCircle(x + size / 2, y + size / 2, size / 2);

  return (
    <Group>
      {/* Background circle */}
      <Circle
        cx={x + size / 2}
        cy={y + size / 2}
        r={size / 2}
        color="white"
      />

      {/* Clipped image */}
      <Group clip={clipPath}>
        <SkiaImage
          image={image}
          x={x}
          y={y}
          width={size}
          height={size}
          fit="cover"
        />
      </Group>

      {/* Photo border */}
      <Circle
        cx={x + size / 2}
        cy={y + size / 2}
        r={size / 2}
        style="stroke"
        strokeWidth={1}
        color="#D1BBA340"
      />
    </Group>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F7F3',
  },
  canvas: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#242121',
    fontFamily: 'SF Arabic',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#A13333',
    fontFamily: 'SF Arabic',
    textAlign: 'center',
  },
});

export default SimplifiedTreeView;