# How to Use Phase 1 Utilities

## Quick Reference

### Import Path
```javascript
import { ... } from './TreeView/utils';
import type { ... } from './TreeView/types';
```

## Constants

### Viewport & Culling
```javascript
import {
  VIEWPORT_MARGIN_X,      // 3000 - Horizontal viewport margin
  VIEWPORT_MARGIN_Y,      // 1200 - Vertical viewport margin
  MAX_TREE_SIZE,          // 10000 - Maximum profiles to load
  WARNING_THRESHOLD,      // 7500 - 75% capacity warning
  CRITICAL_THRESHOLD,     // 9500 - 95% capacity warning
  LOD_T1_THRESHOLD,       // 0.48 - Full card threshold
  LOD_T2_THRESHOLD,       // 0.24 - Text pill threshold
} from './TreeView/utils';

// Usage
const visibleBounds = {
  minX: cameraX - VIEWPORT_MARGIN_X,
  maxX: cameraX + VIEWPORT_MARGIN_X,
  minY: cameraY - VIEWPORT_MARGIN_Y,
  maxY: cameraY + VIEWPORT_MARGIN_Y,
};
```

### Node Dimensions
```javascript
import {
  NODE_WIDTH_WITH_PHOTO,  // 85 - Card width with photo
  NODE_HEIGHT_WITH_PHOTO, // 90 - Card height with photo
  PHOTO_SIZE,             // 60 - Avatar size
  LINE_COLOR,             // '#D1BBA340' - Connection line color
  LINE_WIDTH,             // 2 - Connection line width
  CORNER_RADIUS,          // 8 - Card border radius
  SHADOW_OPACITY,         // 0.05 - Shadow opacity (2024 trend)
  SHADOW_RADIUS,          // 8 - Shadow blur radius
  SHADOW_OFFSET_Y,        // 2 - Shadow vertical offset
} from './TreeView/utils';

// Usage
<RoundedRect
  x={node.x}
  y={node.y}
  width={NODE_WIDTH_WITH_PHOTO}
  height={NODE_HEIGHT_WITH_PHOTO}
  r={CORNER_RADIUS}
/>
```

### Spacing & Gaps
```javascript
import {
  DEFAULT_SIBLING_GAP,    // 120 - Default horizontal spacing
  DEFAULT_GENERATION_GAP, // 180 - Default vertical spacing
  MIN_SIBLING_GAP,        // 80 - Minimum horizontal spacing
  MAX_SIBLING_GAP,        // 200 - Maximum horizontal spacing
  MIN_GENERATION_GAP,     // 120 - Minimum vertical spacing
  MAX_GENERATION_GAP,     // 240 - Maximum vertical spacing
} from './TreeView/utils';

// Usage
const siblingGap = clamp(
  calculatedGap,
  MIN_SIBLING_GAP,
  MAX_SIBLING_GAP
);
```

### Image Buckets
```javascript
import {
  IMAGE_BUCKETS,          // [40, 60, 80, 120, 256] - Available sizes
  DEFAULT_IMAGE_BUCKET,   // 80 - Default bucket
  BUCKET_HYSTERESIS,      // 0.15 - ±15% prevents thrashing
} from './TreeView/utils';

// Usage
const bucket = IMAGE_BUCKETS.find(size =>
  displaySize <= size * (1 + BUCKET_HYSTERESIS)
) || DEFAULT_IMAGE_BUCKET;
```

### Animation & Gestures
```javascript
import {
  ANIMATION_DURATION_SHORT,   // 200ms - Quick animations
  ANIMATION_DURATION_MEDIUM,  // 400ms - Standard animations
  ANIMATION_DURATION_LONG,    // 600ms - Slow animations
  GESTURE_ACTIVE_OFFSET,      // 5 - Gesture activation threshold
  GESTURE_DECELERATION,       // 0.998 - Decay rate
  GESTURE_RUBBER_BAND_FACTOR, // 0.6 - Overscroll resistance
  MIN_ZOOM,                   // 0.5 - Minimum zoom level
  MAX_ZOOM,                   // 3.0 - Maximum zoom level
  DEFAULT_ZOOM,               // 1.0 - Default zoom level
} from './TreeView/utils';

// Usage
const animatedValue = withTiming(targetValue, {
  duration: ANIMATION_DURATION_MEDIUM,
  easing: Easing.bezier(0.4, 0.0, 0.2, 1),
});
```

## Color Utilities

### hexToRgba()
Convert hex color to rgba with alpha channel.

```javascript
import { hexToRgba } from './TreeView/utils';

// Basic usage
const semitransparent = hexToRgba('#A13333', 0.5);
// Returns: 'rgba(161, 51, 51, 0.5)'

// Use case: Overlay backgrounds
<Rect fill={hexToRgba(LINE_COLOR, 0.3)} />
```

### createGrayscaleMatrix()
Creates ITU-R BT.709 grayscale ColorMatrix for deceased photos.

```javascript
import { createGrayscaleMatrix } from './TreeView/utils';

// Usage with Skia ColorMatrix
const grayscale = createGrayscaleMatrix();

<Group layer={<Paint><ColorMatrix matrix={grayscale} /></Paint>}>
  <SkiaImage image={photo} {...dimensions} />
</Group>
```

### createDimMatrix()
Creates dimming ColorMatrix for dark mode.

```javascript
import { createDimMatrix } from './TreeView/utils';

// Default dimming (0.85 = 15% darker)
const dimmed = createDimMatrix();

// Custom dimming (0.7 = 30% darker)
const darkerDimmed = createDimMatrix(0.7);

// Usage
<Group layer={<Paint><ColorMatrix matrix={dimmed} /></Paint>}>
  <SkiaImage image={backgroundPattern} {...dimensions} />
</Group>
```

