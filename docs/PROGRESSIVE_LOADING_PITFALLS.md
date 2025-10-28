# Progressive Loading Pitfalls & Solutions

## 🚨 Critical Issue: Self-View Profile Data Incompleteness

**Date**: October 26, 2025  
**Severity**: High - User cannot see their own complete profile data  
**Root Cause**: Data source prioritization bug in progressive loading architecture  

### Problem Description

Users viewing their own profiles received **incomplete structure data (10 fields)** instead of **complete profile data (45 fields)** available in the authentication context.

**Symptoms:**
- User reports "still not showing my data"  
- Profile displays only basic fields: `id, name, hid, generation, photo_url, etc.`
- Missing critical data: bio, achievements, timeline, contact info, dates, etc.

### Root Cause Analysis

#### Progressive Loading Architecture Issue

The app uses a **3-phase progressive loading system**:

1. **Phase 1 (Structure)**: Load minimal data (0.45MB) for layout calculation
2. **Phase 2 (Layout)**: Calculate tree positions with d3  
3. **Phase 3 (Enrichment)**: Load rich data for visible nodes only

**The Bug**: ProfileSheetWrapper data resolution prioritized incomplete tree store data over complete auth profile data.

```javascript
// PROBLEMATIC LOGIC
const person = useMemo(() => {
  // 1. Try tree store first (INCOMPLETE - only structure fields)
  const treeNode = nodesMap.get(selectedPersonId); 
  if (treeNode) return treeNode; // 10 fields ❌
  
  // 2. Try munasib fallback
  if (munasibProfile?.id === selectedPersonId) return munasibProfile;
  
  // Auth profile (45 fields) was NEVER considered ❌
}, [selectedPersonId, nodesMap, munasibProfile]);
```

#### Data Source Comparison

| Data Source | Field Count | Content | When Available |
|-------------|-------------|---------|----------------|
| **Tree Store** | 10 fields | Structure only | Always (progressive loading) |
| **Auth Profile** | 45 fields | Complete data | Always (authentication) |
| **Enriched Nodes** | 30+ fields | Rich data | After viewport enrichment |

**Issue**: Tree store was prioritized despite having incomplete data for the authenticated user.

### The Fix

**Minimal, High-Performance Solution** (4 lines):

```javascript
// FIXED LOGIC in ProfileSheetWrapper
const person = useMemo(() => {
  if (!selectedPersonId) return null;
  
  // ✅ PRIORITY FIX: Use complete auth profile for self-view
  if (userProfile?.id === selectedPersonId && userProfile) {
    return userProfile; // 45 complete fields
  }
  
  // Original logic for viewing other profiles
  return nodesMap.get(selectedPersonId) || munasibProfile;
}, [selectedPersonId, nodesMap, munasibProfile, userProfile]);
```

**Performance Impact**: Zero - no network calls, no async operations, pure conditional check.

### Key Learnings

#### 1. **Progressive Loading Data Hierarchy**

When implementing progressive loading, establish **clear data source priorities**:

```
PRIORITY ORDER (most complete → least complete):
1. Complete authenticated user data (auth context)
2. Enriched profile data (viewport enrichment) 
3. Tree structure data (progressive loading)
4. Fallback data sources (munasib profiles)
```

#### 2. **Self-View Special Case Pattern**

Always handle **self-view as a special case** in profile systems:

```javascript
// PATTERN: Self-view priority check
if (isViewingOwnProfile && completeUserData) {
  return completeUserData; // Use complete data source
}
// ... fallback to other data sources
```

#### 3. **Data Completeness Validation**

Add **field count validation** in debug builds:

```javascript
if (__DEV__ && person && Object.keys(person).length < 15) {
  console.warn(`Incomplete profile data: ${Object.keys(person).length} fields`);
}
```

### Prevention Strategies

#### 1. **Comprehensive Testing Matrix**

Test data loading for all user types:

| User Type | Data Source | Expected Fields | Test Status |
|-----------|-------------|-----------------|-------------|
| Self-view | Auth profile | 45 fields | ✅ |
| Family member | Tree store + enrichment | 30+ fields | ✅ |
| Munasib spouse | Munasib state | 25+ fields | ✅ |
| Admin viewing others | Tree store + enrichment | 30+ fields | ✅ |

