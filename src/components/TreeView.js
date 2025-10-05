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
  Shadow,
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
import { familyData } from "../data/family-data";
import { Asset } from "expo-asset";
import { calculateTreeLayout } from "../utils/treeLayout";
import { useTreeStore } from "../stores/useTreeStore";
import profilesService from "../services/profiles";
import { formatDateDisplay } from "../services/migrationHelpers";
import { useSettings } from "../contexts/SettingsContext";
import { useAuth } from "../contexts/AuthContextSimple";
import { formatDateByPreference } from "../utils/dateDisplay";
import NavigateToRootButton from "./NavigateToRootButton";
import { useAdminMode } from "../contexts/AdminModeContext";
import SystemStatusIndicator from "./admin/SystemStatusIndicator";
import MultiAddChildrenModal from "./admin/MultiAddChildrenModal";
import MarriageEditor from "./admin/MarriageEditor";
import skiaImageCache from "../services/skiaImageCache";
import { useCachedSkiaImage } from "../hooks/useCachedSkiaImage";
import NodeContextMenu from "./admin/NodeContextMenu";
import EditProfileScreen from "../screens/EditProfileScreen";
import QuickAddOverlay from "./admin/QuickAddOverlay";
import SearchBar from "./SearchBar";
import { supabase } from "../services/supabase";
import * as Haptics from "expo-haptics";
import NetworkErrorView from "./NetworkErrorView";
import {
  clampStageToBounds,
  createDecayModifier,
  applyRubberBand,
  DEFAULT_BOUNDS,
} from "../utils/cameraConstraints";

const VIEWPORT_MARGIN = 1200; // Nodes appear further off-screen to reduce pop-in effect
const NODE_WIDTH_WITH_PHOTO = 85;
const NODE_WIDTH_TEXT_ONLY = 60;
const NODE_HEIGHT_WITH_PHOTO = 90;
const NODE_HEIGHT_TEXT_ONLY = 35;
const PHOTO_SIZE = 60;
const LINE_COLOR = "#D1BBA340"; // Camel Hair Beige 40%
const LINE_WIDTH = 2;
const CORNER_RADIUS = 8;

// Helper function to convert hex color to rgba with opacity
const hexToRgba = (hex, alpha) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Ancestry path color palette - high-contrast 10-color cycle
// Spans warm to cool spectrum for clear generational distinction
const ANCESTRY_COLORS = [
  '#C73E3E', // Bright crimson
  '#E38740', // Vivid orange
  '#F5C555', // Warm gold
  '#9FB885', // Sage green (cool contrast)
  '#6A9AA6', // Teal (cool)
  '#8E7AB8', // Purple (brand focus family)
  '#B56B8A', // Mauve (cool-warm transition)
  '#C75A5A', // Rose
  '#D58C4A', // Desert Ochre (brand)
  '#A95252', // Deep terracotta (back to crimson)
];

// LOD Constants
const SCALE_QUANTUM = 0.05; // 5% quantization steps
const HYSTERESIS = 0.15; // ±15% hysteresis
const T1_BASE = 48; // Full card threshold (px)
const T2_BASE = 24; // Text pill threshold (px)
const MAX_VISIBLE_NODES = 350; // Hard cap per frame
const MAX_VISIBLE_EDGES = 300; // Hard cap per frame
const LOD_ENABLED = true; // Kill switch
const AGGREGATION_ENABLED = true; // T3 chips toggle

// Image bucket hysteresis constants
const BUCKET_HYSTERESIS = 0.15; // ±15% hysteresis
const BUCKET_DEBOUNCE_MS = 150; // ms

// Create font manager/provider once
let fontMgr = null;
let arabicFontProvider = null;
let arabicTypeface = null;
let arabicFont = null;
let arabicFontBold = null;
let sfArabicRegistered = false;

const SF_ARABIC_ALIAS = "SF Arabic";
const SF_ARABIC_ASSET = require("../../assets/fonts/SF Arabic Regular.ttf");

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

// Helper function to create Arabic text paragraphs with proper shaping
const createArabicParagraph = (text, fontWeight, fontSize, color, maxWidth) => {
  if (!text || !Skia.ParagraphBuilder) return null;

  try {
    const paragraphStyle = {
      textAlign: 2, // Center align (0=left, 1=right, 2=center)
      textDirection: 1, // RTL direction (0=LTR, 1=RTL)
      maxLines: 1,
      ellipsis: "...",
    };

    // If we have a matched Arabic typeface, ensure it's registered on the provider
    if (arabicTypeface && arabicFontProvider) {
      try {
        arabicFontProvider.registerFont(arabicTypeface, SF_ARABIC_ALIAS);
      } catch (e) {}
    }

    const textStyle = {
      color: Skia.Color(color),
      fontSize: fontSize,
      fontFamilies: arabicTypeface
        ? [SF_ARABIC_ALIAS]
        : [
            SF_ARABIC_ALIAS,
            ".SF Arabic",
            ".SF NS Arabic",
            ".SFNSArabic",
            "Geeza Pro",
            "GeezaPro",
            "Damascus",
            "Al Nile",
            "Baghdad",
            "System",
          ],
      fontStyle: {
        weight: fontWeight === "bold" ? 700 : 400,
      },
    };

    // Create paragraph builder
    const builder = arabicFontProvider
      ? Skia.ParagraphBuilder.Make(paragraphStyle, arabicFontProvider)
      : Skia.ParagraphBuilder.Make(paragraphStyle);

    if (!builder) return null;

    builder.pushStyle(textStyle);
    builder.addText(text);

    const paragraph = builder.build();
    if (!paragraph) return null;

    paragraph.layout(maxWidth);

    return paragraph;
  } catch (error) {
    console.error("Error creating paragraph:", error);
    return null;
  }
};

// Image buckets for LOD
const IMAGE_BUCKETS = [64, 128, 256, 512];
const selectBucket = (pixelSize) => {
  return IMAGE_BUCKETS.find((b) => b >= pixelSize) || 512;
};

// Image component for photos with skeleton loader
const ImageNode = ({
  url,
  x,
  y,
  width,
  height,
  radius,
  tier,
  scale,
  nodeId,
  selectBucket,
}) => {
  // Only load images in Tier 1
  const shouldLoad = tier === 1 && url;
  const pixelSize = width * PixelRatio.get() * scale;

  // Use hysteresis bucket selection if provided, otherwise use simple selection
  const bucket = shouldLoad
    ? selectBucket && nodeId
      ? selectBucket(nodeId, pixelSize * 2)
      : IMAGE_BUCKETS.find((b) => b >= pixelSize * 2) || 512
    : null;

  const image = shouldLoad ? useCachedSkiaImage(url, bucket) : null;

  // If no image yet, show simple skeleton placeholder
  if (!image) {
    return (
      <Group>
        {/* Base circle background */}
        <Circle cx={x + radius} cy={y + radius} r={radius} color="#D1BBA320" />
        {/* Lighter inner circle for depth */}
        <Circle
          cx={x + radius}
          cy={y + radius}
          r={radius - 1}
          color="#D1BBA310"
          style="stroke"
          strokeWidth={0.5}
        />
      </Group>
    );
  }

  // Image loaded - show it with the mask
  return (
    <Group>
      <Mask
        mode="alpha"
        mask={
          <Circle cx={x + radius} cy={y + radius} r={radius} color="white" />
        }
      >
        <SkiaImage
          image={image}
          x={x}
          y={y}
          width={width}
          height={height}
          fit="cover"
        />
      </Mask>
    </Group>
  );
};

// Sadu Icon component for root node decoration
const SaduIcon = ({ x, y, size }) => {
  const saduImage = useImage(require("../../assets/sadu_patterns/png/90.png"));

  if (!saduImage) return null;

  return (
    <Group>
      {/* Apply Najdi Crimson color tint */}
      <Group
        layer={
          <Paint>
            <ColorMatrix
              matrix={[
                0.631, 0, 0, 0, 0,   // Red channel - boost red
                0.2, 0, 0, 0, 0,     // Green channel - reduce
                0.2, 0, 0, 0, 0,     // Blue channel - reduce
                0, 0, 0, 1, 0,       // Alpha channel - preserve
              ]}
            />
          </Paint>
        }
      >
        <SkiaImage
          image={saduImage}
          x={x}
          y={y}
          width={size}
          height={size}
          fit="contain"
        />
      </Group>
    </Group>
  );
};

// Sadu Icon component for Generation 2 nodes with children
const SaduIconG2 = ({ x, y, size }) => {
  const saduImage = useImage(require("../../assets/sadu_patterns/png/73.png"));

  if (!saduImage) return null;

  return (
    <Group>
      {/* Apply Najdi Crimson color tint */}
      <Group
        layer={
          <Paint>
            <ColorMatrix
              matrix={[
                0.631, 0, 0, 0, 0,   // Red channel - boost red
                0.2, 0, 0, 0, 0,     // Green channel - reduce
                0.2, 0, 0, 0, 0,     // Blue channel - reduce
                0, 0, 0, 1, 0,       // Alpha channel - preserve
              ]}
            />
          </Paint>
        }
      >
        <SkiaImage
          image={saduImage}
          x={x}
          y={y}
          width={size}
          height={size}
          fit="contain"
        />
      </Group>
    </Group>
  );
};

// Spatial grid for efficient culling
const GRID_CELL_SIZE = 512;

class SpatialGrid {
  constructor(nodes, cellSize = GRID_CELL_SIZE) {
    this.cellSize = cellSize;
    this.grid = new Map(); // "x,y" -> Set<nodeId>

    // Build grid
    nodes.forEach((node) => {
      const cellX = Math.floor(node.x / cellSize);
      const cellY = Math.floor(node.y / cellSize);
      const key = `${cellX},${cellY}`;

      if (!this.grid.has(key)) {
        this.grid.set(key, new Set());
      }
      this.grid.get(key).add(node.id);
    });
  }

