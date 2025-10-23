# The Perfect Family Tree: Complete Specification

**Version:** 1.0
**Date:** January 2025
**Project:** Alqefari Family Tree - React Native + Expo + Skia
**Status:** Design Specification (Ready for Implementation)

---

## 📋 Executive Summary

This document defines the complete architecture, design, and implementation strategy for a world-class family tree visualization system that supports:

- **10,000+ nodes** at 60fps with infinite canvas
- **Extreme customization**: Themes, layouts, node styles, highlighting
- **Beautiful visuals**: Smooth curves, subtle shadows, premium polish
- **Intuitive navigation**: Minimap, quick access, focus modes, smooth animations
- **Flexible highlighting**: Any line, any color, any effect, any time
- **Professional export**: PDF with searchable text, high-resolution images
- **Modular architecture**: Maintainable, testable, scalable codebase

**Foundation:** React Native + Skia (Canvas), Reanimated (Animations), Zustand (State)

---

## 🎯 Core Requirements

### Performance Targets

| Metric | Target | How to Achieve |
|--------|--------|----------------|
| **Node Capacity** | 10,000 nodes | Viewport culling + spatial indexing |
| **Frame Rate** | 60fps sustained | GPU-accelerated Skia rendering |
| **Layout Time** | <200ms for 5K nodes | Van der Ploeg's O(n) algorithm |
| **Memory Usage** | <25MB tree data | Efficient data structures |
| **Load Time** | <2s for 10K nodes | Progressive loading + LOD |

### Must-Have Features

#### User-Controlled Settings
- ✅ **Sibling spacing**: Granular control (slider: 80-200px)
- ✅ **Generation spacing**: Vertical distance (slider: 120-240px)
- ✅ **Orientation**: Vertical ↔ Horizontal switching (live, no restart)
- ✅ **Theme**: Light/Dark mode with custom palettes
- ✅ **Node shape**: Circle, rounded rectangle, hexagon, triangle, no shape
- ✅ **Node content**: Name only, Name+generation, Name+photo+Generation
- ✅ **Deceased treatment**: Grayscale photos, الله يرحمه written (optional) but default is greyscale
- ✅ **Layout density**: Ultra-compact, Normal, Spacious

#### Visual Excellence
- ✅ **Curved connections**: Smooth Bézier curves (not straight lines)
- ✅ **Subtle shadows**: 0.05-0.06 opacity, 8-12px blur
- ✅ **Design system**: Full token architecture (colors, spacing, typography)
- ✅ **RTL support**: Native Arabic flow, no manual adjustments
- ✅ **Micro-interactions**: Scale 1.05 on hover, pulse selection

#### Navigation System
- ✅ **Minimap**: 160px overview, tap-to-navigate
- ✅ **Quick access**: Root + 2 main G2 branches (persistent pills) 
- ✅ **Smooth animations**: 600ms springs, Apple-quality easing
- ✅ **Focus modes**: Dim, Blur, Hide non-selected branches
- ✅ **Branch collapse**: Animated expand/collapse with indicators

#### Highlighting System
- ✅ **Arbitrary connections**: Highlight ANY line between ANY nodes
- ✅ **Custom colors**: Full color picker, per-connection styling
- ✅ **Visual effects**: Glow (3 layers), dashed lines, gradients, animations
- ✅ **Multiple highlights**: 1000+ simultaneous at 60fps
- ✅ **Preset patterns**: Ancestry, descendants, siblings, search results

#### Export Capabilities
- ✅ **Formats**: PNG, JPG, PDF (vector + searchable text)
- ✅ **Quality presets**: Quick Share, Print Ready, Web Optimized
- ✅ **Scope options**: Full tree, viewport, selected branch
- ✅ **Content control**: With/without photos
- ✅ **Large tree support**: Progressive tiling for 5000+ nodes

---

