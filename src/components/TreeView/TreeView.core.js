import React, {
  useMemo,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Dimensions,
  useWindowDimensions,
  Platform,
  I18nManager,
  ActivityIndicator,
  Text,
  Alert,
  PixelRatio,
  Animated as RNAnimated,
} from "react-native";
import {
  Canvas,
  Group,
  Rect,
  Line,
  Circle,
  vec,
  RoundedRect,
  useImage,
  Image as SkiaImage,
  Skia,
  Mask,
  Paragraph,
  listFontFamilies,
  Text as SkiaText,
  useFont,
  Path,
  Paint,
  ColorMatrix,
  Blur,
  Box,
  BoxShadow,
  rrect,
  rect,
  CornerPathEffect,
} from "@shopify/react-native-skia";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDecay,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
  clamp,
  useAnimatedReaction,
  cancelAnimation,
  useDerivedValue,
} from "react-native-reanimated";

// Phase 2 Day 8 - Import SimpleTreeSkeleton
import { SimpleTreeSkeleton } from './SimpleTreeSkeleton';

// Phase 0 Infrastructure - Import context providers
import { FontProvider } from './contexts/FontProvider';
import { ParagraphCacheProvider } from './contexts/ParagraphCacheProvider';

// Phase 2 Integration - Import extracted components
import { SpatialGrid, GRID_CELL_SIZE, MAX_VISIBLE_NODES } from './spatial/SpatialGrid';
import { ImageNode } from './rendering/ImageNode';
import { SaduIcon, G2SaduIcon } from './rendering/SaduIcon';
import { calculateLODTier, createTierState } from './lod/LODCalculator';
import { BadgeRenderer } from './rendering/BadgeRenderer';
import { ShadowRenderer, renderT1Shadow, renderT2Shadow } from './rendering/ShadowRenderer';
import { TextPillRenderer } from './rendering/TextPillRenderer';
import { T3ChipRenderer } from './rendering/T3ChipRenderer';
import { NodeRenderer } from './rendering/NodeRenderer';

// Phase 1 Day 4a - Import node constants from centralized source
import {
  // Node dimensions
  NODE_WIDTH_WITH_PHOTO,
  NODE_HEIGHT_WITH_PHOTO,
  NODE_WIDTH_TEXT_ONLY,
  NODE_HEIGHT_TEXT_ONLY,
  PHOTO_SIZE,
  // Image buckets
  IMAGE_BUCKETS,
  DEFAULT_IMAGE_BUCKET,
  BUCKET_HYSTERESIS,
  // Connection styling
  LINE_COLOR,
  LINE_WIDTH,
  CORNER_RADIUS,
  // Shadow styling
  SHADOW_OPACITY,
  SHADOW_RADIUS,
  SHADOW_OFFSET_Y,
  // Layout spacing
  DEFAULT_SIBLING_GAP,
  DEFAULT_GENERATION_GAP,
  MIN_SIBLING_GAP,
  MAX_SIBLING_GAP,
  MIN_GENERATION_GAP,
  MAX_GENERATION_GAP,
} from './rendering/nodeConstants';

// Phase 1 Day 4a - Import viewport, animation, and utility functions
import {
  // Viewport constants
  VIEWPORT_MARGIN_X,
  VIEWPORT_MARGIN_Y,
  MAX_TREE_SIZE,
  WARNING_THRESHOLD,
  CRITICAL_THRESHOLD,
  LOD_T1_THRESHOLD,
  LOD_T2_THRESHOLD,
  // Animation constants
  ANIMATION_DURATION_SHORT,
  ANIMATION_DURATION_MEDIUM,
  ANIMATION_DURATION_LONG,
  // Gesture constants
  GESTURE_ACTIVE_OFFSET,
  GESTURE_DECELERATION,
  GESTURE_RUBBER_BAND_FACTOR,
  // Zoom constants
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  // Utility functions
  hexToRgba,
  createDimMatrix,
  createGrayscaleMatrix,
  interpolateColor,
  performanceMonitor,
} from './utils';

// Phase 1 Day 3 - Import gesture functions
import {
  createPanGesture,
  createPinchGesture,
  createTapGesture,
  createLongPressGesture,
  createComposedGesture,
} from './interaction/GestureHandler';

// Phase 3 - Import hit detection functions
import { detectTap } from './interaction/HitDetection';

// Phase 1 Day 4c - Import path calculation functions
import {
  calculateBusY,
  calculateParentVerticalPath,
  shouldRenderBusLine,
  calculateBusLine,
  calculateChildVerticalPaths,
  calculateConnectionPaths,
} from './spatial/PathCalculator';

// Phase 1 Day 4d - Import Arabic text rendering
import { createArabicParagraph } from './rendering/ArabicTextRenderer';

// Import line styles system for bezier curves
import { buildBatchedPaths, LINE_STYLES, BEZIER_CONFIG } from './utils/lineStyles';

// Phase 2 Day 10 - Import paragraph cache
import { getCachedParagraph } from './rendering/ParagraphCache';

// Phase 2 Day 10 - Import custom hooks
import { useTreeDataLoader } from './hooks/useTreeDataLoader';
// Phase 3B - Import progressive loading hook (two-phase loading strategy)
import { useProgressiveTreeView } from './hooks/useProgressiveTreeView';
import { useDebounce } from '../../hooks/useDebounce';

import { Asset } from "expo-asset";
import { calculateTreeLayout } from "../../utils/treeLayout";
import { TREE_DATA_SCHEMA_VERSION } from "../../stores/useTreeStore";
import profilesService from "../../services/profiles";
import { formatDateDisplay } from "../../services/migrationHelpers";
import { useSettings } from "../../contexts/SettingsContext";
import { useAuth } from "../../contexts/AuthContextSimple";
import { formatDateByPreference } from "../../utils/dateDisplay";
import NavigateToRootButton from "../NavigateToRootButton";
import { useAdminMode } from "../../contexts/AdminModeContext";
import SystemStatusIndicator from "../admin/SystemStatusIndicator";
import MultiAddChildrenModal from "../admin/MultiAddChildrenModal";
import MarriageEditor from "../admin/MarriageEditor";
import skiaImageCache from "../../services/skiaImageCache";
import { useBatchedSkiaImageWithMorph } from "../../hooks/useBatchedSkiaImageWithMorph";
import NodeContextMenu from "../admin/NodeContextMenu";
import QuickAddOverlay from "../admin/QuickAddOverlay";
import SearchBar from "../SearchBar";
import { supabase } from "../../services/supabase";
import * as Haptics from "expo-haptics";
import NetworkStatusIndicator from "../NetworkStatusIndicator";
import { useHighlighting } from "../../hooks/useHighlighting";
import { HIGHLIGHT_TYPES, ANCESTRY_COLORS } from "../../services/highlightingService";
import { createRenderer } from "./highlightRenderers";
import { detectCousinMarriage } from "../../utils/cousinMarriageDetector";

// Phase 1 Day 4b: All constants now imported from ./TreeView/utils
// Removed inline definitions:
// - VIEWPORT_MARGIN_X, VIEWPORT_MARGIN_Y
// - NODE_WIDTH_WITH_PHOTO, NODE_HEIGHT_WITH_PHOTO, PHOTO_SIZE
// - NODE_WIDTH_TEXT_ONLY, NODE_HEIGHT_TEXT_ONLY (now imported)
// - LINE_COLOR, LINE_WIDTH, CORNER_RADIUS
// - hexToRgba function

// ANCESTRY_COLORS now imported from highlightingService.js

// Phase 1 Day 4b: LOD constants partially migrated
// Removed: BUCKET_HYSTERESIS (now imported from utils)
// Kept: SCALE_QUANTUM, HYSTERESIS, T1_BASE, T2_BASE (LOD system-specific, not in extracted constants)
// Kept: MAX_VISIBLE_NODES, MAX_VISIBLE_EDGES, LOD_ENABLED, AGGREGATION_ENABLED (runtime config)
const SCALE_QUANTUM = 0.05; // 5% quantization steps
const HYSTERESIS = 0.15; // ±15% hysteresis
const T1_BASE = 48; // Full card threshold (px)
const T2_BASE = 24; // Text pill threshold (px)
const MAX_VISIBLE_EDGES = 10000; // Increased for unfiltered rendering (useMemo cached, no per-frame impact)
const LOD_ENABLED = true; // Kill switch
const AGGREGATION_ENABLED = true; // T3 chips toggle
const BUCKET_DEBOUNCE_MS = 150; // ms

// Phase 3B - Progressive Loading Feature Flag
// Set to true to enable two-phase loading (0.45 MB structure + progressive enrichment)
// Set to false to use traditional full-tree loading
const USE_PROGRESSIVE_LOADING = true;

// Create font manager/provider once
let fontMgr = null;
let arabicFontProvider = null;
let arabicTypeface = null;
let arabicFont = null;
let arabicFontBold = null;
let sfArabicRegistered = false;

// Simple debounce helper for batching rapid updates (Phase 1 Performance Optimization)
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const SF_ARABIC_ALIAS = "SF Arabic";
const SF_ARABIC_ASSET = require("../../../assets/fonts/SF Arabic Regular.ttf");

try {
  fontMgr = Skia.FontMgr.System();
  arabicFontProvider = Skia.TypefaceFontProvider.Make();

  // List all available fonts to find Arabic fonts
  const availableFonts = listFontFamilies();
  // Try to match Arabic fonts - prioritize SF Arabic
  const arabicFontNames = [
    "SF Arabic", // Prefer SF Arabic explicitly
    ".SF Arabic", // Alternate internal name variants
    ".SF NS Arabic",
    ".SFNSArabic",
    "Geeza Pro",
    "GeezaPro",
    "Damascus",
    "Al Nile",
    "Baghdad",
    ".SF NS Display",
    ".SF NS Text",
    ".SF NS",
    ".SFNS-Regular",
  ];

  for (const fontName of arabicFontNames) {
    try {
      arabicTypeface = fontMgr.matchFamilyStyle(fontName, {
        weight: 400,
        width: 5,
        slant: 0,
      });
      if (arabicTypeface) {
        // Create Font objects from typeface
        arabicFont = Skia.Font(arabicTypeface, 11);
        const boldTypeface = fontMgr.matchFamilyStyle(fontName, {
          weight: 700,
          width: 5,
          slant: 0,
        });
        arabicFontBold = boldTypeface
          ? Skia.Font(boldTypeface, 11)
          : arabicFont;
        break;
      }
    } catch (e) {
      // Continue trying other fonts
    }
  }
} catch (e) {
  // Font collection creation failed
}

// Phase 1 Day 4d: createArabicParagraph now imported from ./TreeView/rendering/ArabicTextRenderer
// Removed inline implementation (lines 270-334)

// Phase 2 Day 10: getCachedParagraph now imported from ParagraphCache.ts
// Removed duplicate implementation (38 lines)

