import React, {
  useMemo,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  View,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  Text,
} from "react-native";
import {
  Canvas,
  Group,
  useImage,
  Box,
  BoxShadow,
  RoundedRect,
  rrect,
  rect,
} from "@shopify/react-native-skia";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
  clamp,
  useAnimatedReaction,
} from "react-native-reanimated";

// Import branch store instead of main tree store
import useBranchTreeStore from '../hooks/useBranchTreeStore';
import { useBranchTreeContext } from '../contexts/BranchTreeProvider';

// Import necessary utilities and components
import { SpatialGrid, GRID_CELL_SIZE } from './TreeView/spatial/SpatialGrid';
import { NodeRenderer } from './TreeView/rendering/NodeRenderer';
import { NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO } from './TreeView/rendering/nodeConstants';

// Import proper highlighting services (lesson learned from V1)
import { highlightManager } from '../services/HighlightManager';
import { useHighlighting } from '../hooks/useHighlighting';
import { HIGHLIGHT_TYPES } from '../services/highlightingService';
import { createRenderer } from './TreeView/highlightRenderers';

/**
 * IsolatedTreeView - Tree viewer with isolated state management
 * 
 * This is a simplified version of TreeView that uses the branch store
 * instead of the main tree store to prevent state conflicts in modals.
 * 
 * Key improvements from V1:
 * - Proper HighlightManager integration from start
 * - Correct imports and parameter usage
 * - Modal positioning built-in (1/3 from top)
 * - No Reanimated warnings (proper worklet safety)
 * - Direct mounting at target person
 * 
 * Key differences from main TreeView:
 * - Uses useBranchTreeStore instead of useTreeStore
 * - No search bar, context menus, or admin features
 * - Focused on view-only functionality
 * - Minimal gesture handling (pan and zoom only)
 */
