# Alqefari Family Tree App - Roadmap

**Status**: ~90% Complete
**Core Features**: ✅ Tree visualization, Profile management, Admin tools, Search, Munasib system, Marriages, Photos, PDF Export
**Last Updated**: October 2025

---

## 🎯 Remaining Work

### 1. Photo System Polish ✅
**Priority**: HIGH
**Current State**: Complete - All components using expo-image
**Completed Tasks**:
- [x] Fix inconsistent loading states across TreeView/ProfileSheet
- [x] Improve error handling and retry mechanism
- [x] Migrated PhotoEditor to expo-image (was using React Native Image)
- [x] Added blurhash placeholders and smooth transitions
- [x] Visual error states with retry buttons
- [x] Automatic memory + disk caching
- [x] Backwards compatible with both photo systems (profiles.photo_url + profile_photos table)
- [x] Comprehensive documentation in docs/PHOTO_SYSTEM_UPDATE_2025.md

**Remaining** (optional):
- [ ] Test on physical device with slow network
- [ ] Optimize memory usage for trees with 100+ photos (if needed)

### 2. Profile System & Edit Polish
**Priority**: HIGH
**Current State**: Functional but needs refinement
**Tasks**:
- [ ] Smooth transitions between view/edit modes
- [ ] Better field validation with Arabic-specific rules
- [ ] Consistent save feedback across all fields
- [ ] Fix any remaining save issues with specific fields
- [ ] Improve ProfileSheet bottom sheet responsiveness
- [ ] Add field-level error states and recovery

### 3. Activity Logs & Audit System Polish
**Priority**: HIGH
**Current State**: Implemented but UI is poor, functionality untested
**Issues**:
- Poor UI/UX design - needs complete redesign
- Actor name not being tracked/displayed properly
- Functionality largely untested
- Missing proper filtering and search
**Tasks**:
- [ ] Redesign Activity Log UI for better usability
- [ ] Fix actor name tracking (who performed the action)
- [ ] Test and fix revert functionality
- [ ] Add proper filtering by action type, date, actor
- [ ] Improve performance for large audit logs
- [ ] Add pagination or infinite scroll
- [ ] Better error handling for failed reverts
- [ ] Clear action descriptions in Arabic

### 4. Tutorial System
**Priority**: MEDIUM
**Current State**: Not implemented
**Tasks**:
- [ ] Welcome tour for first-time users
- [ ] Admin features walkthrough
- [ ] Tree navigation tips (zoom, pan, search)
- [ ] Profile editing guide
- [ ] Search/filter usage tutorial
- [ ] Consider: Tooltips vs Modal tours vs Overlay guides

### 5. Technical Debt Cleanup
**Priority**: MEDIUM
**Current State**: Accumulated over development
**Tasks**:
- [ ] Remove all commented-out code blocks
- [ ] Delete unused components (check: QuickAddOverlay.old.js, archived components)
- [ ] Consolidate duplicate functionality
- [ ] Add error boundaries to prevent crashes
- [ ] Clean up console warnings
- [ ] Organize imports and file structure
- [ ] Add JSDoc comments for complex functions

---

## 🌳 Tree Page Technical Improvements (Post-Audit)

**Last Audit**: October 2025
**Audit Grade**: B+ (Production-ready with recommended improvements)

### ✅ Completed (Priority 1 - Critical)

- [x] **Remove console.log from worklet functions** (Oct 2025)
  - Fixed frame drops during pan/zoom gestures
  - Files: `src/utils/cameraConstraints.js`

- [x] **Fix stale closure in navigateToNode** (Oct 2025)
  - Removed shared values from dependency array
  - Files: `src/components/TreeView.js` line 1526

- [x] **Implement asymmetric viewport margins** (Oct 2025)
  - Eliminated horizontal pop-in issues
  - 2000px horizontal, 800px vertical with spatial grid padding
  - Commit: `2b9c27019` - "fix(culling): ✅ WORKING"

### 🚧 Priority 2 - Next Sprint (Major Issues)

#### 6. Refactor TreeView Component
**Priority**: HIGH
**Effort**: 5-8 days
**Current State**: 3300+ lines in single file

**Problem**: TreeView violates single responsibility principle.

**Proposed Structure**:
```
src/components/TreeView/
├── TreeView.js              # Main orchestrator (~500 lines)
├── TreeGestures.js          # Pan/pinch/tap logic
├── TreeRenderer.js          # Skia canvas rendering
├── TreeNodes.js             # Node rendering by tier (T1/T2/T3)
├── TreeEdges.js             # Connection line rendering
├── TreeHighlights.js        # Search + ancestry path visualization
├── TreeSkeleton.js          # Loading state components
└── hooks/
    ├── useTreeLayout.js     # Layout calculations
    ├── useSpatialGrid.js    # Culling optimization
    └── useLODSystem.js      # Level-of-detail transitions
```

**Benefits**:
- Easier debugging and testing
- Better code organization
- Reduced risk of bugs during maintenance

#### 7. Consolidate TreeView and SimplifiedTreeView
**Priority**: HIGH
**Effort**: 3-5 days
**Current State**: ~70% code duplication between versions

**Solution**: Extract shared logic into composable hooks
```javascript
// src/hooks/useTreeRendering.js
export function useTreeRendering(nodes, connections, isInteractive) {
  return { renderNode, renderEdges, renderHighlights };
}
```