## 🏗 System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                      TreeView.tsx                       │
│                    (Orchestrator)                       │
└─────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌─────────┐
   │ Layout  │      │ Viewport │      │ Gesture │
   │ Engine  │      │ Culling  │      │ Handler │
   └─────────┘      └──────────┘      └─────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
              ┌────────────────────────┐
              │   Rendering Pipeline   │
              │  (Layered Skia Canvas) │
              └────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌─────────┐
   │  Nodes  │      │   Edges  │      │Highlight│
   │Renderer │      │ Renderer │      │Renderer │
   └─────────┘      └──────────┘      └─────────┘
```

### Component Architecture (35 Focused Modules)

```
src/components/TreeView/
├── TreeView.tsx                    # Orchestrator (150 lines)
├── rendering/                      # 🎨 8 modules
│   ├── NodeRenderer.tsx
│   ├── EdgeRenderer.tsx
│   ├── PhotoRenderer.tsx
│   ├── TextRenderer.tsx
│   ├── HighlightRenderer.tsx
│   ├── LODRenderer.tsx
│   ├── AggregationRenderer.tsx
│   └── ShadowRenderer.tsx
├── gestures/                       # 👆 4 modules
│   ├── usePanGesture.ts
│   ├── usePinchGesture.ts
│   ├── useTapGesture.ts
│   └── useDoubleTapGesture.ts
├── viewport/                       # 📐 4 modules
│   ├── useViewportCulling.ts
│   ├── SpatialGrid.ts
│   ├── ViewportCalculator.ts
│   └── LODCalculator.ts
├── layout/                         # 🌳 5 modules
│   ├── TreeLayoutEngine.ts
│   ├── VerticalLayout.ts
│   ├── HorizontalLayout.ts
│   ├── CollisionResolver.ts
│   └── NodeDimensionCalculator.ts
├── navigation/                     # 🧭 5 modules (NEW)
│   ├── Minimap.tsx
│   ├── QuickNavigation.tsx
│   ├── ViewportIndicator.tsx
│   ├── FocusMode.tsx
│   └── navigationAnimations.ts
├── highlighting/                   # ✨ 4 modules (NEW)
│   ├── HighlightStore.ts
│   ├── PathCalculator.ts
│   ├── EffectRenderer.ts
│   └── HighlightStylePicker.tsx
└── export/                         # 📄 5 modules (NEW)
    ├── ExportService.ts
    ├── PDFGenerator.ts
    ├── TiledRenderer.ts
    ├── ExportConfigPanel.tsx
    └── formatters/
```

---

## 🎨 Visual Design System

### Design Philosophy: "Najdi Sadu Modernism"

Blend traditional Najdi Sadu patterns with contemporary minimalism. Think Claude/Perplexity meets Linear's polish with Arabic cultural authenticity.

### Color System (Tokenized)

```typescript
// Reference Tokens (Raw Values)
const reference = {
  neutral: {
    0: '#FFFFFF',
    50: '#F9F7F3',      // Al-Jass White
    200: '#D1BBA3',     // Camel Hair Beige
    900: '#242121',     // Sadu Night
  },
  brand: {
    crimson: '#A13333', // Najdi Crimson (Primary)
    ochre: '#D58C4A',   // Desert Ochre (Secondary)
    gold: '#D4AF37',    // Honor Gold (Paternal line)
  },
};

// Semantic Tokens (Light Theme)
const light = {
  background: {
    canvas: reference.neutral[50],
    card: reference.neutral[0],
    elevated: reference.neutral[200],
  },
  text: {
    primary: reference.neutral[900],
    secondary: `${reference.neutral[900]}99`, // 60% opacity
  },
  action: {
    primary: reference.brand.crimson,
    secondary: reference.brand.ochre,
  },
  tree: {
    nodeFill: reference.neutral[0],
    nodeStroke: reference.neutral[200],
    lineConnection: `${reference.neutral[200]}40`, // 40% opacity
    lineHighlight: reference.brand.crimson,
  },
};

