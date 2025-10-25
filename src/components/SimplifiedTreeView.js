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
} from "@shopify/react-native-skia";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDecay,
  withTiming,
  withSequence,
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
// Admin components removed for simplified view
import skiaImageCache from "../services/skiaImageCache";
import { useCachedSkiaImage } from "../hooks/useCachedSkiaImage";
// Profile editing and search components removed for simplified view
import { supabase } from "../services/supabase";
// Haptics and LottieGlow removed - no interaction in simplified view
import NetworkStatusIndicator from "./NetworkStatusIndicator";

// Asymmetric margins to match tree layout: horizontal spacing is 2-3x wider than vertical
const VIEWPORT_MARGIN_X = 2000; // Covers ~20 siblings + collision expansion (max in DB: 10)
const VIEWPORT_MARGIN_Y = 800;  // Covers ~7 generations (sufficient for viewing)
const NODE_WIDTH_WITH_PHOTO = 85;
const NODE_WIDTH_TEXT_ONLY = 60;
const NODE_HEIGHT_WITH_PHOTO = 90;
const NODE_HEIGHT_TEXT_ONLY = 35;
const PHOTO_SIZE = 60;
const LINE_COLOR = "#D1BBA340"; // Camel Hair Beige 40%
const LINE_WIDTH = 2;
const CORNER_RADIUS = 8;

// LOD Constants
const SCALE_QUANTUM = 0.05; // 5% quantization steps
const HYSTERESIS = 0.15; // ±15% hysteresis
const T1_BASE = 48; // Full card threshold (px)
const T2_BASE = 24; // Text pill threshold (px)
const MAX_VISIBLE_NODES = 350; // Hard cap per frame
const MAX_VISIBLE_EDGES = 300; // Hard cap per frame
const LOD_ENABLED = true; // Kill switch
const AGGREGATION_ENABLED = false; // T3 chips disabled in simplified view

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

// Optimized spatial grid for efficient culling with thousands of nodes
const GRID_CELL_SIZE = 256; // Smaller cells for better granularity with dense trees

class SpatialGrid {
  constructor(nodes, cellSize = GRID_CELL_SIZE) {
    this.cellSize = cellSize;
    this.grid = new Map(); // "x,y" -> Array<node> (arrays are faster than Sets)
    this.bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };

    // Pre-calculate bounds and build grid in single pass
    nodes.forEach((node) => {
      // Update bounds
      this.bounds.minX = Math.min(this.bounds.minX, node.x);
      this.bounds.maxX = Math.max(this.bounds.maxX, node.x);
      this.bounds.minY = Math.min(this.bounds.minY, node.y);
      this.bounds.maxY = Math.max(this.bounds.maxY, node.y);

      // Add to grid
      const cellX = Math.floor(node.x / cellSize);
      const cellY = Math.floor(node.y / cellSize);
      const key = `${cellX},${cellY}`;

      if (!this.grid.has(key)) {
        this.grid.set(key, []);
      }
      this.grid.get(key).push(node); // Store node directly, not just ID
    });