#### 2. **Data Source Documentation**

Document **all profile data sources** and their capabilities:

```javascript
/**
 * Profile Data Sources & Capabilities
 * 
 * 1. AuthContext.profile (userProfile)
 *    - Fields: 45+ complete profile fields
 *    - Availability: Always available for authenticated user
 *    - Use case: Self-view, user account operations
 * 
 * 2. TreeStore.nodesMap (progressive loading)
 *    - Fields: 10 structure fields initially, enriched to 30+
 *    - Availability: After tree loading, enriched on viewport
 *    - Use case: Family tree navigation, other profiles
 * 
 * 3. MunasibProfile state (external family members)
 *    - Fields: 25+ profile fields
 *    - Availability: Lazy loaded on profile access
 *    - Use case: Spouse profiles (hid = NULL)
 */
```

#### 3. **Component-Level Guards**

Add **data completeness guards** in ProfileViewer:

```javascript
// Guard against incomplete profile data
if (person && Object.keys(person).length < 15) {
  console.warn('ProfileViewer received incomplete data, triggering enrichment');
  // Trigger enrichment or fallback to complete data source
}
```

#### 4. **Progressive Loading Architecture Rules**

**DO:**
- ✅ Use progressive loading for performance optimization
- ✅ Prioritize complete data sources when available  
- ✅ Handle self-view as special case
- ✅ Add data completeness validation in development

**DON'T:**
- ❌ Always prioritize progressive data over complete data
- ❌ Assume tree store has complete profile data
- ❌ Ignore auth context data for authenticated user
- ❌ Skip field count validation in profile components

### Monitoring & Detection

#### Development Debug Logs

```javascript
[PROFILE SHEET DEBUG] Using complete auth profile for self-view: {fieldCount: 45}
[PROFILE VIEWER DEBUG] Received complete profile data: {fieldCount: 45}
```

#### Production Monitoring

Track profile data completeness in analytics:

```javascript
// Track incomplete profile data issues
analytics.track('profile_data_incomplete', {
  userId,
  profileId, 
  fieldCount: Object.keys(profile).length,
  expectedMinimum: 15,
  dataSource: 'tree_store' // or 'auth_profile', 'munasib'
});
```

## Summary

This issue demonstrates the importance of **data source prioritization** in progressive loading architectures. The fix ensures users always see their complete profile data while maintaining progressive loading performance benefits for other profiles.

**Key Takeaway**: When you have multiple data sources with different completeness levels, always prioritize the most complete source for the most critical use case (self-view).

---

## 🚨 Critical Issue: On-Demand Enrichment for User Actions

**Date**: October 28, 2025
**Severity**: High - User-triggered actions fail when nodes are off-viewport
**Root Cause**: Progressive loading only enriches visible nodes, user actions may need distant nodes

### Problem Description

Users triggering actions (cousin marriage highlighting, navigation, etc.) that require data for **off-viewport nodes** experience failures due to missing node data.

**Symptoms:**
- User clicks "Visit Profile" on cousin marriage → highlighting doesn't appear
- Features requiring dual-node data fail silently
- Undefined errors when accessing `node.field` on non-enriched nodes
- Actions work for on-screen nodes but fail for distant relatives

### Root Cause Analysis

#### Progressive Loading Viewport Limitation

Progressive loading only enriches nodes **within viewport + padding**:

```javascript
// Phase 3 Enrichment: Only visible nodes loaded
const visibleNodeIds = getVisibleNodeIds(
  nodes,
  viewport,
  dimensions,
  200 // padding: preload 200px outside viewport
);
```

**The Problem**: User actions may require data for nodes **outside viewport**, which aren't enriched yet.

#### Example: Cousin Marriage Highlighting

User clicks "Visit Profile" on cousin marriage (4th cousins):