  getVisibleNodes({ x, y, width, height }, scale, idToNode) {
    // Guard against invalid scale values to prevent division by zero
    if (!Number.isFinite(scale) || scale <= 0) {
      console.warn('[SpatialGrid] Invalid scale:', scale);
      return [];
    }

    // Guard against extremely small scales that could cause precision issues
    const MIN_SAFE_SCALE = 0.001;
    if (scale < MIN_SAFE_SCALE) {
      console.warn('[SpatialGrid] Scale too small:', scale, '- clamping to', MIN_SAFE_SCALE);
      scale = MIN_SAFE_SCALE;
    }

    // Transform viewport to world space
    const worldMinX = -x / scale;
    const worldMaxX = (-x + width) / scale;
    const worldMinY = -y / scale;
    const worldMaxY = (-y + height) / scale;

    // Get intersecting cells
    const minCellX = Math.floor(worldMinX / this.cellSize);
    const maxCellX = Math.floor(worldMaxX / this.cellSize);
    const minCellY = Math.floor(worldMinY / this.cellSize);
    const maxCellY = Math.floor(worldMaxY / this.cellSize);

    // Collect nodes from cells
    const visibleIds = new Set();
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const cellNodes = this.grid.get(`${cx},${cy}`);
        if (cellNodes) {
          cellNodes.forEach((id) => visibleIds.add(id));
        }
      }
    }

    // Convert to nodes and apply hard cap
    const visibleNodes = [];
    for (const id of visibleIds) {
      if (visibleNodes.length >= MAX_VISIBLE_NODES) break;
      const node = idToNode.get(id);
      if (node) visibleNodes.push(node);
    }

    return visibleNodes;
  }
}