// Image buckets for LOD
// Phase 4: Removed 512px bucket (256px sufficient for 60px photos @ 3x retina = 180px)
// 512px wastes memory (1MB vs 256KB decoded size per image)
// IMAGE_BUCKETS now imported from utils (Day 4b)
// selectBucket removed - use selectBucketWithHysteresis from ImageBuckets.ts

const TreeViewCore = ({
  // Existing props
  setProfileEditMode,
  onNetworkStatusChange,
  user,
  profile,
  linkedProfileId,
  isAdmin,
  onAdminDashboard,
  onSettingsOpen,
  highlightProfileId,
  focusOnProfile,
  spouse1Id, // For cousin marriage dual-path highlighting
  spouse2Id, // For cousin marriage dual-path highlighting

  // NEW: Store interface prop
  store,  // { state: {...}, actions: {...} }

  // NEW: Configuration props
  readOnly = false,
  hideControls = false,
  navigationTarget = null,
  initialFocusId = null,
  autoHighlight = null,
}) => {
  // Extract state and actions from store prop
  const { stage, minZoom, maxZoom, selectedPersonId, treeData } = store.state;
  const { setStage, setSelectedPersonId, setTreeData } = store.actions;
  const { settings } = useSettings();
  const { isPreloadingTree, profile: authProfile } = useAuth();

  // Extract tree display settings
  const { showPhotos, highlightMyLine, lineStyle } = settings;

  // Store settings in ref for access in callbacks (prevents stale closures)
  // NOTE: We use ref pattern because settings are accessed in debounced
  // callbacks that would otherwise capture stale closures. Direct useState
  // in callbacks would require recreating subscriptions on every settings change.
  const settingsRef = useRef(settings);

  // Extract layout-affecting settings to prevent unnecessary viewport recalculations
  // Only showPhotos affects node layout (changes node heights: 105px with photo, 35px without)
  // Other settings like highlightMyLine only affect visual rendering, not layout
  const layoutAffectingSettings = useMemo(() => ({
    showPhotos: settings.showPhotos,
  }), [settings.showPhotos]);

  // Update ref whenever ANY settings change (needed for event handlers)
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const dimensions = useWindowDimensions();
  const [fontReady, setFontReady] = useState(false);

  // Phase 3B: Skeleton-in-Store Pattern - SIMPLIFIED
  // Direct store subscription: Single source of truth for loading state
  const { isTreeLoaded } = store.state;

  // Derived state (not stored locally) - prevents state desync
  const showSkeleton = !isTreeLoaded;

  // Simple opacity based on loading state (no animation)
  const skeletonOpacity = isTreeLoaded ? 0 : 1;
  const contentOpacity = isTreeLoaded ? 1 : 0;
  const shimmerAnim = useRef(new RNAnimated.Value(0.3)).current;

  const [currentScale, setCurrentScale] = useState(1);
  const [networkError, setNetworkError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Admin mode state
  const { isAdminMode } = useAdminMode();
  const [showMultiAddModal, setShowMultiAddModal] = useState(false);
  const [multiAddParent, setMultiAddParent] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuNode, setContextMenuNode] = useState(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({
    x: 0,
    y: 0,
  });
  const [showMarriageModal, setShowMarriageModal] = useState(false);
  const [marriagePerson, setMarriagePerson] = useState(null);

  // Quick Add Overlay state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddParent, setQuickAddParent] = useState(null);
  const [quickAddPosition, setQuickAddPosition] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef(null);

  // Search modal state

  // Highlight state with Reanimated shared values
  const highlightedNodeId = useSharedValue(null);
  const glowOpacity = useSharedValue(0);

  // Initialize profile sheet progress shared value for SearchBar coordination
  const profileSheetProgress = useSharedValue(0);
  const { initializeProfileSheetProgress } = store.actions;

  // Initialize profile sheet progress after mount to avoid setState during render
  useEffect(() => {
    initializeProfileSheetProgress(profileSheetProgress);
  }, []); // Empty deps = run once on mount

  // State for triggering re-renders
  const [highlightedNodeIdState, setHighlightedNodeIdState] = useState(null);
  const [glowOpacityState, setGlowOpacityState] = useState(0);
  const [glowTrigger, setGlowTrigger] = useState(0); // Force re-trigger on same node
  const nodeFramesRef = useRef(new Map());
  const highlightTimerRef = useRef(null);
  const lastNavigationRef = useRef(null); // Track navigation ID to prevent stale callbacks

  // UNIFIED HIGHLIGHTING SYSTEM
  // Centralized state for all highlight types (search, user lineage, cousin marriage)
  const [activeHighlights, setActiveHighlights] = useState({
    search: null,          // Search result highlight
    userLineage: null,     // "Highlight My Line" toggle
    cousinMarriage: null,  // Cousin marriage dual path
  });
  const pathOpacity = useSharedValue(0);

  // Highlighting API hook
  const { calculatePathData, clearCache } = useHighlighting();

  // Auto-activate highlight if provided externally
  useEffect(() => {
    if (autoHighlight && autoHighlight.type === 'SEARCH' && autoHighlight.nodeId && nodes.length > 0) {
      const pathData = calculatePathData('SEARCH', autoHighlight.nodeId);

      if (pathData) {
        setActiveHighlights(prev => ({
          ...prev,
          search: pathData,
          cousinMarriage: null,
          userLineage: null,
        }));

        // Fade in opacity
        cancelAnimation(pathOpacity);
        pathOpacity.value = withDelay(
          600,  // Wait for camera to settle
          withTiming(0.65, {
            duration: 400,
            easing: Easing.out(Easing.ease),
          })
        );
      }
    }
  }, [autoHighlight, calculatePathData, nodes.length, pathOpacity]);

  // Focus on specific node after d3 layout completes
  useEffect(() => {
    if (initialFocusId && nodes.length > 0) {
      const targetNode = nodes.find(n => n.id === initialFocusId);
      if (targetNode) {
        // Use existing navigateToNode function (will be defined below)
        const timer = setTimeout(() => {
          navigateToNode(initialFocusId);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [initialFocusId, nodes.length]);

  // LEGACY STATE (kept for backwards compatibility during migration)
  // These will be removed after full migration is complete
  const [highlightedPathNodeIds, setHighlightedPathNodeIds] = useState(null);
  const [userLineagePathNodeIds, setUserLineagePathNodeIds] = useState(null);

  // Sync shared values to state for Skia re-renders
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

  // Track current transform for viewport calculations
  // This drives all visibility and bounds calculations
  const [currentTransform, setCurrentTransform] = useState({
    x: 0,
    y: 0,
    scale: 1,
  });

  // ============================================================================
  // SCALE SYNC STRATEGY (October 2025)
  // ============================================================================
  //
  // Pattern: On-demand sync (gesture end) instead of continuous sync (every frame)
  //
  // REMOVED: useAnimatedReaction continuous sync to prevent worklet crashes
  //
  // Problem with continuous sync:
  // - useAnimatedReaction fires 60x/sec during gestures (60fps)
  // - runOnJS(setCurrentTransform) queued 60x → React reconciliation overload
  // - Result: Worklet runtime crashes in worklets::runOnRuntimeGuarded
  //
  // Why gesture-end sync is sufficient:
  // 1. Gesture ends → syncTransform() updates currentTransform.scale
  // 2. Image loading starts with current scale → bucket selection uses current scale
  // 3. Image loads asynchronously (150-300ms AFTER gesture completes)
  // 4. isUpgrading triggers → morph animation checks scale (already current from step 1)
  //
  // Sync Points (all via syncTransform callback):
  // - Gesture end (pan/pinch completion, including decay animations)
  // - Before user actions (tap, search, navigation)
  // - After programmatic navigation (zoom-to-node animations)
  //
  // Performance impact: 98% reduction in state updates during gestures
  //
  // Feature flag for emergency rollback (set to true if morph breaks):
  const ENABLE_CONTINUOUS_SCALE_SYNC = false;

  {ENABLE_CONTINUOUS_SCALE_SYNC && (
    // PRESERVED FOR ROLLBACK: Original continuous sync implementation
    // WARNING: This causes worklet crashes from state update storm
    useAnimatedReaction(
      () => ({
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      }),
      (current) => {
        'worklet';
        if (!Number.isFinite(current.scale) || current.scale <= 0) {
          return;
        }
        runOnJS(setCurrentTransform)({
          x: current.translateX,
          y: current.translateY,
          scale: current.scale,
        });
      },
    )
  )}
  // ============================================================================

  // LOD tier state with hysteresis (Phase 2: Using extracted createTierState)
  const tierState = useRef(createTierState(1.0));

  // Image bucket tracking for hysteresis
  const nodeBucketsRef = useRef(new Map());
  const bucketTimersRef = useRef(new Map());

  // Cleanup bucket timers on unmount
  useEffect(() => {
    return () => {
      bucketTimersRef.current.forEach(clearTimeout);
      bucketTimersRef.current.clear();
    };
  }, []);

  const selectBucketWithHysteresis = useCallback((nodeId, pixelSize) => {
    const nodeBuckets = nodeBucketsRef.current;
    const bucketTimers = bucketTimersRef.current;

    const current = nodeBuckets.get(nodeId) || 80; // Start with lower default to allow upgrades
    const target = IMAGE_BUCKETS.find((b) => b >= pixelSize) || 512;

    // Debug high-pixel scenarios (disabled to reduce spam)
    if (__DEV__ && false && pixelSize >= 200) {
      console.log(
        `[BucketHysteresis] ${nodeId}: pixelSize=${pixelSize.toFixed(0)}, current=${current}px, target=${target}px`
      );
    }

    // Apply hysteresis
    if (target > current && pixelSize < current * (1 + BUCKET_HYSTERESIS)) {
      if (__DEV__ && false && pixelSize >= 200) {
        console.log(
          `[BucketHysteresis] ${nodeId}: BLOCKED upgrade by hysteresis: ${pixelSize.toFixed(0)} < ${(current * (1 + BUCKET_HYSTERESIS)).toFixed(0)}`
        );
      }
      return current; // Stay at current
    }
    if (target < current && pixelSize > current * (1 - BUCKET_HYSTERESIS)) {
      if (__DEV__ && false && pixelSize >= 200) {
        console.log(
          `[BucketHysteresis] ${nodeId}: BLOCKED downgrade by hysteresis: ${pixelSize.toFixed(0)} > ${(current * (1 - BUCKET_HYSTERESIS)).toFixed(0)}`
        );
      }
      return current; // Stay at current
    }

    // Debounce upgrades
    if (target > current) {
      if (__DEV__ && false && pixelSize >= 200) {
        console.log(
          `[BucketHysteresis] ${nodeId}: DEBOUNCING upgrade ${current}px → ${target}px (150ms delay)`
        );
      }
      clearTimeout(bucketTimers.get(nodeId));
      bucketTimers.set(
        nodeId,
        setTimeout(() => {
          if (__DEV__ && false && pixelSize >= 200) {
            console.log(
              `[BucketHysteresis] ${nodeId}: APPLIED delayed upgrade ${current}px → ${target}px`
            );
          }
          nodeBuckets.set(nodeId, target);
        }, BUCKET_DEBOUNCE_MS),
      );
      return current;
    }

    // Immediate downgrade
    nodeBuckets.set(nodeId, target);
    return target;
  }, []);

  // Distance-based bucket selection with viewport center priority
  const selectBucketWithDistance = useCallback((nodeId, pixelSize, nodeX, nodeY) => {
    // Validate inputs with fallbacks
    if (typeof pixelSize !== 'number' || pixelSize <= 0) {
      console.warn(`[BucketSelection] Invalid pixelSize for ${nodeId}: ${pixelSize}`);
      return 80; // Safe fallback
    }
    
    if (typeof nodeX !== 'number' || typeof nodeY !== 'number') {
      console.warn(`[BucketSelection] Invalid node coordinates for ${nodeId}: (${nodeX}, ${nodeY})`);
      return IMAGE_BUCKETS.find((b) => b >= pixelSize) || 1024;
    }

    const nodeBuckets = nodeBucketsRef.current;
    const bucketTimers = bucketTimersRef.current;

    // Fallback to regular hysteresis if viewport center not ready
    if (!viewportCenter || typeof viewportCenter.x !== 'number') {
      const current = nodeBuckets.get(nodeId) || 80;
      const target = IMAGE_BUCKETS.find((b) => b >= pixelSize) || 1024;
      
      // Store the selected bucket for hysteresis tracking
      if (target !== current) {
        nodeBuckets.set(nodeId, target);
      }
      return target;
    }

    // Calculate distance from viewport center
    const dx = nodeX - viewportCenter.x;
    const dy = nodeY - viewportCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Define quality zones based on distance from center
    const screenDiagonal = Math.sqrt(dimensions.width * dimensions.width + dimensions.height * dimensions.height);
    const maxDistance = Math.max(screenDiagonal / currentTransform.scale, 1); // Prevent division by zero
    const normalizedDistance = Math.min(Math.max(distance / maxDistance, 0), 1.0); // Clamp to [0, 1]

    // Quality multiplier based on distance (center = 1.5x, edge = 1.0x)
    const qualityMultiplier = Math.max(1.0, Math.min(1.5, 1.5 - normalizedDistance * 0.5)); // Clamp to [1.0, 1.5]
    const adjustedPixelSize = pixelSize * qualityMultiplier;

    // Use original hysteresis logic with adjusted pixel size
    const current = nodeBuckets.get(nodeId) || 80;
    const target = IMAGE_BUCKETS.find((b) => b >= adjustedPixelSize) || 1024;

    // Debug distance-based quality for nodes with significant upgrades (after target is calculated)
    if (__DEV__ && false && adjustedPixelSize > pixelSize * 1.2) { // Disabled to reduce console spam
      console.log(
        `[PanQuality] ${nodeId}: distance=${distance.toFixed(0)}, quality=${qualityMultiplier.toFixed(2)}x, ${pixelSize.toFixed(0)} → ${adjustedPixelSize.toFixed(0)}px, target=${target}px`
      );
    }

    // Apply hysteresis (same logic as original function)
    if (target > current && adjustedPixelSize < current * (1 + BUCKET_HYSTERESIS)) {
      return current; // Stay at current
    }
    if (target < current && adjustedPixelSize > current * (1 - BUCKET_HYSTERESIS)) {
      return current; // Stay at current
    }

    // Debounce upgrades
    if (target > current) {
      clearTimeout(bucketTimers.get(nodeId));
      bucketTimers.set(
        nodeId,
        setTimeout(() => {
          nodeBuckets.set(nodeId, target);
        }, BUCKET_DEBOUNCE_MS),
      );
      return current;
    }

    // Immediate downgrade
    nodeBuckets.set(nodeId, target);
    
    // Final validation: ensure we always return a valid bucket
    const result = target || 1024;
    if (!IMAGE_BUCKETS.includes(result)) {
      console.warn(`[BucketSelection] Invalid bucket ${result} for ${nodeId}, using fallback 256`);
      return 256;
    }
    
    return result;
  }, [viewportCenter, dimensions.width, dimensions.height, currentTransform.scale]);

  // Phase 2: Use extracted calculateLODTier function (wrapping for local tierState access)
  const calculateLODTierLocal = useCallback((scale) => {
    return calculateLODTier(scale, tierState.current);
  }, []);

  // Performance telemetry
  const frameStatsRef = useRef({
    tier: 1,
    nodesDrawn: 0,
    edgesDrawn: 0,
    lastLogTime: Date.now(),
  });

  // Setup telemetry interval with cleanup
  useEffect(() => {
    // Telemetry disabled to reduce console spam
    return;
  }, []);

  // Performance metrics tracking (Phase 1 Optimization)
  const performanceMetrics = useRef({
    paragraphCacheHits: 0,
    paragraphCacheMisses: 0,
    imageCacheHits: 0,
    imageCacheMisses: 0,
    avgNodesRendered: 0,
    lastLogTime: Date.now(),
  });

  // Log performance metrics every 5 seconds in dev mode (DISABLED)
  useEffect(() => {
    // Disabled to reduce console spam
    return;

    // eslint-disable-next-line no-unreachable
    if (!__DEV__) return;

    const interval = setInterval(() => {
      const hits = paragraphCacheHits;
      const misses = paragraphCacheMisses;
      const total = hits + misses;
      const hitRate = total > 0 ? ((hits / total) * 100).toFixed(1) : '0.0';

      const imageStats = skiaImageCache.getStats();

      console.log('📊 [TreeView Performance]', {
        paragraphCache: {
          hits,
          misses,
          hitRate: `${hitRate}%`,
          size: paragraphCache.size,
        },
        imageCache: imageStats,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Force RTL for Arabic text
  useEffect(() => {
    I18nManager.forceRTL(true);
  }, []);

  // Notify parent component when network error status changes
  useEffect(() => {
    if (onNetworkStatusChange) {
      onNetworkStatusChange(!!networkError);
    }
  }, [networkError, onNetworkStatusChange]);

  // Create ref to hold current values for gestures
  const gestureStateRef = useRef({
    transform: { x: 0, y: 0, scale: 1 },
    tier: 1,
    indices: null,
    visibleNodes: [],
  });

  // Load SF Arabic asset font and register with Paragraph font collection
  useEffect(() => {
    if (!arabicFontProvider || sfArabicRegistered) return;
    (async () => {
      try {
        const asset = Asset.fromModule(SF_ARABIC_ASSET);
        if (!asset.downloaded) {
          await asset.downloadAsync();
        }
        const uri = asset.localUri || asset.uri;
        if (!uri) return;
        const data = await Skia.Data.fromURI(uri);
        if (!data) return;
        const tf = Skia.Typeface.MakeFreeTypeFaceFromData(data);
        if (!tf) return;
        arabicFontProvider.registerFont(tf, SF_ARABIC_ALIAS);
        arabicTypeface = tf;
        sfArabicRegistered = true;
        setFontReady((v) => !v);
      } catch (e) {
        // Ignore loading errors; fall back to system fonts
      }
    })();
  }, []);

  // Gesture shared values
  const scale = useSharedValue(stage.scale);
  const translateX = useSharedValue(stage.x);
  const translateY = useSharedValue(stage.y);
  const savedScale = useSharedValue(stage.scale);
  const savedTranslateX = useSharedValue(stage.x);
  const savedTranslateY = useSharedValue(stage.y);
  const isPinching = useSharedValue(false);
  // Initial focal point tracking for proper zoom+pan on physical devices
  const initialFocalX = useSharedValue(0);
  const initialFocalY = useSharedValue(0);

  // Phase 1 Integration - Package shared values for gesture functions
  const gestureSharedValues = {
    scale,
    translateX,
    translateY,
    savedScale,
    savedTranslateX,
    savedTranslateY,
    isPinching,
    initialFocalX,
    initialFocalY,
  };

  // Phase 2 Day 10a / Phase 3B: Tree data loading with progressive loading support
  // Progressive loading: Use two-phase strategy (structure + enrichment)
  // Traditional loading: Use full tree with real-time subscriptions
  const progressiveResult = USE_PROGRESSIVE_LOADING
    ? useProgressiveTreeView(stage, dimensions)
    : null;

  // TRADITIONAL LOADER - COMMENTED OUT (Progressive loading enabled via USE_PROGRESSIVE_LOADING=true)
  // Kept as fallback if progressive loading needs to be disabled
  // const traditionalResult = !USE_PROGRESSIVE_LOADING
  //   ? useTreeDataLoader({
  //       setTreeData,
  //       setIsLoading,
  //       setNetworkError,
  //       setShowSkeleton,
  //       setIsRetrying,
  //       skeletonFadeAnim,
  //       contentFadeAnim,
  //       settingsRef,
  //     })
  //   : null;
  const traditionalResult = null;

  // Unified API: Both loading strategies update the Zustand store
  // For progressive loading, we create stub functions since it handles loading internally
  const { loadTreeData, handleRetry } = USE_PROGRESSIVE_LOADING
    ? {
        loadTreeData: async () => {
          console.log('🔄 [Progressive] Reload triggered - clearing store to restart progressive loading');
          // Progressive loading will automatically reload on store reset
          store.actions.setTreeData([]);
        },
        handleRetry: async () => {
          console.log('🔄 [Progressive] Retry triggered - clearing store to restart progressive loading');
          // Progressive loading will automatically retry on next render
          store.actions.setTreeData([]);
        },
      }
    : traditionalResult;

  // SIMPLIFIED: Use progressive loading results directly (already calculated layout)
  // Progressive hook handles: Phase 1 (load structure) + Phase 2 (calculate layout)
  // No duplicate calculation needed - just use the result
  // NOTE: Progressive hook returns { treeData, connections } - rename treeData to nodes
  const { treeData: nodes = [], connections = [] } = progressiveResult || { treeData: [], connections: [] };

  // Build indices for node lookup and relationships with O(N) complexity
  const indices = useMemo(() => {
    if (nodes.length === 0) {
      return {
        idToNode: new Map(),
        parentToChildren: new Map(),
        depths: {},
        subtreeSizes: {},
        centroids: {},
        heroes: new Set(),
        heroNodes: [],
      };
    }

    const idToNode = new Map();
    const parentToChildren = new Map();
    const depths = {};
    const subtreeSizes = {};
    const sumX = {};
    const sumY = {};
    const centroids = {};

    // Build maps - only truthy father_id
    nodes.forEach((node) => {
      idToNode.set(node.id, node);
      if (node.father_id) {
        if (!parentToChildren.has(node.father_id)) {
          parentToChildren.set(node.father_id, []);
        }
        parentToChildren.get(node.father_id).push(node);
      }
    });

    // BUG #14 FIX: Populate node.children property from parentToChildren map
    nodes.forEach((node) => {
      node.children = parentToChildren.get(node.id) || [];
    });

    // BFS for depths
    const root = nodes.find((n) => !n.father_id);
    if (!root) {
      console.error("No root node found!");
      return {
        idToNode,
        parentToChildren,
        depths: {},
        subtreeSizes: {},
        centroids: {},
        heroes: new Set(),
        heroNodes: [],
      };
    }

    const queue = [{ id: root.id, depth: 0 }];
    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      depths[id] = depth;
      const children = parentToChildren.get(id) || [];
      children.forEach((child) =>
        queue.push({ id: child.id, depth: depth + 1 }),
      );
    }

    // Iterative post-order for subtree sizes and centroids
    const stack = [root.id];
    const visited = new Set();
    const postOrder = [];

    while (stack.length > 0) {
      const nodeId = stack[stack.length - 1];
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        const children = parentToChildren.get(nodeId) || [];
        children.forEach((child) => stack.push(child.id));
      } else {
        stack.pop();
        postOrder.push(nodeId);
      }
    }

    // Calculate sizes and centroids (no reverse - already in correct order)
    postOrder.forEach((nodeId) => {
      const node = idToNode.get(nodeId);
      const children = parentToChildren.get(nodeId) || [];

      // Subtree sizes
      subtreeSizes[nodeId] =
        1 + children.reduce((sum, child) => sum + subtreeSizes[child.id], 0);

      // Sum positions for centroid
      sumX[nodeId] =
        node.x + children.reduce((sum, child) => sum + sumX[child.id], 0);
      sumY[nodeId] =
        node.y + children.reduce((sum, child) => sum + sumY[child.id], 0);

      // Compute centroid
      centroids[nodeId] = {
        x: sumX[nodeId] / subtreeSizes[nodeId],
        y: sumY[nodeId] / subtreeSizes[nodeId],
      };
    });

    // Select heroes: root + top 2 gen-2 with children (depth === 1)
    const gen2Nodes = nodes.filter((n) => depths[n.id] === 1);
    const gen2WithKids = gen2Nodes.filter(
      (n) => (parentToChildren.get(n.id) || []).length > 0,
    );
    const heroGen2 = gen2WithKids
      .sort((a, b) => subtreeSizes[b.id] - subtreeSizes[a.id])
      .slice(0, 2);

    return {
      idToNode,
      parentToChildren,
      depths,
      subtreeSizes,
      centroids,
      heroes: new Set([root.id, ...heroGen2.map((n) => n.id)]),
      heroNodes: [root, ...heroGen2],
    };
  }, [nodes]);

  // Create spatial grid for efficient culling
  const spatialGrid = useMemo(() => {
    if (nodes.length === 0) return null;
    return new SpatialGrid(nodes);
  }, [nodes]);

  // Calculate tree bounds
  const treeBounds = useMemo(() => {
    if (nodes.length === 0)
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };

    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [nodes]);

  // Note: visibleBounds is now derived from currentTransform (see useMemo above)

  // Derived visible bounds - auto-updates when currentTransform changes
  // Replaces manual setVisibleBounds calls (React best practice)
  const visibleBounds = useMemo(() => {
    const dynamicMarginX = VIEWPORT_MARGIN_X / currentTransform.scale;
    const dynamicMarginY = VIEWPORT_MARGIN_Y / currentTransform.scale;

    return {
      minX: (-currentTransform.x - dynamicMarginX) / currentTransform.scale,
      maxX: (-currentTransform.x + dimensions.width + dynamicMarginX) / currentTransform.scale,
      minY: (-currentTransform.y - dynamicMarginY) / currentTransform.scale,
      maxY: (-currentTransform.y + dimensions.height + dynamicMarginY) / currentTransform.scale,
    };
  }, [currentTransform.x, currentTransform.y, currentTransform.scale, dimensions.width, dimensions.height]);

  // Calculate viewport center in canvas coordinates for distance-based quality
  const viewportCenter = useMemo(() => {
    return {
      x: (-currentTransform.x + dimensions.width / 2) / currentTransform.scale,
      y: (-currentTransform.y + dimensions.height / 2) / currentTransform.scale,
    };
  }, [currentTransform.x, currentTransform.y, currentTransform.scale, dimensions.width, dimensions.height]);

  // Track last stable scale to detect significant changes
  const lastStableScale = useRef(1);

  // Track viewport center for pan-based quality updates
  const lastViewportCenter = useRef({ x: 0, y: 0 });
  const [panTrigger, setPanTrigger] = useState(0);

  // Helper: Sync transform and bounds from animated values (on-demand, not continuous)
  // Called on gesture end and before user actions (tap, overlay, search)
  // visibleBounds now derives automatically from currentTransform (see useMemo below)
  const syncTransform = useCallback(() => {
    const current = {
      x: translateX.value,
      y: translateY.value,
      scale: scale.value,
    };

    // Transform sync logging disabled to reduce spam
    // if (__DEV__) console.log(
    //   `[TreeView] syncTransform: scale=${current.scale.toFixed(2)}, ` +
    //     `x=${current.x.toFixed(0)}, y=${current.y.toFixed(0)}`
    // );

    setCurrentTransform(current);
    setCurrentScale(current.scale);

    // Simple LOD: Show/hide photos based on zoom level
    // Photos disabled at scale < 0.4 to save memory when zoomed out
    frameStatsRef.current.tier = 1; // Always T1 (full cards), just toggle photos
  }, []);

  // Viewport-based loading implemented via Progressive Loading (Phase 3B)
  // See useProgressiveTreeView() hook for implementation

  // Recalculate viewport bounds when LAYOUT-AFFECTING settings change
  // This ensures visibleNodes filters correctly after layout recalculation
  useEffect(() => {
    // Safety check: Skip if nodes not loaded yet
    if (nodes.length === 0) {
      return;
    }

    // Safety check: Skip if dimensions not initialized (screen size not ready)
    if (dimensions.width === 0 || dimensions.height === 0) {
      return;
    }

    syncTransform();
  }, [layoutAffectingSettings, syncTransform, nodes.length, dimensions.width, dimensions.height]);

  // Track previous visible nodes for debugging
  const prevVisibleNodesRef = useRef(new Set());

  // Filter visible nodes for performance
  const visibleNodes = useMemo(() => {
    const startTime = performance.now();

    // Only update visibility if scale changed significantly (>5%)
    const scaleChanged =
      Math.abs(currentScale - lastStableScale.current) /
        lastStableScale.current >
      0.05;
    if (scaleChanged) {
      lastStableScale.current = currentScale;
    }

    const visible = nodes.filter(
      (node) =>
        node.x >= visibleBounds.minX &&
        node.x <= visibleBounds.maxX &&
        node.y >= visibleBounds.minY &&
        node.y <= visibleBounds.maxY,
    );

    // DEBUG: Track visibility changes
    if (__DEV__) {
      const currentVisibleIds = new Set(visible.map((n) => n.id));
      const prevVisibleIds = prevVisibleNodesRef.current;

      // Find nodes that entered/exited view
      const entered = [];
      const exited = [];

      currentVisibleIds.forEach((id) => {
        if (!prevVisibleIds.has(id)) {
          const node = visible.find((n) => n.id === id);
          entered.push(node);
        }
      });

      prevVisibleIds.forEach((id) => {
        if (!currentVisibleIds.has(id)) {
          const node = nodes.find((n) => n.id === id);
          if (node) exited.push(node);
        }
      });

      // if (entered.length > 0 || exited.length > 0) {
      //   console.log(`👁️ VISIBILITY: ${prevVisibleIds.size}→${currentVisibleIds.size} nodes | +${entered.length} -${exited.length} | ${(performance.now() - startTime).toFixed(1)}ms`);
      //
      //   // Warn about large visibility changes that might cause jumping
      //   if (entered.length + exited.length > 20) {
      //     console.log(`  ⚠️ LARGE CHANGE: ${entered.length + exited.length} nodes changed visibility!`);
      //     console.log(`  Viewport: X[${visibleBounds.minX.toFixed(0)}, ${visibleBounds.maxX.toFixed(0)}] Y[${visibleBounds.minY.toFixed(0)}, ${visibleBounds.maxY.toFixed(0)}]`);
      //   }
      //
      //   // Only log details if few changes
      //   if (entered.length > 0 && entered.length <= 5) {
      //     console.log(`  Entered: ${entered.map(n => `${n.name}(${n.x.toFixed(0)},${n.y.toFixed(0)})`).join(', ')}`);
      //   }
      //   if (exited.length > 0 && exited.length <= 5) {
      //     console.log(`  Exited: ${exited.map(n => `${n.name}(${n.x.toFixed(0)},${n.y.toFixed(0)})`).join(', ')}`);
      //   }
      // }

      prevVisibleNodesRef.current = currentVisibleIds;
    }

    return visible;
  }, [nodes, visibleBounds, currentScale]);

  // Detect significant pan changes and trigger bucket re-evaluation (debounced)
  useEffect(() => {
    // Skip if viewportCenter is not ready
    if (!viewportCenter || typeof viewportCenter.x !== 'number') {
      return;
    }

    // Debounce pan detection to avoid excessive triggering
    const timeoutId = setTimeout(() => {
      const dx = viewportCenter.x - lastViewportCenter.current.x;
      const dy = viewportCenter.y - lastViewportCenter.current.y;
      const panDistance = Math.sqrt(dx * dx + dy * dy);
      
      // Trigger re-evaluation if panned more than 150 pixels (canvas coordinates)
      // Reduced threshold to be more responsive while avoiding excessive triggers
      const panThreshold = 150;
      
      if (panDistance > panThreshold) {
        lastViewportCenter.current = { x: viewportCenter.x, y: viewportCenter.y };
        
        // Force bucket re-evaluation by incrementing trigger
        setPanTrigger(prev => prev + 1);
        
        if (__DEV__ && false) { // Disabled to reduce console spam
          console.log(`[PanQuality] Significant pan detected: ${panDistance.toFixed(0)}px, triggering quality re-evaluation`);
        }
      }
    }, 100); // 100ms debounce to avoid excessive triggering

    return () => clearTimeout(timeoutId);
  }, [viewportCenter]);

  // Debounced prefetch function to prevent rapid-fire updates
  const debouncedPrefetch = useDebounce(
    useCallback((visibleNodeList, indicesObj) => {
      if (!visibleNodeList.length) return;

      const startTime = __DEV__ ? performance.now() : 0;

      // Create a set of visible node IDs for O(1) lookup
      const visibleIds = new Set(visibleNodeList.map((n) => n.id));
      const neighborUrls = new Set();

      // Find neighbors (parents and children of visible nodes)
      // Use existing indices maps for O(1) lookups instead of O(n) array searches
      for (const node of visibleNodeList) {
        // Add parent - O(1) lookup using idToNode map
        if (node.father_id) {
          const parent = indicesObj.idToNode.get(node.father_id);
          if (parent && !visibleIds.has(parent.id) && parent.photo_url) {
            neighborUrls.add(parent.photo_url);
          }
        }

        // Add children - O(1) lookup using parentToChildren map
        const children = indicesObj.parentToChildren.get(node.id) || [];
        for (const child of children) {
          if (!visibleIds.has(child.id) && child.photo_url) {
            neighborUrls.add(child.photo_url);
          }
        }
      }

      // Prefetch up to 6 unique URLs
      const urlsToPreload = Array.from(neighborUrls).slice(0, 6);
      urlsToPreload.forEach((url) => {
        skiaImageCache.prefetch(url, 256).catch(() => {
          // Prefetch errors are non-fatal, ignore
        });
      });

      if (__DEV__) {
        const duration = performance.now() - startTime;
        console.log(
          `[TreeView] Prefetch completed in ${duration.toFixed(2)}ms ` +
            `(${visibleNodeList.length} visible nodes, ${urlsToPreload.length} URLs to preload)`
        );
      }
    }, []),
    300 // 300ms debounce delay
  );

  // Prefetch neighbor nodes for better performance (debounced)
  useEffect(() => {
    debouncedPrefetch(visibleNodes, indices);
  }, [visibleNodes, indices, debouncedPrefetch]);

  // Track previous visible connections for debugging
  const prevVisibleConnectionsRef = useRef(0);

  // Filter visible connections
  const visibleConnections = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visible = connections.filter((conn) => {
      return (
        visibleNodeIds.has(conn.parent.id) ||
        conn.children.some((child) => visibleNodeIds.has(child.id))
      );
    });

    // DEBUG: Track connection visibility changes
    // if (__DEV__ && visible.length !== prevVisibleConnectionsRef.current) {
    //   console.log(`🔗 CONNECTIONS: ${prevVisibleConnectionsRef.current}→${visible.length}`);
    //   prevVisibleConnectionsRef.current = visible.length;
    // }

    return visible;
  }, [connections, visibleNodes]);

  // Pass 3: Invisible bridge check - horizontal sibling lines intersecting viewport
  // Skip bridge segments for bezier curves since they don't use horizontal lines
  const bridgeSegments = useMemo(() => {
    const result = [];
    if (!connections || !Array.isArray(connections) || lineStyle === "bezier") {
      return result;
    }
    for (const conn of connections) {
      if (
        !conn ||
        !conn.children ||
        !Array.isArray(conn.children) ||
        conn.children.length === 0
      )
        continue;

      const parentX = conn.parent.x;
      const parentY = conn.parent.y;

      // Use PathCalculator for bus line calculations
      const busY = calculateBusY(conn.parent, conn.children);
      const shouldHaveBus = shouldRenderBusLine(conn.children, conn.parent);

      // Calculate horizontal span for viewport culling
      const busLine = calculateBusLine(conn.children, busY);
      const minChildX = busLine.startX;
      const maxChildX = busLine.endX;
      if (!shouldHaveBus) continue;

      // Intersection test with viewport in canvas coords
      const intersects =
        busY >= visibleBounds.minY &&
        busY <= visibleBounds.maxY &&
        maxChildX >= visibleBounds.minX &&
        minChildX <= visibleBounds.maxX;

      if (intersects) {
        result.push({
          id: `bridge-${conn.parent.id}-${busY}`,
          y: busY,
          x1: minChildX,
          x2: maxChildX,
        });
      }
    }
    return result;
  }, [connections, visibleBounds, lineStyle]);

  // Initialize position on first load - smart positioning based on user
  useEffect(() => {
    if (
      nodes.length > 0 &&
      stage.x === 0 &&
      stage.y === 0 &&
      stage.scale === 1
    ) {
      // Determine target node (matches NavigateToRootButton logic)
      let targetNode = null;
      const focusPersonId = linkedProfileId || profile?.id;

      if (focusPersonId) {
        // Try to find user's linked profile
        targetNode = nodes.find((n) => n.id === focusPersonId);
      }

      if (!targetNode) {
        // Fallback to root node
        targetNode = nodes.find((n) => !n.father_id);
      }

      if (targetNode) {
        // Calculate centered position (matches NavigateToRootButton)
        const isRoot = !targetNode.father_id;
        const adjustedY = isRoot ? targetNode.y - 80 : targetNode.y;
        const targetScale = 1.0;
        const offsetX = dimensions.width / 2 - targetNode.x * targetScale;
        const offsetY = dimensions.height / 2 - adjustedY * targetScale;

        // INSTANT placement - NO animation
        translateX.value = offsetX;
        translateY.value = offsetY;
        savedTranslateX.value = offsetX;
        savedTranslateY.value = offsetY;

        setStage({ x: offsetX, y: offsetY, scale: targetScale });
        // Fix race condition: Update currentTransform so visibleBounds derives correctly
        setCurrentTransform({ x: offsetX, y: offsetY, scale: targetScale });
      } else {
        // Fallback to old centering logic if no target found
        const offsetX =
          dimensions.width / 2 - (treeBounds.minX + treeBounds.maxX) / 2;
        const offsetY = 80;

        translateX.value = offsetX;
        translateY.value = offsetY;
        savedTranslateX.value = offsetX;
        savedTranslateY.value = offsetY;

        setStage({ x: offsetX, y: offsetY, scale: 1 });
        // Fix race condition: Update currentTransform so visibleBounds derives correctly
        setCurrentTransform({ x: offsetX, y: offsetY, scale: 1 });
      }
    }
  }, [nodes, dimensions, treeBounds, linkedProfileId, profile?.id]);

  // Highlight node with elegant golden effect using Reanimated
  const highlightNode = useCallback((nodeId) => {
    // Force re-trigger by incrementing trigger counter
    setGlowTrigger((prev) => prev + 1);

    // Set the highlighted node
    highlightedNodeId.value = nodeId;

    // Immediately hide any existing glow
    glowOpacity.value = 0;

    // Fade in and hold (matches path behavior - stays visible until X clicked)
    glowOpacity.value = withDelay(
      350, // Match camera flight delay
      withTiming(0.55, {
        duration: 400,
        easing: Easing.out(Easing.ease),
      })
    );

    // Haptic feedback with impact
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  // Navigate to a specific node with animation
  const navigateToNode = useCallback(
    (nodeId) => {
      console.log("Attempting to navigate to node:", nodeId);

      // Find the node in the current nodes array (not indices)
      // This ensures we always use fresh coordinates
      const targetNode = nodes.find((n) => n.id === nodeId);

      if (!targetNode) {
        console.warn("Node not found in current nodes:", nodeId);
        console.log("Total nodes in tree:", nodes.length);
        // Show alert if node is not loaded
        Alert.alert(
          "العقدة غير موجودة",
          "هذا الشخص غير محمّل في الشجرة الحالية. قد تحتاج إلى التنقل إلى فرع آخر.",
          [{ text: "حسناً" }],
        );
        return;
      }

      console.log("Found node at coordinates:", targetNode.x, targetNode.y);

      // Calculate the target scale (zoom level)
      // Use current scale if reasonable, otherwise zoom to readable level
      const currentScale = scale.value;
      const targetScale =
        currentScale < 0.8 || currentScale > 3 ? 1.5 : currentScale;

      // CORRECT FORMULA: To center a node on screen
      // We want: node canvas position * scale + translate = screen center
      // So: targetNode.x * targetScale + translateX = width/2
      // Therefore: translateX = width/2 - targetNode.x * targetScale
      const targetX = dimensions.width / 2 - targetNode.x * targetScale;
      const targetY = dimensions.height / 2 - targetNode.y * targetScale;

      console.log("Current scale:", currentScale, "Target scale:", targetScale);
      console.log("Navigating to:", { targetX, targetY, targetScale });

      // Immediately update React state with target transform
      // This makes nodes visible during animation flight
      // visibleBounds will derive automatically from setCurrentTransform
      setCurrentTransform({ x: targetX, y: targetY, scale: targetScale });
      setCurrentScale(targetScale);

      console.log('[TreeView] Pre-set bounds for search navigation:', {
        nodeCoords: { x: targetNode.x, y: targetNode.y },
      });

      // Cancel any ongoing animations
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(scale);

      // Track navigation ID to prevent stale callbacks from rapid navigation
      const navigationId = Date.now();
      lastNavigationRef.current = navigationId;

      // Use spring animation for more natural movement
      // Spring provides smoother deceleration than timing
      // Sync viewport AFTER spring completes (~840ms) not scale (600ms)
      translateX.value = withSpring(targetX, {
        damping: 20,
        stiffness: 90,
        mass: 1,
      }, (finished) => {
        // Only sync if this navigation wasn't cancelled by a newer one
        if (finished && lastNavigationRef.current === navigationId) {
          runOnJS(syncTransform)();
        }
      });
      translateY.value = withSpring(targetY, {
        damping: 20,
        stiffness: 90,
        mass: 1,
      });

      // Scale uses timing for more predictable zoom
      scale.value = withTiming(targetScale, {
        duration: 600,
        easing: Easing.inOut(Easing.cubic),
      });

      // Update saved values
      savedTranslateX.value = targetX;
      savedTranslateY.value = targetY;
      savedScale.value = targetScale;

      // Determine if we need to delay the glow until after navigation settles
      const distanceMoved = Math.hypot(
        targetX - translateX.value,
        targetY - translateY.value,
      );
      const scaleDelta = Math.abs(targetScale - currentScale);

      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }

      // Trigger highlight immediately - opacity delay handles visibility during flight
      highlightNode(nodeId);
    },
    [nodes, dimensions, highlightNode, syncTransform],
  );

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
      // Cancel pending navigation syncs on unmount
      lastNavigationRef.current = null;
    };
  }, []);

  // Calculate ancestry path from node to root
  const calculateAncestryPath = useCallback((nodeId) => {
    const { nodesMap } = store.state;
    const path = [];
    const visited = new Set();
    let current = nodeId;
    let depth = 0;

    while (current && depth < 50) { // Max 50 generations failsafe
      // Check for circular references
      if (visited.has(current)) {
        console.error(`Circular reference detected at node ${current}`);
        break;
      }
      visited.add(current);
      path.push(current);

      // Get parent node
      const node = nodesMap.get(current);
      if (!node) {
        console.warn(`Node ${current} not found in nodesMap`);
        break;
      }

      // Check if reached root
      if (!node.father_id) {
        // Reached root (or orphaned node)
        break;
      }

      current = node.father_id;
      depth++;
    }

    if (depth >= 50) {
      console.warn('Ancestry path exceeded max depth of 50 generations');
    }

    return path;
  }, []);

  // Calculate and display user lineage when toggle is ON (UNIFIED SYSTEM)
  useEffect(() => {
    // Only calculate if toggle is ON and user has profile
    if (highlightMyLine && authProfile?.id && nodes.length > 0) {
      // Use NEW unified system
      const pathData = calculatePathData('USER_LINEAGE', authProfile.id);

      if (!pathData || pathData.pathNodeIds.length === 0) {
        // User not in loaded tree
        Alert.alert(
          "غير موجود في العرض الحالي",
          "ملفك الشخصي غير محمل في الشجرة الحالية. استخدم البحث للانتقال إليه.",
          [{ text: "حسناً", style: "default" }]
        );

        // Clear user lineage
        setActiveHighlights(prev => ({
          ...prev,
          userLineage: null
        }));
      } else {
        // Set in unified state
        setActiveHighlights(prev => ({
          ...prev,
          userLineage: pathData
        }));

        // Fade in if no search/cousin marriage highlight active
        if (!activeHighlights.search && !activeHighlights.cousinMarriage) {
          cancelAnimation(pathOpacity);
          pathOpacity.value = withTiming(0.52, {
            duration: 400,
            easing: Easing.out(Easing.ease)
          });
        }
      }
    } else {
      // Toggle OFF or no profile - clear user lineage
      if (activeHighlights.userLineage) {
        cancelAnimation(pathOpacity);
        pathOpacity.value = withTiming(0, {
          duration: 300,
          easing: Easing.in(Easing.ease)
        });
        setTimeout(() => {
          setActiveHighlights(prev => ({
            ...prev,
            userLineage: null
          }));
        }, 300);
      }
    }
  }, [highlightMyLine, authProfile?.id, nodes.length, calculatePathData, pathOpacity]);

  // Clear all highlights (glow + path) - called when X button clicked
  const clearAllHighlights = useCallback(() => {
    // Clear glow
    glowOpacity.value = withTiming(0, {
      duration: 300,
      easing: Easing.in(Easing.ease),
    });

    // Clear path
    pathOpacity.value = withTiming(0, {
      duration: 300,
      easing: Easing.in(Easing.ease),
    });

    // Clear state after animation completes
    setTimeout(() => {
      highlightedNodeId.value = null;

      // Use setState callback to avoid stale closure
      setActiveHighlights(prev => {
        const shouldRestoreLineage = highlightMyLine && prev.userLineage;

        const next = {
          ...prev,
          search: null,
          cousinMarriage: null
        };

        // Restore user lineage if toggle is ON (using fresh state from prev)
        if (shouldRestoreLineage) {
          pathOpacity.value = withDelay(
            100,
            withTiming(0.52, {
              duration: 400,
              easing: Easing.out(Easing.ease)
            })
          );
        }

        return next;
      });
    }, 300);
  }, [glowOpacity, pathOpacity, highlightedNodeId, highlightMyLine]);

  // Clear ancestry path highlight (legacy - use clearAllHighlights instead)
  const clearPathHighlight = useCallback(() => {
    // Animate out
    pathOpacity.value = withTiming(0, {
      duration: 300,
      easing: Easing.in(Easing.ease),
    });

    // Clear state after animation
    setTimeout(() => {
      setHighlightedPathNodeIds(null);
    }, 300);
  }, [pathOpacity]);

  // Handle highlight from navigation params (single profile)
  useEffect(() => {
    if (highlightProfileId && focusOnProfile && nodes.length > 0) {
      // Small delay to ensure tree is fully rendered
      const timer = setTimeout(() => {
        navigateToNode(highlightProfileId);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [highlightProfileId, focusOnProfile, nodes.length]); // Don't include navigateToNode to avoid infinite loops

  // Handle cousin marriage dual-path highlighting from navigation params (Munasib Manager)
  useEffect(() => {
    if (spouse1Id && spouse2Id && focusOnProfile && nodes.length > 0) {
      // Small delay to ensure tree is fully rendered
      const timer = setTimeout(() => {
        // Validate both spouses are in loaded tree
        const nodesMap = store.state.nodesMap;
        if (!nodesMap.has(spouse1Id) || !nodesMap.has(spouse2Id)) {
          console.warn(`[TreeView] Spouse IDs not in loaded tree: ${spouse1Id}, ${spouse2Id}`);
          Alert.alert(
            "العقدة غير محملة",
            "أحد الزوجين أو كلاهما غير موجود في العرض الحالي.",
            [{ text: "حسناً", style: "default" }]
          );
          return;
        }

        // Calculate dual paths
        const dualPathData = calculatePathData('COUSIN_MARRIAGE', [spouse1Id, spouse2Id]);

        if (dualPathData) {
          setActiveHighlights(prev => ({
            ...prev,
            cousinMarriage: dualPathData,
            search: null
          }));

          // Animate paths in
          pathOpacity.value = withDelay(
            600,
            withTiming(0.6, {
              duration: 600,
              easing: Easing.out(Easing.ease)
            })
          );

        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [spouse1Id, spouse2Id, focusOnProfile, nodes.length, calculatePathData, pathOpacity]);

  // Handle cousin marriage highlighting from Zustand store (set by nested components like TabFamily)
  const { pendingCousinHighlight } = store.state;

  useEffect(() => {
    if (pendingCousinHighlight && nodes.length > 0) {
      const { spouse1Id, spouse2Id, highlightProfileId } = pendingCousinHighlight;

      // Small delay to ensure tree is fully rendered
      const timer = setTimeout(() => {
        // Validate both spouses are in loaded tree
        const nodesMap = store.state.nodesMap;
        if (!nodesMap.has(spouse1Id) || !nodesMap.has(spouse2Id)) {
          console.warn(`[TreeView] Spouse IDs not in loaded tree: ${spouse1Id}, ${spouse2Id}`);
          return;
        }

        // Navigate to highlighted profile (cousin wife)
        if (highlightProfileId) {
          navigateToNode(highlightProfileId);
        }

        // Calculate dual paths
        const dualPathData = calculatePathData('COUSIN_MARRIAGE', [spouse1Id, spouse2Id]);

        if (dualPathData) {
          setActiveHighlights(prev => ({
            ...prev,
            cousinMarriage: dualPathData,
            search: null
          }));

          // Animate paths in
          pathOpacity.value = withDelay(
            600,
            withTiming(0.6, {
              duration: 600,
              easing: Easing.out(Easing.ease)
            })
          );

          console.log(`[TreeView] Cousin marriage dual paths activated from Zustand`);
        }

        // Clear the pending highlight (consumed)
        store.actions.setPendingCousinHighlight(null);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [pendingCousinHighlight, nodes.length, calculatePathData, pathOpacity, navigateToNode]);

  // Handle search result selection
  const handleSearchResultSelect = useCallback(
    (result) => {
      console.log("Search result selected:", result);

      // Check if the node is in the current nodes array
      const nodeExists = nodes.some((n) => n.id === result.id);

      if (nodeExists) {
        console.log("Node found in tree, navigating");

        // Cancel existing animations first
        cancelAnimation(glowOpacity);
        cancelAnimation(pathOpacity);

        // Navigate to node (includes camera flight + glow)
        navigateToNode(result.id);

        // Get profile data from nodesMap
        const nodesMap = store.state.nodesMap;
        const selectedProfile = nodesMap.get(result.id);

        if (selectedProfile) {
          console.log('[TreeView] Selected profile:', {
            id: selectedProfile.id,
            name: selectedProfile.name,
            hid: selectedProfile.hid,
            hasMarriages: !!selectedProfile.marriages,
            marriageCount: selectedProfile.marriages?.length || 0
          });

          // Check if this profile has any cousin marriages
          const cousinMarriages = detectCousinMarriage(selectedProfile, nodesMap);

          console.log('[TreeView] Cousin marriage detection result:', {
            found: cousinMarriages.length,
            cousinMarriages: cousinMarriages.map(cm => ({
              spouseId: cm.spouse.id,
              spouseName: cm.spouse.name,
              spouseHid: cm.spouse.hid
            }))
          });

          if (cousinMarriages.length > 0) {
            // Cousin marriage detected - use dual-path highlighting
            const spouse = cousinMarriages[0].spouse; // Use first cousin marriage
            console.log(`[TreeView] Cousin marriage detected between ${result.id} and ${spouse.id}`);

            const dualPathData = calculatePathData('COUSIN_MARRIAGE', [result.id, spouse.id]);

            if (dualPathData) {
              setActiveHighlights(prev => ({
                ...prev,
                search: null, // Clear single path
                cousinMarriage: dualPathData
              }));

              // Animate path in (after camera settles)
              pathOpacity.value = withDelay(
                600,
                withTiming(0.6, {
                  duration: 600,
                  easing: Easing.out(Easing.ease)
                })
              );

              console.log(`Highlighted cousin marriage dual paths`);
            }
          } else {
            // No cousin marriage - use standard single-path highlighting
            const singlePathData = calculatePathData('SEARCH', result.id);

            if (singlePathData) {
              setActiveHighlights(prev => ({
                ...prev,
                search: singlePathData,
                cousinMarriage: null // Clear dual path
              }));

              // Animate path in (after camera settles)
              pathOpacity.value = withDelay(
                600,
                withTiming(0.65, {
                  duration: 400,
                  easing: Easing.out(Easing.ease)
                })
              );

              console.log(`Highlighted ${singlePathData.pathNodeIds.length}-node ancestry path`);
            }
          }
        }
      } else {
        console.log("Node not in current tree view");
        Alert.alert(
          "العقدة غير محملة",
          "هذه العقدة غير موجودة في العرض الحالي. قم بتحميل المزيد من الشجرة لرؤيتها.",
          [{ text: "حسناً", style: "default" }],
        );
      }
    },
    [navigateToNode, nodes, calculatePathData, glowOpacity, pathOpacity],
  );

  // Phase 2 Integration - Gesture callbacks for extracted gesture functions
  // Memoized to prevent recreation on every render (performance optimization)
  const gestureCallbacks = useMemo(() => ({
    // Called when pan/pinch ends (for transform sync)
    onGestureEnd: () => {
      syncTransform();
    },

    // Phase 3 - Called when tap detected (with pre-sync and hit detection)
    onTap: (x, y) => {
      // 1. Sync transform FIRST (critical for accurate coordinates)
      syncTransform();

      // 2. Update gestureStateRef with fresh transform values
      gestureStateRef.current = {
        ...gestureStateRef.current,
        transform: {
          x: translateX.value,
          y: translateY.value,
          scale: scale.value,
        },
      };

      // 3. Perform hit detection using extracted detectTap function
      const result = detectTap(
        x,
        y,
        gestureStateRef.current,
        AGGREGATION_ENABLED,
        NODE_WIDTH_WITH_PHOTO,
        NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY,
        NODE_HEIGHT_TEXT_ONLY
      );

      // 4. Handle result based on type
      if (result?.type === 'chip') {
        handleChipTap(result.hero);
      } else if (result?.type === 'node') {
        handleNodeTap(result.nodeId);
      }
    },

    // Phase 4 - Called when long press detected (QuickAdd overlay for admin users)
    onLongPress: (x, y) => {
      // 1. Check admin permission first (QuickAdd is admin-only feature)
      if (!profile?.role || !['admin', 'super_admin', 'moderator'].includes(profile.role)) {
        return;
      }

      // 2. Sync transform before admin action for accurate coordinates
      syncTransform();

      // 3. Update gestureStateRef with fresh transform values
      gestureStateRef.current = {
        ...gestureStateRef.current,
        transform: {
          x: translateX.value,
          y: translateY.value,
          scale: scale.value,
        },
      };

      const state = gestureStateRef.current;

      // 4. Don't handle in T3 mode (QuickAdd only works in T1/T2)
      if (state.tier === 3) return;

      // 5. Perform node hit detection (reuse same logic as tap)
      const result = detectTap(
        x,
        y,
        state,
        AGGREGATION_ENABLED,
        NODE_WIDTH_WITH_PHOTO,
        NODE_HEIGHT_WITH_PHOTO,
        NODE_WIDTH_TEXT_ONLY,
        NODE_HEIGHT_TEXT_ONLY
      );

      // 6. If node hit, show QuickAdd overlay
      if (result?.type === 'node' && result.nodeId) {
        // Find the full node object from visibleNodes
        const pressedNode = state.visibleNodes.find(n => n.id === result.nodeId);
        if (pressedNode) {
          console.log('Long-press on node:', pressedNode.name, 'ID:', pressedNode.id);
          console.log('Node already has children:', pressedNode.children);

          // Haptic feedback
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          // Get children from node.children (already attached)
          const children = Array.isArray(pressedNode.children) ? pressedNode.children : [];
          console.log('Found children from node.children:', children.length);

          if (children.length > 0) {
            console.log('Children details:', children.map(c => ({
              name: c.name,
              sibling_order: c.sibling_order,
              father_id: c.father_id,
              mother_id: c.mother_id,
            })));
          }

          // Sort children by sibling_order
          children.sort((a, b) => (a.sibling_order || 0) - (b.sibling_order || 0));

          // Show quick add overlay
          setQuickAddParent(pressedNode);
          setQuickAddPosition({ x, y });
          setShowQuickAdd(true);
        }
      }
    },
  }), [
    syncTransform,
    handleChipTap,
    handleNodeTap,
    profile?.role,
    setQuickAddParent,
    setQuickAddPosition,
    setShowQuickAdd,
  ]);

  // Phase 2 Integration - Gesture configuration
  const gestureConfig = {
    decelerationRate: 0.995, // Pan momentum decay rate
    minZoom: minZoom,
    maxZoom: maxZoom,
  };

  // Phase 2 Integration - Individual gestures now created inside createComposedGesture
  // (Removed: panGesture and pinchGesture creation - now handled by createComposedGesture)


  // Handle node tap - show profile sheet (edit mode if admin)
  const handleNodeTap = useCallback(
    (nodeId) => {
      // console.log('TreeView: Node tapped, isAdminMode:', isAdminMode);

      // Clear search highlight when tapping any node
      clearAllHighlights();

      setSelectedPersonId(nodeId);
      setProfileEditMode(isAdminMode);
      // console.log('TreeView: Setting profileEditMode to:', isAdminMode);
    },
    [setSelectedPersonId, isAdminMode, clearAllHighlights],
  );

  // Tap gesture for selection with movement/time thresholds
  // (Removed: tapGesture creation - now handled by createComposedGesture)


  // Long press gesture for quick add
  // (Removed: longPressGesture creation - now handled by createComposedGesture)


  const handleChipTap = useCallback(
    (hero) => {
      // Calculate bounds of hero's subtree
      const descendantIds = new Set();
      const stack = [hero.id];

      while (stack.length > 0) {
        const nodeId = stack.pop();
        descendantIds.add(nodeId);
        const children = indices.parentToChildren.get(nodeId) || [];
        children.forEach((child) => stack.push(child.id));
      }

      // Find bounds of all descendants
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      descendantIds.forEach((id) => {
        const node = indices.idToNode.get(id);
        if (node) {
          minX = Math.min(minX, node.x);
          maxX = Math.max(maxX, node.x);
          minY = Math.min(minY, node.y);
          maxY = Math.max(maxY, node.y);
        }
      });

      if (minX === Infinity) return; // No descendants found

      // Add padding
      const padding = 100;
      minX -= padding;
      maxX += padding;
      minY -= padding;
      maxY += padding;

      // Calculate target scale to fit bounds
      const boundsWidth = maxX - minX;
      const boundsHeight = maxY - minY;
      const targetScaleX = dimensions.width / boundsWidth;
      const targetScaleY = dimensions.height / boundsHeight;
      let targetScale = Math.min(targetScaleX, targetScaleY);

      // Ensure we reach at least T2 threshold
      const minScaleForT2 =
        T2_BASE / (NODE_WIDTH_WITH_PHOTO * PixelRatio.get());
      targetScale = Math.max(targetScale, minScaleForT2 * 1.2); // 20% above threshold
      targetScale = clamp(targetScale, minZoom, maxZoom);

      // Calculate center and target position
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const targetX = dimensions.width / 2 - centerX * targetScale;
      const targetY = dimensions.height / 2 - centerY * targetScale;

      // Animate to target with callback when animation completes (Phase 3B: On-demand sync)
      scale.value = withTiming(targetScale, { duration: 500 }, (finished) => {
        if (finished) {
          "worklet";
          savedScale.value = targetScale;
          savedTranslateX.value = targetX;
          savedTranslateY.value = targetY;
          runOnJS(syncTransform)();
        }
      });
      translateX.value = withTiming(targetX, { duration: 500 });
      translateY.value = withTiming(targetY, { duration: 500 });
    },
    [indices, dimensions, minZoom, maxZoom, syncTransform],
  );

  // Handle context menu actions
  const handleContextMenuAction = useCallback(
    (action) => {
      if (!contextMenuNode) return;

      switch (action) {
        case "addChildren":
          setMultiAddParent({
            id: contextMenuNode.id,
            name: contextMenuNode.name,
          });
          setShowMultiAddModal(true);
          break;
        case "addMarriage":
          setMarriagePerson(contextMenuNode);
          setShowMarriageModal(true);
          break;
        case "edit":
          setSelectedPersonId(contextMenuNode.id);
          break;
        case "viewDetails":
          setSelectedPersonId(contextMenuNode.id);
          break;
        case "delete":
          Alert.alert(
            "تأكيد الحذف",
            `هل أنت متأكد من حذف ${contextMenuNode.name}؟`,
            [
              { text: "إلغاء", style: "cancel" },
              {
                text: "حذف",
                style: "destructive",
                onPress: async () => {
                  try {
                    // Use admin RPC for profile deletion instead of direct table write
                    const { error } = await profilesService.deleteProfile(
                      contextMenuNode.id,
                      contextMenuNode.version || 1  // Add version parameter for optimistic locking
                    );

                    if (error) throw error;
                    Alert.alert("نجح", "تم حذف الملف الشخصي");
                    await loadTreeData();
                  } catch (error) {
                    // console.error('Error deleting profile:', error);
                    Alert.alert("خطأ", "فشل حذف الملف الشخصي");
                  }
                },
              },
            ],
          );
          break;
      }
    },
    [contextMenuNode, setSelectedPersonId],
  );

  // Compose gestures - allow simultaneous but with guards in each gesture
  // In readOnly mode, only allow pan and pinch (no tap or long press)
  const composed = useMemo(() => {
    if (readOnly) {
      // Pan and pinch only for read-only mode
      return Gesture.Race(
        createPanGesture(gestureSharedValues, gestureCallbacks, gestureConfig),
        createPinchGesture(gestureSharedValues, gestureCallbacks, gestureConfig)
      );
    }

    // Full gestures for normal mode
    return createComposedGesture(
      gestureSharedValues,
      gestureCallbacks,
      gestureConfig
    );
  }, [readOnly, gestureSharedValues, gestureCallbacks, gestureConfig]);


  // Legacy renderConnection function removed - now using line styles system

  // Render edges with batching and capping - Updated with line styles support
  // Pre-build all connection paths once (cached by useMemo)
  // Supports both straight lines and bezier curves based on settings
  const allBatchedEdgePaths = useMemo(() => {
    if (tier === 3) return { elements: null, count: 0 };

    // REQUIRED: Dimension guard (prevents invalid clip on first render)
    if (dimensions.width === 0 || dimensions.height === 0) {
      return { elements: null, count: 0 };
    }

    // RECOMMENDED: Early return for empty data
    if (connections.length === 0) {
      return { elements: null, count: 0 };
    }

    // RECOMMENDED: Performance logging
    let startTime;
    if (__DEV__) {
      startTime = performance.now();
    }

    // Use line styles system for unified path generation
    const currentLineStyle = lineStyle === "bezier" ? LINE_STYLES.BEZIER : LINE_STYLES.STRAIGHT;
    
    // Filter connections for viewport and apply edge limit
    const limitedConnections = connections.slice(0, Math.floor(MAX_VISIBLE_EDGES / 2)); // Conservative limit
    
    // Generate all paths using the line styles system
    const batchedResult = buildBatchedPaths(limitedConnections, currentLineStyle, showPhotos);

    // Configure line styling based on line style (bezier vs straight)
    const lineConfig = lineStyle === 'bezier'
      ? {
          color: hexToRgba(BEZIER_CONFIG.STROKE_COLOR, BEZIER_CONFIG.STROKE_OPACITY),
          width: BEZIER_CONFIG.STROKE_WIDTH
        }
      : {
          color: LINE_COLOR,
          width: LINE_WIDTH
        };

    // Convert to React elements for rendering
    const pathElements = batchedResult.elements?.map((pathData) => (
      <Path
        key={pathData.key}
        path={pathData.path}
        color={lineConfig.color}
        style="stroke"
        strokeWidth={lineConfig.width}
      />
    )) || [];

    if (__DEV__ && startTime) {
      const duration = performance.now() - startTime;
      console.log(`[TreeView] ${currentLineStyle} paths built: ${batchedResult.count} edges in ${duration.toFixed(1)}ms`);
    }

    return { elements: pathElements, count: batchedResult.count };
  },
  [connections, showPhotos, lineStyle, tier, dimensions], // Added lineStyle dependency
  );

  // Render highlighted ancestry path
  // UNIFIED RENDERING: Render all active highlights using renderer factory
  const renderAllHighlights = useCallback(() => {
    // Explicit mapping from state keys to registry keys (safer than string replacement)
    const TYPE_KEY_MAP = {
      'search': 'SEARCH',
      'userLineage': 'USER_LINEAGE',
      'cousinMarriage': 'COUSIN_MARRIAGE',
    };

    // Collect all active highlight types sorted by priority
    const activeTypes = Object.entries(activeHighlights)
      .filter(([_, data]) => data !== null)
      .map(([typeId, data]) => {
        const typeKey = TYPE_KEY_MAP[typeId];
        if (!typeKey) {
          console.warn(`[TreeView] Unknown highlight type ID: ${typeId}`);
          return { typeId, config: null, data };
        }
        const config = HIGHLIGHT_TYPES[typeKey];
        return { typeId, config, data };
      })
      .filter(({ config }) => config !== null)
      .sort((a, b) => a.config.priority - b.config.priority);

    if (activeTypes.length === 0) {
      return null;
    }

    // Render each highlight type using appropriate renderer
    const allElements = activeTypes.flatMap(({ typeId, config, data }) => {
      const renderer = createRenderer(typeId, config, data, {
        nodes,
        connections,
        showPhotos,
        pathOpacity,
        Skia,
        activeHighlights
      });

      if (!renderer) {
        console.warn(`[TreeView] Failed to create renderer for ${typeId}`);
        return [];
      }

      const elements = renderer.render();
      return elements || [];
    });

    return allElements;
  }, [activeHighlights, nodes, connections, showPhotos]); // pathOpacity is stable shared value, no need in deps

  // Render T3 aggregation chips (only 3 chips for hero branches) - Phase 2: Using extracted T3ChipRenderer
  const renderTier3 = useCallback(
    (heroNodes, indices, scale, translateX, translateY) => {
      return (
        <T3ChipRenderer
          heroNodes={heroNodes}
          indices={indices}
          scale={scale}
          translateX={translateX}
          translateY={translateY}
          arabicFont={arabicFont}
          aggregationEnabled={AGGREGATION_ENABLED}
        />
      );
    },
    [arabicFont],
  );

  // Render T2 text pill (simplified, no images) - Phase 2: Using extracted TextPillRenderer
  const renderTier2Node = useCallback(
    (node) => {
      const isSelected = selectedPersonId === node.id;

      return (
        <TextPillRenderer
          nodeId={node.id}
          name={node.name}
          x={node.x}
          y={node.y}
          isSelected={isSelected}
          getCachedParagraph={getCachedParagraph}
          onFrameCalculated={(frame) => {
            nodeFramesRef.current.set(node.id, frame);
          }}
        />
      );
    },
    [selectedPersonId, getCachedParagraph],
  );

  // Render node component (T1 - full detail) - Phase 2: Using extracted NodeRenderer
  const renderNode = useCallback(
    (node) => {
      // Use per-node photo toggle if available (from LOD), otherwise use global setting
      const shouldShowPhotos = node._showPhoto !== undefined ? node._showPhoto : showPhotos;

      return (
        <NodeRenderer
          node={node}
          showPhotos={shouldShowPhotos}
          selectedPersonId={selectedPersonId}
          heroNodes={indices?.heroNodes}
          searchTiers={indices?.searchTiers}
          getCachedParagraph={getCachedParagraph}
          SaduIcon={SaduIcon}
          SaduIconG2={G2SaduIcon}
          useBatchedSkiaImage={useBatchedSkiaImageWithMorph}
          nodeFramesRef={nodeFramesRef}
        />
      );
    },
    [selectedPersonId, indices, showPhotos, getCachedParagraph, useBatchedSkiaImageWithMorph],
  );

  // Create a derived value for the transform to avoid Reanimated warnings
  const transform = useDerivedValue(() => {
    return [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ];
  });

  // Store current tier in state
  // Always T1 (full cards) - Simple LOD just toggles photo loading
  // Updated by syncTransform callback after gestures end
  // Note: currentTransform and visibleBounds now declared at top of component
  const [tier, setTier] = useState(1);

  // Calculate culled nodes (with loading fallback)
  const culledNodes = useMemo(() => {
    if (!isTreeLoaded) return [];
    if (tier === 3) return [];
    if (!spatialGrid) return visibleNodes;

    // Add viewport padding for seamless node loading before screen edge
    return spatialGrid.getVisibleNodes(
      {
        x: currentTransform.x + VIEWPORT_MARGIN_X,
        y: currentTransform.y + VIEWPORT_MARGIN_Y,
        width: dimensions.width + (VIEWPORT_MARGIN_X * 2),
        height: dimensions.height + (VIEWPORT_MARGIN_Y * 2),
      },
      currentTransform.scale,
      indices.idToNode,
    );
  }, [
    isTreeLoaded,
    tier,
    spatialGrid,
    currentTransform,
    dimensions,
    indices.idToNode,
    visibleNodes,
  ]);

  // Render nodes with tier-based styling
  const renderNodeWithTier = useCallback(
    (node) => {
      if (!node) return null;

      const modifiedNode = {
        ...node,
        _tier: 1, // Always T1 (full cards)
        _scale: currentTransform.scale,
        _showPhoto: showPhotos, // Use user-controlled photo visibility prop
        _selectBucket: (nodeId, pixelSize) => selectBucketWithDistance(nodeId, pixelSize, node.x, node.y),
        _hasChildren: indices.parentToChildren.has(node.id),
      };
      return renderNode(modifiedNode);
    },
    [
      tier,
      showPhotos, // Changed from currentTransform.scale
      currentTransform.scale,
      renderNode,
      renderTier2Node,
      selectBucketWithDistance,
      indices,
      panTrigger, // Force re-render when pan triggers bucket re-evaluation
    ],
  );

  // Keep gestureStateRef in sync for tap gesture
  useEffect(() => {
    gestureStateRef.current = {
      transform: currentTransform,
      tier,
      indices,
      visibleNodes: culledNodes,
    };
  }, [currentTransform, tier, indices, culledNodes]);

  // Start shimmer animation for skeleton
  // IMPORTANT: This hook MUST be before any early returns to avoid React hooks error
  useEffect(() => {
    if (showSkeleton) {
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          RNAnimated.timing(shimmerAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [showSkeleton]);

  // Show loading state
  // Show network error state if there's an error
  if (networkError) {
    return (
      <NetworkStatusIndicator
        mode="fullscreen"
        errorType={networkError === 'network' ? 'network' : 'server'}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />
    );
  }

  if (showSkeleton) {
    return (
      <View style={{ flex: 1 }}>
        {/* Skeleton with fade out */}
        {showSkeleton && (
          <RNAnimated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
              opacity: skeletonOpacity,
            }}
            pointerEvents="none"
          >
            <SimpleTreeSkeleton shimmerAnim={shimmerAnim} />
          </RNAnimated.View>
        )}

        {/* Empty placeholder for tree content that will fade in */}
        <RNAnimated.View
          style={{
            flex: 1,
            opacity: contentOpacity,
          }}
        />
      </View>
    );
  }

  // Use pre-built batched edge paths (no longer a function call)
  const edgesDrawn = allBatchedEdgePaths.count;

  // Update frame stats
  frameStatsRef.current.nodesDrawn = tier === 3 ? 3 : culledNodes.length;
  frameStatsRef.current.edgesDrawn = tier === 3 ? 0 : edgesDrawn;

  // TIER 3: Only render hero chips
  if (tier === 3 && AGGREGATION_ENABLED) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F9F7F3" }}>
        <GestureDetector gesture={composed}>
          <Canvas style={{ flex: 1 }}>
            {renderTier3(
              indices.heroNodes,
              indices,
              currentTransform.scale,
              currentTransform.x,
              currentTransform.y,
            )}
          </Canvas>
        </GestureDetector>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F9F7F3" }}>
      {/* Skeleton overlay with fade out */}
      {showSkeleton && (
        <RNAnimated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10,
            opacity: skeletonOpacity,
          }}
          pointerEvents="none"
        >
          <SimpleTreeSkeleton shimmerAnim={shimmerAnim} />
        </RNAnimated.View>
      )}

      {/* Main tree content with fade in */}
      <RNAnimated.View style={{ flex: 1, opacity: contentOpacity }}>
        <GestureDetector gesture={composed}>
          <Canvas style={{ flex: 1 }}>
            {/* Static screen-space clip (camera lens) */}
            <Group clip={rect(0, 0, dimensions.width, dimensions.height)}>
              {/* Transform inside (world moves behind lens) */}
              <Group transform={transform}>
                {/* Pre-built batched paths - no rebuilding on pan/zoom */}
                {allBatchedEdgePaths.elements}

                {/* Highlighted ancestry paths (above edges, below nodes) - UNIFIED SYSTEM */}
                {renderAllHighlights()}

                {/* Render visible nodes */}
                {culledNodes.map((node) => (
                  <React.Fragment key={node.id}>{renderNodeWithTier(node)}</React.Fragment>
                ))}

                {/* Pass 3: Invisible bridge lines intersecting viewport */}
                {bridgeSegments.map((seg) => (
                  <Line
                    key={seg.id}
                    p1={vec(seg.x1, seg.y)}
                    p2={vec(seg.x2, seg.y)}
                    color={LINE_COLOR}
                    style="stroke"
                    strokeWidth={LINE_WIDTH}
                  />
                ))}

                {/* Search highlight glow (rendered on top of everything) */}
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
        </GestureDetector>
      </RNAnimated.View>

      {!hideControls && (
        <SearchBar
          onSelectResult={handleSearchResultSelect}
          onClearHighlight={clearAllHighlights}
          onNavigate={navigateToNode}
          nodes={nodes}
        />
      )}

      <NavigateToRootButton
        nodes={nodes}
        viewport={dimensions}
        sharedValues={{
          translateX: translateX,
          translateY: translateY,
          scale: scale,
        }}
        focusPersonId={navigationTarget || linkedProfileId || profile?.id}
        onNavigate={navigateToNode}
        size={readOnly ? 40 : 56}
        bottom={readOnly ? 60 : 120}
      />



      {/* Admin components */}
      {isAdminMode && (
        <>
          <SystemStatusIndicator />
        </>
      )}

      {/* Cache stats removed to reduce visual clutter */}

      {/* Node Context Menu */}
      <NodeContextMenu
        visible={showContextMenu}
        position={contextMenuPosition}
        node={contextMenuNode}
        onClose={() => setShowContextMenu(false)}
        onAction={handleContextMenuAction}
      />

      {/* Multi-add children modal */}
      {multiAddParent && (
        <MultiAddChildrenModal
          visible={showMultiAddModal}
          onClose={() => {
            setShowMultiAddModal(false);
            setMultiAddParent(null);
          }}
          parentId={multiAddParent.id}
          parentName={multiAddParent.name}
          parentGender={contextMenuNode?.gender || "male"}
        />
      )}

      {/* Marriage Editor Modal */}
      <MarriageEditor
        visible={showMarriageModal}
        person={marriagePerson}
        onClose={() => {
          setShowMarriageModal(false);
          setMarriagePerson(null);
        }}
        onCreated={async () => {
          // Reload tree data to reflect changes
          await loadTreeData();
        }}
      />

      {/* Quick Add Overlay */}
      <QuickAddOverlay
        visible={showQuickAdd}
        parentNode={quickAddParent}
        siblings={(() => {
          if (!quickAddParent) return [];

          // Use the children already attached to the parent node
          const children = Array.isArray(quickAddParent.children)
            ? quickAddParent.children
            : [];

          // Filter out any undefined/null entries
          const validChildren = children.filter(child => child && child.id);

          return validChildren.sort(
            (a, b) => (a.sibling_order || 0) - (b.sibling_order || 0),
          );
        })()}
        position={quickAddPosition}
        onClose={() => {
          setShowQuickAdd(false);
          setQuickAddParent(null);
        }}
        onSave={async () => {
          // Reload tree data to reflect changes
          await loadTreeData();
          setShowQuickAdd(false);
          setQuickAddParent(null);
        }}
      />
    </View>
  );
};

// Phase 0 Integration - Wrap TreeViewCore with context providers
// FontProvider must be outermost (loads fonts first)
// ParagraphCacheProvider depends on fonts being loaded
const TreeViewCoreWithProviders = (props) => (
  <FontProvider>
    <ParagraphCacheProvider>
      <TreeViewCore {...props} />
    </ParagraphCacheProvider>
  </FontProvider>
);

export default TreeViewCoreWithProviders;