### interpolateColor()
Interpolate between two hex colors.

```javascript
import { interpolateColor } from './TreeView/utils';

// Animate from red to blue
const progress = animatedValue.value; // 0-1
const color = interpolateColor('#FF0000', '#0000FF', progress);

// Use case: Smooth color transitions
<Rect fill={interpolateColor(startColor, endColor, progress)} />
```

## Performance Monitor

### logLayoutTime()
Track layout calculation duration.

```javascript
import { performanceMonitor } from './TreeView/utils';

const startTime = performance.now();
const layout = calculateTreeLayout(treeData, showPhotos);
const duration = performance.now() - startTime;

performanceMonitor.logLayoutTime(duration, treeData.length);
// Logs: [TreeView] ✅ Layout: 87ms for 56 nodes
// Warns if duration > 200ms
```

### logRenderTime()
Track frame render time and calculate FPS.

```javascript
const frameStart = performance.now();
// ... render code ...
const frameDuration = performance.now() - frameStart;

performanceMonitor.logRenderTime(frameDuration);
// Logs FPS, warns if < 60fps
```

### logMemory()
Track memory usage.

```javascript
const treeDataSize = JSON.stringify(treeData).length;
performanceMonitor.logMemory(treeDataSize);
// Converts to MB, warns if > 25MB
```

### getMetrics()
Get current metrics snapshot.

```javascript
const metrics = performanceMonitor.getMetrics();
console.log(metrics);
// {
//   layoutTime: 87,
//   renderTime: 12.5,
//   memoryUsage: 0.5,
//   nodeCount: 56,
//   fps: 60
// }
```

### logSummary()
Log comprehensive performance report.

```javascript
performanceMonitor.logSummary();
// [TreeView] 📊 Performance Summary: {
//   layout: '87ms',
//   render: '12.50ms',
//   memory: '0.5MB',
//   nodes: 56,
//   fps: 60
// }
```

## TypeScript Types

### Profile & Marriage
```typescript
import type { Profile, Marriage } from './TreeView/types';

// These are re-exported from supabase.ts (canonical source)
// DO NOT modify - update supabase.ts instead

const profile: Profile = {
  id: '...',
  hid: 'H001',
  name: 'محمد بن عبدالله',
  gender: 'male', // ✅ Correct field name
  status: 'alive',
  // ... all other fields
};

const marriage: Marriage = {
  id: '...',
  husband_id: 'profile-1', // ✅ Correct field name
  wife_id: 'profile-2',
  start_date: '2020-01-01', // ✅ Correct field name
  status: 'married', // ✅ Correct enum value
};
```

### LayoutNode
```typescript
import type { LayoutNode } from './TreeView/types';

const layoutNode: LayoutNode = {
  profile: profileData,
  x: 100,
  y: 200,
  width: NODE_WIDTH_WITH_PHOTO,
  height: NODE_HEIGHT_WITH_PHOTO,
  generation: 2,
  hasChildren: true,
  childIds: ['child-1', 'child-2'],
  spouseIds: ['spouse-1'],
  marriageIds: ['marriage-1'],
};
```

### RenderedNode
```typescript
import type { RenderedNode } from './TreeView/types';
import { useSharedValue } from 'react-native-reanimated';

const renderedNode: RenderedNode = {
  ...layoutNode,
  animatedX: useSharedValue(100),
  animatedY: useSharedValue(200),
  opacity: useSharedValue(1),
  scale: useSharedValue(1),
  lodTier: 'T1',
  isVisible: true,
  imageBucket: 80,
};
```

### Camera & Viewport
```typescript
import type { Camera, Viewport } from './TreeView/types';

const camera: Camera = {
  translateX: 0,
  translateY: 0,
  scale: 1.0,
  isAnimating: false,
};

const viewport: Viewport = {
  width: screenWidth,
  height: screenHeight,
  pixelRatio: PixelRatio.get(),
  safeAreaInsets: {
    top: 44,
    bottom: 34,
    left: 0,
    right: 0,
  },
};
```

## Complete Example

```javascript
import {
  NODE_WIDTH_WITH_PHOTO,
  NODE_HEIGHT_WITH_PHOTO,
  CORNER_RADIUS,
  SHADOW_OPACITY,
  hexToRgba,
  createGrayscaleMatrix,
  performanceMonitor,
} from './TreeView/utils';
import type { LayoutNode } from './TreeView/types';

// Layout calculation with monitoring
const startTime = performance.now();
const layout = calculateTreeLayout(treeData);
const duration = performance.now() - startTime;
performanceMonitor.logLayoutTime(duration, treeData.length);

// Render node with utilities
function renderNode(node: LayoutNode, isDeceased: boolean) {
  const grayscale = isDeceased ? createGrayscaleMatrix() : null;

  return (
    <Group>
      <RoundedRect
        x={node.x}
        y={node.y}
        width={NODE_WIDTH_WITH_PHOTO}
        height={NODE_HEIGHT_WITH_PHOTO}
        r={CORNER_RADIUS}
      >
        <Shadow
          dx={0}
          dy={2}
          blur={8}
          color={hexToRgba('#000000', SHADOW_OPACITY)}
        />
      </RoundedRect>

      {grayscale && (
        <Group layer={<Paint><ColorMatrix matrix={grayscale} /></Paint>}>
          <SkiaImage image={node.profile.photo_url} {...photoSize} />
        </Group>
      )}
    </Group>
  );
}
```

---

**Next:** See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for rollback procedures