    // Pre-calculate cell bounds for early exit
    this.minCellX = Math.floor(this.bounds.minX / cellSize);
    this.maxCellX = Math.floor(this.bounds.maxX / cellSize);
    this.minCellY = Math.floor(this.bounds.minY / cellSize);
    this.maxCellY = Math.floor(this.bounds.maxY / cellSize);
  }

  getVisibleNodes({ x, y, width, height }, scale) {
    // Transform viewport to world space with padding for smooth transitions
    const padding = 100 / scale; // Add padding to preload nearby nodes
    const worldMinX = (-x / scale) - padding;
    const worldMaxX = ((-x + width) / scale) + padding;
    const worldMinY = (-y / scale) - padding;
    const worldMaxY = ((-y + height) / scale) + padding;

    // Early exit if viewport is outside tree bounds
    if (worldMaxX < this.bounds.minX || worldMinX > this.bounds.maxX ||
        worldMaxY < this.bounds.minY || worldMinY > this.bounds.maxY) {
      return [];
    }

    // Get intersecting cells with bounds check
    const minCellX = Math.max(this.minCellX, Math.floor(worldMinX / this.cellSize));
    const maxCellX = Math.min(this.maxCellX, Math.floor(worldMaxX / this.cellSize));
    const minCellY = Math.max(this.minCellY, Math.floor(worldMinY / this.cellSize));
    const maxCellY = Math.min(this.maxCellY, Math.floor(worldMaxY / this.cellSize));

    // Pre-allocate array with estimated size
    const cellCount = (maxCellX - minCellX + 1) * (maxCellY - minCellY + 1);
    const estimatedNodes = Math.min(cellCount * 10, MAX_VISIBLE_NODES);
    const visibleNodes = [];
    visibleNodes.length = 0; // Ensure empty but with allocated capacity

    // Collect nodes from cells with inline bounds checking
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const cellNodes = this.grid.get(`${cx},${cy}`);
        if (cellNodes) {
          for (const node of cellNodes) {
            // Fine-grained bounds check (without padding for accuracy)
            if (node.x >= worldMinX + padding && node.x <= worldMaxX - padding &&
                node.y >= worldMinY + padding && node.y <= worldMaxY - padding) {
              visibleNodes.push(node);

              // Early exit if we hit the cap
              if (visibleNodes.length >= MAX_VISIBLE_NODES) {
                return visibleNodes;
              }
            }
          }
        }
      }
    }

    return visibleNodes;
  }
}

