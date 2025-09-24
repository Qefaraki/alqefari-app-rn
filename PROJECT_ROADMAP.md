# AHDAF Application Project Roadmap

## Current Status: v1.4.0 (January 2025)

### Recently Completed Features ✅

#### Core Infrastructure

- ✅ **Multi-Add Children Modal (QuickAddOverlay)** - Long-press to add multiple children with drag-to-reorder
- ✅ **admin_bulk_create_children RPC** - Bulk creation with atomic transactions
- ✅ **admin_revert_action RPC** - Undo functionality with audit log integration
- ✅ **background_jobs table** - Async task tracking for layout recalculation
- ✅ **Marriage Management System** - Full CRUD operations with MarriageEditor component
- ✅ **Arabic Name Chain Search** - search_name_chain function with SearchModal UI
- ✅ **Photo System with Caching** - expo-image integration with CachedImage component
- ✅ **Activity & Revert View** - ActivityScreen with audit log display
- ✅ **Munasib/Spouse System** - 150 spouse profiles using NULL HID system (not 2000.X pattern)
- ✅ **Munasib Management System** - Search, filter, family statistics, marriage connections view
- ✅ **PDF Export System** - Family tree, individual profiles, and Munasib reports
- ✅ **Golden Node Highlight** - 2.5 second animation with LottieGlow effect

#### Admin Edit Mode - Completed Phases

- ✅ **Phase 1: Core Identity Fields** - Name, Bio, Sibling Order editors
- ✅ **Phase 2: Visual Identity** - PhotoEditor with upload/URL support
- ✅ **Phase 3: Smart Date Editing** - DateEditor with Hijri/Gregorian support
- ✅ **Phase 4: Multiple Photos Gallery** - Gallery view in edit page (not admin dashboard)

#### Performance & UX

- ✅ Fixed zoom jumping on physical iOS devices
- ✅ Fixed React hooks order violations
- ✅ Fixed Reanimated value access during render
- ✅ Compact admin interface (removed large title, no FAB)
- ✅ Single-node updates with Zustand store optimization
- ✅ Branch-based loading (max depth 3-5)
- ✅ Viewport culling for visible nodes

---

## 🔴 HIGH PRIORITY - Critical Issues to Fix

### 1. Backend Function Cleanup

**Priority: CRITICAL - Breaking Issue**

- ✅ **Removed get_person_with_relations RPC call** - Function removed from codebase

### 2. Export System

**Priority: COMPLETED**
**Current State:** PDF export fully implemented

- ✅ **PDF Export Implementation**
  - Family tree visualization as PDF with RTL support
  - Individual profile reports
  - Munasib-specific reports
  - Uses react-native-html-to-pdf
- ❌ **CSV/JSON Export** - Not required (PDF only)
- [ ] **Tree Image Export** - Optional future enhancement

---

## 🟡 MEDIUM PRIORITY - Important Enhancements

### 3. Admin Edit Mode - Remaining Phases

**Priority: MEDIUM**

#### Phase 5: Relationship Editor

**Current State:** Basic relationship management exists
**Needed:**

- [ ] Parent selector modal with search
- [ ] Validation against circular relationships
- [ ] Bulk parent reassignment for siblings
- [ ] Visual relationship verification

#### Phase 6: Advanced Admin Tools

**Current State:** Basic field editing only
**Needed:**

- [ ] Protected admin-only fields (verified_by, locked_fields)
- [ ] Bulk operations UI (update 50+ profiles at once)
- [ ] Field templates (apply common patterns)
- [ ] Custom validation rules editor

### 4. Photo System Fixes

**Priority: MEDIUM**

#### Critical Fixes

- [ ] **Fix Supabase Image Transformation**
  - Currently returns 400 error
  - Fallback to client-side resizing
  - Check Supabase dashboard settings

#### Missing Features

- ❌ **Image Editor Integration** - Not required
- ✅ **Multiple Photos Per Profile** - Implemented in edit page
  - Photo gallery with primary selection
  - Gallery view in ProfileEditor
  - Multiple photo support exists

### 5. Search Improvements

**Priority: MEDIUM**
**Current State:** Arabic name chain search implemented
**Completed:**

- ✅ **Arabic Name Chain Search** - search_name_chain function with SearchModal UI
- ✅ **Navigation Animation** - Golden highlight with 2.5 second LottieGlow animation
- ✅ **Smooth pan/zoom** - Animated navigation to search results

**Not Required:**
- ❌ **Recent Searches Storage** - Not needed

**Future Enhancement:**
- [ ] **Fuzzy Name Matching**
  - Handle عبدالله vs عبد الله
  - Common misspellings (احمد vs أحمد)

### 6. Munasib System

**Priority: COMPLETED**
**Current State:** Full Munasib management system implemented

**Completed:**
- ✅ **Munasib Management Dashboard**
  - Search and filter Munasib profiles
  - Family statistics with ranking
  - Marriage connections display
  - Export to PDF functionality