**Benefits**:
- Bug fixes automatically propagate to both versions
- Reduced maintenance burden
- Consistent behavior

#### 8. Use Design Tokens Consistently
**Priority**: MEDIUM
**Effort**: 1-2 days
**Current State**: Multiple hardcoded values

**Violations**:
```javascript
const CORNER_RADIUS = 8;  // ❌ Should use tokens.radii.sm (10)
fontSize: 7,  // ❌ Not in iOS scale (should be 11+)
fontSize: 11, // ⚠️ Use tokens.typography.caption2.fontSize
```

**Fix**: Import and use tokens throughout
**Valid iOS Sizes**: 11, 12, 13, 15, 17, 20, 22, 28, 34

### 🔵 Priority 3 - Tech Debt (Minor Issues)

#### 9. Optimize Spatial Grid Implementation
**Effort**: 2-3 days
**Issue**: TreeView stores node IDs (requires Map lookup), SimplifiedTreeView stores nodes directly
**Impact**: Eliminates O(N) Map lookups on every frame

#### 10. Add Comprehensive Null Checks
**Effort**: 1 day
**Issue**: Ancestry path rendering missing some validation
**Files**: `src/components/TreeView.js` lines 2281-2401

#### 11. Fix useEffect Dependencies
**Effort**: 1-2 hours
**Issue**: Missing dependencies in initial positioning effect
**Files**: `src/components/TreeView.js` line 1391

#### 12. Clean Up Dead Code
**Effort**: 30 minutes
**Issue**: Unreachable return statement after component
**Files**: `src/components/TreeView.js` line 2779

#### 13. Consolidate Viewport Margin Constants
**Effort**: 1 hour
**Issue**: Same constants with different comments in TreeView/SimplifiedTreeView
**Solution**: Create shared `src/constants/viewport.js`

#### 14. Update LOD Documentation
**Effort**: 30 minutes
**Issue**: Comments unclear about Tier 3 usage
**Files**: `src/components/TreeView.js` lines 621-643

---

## 📊 Performance Monitoring Plan

### Current Performance (After Spatial Grid Fix)
- ✅ Horizontal panning: Smooth, no pop-in
- ✅ Vertical panning: Smooth, maintained improvement
- ✅ Frame rate: 50-60 FPS on iPhone 12
- ✅ Memory: ~11MB for 1000-node tree
- ✅ Spatial grid: O(1) cell lookup

### Target Performance (After Refactoring)
- 60 FPS sustained across all devices
- <15MB memory usage for 1000-node tree
- <100ms initial render time
- <500ms navigation to any node

### Monitoring Tools
- React Native Performance Monitor (built-in)
- Sentry or Bugsnag for production
- Flipper for development profiling

---

## ✅ Completed Features (For Context)

### Infrastructure & Admin
- Multi-child addition with QuickAddOverlay
- Bulk operations (admin_bulk_create_children RPC)
- Undo/Revert system with audit log
- Background jobs for async tasks
- Marriage management system
- Activity log view
- Admin dashboard with all tools

### User Features
- Arabic name chain search
- Photo upload with caching (expo-image)
- Munasib system (150+ spouse profiles)
- PDF export (family tree, profiles, Munasib reports)
- Golden highlight animation for navigation
- Multiple photo gallery support

### Edit Mode (Phases 1-4)
- Core fields: Name, Bio, Sibling Order
- Photo upload with Supabase storage
- Date editing (Hijri/Gregorian)
- Multiple photos per profile

### Tree Visualization Optimizations
- Asymmetric viewport margins (2000px H, 800px V)
- Spatial grid culling with 256px cells
- LOD system with 3 tiers (full cards, text pills, chips)
- Smooth pan/zoom gestures with Reanimated
- High-contrast ancestry path visualization

---

## 📝 Notes

- **Not Implementing**: Relationship Editor, Advanced Admin Tools (bulk 50+ operations), Platform-specific features
- **Shelved**: Voice search, AI features, Natural language queries (over-engineering)
- **Focus**: Polish existing features rather than adding new complexity
- **Timeline**: All remaining work is polish/UX improvement, no major features left

### Design System Compliance: 85/100
**Compliant**:
- ✅ 8px grid spacing
- ✅ Touch targets 44px minimum
- ✅ Najdi Sadu colors
- ✅ RTL mode enabled

**To Fix**:
- ❌ Non-standard font sizes (Priority 2 Item #8)
- ❌ Some hardcoded values instead of tokens (Priority 2 Item #8)

---

## 🏁 Definition of Done

The app will be considered complete when:
1. Photo system loads reliably without flickering ✅
2. Profile editing feels smooth and saves consistently
3. Activity logs work properly with clear UI and actor tracking
4. New users can understand the app via tutorials
5. No console errors or warnings in normal usage
6. Code is clean and maintainable
7. Tree page performance meets 60 FPS target across all devices
8. TreeView component is refactored into logical sub-components

---

## 🤝 Contributing to Tree Page Improvements

When working on tree-specific roadmap items:
1. Create feature branch: `git checkout -b feature/tree-item-N`
2. Reference this roadmap in commit messages
3. Test on physical devices, especially for gesture/performance changes
4. Update CLAUDE.md if design patterns change
5. Add JSDoc comments for complex tree algorithms

---

_This roadmap represents the final sprint. After these items, the app is ready for production use._

**Tree Page Maintainer**: Development Team
**Last Tree Audit**: October 2025
**Next Tree Review**: After Priority 2 completion
