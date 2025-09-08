# AHDAF Application Project Roadmap

## Latest Updates

### Bug Fixes (2025-01-05)
- ✅ Fixed React hooks order violation in TreeView component
  - Moved all hooks (useCallback, useMemo, useEffect) before conditional returns
  - Fixed "Rendered more hooks than during the previous render" error
  - Ensured hooks are called in the same order on every render
- ✅ Fixed Reanimated value access during render
  - Created currentTransform state to avoid accessing .value during render
  - Used useAnimatedReaction to sync transform values
  - Updated gesture handlers to use synced state values

### Documentation Cleanup (2025-09-04)
- ✅ Reviewed all documentation files against current codebase
- ✅ Updated backend-implementation.md to reflect actual implementation
- ✅ Created optimized CLAUDE.md for AI assistant context
- ✅ Removed outdated migration guide and security vulnerabilities
- ✅ Verified validation functions and admin operations
- ✅ Fixed trigger_layout_recalc_async naming mismatch
- ✅ Documented missing features (marriage UI, get_person_with_relations)

## Phase 5: High-Velocity Admin Toolkit & Backend Engine

### ✅ Completed

#### Admin Edit Mode - Phase 1: Core Identity Fields (2025-09-01)
- ✅ Created NameEditor component with premium iOS-style text input
  - Large 36px font matching current design
  - Animated focus states with spring physics
  - Clear button with smooth animations
  - Real-time validation (min 2 characters)
  - RTL support with SF Arabic font

- ✅ Created BioEditor component with expanding textarea
  - Auto-expanding from 3 to 10 lines
  - Glass card design with CardSurface
  - Arabic numeral character counter (٢٥٠/٥٠٠)
  - Smooth animations and haptic feedback
  - Internal scroll when max height reached

- ✅ Created SiblingOrderStepper component (HIGH PRIORITY)
  - Premium native stepper control (no blur)
  - Animated button presses with spring physics
  - Haptic feedback (light, success, error)
  - Arabic number display
  - Live preview text showing position
  - Disabled state for minus at 0

- ✅ Integrated all components into ProfileSheet
  - Name editing in hero section
  - Bio editing with character limit
  - Sibling order in Information section
  - Proper data flow through editedData state

- ✅ Fixed native animation conflicts in NameEditor
  - Separated animated values for different purposes
  - Used state-based styling for border color
  - All animations now properly use native driver

- ✅ Fixed database constraint violations on save
  - Convert empty strings to null for nullable fields
  - Added client-side email validation
  - Properly handle all optional fields in database

- ✅ Implemented efficient single-node updates
  - Added updateNode, addNode, removeNode to Zustand store
  - Tree nodes update instantly after editing
  - Real-time sync updates individual nodes, not entire tree
  - Scales to trees of any depth without performance impact

- ✅ Fixed TreeView state management
  - Removed duplicate local state in TreeView
  - Single source of truth using Zustand store
  - Tree automatically re-renders when any component updates data
  - Fixes issue where edits weren't visible until restart

- ✅ Created compact admin interface
  - Removed large "شجرة عائلة القفاري" title taking up space
  - Created CompactAdminBar with native styling (no blur)
  - Single row design: user | toggle | control panel
  - Reduced header from ~200px to ~50px  
  - Added collapse option for cleaner view
  - Floating admin login when not authenticated

- ✅ Implemented comprehensive debug logging system (2025-09-02)
  - Canvas coordinate tracking (verifies nodes never move)
  - Viewport bounds calculations with transform details
  - Node visibility transitions (entry/exit tracking)
  - Connection visibility changes
  - Pinch gesture transform calculations
  - Tap coordinate transformations
  - Node rendering position verification
  
- ✅ Fixed Reanimated crash in debug logging (2025-09-03)
  - Removed inline runOnJS from useAnimatedReaction
  - Fixed segmentation fault in simulator
  - Preserved other debug logs for troubleshooting
  
- ✅ Optimized debug logging to reduce spam (2025-09-03)
  - Removed per-frame rendering logs
  - Condensed all logs to single-line summaries
  - Added helpful debug guide on startup
  - Made logs easily shareable for troubleshooting

