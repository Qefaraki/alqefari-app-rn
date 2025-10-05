# Alqefari Family Tree App - Roadmap

**Status**: ~90% Complete
**Core Features**: ✅ Tree visualization, Profile management, Admin tools, Search, Munasib system, Marriages, Photos, PDF Export
**Last Updated**: January 2025

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

---

## 📝 Notes

- **Not Implementing**: Relationship Editor, Advanced Admin Tools (bulk 50+ operations), Platform-specific features
- **Shelved**: Voice search, AI features, Natural language queries (over-engineering)
- **Focus**: Polish existing features rather than adding new complexity
- **Timeline**: All remaining work is polish/UX improvement, no major features left

---

## 🏁 Definition of Done

The app will be considered complete when:
1. Photo system loads reliably without flickering
2. Profile editing feels smooth and saves consistently
3. Activity logs work properly with clear UI and actor tracking
4. New users can understand the app via tutorials
5. No console errors or warnings in normal usage
6. Code is clean and maintainable

---

_This roadmap represents the final sprint. After these items, the app is ready for production use._