const SimplifiedTreeView = ({ focusPersonId }) => {
  // Simplified tree view - no profile editing or admin features
  const setProfileEditMode = () => {};
  const onNetworkStatusChange = () => {};
  const user = null;
  const isAdmin = false;
  const onAdminDashboard = () => {};
  const onSettingsOpen = () => {};
  const highlightProfileId = focusPersonId; // Use the passed prop
  const focusOnProfile = true; // Enable focus navigation in simplified view
  const stage = useTreeStore((s) => s.stage);
  const setStage = useTreeStore((s) => s.setStage);
  const minZoom = useTreeStore((s) => s.minZoom);
  const maxZoom = useTreeStore((s) => s.maxZoom);
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId);
  const setSelectedPersonId = useTreeStore((s) => s.setSelectedPersonId);
  const treeData = useTreeStore((s) => s.treeData);
  const setTreeData = useTreeStore((s) => s.setTreeData);
  const { settings } = useSettings();
  const { isPreloadingTree } = useAuth();

  const dimensions = useWindowDimensions();
  const [fontReady, setFontReady] = useState(false);

  // Check if we already have preloaded data
  const hasPreloadedData = treeData && treeData.length > 0;

  // Calculate layout early so nodes are available for initial positioning
  const { nodes, connections } = useMemo(() => {
    if (!treeData || treeData.length === 0) {
      return { nodes: [], connections: [] };
    }
    const layout = calculateTreeLayout(treeData);
    return layout;
  }, [treeData]);

  // Initialize loading state - skip if we have preloaded data
  const [isLoading, setIsLoading] = useState(!hasPreloadedData);
  // Skeleton animation removed for simplified view
  const [currentScale, setCurrentScale] = useState(1);
  const [networkError, setNetworkError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Simplified view - no admin or modal state needed
  const isAdminMode = false;

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

  // Simple highlight state for focused node
  const [highlightedNodeIdState, setHighlightedNodeIdState] = useState(focusPersonId);

  // Sync shared values to state for Skia re-renders
  useAnimatedReaction(
    () => ({
      nodeId: highlightedNodeId.value,
      opacity: glowOpacity.value,
    }),
    (current) => {
      runOnJS(setHighlightedNodeIdState)(current.nodeId);
      // Glow opacity removed - using simple highlight
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

    // Simplified: Only 2 tiers (T1 full detail, T2 text only)
    // Apply hysteresis boundaries
    if (state.current === 1) {
      if (nodePx < T1_BASE * (1 - HYSTERESIS)) newTier = 2;
    } else if (state.current === 2) {
      if (nodePx >= T1_BASE * (1 + HYSTERESIS)) newTier = 1;
      // T3 removed - stay in T2 when zoomed far out
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

  // Gesture shared values - start with defaults, will be updated when nodes load
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const isPinching = useSharedValue(false);
  // Initial focal point tracking for proper zoom+pan on physical devices
  const initialFocalX = useSharedValue(0);
  const initialFocalY = useSharedValue(0);

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
      // Skeleton removed
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
          setTreeData([]);
        } else if (rootData?.length === 0) {
          setNetworkError("empty");
          setTreeData([]);
        } else {
          // Fall back to local data
          console.log("Falling back to local data");
          setTreeData(familyData || []);
        }
        // Don't trigger fade animation on error
        // Skeleton removed
        setIsLoading(false);
        return;
      }

      // Then load the tree starting from the root HID
      const rootHid = rootData[0].hid;
      const { data, error } = await profilesService.getBranchData(
        rootHid,
        10, // Standardized depth (matches TreeView.js and useStore.js)
        5000, // Supports 3K incoming profiles + 67% buffer
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
          setTreeData([]);
        } else {
          // Fall back to local data if backend fails
          setTreeData(familyData || []);
        }
      } else {
        setTreeData(data || []);
        setNetworkError(null); // Clear any previous errors
      }

      // No skeleton animations in simplified view

      const totalLoadTime = Date.now() - startTime;
      console.log('[TreeView] Tree loaded successfully in', totalLoadTime, 'ms');
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
        setTreeData([]);
      } else {
        // Fall back to local data
        setTreeData(familyData || []);
      }
      // Don't trigger fade animation on error
      // Skeleton removed
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
      console.log('[TreeView] Tree data updated, hiding loading state');
      setIsLoading(false);
      // Skeleton removed
    }
  }, [treeData, isLoading]);

  // Skeleton animations removed for simplified view

  // Load tree data on mount
  useEffect(() => {
    // If we already have adequate data, skip everything - instant render
    if (treeData && treeData.length >= 400) {
      console.log('[TreeView] Full tree data available (', treeData.length, 'nodes), skipping skeleton entirely');
      setIsLoading(false);
      // Skeleton removed
      // Animation values removed
      return;
    }

    // No adequate data exists, load it
    if (treeData && treeData.length > 0) {
      console.log('[TreeView] Partial data exists (', treeData.length, 'nodes), loading full tree');
    } else {
      console.log('[TreeView] No preloaded data, loading now');
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
                  start_date: marriage.start_date
                    ? formatDateByPreference(
                        marriage.start_date,
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
                  start_date: marriage.start_date
                    ? formatDateByPreference(
                        marriage.start_date,
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

  // Layout already calculated earlier in the component

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

  // Visible bounds for culling
  const [visibleBounds, setVisibleBounds] = useState({
    minX: -VIEWPORT_MARGIN_X,
    maxX: dimensions.width + VIEWPORT_MARGIN_X,
    minY: -VIEWPORT_MARGIN_Y,
    maxY: dimensions.height + VIEWPORT_MARGIN_Y,
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
      // Scale-dependent margins: larger when zoomed out, asymmetric to match tree layout
      const dynamicMarginX = VIEWPORT_MARGIN_X / current.scale;
      const dynamicMarginY = VIEWPORT_MARGIN_Y / current.scale;

      const newBounds = {
        minX: (-current.x - dynamicMarginX) / current.scale,
        maxX: (-current.x + dimensions.width + dynamicMarginX) / current.scale,
        minY: (-current.y - dynamicMarginY) / current.scale,
        maxY: (-current.y + dimensions.height + dynamicMarginY) / current.scale,
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
  // Optimized visible nodes calculation for thousands of nodes
  const visibleNodes = useMemo(() => {
    // For thousands of nodes, use spatial grid if available
    if (nodes.length > 500 && spatialGrid) {
      // Spatial grid handles culling efficiently
      return spatialGrid.getVisibleNodes(
        { x: currentTransform.x, y: currentTransform.y, width: dimensions.width, height: dimensions.height },
        currentTransform.scale
      );
    }

    // Fallback to simple bounds check for smaller trees
    // Pre-allocate array for better performance
    const visible = [];
    const boundsMinX = visibleBounds.minX;
    const boundsMaxX = visibleBounds.maxX;
    const boundsMinY = visibleBounds.minY;
    const boundsMaxY = visibleBounds.maxY;

    // Use for loop for better performance than filter
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.x >= boundsMinX && node.x <= boundsMaxX &&
          node.y >= boundsMinY && node.y <= boundsMaxY) {
        visible.push(node);

        // Cap visible nodes to prevent performance issues
        if (visible.length >= MAX_VISIBLE_NODES) {
          break;
        }
      }
    }

    return visible;
  }, [nodes, visibleBounds, currentTransform, spatialGrid, dimensions]);

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

  // Initialize position on first load - center on focused node if provided
  // Track if we've already positioned to avoid re-centering
  const hasPositionedRef = useRef(false);

  useEffect(() => {
    // Only position once when nodes are first loaded
    if (nodes.length > 0 && !hasPositionedRef.current && dimensions.width > 0) {
      hasPositionedRef.current = true;

      let offsetX, offsetY, initialScale;

      // If we have a focused node, center on it immediately
      if (focusPersonId) {
        const targetNode = nodes.find(n => n.id === focusPersonId);
        if (targetNode) {
          console.log('[SimplifiedTreeView] Centering on focused node:', targetNode.name, 'at', targetNode.x, targetNode.y);
          // Start with a moderate zoom level for better overview
          initialScale = 1.0;  // Reduced from 1.5 for better overview
          // Center the focused node on screen - position higher (1/4 from top) for better tree visibility
          offsetX = dimensions.width / 2 - targetNode.x * initialScale;
          offsetY = (dimensions.height * 0.25) - targetNode.y * initialScale;  // 25% from top for higher positioning
        } else {
          console.warn('[SimplifiedTreeView] Focused node not found:', focusPersonId);
          // Fallback to default centering if node not found
          offsetX = dimensions.width / 2 - (treeBounds.minX + treeBounds.maxX) / 2;
          offsetY = 80;
          initialScale = 1;
        }
      } else {
        // No focused node, use default centering
        offsetX = dimensions.width / 2 - (treeBounds.minX + treeBounds.maxX) / 2;
        offsetY = 80;
        initialScale = 1;
      }

      // Set initial values directly without animation
      translateX.value = offsetX;
      translateY.value = offsetY;
      scale.value = initialScale;
      savedTranslateX.value = offsetX;
      savedTranslateY.value = offsetY;
      savedScale.value = initialScale;

      setStage({ x: offsetX, y: offsetY, scale: initialScale });

      // Also update currentTransform to trigger proper rendering
      setCurrentTransform({ x: offsetX, y: offsetY, scale: initialScale });
    }
  }, [nodes.length, dimensions.width, focusPersonId]); // Only depend on essential values

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

      // Highlight is now handled by simple state
      setHighlightedNodeIdState(nodeId);
    },
    [nodes, dimensions, translateX, translateY, scale],
  );

  // Highlight animation removed - using simple state for focused node

  // Handle highlight from navigation params - DISABLED for simplified view
  // The initial centering is now handled in the initialization effect above
  useEffect(() => {
    // Disabled - we don't want animation, just immediate centering
    // if (highlightProfileId && focusOnProfile && nodes.length > 0) {
    //   setTimeout(() => {
    //     navigateToNode(highlightProfileId);
    //   }, 500);
    // }
  }, [highlightProfileId, focusOnProfile, nodes.length]); // Don't include navigateToNode to avoid infinite loops

  // Search removed from simplified view

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
    })
    .onUpdate((e) => {
      "worklet";
      // Don't update during pinch
      if (isPinching.value) {
        return;
      }
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd((e) => {
      "worklet";
      // Don't apply momentum if we were pinching
      if (isPinching.value) {
        return;
      }

      translateX.value = withDecay({
        velocity: e.velocityX,
        deceleration: 0.995,
      });
      translateY.value = withDecay({
        velocity: e.velocityY,
        deceleration: 0.995,
      });

      // Save current values (before decay animation modifies them)
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
      // Save final values
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      isPinching.value = false;
    });

  // No node tap handler in simplified view - profiles cannot be opened

  // Tap gesture disabled in simplified view
  const tapGesture = Gesture.Tap()
    .maxDistance(10)
    .maxDuration(250)
    .runOnJS(true)
    .onEnd((e) => {
      // Do nothing - no profile opening in simplified view
      return;
      const state = gestureStateRef.current;

      // T3 mode removed in simplified view

      // Original node tap logic for T1/T2
      const canvasX = (e.x - state.transform.x) / state.transform.scale;
      const canvasY = (e.y - state.transform.y) / state.transform.scale;

      // DEBUG: Log tap coordinates
      // if (__DEV__) {
      //   console.log(`👆 TAP: Screen(${e.x.toFixed(0)},${e.y.toFixed(0)}) → Canvas(${canvasX.toFixed(0)},${canvasY.toFixed(0)}) @ Scale:${scale.value.toFixed(2)}`);
      // }

      let tappedNodeId = null;
      for (const node of state.visibleNodes) {
        const nodeWidth = node.photo_url
          ? NODE_WIDTH_WITH_PHOTO
          : NODE_WIDTH_TEXT_ONLY;
        const nodeHeight = node.photo_url
          ? NODE_HEIGHT_WITH_PHOTO
          : NODE_HEIGHT_TEXT_ONLY;

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

    });

  // No long press gesture in simplified view

  // Chip tap and context menu removed - no interaction in simplified view

  // Compose gestures - allow simultaneous but with guards in each gesture
  const composed = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    tapGesture, // Tap gesture does nothing in simplified view
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
      // Tier 3 removed - always render edges

      let edgeCount = 0;
      const paths = [];
      const pathBuilder = Skia.Path.Make();
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
            const childHeight = childNode.photo_url
              ? NODE_HEIGHT_WITH_PHOTO
              : NODE_HEIGHT_TEXT_ONLY;
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

  // T3 aggregation removed in simplified view
  const renderTier3 = useCallback(
    () => {
      return null; // T3 disabled
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
      const isFocused = focusPersonId === node.id; // Check if this is the focused node

      return (
        <Group key={node.id}>
          {/* Red glow effect for focused node */}
          {isFocused && (
            <>
              {/* Outer glow */}
              <RoundedRect
                x={x - 3}
                y={y - 3}
                width={nodeWidth + 6}
                height={nodeHeight + 6}
                r={16}
                color="#A13333"
                opacity={0.3}
              />
              {/* Inner glow */}
              <RoundedRect
                x={x - 1.5}
                y={y - 1.5}
                width={nodeWidth + 3}
                height={nodeHeight + 3}
                r={14.5}
                color="#A13333"
                opacity={0.5}
              />
            </>
          )}

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

          {/* Border - red for focused node */}
          <RoundedRect
            x={x}
            y={y}
            width={nodeWidth}
            height={nodeHeight}
            r={13}
            color={isFocused ? "#A13333" : (isSelected ? "#A13333" : "#D1BBA360")}
            style="stroke"
            strokeWidth={isFocused ? 2 : (isSelected ? 1.5 : 1)}
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
      const hasPhoto = !!node.photo_url;
      // Respect the node's custom width if it has one (for text sizing)
      const nodeWidth =
        node.nodeWidth ||
        (hasPhoto ? NODE_WIDTH_WITH_PHOTO : NODE_WIDTH_TEXT_ONLY);
      const nodeHeight = hasPhoto
        ? NODE_HEIGHT_WITH_PHOTO
        : NODE_HEIGHT_TEXT_ONLY;
      const isSelected = selectedPersonId === node.id;
      const isFocused = focusPersonId === node.id; // Check if this is the focused node

      const x = node.x - nodeWidth / 2;
      const y = node.y - nodeHeight / 2;

      const isHighlighted = highlightedNodeIdState === node.id;

      return (
        <Group key={node.id}>
          {/* Red glow effect for focused node */}
          {isFocused && (
            <>
              {/* Outer glow */}
              <RoundedRect
                x={x - 4}
                y={y - 4}
                width={nodeWidth + 8}
                height={nodeHeight + 8}
                r={CORNER_RADIUS + 2}
                color="#A13333"
                opacity={0.3}
              />
              {/* Inner glow */}
              <RoundedRect
                x={x - 2}
                y={y - 2}
                width={nodeWidth + 4}
                height={nodeHeight + 4}
                r={CORNER_RADIUS + 1}
                color="#A13333"
                opacity={0.5}
              />
            </>
          )}

          {/* Shadow */}
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

          {/* Border - red for focused node */}
          <RoundedRect
            x={x}
            y={y}
            width={nodeWidth}
            height={nodeHeight}
            r={CORNER_RADIUS}
            color={isFocused ? "#A13333" : (isSelected ? "#A13333" : "#D1BBA360")}
            style="stroke"
            strokeWidth={isFocused ? 3 : (isSelected ? 2.5 : 1.2)}
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
                  11,
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
                  11,
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
            </>
          )}
        </Group>
      );
    },
    [selectedPersonId, highlightedNodeIdState, focusPersonId],
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

  // Update transform values when they change
  useAnimatedReaction(
    () => ({
      x: translateX.value,
      y: translateY.value,
      scale: scale.value,
    }),
    (current) => {
      runOnJS(setCurrentTransform)(current);
    },
  );

  // Calculate current LOD tier using the state instead of accessing .value directly
  const tier = calculateLODTier(currentTransform.scale);
  frameStatsRef.current.tier = tier;

  // Calculate culled nodes (with loading fallback)
  const culledNodes = useMemo(() => {
    if (isLoading) return [];
    // Tier 3 removed
    if (!spatialGrid) return visibleNodes;
    return spatialGrid.getVisibleNodes(
      {
        x: currentTransform.x,
        y: currentTransform.y,
        width: dimensions.width,
        height: dimensions.height,
      },
      currentTransform.scale
    );
  }, [
    isLoading,
    tier,
    spatialGrid,
    currentTransform,
    dimensions,
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
      };
      return renderNode(modifiedNode);
    },
    [
      tier,
      currentTransform.scale,
      renderNode,
      renderTier2Node,
      selectBucketWithHysteresis,
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
      <NetworkStatusIndicator
        mode="fullscreen"
        errorType={networkError === 'network' ? 'network' : 'server'}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />
    );
  }

  // Skeleton animation removed - not needed in simplified view

  // TreeSkeleton component removed - not needed in simplified view
  const TreeSkeleton = () => null;

  // Placeholder to maintain line numbers
  const placeholderComponent = () => (
    <View style={{
      flex: 1,
      backgroundColor: '#F9F7F3',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    }}>
      {/* Root node at center top */}
      <View style={{ alignItems: 'center', marginTop: -100 }}>
        <View
          style={{
            width: 120,
            height: 70,
            backgroundColor: '#D1BBA340',
            borderRadius: 10,
            borderWidth: 2,
            borderColor: '#D1BBA330',
            opacity: 1,
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
      <View style={{ flex: 1, backgroundColor: "#F9F7F3" }}>
        {/* Simple loading state - no skeleton needed */}
        <View style={{ flex: 1 }} />
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
  frameStatsRef.current.nodesDrawn = culledNodes.length;
  frameStatsRef.current.edgesDrawn = edgesDrawn;

  // TIER 3 removed - simplified view only has 2 tiers

  return (
    <View style={{ flex: 1, backgroundColor: "#F9F7F3" }}>
      {/* Main tree content - no skeleton or fade animations */}
      <View style={{ flex: 1 }}>
        <GestureDetector gesture={composed}>
          <Canvas style={{ flex: 1 }}>
          <Group transform={transform}>
            {/* Render batched edges first */}
            {edgeElements}

            {/* Render visible nodes */}
            {culledNodes.map(renderNodeWithTier)}

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
          </Group>
        </Canvas>
        </GestureDetector>
      </View>

      {/* LottieGlow removed - using simple red border for focused node */}
      {/* Navigation button to center on focused node */}
      <NavigateToRootButton
        nodes={nodes}
        viewport={dimensions}
        sharedValues={{
          translateX: translateX,
          translateY: translateY,
          scale: scale,
        }}
        focusPersonId={focusPersonId}
      />

      {/* All admin components and modals removed for simplified view */}
    </View>
  );
};

export default SimplifiedTreeView;
