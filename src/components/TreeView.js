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
import { useFilteredTreeStore } from "../contexts/FilteredTreeContext";
import profilesService from "../services/profiles";
import { formatDateDisplay } from "../services/migrationHelpers";
import { SettingsContext } from "../contexts/SettingsContext";
import { useContext } from "react";
import { formatDateByPreference } from "../utils/dateDisplay";
import NavigateToRootButton from "./NavigateToRootButton";
import AdminToggleButton from "./AdminToggleButton";
import SettingsButton from "./SettingsButton";
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
import LottieGlow from "./LottieGlow";
import NetworkErrorView from "./NetworkErrorView";

const VIEWPORT_MARGIN = 800; // Increased to reduce culling jumps on zoom
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
  setProfileEditMode = () => {}, // Default noop function
  onNetworkStatusChange = () => {}, // Default noop function
  user = null, // Default null user
  onAdminDashboard = () => {}, // Default noop function
  onSettingsOpen = () => {}, // Default noop function
  isFilteredView = false, // New prop to indicate filtered view
}) => {
  // Use filtered store if available, otherwise use global store
  const stage = useFilteredTreeStore((s) => s.stage);
  const setStage = useFilteredTreeStore((s) => s.setStage);
  const minZoom = useFilteredTreeStore((s) => s.minZoom);
  const maxZoom = useFilteredTreeStore((s) => s.maxZoom);
  const selectedPersonId = useFilteredTreeStore((s) => s.selectedPersonId);
  const setSelectedPersonId = useFilteredTreeStore(
    (s) => s.setSelectedPersonId,
  );
  const treeData = useFilteredTreeStore((s) => s.treeData);
  const setTreeData = useFilteredTreeStore((s) => s.setTreeData);

  // Get filtered view specific properties
  const focusPersonId = useFilteredTreeStore((s) => s.focusPersonId);
  const permanentHighlight = useFilteredTreeStore((s) => s.permanentHighlight);
  const isFilteredStore = useFilteredTreeStore((s) => s.isFilteredView);

  // Use ref to track if we've already logged the settings warning
  const hasLoggedSettingsWarning = useRef(false);

  // Try to get settings context - will be null if not in provider
  const settingsContext = useContext(SettingsContext);

  // Use settings if available, otherwise use defaults (for filtered view)
  const settings = settingsContext?.settings || {
    defaultCalendar: "gregorian",
    dateFormat: "numeric",
    showBothCalendars: false,
    arabicNumerals: false,
  };

  // Log once if running outside provider
  useEffect(() => {
    if (!settingsContext && !hasLoggedSettingsWarning.current) {
      console.log("TreeView running outside SettingsProvider, using defaults");
      hasLoggedSettingsWarning.current = true;
    }
  }, [settingsContext]);

  const dimensions = useWindowDimensions();
  const [fontReady, setFontReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
  const initializeProfileSheetProgress = useFilteredTreeStore(
    (s) => s.initializeProfileSheetProgress,
  );

  // Initialize immediately on first render - don't wait for useEffect
  useMemo(() => {
    initializeProfileSheetProgress(profileSheetProgress);
  }, []); // Empty deps = run once on mount

  // State for triggering re-renders
  const [highlightedNodeIdState, setHighlightedNodeIdState] = useState(null);
  const [glowOpacityState, setGlowOpacityState] = useState(0);
  const [glowTrigger, setGlowTrigger] = useState(0); // Force re-trigger on same node

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
      else if (nodePx < T2_BASE * (1 - HYSTERESIS)) newTier = 3;
    } else {
      // tier 3
      if (nodePx >= T2_BASE * (1 + HYSTERESIS)) newTier = 2;
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

  // Sync scale value to React state for use in render
  useAnimatedReaction(
    () => scale.value,
    (current) => {
      runOnJS(setCurrentScale)(current);
    },
  );

  // Load tree data using branch loading
  const loadTreeData = async () => {
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
          setTreeData([]);
        } else {
          // Fall back to local data if backend fails
          setTreeData(familyData || []);
        }
      } else {
        setTreeData(data || []);
        setNetworkError(null); // Clear any previous errors
      }

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
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await loadTreeData();
  };

  // Load tree data on mount
  useEffect(() => {
    loadTreeData();
  }, [setTreeData]);

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

  // Calculate layout
  const { nodes, connections } = useMemo(() => {
    if (isLoading || !treeData || treeData.length === 0) {
      return { nodes: [], connections: [] };
    }
    const layout = calculateTreeLayout(treeData);

    // DEBUG: Log canvas coordinates summary (these should NEVER change)
    // if (__DEV__ && layout.nodes.length > 0) {
    //   const bounds = layout.nodes.reduce((acc, node) => ({
    //     minX: Math.min(acc.minX, node.x),
    //     maxX: Math.max(acc.maxX, node.x),
    //     minY: Math.min(acc.minY, node.y),
    //     maxY: Math.max(acc.maxY, node.y)
    //   }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    //
    //   console.log('🎯 LAYOUT CALCULATED:');
    //   console.log(`  Nodes: ${layout.nodes.length}, Connections: ${layout.connections.length}`);
    //   console.log(`  Bounds: X[${bounds.minX.toFixed(0)}, ${bounds.maxX.toFixed(0)}] Y[${bounds.minY.toFixed(0)}, ${bounds.maxY.toFixed(0)}]`);
    //   console.log(`  Root: ${layout.nodes[0]?.name} at (${layout.nodes[0]?.x.toFixed(0)}, ${layout.nodes[0]?.y.toFixed(0)})`);
    // }

    return layout;
  }, [treeData, isLoading]);

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

  // Initialize position on first load
  useEffect(() => {
    if (
      nodes.length > 0 &&
      stage.x === 0 &&
      stage.y === 0 &&
      stage.scale === 1
    ) {
      const offsetX =
        dimensions.width / 2 - (treeBounds.minX + treeBounds.maxX) / 2;
      const offsetY = 80;

      translateX.value = offsetX;
      translateY.value = offsetY;
      savedTranslateX.value = offsetX;
      savedTranslateY.value = offsetY;

      setStage({ x: offsetX, y: offsetY, scale: 1 });
    }
  }, [nodes, dimensions, treeBounds]);

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
      const currentScaleValue = currentTransform.scale;
      const targetScale =
        currentScaleValue < 0.8 || currentScaleValue > 3
          ? 1.5
          : currentScaleValue;

      // CORRECT FORMULA: To center a node on screen
      // We want: node canvas position * scale + translate = screen center
      // So: targetNode.x * targetScale + translateX = width/2
      // Therefore: translateX = width/2 - targetNode.x * targetScale
      const targetX = dimensions.width / 2 - targetNode.x * targetScale;
      const targetY = dimensions.height / 2 - targetNode.y * targetScale;

      console.log(
        "Current scale:",
        currentScaleValue,
        "Target scale:",
        targetScale,
      );
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

      // Start highlight animation only in main view (not in filtered view)
      if (!isFilteredStore) {
        highlightNode(nodeId);
      }
    },
    [nodes, dimensions, translateX, translateY, scale],
  );

  // Initialize centered on focus person in filtered view (no animation)
  useEffect(() => {
    if (isFilteredStore && focusPersonId && nodes.length > 0 && !isLoading) {
      // Find the focus person in the nodes
      const focusNode = nodes.find((n) => n.id === focusPersonId);
      if (focusNode && focusNode.x !== undefined && focusNode.y !== undefined) {
        // Small delay to ensure layout is complete
        const timer = setTimeout(() => {
          console.log("Centering on focus person:", focusPersonId);
          console.log("Node position:", focusNode.x, focusNode.y);
          console.log("Viewport size:", dimensions.width, dimensions.height);

          // Calculate center position
          const viewportCenterX = dimensions.width / 2;
          const viewportCenterY = dimensions.height / 2;

          // Calculate translation to center the node
          // Translation moves the entire canvas, so we translate opposite to node position
          const targetX = viewportCenterX - focusNode.x;
          const targetY = viewportCenterY - focusNode.y;

          console.log("Translation target:", targetX, targetY);

          // Set directly without animation
          translateX.value = targetX;
          translateY.value = targetY;
          savedTranslateX.value = targetX;
          savedTranslateY.value = targetY;

          // Set reasonable zoom level for verification (not too zoomed)
          const initialScale = 1.0;
          scale.value = initialScale;
          savedScale.value = initialScale;

          // Update stage for consistency
          setStage({ x: targetX, y: targetY, scale: initialScale });
        }, 100); // Small delay for layout

        return () => clearTimeout(timer);
      }
    }
  }, [
    isFilteredStore,
    focusPersonId,
    nodes.length,
    isLoading,
    dimensions.width,
    dimensions.height,
  ]); // Don't depend on animated values to avoid re-runs

  // Highlight node with elegant golden effect using Reanimated
  const highlightNode = useCallback((nodeId) => {
    // Force re-trigger by incrementing trigger counter
    setGlowTrigger((prev) => prev + 1);

    // Set the highlighted node
    highlightedNodeId.value = nodeId;

    // Elegant animation: quick burst, gentle hold, smooth fade
    glowOpacity.value = withSequence(
      // Quick initial flash
      withTiming(1, { duration: 300, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
      // Brief peak hold
      withTiming(0.95, { duration: 200, easing: Easing.linear }),
      // Gentle pulse at peak
      withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
      // Hold at high intensity
      withTiming(0.9, { duration: 600, easing: Easing.linear }),
      // Smooth fade out
      withTiming(0, { duration: 800, easing: Easing.bezier(0.6, 0, 0.8, 1) }),
    );

    // Clear highlight after animation completes
    setTimeout(() => {
      highlightedNodeId.value = null;
    }, 2500);

    // Haptic feedback with impact
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  // Handle search result selection
  const handleSearchResultSelect = useCallback(
    (result) => {
      console.log("Search result selected:", result);

      // Check if the node is in the current nodes array
      const nodeExists = nodes.some((n) => n.id === result.id);

      if (nodeExists) {
        console.log("Node found in tree, navigating");
        navigateToNode(result.id);
      } else {
        console.log("Node not in current tree view");
        Alert.alert(
          "العقدة غير محملة",
          "هذه العقدة غير موجودة في العرض الحالي. قم بتحميل المزيد من الشجرة لرؤيتها.",
          [{ text: "حسناً", style: "default" }],
        );
      }
    },
    [navigateToNode, nodes],
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

      handleNodeTap(tappedNodeId);
    });

  // Long press gesture for quick add
  const longPressGesture = Gesture.LongPress()
    .minDuration(500) // 0.5 seconds
    .maxDistance(10)
    .runOnJS(true)
    .onStart((e) => {
      if (!isAdminMode) return;

      const state = gestureStateRef.current;

      // Don't handle in T3 mode
      if (state.tier === 3) return;

      // Find which node was long-pressed
      const canvasX = (e.x - state.transform.x) / state.transform.scale;
      const canvasY = (e.y - state.transform.y) / state.transform.scale;

      let pressedNode = null;
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

  // Handle node tap - show profile sheet (edit mode if admin)
  const handleNodeTap = useCallback(
    (nodeId) => {
      // In filtered view, don't allow selecting other nodes
      if (isFilteredStore) {
        console.log("Node tap blocked in filtered view");
        return;
      }

      // console.log('TreeView: Node tapped, isAdminMode:', isAdminMode);
      setSelectedPersonId(nodeId);
      setProfileEditMode(isAdminMode);
      // console.log('TreeView: Setting profileEditMode to:', isAdminMode);
    },
    [setSelectedPersonId, isAdminMode, isFilteredStore],
  );

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
  // In filtered view, only allow panning (no zoom, no tap)
  const composed = isFilteredView
    ? panGesture
    : Gesture.Simultaneous(
        panGesture,
        pinchGesture,
        isAdminMode
          ? Gesture.Exclusive(longPressGesture, tapGesture)
          : tapGesture,
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
      const isPermanentHighlight = permanentHighlight === node.id;

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
            color={isPermanentHighlight ? "#A1333310" : "#FFFFFF"}
          />

          {/* Border */}
          <RoundedRect
            x={x}
            y={y}
            width={nodeWidth}
            height={nodeHeight}
            r={13}
            color={isSelected || isPermanentHighlight ? "#A13333" : "#D1BBA360"}
            style="stroke"
            strokeWidth={isSelected || isPermanentHighlight ? 1.5 : 1}
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

      const x = node.x - nodeWidth / 2;
      const y = node.y - nodeHeight / 2;

      const isHighlighted = highlightedNodeIdState === node.id;
      const isPermanentHighlight = permanentHighlight === node.id;

      return (
        <Group key={node.id}>
          {/* Removed broken Skia glow - will use Moti overlay instead */}
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
            color={isPermanentHighlight ? "#A1333310" : "#FFFFFF"}
          />

          {/* Border */}
          <RoundedRect
            x={x}
            y={y}
            width={nodeWidth}
            height={nodeHeight}
            r={CORNER_RADIUS}
            color={isSelected || isPermanentHighlight ? "#A13333" : "#D1BBA360"}
            style="stroke"
            strokeWidth={isSelected || isPermanentHighlight ? 2.5 : 1.2}
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
    [selectedPersonId, highlightedNodeIdState, glowOpacityState],
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
    if (tier === 3) return [];
    if (!spatialGrid) return visibleNodes;
    return spatialGrid.getVisibleNodes(
      {
        x: currentTransform.x,
        y: currentTransform.y,
        width: dimensions.width,
        height: dimensions.height,
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
      <NetworkErrorView
        errorType={networkError}
        onRetry={handleRetry}
        isRetrying={isRetrying}
      />
    );
  }

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F9F7F3",
        }}
      >
        <ActivityIndicator size="large" color="#A13333" />
        <Text style={{ marginTop: 16, fontSize: 16, color: "#24212199" }}>
          جاري تحميل الشجرة...
        </Text>
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
      <View className="flex-1" style={{ backgroundColor: "#F9F7F3" }}>
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
    <View className="flex-1" style={{ backgroundColor: "#F9F7F3" }}>
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

      {/* Lottie Glow Effect Overlay */}
      {highlightedNodeIdState &&
        glowOpacityState > 0 &&
        (() => {
          const highlightedNode = nodes.find(
            (n) => n.id === highlightedNodeIdState,
          );
          if (!highlightedNode) return null;

          // Determine node tier and get appropriate border radius
          const isT1 = indices?.heroNodes?.some(
            (hero) => hero.id === highlightedNode.id,
          );
          const isT2 = indices?.searchTiers?.[highlightedNode.id] === 2;

          let borderRadius;
          if (isT1) {
            borderRadius = 16; // T1 hero nodes
          } else if (isT2) {
            borderRadius = 13; // T2 text-only nodes
          } else {
            borderRadius = CORNER_RADIUS; // Regular nodes (8)
          }

          // Get actual node dimensions based on whether it has a photo
          const nodeWidth = highlightedNode.profile_photo_url
            ? NODE_WIDTH_WITH_PHOTO
            : NODE_WIDTH_TEXT_ONLY;
          const nodeHeight = highlightedNode.profile_photo_url
            ? NODE_HEIGHT_WITH_PHOTO
            : NODE_HEIGHT_TEXT_ONLY;

          // Use current transform state instead of accessing shared values directly
          const screenX =
            highlightedNode.x * currentTransform.scale + currentTransform.x;
          const screenY =
            highlightedNode.y * currentTransform.scale + currentTransform.y;

          return (
            <LottieGlow
              key={`glow-${glowTrigger}`} // Force re-mount on same node
              visible={true}
              x={screenX}
              y={screenY}
              width={nodeWidth * currentTransform.scale}
              height={nodeHeight * currentTransform.scale}
              borderRadius={borderRadius * currentTransform.scale}
              onAnimationFinish={() => {
                // Clear highlight after fade-out completes
                setHighlightedNodeIdState(null);
                setGlowOpacityState(0);
              }}
            />
          );
        })()}

      {/* Only show controls when not in filtered view */}
      {!isFilteredView && (
        <>
          {/* Search bar */}
          <SearchBar onSelectResult={handleSearchResultSelect} />

          {/* Navigate to Root Button */}
          <NavigateToRootButton
            nodes={nodes}
            viewport={dimensions}
            sharedValues={{
              translateX: translateX,
              translateY: translateY,
              scale: scale,
            }}
          />

          {/* Settings Button - Always rendered like other buttons */}
          <SettingsButton onPress={onSettingsOpen} />

          {/* Admin Toggle Button - Only when logged in */}
          {user && (
            <AdminToggleButton user={user} onLongPress={onAdminDashboard} />
          )}
        </>
      )}

      {/* Admin components - hide in filtered view */}
      {isAdminMode && !isFilteredView && (
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
