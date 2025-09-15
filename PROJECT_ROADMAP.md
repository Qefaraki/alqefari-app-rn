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

#### Admin Edit Mode - Completed Phases

- ✅ **Phase 1: Core Identity Fields** - Name, Bio, Sibling Order editors
- ✅ **Phase 2: Visual Identity** - PhotoEditor with upload/URL support
- ✅ **Phase 3: Smart Date Editing** - DateEditor with Hijri/Gregorian support

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

- [ ] **Remove get_person_with_relations RPC call**
  - profiles.js line 143 calls non-existent RPC
  - Remove the call and refactor dependent code
  - This is causing errors in production

### 2. Complete Export System

**Priority: HIGH - Core Feature Missing**
**Current State:** Only JSON export exists (profiles.js line 582)
**Needed:**

- [ ] **PDF Export Implementation**
  - Family tree visualization as PDF
  - Individual profile reports
  - Bulk profile book generation
  - Use react-native-pdf or similar
- [ ] **CSV Export Implementation**
  - Tabular data for Excel/Google Sheets
  - Include all profile fields
  - Marriage relationships in separate sheet
- [ ] **Tree Image Export**
  - PNG/JPG of current tree view
  - High-resolution option for printing
  - Use Skia canvas snapshot

---

## 🟡 MEDIUM PRIORITY - Important Enhancements

### 3. Admin Edit Mode - Remaining Phases

**Priority: MEDIUM**

#### Phase 4: Relationship Editor

**Current State:** Can only edit basic fields, not relationships
**Needed:**

- [ ] Parent selector modal with search
- [ ] Validation against circular relationships
- [ ] Bulk parent reassignment for siblings
- [ ] Visual relationship verification

#### Phase 5: Advanced Admin Tools

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

- [ ] **Image Editor Integration**
  - Crop with aspect ratio lock (1:1 for profiles)
  - Rotate in 90° increments
  - Basic filters (brightness, contrast)
- [ ] **Multiple Photos Per Profile**
  - Photo gallery with primary selection
  - Slideshow view in ProfileSheet
  - Maximum 10 photos per person

### 5. Search Improvements

**Priority: MEDIUM**
**Current State:** Basic exact match search
**Needed:**

- [ ] **Recent Searches Storage**
  - Store last 20 searches locally
  - Quick access from search modal
- [ ] **Fuzzy Name Matching**
  - Handle عبدالله vs عبد الله
  - Common misspellings (احمد vs أحمد)
- [ ] **Navigation Animation**
  - Golden highlight effect on found node
  - Smooth pan/zoom to result
  - 2-second highlight pulse

### 6. Munasib System Refinements

**Priority: MEDIUM**
**Current State:** 150 profiles with NULL HID are spouses
**Needed:**

- [ ] **Visual Indicators**
  - Badge showing "منتسب" on spouse profiles
  - Different color in search results
  - Filter option in admin dashboard
- [ ] **family_origin Field**
  - Track which family spouses come from
  - Currently TODO in MarriageEditor.js line 282
  - Add to profile edit form

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

### Sprint 1 (Week 1-2) - Critical Fixes

1. Fix get_person_with_relations issue ⚠️
2. Implement PDF export
3. Implement CSV export

### Sprint 2 (Week 3-4) - Admin Tools

1. Complete Relationship Editor (Phase 4)
2. Add Advanced Admin Tools (Phase 5)
3. Fix image transformation issue

### Sprint 3 (Week 5-6) - Polish

1. Search improvements
2. Munasib visual indicators
3. Photo gallery support

---

## 🎯 Success Metrics

### Must Have (P0)

- ✅ No console errors from missing RPCs
- ✅ PDF/CSV export working
- ✅ All admin edit phases complete

### Should Have (P1)

- ✅ Image transformation fixed or fallback working
- ✅ Search with fuzzy matching
- ✅ Munasib profiles clearly marked

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
// Current: profiles.js line 582
async exportData(format = "json") {
  // Only JSON implemented
}

// Needed:
async exportToPDF(options) {
  // Generate PDF with react-native-pdf
  // Include tree visualization
  // Profile cards with photos
}

async exportToCSV() {
  // Convert profiles to CSV
  // Separate sheets for marriages
  // Include all fields
}
```

### get_person_with_relations Fix

```javascript
// Current: profiles.js line 143
const { data, error } = await supabase.rpc("get_person_with_relations", {
  // This RPC doesn't exist!
});

// Fix: Remove this call or implement the RPC
```

### Munasib Visual Indicators

```javascript
// MarriageEditor.js line 282
// TODO: Add is_munasib: true when database supports it

// Profile display should show:
{
  profile.hid === null && <Badge text="منتسب" color="purple" />;
}
```

---

## Version History

### v1.4.0 (Current) - January 2025

- ✅ QuickAddOverlay for bulk children
- ✅ Search system implementation
- ✅ Image caching with expo-image
- ✅ Activity log with revert
- ✅ Munasib system (150 spouse profiles)

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