- ✅ Identified and fixed zoom jumping on physical devices (2025-09-03)
  - Root cause: Viewport culling causing massive visibility changes
  - Increased VIEWPORT_MARGIN from 200 to 800 pixels
  - Added dynamic margin that scales with zoom level
  - Rounded focal points to prevent float precision issues
  - Added warnings for large visibility changes

- ✅ Fixed physical device gesture handling differences (2025-09-03)
  - Issue: Physical devices send duplicate gesture events with stuck scale values
  - Added gesture debouncing to skip duplicate scale updates within 16ms
  - Implemented focal point stabilization using stored values from gesture start
  - Added 1% scale change threshold to prevent tiny updates
  - Normalized touch coordinates to even numbers to reduce drift
  - Throttled viewport bounds updates to 60fps maximum

- ✅ Completely fixed zoom jumping on physical iOS devices (2025-09-04)
  - Root cause: Storing focal point at gesture start instead of using live values
  - Removed focalX/focalY shared values completely
  - Now uses e.focalX/e.focalY directly in each onUpdate call
  - Converts focal to world coordinates using transform at gesture start
  - Keeps the world point consistently under the fingers as scale changes
  - Fixed Skia transform order to scale first, then translate
  - Changed gesture composition from Simultaneous to Race with pan yielding to pinch
  - Added DPR constant (set to 1 for DIP-aligned Skia)
  - Result: Smooth, stable zoom on both simulator and physical devices

#### Admin Edit Mode - Phase 2: Visual Identity (2025-09-04)
- ✅ Created PhotoEditor component with premium iOS-style interface
  - Circular photo preview (160x160) with native card
  - URL input field with live preview (800ms debounce)
  - Loading spinner overlay during image fetch
  - Error state with icon and message for invalid URLs
  - "Remove Photo" button with gradient style and confirmation dialog
  - Smooth animations and haptic feedback
  - URL validation (requires https:// or http://)
  
- ✅ Integrated PhotoEditor into ProfileSheet
  - Replaces static hero image in edit mode
  - Maintains existing photo display in view mode
  - Proper data flow through editedData state
  - Seamless save functionality with backend

### 🚧 In Progress

#### Admin Edit Mode - Remaining Phases
- Phase 3: Smart Date Editing - Hijri/Gregorian date pickers
- Phase 4: Relationship Selector - Parent selection UI
- Phase 5: Advanced Controls - Admin-only fields
- Phase 6: Marriage Management - Add/edit/delete marriages UI

### 📋 TODO

#### High Priority Features to Implement
1. **Marriage Management UI**
   - Deploy admin_create_marriage function to production
   - Create MarriageEditor component
   - Add spouse selector with smart filtering
   - Implement marriage CRUD operations in admin mode

2. **Fix Missing Backend Functions**
   - Either implement get_person_with_relations RPC or remove from service layer
   - Consider if aggregating relations would improve performance

1. Admin Features
   - Batch operations UI
   - Change history viewer
   - Field templates
   - Offline support with sync

2. Performance Optimizations
   - Viewport-based node loading
   - WebGL rendering for large trees
   - Background data prefetching

3. Enhanced Features
   - AI-powered relationship suggestions
   - Smart data validation
   - Automated backups
   - Export functionality

## Version History

### v1.0.0 - Initial Release
- Core tree visualization
- Basic profile viewing
- Admin authentication

### v1.1.0 - Edit Mode Phase 1 
- ✅ Editable name, bio, and sibling order fields
- ✅ World-class iOS-native UI/UX
- ✅ Premium neo‑native design system (no blur)

### v1.2.0 - Photo Upload System (COMPLETED)
- ✅ Native photo upload with camera/gallery picker
- ✅ Supabase storage integration
- ✅ Client-side image optimization
- ✅ EXIF metadata stripping for privacy
- ✅ Progressive loading with retry mechanism
- ✅ Fixed image display issues in ProfileSheet

### v1.3.0 - Photo System Improvements Phase 1 (COMPLETED)
- ✅ Implemented expo-image for native caching
- ✅ Created unified CachedImage component
- ✅ Added image cache service with size management
- ✅ Unified loading states with shimmer effect
- ✅ Image preloading for visible nodes
- ✅ Fallback system for Supabase transformations
