import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { View, Dimensions, useWindowDimensions, Platform, I18nManager, ActivityIndicator, Text, Alert } from 'react-native';
import { Canvas, Group, Rect, Line, Circle, vec, RoundedRect, useImage, Image as SkiaImage, Skia, Mask, Paragraph, listFontFamilies, Text as SkiaText, useFont } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDecay,
  withTiming,
  Easing,
  runOnJS,
  clamp,
  useAnimatedReaction,
  cancelAnimation,
  useDerivedValue
} from 'react-native-reanimated';
import { familyData } from '../data/family-data';
import { Asset } from 'expo-asset';
import { calculateTreeLayout } from '../utils/treeLayout';
import { useTreeStore } from '../stores/useTreeStore';
import profilesService from '../services/profiles';
import { formatDateDisplay } from '../services/migrationHelpers';
import NavigateToRootButton from './NavigateToRootButton';
import { useAdminMode } from '../contexts/AdminModeContext';
import GlobalFAB from './admin/GlobalFAB';
import SystemStatusIndicator from './admin/SystemStatusIndicator';
import MultiAddChildrenModal from './admin/MultiAddChildrenModal';
import NodeContextMenu from './admin/NodeContextMenu';
import EditProfileScreen from '../screens/EditProfileScreen';
import { supabase } from '../services/supabase';

const VIEWPORT_MARGIN = 800; // Increased to reduce culling jumps on zoom
const NODE_WIDTH_WITH_PHOTO = 85;
const NODE_WIDTH_TEXT_ONLY = 60;
const NODE_HEIGHT_WITH_PHOTO = 90;
const NODE_HEIGHT_TEXT_ONLY = 35;
const PHOTO_SIZE = 60;
const LINE_COLOR = '#BDBDBD';
const LINE_WIDTH = 2;
const CORNER_RADIUS = 8;

// Create font manager/provider once
let fontMgr = null;
let arabicFontProvider = null;
let arabicTypeface = null;
let arabicFont = null;
let arabicFontBold = null;
let sfArabicRegistered = false;

const SF_ARABIC_ALIAS = 'SF Arabic';
const SF_ARABIC_ASSET = require('../../assets/fonts/SF Arabic Regular.ttf');

