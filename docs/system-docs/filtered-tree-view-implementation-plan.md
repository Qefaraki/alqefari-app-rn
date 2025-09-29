# Filtered Tree View Implementation Plan

## Overview

Implement a filtered tree view for profile verification that reuses the EXACT same TreeView component with Canvas, Skia nodes, lines, photos, and all zoom levels (T1/T2/T3), but shows only a filtered subset of the tree data focused on a specific person.

## Key Insight

We should NOT create a new component. Instead, we'll make the existing TreeView component work with filtered data by:

1. Creating a filtering utility that generates a subset of tree data
2. Using a wrapper component that temporarily provides filtered data
3. Ensuring all existing TreeView rendering logic works unchanged

## Architecture Decision: Context Provider Approach

### Why Context Provider is Best

After analyzing the TreeView component, the cleanest approach is to:

1. Create a `FilteredTreeProvider` context that can override the global tree store
2. Wrap TreeView in this provider when showing filtered views
3. TreeView will automatically use the filtered data without any modifications

### Alternative Considered (Not Recommended)

- Passing filtered data as props would require modifying TreeView extensively
- Creating a separate store would duplicate state management logic

## Implementation Plan

### Phase 1: Create Tree Filtering Logic

#### 1.1 Create Filtering Utility (`src/utils/treeFilter.js`)

```javascript
export function filterTreeForPerson(allNodes, targetPersonId) {
  // Returns filtered nodes array with:
  // - Target person
  // - All ancestors up to root
  // - Siblings (same father_id)
  // - Children and all descendants
  // - Uncles (father's siblings)
  // - Indicator nodes for hidden relatives

  const filtered = new Set();
  const nodesMap = new Map(allNodes.map((n) => [n.id, n]));

  // 1. Add target person
  const target = nodesMap.get(targetPersonId);
  if (!target) return [];
  filtered.add(target.id);

  // 2. Add all ancestors
  let current = target;
  while (current.father_id) {
    filtered.add(current.father_id);
    current = nodesMap.get(current.father_id);
    if (!current) break;
  }

  // 3. Add siblings
  if (target.father_id) {
    allNodes.forEach((node) => {
      if (node.father_id === target.father_id) {
        filtered.add(node.id);
      }
    });
  }

  // 4. Add all descendants recursively
  const addDescendants = (nodeId) => {
    allNodes.forEach((node) => {
      if (node.father_id === nodeId) {
        filtered.add(node.id);
        addDescendants(node.id);
      }
    });
  };
  addDescendants(target.id);

  // 5. Add uncles (father's siblings)
  if (target.father_id) {
    const father = nodesMap.get(target.father_id);
    if (father && father.father_id) {
      allNodes.forEach((node) => {
        if (node.father_id === father.father_id) {
          filtered.add(node.id);
        }
      });
    }
  }

  // 6. Create indicator nodes for hidden relatives
  const indicators = [];
  filtered.forEach((nodeId) => {
    const node = nodesMap.get(nodeId);
    const childCount = allNodes.filter((n) => n.father_id === nodeId).length;
    const visibleChildCount = allNodes.filter(
      (n) => n.father_id === nodeId && filtered.has(n.id),
    ).length;

    if (childCount > visibleChildCount) {
      // Add indicator that more children exist
      node._hasHiddenChildren = true;
      node._hiddenChildCount = childCount - visibleChildCount;
    }
  });

  // Return filtered nodes
  return allNodes.filter((node) => filtered.has(node.id));
}
```

### Phase 2: Create Filtered Tree Context

#### 2.1 Create Context Provider (`src/contexts/FilteredTreeContext.js`)

```javascript
import React, { createContext, useContext } from "react";
import { create } from "zustand";
import { filterTreeForPerson } from "../utils/treeFilter";

const FilteredTreeContext = createContext(null);

// Create a temporary store that mimics useTreeStore interface
function createFilteredStore(filteredData, originalStore) {
  return create((set, get) => ({
    // Copy all state from original store
    ...originalStore.getState(),

    // Override tree data with filtered data
    treeData: filteredData,
    nodesMap: new Map(filteredData.map((node) => [node.id, node])),

    // Override setTreeData to prevent modifications
    setTreeData: () => {
      console.warn("Cannot modify tree data in filtered view");
    },

    // Keep all other methods working
    setStage: originalStore.getState().setStage,
    setSelectedPersonId: originalStore.getState().setSelectedPersonId,
    // ... other methods
  }));
}

export function FilteredTreeProvider({
  targetPersonId,
  children,
  originalTreeData,
}) {
  const filteredData = filterTreeForPerson(originalTreeData, targetPersonId);
  const originalStore = useTreeStore.getState();
  const filteredStore = createFilteredStore(filteredData, originalStore);

  return (
    <FilteredTreeContext.Provider value={filteredStore}>
      {children}
    </FilteredTreeContext.Provider>
  );
}

export const useFilteredTreeStore = () => {
  const context = useContext(FilteredTreeContext);
  return context || useTreeStore(); // Fallback to global store
};
```

#### 2.2 Modify TreeView to Use Context (`src/components/TreeView.js`)

```javascript
// At the top of TreeView component, replace:
// const treeData = useTreeStore((s) => s.treeData);

// With:
import { useFilteredTreeStore } from "../contexts/FilteredTreeContext";
const treeData = useFilteredTreeStore((s) => s.treeData);
// Do this for ALL useTreeStore calls in TreeView
```

### Phase 3: Create Profile Verification Modal

#### 3.1 Create Modal Component (`src/components/ProfileVerificationModal.js`)