// Dark Theme
const dark = {
  background: {
    canvas: '#000000',        // Pure black (OLED)
    card: '#2C2C2E',
    elevated: '#3A3A3C',
  },
  text: {
    primary: reference.neutral[50],
    secondary: `${reference.neutral[200]}80`,
  },
  action: {
    primary: '#C94A4A',       // Lightened for contrast
    secondary: '#E8A868',
  },
  tree: {
    nodeFill: '#2C2C2E',
    nodeStroke: '#3A3A3C',
    lineConnection: `#3A3A3C60`,
    lineHighlight: '#C94A4A',
  },
};
```

### Typography Scale (SF Arabic)

```typescript
const typography = {
  largeTitle: { size: 34, weight: '700', lineHeight: 41 },
  title1: { size: 28, weight: '700', lineHeight: 34 },
  title2: { size: 22, weight: '600', lineHeight: 28 },
  body: { size: 17, weight: '400', lineHeight: 22 },
  footnote: { size: 13, weight: '400', lineHeight: 18 },
  caption: { size: 11, weight: '400', lineHeight: 13 },
};
```

### Spacing System (8px Grid)

```typescript
const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};
```

### Shadow System (Subtle Elevation)

```typescript
const shadows = {
  subtle: {
    color: '#000',
    opacity: 0.04,
    radius: 8,
    offset: { x: 0, y: 2 },
  },
  medium: {
    color: '#000',
    opacity: 0.06,
    radius: 12,
    offset: { x: 0, y: 4 },
  },
};
```

---

## 🎭 Theming System

### Architecture: Zustand Store + MMKV Persistence

```typescript
// Theme Store
interface ThemeStore {
  mode: 'light' | 'dark' | 'auto';
  activeTheme: 'light' | 'dark';
  tokens: TokensObject;
  customPalette?: CustomPalette;

  setMode: (mode: ThemeMode) => void;
  setCustomPalette: (palette: CustomPalette) => void;
}

// Usage in components
const tokens = useThemeStore(state => state.tokens);

<RoundedRect
  color={tokens.tree.nodeFill}
  strokeColor={tokens.tree.nodeStroke}
/>
```

### Theme Switching Performance

- **Target**: <16ms (60fps)
- **Method**: Instant switch for canvas (no interpolation)
- **Storage**: MMKV (30x faster than AsyncStorage)
- **Persistence**: Auto-save user preference

### Photo Treatment in Dark Mode

```typescript
// Dim photos by 15% for dark mode
const PHOTO_DIM_MATRIX = [
  0.85, 0,    0,    0, 0,
  0,    0.85, 0,    0, 0,
  0,    0,    0.85, 0, 0,
  0,    0,    0,    1, 0,
];

<SkiaImage image={photo}>
  {theme === 'dark' && <ColorMatrix matrix={PHOTO_DIM_MATRIX} />}
</SkiaImage>
```

---

## 🔗 Connection Rendering (Beautiful Lines)

### Curved Line Algorithm: Cubic Bézier

```typescript
// Natural S-curve for parent-child connections
function calculateCubicBezier(
  source: Point,
  target: Point
): Path {
  const controlPoint1 = {
    x: source.x,
    y: source.y + (target.y - source.y) * 0.5
  };
  const controlPoint2 = {
    x: target.x,
    y: source.y + (target.y - source.y) * 0.5
  };

  return Skia.Path.Make()
    .moveTo(source.x, source.y)
    .cubicTo(
      controlPoint1.x, controlPoint1.y,
      controlPoint2.x, controlPoint2.y,
      target.x, target.y
    );
}
```

### Visual Hierarchy

```typescript
const LINE_STYLES = {
  normal: {
    color: tokens.tree.lineConnection,
    width: 2,
    opacity: 1.0,
  },
  highlighted: {
    color: tokens.tree.lineHighlight,
    width: 3,
    opacity: 1.0,
    glow: { blur: 8, intensity: 0.5, layers: 2 },
  },
  paternal: {
    color: tokens.brand.gold,
    width: 3,
    opacity: 0.8,
    glow: { blur: 10, intensity: 0.6, layers: 2 },
  },
};
```

---

## ✨ Advanced Highlighting System

### Architecture: Store + Renderer Separation

```typescript
// Highlight Connection Data Model
interface HighlightConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: 'ancestry' | 'descendant' | 'sibling' | 'custom' | 'search';
  visual: {
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
    glow?: GlowEffect;
    gradient?: GradientConfig;
    animation?: AnimationConfig;
  };
  groupId?: string;
  active: boolean;
  zIndex: number;
}

