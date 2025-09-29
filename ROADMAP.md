# Alqefari Family Tree App - Roadmap

**Status**: ~90% Complete
**Core Features**: ✅ Tree visualization, Profile management, Admin tools, Search, Munasib system, Marriages, Photos, PDF Export
**Last Updated**: January 2025

---

## 🎯 Remaining Work

### 1. Photo System Polish
**Priority**: HIGH
**Current State**: Working but fidgety behavior
**Tasks**:
- [ ] Fix inconsistent loading states across TreeView/ProfileSheet
- [ ] Improve error handling and retry mechanism
- [ ] Remove URL-based photo code (technical debt in PhotoEditor.js)
- [ ] Optimize memory usage for trees with many photos
- [ ] Fix Supabase image transformation or implement proper fallback

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

### 3. Tutorial System
**Priority**: MEDIUM
**Current State**: Not implemented
**Tasks**:
- [ ] Welcome tour for first-time users
- [ ] Admin features walkthrough
- [ ] Tree navigation tips (zoom, pan, search)
- [ ] Profile editing guide
- [ ] Search/filter usage tutorial
- [ ] Consider: Tooltips vs Modal tours vs Overlay guides

### 4. Technical Debt Cleanup
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
3. New users can understand the app via tutorials
4. No console errors or warnings in normal usage
5. Code is clean and maintainable

---

_This roadmap represents the final sprint. After these items, the app is ready for production use._