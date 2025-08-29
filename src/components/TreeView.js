import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { View, Dimensions, useWindowDimensions, Platform, I18nManager, ActivityIndicator, Text } from 'react-native';
import { Canvas, Group, Rect, Line, Circle, vec, RoundedRect, useImage, Image as SkiaImage, Skia, Mask, Paragraph, listFontFamilies, Text as SkiaText, useFont } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDecay,
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

const VIEWPORT_MARGIN = 200;
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
  
  if (!image) return null;
  
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


const TreeView = () => {
  const stage = useTreeStore(s => s.stage);
  const setStage = useTreeStore(s => s.setStage);
  const minZoom = useTreeStore(s => s.minZoom);
  const maxZoom = useTreeStore(s => s.maxZoom);
  const selectedPersonId = useTreeStore(s => s.selectedPersonId);
  const setSelectedPersonId = useTreeStore(s => s.setSelectedPersonId);
  const setTreeData = useTreeStore(s => s.setTreeData);
  
  const dimensions = useWindowDimensions();
  const [fontReady, setFontReady] = useState(false);
  const [treeData, setLocalTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
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
  useEffect(() => {
    const loadTreeData = async () => {
      setIsLoading(true);
      try {
        // First get the root node
        const { data: rootData, error: rootError } = await profilesService.getBranchData(null, 1, 1);
        if (rootError || !rootData || rootData.length === 0) {
          console.error('Error loading root node:', rootError);
          // Fall back to local data
          setLocalTreeData(familyData);
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
          setLocalTreeData(familyData);
          setTreeData(familyData);
        } else if (data) {
          console.log(`✅ Loaded ${data.length} nodes from Supabase backend`);
          setLocalTreeData(data);
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
    
    loadTreeData();
  }, [setTreeData]);
  
  // Calculate layout
  const { nodes, connections } = useMemo(() => {
    if (isLoading || treeData.length === 0) {
      return { nodes: [], connections: [] };
    }
    return calculateTreeLayout(treeData);
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

  // Update visible bounds when transform changes
  useAnimatedReaction(
    () => ({
      x: translateX.value,
      y: translateY.value,
      scale: scale.value
    }),
    (current) => {
      runOnJS(setVisibleBounds)({
        minX: (-current.x - VIEWPORT_MARGIN) / current.scale,
        maxX: (-current.x + dimensions.width + VIEWPORT_MARGIN) / current.scale,
        minY: (-current.y - VIEWPORT_MARGIN) / current.scale,
        maxY: (-current.y + dimensions.height + VIEWPORT_MARGIN) / current.scale
      });
    }
  );
  
  // Load more nodes when viewport changes (for future viewport-based loading)
  useEffect(() => {
    // TODO: Implement viewport-based loading when backend supports it
    // This would call profilesService.getVisibleNodes(visibleBounds, scale.value)
  }, [visibleBounds]);

  // Filter visible nodes for performance
  const visibleNodes = useMemo(() => {
    return nodes.filter(node => 
      node.x >= visibleBounds.minX && 
      node.x <= visibleBounds.maxX &&
      node.y >= visibleBounds.minY && 
      node.y <= visibleBounds.maxY
    );
  }, [nodes, visibleBounds]);

  // Filter visible connections
  const visibleConnections = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    return connections.filter(conn => {
      return visibleNodeIds.has(conn.parent.id) || 
             conn.children.some(child => visibleNodeIds.has(child.id));
    });
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

  // Sync gesture values with store
  const updateStore = useCallback((x, y, s) => {
    setStage({ x, y, scale: s });
  }, [setStage]);

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
      runOnJS(updateStore)(translateX.value, translateY.value, scale.value);
    });

  // Pinch gesture for zoom with pointer-anchored transform
  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const s = clamp(savedScale.value * e.scale, minZoom, maxZoom);
      const k = s / savedScale.value;

      // Anchor zoom to the current focal point
      translateX.value = e.focalX - (e.focalX - savedTranslateX.value) * k;
      translateY.value = e.focalY - (e.focalY - savedTranslateY.value) * k;
      scale.value = s;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      runOnJS(updateStore)(translateX.value, translateY.value, scale.value);
    });

  // Tap gesture for selection with movement/time thresholds
  const tapGesture = Gesture.Tap()
    .maxDistance(10)
    .maxDuration(250)
    .onEnd((e) => {
      const canvasX = (e.x - translateX.value) / scale.value;
      const canvasY = (e.y - translateY.value) / scale.value;
      
      let tappedNodeId = null;
      for (const node of visibleNodes) {
        const nodeWidth = node.photo_url ? NODE_WIDTH_WITH_PHOTO : NODE_WIDTH_TEXT_ONLY;
        const nodeHeight = node.photo_url ? NODE_HEIGHT_WITH_PHOTO : NODE_HEIGHT_TEXT_ONLY;
        
        if (canvasX >= node.x - nodeWidth/2 && 
            canvasX <= node.x + nodeWidth/2 && 
            canvasY >= node.y - nodeHeight/2 && 
            canvasY <= node.y + nodeHeight/2) {
          tappedNodeId = node.id;
          break;
        }
      }
      
      runOnJS(setSelectedPersonId)(tappedNodeId);
    });

  // Compose gestures
  const composed = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

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
    </View>
  );
};

export default TreeView;