// Glow Effect Configuration
interface GlowEffect {
  enabled: boolean;
  color: string;
  blur: number;        // 0-20px
  intensity: number;   // 0-1
  layers: number;      // 1-3 (stack for intensity)
}
```

### Visual Effects Catalog

#### 1. Multi-Layer Glow
```typescript
const GLOW_PRESETS = {
  subtle: { blur: 4, intensity: 0.3, layers: 1 },
  medium: { blur: 8, intensity: 0.5, layers: 2 },
  intense: { blur: 16, intensity: 0.8, layers: 3 },
  neon: { blur: 12, intensity: 1.0, layers: 3 },
};
```

#### 2. Animated Effects
```typescript
const ANIMATION_PRESETS = {
  marchingAnts: {
    type: 'dashOffset',
    dashArray: [8, 4],
    speed: 0.5,     // Cycles per second
    duration: 2000,
  },
  pulse: {
    type: 'opacity',
    minOpacity: 0.3,
    maxOpacity: 1.0,
    duration: 1500,
    easing: 'ease-in-out',
  },
  flowingParticles: {
    type: 'particles',
    particleSize: 3,
    particleColor: '#A13333',
    spacing: 30,
    speed: 0.3,
  },
};
```

### User Workflows

**Workflow 1: Two-Node Selection**
```
1. User taps first node → "Select starting point"
2. User taps second node → "Create connection?"
3. Style picker bottom sheet appears
4. User customizes: color, width, glow, animation
5. Connection appears with live preview
```

**Workflow 2: Preset Patterns**
```
1. Long-press on node → Context menu
2. Tap "Show Ancestry Path"
3. Path from root → node highlights instantly
4. Preset style applied (Najdi Crimson, glow, 3px width)
```

---

## 🗺 Navigation System

### Components Overview

| Component | Purpose | Position | Size |
|-----------|---------|----------|------|
| **Minimap** | Tree overview, tap-to-navigate | Bottom-right | 160x160px |
| **Quick Nav Pills** | Root + G2 branches | Top center | 56px height |
| **Viewport Indicator** | Zoom %, node count | Top-right | Badge group |
| **Focus Mode Toggle** | long press node (currently for admins long press is quick add modal, this should be made into a double tap instead.)


MINIMAP MUST BE DIASBELED ON OR OFF IN SETTINGS WITHOUT RESTARTING APP. DEFAULT ON.
### Minimap Specification

```typescript
interface MinimapProps {
  nodes: LayoutNode[];
  treeBounds: Bounds;
  viewport: Viewport;
  currentTransform: Transform;
  onNavigate: (x: number, y: number) => void;
}

// Rendering Strategy
const MINIMAP_RENDER = {
  size: 160,                    // Fixed square size
  maxNodes: 1000,               // Subsample if exceeded
  nodeRadius: 2,                // Dots, not full cards
  updateDebounce: 150,          // ms
  highlightG1G2: true,          // Emphasize important nodes
  viewportStroke: '#A13333',    // Najdi Crimson rectangle
  viewportDash: [4, 4],         // Dashed indicator
};
```

### Animation Specifications

```typescript
// Spring Configuration (Apple-quality)
const NAVIGATION_SPRING = {
  mass: 0.8,
  stiffness: 150,
  damping: 12,
};