try {
  fontMgr = Skia.FontMgr.System();
  arabicFontProvider = Skia.TypefaceFontProvider.Make();
  
  // List all available fonts to find Arabic fonts
  const availableFonts = listFontFamilies();
  // Try to match Arabic fonts - prioritize SF Arabic
  const arabicFontNames = [
    'SF Arabic',       // Prefer SF Arabic explicitly
    '.SF Arabic',      // Alternate internal name variants
    '.SF NS Arabic',
    '.SFNSArabic',
    'Geeza Pro',
    'GeezaPro',
    'Damascus',
    'Al Nile',
    'Baghdad',
    '.SF NS Display',
    '.SF NS Text',
    '.SF NS',
    '.SFNS-Regular'
  ];
  
  for (const fontName of arabicFontNames) {
    try {
      arabicTypeface = fontMgr.matchFamilyStyle(fontName, { weight: 400, width: 5, slant: 0 });
      if (arabicTypeface) {
        // Create Font objects from typeface
        arabicFont = Skia.Font(arabicTypeface, 11);
        const boldTypeface = fontMgr.matchFamilyStyle(fontName, { weight: 700, width: 5, slant: 0 });
        arabicFontBold = boldTypeface ? Skia.Font(boldTypeface, 11) : arabicFont;
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
      ellipsis: '...',
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
      fontFamilies: arabicTypeface ? [SF_ARABIC_ALIAS] : [
        SF_ARABIC_ALIAS,
        '.SF Arabic',
        '.SF NS Arabic',
        '.SFNSArabic', 
        'Geeza Pro',
        'GeezaPro',
        'Damascus',
        'Al Nile',
        'Baghdad',
        'System'
      ],
      fontStyle: {
        weight: fontWeight === 'bold' ? 700 : 400,
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
    console.error('Error creating paragraph:', error);
    return null;
  }
};

// Image component for photos
const ImageNode = ({ url, x, y, width, height, radius }) => {
  const image = useImage(url);
  
  // Always render placeholder circle to prevent pop-in
  if (!image) {
    return (
      <Circle 
        cx={x + radius}
        cy={y + radius}
        r={radius}
        color="#F5F5F5"
      />
    );
  }
  
  return (
    <Group>
      <Mask 
        mode="alpha"
        mask={
          <Circle 
            cx={x + radius}
            cy={y + radius}
            r={radius}
            color="white"
          />
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


const TreeView = ({ setProfileEditMode }) => {
  const stage = useTreeStore(s => s.stage);
  const setStage = useTreeStore(s => s.setStage);
  const minZoom = useTreeStore(s => s.minZoom);
  const maxZoom = useTreeStore(s => s.maxZoom);
  const selectedPersonId = useTreeStore(s => s.selectedPersonId);
  const setSelectedPersonId = useTreeStore(s => s.setSelectedPersonId);
  const treeData = useTreeStore(s => s.treeData);
  const setTreeData = useTreeStore(s => s.setTreeData);
  
  const dimensions = useWindowDimensions();
  const [fontReady, setFontReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Admin mode state
  const { isAdminMode } = useAdminMode();
  const [showMultiAddModal, setShowMultiAddModal] = useState(false);
  const [multiAddParent, setMultiAddParent] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuNode, setContextMenuNode] = useState(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [editingProfile, setEditingProfile] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Force RTL for Arabic text
  useEffect(() => {
    I18nManager.forceRTL(true);
  }, []);
  
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
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Load tree data using branch loading
  const loadTreeData = async () => {
      setIsLoading(true);
      try {
        // First get the root node
        const { data: rootData, error: rootError } = await profilesService.getBranchData(null, 1, 1);
        if (rootError || !rootData || rootData.length === 0) {
          console.error('Error loading root node:', rootError);
          // Fall back to local data
          setTreeData(familyData);
          setIsLoading(false);
          return;
        }
        
        // Then load the tree starting from the root HID
        const rootHid = rootData[0].hid;
        console.log(`🌳 Loading tree from backend (root: ${rootData[0].name})...`);
        const { data, error } = await profilesService.getBranchData(rootHid, 8, 500);
        if (error) {
          console.error('Error loading tree data:', error);
          // Fall back to local data
          setTreeData(familyData);
        } else if (data) {
          console.log(`✅ Loaded ${data.length} nodes from Supabase backend`);
          console.log('🐞 DEBUG MODE: Tracking zoom/pan issues. Look for:');
          console.log('  - Node positions changing (they shouldn\'t)');
          console.log('  - Large visibility changes during zoom');
          console.log('  - Focal point jumps between pinches');
          setTreeData(data); // Store in zustand for ProfileSheet
        }
      } catch (err) {
        console.error('Failed to load tree data:', err);
        // Fall back to local data
        setLocalTreeData(familyData);
        setTreeData(familyData);
      } finally {
        setIsLoading(false);
      }
    };
  
  // Load tree data on mount
  useEffect(() => {
    loadTreeData();
  }, [setTreeData]);
  
  
  // Real-time subscription for profile updates
  useEffect(() => {
    const channel = supabase
      .channel('profiles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        async (payload) => {
          console.log('Profile change:', payload);
          
          // Handle different event types
          if (payload.eventType === 'UPDATE' && payload.new) {
            // Update just the affected node
            const updatedNode = {
              ...payload.new,
              name: payload.new.name || 'بدون اسم',
              marriages: payload.new.marriages?.map(marriage => ({
                ...marriage,
                marriage_date: marriage.marriage_date ? formatDateDisplay(marriage.marriage_date) : null
              })) || []
            };
            
            // Update in Zustand store
            useTreeStore.getState().updateNode(updatedNode.id, updatedNode);
            
          } else if (payload.eventType === 'INSERT' && payload.new) {
            // Add new node
            const newNode = {
              ...payload.new,
              name: payload.new.name || 'بدون اسم',
              marriages: payload.new.marriages?.map(marriage => ({
                ...marriage,
                marriage_date: marriage.marriage_date ? formatDateDisplay(marriage.marriage_date) : null
              })) || []
            };
            
            // Add to Zustand store
            useTreeStore.getState().addNode(newNode);
            
          } else if (payload.eventType === 'DELETE' && payload.old) {
            // Remove node
            const nodeId = payload.old.id;
            
            // Remove from Zustand store
            useTreeStore.getState().removeNode(nodeId);
          }
        }
      )
      .subscribe();
      
    return () => {
      channel.unsubscribe();
    };
  }, [setTreeData]);
  
  // Calculate layout
  const { nodes, connections } = useMemo(() => {
    if (isLoading || treeData.length === 0) {
      return { nodes: [], connections: [] };
    }
    const layout = calculateTreeLayout(treeData);
    
    // DEBUG: Log canvas coordinates summary (these should NEVER change)
    if (__DEV__ && layout.nodes.length > 0) {
      const bounds = layout.nodes.reduce((acc, node) => ({
        minX: Math.min(acc.minX, node.x),
        maxX: Math.max(acc.maxX, node.x),
        minY: Math.min(acc.minY, node.y),
        maxY: Math.max(acc.maxY, node.y)
      }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
      
      console.log('🎯 LAYOUT CALCULATED:');
      console.log(`  Nodes: ${layout.nodes.length}, Connections: ${layout.connections.length}`);
      console.log(`  Bounds: X[${bounds.minX.toFixed(0)}, ${bounds.maxX.toFixed(0)}] Y[${bounds.minY.toFixed(0)}, ${bounds.maxY.toFixed(0)}]`);
      console.log(`  Root: ${layout.nodes[0]?.name} at (${layout.nodes[0]?.x.toFixed(0)}, ${layout.nodes[0]?.y.toFixed(0)})`);
    }
    
    return layout;
  }, [treeData, isLoading]);

  // Calculate tree bounds
  const treeBounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    
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
      height: maxY - minY
    };
  }, [nodes]);

  // Visible bounds for culling
  const [visibleBounds, setVisibleBounds] = useState({
    minX: -VIEWPORT_MARGIN,
    maxX: dimensions.width + VIEWPORT_MARGIN,
    minY: -VIEWPORT_MARGIN,
    maxY: dimensions.height + VIEWPORT_MARGIN
  });
  
  // Track last stable scale to detect significant changes
  const lastStableScale = useRef(1);

  // Update visible bounds when transform changes
  useAnimatedReaction(
    () => ({
      x: translateX.value,
      y: translateY.value,
      scale: scale.value
    }),
    (current) => {
      // Scale-dependent margin: larger margin when zoomed out
      const dynamicMargin = VIEWPORT_MARGIN / current.scale;
      
      const newBounds = {
        minX: (-current.x - dynamicMargin) / current.scale,
        maxX: (-current.x + dimensions.width + dynamicMargin) / current.scale,
        minY: (-current.y - dynamicMargin) / current.scale,
        maxY: (-current.y + dimensions.height + dynamicMargin) / current.scale
      };
      
      runOnJS(setVisibleBounds)(newBounds);
    }
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
    const currentScale = scale.value;
    const scaleChanged = Math.abs(currentScale - lastStableScale.current) / lastStableScale.current > 0.05;
    if (scaleChanged) {
      lastStableScale.current = currentScale;
    }
    
    const visible = nodes.filter(node => 
      node.x >= visibleBounds.minX && 
      node.x <= visibleBounds.maxX &&
      node.y >= visibleBounds.minY && 
      node.y <= visibleBounds.maxY
    );
    
    // DEBUG: Track visibility changes
    if (__DEV__) {
      const currentVisibleIds = new Set(visible.map(n => n.id));
      const prevVisibleIds = prevVisibleNodesRef.current;
      
      // Find nodes that entered/exited view
      const entered = [];
      const exited = [];
      
      currentVisibleIds.forEach(id => {
        if (!prevVisibleIds.has(id)) {
          const node = visible.find(n => n.id === id);
          entered.push(node);
        }
      });
      
      prevVisibleIds.forEach(id => {
        if (!currentVisibleIds.has(id)) {
          const node = nodes.find(n => n.id === id);
          if (node) exited.push(node);
        }
      });
      
      if (entered.length > 0 || exited.length > 0) {
        console.log(`👁️ VISIBILITY: ${prevVisibleIds.size}→${currentVisibleIds.size} nodes | +${entered.length} -${exited.length} | ${(performance.now() - startTime).toFixed(1)}ms`);
        
        // Warn about large visibility changes that might cause jumping
        if (entered.length + exited.length > 20) {
          console.log(`  ⚠️ LARGE CHANGE: ${entered.length + exited.length} nodes changed visibility!`);
          console.log(`  Viewport: X[${visibleBounds.minX.toFixed(0)}, ${visibleBounds.maxX.toFixed(0)}] Y[${visibleBounds.minY.toFixed(0)}, ${visibleBounds.maxY.toFixed(0)}]`);
        }
        
        // Only log details if few changes
        if (entered.length > 0 && entered.length <= 5) {
          console.log(`  Entered: ${entered.map(n => `${n.name}(${n.x.toFixed(0)},${n.y.toFixed(0)})`).join(', ')}`);
        }
        if (exited.length > 0 && exited.length <= 5) {
          console.log(`  Exited: ${exited.map(n => `${n.name}(${n.x.toFixed(0)},${n.y.toFixed(0)})`).join(', ')}`);
        }
      }
      
      prevVisibleNodesRef.current = currentVisibleIds;
    }
    
    return visible;
  }, [nodes, visibleBounds]);

  // Track previous visible connections for debugging
  const prevVisibleConnectionsRef = useRef(0);
  
  // Filter visible connections
  const visibleConnections = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    const visible = connections.filter(conn => {
      return visibleNodeIds.has(conn.parent.id) || 
             conn.children.some(child => visibleNodeIds.has(child.id));
    });
    
    // DEBUG: Track connection visibility changes
    if (__DEV__ && visible.length !== prevVisibleConnectionsRef.current) {
      console.log(`🔗 CONNECTIONS: ${prevVisibleConnectionsRef.current}→${visible.length}`);
      prevVisibleConnectionsRef.current = visible.length;
    }
    
    return visible;
  }, [connections, visibleNodes]);

  // Pass 3: Invisible bridge check - horizontal sibling lines intersecting viewport
  const bridgeSegments = useMemo(() => {
    const result = [];
    for (const conn of connections) {
      if (!conn.children || conn.children.length === 0) continue;

      const parentX = conn.parent.x;
      const parentY = conn.parent.y;
      const childXs = conn.children.map(c => c.x);
      const childYs = conn.children.map(c => c.y);
      const minChildX = Math.min(...childXs);
      const maxChildX = Math.max(...childXs);
      const busY = parentY + (Math.min(...childYs) - parentY) / 2;

      // Only draw a bus line if there are multiple children or an offset
      const shouldHaveBus = conn.children.length > 1 || Math.abs(parentX - conn.children[0].x) > 5;
      if (!shouldHaveBus) continue;

      // Intersection test with viewport in canvas coords
      const intersects =
        busY >= visibleBounds.minY && busY <= visibleBounds.maxY &&
        maxChildX >= visibleBounds.minX && minChildX <= visibleBounds.maxX;

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
    if (nodes.length > 0 && stage.x === 0 && stage.y === 0 && stage.scale === 1) {
      const offsetX = dimensions.width / 2 - (treeBounds.minX + treeBounds.maxX) / 2;
      const offsetY = 80;
      
      translateX.value = offsetX;
      translateY.value = offsetY;
      savedTranslateX.value = offsetX;
      savedTranslateY.value = offsetY;
      
      setStage({ x: offsetX, y: offsetY, scale: 1 });
    }
  }, [nodes, dimensions, treeBounds]);


  // Pan gesture with momentum
  const panGesture = Gesture.Pan()
    .onStart(() => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd((e) => {
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

  // Pinch gesture for zoom with pointer-anchored transform
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      // CRITICAL: Cancel any running animations to prevent value drift
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(scale);
      
      // Now save the current stable values
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      
      // Store initial focal point for stability (rounded to prevent float issues)
      focalX.value = Math.round(e.focalX);
      focalY.value = Math.round(e.focalY);
      
      // Debug logging
      if (__DEV__) {
        console.log(`🤏 PINCH START: Scale:${scale.value.toFixed(2)} Focal:(${Math.round(e.focalX)},${Math.round(e.focalY)}) Fingers:${e.numberOfPointers}`);
      }
    })
    .onUpdate((e) => {
      const s = clamp(savedScale.value * e.scale, minZoom, maxZoom);
      const k = s / savedScale.value;

      // Use initial focal point for stability (prevents drift with repeated pinches)
      const stableFocalX = focalX.value;
      const stableFocalY = focalY.value;
      
      // Calculate new transform
      const newX = stableFocalX - (stableFocalX - savedTranslateX.value) * k;
      const newY = stableFocalY - (stableFocalY - savedTranslateY.value) * k;
      
      // Apply transform
      translateX.value = newX;
      translateY.value = newY;
      scale.value = s;
      
      // DEBUG: Log significant scale changes only
      if (__DEV__ && Math.abs(e.scale - 1) > 0.1) { // Only log 10%+ changes
        console.log(`🔍 ZOOM: ${savedScale.value.toFixed(2)}→${s.toFixed(2)} | Focal:(${stableFocalX.toFixed(0)},${stableFocalY.toFixed(0)}) | Δ:(${(newX - savedTranslateX.value).toFixed(0)},${(newY - savedTranslateY.value).toFixed(0)})`);
      }
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      
      // Debug logging
      if (__DEV__) {
        console.log(`✅ PINCH END: Scale:${scale.value.toFixed(2)} Pos:(${translateX.value.toFixed(0)},${translateY.value.toFixed(0)})`);
      }
    });

  // Tap gesture for selection with movement/time thresholds
  const tapGesture = Gesture.Tap()
    .maxDistance(10)
    .maxDuration(250)
    .runOnJS(true)
    .onEnd((e) => {
      const canvasX = (e.x - translateX.value) / scale.value;
      const canvasY = (e.y - translateY.value) / scale.value;
      
      // DEBUG: Log tap coordinates
      if (__DEV__) {
        console.log(`👆 TAP: Screen(${e.x.toFixed(0)},${e.y.toFixed(0)}) → Canvas(${canvasX.toFixed(0)},${canvasY.toFixed(0)}) @ Scale:${scale.value.toFixed(2)}`);
      }
      
      let tappedNodeId = null;
      for (const node of visibleNodes) {
        const nodeWidth = node.photo_url ? NODE_WIDTH_WITH_PHOTO : NODE_WIDTH_TEXT_ONLY;
        const nodeHeight = node.photo_url ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;
        
        if (canvasX >= node.x - nodeWidth/2 && 
            canvasX <= node.x + nodeWidth/2 && 
            canvasY >= node.y - nodeHeight/2 && 
            canvasY <= node.y + nodeHeight/2) {
          tappedNodeId = node.id;
          
          // DEBUG: Log tapped node
          if (__DEV__) {
            console.log(`  → Hit: ${node.name} at (${node.x.toFixed(0)},${node.y.toFixed(0)})`);
          }
          
          break;
        }
      }
      
      handleNodeTap(tappedNodeId);
    });
    

  // Handle node tap - show profile sheet (edit mode if admin)
  const handleNodeTap = useCallback((nodeId) => {
    console.log('TreeView: Node tapped, isAdminMode:', isAdminMode);
    setSelectedPersonId(nodeId);
    setProfileEditMode(isAdminMode);
    console.log('TreeView: Setting profileEditMode to:', isAdminMode);
  }, [setSelectedPersonId, isAdminMode]);
  
  
  // Handle FAB press - show unlinked person modal
  const handleFABPress = useCallback(() => {
    // TODO: Show add unlinked person modal
    console.log('Add unlinked person');
  }, []);
  
  // Handle context menu actions
  const handleContextMenuAction = useCallback((action) => {
    if (!contextMenuNode) return;
    
    switch (action) {
      case 'addChildren':
        setMultiAddParent({ id: contextMenuNode.id, name: contextMenuNode.name });
        setShowMultiAddModal(true);
        break;
      case 'edit':
        setEditingProfile(contextMenuNode);
        setShowEditModal(true);
        break;
      case 'viewDetails':
        setSelectedPersonId(contextMenuNode.id);
        break;
      case 'delete':
        Alert.alert(
          'تأكيد الحذف',
          `هل أنت متأكد من حذف ${contextMenuNode.name}؟`,
          [
            { text: 'إلغاء', style: 'cancel' },
            {
              text: 'حذف',
              style: 'destructive',
              onPress: async () => {
                try {
                  const { error } = await supabase
                    .from('profiles')
                    .update({ deleted_at: new Date().toISOString() })
                    .eq('id', contextMenuNode.id);

                  if (error) throw error;
                  Alert.alert('نجح', 'تم حذف الملف الشخصي');
                  await loadTreeData();
                } catch (error) {
                  console.error('Error deleting profile:', error);
                  Alert.alert('خطأ', 'فشل حذف الملف الشخصي');
                }
              },
            },
          ]
        );
        break;
    }
  }, [contextMenuNode, setSelectedPersonId]);
  
  // Compose gestures
  const composed = Gesture.Simultaneous(
    panGesture, 
    pinchGesture, 
    tapGesture
  );

  // Render connection lines with proper elbow style
  const renderConnection = useCallback((connection) => {
    const parent = nodes.find(n => n.id === connection.parent.id);
    if (!parent) return null;
    
    // Calculate bus line position
    const childYs = connection.children.map(child => child.y);
    const busY = parent.y + (Math.min(...childYs) - parent.y) / 2;
    
    // Calculate horizontal span
    const childXs = connection.children.map(child => child.x);
    const minChildX = Math.min(...childXs);
    const maxChildX = Math.max(...childXs);
    
    const lines = [];
    
    // Vertical line from parent
    const parentHeight = parent.photo_url ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;
    lines.push(
      <Line
        key={`parent-down-${parent.id}`}
        p1={vec(parent.x, parent.y + parentHeight/2)}
        p2={vec(parent.x, busY)}
        color={LINE_COLOR}
        style="stroke"
        strokeWidth={LINE_WIDTH}
      />
    );
    
    // Horizontal bus line (only if multiple children or offset)
    if (connection.children.length > 1 || Math.abs(parent.x - connection.children[0].x) > 5) {
      lines.push(
        <Line
          key={`bus-${parent.id}`}
          p1={vec(minChildX, busY)}
          p2={vec(maxChildX, busY)}
          color={LINE_COLOR}
          style="stroke"
          strokeWidth={LINE_WIDTH}
        />
      );
    }
    
    // Vertical lines to children
    connection.children.forEach(child => {
      const childNode = nodes.find(n => n.id === child.id);
      if (!childNode) return;
      
      const childHeight = childNode.photo_url ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;
      
      lines.push(
        <Line
          key={`child-up-${child.id}`}
          p1={vec(childNode.x, busY)}
          p2={vec(childNode.x, childNode.y - childHeight/2)}
          color={LINE_COLOR}
          style="stroke"
          strokeWidth={LINE_WIDTH}
        />
      );
    });
    
    return lines;
  }, [nodes]);

  // Render node component
  const renderNode = useCallback((node) => {
    const hasPhoto = !!node.photo_url;
    // Respect the node's custom width if it has one (for text sizing)
    const nodeWidth = node.nodeWidth || (hasPhoto ? NODE_WIDTH_WITH_PHOTO : NODE_WIDTH_TEXT_ONLY);
    const nodeHeight = hasPhoto ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;
    const isSelected = selectedPersonId === node.id;
    
    const x = node.x - nodeWidth/2;
    const y = node.y - nodeHeight/2;
    
    return (
      <Group key={node.id}>
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
        
        {/* Border */}
        <RoundedRect
          x={x}
          y={y}
          width={nodeWidth}
          height={nodeHeight}
          r={CORNER_RADIUS}
          color={isSelected ? "#212121" : "#E0E0E0"}
          style="stroke"
          strokeWidth={isSelected ? 2 : 1}
        />
        
        {hasPhoto ? (
          <>
            {/* Photo placeholder */}
            <Circle
              cx={node.x}
              cy={node.y - 10}
              r={PHOTO_SIZE/2}
              color="#F5F5F5"
            />
            <Circle
              cx={node.x}
              cy={node.y - 10}
              r={PHOTO_SIZE/2}
              color="#E0E0E0"
              style="stroke"
              strokeWidth={1}
            />
            {/* Load and display image if available */}
            {node.photo_url && (
              <ImageNode 
                url={node.photo_url}
                x={node.x - PHOTO_SIZE/2}
                y={node.y - 10 - PHOTO_SIZE/2}
                width={PHOTO_SIZE}
                height={PHOTO_SIZE}
                radius={PHOTO_SIZE/2}
              />
            )}
            
            {/* Generation badge - positioned in top-right corner for photo nodes */}
            {(() => {
              const genParagraph = createArabicParagraph(
                String(node.generation), 
                'regular', 
                7, // Reduced from 9 to 7 (about 25% smaller)
                "#61616150", // Added 50% opacity (50 in hex = ~30% opacity)
                15
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
                'bold', 
                11, 
                "#212121", 
                nodeWidth
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
                'regular', 
                7, // Reduced from 9 to 7 (about 25% smaller)
                "#61616150", // Added 50% opacity (50 in hex = ~30% opacity)
                nodeWidth
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
                'bold',
                11,
                "#212121",
                nodeWidth
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
  }, [selectedPersonId]);

  // Create a derived value for the transform to avoid Reanimated warnings
  const transform = useDerivedValue(() => {
    return [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ];
  });

  // Show loading state
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' }}>
        <ActivityIndicator size="large" color="#1f2937" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#6b7280' }}>جاري تحميل الشجرة...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      <GestureDetector gesture={composed}>
        <Canvas style={{ flex: 1 }}>
          <Group transform={transform}>
            {/* Render visible connections first */}
            {visibleConnections.map(renderConnection)}
            
            {/* Render visible nodes */}
            {visibleNodes.map(renderNode)}

            {/* Pass 3: Invisible bridge lines intersecting viewport */}
            {bridgeSegments.map(seg => (
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
      
      {/* Add navigation button */}
      <NavigateToRootButton 
        nodes={nodes} 
        viewport={dimensions} 
        sharedValues={{ translateX, translateY, scale }}
      />
      
      {/* Admin components */}
      {isAdminMode && (
        <>
          <SystemStatusIndicator />
          <GlobalFAB 
            onPress={handleFABPress} 
            visible={true}
          />
        </>
      )}
      
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
    </View>
  );
};

export default TreeView;