```javascript
import React from "react";
import { Modal, View, Text, TouchableOpacity } from "react-native";
import TreeView from "./TreeView";
import { FilteredTreeProvider } from "../contexts/FilteredTreeContext";
import { useTreeStore } from "../stores/useTreeStore";

export default function ProfileVerificationModal({
  visible,
  onClose,
  targetPersonId,
  targetPersonName,
}) {
  const originalTreeData = useTreeStore((s) => s.treeData);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>التحقق من {targetPersonName}</Text>
        </View>

        {/* Filtered Tree View */}
        <FilteredTreeProvider
          targetPersonId={targetPersonId}
          originalTreeData={originalTreeData}
        >
          <TreeView
            // Pass minimal required props
            setProfileEditMode={() => {}}
            onNetworkStatusChange={() => {}}
            user={null}
            onAdminDashboard={() => {}}
            onSettingsOpen={() => {}}
          />
        </FilteredTreeProvider>

        {/* Verification Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.verifyButton}>
            <Text>تأكيد الهوية</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

### Phase 4: Integrate with Search Results

#### 4.1 Modify Search Component to Show Tree Modal

```javascript
// In SearchBar.js or wherever profile matching happens
const [showTreeModal, setShowTreeModal] = useState(false);
const [selectedMatch, setSelectedMatch] = useState(null);

const handleProfileTap = (profile) => {
  setSelectedMatch(profile);
  setShowTreeModal(true);
};

// In render:
<ProfileVerificationModal
  visible={showTreeModal}
  onClose={() => setShowTreeModal(false)}
  targetPersonId={selectedMatch?.id}
  targetPersonName={selectedMatch?.name}
/>;
```

### Phase 5: Visual Indicators for Hidden Nodes

#### 5.1 Modify Node Rendering in TreeView

```javascript
// In renderNode function, add visual indicator for hidden children
if (node._hasHiddenChildren) {
  // Add a small badge or indicator
  return (
    <Group>
      {/* Regular node rendering */}

      {/* Hidden children indicator */}
      <Circle
        cx={node.x + nodeWidth / 2}
        cy={node.y + nodeHeight / 2}
        r={8}
        color="#D58C4A"
      />
      <SkiaText
        x={node.x + nodeWidth / 2}
        y={node.y + nodeHeight / 2}
        text={`+${node._hiddenChildCount}`}
        fontSize={10}
        color="#FFFFFF"
      />
    </Group>
  );
}
```

## Technical Implementation Details

### State Management

- The filtered tree uses a temporary Zustand store that mimics the global store interface
- All TreeView functionality (zoom, pan, selection) works unchanged
- The filtered store is created on-demand and disposed when modal closes

### Performance Considerations

- Filtering is done once when modal opens (O(n) complexity)
- The filtered dataset is much smaller, improving rendering performance
- All existing optimizations (LOD, culling, spatial grid) work unchanged

### Edge Cases to Handle

1. **Person not in loaded tree**: Show appropriate message
2. **Isolated nodes**: Ensure at least the person and immediate family are shown
3. **Large families**: Cap the number of descendants shown if needed
4. **Missing relationships**: Handle gracefully when parent/child links are broken

## Testing Plan

### Unit Tests

1. Test `filterTreeForPerson` with various family structures
2. Test indicator node creation
3. Test edge cases (root node, leaf nodes, orphaned nodes)

### Integration Tests

1. Test modal opening/closing
2. Test TreeView renders correctly with filtered data
3. Test all gestures work (zoom, pan, tap)
4. Test navigation between filtered and full views

### Manual Testing

1. Open filtered view for various people
2. Verify correct relatives are shown/hidden
3. Test performance with large trees
4. Test on both iOS and Android

## Implementation Steps

1. **Day 1**: Implement filtering logic and tests
2. **Day 2**: Create FilteredTreeContext and integrate with TreeView
3. **Day 3**: Build ProfileVerificationModal UI
4. **Day 4**: Add visual indicators and polish
5. **Day 5**: Testing and bug fixes

## Alternative Approach (If Context Doesn't Work)

If the context approach has issues, fallback to:

### Prop-based Filtering

```javascript
// Modify TreeView to accept optional filtered data
const TreeView = ({
  filteredData = null, // New optional prop
  ...otherProps
}) => {
  // Use filtered data if provided, otherwise use store
  const storeTreeData = useTreeStore((s) => s.treeData);
  const treeData = filteredData || storeTreeData;

  // Rest of component unchanged
};
```

This requires minimal changes but is less elegant than the context approach.

## Success Criteria

1. ✅ TreeView component code remains 99% unchanged
2. ✅ All existing features work (photos, zoom levels, gestures)
3. ✅ Filtered view shows exactly the specified relatives
4. ✅ Performance is good even with large trees
5. ✅ Visual indicators clearly show hidden relatives
6. ✅ Smooth transition between filtered and full views

## Risks and Mitigations

| Risk                               | Mitigation                                            |
| ---------------------------------- | ----------------------------------------------------- |
| TreeView breaks with filtered data | Test thoroughly, have fallback to prop-based approach |
| Performance issues with filtering  | Cache filtered results, optimize algorithm            |
| Confusing UX with hidden nodes     | Clear visual indicators and tooltips                  |
| State sync issues                  | Use temporary store that doesn't affect global state  |

## Conclusion

This approach achieves the goal of reusing the existing TreeView component completely while showing filtered data. The context-based solution is clean, maintainable, and requires minimal changes to existing code. The filtering logic is separate and testable, and the visual indicators help users understand what's hidden.
