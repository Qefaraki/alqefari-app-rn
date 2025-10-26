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

*This documentation serves as a reference for future progressive loading implementations and helps prevent similar data incompleteness issues.*