- ✅ **Admin Dashboard Integration**
  - Dedicated Munasib Manager component
  - Family origin tracking
  - Comprehensive analytics

**Not Required:**
- ❌ **Munasib badges** - Management system implemented instead

**Future Enhancement:**
- [ ] **family_origin Field** - Add to profile edit form

---

## 🟢 LOW PRIORITY - Nice to Have

### 7. Performance Optimizations

- [ ] **WebGL Renderer** - For 1000+ nodes
- [ ] **Virtual Scrolling** - In long lists
- [ ] **Service Worker** - For offline caching
- [ ] **Image CDN** - Cloudflare or similar

### 8. Platform Features

#### iOS Specific

- [ ] Live Photos support
- [ ] Handoff between devices
- [ ] iCloud backup integration

#### Android Specific

- [ ] Material You theming
- [ ] Home screen widgets

### 9. Data Management

- [ ] **Import from CSV/Excel**
- [ ] **Automated nightly backups**
- [ ] **Version history UI**
- [ ] **Offline mode with sync**

---

## ❌ REMOVED FEATURES (Not Implementing)

- ~~Voice Search~~ - Removed from scope
- ~~AI-Powered Features~~ - Not needed
- ~~Natural Language Queries~~ - Over-engineering
- ~~Global FAB Button~~ - Already removed from UI

---

## 📊 Implementation Timeline

### Sprint 1 (Completed) - Critical Fixes

1. ✅ Fixed get_person_with_relations issue
2. ✅ Implemented PDF export
3. ✅ Implemented Munasib management system

### Sprint 2 (Current) - Admin Tools

1. Complete Relationship Editor
2. Add Advanced Admin Tools
3. Fix image transformation issue

### Sprint 3 (Future) - Polish

1. Fuzzy search matching
2. Performance optimizations
3. Platform-specific features

---

## 🎯 Success Metrics

### Must Have (P0)

- ✅ No console errors from missing RPCs
- ✅ PDF export working
- ✅ Munasib management system
- ✅ Golden highlight animation

### Should Have (P1)

- ✅ Image transformation fixed or fallback working
- ✅ Arabic name chain search
- ✅ Munasib management dashboard

### Nice to Have (P2)

- ✅ Performance optimizations
- ✅ Platform-specific features
- ✅ Advanced data management

---

## 🔧 Technical Debt

### Code Quality

- [ ] Remove URL-based photo code (PhotoEditor.js)
- [ ] Remove commented out code
- [ ] Add TypeScript definitions
- [ ] Consolidate duplicate components

### Documentation

- [ ] API documentation for all RPCs
- [ ] Component usage examples
- [ ] Deployment guide update
- [ ] Admin user manual

### Testing

- [ ] Unit tests for export functions
- [ ] Integration tests for search
- [ ] E2E tests for admin workflows
- [ ] Performance benchmarks

---

## 📝 Implementation Notes

### Export System Details

```javascript
// Implemented: pdfExport.js service
exportFamilyTreePDF(options) {
  // Generates PDF with RTL support
  // Arabic typography and generation names
  // Statistics and profile cards
}

exportMunasibReport(options) {
  // Munasib-specific PDF reports
  // Family statistics and rankings
  // Marriage connections included
}
```

### get_person_with_relations Fix

```javascript
// ✅ FIXED: Function removed from codebase
// No longer calling non-existent RPC
```

### Munasib Management System

```javascript
// Implemented: MunasibManager.js component
// Full management dashboard with:
- Search and filtering
- Family statistics
- Marriage connections
- PDF export

// Munasib identified by:
profile.hid === null // No HID means Munasib/spouse
```

---

## Version History

### v1.4.0 (Current) - January 2025

- ✅ QuickAddOverlay for bulk children
- ✅ Arabic name chain search implementation
- ✅ Image caching with expo-image
- ✅ Activity log with revert
- ✅ Munasib system (150 spouse profiles)
- ✅ PDF export service (family tree, profiles, Munasib reports)
- ✅ Munasib management dashboard
- ✅ Golden highlight animation (2.5 second LottieGlow)
- ✅ Multiple photos gallery in edit page

### v1.3.0 - Photo System & Caching

- ✅ expo-image integration
- ✅ CachedImage component
- ✅ Image preloading
- ✅ Fallback system

### v1.2.0 - Photo Upload System

- ✅ Native photo upload
- ✅ Supabase storage
- ✅ Client-side optimization
- ✅ EXIF stripping

### v1.1.0 - Edit Mode Phase 1

- ✅ Editable fields
- ✅ iOS-native UI/UX
- ✅ Neo-native design

### v1.0.0 - Initial Release

- ✅ Core tree visualization
- ✅ Profile viewing
- ✅ Admin authentication

---

_Last Updated: January 2025_
_Next Review: February 2025_