const IsolatedTreeView = ({
  user,
  highlightProfileId,
  modalView = false,
  ...restProps
}) => {
  // Use isolated branch store
  const {
    treeData,
    isLoading,
    error,
    translateX,
    translateY,
    scale,
    setViewport,
    highlightedAncestry,
  } = useBranchTreeStore();
  
  const { focusPersonId } = useBranchTreeContext();
  
  // Use proper highlighting hook (correct from V1)
  const { setHighlight, clearHighlight, highlights, calculatePathData } = useHighlighting();
  
  // Golden glow state (copied from main TreeView)
  const highlightedNodeId = useSharedValue(null);
  const glowOpacity = useSharedValue(0);
  
  // State for triggering re-renders (for Skia)
  const [highlightedNodeIdState, setHighlightedNodeIdState] = useState(null);
  const [glowOpacityState, setGlowOpacityState] = useState(0);
  const nodeFramesRef = useRef(new Map());
  
  // Path highlighting opacity
  const pathOpacity = useSharedValue(0);
  
  // Sync shared values to state for Skia re-renders (proper worklet safety)
  useAnimatedReaction(
    () => ({
      nodeId: highlightedNodeId.value,
      opacity: glowOpacity.value,
    }),
    (current) => {
      runOnJS(setHighlightedNodeIdState)(current.nodeId);
      runOnJS(setGlowOpacityState)(current.opacity);
    },
  );
  
  const dimensions = useWindowDimensions();
  const canvasRef = useRef(null);
  
  // Render highlighted ancestry paths (unified system from V1)
  const renderAllHighlights = useCallback(() => {
    if (highlights.length === 0) {
      return null;
    }

    // Highlights are already sorted by priority in HighlightManager.getAll()
    const allElements = highlights.flatMap(highlight => {
      const config = HIGHLIGHT_TYPES[highlight.type];
      if (!config) {
        console.warn(`[IsolatedTreeView] Unknown highlight type: ${highlight.type}`);
        return [];
      }

      // Calculate path data for this highlight
      const pathData = calculatePathData(highlight.type, highlight.nodeIds);
      if (!pathData) {
        console.warn(`[IsolatedTreeView] No path data for highlight: ${highlight.type}`);
        return [];
      }

      // Create renderer
      const renderer = createRenderer(highlight.type, config, pathData, {
        nodes: treeData,
        connections: [], // Simplified for modal - no connection lines needed
        showPhotos: true,
        pathOpacity,
      });

      if (!renderer) {
        console.warn(`[IsolatedTreeView] Failed to create renderer for ${highlight.type}`);
        return [];
      }

      const elements = renderer.render();
      return elements || [];
    });

    return allElements;
  }, [highlights, treeData, calculatePathData, pathOpacity]);
  
  // Animation values for gestures
  const gestureTranslateX = useSharedValue(0);
  const gestureTranslateY = useSharedValue(0);
  const gestureScale = useSharedValue(1);
  
  // Initialize viewport when tree data loads (with modal positioning)
  useEffect(() => {
    if (treeData.length > 0 && focusPersonId) {
      const targetPerson = treeData.find(p => p.id === focusPersonId);
      if (targetPerson && targetPerson.x !== undefined && targetPerson.y !== undefined) {
        const centerX = dimensions.width / 2;
        // Modal positioning: 1/3 from top (lesson learned from V1)
        const centerY = modalView ? dimensions.height / 3 : dimensions.height / 2;
        
        // Calculate translation to center the target person
        const newTranslateX = centerX - targetPerson.x;
        const newTranslateY = centerY - targetPerson.y;
        
        // Set initial viewport
        setViewport({
          translateX: newTranslateX,
          translateY: newTranslateY,
          scale: 1,
        });
        
        // Update gesture values
        gestureTranslateX.value = newTranslateX;
        gestureTranslateY.value = newTranslateY;
        gestureScale.value = 1;
        
        console.log('[IsolatedTreeView] Centered on target person:', {
          targetId: focusPersonId,
          targetX: targetPerson.x,
          targetY: targetPerson.y,
          translateX: newTranslateX,
          translateY: newTranslateY,
        });
      }
    }
  }, [treeData, focusPersonId, dimensions, modalView]);

  // Apply highlighting when tree loads and when highlightProfileId changes
  useEffect(() => {
    if (highlightProfileId && treeData.length > 0) {
      console.log('[IsolatedTreeView] Applying highlighting for:', highlightProfileId);
      
      // Use the existing highlighting service for path highlighting
      const highlightId = setHighlight('SEARCH', highlightProfileId);
      
      if (highlightId) {
        // Animate path in
        pathOpacity.value = withDelay(
          300, // Small delay for tree to settle
          withTiming(0.65, {
            duration: 400,
            easing: Easing.out(Easing.ease)
          })
        );
      }
      
      // Also apply golden glow
      highlightedNodeId.value = highlightProfileId;
      glowOpacity.value = withDelay(
        350, // Match path timing
        withTiming(0.55, {
          duration: 400,
          easing: Easing.out(Easing.ease),
        })
      );
      
      console.log('[IsolatedTreeView] Highlighting applied with golden glow and path');
    }
    
    return () => {
      // Clean up highlighting when unmounting or changing
      clearHighlight('SEARCH');
      glowOpacity.value = withTiming(0, { duration: 200 });
      pathOpacity.value = withTiming(0, { duration: 200 });
    };
  }, [highlightProfileId, treeData.length, setHighlight, clearHighlight]);
  
  // Simplified gesture handling (pan and zoom only)
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      gestureTranslateX.value = translateX + event.translationX;
      gestureTranslateY.value = translateY + event.translationY;
    })
    .onEnd(() => {
      // Update store with final position
      runOnJS(setViewport)({
        translateX: gestureTranslateX.value,
        translateY: gestureTranslateY.value,
      });
    });
  
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = clamp(scale * event.scale, 0.5, 3.0);
      gestureScale.value = newScale;
    })
    .onEnd(() => {
      // Update store with final scale
      runOnJS(setViewport)({
        scale: gestureScale.value,
      });
    });
  
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);
  
  // Animated style for canvas transform
  const animatedCanvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: gestureTranslateX.value },
      { translateY: gestureTranslateY.value },
      { scale: gestureScale.value },
    ],
  }));
  
  // Spatial grid for viewport culling
  const spatialGrid = useMemo(() => {
    if (treeData.length === 0) return null;
    
    const grid = new SpatialGrid(GRID_CELL_SIZE);
    treeData.forEach(person => {
      if (person.x !== undefined && person.y !== undefined) {
        grid.insert(person, person.x, person.y);
      }
    });
    return grid;
  }, [treeData]);
  
  // For modal use: render all nodes since it's a small branch (no Reanimated warnings)
  const visibleNodes = useMemo(() => {
    // For modal use, just return all tree data since it's a small branch
    return treeData;
  }, [treeData]);
  
  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A13333" />
        <Text style={styles.loadingText}>جارٍ تحميل الشجرة...</Text>
      </View>
    );
  }
  
  // Error state
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>خطأ في تحميل الشجرة</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }
  
  // Empty state
  if (treeData.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>لا توجد بيانات للعرض</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.canvasContainer, animatedCanvasStyle]}>
          <Canvas style={styles.canvas} ref={canvasRef}>
            {/* Static screen-space clip (camera lens) */}
            <Group clip={rect(0, 0, dimensions.width, dimensions.height)}>
              {/* Transform inside (world moves behind lens) */}
              <Group transform={[
                { translateX: gestureTranslateX.value },
                { translateY: gestureTranslateY.value },
                { scale: gestureScale.value },
              ]}>
                {/* Highlighted ancestry paths (unified system) */}
                {renderAllHighlights()}

                {/* Render visible nodes */}
                {visibleNodes.map((person) => (
                  <NodeRenderer
                    key={person.id}
                    person={person}
                    user={user}
                    isHighlighted={highlightProfileId === person.id}
                    isAncestryHighlighted={highlightedAncestry.includes(person.id)}
                    simplified={true}
                    nodeFramesRef={nodeFramesRef}
                  />
                ))}

                {/* Golden glow highlight (rendered on top) - 5-layer system */}
                {highlightedNodeIdState && glowOpacityState > 0.01 && (() => {
                  const frame = nodeFramesRef.current.get(highlightedNodeIdState);
                  if (!frame) return null;

                  return (
                    <Group opacity={glowOpacityState}>
                      {/* Soft multi-layer glow using Box + BoxShadow */}
                      <Box
                        box={rrect(
                          rect(frame.x, frame.y, frame.width, frame.height),
                          frame.borderRadius,
                          frame.borderRadius
                        )}
                        color="transparent"
                      >
                        {/* Layer 5: Outermost halo - very soft, large spread */}
                        <BoxShadow dx={0} dy={0} blur={50} color="rgba(213, 140, 74, 0.45)" />

                        {/* Layer 4: Outer glow - golden halo */}
                        <BoxShadow dx={0} dy={0} blur={40} color="rgba(213, 140, 74, 0.40)" />

                        {/* Layer 3: Middle glow - building intensity */}
                        <BoxShadow dx={0} dy={0} blur={30} color="rgba(213, 140, 74, 0.35)" />

                        {/* Layer 2: Inner glow - warm crimson accent */}
                        <BoxShadow dx={0} dy={0} blur={20} color="rgba(161, 51, 51, 0.30)" />

                        {/* Layer 1: Tight glow - color definition */}
                        <BoxShadow dx={0} dy={0} blur={10} color="rgba(229, 168, 85, 0.50)" />
                      </Box>

                      {/* Crisp golden border on top */}
                      <RoundedRect
                        x={frame.x}
                        y={frame.y}
                        width={frame.width}
                        height={frame.height}
                        r={frame.borderRadius}
                        color="#E5A855"
                        style="stroke"
                        strokeWidth={2}
                      />
                    </Group>
                  );
                })()}
              </Group>
            </Group>
          </Canvas>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#F9F7F3', // Al-Jass White
  },
  canvasContainer: {
    flex: 1,
  },
  canvas: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F7F3',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#242121',
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'Roboto',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F7F3',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#A13333',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'Roboto',
  },
  errorDetail: {
    fontSize: 14,
    color: '#242121',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'Roboto',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F7F3',
  },
  emptyText: {
    fontSize: 16,
    color: '#242121',
    fontFamily: Platform.OS === 'ios' ? 'SF Arabic' : 'Roboto',
  },
};

export default IsolatedTreeView;