// Duration Standards
const DURATIONS = {
  quickNav: 600,      // Tap pill → center node
  fitToView: 800,     // Zoom out to fit all
  focusMode: 400,     // Fade in/out branches
  branchCollapse: 300,// Expand/collapse animation
};

// Easing Curves
const EASING = {
  natural: Easing.bezier(0.33, 1, 0.68, 1),       // iOS default
  decelerate: Easing.bezier(0.19, 1, 0.22, 1),    // Expo out
  anticipation: Easing.bezier(0.42, 0, 0.58, 1),  // In-out
};
```

### Focus Mode Visual Effects

```typescript
enum FocusMode {
  NONE = 'none',      // Show all branches
  DIM = 'dim',        // Non-focused: 30% opacity
  BLUR = 'blur',      // Non-focused: 10px blur
  HIDE = 'hide',      // Non-focused: 0 opacity
}

// GPU-accelerated Skia blur filter
<Blur blur={10} mode="decal">
  {/* Non-focused branches */}
</Blur>
```

---

## 📤 Export System

### Three-Tier Architecture

**Tier 1: Skia Snapshot (Fast)**
- Format: PNG, JPG
- Resolution: 1x, 2x, 3x, 300dpi
- Method: `makeImageSnapshot()`
- Use case: Quick sharing, social media

**Tier 2: Vector PDF (Quality)**
- Format: PDF with embedded fonts
- Text: Searchable, selectable Arabic
- Graphics: Vector paths, not rasterized
- Method: jsPDF + custom rendering
- Use case: Print, archival, editing

**Tier 3: Progressive Tiling (Scale)**
- Strategy: 2000px tiles with 100px overlap
- Progress: Real-time indicator (tile 3/12)
- Memory: Exports one tile at a time
- Use case: 5000+ node trees

### Configuration Schema

```typescript
interface ExportConfig {
  format: 'png' | 'jpg' | 'pdf';
  quality: {
    preset: 'low' | 'medium' | 'high' | 'print';
    resolution: number;  // 1, 2, 3, or 300 (dpi)
    compression?: number; // JPG only, 0-100
  };
  scope: {
    mode: 'full' | 'viewport' | 'branch' | 'selection';
    rootNodeId?: string;
  };
  content: {
    includePhotos: boolean;
    includeRelationshipLines: boolean;
    showGenerations: boolean;
    showHIDs: boolean;
  };
  style: {
    background: 'transparent' | 'white' | 'theme';
    showWatermark: boolean;
  };
}
```

### Export Presets

```typescript
const EXPORT_PRESETS = {
  quickShare: {
    format: 'png',
    quality: { preset: 'medium', resolution: 2 },
    scope: { mode: 'viewport' },
    content: { includePhotos: true },
  },
  printReady: {
    format: 'pdf',
    quality: { preset: 'print', resolution: 300 },
    scope: { mode: 'full' },
    content: { includePhotos: true, showHIDs: true },
  },
  webOptimized: {
    format: 'jpg',
    quality: { preset: 'medium', compression: 80 },
    scope: { mode: 'full' },
    content: { includePhotos: false },
  },
};
```

---

## 🏗 Modular Architecture

### File Organization Principles

1. **Feature-based grouping**: Related code lives together
2. **Layer separation**: UI, logic, services clearly separated
3. **Single responsibility**: Each file does one thing well
4. **Test co-location**: Tests next to implementation
5. **Type safety**: 100% TypeScript coverage

### Rendering Pipeline (Optimized)

```typescript
// Stage 1: Layout Calculation (Pure Function)
const layoutData = TreeLayoutEngine.calculate(treeData, showPhotos);
// → { nodes: LayoutNode[], connections: Connection[] }

// Stage 2: Viewport Culling (Spatial Index)
const { visibleNodes, visibleConnections } =
  ViewportCulling.cull(layoutData, stage, viewport);
// → Only nodes/edges in viewport + margins

// Stage 3: LOD Decision (Scale-based)
const lodLevel = LODCalculator.calculate(stage.scale);
// → 'T1' (full), 'T2' (text), 'T3' (chips)

