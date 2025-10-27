# Enhanced Highlighting System - Usage Examples

**Status**: Production-Ready
**Version**: 2.0.0

This document provides comprehensive examples for using the Enhanced Highlighting System (Phase 3E).

---

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Path Type Examples](#path-type-examples)
3. [Advanced Patterns](#advanced-patterns)
4. [Real-World Use Cases](#real-world-use-cases)
5. [Performance Optimization](#performance-optimization)

---

## Basic Usage

### Example 1: Show Ancestry Path on Button Press

**Use Case**: User wants to see their lineage to the root node.

```javascript
import React, { useState } from 'react';
import { Button, View } from 'react-native';
import { useEnhancedHighlighting, HIGHLIGHT_STYLES } from '../hooks/useEnhancedHighlighting';

function AncestryButton({ profileId }) {
  const { addHighlight, removeHighlight } = useEnhancedHighlighting();
  const [highlightId, setHighlightId] = useState(null);

  const toggleAncestry = () => {
    if (highlightId) {
      // Remove existing highlight
      removeHighlight(highlightId);
      setHighlightId(null);
    } else {
      // Add new highlight
      const id = addHighlight({
        type: 'ancestry_path',
        nodeId: profileId,
        style: HIGHLIGHT_STYLES.PRIMARY, // Najdi Crimson
      });
      setHighlightId(id);
    }
  };

  return (
    <Button
      title={highlightId ? "Hide Lineage" : "Show Lineage"}
      onPress={toggleAncestry}
    />
  );
}

export default AncestryButton;
```

---

## Path Type Examples

### Example 2: Node-to-Node Path (Cousin Relationship)

**Use Case**: Highlight the connection between two cousins via their common grandparent.

```javascript
import React, { useEffect } from 'react';
import { useEnhancedHighlighting } from '../hooks/useEnhancedHighlighting';

function CousinConnectionHighlight({ userId, cousinId }) {
  const { addHighlight, removeHighlight } = useEnhancedHighlighting();

  useEffect(() => {
    // Add highlight when component mounts
    const id = addHighlight({
      type: 'node_to_node',
      from: userId,
      to: cousinId,
      style: {
        color: '#D58C4A', // Desert Ochre
        opacity: 0.7,
        strokeWidth: 3,
      },
      priority: 10, // Render on top
    });

    // Remove highlight when component unmounts
    return () => removeHighlight(id);
  }, [userId, cousinId, addHighlight, removeHighlight]);

  return null; // No UI, just side effect
}

export default CousinConnectionHighlight;
```

---

### Example 3: Connection-Only (Direct Parent-Child)

**Use Case**: Highlight a single direct connection between parent and child.

```javascript
import React from 'react';
import { useHighlightDefinition } from '../hooks/useEnhancedHighlighting';

function DirectConnectionHighlight({ parentId, childId, enabled = true }) {
  const highlightId = useHighlightDefinition({
    type: 'connection_only',
    from: parentId,
    to: childId,
    style: {
      color: '#A13333', // Najdi Crimson
      opacity: 0.8,
      strokeWidth: 5,
    },
  }, enabled);

  return null;
}

export default DirectConnectionHighlight;
```

---

### Example 4: Tree-Wide Highlight (All G2 Connections)

**Use Case**: Highlight all generation 2 connections for visual emphasis.

```javascript
import React, { useState } from 'react';
import { Button } from 'react-native';
import { useEnhancedHighlighting } from '../hooks/useEnhancedHighlighting';

function HighlightG2Button() {
  const { addHighlight, removeHighlight } = useEnhancedHighlighting();
  const [highlightId, setHighlightId] = useState(null);

  const toggleG2 = () => {
    if (highlightId) {
      removeHighlight(highlightId);
      setHighlightId(null);
    } else {
      const id = addHighlight({
        type: 'tree_wide',
        filter: {
          generation: 2, // Only generation 2
        },
        style: {
          color: '#D1BBA3', // Camel Hair Beige
          opacity: 0.5,
          strokeWidth: 2,
        },
      });
      setHighlightId(id);
    }
  };

  return (
    <Button
      title={highlightId ? "Hide G2" : "Highlight G2"}
      onPress={toggleG2}
    />
  );
}

export default HighlightG2Button;
```

---

### Example 5: Subtree Highlight (Branch Moderator View)

**Use Case**: Branch moderator wants to see their assigned subtree.

```javascript
import React, { useEffect } from 'react';
import { useEnhancedHighlighting } from '../hooks/useEnhancedHighlighting';
import { useAuth } from '../contexts/AuthContextSimple';

function ModeratorBranchHighlight() {
  const { user } = useAuth();
  const { addHighlight, removeHighlight } = useEnhancedHighlighting();

  useEffect(() => {
    // Only highlight if user is a branch moderator
    if (user.role !== 'moderator') return;

    const id = addHighlight({
      type: 'subtree',
      rootId: user.profileId, // Moderator's node
      maxDepth: 5, // Limit to 5 generations
      style: {
        color: '#A13333', // Najdi Crimson
        opacity: 0.4,
        strokeWidth: 2,
      },
    });

    return () => removeHighlight(id);
  }, [user.role, user.profileId, addHighlight, removeHighlight]);

  return null;
}

export default ModeratorBranchHighlight;
```

---

## Advanced Patterns

### Example 6: Multiple Overlapping Highlights (Color Blending)

**Use Case**: Show multiple paths that overlap - GPU automatically blends colors.

```javascript
import React, { useEffect } from 'react';
import { useEnhancedHighlighting } from '../hooks/useEnhancedHighlighting';

function MultiplePathsDemo({ node1, node2, node3 }) {
  const { addHighlight, removeHighlight } = useEnhancedHighlighting();

  useEffect(() => {
    // Red path (user to ancestor)
    const id1 = addHighlight({
      type: 'ancestry_path',
      nodeId: node1,
      style: { color: '#FF0000', opacity: 0.6, strokeWidth: 4 }
    });

    // Blue path (cousin to same ancestor)
    const id2 = addHighlight({
      type: 'ancestry_path',
      nodeId: node2,
      style: { color: '#0000FF', opacity: 0.6, strokeWidth: 4 }
    });

    // Green path (another cousin to same ancestor)
    const id3 = addHighlight({
      type: 'ancestry_path',
      nodeId: node3,
      style: { color: '#00FF00', opacity: 0.6, strokeWidth: 4 }
    });

    // Where paths overlap → GPU blends automatically (additive blending)
    // Red + Blue = Magenta
    // Red + Green = Yellow
    // Blue + Green = Cyan
    // Red + Blue + Green = White

    return () => {
      removeHighlight(id1);
      removeHighlight(id2);
      removeHighlight(id3);
    };
  }, [node1, node2, node3, addHighlight, removeHighlight]);

  return null;
}

export default MultiplePathsDemo;
```

---

### Example 7: Temporary Highlight on Touch

**Use Case**: Show temporary highlight when user taps a node.

```javascript
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useTemporaryHighlight } from '../hooks/useEnhancedHighlighting';

function NodeCard({ node }) {
  const triggerHighlight = useTemporaryHighlight(2000); // 2 second duration

  const onPress = () => {
    // Show ancestry for 2 seconds
    triggerHighlight({
      type: 'ancestry_path',
      nodeId: node.id,
      style: {
        color: '#A13333',
        opacity: 0.8,
        strokeWidth: 5,
      }
    });
  };

  return (
    <TouchableOpacity onPress={onPress}>
      <Text>{node.name}</Text>
    </TouchableOpacity>
  );
}

export default NodeCard;
```

---

### Example 8: Dynamic Update (Change Style on State Change)

**Use Case**: Update highlight style based on app state.

```javascript
import React, { useEffect, useState } from 'react';
import { Button, View } from 'react-native';
import { useEnhancedHighlighting, HIGHLIGHT_STYLES } from '../hooks/useEnhancedHighlighting';

function DynamicHighlight({ nodeId }) {
  const { addHighlight, updateHighlight } = useEnhancedHighlighting();
  const [highlightId, setHighlightId] = useState(null);
  const [isImportant, setIsImportant] = useState(false);

  // Add highlight on mount
  useEffect(() => {
    const id = addHighlight({
      type: 'ancestry_path',
      nodeId,
      style: HIGHLIGHT_STYLES.SUBTLE,
    });
    setHighlightId(id);

    return () => removeHighlight(id);
  }, [nodeId, addHighlight]);

  // Update style when importance changes
  useEffect(() => {
    if (!highlightId) return;

    updateHighlight(highlightId, {
      style: isImportant ? HIGHLIGHT_STYLES.PRIMARY : HIGHLIGHT_STYLES.SUBTLE,
    });
  }, [isImportant, highlightId, updateHighlight]);

  return (
    <Button
      title={isImportant ? "Mark Normal" : "Mark Important"}
      onPress={() => setIsImportant(!isImportant)}
    />
  );
}

export default DynamicHighlight;
```

---

## Real-World Use Cases

### Example 9: Search Result Highlighting

**Use Case**: Highlight search result and its ancestry.

```javascript
import React, { useEffect } from 'react';
import { useEnhancedHighlighting } from '../hooks/useEnhancedHighlighting';

function SearchResultHighlight({ searchResult, clearSearch }) {
  const { addHighlight, removeHighlight } = useEnhancedHighlighting();

  useEffect(() => {
    if (!searchResult) return;

    const id = addHighlight({
      type: 'ancestry_path',
      nodeId: searchResult.id,
      style: {
        color: '#D58C4A', // Desert Ochre for search
        opacity: 0.7,
        strokeWidth: 4,
      },
      priority: 20, // High priority (render on top)
    });

    return () => {
      removeHighlight(id);
      if (clearSearch) clearSearch();
    };
  }, [searchResult, addHighlight, removeHighlight, clearSearch]);

  return null;
}

export default SearchResultHighlight;
```

---

### Example 10: Cousin Marriage Detection

**Use Case**: Automatically highlight cousin marriages when detected.

```javascript
import React, { useEffect, useState } from 'react';
import { useEnhancedHighlighting } from '../hooks/useEnhancedHighlighting';
import { detectCousinMarriage } from '../utils/cousinMarriageDetector';

function CousinMarriageHighlight({ spouse1, spouse2 }) {
  const { addHighlight, removeHighlight } = useEnhancedHighlighting();
  const [isCousinMarriage, setIsCousinMarriage] = useState(false);

  useEffect(() => {
    // Detect if this is a cousin marriage
    const result = detectCousinMarriage(spouse1, spouse2);
    setIsCousinMarriage(result.isCousin);

    if (result.isCousin) {
      // Highlight both ancestry paths
      const id1 = addHighlight({
        type: 'ancestry_path',
        nodeId: spouse1.id,
        maxDepth: result.generationDiff + 1, // To common ancestor
        style: {
          color: '#A13333', // Najdi Crimson
          opacity: 0.6,
          strokeWidth: 3,
        },
      });

      const id2 = addHighlight({
        type: 'ancestry_path',
        nodeId: spouse2.id,
        maxDepth: result.generationDiff + 1,
        style: {
          color: '#D58C4A', // Desert Ochre
          opacity: 0.6,
          strokeWidth: 3,
        },
      });

      // Where paths overlap (common ancestor) → GPU blends to mixed color

      return () => {
        removeHighlight(id1);
        removeHighlight(id2);
      };
    }
  }, [spouse1, spouse2, addHighlight, removeHighlight]);

  return null;
}

export default CousinMarriageHighlight;
```

---

## Performance Optimization

### Example 11: Monitoring Highlight Performance

**Use Case**: Check rendering statistics to ensure performance targets are met.

```javascript
import React, { useEffect } from 'react';
import { useEnhancedHighlighting } from '../hooks/useEnhancedHighlighting';

function HighlightPerformanceMonitor() {
  const { getStats, count } = useEnhancedHighlighting();

  useEffect(() => {
    // Log stats every 5 seconds
    const interval = setInterval(() => {
      if (count === 0) return;

      const stats = getStats();
      console.log('[Highlight Performance]', {
        activeHighlights: stats.highlightCount,
        totalSegments: stats.segmentCount,
        visibleSegments: stats.visibleSegmentCount,
        overlappingSegments: stats.overlappingSegmentCount,
        averageOverlaps: stats.averageOverlaps,
      });

      // Warn if performance might be impacted
      if (stats.visibleSegmentCount > 200) {
        console.warn('[Highlight Performance] High segment count may impact performance');
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [count, getStats]);

  return null;
}

export default HighlightPerformanceMonitor;
```

---

### Example 12: Conditional Glow (Performance Optimization)

**Use Case**: Disable glow on low-end devices to maintain 30fps.

```javascript
import React, { useState, useEffect } from 'react';
import { Platform, Dimensions } from 'react-native';
import { useEnhancedHighlighting } from '../hooks/useEnhancedHighlighting';

function PerformanceOptimizedHighlight({ nodeId }) {
  const { addHighlight, updateHighlight } = useEnhancedHighlighting();
  const [highlightId, setHighlightId] = useState(null);

  // Detect if device is low-end (simplified heuristic)
  const isLowEndDevice = Platform.OS === 'android' && Dimensions.get('window').height < 1920;

  useEffect(() => {
    const id = addHighlight({
      type: 'ancestry_path',
      nodeId,
      style: {
        color: '#A13333',
        opacity: 0.6,
        strokeWidth: isLowEndDevice ? 2 : 4, // Thinner line on low-end
      },
    });

    setHighlightId(id);

    return () => removeHighlight(id);
  }, [nodeId, isLowEndDevice, addHighlight]);

  return null;
}

export default PerformanceOptimizedHighlight;
```

**Note**: Glow is automatically reduced based on highlight count (4-layer → 2-layer → no glow). See Implementation Plan v2 Phase 3 for details.

---

## Best Practices

### 1. **Always Clean Up**
Use `useEffect` cleanup functions to remove highlights when components unmount.

```javascript
useEffect(() => {
  const id = addHighlight({ ... });
  return () => removeHighlight(id); // ← Always cleanup
}, []);
```

### 2. **Use Preset Styles**
Import `HIGHLIGHT_STYLES` for consistent Najdi Sadu colors.

```javascript
import { HIGHLIGHT_STYLES } from '../hooks/useEnhancedHighlighting';

addHighlight({
  type: 'ancestry_path',
  nodeId: 123,
  style: HIGHLIGHT_STYLES.PRIMARY, // ← Consistent with design system
});
```

### 3. **Set Priority for Layering**
Higher priority renders on top.

```javascript
addHighlight({
  type: 'ancestry_path',
  nodeId: 123,
  style: { ... },
  priority: 20, // ← Render above other highlights (default: 0)
});
```

### 4. **Limit Highlight Count**
For best performance, keep active highlights < 50.

- **<50 highlights**: 60fps, 4-layer glow
- **50-100 highlights**: 45fps, 2-layer glow
- **>100 highlights**: 30fps, no glow

### 5. **Use `maxDepth` for Subtrees**
Limit subtree depth to avoid highlighting entire tree.

```javascript
addHighlight({
  type: 'subtree',
  rootId: 123,
  maxDepth: 3, // ← Limit to 3 generations
  style: { ... }
});
```

---

## Troubleshooting

### Highlight Not Showing
- Check that `nodeId`, `from`, or `to` exist in the tree
- Verify `style.color` is valid hex color
- Check console for warnings from `highlightingServiceV2`

### Performance Issues
- Use `getStats()` to check segment count
- Reduce highlight count or disable glow
- Check for overlapping highlights (BlendMode is GPU-accelerated but still has cost)

### Color Not Blending
- Ensure multiple highlights share the same segment (connection)
- Check that `opacity` is > 0 for both highlights
- Verify BlendMode is supported (works on all React Native Skia versions)

---

## Next Steps

- **Test on Device**: Run on physical device to verify 30-60fps
- **Profile Performance**: Use React DevTools and Flipper
- **Add Custom Path Types**: Extend `highlightingServiceV2` with new path types
- **Create UI Controls**: Add buttons/toggles for highlight management

---

**Status**: Production-Ready
**Last Updated**: [Current Date]
**Contact**: Development Team