const TreeView = ({
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
}) => {
  const stage = useTreeStore((s) => s.stage);
  const setStage = useTreeStore((s) => s.setStage);
  const minZoom = useTreeStore((s) => s.minZoom);
  const maxZoom = useTreeStore((s) => s.maxZoom);
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId);
  const setSelectedPersonId = useTreeStore((s) => s.setSelectedPersonId);
  const hasInitializedCamera = useTreeStore((s) => s.hasInitializedCamera);
  const setHasInitializedCamera = useTreeStore((s) => s.setHasInitializedCamera);
  const treeData = useTreeStore((s) => s.treeData);
  const setTreeData = useTreeStore((s) => s.setTreeData);
  const setTreeBoundsStore = useTreeStore((s) => s.setTreeBounds);
  const { settings } = useSettings();
  const { isPreloadingTree } = useAuth();

  const dimensions = useWindowDimensions();
  const [fontReady, setFontReady] = useState(false);

  // Check if we already have preloaded data
  const hasPreloadedData = treeData && treeData.length > 0;

  // Initialize loading state - skip if we have preloaded data
  const [isLoading, setIsLoading] = useState(!hasPreloadedData);
  const [showSkeleton, setShowSkeleton] = useState(!hasPreloadedData);
  const skeletonFadeAnim = useRef(new RNAnimated.Value(hasPreloadedData ? 0 : 1)).current;
  const contentFadeAnim = useRef(new RNAnimated.Value(hasPreloadedData ? 1 : 0)).current;
  const shimmerAnim = useRef(new RNAnimated.Value(0.3)).current;
  const [currentScale, setCurrentScale] = useState(1);
  const [networkError, setNetworkError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Admin mode state
  const { isAdminMode } = useAdminMode();
  const [showMultiAddModal, setShowMultiAddModal] = useState(false);
  const [multiAddParent, setMultiAddParent] = useState(null);

  // Debug mode state
  const [debugMode, setDebugMode] = useState(__DEV__ ? true : false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuNode, setContextMenuNode] = useState(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({
    x: 0,
    y: 0,
  });
  const [editingProfile, setEditingProfile] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
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
  const initializeProfileSheetProgress = useTreeStore(
    (s) => s.initializeProfileSheetProgress,
  );

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

  // Ancestry path highlighting state
  const [highlightedPathNodeIds, setHighlightedPathNodeIds] = useState(null);
  const pathOpacity = useSharedValue(0);

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

  // LOD tier state with hysteresis
  const tierState = useRef({ current: 1, lastQuantizedScale: 1 });

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

    const current = nodeBuckets.get(nodeId) || 256;
    const target = IMAGE_BUCKETS.find((b) => b >= pixelSize) || 512;

    // Apply hysteresis
    if (target > current && pixelSize < current * (1 + BUCKET_HYSTERESIS)) {
      return current; // Stay at current
    }
    if (target < current && pixelSize > current * (1 - BUCKET_HYSTERESIS)) {
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
    return target;
  }, []);

  const calculateLODTier = useCallback((scale) => {
    if (!LOD_ENABLED) return 1; // Always use full detail if disabled

    const quantizedScale = Math.round(scale / SCALE_QUANTUM) * SCALE_QUANTUM;
    const state = tierState.current;

    // Only recalculate if scale changed significantly
    if (Math.abs(quantizedScale - state.lastQuantizedScale) < SCALE_QUANTUM) {
      return state.current;
    }

    const nodePx = NODE_WIDTH_WITH_PHOTO * PixelRatio.get() * scale;
    let newTier = state.current;

    // Apply hysteresis boundaries
    if (state.current === 1) {
      if (nodePx < T1_BASE * (1 - HYSTERESIS)) newTier = 2;
    } else if (state.current === 2) {
      if (nodePx >= T1_BASE * (1 + HYSTERESIS)) newTier = 1;
      // Tier 3 disabled - stay in tier 2 even when very zoomed out to prevent pop-in
      // else if (nodePx < T2_BASE * (1 - HYSTERESIS)) newTier = 3;
    }

    if (newTier !== state.current) {
      tierState.current = {
        current: newTier,
        lastQuantizedScale: quantizedScale,
      };
    }

    return newTier;
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

  useEffect(() => {
    viewportShared.value = {
      width: Math.max(dimensions.width || 1, 1),
      height: Math.max(dimensions.height || 1, 1),
    };
  }, [dimensions.width, dimensions.height]);

  useEffect(() => {
    boundsShared.value = treeBounds || DEFAULT_BOUNDS;
  }, [treeBounds]);

  useEffect(() => {
    minZoomShared.value = minZoom;
  }, [minZoom]);

  useEffect(() => {
    maxZoomShared.value = maxZoom;
  }, [maxZoom]);

  // Create ref to hold current values for gestures
const gestureStateRef = useRef({
  transform: { x: 0, y: 0, scale: 1 },
  tier: 1,
  indices: null,
  visibleNodes: [],
});

const viewportShared = useSharedValue({
  width: Math.max(dimensions.width || 1, 1),
  height: Math.max(dimensions.height || 1, 1),
});
const boundsShared = useSharedValue(treeBounds || DEFAULT_BOUNDS);
const minZoomShared = useSharedValue(minZoom);
const maxZoomShared = useSharedValue(maxZoom);

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

  // Frozen pan ranges - calculated once at gesture start for consistent rubber-band
  const panRangesX = useSharedValue([0, 0]);
  const panRangesY = useSharedValue([0, 0]);

  // Frozen viewport/bounds - prevents mid-gesture changes (keyboard, modal, culling)
  // from causing false "outside bounds" detection and unwanted rubber-banding
  const frozenViewport = useSharedValue({ width: 1, height: 1 });
  const frozenBounds = useSharedValue(DEFAULT_BOUNDS);
  const frozenMinZoom = useSharedValue(0.15);
  const frozenMaxZoom = useSharedValue(3.0);

  // Throttle culling updates to reduce React re-renders during gestures
  const lastCullingUpdate = useSharedValue(0);

  // Delta tracking for smart throttling - detect large changes (navigation/animation)
  const lastX = useSharedValue(0);
  const lastY = useSharedValue(0);
  const lastScale = useSharedValue(1);
  const isFirstUpdate = useSharedValue(true);

  // Sync scale value to React state for use in render
  useAnimatedReaction(
    () => scale.value,
    (current) => {
      runOnJS(setCurrentScale)(current);
    },
  );

  // Load tree data using branch loading
  const loadTreeData = async () => {
    const startTime = Date.now();

    // Check if we already have adequate data (at least 400 nodes means we have the full tree)
    const existingData = useTreeStore.getState().treeData;
    if (existingData && existingData.length >= 400) {
      const loadTime = Date.now() - startTime;
      console.log('🚀 Using preloaded tree data:', existingData.length, 'nodes (adequate), instant load in', loadTime, 'ms');
      // Don't reload - we have enough data
      setShowSkeleton(false);
      setIsLoading(false);
      return;
    } else if (existingData && existingData.length > 0) {
      console.log('⚠️ Partial tree data exists:', existingData.length, 'nodes, loading full tree...');
    }

    setIsLoading(true);
    setNetworkError(null);
    setIsRetrying(false);

    try {
      // First get the root node
      const { data: rootData, error: rootError } =
        await profilesService.getBranchData(null, 1, 1);
      if (
        rootError ||
        !rootData ||
        !Array.isArray(rootData) ||
        rootData.length === 0
      ) {
        console.error("Error loading root node:", rootError);
        console.log("rootError type:", typeof rootError);
        console.log("rootError object:", JSON.stringify(rootError, null, 2));

        // Check if it's a network error - handle both Error objects and plain objects
        const errorString =
          rootError?.toString?.() || JSON.stringify(rootError) || "";
        const errorMsg = (
          rootError?.message ||
          errorString ||
          ""
        ).toLowerCase();

        console.log("Error message check:", errorMsg);
        console.log("Has 'network'?", errorMsg.includes("network"));
        console.log("Has 'fetch'?", errorMsg.includes("fetch"));

        // For TypeError objects, check the name as well
        const isNetworkError =
          errorMsg.includes("fetch") ||
          errorMsg.includes("network") ||
          rootError?.name === "TypeError" ||
          rootError?.code === "PGRST301";

        if (isNetworkError) {
          console.log("Setting network error state");
          setNetworkError("network");
        } else if (rootData?.length === 0) {
          setNetworkError("empty");
        }

        // CRITICAL: Never fallback to static familyData - always use empty array
        // Static familyData is from September and doesn't have latest updates
        setTreeData([]);

        // Don't trigger fade animation on error
        setShowSkeleton(false);
        setIsLoading(false);
        return;
      }

      // Then load the tree starting from the root HID
      const rootHid = rootData[0].hid;
      const { data, error } = await profilesService.getBranchData(
        rootHid,
        8,
        500,
      );
      if (error) {
        console.error("Error loading tree data:", error);
        // Check if it's a network error (case insensitive)
        const errorMsg = error?.message?.toLowerCase() || "";
        if (
          errorMsg.includes("fetch") ||
          errorMsg.includes("network") ||
          error?.code === "PGRST301"
        ) {
          setNetworkError("network");
        }

        // CRITICAL: Never fallback to static familyData - always use empty array
        // Static familyData is from September and doesn't have latest updates
        setTreeData([]);
      } else {
        setTreeData(data || []);
        setNetworkError(null); // Clear any previous errors
      }

      // Start fade transition when data is loaded
      RNAnimated.parallel([
        // Fade out skeleton
        RNAnimated.timing(skeletonFadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        // Fade in content
        RNAnimated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 400,
          delay: 100, // Slight overlap for smoother transition
          useNativeDriver: true,
        })
      ]).start(() => {
        setShowSkeleton(false); // Remove skeleton from DOM after animation
      });

      setIsLoading(false);
    } catch (err) {
      console.error("Failed to load tree:", err);
      // Check if it's a network error (case insensitive)
      const errorMsg = err?.message?.toLowerCase() || "";
      if (
        errorMsg.includes("fetch") ||
        errorMsg.includes("network") ||
        err?.code === "PGRST301"
      ) {
        setNetworkError("network");
      }

      // CRITICAL: Never fallback to static familyData - always use empty array
      // Static familyData is from September and doesn't have latest updates
      setTreeData([]);

      // Don't trigger fade animation on error
      setShowSkeleton(false);
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await loadTreeData();
  };

  // Sync loading state with treeData changes
  useEffect(() => {
    if (treeData && treeData.length > 0 && isLoading) {
      setIsLoading(false);
      setShowSkeleton(false);
    }
  }, [treeData, isLoading]);

  // Ensure content is visible when not loading
  useEffect(() => {
    if (!isLoading && !showSkeleton) {
      contentFadeAnim.setValue(1);
      skeletonFadeAnim.setValue(0);
    }
  }, [isLoading, showSkeleton, contentFadeAnim, skeletonFadeAnim]);

  // Load tree data on mount
  useEffect(() => {
    // If we already have adequate data, skip everything - instant render
    if (treeData && treeData.length >= 400) {
      setIsLoading(false);
      setShowSkeleton(false);
      contentFadeAnim.setValue(1);
      skeletonFadeAnim.setValue(0);
      return;
    }
    loadTreeData();
  }, []); // Run only once on mount

  // Real-time subscription for profile updates
  useEffect(() => {
    const channel = supabase
      .channel("profiles_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        async (payload) => {
          // console.log('Profile change:', payload);

          // Handle different event types
          if (payload.eventType === "UPDATE" && payload.new) {
            // Update just the affected node
            const updatedNode = {
              ...payload.new,
              name: payload.new.name || "بدون اسم",
              marriages:
                payload.new.marriages?.map((marriage) => ({
                  ...marriage,
                  marriage_date: marriage.marriage_date
                    ? formatDateByPreference(
                        marriage.marriage_date,
                        settings.defaultCalendar,
                      )
                    : null,
                })) || [],
            };

            // Update in Zustand store
            useTreeStore.getState().updateNode(updatedNode.id, updatedNode);
          } else if (payload.eventType === "INSERT" && payload.new) {
            // Add new node
            const newNode = {
              ...payload.new,
              name: payload.new.name || "بدون اسم",
              marriages:
                payload.new.marriages?.map((marriage) => ({
                  ...marriage,
                  marriage_date: marriage.marriage_date
                    ? formatDateByPreference(
                        marriage.marriage_date,
                        settings.defaultCalendar,
                      )
                    : null,
                })) || [],
            };

            // Add to Zustand store
            useTreeStore.getState().addNode(newNode);
          } else if (payload.eventType === "DELETE" && payload.old) {
            // Remove node
            const nodeId = payload.old.id;

            // Remove from Zustand store
            useTreeStore.getState().removeNode(nodeId);
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [setTreeData]);

  // Calculate layout - based on treeData only, not loading state
  const { nodes, connections } = useMemo(() => {
    if (!treeData || treeData.length === 0) {
      return { nodes: [], connections: [] };
    }
    const layout = calculateTreeLayout(treeData);

    // Adjust root node position higher
    const adjustedNodes = layout.nodes.map(node => {
      const isRoot = !node.father_id;
      return {
        ...node,
        y: isRoot ? node.y - 80 : node.y
      };
    });

    // Adjust connections for root node
    const adjustedConnections = layout.connections.map(conn => {
      // Check if this connection involves the root node as parent
      const rootNode = adjustedNodes.find(n => !n.father_id);
      if (rootNode && conn.parent.id === rootNode.id) {
        return {
          ...conn,
          parent: {
            ...conn.parent,
            y: conn.parent.y - 80
          }
        };
      }
      return conn;
    });

    // DEBUG: Log canvas coordinates summary
    return { nodes: adjustedNodes, connections: adjustedConnections };
  }, [treeData]);

  // Build indices for LOD system with O(N) complexity
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

  useEffect(() => {
    setTreeBoundsStore(treeBounds);
  }, [treeBounds, setTreeBoundsStore]);

  // Visible bounds for culling
  const [visibleBounds, setVisibleBounds] = useState({
    minX: -VIEWPORT_MARGIN,
    maxX: dimensions.width + VIEWPORT_MARGIN,
    minY: -VIEWPORT_MARGIN,
    maxY: dimensions.height + VIEWPORT_MARGIN,
  });

  // Track last stable scale to detect significant changes
  const lastStableScale = useRef(1);

  // Update visible bounds when transform changes
  useAnimatedReaction(
    () => ({
      x: translateX.value,
      y: translateY.value,
      scale: scale.value,
    }),
    (current) => {
      // Scale-dependent margin: larger margin when zoomed out
      const dynamicMargin = VIEWPORT_MARGIN / current.scale;

      const newBounds = {
        minX: (-current.x - dynamicMargin) / current.scale,
        maxX: (-current.x + dimensions.width + dynamicMargin) / current.scale,
        minY: (-current.y - dynamicMargin) / current.scale,
        maxY: (-current.y + dimensions.height + dynamicMargin) / current.scale,
      };

      runOnJS(setVisibleBounds)(newBounds);
    },
  );

  // Load more nodes when viewport changes (for future viewport-based loading)
  useEffect(() => {
    // TODO: Implement viewport-based loading when backend supports it
    // This would call profilesService.getVisibleNodes(visibleBounds, scale.value)
  }, [visibleBounds]);

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

  // Prefetch neighbor nodes for better performance
  useEffect(() => {
    if (!visibleNodes.length) return;

    // Create a set of visible node IDs for O(1) lookup
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const neighborUrls = new Set();

    // Find neighbors (parents and children of visible nodes)
    for (const node of visibleNodes) {
      // Add parent
      if (node.father_id) {
        const parent = nodes.find((n) => n.id === node.father_id);
        if (parent && !visibleIds.has(parent.id) && parent.photo_url) {
          neighborUrls.add(parent.photo_url);
        }
      }

      // Add children
      const children = nodes.filter((n) => n.father_id === node.id);
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
  }, [visibleNodes, nodes]);

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
  const bridgeSegments = useMemo(() => {
    const result = [];
    if (!connections || !Array.isArray(connections)) {
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
      const childXs = conn.children.map((c) => c.x);
      const childYs = conn.children.map((c) => c.y);
      const minChildX = Math.min(...childXs);
      const maxChildX = Math.max(...childXs);
      const busY = parentY + (Math.min(...childYs) - parentY) / 2;

      // Only draw a bus line if there are multiple children or an offset
      const shouldHaveBus =
        conn.children.length > 1 || Math.abs(parentX - conn.children[0].x) > 5;
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
  }, [connections, visibleBounds]);

  // Initialize position on first load - smart positioning based on user
  useEffect(() => {
    // CRITICAL: Only run this ONCE globally to prevent camera reset loops
    // Persisted in Zustand store to survive component remounts
    if (
      !hasInitializedCamera &&  // ← Store value persists across remounts
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
        // Always fallback to root node
        targetNode = nodes.find((n) => !n.father_id);
      }

      if (!targetNode && nodes.length > 0) {
        // Ultimate fallback: first node in array (should never happen)
        targetNode = nodes[0];
      }

      // At this point targetNode is guaranteed to exist
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

      // Mark as initialized globally - persists across component remounts
      setHasInitializedCamera(true);
    }
  }, [nodes, dimensions, treeBounds, linkedProfileId, profile?.id]);

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

      // Cancel any ongoing animations
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(scale);

      // Use spring animation for more natural movement
      // Spring provides smoother deceleration than timing
      translateX.value = withSpring(targetX, {
        damping: 20,
        stiffness: 90,
        mass: 1,
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
    [nodes, dimensions, translateX, translateY, scale],
  );

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

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, []);

  // Calculate ancestry path from node to root
  const calculateAncestryPath = useCallback((nodeId) => {
    const { nodesMap } = useTreeStore.getState();
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

  // Clear ancestry path highlight
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

  // Clear all highlights (glow + path) - called when X button clicked
  const clearAllHighlights = useCallback(() => {
    // Clear glow
    glowOpacity.value = withTiming(0, {
      duration: 300,
      easing: Easing.in(Easing.ease),
    });
    highlightedNodeId.value = null;

    // Clear path
    pathOpacity.value = withTiming(0, {
      duration: 300,
      easing: Easing.in(Easing.ease),
    });
    setTimeout(() => {
      setHighlightedPathNodeIds(null);
    }, 300);
  }, [glowOpacity, pathOpacity, highlightedNodeId]);

  // Handle highlight from navigation params
  useEffect(() => {
    // Early return if no navigation needed
    if (!highlightProfileId || !focusOnProfile) return;

    // Schedule navigation with delay to ensure tree is fully rendered
    const timer = setTimeout(() => {
      // Check nodes exist at execution time (not dependency time)
      if (nodes.length > 0) {
        navigateToNode(highlightProfileId);
      }
    }, 500);

    // Cleanup: auto-cancels pending navigation on unmount or when highlightProfileId changes
    // This prevents race conditions and duplicate navigations
    return () => clearTimeout(timer);
  }, [highlightProfileId, focusOnProfile]); // nodes.length removed - prevents re-trigger on culling

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

        // Calculate and highlight ancestry path
        const path = calculateAncestryPath(result.id);

        if (path.length > 1) {
          setHighlightedPathNodeIds(path);

          // Animate path in (after camera settles + glow appears)
          pathOpacity.value = withDelay(
            600, // After camera flight completes
            withTiming(0.52, { // 20% reduction for even softer appearance
              duration: 400,
              easing: Easing.out(Easing.ease)
            })
          );

          console.log(`Highlighted ${path.length}-node ancestry path`);
        } else {
          console.log('Node has no ancestry path (root node or single node)');
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
    [navigateToNode, nodes, calculateAncestryPath, glowOpacity, pathOpacity],
  );

  // Pan gesture with momentum
  const panGesture = Gesture.Pan()
    .onStart(() => {
      "worklet";
      // Don't start pan if we're pinching
      if (isPinching.value) {
        return;
      }
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;

      // Freeze viewport/bounds to prevent mid-gesture changes from causing
      // false "outside bounds" detection and unwanted rubber-banding
      frozenViewport.value = viewportShared.value;
      frozenBounds.value = boundsShared.value;
      frozenMinZoom.value = minZoomShared.value;
      frozenMaxZoom.value = maxZoomShared.value;

      // Calculate and freeze pan ranges using frozen values
      const clamped = clampStageToBounds(
        { x: translateX.value, y: translateY.value, scale: scale.value },
        frozenViewport.value,
        frozenBounds.value,
        frozenMinZoom.value,
        frozenMaxZoom.value
      );

      panRangesX.value = clamped.ranges.x;
      panRangesY.value = clamped.ranges.y;
    })
    .onUpdate((e) => {
      "worklet";
      // Don't update during pinch
      if (isPinching.value) {
        return;
      }

      // Calculate proposed position
      const proposedX = savedTranslateX.value + e.translationX;
      const proposedY = savedTranslateY.value + e.translationY;

      // Use frozen ranges from onStart - prevents jumping from bounds/viewport changes
      // No expensive clampStageToBounds() call per frame (60-120x performance improvement)
      translateX.value = applyRubberBand(
        proposedX,
        panRangesX.value[0],  // frozen min translation
        panRangesX.value[1],  // frozen max translation
        0.55,                 // tension (resistance strength)
        200                   // softZone (distance before full resistance)
      );

      translateY.value = applyRubberBand(
        proposedY,
        panRangesY.value[0],
        panRangesY.value[1],
        0.55,
        200
      );
    })
    .onEnd((e) => {
      "worklet";
      // Don't apply momentum if we were pinching
      if (isPinching.value) {
        return;
      }

      // Check if outside bounds using SAME frozen values from onStart
      // This prevents false positives from mid-gesture viewport/bounds changes
      const clamped = clampStageToBounds(
        { x: translateX.value, y: translateY.value, scale: scale.value },
        frozenViewport.value,
        frozenBounds.value,
        frozenMinZoom.value,
        frozenMaxZoom.value
      );

      // Debug: Check if viewport/bounds changed mid-gesture (remove after testing)
      const viewportChanged =
        frozenViewport.value.width !== viewportShared.value.width ||
        frozenViewport.value.height !== viewportShared.value.height;

      if (viewportChanged) {
        console.log('📐 Viewport changed mid-pan:', {
          frozen: frozenViewport.value,
          current: viewportShared.value
        });
      }

      const isOutsideX = Math.abs(translateX.value - clamped.stage.x) > 1;
      const isOutsideY = Math.abs(translateY.value - clamped.stage.y) > 1;
      const isOutside = isOutsideX || isOutsideY;

      // If outside bounds, spring back smoothly (no jarring snap)
      // This should be rare now with rubber-band resistance in onUpdate
      if (isOutside) {
        translateX.value = withSpring(clamped.stage.x, {
          damping: 20,
          stiffness: 150,
          mass: 1,
        });
        translateY.value = withSpring(clamped.stage.y, {
          damping: 20,
          stiffness: 150,
          mass: 1,
        });

        // Update saved values
        savedTranslateX.value = clamped.stage.x;
        savedTranslateY.value = clamped.stage.y;
        return; // Don't apply momentum when springing back
      }

      // Apply momentum with rubber-band modifier using frozen values
      const decayMod = createDecayModifier(
        frozenViewport.value,
        frozenBounds.value,
        scale.value,
        frozenMinZoom.value,
        frozenMaxZoom.value
      );

      translateX.value = withDecay(
        {
          velocity: e.velocityX,
          deceleration: 0.995,
        },
        (value) => decayMod(value, 'x')
      );
      translateY.value = withDecay(
        {
          velocity: e.velocityY,
          deceleration: 0.995,
        },
        (value) => decayMod(value, 'y')
      );

      // Save current values
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Pinch gesture for zoom with combined pan handling for physical iOS devices
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      "worklet";
      // Only process with two fingers
      if (e.numberOfPointers === 2) {
        isPinching.value = true;
        // CRITICAL: Cancel any running animations to prevent value drift
        cancelAnimation(translateX);
        cancelAnimation(translateY);
        cancelAnimation(scale);

        // Save the current stable values
        savedScale.value = scale.value;
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;

        // Freeze viewport/bounds for this pinch gesture
        frozenViewport.value = viewportShared.value;
        frozenBounds.value = boundsShared.value;
        frozenMinZoom.value = minZoomShared.value;
        frozenMaxZoom.value = maxZoomShared.value;

        // Store INITIAL focal point for anchoring zoom
        initialFocalX.value = e.focalX;
        initialFocalY.value = e.focalY;
      }
    })
    .onUpdate((e) => {
      "worklet";

      // Only process updates with two fingers
      if (e.numberOfPointers !== 2) {
        return;
      }

      // Calculate new scale
      const newScale = clamp(savedScale.value * e.scale, minZoom, maxZoom);

      // CRITICAL FIX: Track how much the focal point has moved (pan component)
      const focalDeltaX = e.focalX - initialFocalX.value;
      const focalDeltaY = e.focalY - initialFocalY.value;

      // Convert INITIAL focal point to world coordinates (not the moving one!)
      const worldX =
        (initialFocalX.value - savedTranslateX.value) / savedScale.value;
      const worldY =
        (initialFocalY.value - savedTranslateY.value) / savedScale.value;

      // Apply zoom around initial focal point, then add the pan from finger movement
      translateX.value = initialFocalX.value - worldX * newScale + focalDeltaX;
      translateY.value = initialFocalY.value - worldY * newScale + focalDeltaY;
      scale.value = newScale;
    })
    .onEnd(() => {
      "worklet";

      // Check if we need to clamp back into bounds using frozen values
      const clamped = clampStageToBounds(
        { x: translateX.value, y: translateY.value, scale: scale.value },
        frozenViewport.value,
        frozenBounds.value,
        frozenMinZoom.value,
        frozenMaxZoom.value
      );

      // If we're significantly outside bounds, spring back gently
      const deltaX = Math.abs(clamped.stage.x - translateX.value);
      const deltaY = Math.abs(clamped.stage.y - translateY.value);

      if (deltaX > 10 || deltaY > 10) {
        translateX.value = withSpring(clamped.stage.x, {
          damping: 20,
          stiffness: 90,
        });
        translateY.value = withSpring(clamped.stage.y, {
          damping: 20,
          stiffness: 90,
        });
      }

      // Save final values
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      isPinching.value = false;
    });

  // Handle node tap - show profile sheet (edit mode if admin)
  const handleNodeTap = useCallback(
    (nodeId) => {
      // console.log('TreeView: Node tapped, isAdminMode:', isAdminMode);
      setSelectedPersonId(nodeId);
      setProfileEditMode(isAdminMode);
      // console.log('TreeView: Setting profileEditMode to:', isAdminMode);
    },
    [setSelectedPersonId, isAdminMode],
  );

  // Tap gesture for selection with movement/time thresholds
  const tapGesture = Gesture.Tap()
    .maxDistance(10)
    .maxDuration(250)
    .runOnJS(true)
    .onEnd((e) => {
      const state = gestureStateRef.current;

      // Check if we're in T3 mode first
      if (state.tier === 3 && AGGREGATION_ENABLED && state.indices?.heroNodes) {
        // Check for chip taps
        for (const hero of state.indices.heroNodes) {
          const centroid = state.indices.centroids[hero.id];
          if (!centroid) continue;

          // Transform centroid to screen space
          const screenX =
            centroid.x * state.transform.scale + state.transform.x;
          const screenY =
            centroid.y * state.transform.scale + state.transform.y;

          const isRoot = !hero.father_id;
          const chipScale = isRoot ? 1.3 : 1.0;
          const chipWidth = 100 * chipScale;
          const chipHeight = 36 * chipScale;

          // Check if tap is within chip bounds
          if (
            e.x >= screenX - chipWidth / 2 &&
            e.x <= screenX + chipWidth / 2 &&
            e.y >= screenY - chipHeight / 2 &&
            e.y <= screenY + chipHeight / 2
          ) {
            handleChipTap(hero);
            return;
          }
        }
        return; // No chip tapped and we're in T3, so ignore
      }

      // Original node tap logic for T1/T2
      const canvasX = (e.x - state.transform.x) / state.transform.scale;
      const canvasY = (e.y - state.transform.y) / state.transform.scale;

      // DEBUG: Log tap coordinates
      // if (__DEV__) {
      //   console.log(`👆 TAP: Screen(${e.x.toFixed(0)},${e.y.toFixed(0)}) → Canvas(${canvasX.toFixed(0)},${canvasY.toFixed(0)}) @ Scale:${scale.value.toFixed(2)}`);
      // }

      let tappedNodeId = null;
      for (const node of state.visibleNodes) {
        const isRoot = !node.father_id;
        const nodeWidth = isRoot ? 120 :
          (node.photo_url ? NODE_WIDTH_WITH_PHOTO : NODE_WIDTH_TEXT_ONLY);
        const nodeHeight = isRoot ? 100 :
          (node.photo_url ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY);

        if (
          canvasX >= node.x - nodeWidth / 2 &&
          canvasX <= node.x + nodeWidth / 2 &&
          canvasY >= node.y - nodeHeight / 2 &&
          canvasY <= node.y + nodeHeight / 2
        ) {
          tappedNodeId = node.id;

          // DEBUG: Log tapped node
          // if (__DEV__) {
          //   console.log(`  → Hit: ${node.name} at (${node.x.toFixed(0)},${node.y.toFixed(0)})`);
          // }

          break;
        }
      }

      handleNodeTap(tappedNodeId);
    });

  // Long press gesture for quick add
  const longPressGesture = Gesture.LongPress()
    .minDuration(500) // 0.5 seconds
    .maxDistance(10)
    .runOnJS(true)
    .onStart((e) => {
      // Check user role instead of mode - QuickAdd is now permission-based
      if (!profile?.role || !['admin', 'super_admin', 'moderator'].includes(profile.role)) {
        return;
      }

      const state = gestureStateRef.current;

      // Don't handle in T3 mode
      if (state.tier === 3) return;

      // Find which node was long-pressed
      const canvasX = (e.x - state.transform.x) / state.transform.scale;
      const canvasY = (e.y - state.transform.y) / state.transform.scale;

      let pressedNode = null;
      for (const node of state.visibleNodes) {
        const isRoot = !node.father_id;
        const nodeWidth = isRoot ? 120 :
          (node.photo_url ? NODE_WIDTH_WITH_PHOTO : NODE_WIDTH_TEXT_ONLY);
        const nodeHeight = isRoot ? 100 :
          (node.photo_url ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY);

        if (
          canvasX >= node.x - nodeWidth / 2 &&
          canvasX <= node.x + nodeWidth / 2 &&
          canvasY >= node.y - nodeHeight / 2 &&
          canvasY <= node.y + nodeHeight / 2
        ) {
          pressedNode = node;
          break;
        }
      }

      if (pressedNode) {
        console.log(
          "Long-press on node:",
          pressedNode.name,
          "ID:",
          pressedNode.id,
        );
        console.log("Node already has children:", pressedNode.children);

        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // The node already has its children attached!
        const children = Array.isArray(pressedNode.children)
          ? pressedNode.children
          : [];

        console.log("Found children from node.children:", children.length);
        if (children.length > 0) {
          console.log(
            "Children details:",
            children.map((c) => ({
              name: c.name,
              sibling_order: c.sibling_order,
              father_id: c.father_id,
              mother_id: c.mother_id,
            })),
          );
        }

        // Sort children by sibling_order (they should already be sorted)
        children.sort(
          (a, b) => (a.sibling_order || 0) - (b.sibling_order || 0),
        );

        // Show quick add overlay
        setQuickAddParent(pressedNode);
        setQuickAddPosition({ x: e.x, y: e.y });
        setShowQuickAdd(true);
      }
    });

  // Handle chip tap in T3 - zoom to branch
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

      // Animate to target
      scale.value = withTiming(targetScale, { duration: 500 });
      translateX.value = withTiming(targetX, { duration: 500 });
      translateY.value = withTiming(targetY, { duration: 500 });

      // Update saved values after animation
      setTimeout(() => {
        savedScale.value = targetScale;
        savedTranslateX.value = targetX;
        savedTranslateY.value = targetY;
      }, 500);
    },
    [indices, dimensions, minZoom, maxZoom],
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
          setEditingProfile(contextMenuNode);
          setShowEditModal(true);
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
  const composed = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    // Long press always enabled - permission check is inside the gesture
    Gesture.Exclusive(longPressGesture, tapGesture),
  );

  // Debug: Track camera changes to detect glitching
  const lastCameraLog = useSharedValue({ x: 0, y: 0, scale: 1, timestamp: 0 });
  const logCameraChange = useCallback((change) => {
    if (!debugMode) return;
    const now = Date.now();
    const delta = {
      x: Math.abs(change.x - change.prevX),
      y: Math.abs(change.y - change.prevY),
      scale: Math.abs(change.scale - change.prevScale),
      dt: now - change.timestamp,
    };

    // Flag large jumps (potential glitching)
    const isLargeJump = delta.x > 50 || delta.y > 50;
    const prefix = isLargeJump ? '🔴 JUMP' : '📍';

    console.log(`${prefix} Camera: x=${Math.round(change.x)}, y=${Math.round(change.y)}, scale=${change.scale.toFixed(3)} | Δx=${Math.round(delta.x)}, Δy=${Math.round(delta.y)} (${delta.dt}ms)`);
  }, [debugMode]);

  useAnimatedReaction(
    () => ({
      x: translateX.value,
      y: translateY.value,
      scale: scale.value,
    }),
    (current, previous) => {
      'worklet';
      if (!previous || !debugMode) return;

      // Only log meaningful changes
      const dx = Math.abs(current.x - previous.x);
      const dy = Math.abs(current.y - previous.y);
      const dscale = Math.abs(current.scale - previous.scale);

      if (dx > 1 || dy > 1 || dscale > 0.001) {
        const now = Date.now();
        runOnJS(logCameraChange)({
          x: current.x,
          y: current.y,
          scale: current.scale,
          prevX: previous.x,
          prevY: previous.y,
          prevScale: previous.scale,
          timestamp: now,
        });
      }
    },
    [debugMode]
  );

  // Render connection lines with proper elbow style
  const renderConnection = useCallback(
    (connection) => {
      const parent = nodes.find((n) => n.id === connection.parent.id);
      if (!parent) return null;

      // Calculate bus line position
      const childYs = connection.children.map((child) => child.y);
      const busY = parent.y + (Math.min(...childYs) - parent.y) / 2;

      // Calculate horizontal span
      const childXs = connection.children.map((child) => child.x);
      const minChildX = Math.min(...childXs);
      const maxChildX = Math.max(...childXs);

      const lines = [];

      // Vertical line from parent
      const parentHeight = parent.photo_url
        ? NODE_HEIGHT_WITH_PHOTO
        : NODE_HEIGHT_TEXT_ONLY;
      lines.push(
        <Line
          key={`parent-down-${parent.id}`}
          p1={vec(parent.x, parent.y + parentHeight / 2)}
          p2={vec(parent.x, busY)}
          color={LINE_COLOR}
          style="stroke"
          strokeWidth={LINE_WIDTH}
        />,
      );

      // Horizontal bus line (only if multiple children or offset)
      if (
        connection.children.length > 1 ||
        Math.abs(parent.x - connection.children[0].x) > 5
      ) {
        lines.push(
          <Line
            key={`bus-${parent.id}`}
            p1={vec(minChildX, busY)}
            p2={vec(maxChildX, busY)}
            color={LINE_COLOR}
            style="stroke"
            strokeWidth={LINE_WIDTH}
          />,
        );
      }

      // Vertical lines to children
      connection.children.forEach((child) => {
        const childNode = nodes.find((n) => n.id === child.id);
        if (!childNode) return;

        const childHeight = childNode.photo_url
          ? NODE_HEIGHT_WITH_PHOTO
          : NODE_HEIGHT_TEXT_ONLY;

        lines.push(
          <Line
            key={`child-up-${child.id}`}
            p1={vec(childNode.x, busY)}
            p2={vec(childNode.x, childNode.y - childHeight / 2)}
            color={LINE_COLOR}
            style="stroke"
            strokeWidth={LINE_WIDTH}
          />,
        );
      });

      return lines;
    },
    [nodes],
  );

  // Render edges with batching and capping
  const renderEdgesBatched = useCallback(
    (connections, visibleNodeIds, tier) => {
      if (tier === 3) return { elements: null, count: 0 };

      let edgeCount = 0;
      const paths = [];
      let pathBuilder = Skia.Path.Make();
      let currentBatch = 0;

      for (const conn of connections) {
        if (edgeCount >= MAX_VISIBLE_EDGES) break;

        // Only render if parent or any child is visible
        if (
          !visibleNodeIds.has(conn.parent.id) &&
          !conn.children.some((c) => visibleNodeIds.has(c.id))
        ) {
          continue;
        }

        const parent = nodes.find((n) => n.id === conn.parent.id);
        if (!parent) continue;

        // Calculate positions
        const childYs = conn.children.map((child) => child.y);
        const busY = parent.y + (Math.min(...childYs) - parent.y) / 2;
        const parentHeight = parent.photo_url
          ? NODE_HEIGHT_WITH_PHOTO
          : NODE_HEIGHT_TEXT_ONLY;

        // Add parent vertical line
        pathBuilder.moveTo(parent.x, parent.y + parentHeight / 2);
        pathBuilder.lineTo(parent.x, busY);

        // Add horizontal bus line if needed
        if (
          conn.children.length > 1 ||
          Math.abs(parent.x - conn.children[0].x) > 5
        ) {
          const childXs = conn.children.map((child) => child.x);
          const minChildX = Math.min(...childXs);
          const maxChildX = Math.max(...childXs);

          pathBuilder.moveTo(minChildX, busY);
          pathBuilder.lineTo(maxChildX, busY);
        }

        // Add child vertical lines
        conn.children.forEach((child) => {
          const childNode = nodes.find((n) => n.id === child.id);
          if (childNode) {
            const isRoot = !childNode.father_id;
            const childHeight = isRoot ? 100 :
              (childNode.photo_url ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY);
            pathBuilder.moveTo(childNode.x, busY);
            pathBuilder.lineTo(childNode.x, childNode.y - childHeight / 2);
          }
        });

        edgeCount += conn.children.length + 1;
        currentBatch += conn.children.length + 1;

        // Flush batch every 50 edges
        if (currentBatch >= 50) {
          // Clone path before pushing
          const flushed = Skia.Path.Make();
          flushed.addPath(pathBuilder);
          paths.push(
            <Path
              key={`edges-${paths.length}`}
              path={flushed}
              color={LINE_COLOR}
              style="stroke"
              strokeWidth={LINE_WIDTH}
            />,
          );
          pathBuilder.reset();
          currentBatch = 0;
        }
      }

      // Final batch
      if (currentBatch > 0) {
        const flushed = Skia.Path.Make();
        flushed.addPath(pathBuilder);
        paths.push(
          <Path
            key={`edges-${paths.length}`}
            path={flushed}
            color={LINE_COLOR}
            style="stroke"
            strokeWidth={LINE_WIDTH}
          />,
        );
      }

      return { elements: paths, count: edgeCount };
    },
    [nodes],
  );

  // Render highlighted ancestry path
  const renderHighlightedPath = useCallback(() => {
    if (!highlightedPathNodeIds || highlightedPathNodeIds.length < 2) {
      return null;
    }

    // Create Set for O(1) membership lookups
    const pathSet = new Set(highlightedPathNodeIds);

    // Group segments by depth difference (generation gap) for color gradation
    const segmentsByDepth = new Map(); // depth -> Path object
    let totalSegments = 0;

    // Loop through existing connections and draw routing for path segments
    for (const conn of connections) {
      // Skip if parent not in path
      if (!pathSet.has(conn.parent.id)) continue;

      // Find which child in this connection is part of the path
      const pathChild = conn.children.find(c => pathSet.has(c.id));
      if (!pathChild) continue;

      const parent = nodes.find(n => n.id === conn.parent.id);
      const child = nodes.find(n => n.id === pathChild.id);
      if (!parent || !child) continue;

      // Calculate depth difference for color selection
      const depthDiff = Math.abs(child.depth - parent.depth);

      // Get or create path for this depth level
      if (!segmentsByDepth.has(depthDiff)) {
        segmentsByDepth.set(depthDiff, Skia.Path.Make());
      }
      const pathObj = segmentsByDepth.get(depthDiff);

      // Reuse EXACT same busY calculation as regular edges
      const childYs = conn.children.map(c => c.y);
      const busY = parent.y + (Math.min(...childYs) - parent.y) / 2;

      const parentHeight = parent.photo_url ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;
      const childHeight = child.photo_url ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;

      // Draw 3-segment routing matching regular edges exactly:
      // 1. Parent down to bus
      pathObj.moveTo(parent.x, parent.y + parentHeight / 2);
      pathObj.lineTo(parent.x, busY);

      // 2. Horizontal along bus (if parent and child x differ)
      if (Math.abs(parent.x - child.x) > 1) {
        pathObj.lineTo(child.x, busY);
      }

      // 3. Bus up to child
      pathObj.lineTo(child.x, child.y - childHeight / 2);

      totalSegments++;
    }

    if (totalSegments === 0) {
      console.warn('No valid path segments to render');
      return null;
    }

    // Render each depth level with 4-layer glow system (matches search highlight)
    return Array.from(segmentsByDepth.entries()).flatMap(([depthDiff, pathObj]) => {
      const colorIndex = depthDiff % ANCESTRY_COLORS.length;
      const baseColor = ANCESTRY_COLORS[colorIndex];

      return [
        // Layer 4: Outer glow - soft halo (largest blur)
        <Group key={`path-${depthDiff}-outer`} layer={<Paint><Blur blur={16} /></Paint>}>
          <Path
            path={pathObj}
            color={hexToRgba(baseColor, 0.18)}
            style="stroke"
            strokeWidth={8}
            opacity={pathOpacity}
          >
            <CornerPathEffect r={4} />
          </Path>
        </Group>,

        // Layer 3: Middle glow - medium blur
        <Group key={`path-${depthDiff}-middle`} layer={<Paint><Blur blur={10} /></Paint>}>
          <Path
            path={pathObj}
            color={hexToRgba(baseColor, 0.24)}
            style="stroke"
            strokeWidth={5.5}
            opacity={pathOpacity}
          >
            <CornerPathEffect r={4} />
          </Path>
        </Group>,

        // Layer 2: Inner accent - subtle blur
        <Group key={`path-${depthDiff}-inner`} layer={<Paint><Blur blur={5} /></Paint>}>
          <Path
            path={pathObj}
            color={hexToRgba(baseColor, 0.32)}
            style="stroke"
            strokeWidth={4}
            opacity={pathOpacity}
          >
            <CornerPathEffect r={4} />
          </Path>
        </Group>,

        // Layer 1: Crisp core - no blur, full color
        <Path
          key={`path-${depthDiff}-core`}
          path={pathObj}
          color={baseColor}
          style="stroke"
          strokeWidth={2.5}
          opacity={pathOpacity}
        >
          <CornerPathEffect r={4} />
        </Path>,
      ];
    });
  }, [highlightedPathNodeIds, pathOpacity, nodes, connections]);

  // Render T3 aggregation chips (only 3 chips for hero branches)
  const renderTier3 = useCallback(
    (heroNodes, indices, scale, translateX, translateY) => {
      if (!AGGREGATION_ENABLED) return null;

      const chips = [];

      heroNodes.forEach((hero, index) => {
        // Use precomputed centroid
        const centroid = indices.centroids[hero.id];
        if (!centroid) return;

        // Transform world to screen
        const screenX = centroid.x * scale + translateX;
        const screenY = centroid.y * scale + translateY;

        const isRoot = !hero.father_id;
        const chipScale = isRoot ? 1.3 : 1.0;
        const chipWidth = 100 * chipScale;
        const chipHeight = 36 * chipScale;

        chips.push(
          <Group key={`chip-${hero.id}`}>
            <RoundedRect
              x={screenX - chipWidth / 2}
              y={screenY - chipHeight / 2}
              width={chipWidth}
              height={chipHeight}
              r={16}
              color="#FFFFFF"
            />
            <RoundedRect
              x={screenX - chipWidth / 2}
              y={screenY - chipHeight / 2}
              width={chipWidth}
              height={chipHeight}
              r={16}
              color="#D1BBA340"
              style="stroke"
              strokeWidth={0.5}
            />
            {/* Hero name + count */}
            {arabicFont && (
              <SkiaText
                x={screenX}
                y={screenY + 4}
                text={`${hero.name} (${indices.subtreeSizes[hero.id]})`}
                font={arabicFont}
                textAlign="center"
                fontSize={12 * chipScale}
                color="#242121"
              />
            )}
          </Group>,
        );
      });

      return chips;
    },
    [],
  );

  // Render T2 text pill (simplified, no images)
  const renderTier2Node = useCallback(
    (node) => {
      const nodeWidth = 60;
      const nodeHeight = 26;
      const x = node.x - nodeWidth / 2;
      const y = node.y - nodeHeight / 2;
      const isSelected = selectedPersonId === node.id;

      // Capture the world-space frame for the highlight overlay
      nodeFramesRef.current.set(node.id, {
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
        borderRadius: 13,
      });

      return (
        <Group key={node.id}>
          {/* Shadow (lighter for T2) */}
          <RoundedRect
            x={x + 0.5}
            y={y + 0.5}
            width={nodeWidth}
            height={nodeHeight}
            r={13}
            color="#00000008"
          />

          {/* Main pill background */}
          <RoundedRect
            x={x}
            y={y}
            width={nodeWidth}
            height={nodeHeight}
            r={13}
            color="#FFFFFF"
          />

          {/* Border */}
          <RoundedRect
            x={x}
            y={y}
            width={nodeWidth}
            height={nodeHeight}
            r={13}
            color={isSelected ? "#A13333" : "#D1BBA360"}
            style="stroke"
            strokeWidth={isSelected ? 1.5 : 1}
          />

          {/* First name only */}
          {(() => {
            const firstName = node.name.split(" ")[0];
            const nameParagraph = createArabicParagraph(
              firstName,
              "regular",
              10,
              "#242121",
              nodeWidth,
            );

            if (!nameParagraph) return null;

            return (
              <Paragraph
                paragraph={nameParagraph}
                x={x}
                y={y + 7}
                width={nodeWidth}
              />
            );
          })()}
        </Group>
      );
    },
    [selectedPersonId],
  );

  // Render node component (T1 - full detail)
  const renderNode = useCallback(
    (node) => {
      const isRoot = !node.father_id;
      const hasPhoto = !!node.photo_url;
      const isG2Parent = node.generation === 2 && node._hasChildren;

      // Adjust width for root and G2 parent nodes
      const nodeWidth = isRoot ? 120 :
        isG2Parent ? (hasPhoto ? 95 : 75) :
        (node.nodeWidth || (hasPhoto ? NODE_WIDTH_WITH_PHOTO : NODE_WIDTH_TEXT_ONLY));
      const nodeHeight = isRoot ? 100 :
        (hasPhoto ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY);
      const isSelected = selectedPersonId === node.id;

      const x = node.x - nodeWidth / 2;
      const y = node.y - nodeHeight / 2;

      const isT1 = indices?.heroNodes?.some((hero) => hero.id === node.id) || false;
      const isT2 = indices?.searchTiers?.[node.id] === 2;

      nodeFramesRef.current.set(node.id, {
        x,
        y,
        width: nodeWidth,
        height: nodeHeight,
        borderRadius: isRoot ? 20 : isT1 ? 16 : isT2 ? 13 : CORNER_RADIUS,
      });

      return (
        <Group key={node.id}>
          {/* Soft shadow */}
          <RoundedRect
            x={x + 1}
            y={y + 1}
            width={nodeWidth}
            height={nodeHeight}
            r={CORNER_RADIUS}
            color="#00000015"
          />

          {/* Main card background */}
          <RoundedRect
            x={x}
            y={y}
            width={nodeWidth}
            height={nodeHeight}
            r={CORNER_RADIUS}
            color="#FFFFFF"
          />

          {/* Border */}
          <RoundedRect
            x={x}
            y={y}
            width={nodeWidth}
            height={nodeHeight}
            r={CORNER_RADIUS}
            color={isSelected ? "#A13333" : "#D1BBA360"}
            style="stroke"
            strokeWidth={isSelected ? 2.5 : 1.2}
          />

          {hasPhoto ? (
            <>
              {/* Photo placeholder */}
              <Circle
                cx={node.x}
                cy={node.y - 10}
                r={PHOTO_SIZE / 2}
                color="#D1BBA320"
              />
              <Circle
                cx={node.x}
                cy={node.y - 10}
                r={PHOTO_SIZE / 2}
                color="#D1BBA340"
                style="stroke"
                strokeWidth={1}
              />
              {/* Load and display image if available */}
              {node.photo_url && (
                <ImageNode
                  url={node.photo_url}
                  x={node.x - PHOTO_SIZE / 2}
                  y={node.y - 10 - PHOTO_SIZE / 2}
                  width={PHOTO_SIZE}
                  height={PHOTO_SIZE}
                  radius={PHOTO_SIZE / 2}
                  tier={node._tier || 1}
                  scale={node._scale || 1}
                  nodeId={node.id}
                  selectBucket={node._selectBucket}
                />
              )}

              {/* Generation badge - positioned in top-right corner for photo nodes */}
              {(() => {
                const genParagraph = createArabicParagraph(
                  String(node.generation),
                  "regular",
                  7, // Reduced from 9 to 7 (about 25% smaller)
                  "#24212140", // Sadu Night with 25% opacity
                  15,
                );

                if (!genParagraph) return null;

                return (
                  <Paragraph
                    paragraph={genParagraph}
                    x={x + nodeWidth - 15}
                    y={y + 4}
                    width={15}
                  />
                );
              })()}

              {/* Name text - centered across full width (on top) */}
              {(() => {
                const nameParagraph = createArabicParagraph(
                  node.name,
                  "bold",
                  isRoot ? 22 : 11,  // Double size for root
                  "#242121",
                  nodeWidth,
                );

                if (!nameParagraph) return null;

                const textX = x; // Full width centering
                const textY = y + 68; // Positioned below photo (moved down a bit)

                return (
                  <Paragraph
                    paragraph={nameParagraph}
                    x={textX}
                    y={textY}
                    width={nodeWidth}
                  />
                );
              })()}
            </>
          ) : (
            <>
              {/* Generation badge - centered horizontally at top */}
              {(() => {
                const genParagraph = createArabicParagraph(
                  String(node.generation),
                  "regular",
                  7, // Reduced from 9 to 7 (about 25% smaller)
                  "#24212140", // Sadu Night with 25% opacity
                  nodeWidth,
                );

                if (!genParagraph) return null;

                return (
                  <Paragraph
                    paragraph={genParagraph}
                    x={x}
                    y={y + 4} // Near top of node
                    width={nodeWidth}
                  />
                );
              })()}

              {/* Text-only name - centered across full width (on top) */}
              {(() => {
                const nameParagraph = createArabicParagraph(
                  node.name,
                  "bold",
                  isRoot ? 22 : 11,  // Double size for root
                  "#242121",
                  nodeWidth,
                );

                if (!nameParagraph) return null;

                const textX = x; // Full width centering
                const textY = y + (nodeHeight - nameParagraph.getHeight()) / 2; // Vertical center

                return (
                  <Paragraph
                    paragraph={nameParagraph}
                    x={textX}
                    y={textY}
                    width={nodeWidth}
                  />
                );
              })()}

              {/* Sadu icons for root node */}
              {isRoot && !hasPhoto && (
                <>
                  {/* Left Sadu icon */}
                  <SaduIcon
                    x={x + 5}
                    y={y + nodeHeight / 2 - 10}
                    size={20}
                  />

                  {/* Right Sadu icon */}
                  <SaduIcon
                    x={x + nodeWidth - 25}
                    y={y + nodeHeight / 2 - 10}
                    size={20}
                  />
                </>
              )}

              {/* Sadu icons for Generation 2 parent nodes */}
              {isG2Parent && (
                <>
                  {/* Left Sadu icon */}
                  <SaduIconG2
                    x={x + 3}
                    y={hasPhoto ? y + 5 : y + nodeHeight / 2 - 7}
                    size={14}
                  />

                  {/* Right Sadu icon */}
                  <SaduIconG2
                    x={x + nodeWidth - 17}
                    y={hasPhoto ? y + 5 : y + nodeHeight / 2 - 7}
                    size={14}
                  />
                </>
              )}
            </>
          )}
        </Group>
      );

      return nodeContent;
    },
    [selectedPersonId, highlightedNodeIdState, glowOpacityState, indices],
  );

  // Create a derived value for the transform to avoid Reanimated warnings
  const transform = useDerivedValue(() => {
    return [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ];
  });

  // Store current transform values to avoid accessing .value during render
  const [currentTransform, setCurrentTransform] = useState({
    x: 0,
    y: 0,
    scale: 1,
  });

  // Update transform values when they change - smart throttling
  // Gestures: Throttled to 200ms (5 updates/sec for performance)
  // Navigation/Animation: Immediate update when large change detected (fixes culling lag)
  // World-space deltas ensure consistent behavior across zoom levels
  useAnimatedReaction(
    () => ({
      x: translateX.value,
      y: translateY.value,
      scale: scale.value,
    }),
    (current) => {
      'worklet';
      const now = Date.now();

      // Always update on first reaction to establish baseline
      if (isFirstUpdate.value) {
        isFirstUpdate.value = false;
        lastX.value = current.x;
        lastY.value = current.y;
        lastScale.value = current.scale;
        lastCullingUpdate.value = now;
        runOnJS(setCurrentTransform)(current);
        return;
      }

      // Calculate world-space deltas (scale-aware for consistent detection)
      const worldDeltaX = Math.abs(current.x - lastX.value) / Math.max(current.scale, 0.1);
      const worldDeltaY = Math.abs(current.y - lastY.value) / Math.max(current.scale, 0.1);
      const scaleDelta = Math.abs(current.scale - lastScale.value);

      // Large change detection: 100px in world space OR 0.1 scale change
      const WORLD_THRESHOLD = 100;
      const SCALE_THRESHOLD = 0.1;
      const isLargeChange =
        worldDeltaX > WORLD_THRESHOLD ||
        worldDeltaY > WORLD_THRESHOLD ||
        scaleDelta > SCALE_THRESHOLD;

      // Update immediately for large changes (navigation/animation), throttle for small changes (gestures)
      if (isLargeChange || now - lastCullingUpdate.value >= 200) {
        lastX.value = current.x;
        lastY.value = current.y;
        lastScale.value = current.scale;
        lastCullingUpdate.value = now;
        runOnJS(setCurrentTransform)(current);
      }
    },
  );

  // Calculate current LOD tier using the state instead of accessing .value directly
  const tier = calculateLODTier(currentTransform.scale);
  frameStatsRef.current.tier = tier;

  // Calculate culled nodes (with loading fallback)
  const culledNodes = useMemo(() => {
    if (isLoading) return [];
    if (tier === 3) return [];
    if (!spatialGrid) return visibleNodes;

    // Expand viewport by VIEWPORT_MARGIN in ALL FOUR directions (screen-space).
    // This prevents nodes from popping in/out immediately when entering screen edges.
    //
    // Geometry explanation:
    // getVisibleNodes() transforms viewport to world space:
    //   worldMinX = -x / scale
    //   worldMaxX = (-x + width) / scale
    //
    // To add margin on LEFT side:
    //   x_adjusted = x + VIEWPORT_MARGIN
    //   worldMinX = -(x + VIEWPORT_MARGIN) / scale = -x/scale - VIEWPORT_MARGIN/scale
    //   This shifts the left edge VIEWPORT_MARGIN/scale further left in world space
    //
    // To add margin on RIGHT side:
    //   width_adjusted = width + 2*VIEWPORT_MARGIN
    //   (The +2* accounts for both the shift from x adjustment AND right extension)
    //
    // Result: Consistent 1200px buffer on all sides at any zoom level.
    return spatialGrid.getVisibleNodes(
      {
        x: currentTransform.x + VIEWPORT_MARGIN,            // Extend left & top
        y: currentTransform.y + VIEWPORT_MARGIN,
        width: dimensions.width + (2 * VIEWPORT_MARGIN),    // Extend right (accounts for shift)
        height: dimensions.height + (2 * VIEWPORT_MARGIN),  // Extend bottom (accounts for shift)
      },
      currentTransform.scale,
      indices.idToNode,
    );
  }, [
    isLoading,
    tier,
    spatialGrid,
    currentTransform,
    dimensions,
    indices.idToNode,
    visibleNodes,
  ]);

  // Update render callbacks to pass tier and scale
  const renderNodeWithTier = useCallback(
    (node) => {
      if (!node) return null;
      if (tier === 2) {
        return renderTier2Node(node);
      }
      // Tier 1 - full node with tier info for image loading
      const modifiedNode = {
        ...node,
        _tier: tier,
        _scale: currentTransform.scale,
        _selectBucket: selectBucketWithHysteresis,
        _hasChildren: indices.parentToChildren.has(node.id),
      };
      return renderNode(modifiedNode);
    },
    [
      tier,
      currentTransform.scale,
      renderNode,
      renderTier2Node,
      selectBucketWithHysteresis,
      indices,
    ],
  );

  // Create visible node ID set for edge rendering
  const visibleNodeIds = useMemo(
    () => new Set(culledNodes.map((n) => n.id)),
    [culledNodes],
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

  // Show loading state
  // Show network error state if there's an error
  if (networkError) {
    return (
      <NetworkErrorView
        errorType={networkError}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />
    );
  }

  // Start shimmer animation for skeleton
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

  // Tree skeleton component - better resembles actual tree
  const TreeSkeleton = () => (
    <View style={{
      flex: 1,
      backgroundColor: '#F9F7F3',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    }}>
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
        <View style={{
          width: 2,
          height: 50,
          backgroundColor: '#D1BBA325',
          marginTop: -2,
        }} />
      </View>

      {/* Second generation with horizontal connector */}
      <View style={{ alignItems: 'center', marginTop: -2 }}>
        {/* Horizontal connector line */}
        <View style={{
          width: 300,
          height: 2,
          backgroundColor: '#D1BBA325',
          position: 'absolute',
          top: 0,
        }} />

        {/* Second gen nodes */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          width: 320,
          marginTop: -1,
        }}>
          {[...Array(4)].map((_, i) => (
            <View key={`gen2-wrapper-${i}`} style={{ alignItems: 'center' }}>
              {/* Small vertical line to node */}
              <View style={{
                width: 2,
                height: 20,
                backgroundColor: '#D1BBA325',
              }} />
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
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          paddingHorizontal: 10,
        }}>
          {/* Left branch */}
          <View style={{ alignItems: 'center' }}>
            <View style={{
              width: 100,
              height: 2,
              backgroundColor: '#D1BBA320',
              marginBottom: 10,
            }} />
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
            <View style={{
              width: 80,
              height: 2,
              backgroundColor: '#D1BBA320',
              marginBottom: 10,
            }} />
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
            <View style={{
              width: 100,
              height: 2,
              backgroundColor: '#D1BBA320',
              marginBottom: 10,
            }} />
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

  if (isLoading) {
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
              opacity: skeletonFadeAnim,
            }}
            pointerEvents="none"
          >
            <TreeSkeleton />
          </RNAnimated.View>
        )}

        {/* Empty placeholder for tree content that will fade in */}
        <RNAnimated.View
          style={{
            flex: 1,
            opacity: contentFadeAnim,
          }}
        />
      </View>
    );
  }

  // Render edges with batching
  const { elements: edgeElements, count: edgesDrawn } = renderEdgesBatched(
    connections,
    visibleNodeIds,
    tier,
  );

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
            opacity: skeletonFadeAnim,
          }}
          pointerEvents="none"
        >
          <TreeSkeleton />
        </RNAnimated.View>
      )}

      {/* Main tree content with fade in */}
      <RNAnimated.View style={{ flex: 1, opacity: contentFadeAnim }}>
        <GestureDetector gesture={composed}>
          <Canvas style={{ flex: 1 }}>
          <Group transform={transform}>
            {/* Render batched edges first */}
            {edgeElements}

            {/* Highlighted ancestry path (above edges, below nodes) */}
            {renderHighlightedPath()}

            {/* Search highlight glow (rendered behind nodes for visibility) */}
            {highlightedNodeIdState && glowOpacityState > 0.01 && (() => {
              const frame = nodeFramesRef.current.get(highlightedNodeIdState);
              if (!frame) return null;

              return (
                <Group opacity={glowOpacityState} blendMode="screen">
                  <RoundedRect
                    x={frame.x}
                    y={frame.y}
                    width={frame.width}
                    height={frame.height}
                    r={frame.borderRadius}
                    color="transparent"
                  >
                    {/* Layer 4: Outermost soft glow - crimson */}
                    <Shadow dx={0} dy={0} blur={40} color="rgba(199, 62, 62, 0.25)" />

                    {/* Layer 3: Large warm halo - vivid orange */}
                    <Shadow dx={0} dy={0} blur={30} color="rgba(227, 135, 64, 0.3)" />

                    {/* Layer 2: Medium glow - crimson */}
                    <Shadow dx={0} dy={0} blur={20} color="rgba(199, 62, 62, 0.35)" />

                    {/* Layer 1: Inner warm accent - vivid orange */}
                    <Shadow dx={0} dy={0} blur={10} color="rgba(227, 135, 64, 0.4)" />
                  </RoundedRect>
                </Group>
              );
            })()}

            {/* Render visible nodes */}
            {culledNodes.map(renderNodeWithTier)}

            {/* Crisp golden border on top of highlighted node */}
            {highlightedNodeIdState && glowOpacityState > 0.01 && (() => {
              const frame = nodeFramesRef.current.get(highlightedNodeIdState);
              if (!frame) return null;

              return (
                <RoundedRect
                  x={frame.x}
                  y={frame.y}
                  width={frame.width}
                  height={frame.height}
                  r={frame.borderRadius}
                  color="#E5A855"
                  style="stroke"
                  strokeWidth={2}
                  opacity={glowOpacityState}
                />
              );
            })()}

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

            {/* Debug visualization: Viewport rectangles */}
            {debugMode && (() => {
              // Calculate visible viewport in world space (green rectangle)
              const visibleWorldMinX = -currentTransform.x / currentTransform.scale;
              const visibleWorldMaxX = (-currentTransform.x + dimensions.width) / currentTransform.scale;
              const visibleWorldMinY = -currentTransform.y / currentTransform.scale;
              const visibleWorldMaxY = (-currentTransform.y + dimensions.height) / currentTransform.scale;

              // Calculate culled viewport in world space (blue rectangle)
              const culledX = currentTransform.x + VIEWPORT_MARGIN;
              const culledY = currentTransform.y + VIEWPORT_MARGIN;
              const culledWidth = dimensions.width + (2 * VIEWPORT_MARGIN);
              const culledHeight = dimensions.height + (2 * VIEWPORT_MARGIN);

              const culledWorldMinX = -culledX / currentTransform.scale;
              const culledWorldMaxX = (-culledX + culledWidth) / currentTransform.scale;
              const culledWorldMinY = -culledY / currentTransform.scale;
              const culledWorldMaxY = (-culledY + culledHeight) / currentTransform.scale;

              return (
                <>
                  {/* Blue rectangle: Culled viewport (with margin) */}
                  <Rect
                    x={culledWorldMinX}
                    y={culledWorldMinY}
                    width={culledWorldMaxX - culledWorldMinX}
                    height={culledWorldMaxY - culledWorldMinY}
                    color="rgba(0, 150, 255, 0.15)"
                    style="stroke"
                    strokeWidth={3 / currentTransform.scale}
                  />

                  {/* Green rectangle: Visible viewport */}
                  <Rect
                    x={visibleWorldMinX}
                    y={visibleWorldMinY}
                    width={visibleWorldMaxX - visibleWorldMinX}
                    height={visibleWorldMaxY - visibleWorldMinY}
                    color="rgba(0, 255, 0, 0.3)"
                    style="stroke"
                    strokeWidth={2 / currentTransform.scale}
                  />
                </>
              );
            })()}
          </Group>
        </Canvas>
        </GestureDetector>
      </RNAnimated.View>

      {/* Debug overlay panel */}
      {debugMode && (
        <View
          style={{
            position: 'absolute',
            top: 60,
            left: 16,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            padding: 12,
            borderRadius: 8,
            minWidth: 280,
            zIndex: 1000,
          }}
          pointerEvents="none"
        >
          <Text style={{ color: '#00FF00', fontSize: 11, fontFamily: 'Courier', marginBottom: 4, fontWeight: 'bold' }}>
            🔧 DEBUG MODE
          </Text>
          <Text style={{ color: '#FFF', fontSize: 10, fontFamily: 'Courier' }}>
            Camera: x={Math.round(currentTransform.x)}, y={Math.round(currentTransform.y)}, scale={currentTransform.scale.toFixed(3)}
          </Text>
          <Text style={{ color: '#FFF', fontSize: 10, fontFamily: 'Courier' }}>
            Bounds: X[{treeBounds?.minX?.toFixed(0) || '?'}, {treeBounds?.maxX?.toFixed(0) || '?'}] Y[{treeBounds?.minY?.toFixed(0) || '?'}, {treeBounds?.maxY?.toFixed(0) || '?'}]
          </Text>
          <Text style={{ color: '#FFF', fontSize: 10, fontFamily: 'Courier' }}>
            Viewport: {dimensions.width}x{dimensions.height}px
          </Text>
          <Text style={{ color: '#FFF', fontSize: 10, fontFamily: 'Courier' }}>
            Margin: {VIEWPORT_MARGIN}px
          </Text>
          <Text style={{ color: '#0FF', fontSize: 10, fontFamily: 'Courier', marginTop: 4 }}>
            Nodes: {nodes.length} total / {visibleNodes.length} visible / {culledNodes.length} culled
          </Text>
          <Text style={{ color: '#FFF', fontSize: 10, fontFamily: 'Courier' }}>
            Tier: {tier} | Connections: {connections.length}
          </Text>
          <Text style={{ color: '#FF0', fontSize: 9, fontFamily: 'Courier', marginTop: 4 }}>
            Green=Visible | Blue=Culled
          </Text>
        </View>
      )}

      <SearchBar
        onSelectResult={handleSearchResultSelect}
        onClearHighlight={clearAllHighlights}
      />

      <NavigateToRootButton
        nodes={nodes}
        viewport={dimensions}
        sharedValues={{
          translateX: translateX,
          translateY: translateY,
          scale: scale,
        }}
        focusPersonId={linkedProfileId || profile?.id}
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

      {/* Edit Profile Modal */}
      <EditProfileScreen
        visible={showEditModal}
        profile={editingProfile}
        onClose={() => {
          setShowEditModal(false);
          setEditingProfile(null);
        }}
        onSave={async (updatedProfile) => {
          // Reload tree data to reflect changes
          await loadTreeData();
        }}
      />

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

          console.log("Passing siblings to QuickAddOverlay:", children.length);
          if (children.length > 0) {
            console.log("Siblings:", children);
          }

          return children.sort(
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

export default TreeView;