// Stage 4: Render Batching (Skia Canvas)
<Canvas>
  <EdgeRenderer connections={visibleConnections} />
  <NodeRenderer nodes={visibleNodes} lodLevel={lodLevel} />
  <HighlightRenderer />
</Canvas>

// Stage 5: GPU Rendering (react-native-skia)
// → Pixels on screen at 60fps
```

### Performance Optimization Techniques

**1. Spatial Indexing**
```typescript
class SpatialGrid {
  cellSize = 200; // Adaptive grid

  query(viewport: Rect): LayoutNode[] {
    // O(1) lookup instead of O(n) iteration
  }
}
```

**2. Memoization Strategy**
```typescript
// Layout: Expensive, cache by treeData reference
const layout = useMemo(() =>
  TreeLayoutEngine.calculate(treeData),
  [treeData]
);

// Culling: Every frame, but optimized with spatial grid
const visible = useMemo(() =>
  ViewportCulling.cull(layout, stage, viewport),
  [layout, stage, viewport]
);
```

**3. LOD System**
```typescript
// Tier 1: scale > 0.48 → Full cards (85x90px)
// Tier 2: scale 0.24-0.48 → Text pills (60x35px)
// Tier 3: scale < 0.24 → Aggregation chips (clusters)
```

**4. Image Bucket Hysteresis**
```typescript
// Prevent thrashing between bucket sizes
const BUCKETS = [40, 60, 80, 120];
const HYSTERESIS = 0.15; // ±15% before switching
```

---

## 🎮 Gesture System

### Gesture Configuration (Native-Feeling)

```typescript
// Pan Gesture (Momentum + Boundaries)
const panGesture = Gesture.Pan()
  .activeOffsetX([-5, 5])     // Prevent accidental activation
  .activeOffsetY([-5, 5])
  .onEnd((e) => {
    translateX.value = withDecay({
      velocity: e.velocityX,
      deceleration: 0.998,        // iOS ScrollView default
      clamp: [minX, maxX],        // Boundaries
      rubberBandEffect: true,     // Bounce at edges
      rubberBandFactor: 0.6,      // iOS-like strength
    });
  });

// Pinch Gesture (Anchored Zoom)
const pinchGesture = Gesture.Pinch()
  .onUpdate((e) => {
    const newScale = clamp(
      savedScale.value * e.scale,
      minZoom,  // e.g., 0.5
      maxZoom   // e.g., 3.0
    );

    // Zoom around focal point
    const worldX = (e.focalX - savedTranslateX.value) / savedScale.value;
    const worldY = (e.focalY - savedTranslateY.value) / savedScale.value;

    translateX.value = e.focalX - worldX * newScale;
    translateY.value = e.focalY - worldY * newScale;
    scale.value = newScale;
  });

// Double-Tap (Zoom to Fit)
const doubleTapGesture = Gesture.Tap()
  .numberOfTaps(2)
  .onEnd((e) => {
    const tappedNode = findNodeAt(e.x, e.y);
    if (tappedNode) {
      animateToNode(tappedNode); // Smooth navigation
    }
  });
