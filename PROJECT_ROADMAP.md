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

## 🔴 HIGH PRIORITY - Features to Implement

### 1. Missing Backend Functions

**Priority: CRITICAL**

- [ ] **Remove or implement get_person_with_relations RPC**
  - Currently called in profiles.js but doesn't exist
  - Either implement for aggregated data or remove the call
  - Decision needed: Performance benefit vs. complexity

### 2. Export Functionality

**Priority: HIGH**

- [ ] **PDF Export** - Family tree and profile reports
- [ ] **CSV Export** - Bulk data export for analysis
- [ ] **Image Export** - Tree visualization as PNG/JPG
- [ ] **Backup System** - Scheduled automated backups
- Currently only JSON export exists

### 3. Admin Edit Mode - Remaining Phases

**Priority: HIGH**

#### Phase 4: Relationship Selector

- [ ] Parent selection UI with smart filtering
- [ ] Validation to prevent circular relationships
- [ ] Bulk relationship updates
- [ ] Relationship verification tools

#### Phase 5: Advanced Admin Controls

- [ ] Admin-only fields management
- [ ] Bulk field updates across profiles
- [ ] Field templates for common patterns
- [ ] Data validation rules configuration

---

## 🟡 MEDIUM PRIORITY - Enhancements

### 4. Photo System Improvements

**Priority: MEDIUM**

#### Missing Features

- [ ] **Image Editing** - Crop, rotate, brightness/contrast
- [ ] **Multiple Photos** - Gallery per profile
- [ ] **Smart Avatars** - Initials with generation colors
- [ ] **Batch Operations** - Bulk upload/compression

#### Technical Debt

- [ ] Fix Supabase image transformation (returns 400)
- [ ] Remove URL-based photo code
- [ ] Implement blur hash placeholders
- [ ] Add memory management for large trees

### 5. Search System Enhancements

**Priority: MEDIUM**

- [ ] **Voice Search** - "ابحث عن محمد بن عبدالله"
- [ ] **Recent Searches** - History with quick access
- [ ] **Fuzzy Matching** - Handle spelling variations
- [ ] **Smart Suggestions** - "People also searched for"
- [ ] **Relationship Calculator** - Show exact relationships
- [ ] **Golden Highlight Navigation** - Animate to found node

### 6. Performance Optimizations

**Priority: MEDIUM**

- [ ] **WebGL Rendering** - For trees with 1000+ nodes
- [ ] **Viewport-based Loading** - Load only visible branches
- [ ] **Background Prefetching** - Preload adjacent branches
- [ ] **Adaptive Quality** - Adjust based on device/network
- [ ] **Progressive Enhancement** - Start simple, add features

---

## 🟢 LOW PRIORITY - Future Enhancements

### 7. AI-Powered Features

**Priority: LOW**

- [ ] **Relationship Suggestions** - Pattern-based recommendations
- [ ] **Data Validation** - Anomaly detection
- [ ] **Smart Templates** - AI-generated family patterns
- [ ] **Natural Language Queries** - "Show me all doctors in generation 5"

### 8. Platform-Specific Features

**Priority: LOW**

#### iOS Enhancements

- [ ] Live Photos support (extract still frame)
- [ ] iPhone Dynamic Island optimization
- [ ] Apple Pencil annotations on iPad
- [ ] Drag & drop on iPad

#### Android Enhancements

- [ ] Material You theming
- [ ] Widget support
- [ ] Split-screen mode

### 9. Munasib System Implementation

**Priority: LOW**

- [ ] Profile type tracking (family vs. munasib)
- [ ] Family origin tracking for spouses
- [ ] Filter munasib from tree view
- [ ] Migration script for existing spouses

### 10. Data Management Features

**Priority: LOW**

- [ ] **Offline Support** - Work without connection
- [ ] **Sync System** - Conflict resolution
- [ ] **Version Control UI** - View/restore versions
- [ ] **Change History Viewer** - Detailed audit trail
- [ ] **Import from Excel/CSV** - Bulk data import

---

## 📊 Implementation Timeline

### Q1 2025 (Current)

**Week 1-2: Critical Fixes**

- [ ] Resolve get_person_with_relations issue
- [ ] Implement basic export (PDF/CSV)

**Week 3-4: Admin Features**

- [ ] Complete Phase 4: Relationship Selector
- [ ] Complete Phase 5: Advanced Controls

### Q2 2025

**Month 1: Photo System**

- [ ] Fix image transformation
- [ ] Add editing capabilities
- [ ] Implement multiple photos

**Month 2: Search & Performance**

- [ ] Search enhancements
- [ ] WebGL rendering
- [ ] Viewport-based loading

### Q3 2025

**AI Features & Platform Optimization**

- [ ] AI-powered suggestions
- [ ] iOS/Android specific features
- [ ] Advanced analytics

### Q4 2025

**Polish & Scale**

- [ ] Munasib system
- [ ] Offline support
- [ ] Enterprise features

---

## 🎯 Success Metrics

### Performance Targets

- Tree rendering: < 100ms for 500 nodes
- Search response: < 200ms for 10k profiles
- Image load: < 2s on 4G connection
- Memory usage: < 200MB with 100 photos

### User Experience

- Admin can add 10 children in < 30 seconds
- Export 1000 profiles in < 5 seconds
- Zero data loss during offline periods
- 99.9% uptime for core features

### Quality Standards

- TypeScript coverage: 80%+
- Test coverage: 70%+
- Accessibility: WCAG AA compliant
- Arabic RTL: 100% support

---

## 🔧 Technical Debt to Address

1. **Code Organization**
   - [ ] Extract types to dedicated files
   - [ ] Consolidate duplicate components
   - [ ] Remove commented code
   - [ ] Update deprecated APIs

2. **Documentation**
   - [ ] API documentation
   - [ ] Component storybook
   - [ ] Deployment guide
   - [ ] User manual

3. **Testing**
   - [ ] Unit tests for services
   - [ ] Integration tests for RPCs
   - [ ] E2E tests for critical flows
   - [ ] Performance benchmarks

4. **Security**
   - [ ] Security audit
   - [ ] Penetration testing
   - [ ] GDPR compliance
   - [ ] Data encryption

---

## 📝 Notes

### Removed/Deprecated Features

- ❌ Global FAB (Floating Action Button) - Removed in favor of contextual actions
- ❌ Glass/blur effects - Using neo-native design system
- ❌ URL-based photo system - Replaced with direct upload

### Design Decisions

- RTL-first for all UI components
- Neo-native aesthetic (no blur/glass)
- Offline-first architecture
- Privacy by default

### Known Issues

- Supabase image transformation returns 400 error
- get_person_with_relations RPC not implemented
- Memory usage high with many photos
- Some migrations not applied to production

---

## Version History

### v1.4.0 (Current) - January 2025

- ✅ QuickAddOverlay for bulk children
- ✅ Search system implementation
- ✅ Image caching with expo-image
- ✅ Activity log with revert

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