1. **Tree animates** to cousin's position (left side of tree)
2. **Current user's profile** (right side) gets **unloaded** (outside viewport)
3. **Highlighting requires BOTH nodes** (current user + cousin)
4. **Validation fails** because current user's node is missing from `nodesMap`

```javascript
// BROKEN: Validation blocks action
const currentProfileInTree = nodesMap.has(person.id);
const spouseInTree = nodesMap.has(spouse.id);
if (isCousinWife && currentProfileInTree && spouseInTree) {
  // NEVER executes for distant cousins (only one on screen at a time)
}
```

### The Fix

**Enrichment-First Pattern** (TreeView.core.js Entry Point 2, lines 1771-1980):

```javascript
// ✅ SOLUTION: Enrich missing nodes on-demand before action
useEffect(() => {
  if (pendingCousinHighlight && nodes.length > 0) {
    const { spouse1Id, spouse2Id, highlightProfileId } = pendingCousinHighlight;

    // Enrichment-first: Load missing nodes before highlighting
    const ensureNodesEnriched = async () => {
      const nodesMap = store.state.nodesMap;
      const needsEnrichment = !nodesMap.has(spouse1Id) || !nodesMap.has(spouse2Id);

      if (needsEnrichment) {
        // Concurrent operation lock (prevent parallel enrichments)
        if (cousinEnrichmentLockRef.current) {
          await waitForLockRelease(); // 5s timeout
        }

        cousinEnrichmentLockRef.current = true;
        console.log('[TreeView] Loading cousin data...');

        try {
          // Force enrichment of BOTH nodes (even if off-viewport)
          const { data, error } = await profilesService.enrichVisibleNodes([spouse1Id, spouse2Id]);

          if (error || !data || data.length < 2) {
            // Retry logic with network guard
            await retryEnrichment();
          }

          // Soft-delete validation
          const validNodes = data.filter(node => !node.deleted_at);
          if (validNodes.length < 2) {
            Alert.alert('خطأ', 'الملف المطلوب محذوف أو غير موجود');
            return false;
          }

          // Update store with enriched data
          updateStoreWithEnrichedData(data);
          console.log('[TreeView] Cousin data loaded successfully');

        } catch (error) {
          // Network error detection
          const isNetworkError = error.message?.includes('network') || error.message?.includes('fetch');
          Alert.alert('خطأ', isNetworkError
            ? 'لا يوجد اتصال بالإنترنت'
            : 'حدث خطأ أثناء تحميل البيانات'
          );
          return false;
        } finally {
          cousinEnrichmentLockRef.current = false;
        }
      }

      return true; // Nodes ready
    };

    // Execute enrichment + action
    (async () => {
      const ready = await ensureNodesEnriched();
      if (ready) {
        // Execute action with complete data
        executeHighlighting();
      }
    })();
  }
}, [pendingCousinHighlight]);
```

**Performance Impact**: 150-250ms enrichment call only when needed (not on every render).

### Key Learnings

#### 1. **Enrichment-First Pattern**

Always enrich before executing user-triggered actions on distant nodes:

```javascript
// PATTERN: Check → Enrich → Execute
async function handleUserAction(nodeIds) {
  // 1. Check if nodes are loaded
  const missingNodes = nodeIds.filter(id => !nodesMap.has(id));

  // 2. Enrich missing nodes
  if (missingNodes.length > 0) {
    await enrichNodes(missingNodes);
  }

  // 3. Execute action with complete data
  executeAction(nodeIds);
}
```

#### 2. **Critical Race Conditions**

Avoid timer race conditions in async enrichment:

```javascript
// ❌ WRONG: Timer set AFTER cleanup runs
let timer = null;
(async () => {
  await ensureEnriched(); // Long async
  timer = setTimeout(...); // Set after cleanup!
})();
return () => { clearTimeout(timer); }; // Runs before timer set!

// ✅ CORRECT: Use useRef for timer
const timerRef = useRef(null);
(async () => {
  await ensureEnriched();
  timerRef.current = setTimeout(...); // Persists across cleanup
})();
return () => { clearTimeout(timerRef.current); };
```

#### 3. **Concurrent Operation Protection**

Prevent parallel enrichments corrupting state:

```javascript
// Mutex pattern with timeout
const lockRef = useRef(false);

if (lockRef.current) {
  await waitForLock(5000); // Wait max 5s
}

lockRef.current = true;
try {
  await enrichNodes();
} finally {
  lockRef.current = false; // Always release
}
```

#### 4. **Mounted Flag Pattern**

Prevent post-unmount execution:

```javascript
const mountedRef = useRef(true);

useEffect(() => {
  mountedRef.current = true;

  (async () => {
    await enrichNodes();
    if (!mountedRef.current) return; // Component unmounted
    executeAction();
  })();

  return () => {
    mountedRef.current = false;
  };
}, [deps]);
```

### Prevention Strategies

#### 1. **Always Check Before Access**

```javascript
// Guard pattern for node access
const node = nodesMap.get(nodeId);
if (!node) {
  await enrichNodes([nodeId]); // Enrich on-demand
}
// Now safe to access node.field
```

#### 2. **Network Guards**

```javascript
try {
  await enrichNodes(nodeIds);
} catch (error) {
  const isNetworkError = error.message?.includes('network') || error.message?.includes('fetch');
  Alert.alert('خطأ', isNetworkError
    ? 'لا يوجد اتصال بالإنترنت'
    : 'حدث خطأ أثناء تحميل البيانات'
  );
}
```

#### 3. **Soft-Delete Validation**

```javascript
// Always validate enriched nodes
const validNodes = enrichedData.filter(node => !node.deleted_at);
if (validNodes.length < requiredCount) {
  Alert.alert('خطأ', 'الملف المطلوب محذوف أو غير موجود');
  return;
}
```

#### 4. **Loading Feedback**

```javascript
console.log('[Feature] Loading data...');
await enrichNodes(nodeIds);
console.log('[Feature] Data loaded successfully');
```

#### 5. **DRY Helpers**

Extract reusable enrichment logic:

```javascript
// Reusable store update helper
const updateStoreWithEnrichedData = (enrichedData) => {
  const treeStore = useTreeStore.getState();
  const newTreeData = treeStore.treeData.map(node => {
    const enriched = enrichedData.find(e => e.id === node.id);
    return enriched ? { ...node, ...enriched } : node;
  });
  treeStore.setTreeData(newTreeData);
};
```

### Progressive Loading Action Checklist

Before implementing any user-triggered action that accesses node data:

- [ ] **Check availability**: Does action need off-viewport nodes?
- [ ] **Enrich first**: Load missing nodes before executing action
- [ ] **Add concurrent lock**: Prevent parallel enrichments
- [ ] **Use refs**: Timer refs, mounted flags, lock refs
- [ ] **Network guard**: Handle offline gracefully
- [ ] **Soft-delete check**: Validate enriched nodes aren't deleted
- [ ] **Loading feedback**: Console logs or UI indicators
- [ ] **Extract helpers**: DRY principle for store updates
- [ ] **Test edge cases**: Rapid navigation, offline mode, deleted nodes

### Monitoring & Detection

#### Development Debug Logs

```javascript
[TreeView] Enriching nodes for cousin highlight: 123, 456
[TreeView] Loading cousin data...
[TreeView] Cousin data loaded successfully
[TreeView] Cousin marriage dual paths activated
```

#### Production Monitoring

```javascript
analytics.track('enrichment_on_demand', {
  feature: 'cousin_marriage',
  nodeIds: [spouse1Id, spouse2Id],
  enrichmentDuration: performance.now() - startTime,
  success: true
});
```

## Summary

Progressive loading requires **enrichment-first pattern** for user actions that access off-viewport nodes. Key fixes include concurrent operation locks, timer race condition prevention, network guards, and soft-delete validation.

**Key Takeaway**: Never assume nodes are loaded. Always check `nodesMap.has(nodeId)` and enrich on-demand for user-triggered actions on distant relatives.

**Reference Implementation**: `src/components/TreeView/TreeView.core.js` (Entry Point 2, lines 1771-1980)

---

*This documentation serves as a reference for future progressive loading implementations and helps prevent similar data incompleteness issues.*