```

### Haptic Feedback Standards

| Gesture | Haptic | Timing |
|---------|--------|--------|
| Tap node | Light impact | On touch down |
| Double-tap | Medium impact | On second tap |
| Long-press | Heavy impact | At 500ms threshold |
| Branch collapse | Selection feedback | On expand/collapse |
| Quick nav pill | Medium impact | On tap |

---

## 🎯 Implementation Priorities

### Phase 1: Foundation (Weeks 1-2)
- [ ] Design token system (colors, typography, spacing)
- [ ] Theme store with MMKV persistence
- [ ] Modular file structure (35 modules)
- [ ] TypeScript strict mode migration

### Phase 2: Visual Excellence (Weeks 3-4)
- [ ] Curved Bézier connection lines
- [ ] Subtle shadow system (0.05 opacity)
- [ ] Photo dimming for dark mode
- [ ] Node shape variants (circle, hexagon)

### Phase 3: Highlighting (Weeks 5-6)
- [ ] Flexible highlight data model
- [ ] Multi-layer glow rendering
- [ ] Animation system (marching ants, pulse)
- [ ] Style picker UI
- [ ] Preset patterns (ancestry, descendants)

### Phase 4: Navigation (Weeks 7-8)
- [ ] Minimap with tap-to-navigate
- [ ] Quick access pills (root + G2)
- [ ] Viewport indicators
- [ ] Focus mode (dim/blur/hide)
- [ ] Branch collapse animations

### Phase 5: Export (Weeks 9-10)
- [ ] Skia snapshot export (PNG/JPG)
- [ ] Vector PDF generation with jsPDF
- [ ] Progressive tiling for large trees
- [ ] Export configuration UI
- [ ] Presets (Quick Share, Print Ready)

### Phase 6: Polish & Performance (Weeks 11-12)
- [ ] Gesture refinement (activeOffset, deceleration)
- [ ] Animation tuning (spring configs)
- [ ] Performance profiling (10K nodes)
- [ ] Memory optimization
- [ ] User testing & iteration

---

## 📊 Success Metrics

### Performance Benchmarks

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Layout time | ~950ms (3K) | <200ms (5K) | `console.time()` |
| Frame rate | 60fps (56 nodes) | 60fps (10K) | React DevTools Profiler |
| Memory | ~9MB (3K) | <25MB (10K) | Xcode Instruments |
| Load time | N/A | <2s (10K) | Performance API |
| Cache hit rate | 95%+ (paragraph) | 95%+ (all) | Logging |

### User Experience Metrics

| Feature | Measurement | Target |
|---------|-------------|--------|
| Navigation speed | Time to reach node | <2s (from anywhere) |
| Discoverability | % users finding feature | >90% (no tutorial) |
| Customization usage | % using themes/layouts | >60% adoption |
| Export success rate | % completed exports | >95% |
| Focus mode usage | % sessions using focus | >40% |

---

## 🔒 Non-Functional Requirements

### Accessibility
- ✅ WCAG AA contrast (4.5:1 minimum)
- ✅ Touch targets: 44x44px minimum (iOS HIG)
- ✅ RTL support: Native I18nManager
- ✅ Arabic typography: SF Arabic font
- ✅ Screen reader: Semantic labels (future)

### Localization
- ✅ All UI text in Arabic
- ✅ Date formatting: Hijri + Gregorian (using SERVICE FROM SETTINGS)
- ✅ Number formatting: (BASED ON SETTINGS CHOICE. YOU CHOOSE IT.)
- ✅ Text direction: Right-to-left (NATIVE RTL)

### Security
- ✅ No hardcoded credentials
- ✅ Row-level security (Supabase RLS)
- ✅ Permission checks before edits
- ✅ Sanitize user inputs

### Maintainability
- ✅ 100% TypeScript coverage
- ✅ JSDoc for all public APIs
- ✅ 80%+ unit test coverage
- ✅ Modular architecture (35 files)
- ✅ Comprehensive documentation

---

## 📚 Technical Stack

### Core Technologies

- **Expo**: SDK 54+ (Bare workflow)
- **Skia**: @shopify/react-native-skia 2.2.12
- **Reanimated**: react-native-reanimated 3.x
- **Gesture Handler**: react-native-gesture-handler 2.x
- **Zustand**: 5.x (State management)

### Supporting Libraries
- **jsPDF**: PDF generation
- **jspdf-arabic-font**: Arabic text in PDF
- **expo-file-system**: File I/O
- **expo-media-library**: Save to Photos
- **expo-sharing**: Share dialog
- **react-native-mmkv**: Fast persistence

### Development Tools
- **TypeScript**: 5.0+ (Strict mode)
- **ESLint**: Code quality
- **Jest**: Unit testing
- **React Native Testing Library**: Integration testing
- **Storybook**: Visual component development (optional)

---

## 🚀 Migration Path

### Current State → Target State

**Current:**
- Single monolithic TreeView.js (3,817 lines)
- Mixed concerns (rendering + gestures + state + layout)
- Some extracted modules (highlightRenderers, hooks)
- Zustand store (good foundation)

**Target:**
- 35 focused modules (<200 lines each)
- Clear layer separation (UI, logic, services)
- 100% TypeScript
- Comprehensive test coverage

### Incremental Strategy (No Big-Bang Rewrite)

**Week 1: Foundation**
- Create folder structure
- Extract constants, utilities
- Create TypeScript types

**Week 2-3: Layout Layer**
- Extract TreeLayoutEngine
- Extract collision resolution
- Add unit tests

**Week 4-5: Rendering Layer**
- Extract NodeRenderer, EdgeRenderer
- Extract LOD system
- Add Storybook stories

**Week 6-7: Gesture Layer**
- Extract gesture hooks
- Refine gesture parameters
- Add integration tests

**Week 8-9: State Layer**
- Organize local state hooks
- Create derived state calculators
- Refactor TreeView.tsx

**Week 10-12: New Features**
- Highlighting system
- Navigation components
- Export functionality

---

## 🎓 Design Principles

### 1. Performance First
- Viewport culling before adding features
- Memoize expensive calculations
- Profile before optimizing (measure, don't guess)
- 60fps is non-negotiable

### 2. User-Centric Design
- No feature should require a tutorial
- Immediate feedback (haptics, animations)
- Undo/redo for destructive actions
- Graceful degradation on error

### 3. Cultural Authenticity
- Najdi Sadu design language
- Arabic-first (not translated UI)
- Paternal lineage emphasis (gold borders)
- Generation respect (eldest = honored)

### 4. Maintainability
- Single Responsibility Principle
- Explicit is better than implicit
- Comments explain "why", not "what"
- Refactor before feature creep

### 5. Scalability
- Architect for 10K nodes from day 1
- Progressive enhancement (not degradation)
- Layer isolation (change one, not all)
- Plugin-ready (future extensibility)

---

## 📖 References & Research

### Academic Papers
- Van der Ploeg (2013): Tidier Tree Layout Algorithm
- Walker (1990): O(n) Tree Drawing Algorithm
- Reingold-Tilford (1981): Original Tree Layout

### Industry Examples
- **Figma**: Infinite canvas navigation
- **Linear**: Animation polish, dark mode
- **Miro**: Minimap, focus modes
- **Apple Photos**: Spring physics, gestures
- **Google Maps**: Smooth pan/zoom

### Documentation
- React Native Skia Performance Guide
- React Native Reanimated Spring Physics
- iOS Human Interface Guidelines (Gestures)
- Material Design 3 (Tokens, Dark Mode)
- WCAG 2.1 Accessibility Standards

---

## 🏁 Conclusion

This specification defines a world-class family tree visualization system that:

- **Scales to 10,000+ nodes** with sustained 60fps
- **Empowers users** with extreme customization
- **Looks beautiful** with Najdi Sadu design language
- **Feels native** with Apple-quality animations
- **Exports professionally** to PDF/images
- **Maintains easily** with modular architecture

**Next Steps:**
1. Review specification with stakeholders
2. Begin Phase 1 implementation (foundation)
3. Establish performance benchmarks
4. Set up testing infrastructure
5. Iterate based on user feedback

**Timeline:** 12 weeks to feature-complete, production-ready system

**Budget:** Engineering only (no design tools, all open-source libraries)

---

**Document Version:** 1.0
**Last Updated:** January 2025
**Status:** ✅ Ready for Implementation
**Author:** Research Specialist (Claude)
**Reviewed By:** [Pending]

---

*"The perfect tree balances beauty, performance, and cultural authenticity. This specification achieves all three."*
