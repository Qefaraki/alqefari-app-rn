# Alqefari Family Tree - Development Guide

## 📖 Documentation Index

### Core Systems
- **[Design System](docs/DESIGN_SYSTEM.md)** - Najdi Sadu color palette, typography, components
- **[Permission System](docs/PERMISSION_SYSTEM_V4.md)** - Family-based edit permissions & roles
- **[Field Mapping](docs/FIELD_MAPPING.md)** - RPC function field maintenance
- **[Migration Guide](docs/MIGRATION_GUIDE.md)** - Database migration details
- **[Soft Delete Pattern](docs/SOFT_DELETE_PATTERN.md)** - Soft delete & optimistic locking
- **[Undo System](docs/UNDO_SYSTEM_TEST_CHECKLIST.md)** - Activity log undo functionality
- **[Message Templates](docs/MESSAGE_TEMPLATE_SYSTEM.md)** - WhatsApp template system
- **[OTA Updates](docs/OTA_UPDATES.md)** - Over-the-air update deployment & rollback

### Perfect Tree System (PTS)
- **[PTS Documentation Hub](docs/PTS/README.md)** - Complete Perfect Tree System documentation
  - Phase 1: Component Extraction (18 modules, 6,635 lines)
  - Phase 2: Hook Extraction & Cleanup (288 lines)
  - Phase 3B: Progressive Loading (0.45 MB structure + viewport enrichment)
    - **[Test Plan](docs/PROGRESSIVE_LOADING_TEST_PLAN.md)** - 50+ test cases
    - **[Integration Checklist](docs/PROGRESSIVE_LOADING_INTEGRATION_CHECKLIST.md)** - Verification & deployment
    - **[Pitfalls & Solutions](docs/PROGRESSIVE_LOADING_PITFALLS.md)** - Self-view data completeness issue & prevention
  - Architecture, testing, audits, and daily logs

## ⚠️ IMPORTANT: Native RTL Mode is ENABLED

**The app runs in native RTL mode** (`I18nManager.forceRTL(true)` in index.js). This means:

- React Native automatically flips all layouts for Arabic
- DO NOT use `flexDirection: 'row-reverse'` - use normal `'row'`
- DO NOT use `textAlign: 'right'` for Arabic - use `'left'` or `'start'`
- DO NOT use `alignItems: 'flex-end'` - use `'flex-start'`
- Back buttons should use `chevron-back` (not forward)
- React Native handles all RTL transformations automatically

**Simply write layouts as if for LTR, and React Native flips them for RTL.**

## 🔑 Quick Permission Reference

### Who Can Edit What?

| User Type (Arabic Label) | Can Edit Directly | Can Suggest Edits | Special Powers |
|--------------------------|------------------|-------------------|----------------|
| **Super Admin** (المدير العام) | Everyone | N/A (direct edit) | Manage roles, assign moderators |
| **Admin** (مشرف) | Everyone | N/A (direct edit) | Approve suggestions, block users |
| **Branch Moderator** (منسق) | Their branch + descendants | Other profiles | Manage assigned subtree |
| **Regular User** (عضو) | Self, spouse, parents, siblings, all descendants | Everyone else | Create suggestions |

### Family Edit Rules for Regular Users
- ✅ **Direct Edit**: You, spouse, parents, siblings, children, grandchildren, all descendants
- 💡 **Suggest Only** (Manual Admin Approval): Grandparents, aunts, uncles, cousins, extended family
- 🚫 **Blocked**: No suggestions allowed if admin blocked you

### Finding the Features
- **Review Suggestions**: Admin Dashboard → Quick Actions → "مراجعة الاقتراحات"
- **Manage Permissions**: Admin Dashboard → Administrators → "إدارة الصلاحيات" (super admin only)
- **Suggest Edit**: Profile Sheet → Three dots menu (when not in admin mode)

### Admin Dashboard Access by Role

**Feature-Based System** (via `src/config/adminFeatures.js`): All admin roles (super_admin, admin, moderator) access dashboard. Features controlled by `requiredRoles` array.

**Key rule**: Add feature config to `ADMIN_FEATURES` registry → visibility auto-handled by `useFeatureAccess()` hook (no manual conditionals).

📖 Full feature matrix: [`/docs/REFERENCE_TABLES.md`](docs/REFERENCE_TABLES.md#admin-dashboard-access-by-role)
📖 Full docs: [`/docs/PERMISSION_SYSTEM_V4.md`](docs/PERMISSION_SYSTEM_V4.md)

## 🎨 Design System Quick Reference

**Najdi Sadu Design Language** - Culturally authentic, iOS-inspired design system.

### Core Colors
- **Al-Jass White** `#F9F7F3` - Primary background
- **Camel Hair Beige** `#D1BBA3` - Containers & cards
- **Sadu Night** `#242121` - All text
- **Najdi Crimson** `#A13333` - Primary actions
- **Desert Ochre** `#D58C4A` - Secondary accents

### Quick Rules
- **Typography**: iOS-standard sizes (17, 20, 22, 28, 34), SF Arabic font
- **Spacing**: 8px grid (8, 12, 16, 20, 24, 32)
- **Touch Targets**: 44px minimum
- **Shadows**: Max 0.08 opacity

_See full documentation: [`/docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)_

## 📱 Phone Number Change (Settings)

**Status**: ✅ Complete - Secure 4-step phone change with OTP verification

**Flow**:
1. Send OTP to current phone → Verify
2. Enter new phone → Send OTP to new phone → Verify
3. Complete change + audit log
4. Session remains valid (no forced re-login)

**Components**:
- **PhoneInputField**: `src/components/ui/PhoneInputField.js` (reusable, used in auth & settings)
- **PhoneChangeModal**: `src/components/settings/PhoneChangeModal.js` (4-step modal)
- **Service**: `src/services/phoneChange.js` (7 functions)
- **Migration**: `supabase/migrations/20251025000000_add_phone_change_support.sql`

**Key Implementation Details**:
- Uses Supabase Auth native flow (`auth.updateUser()` + `verifyOtp` with type: 'phone_change')
- **Profile phone** and **auth phone** are SEPARATE - no sync needed
- Dynamic OTP rate limit detection (not hardcoded "3 attempts")
- Audit logging to `audit_log_enhanced` with action_type='phone_change'
- Non-blocking logging (phone change succeeds even if audit log fails)
- Network guard on all OTP operations (offline protection)
- Resend button appears after OTP countdown expires
- RTL-compatible layouts with Arabic numerals support

**Usage (in Settings)**:
```
Settings → Account Management → "تغيير رقم الهاتف"
```

**Testing**:
- ✅ Basic 4-step flow
- ✅ Error handling (rate limits, invalid OTP, phone in use)
- ✅ RTL/Arabic numerals
- ✅ Session persistence
- ✅ Offline handling (network guard)
- ✅ OTP expiration & resend

## 🗑️ Delete Account (Settings)

**Status**: ✅ Complete - Secure 3-step deletion with OTP verification and rate limiting

**Flow**:
1. Settings → Advanced Settings (expand) → "حذف الحساب نهائياً"
2. Initial confirmation alert
3. OTP verification (sent to current phone)
4. Text confirmation (type "نعم" exactly)
5. Account deleted + global sign-out

**Components**:
- **DeleteAccountModal**: `src/components/settings/DeleteAccountModal.js` (3-stage modal)
- **Service**: `src/services/deleteAccountOtp.js` (send/verify OTP + rate limit check)
- **Migrations**: `supabase/migrations/20251026120000_update_delete_account_audit_log.sql`

**Key Implementation Details**:
- Hidden under collapsible "Advanced Settings" section (not immediately visible)
- OTP verification proves phone access (security layer)
- 10-minute OTP expiration window
- Rate limiting: 3 attempts per 24 hours with 24-hour lockout after 3rd attempt
- Session validation (5-minute freshness check before deletion)
- Concurrent deletion protection (prevents double-deletes)
- Edge case handling:
  - Root node protection (generation 1, no father)
  - Admin/moderator role warnings
  - Children in tree warnings
  - OTP expiration checks
  - Network offline protection (via network guard)
- Audit logging to `audit_log_enhanced` with action_type='account_deletion'
- Global sign-out (all sessions invalidated, not just current)
- Profile unlinking (user_id → NULL, can_edit → false)
- Full RTL/Arabic support with Najdi Sadu design system

**Data Deletion Details**:
- ❌ Profile data DELETED: user_id link, admin access, notifications, requests
- ✅ Profile data RETAINED: Names, dates, photos (preserves family history)
- Profile becomes read-only (can_edit = false) but remains visible in tree

**Usage (in Settings)**:
```
Settings → "إظهار الإعدادات المتقدمة" → "حذف الحساب نهائياً"
```

**Testing**:
- ✅ Collapsible section expand/collapse
- ✅ Rate limiting (3 attempts, lockout, retry time display)
- ✅ OTP send and verification (correct/incorrect codes)
- ✅ Text input validation (requires exact "نعم")
- ✅ Edge cases (root node, admin role, children in tree)
- ✅ OTP expiration and resend
- ✅ Session validation
- ✅ Global sign-out execution
- ✅ RTL/Arabic numerals support
- ✅ Network offline protection

**Commit**: `65abafa4a` - "feat(delete-account): Implement secure 3-step account deletion with OTP verification"

## 📑 SegmentedControl Component Quick Ref

**Status**: ✅ Complete - Standard iOS pill-style tabs

**Usage**:
```javascript
<SegmentedControl
  options={[{ id: 'pending', label: 'قيد المراجعة' }]}
  value={activeTab}
  onChange={setActiveTab}
/>
```

✅ Full RTL support | Used in 7+ components
📖 Full docs: [`/docs/components/SEGMENTED_CONTROL.md`](docs/components/SEGMENTED_CONTROL.md)

## 🎯 Gesture System Architecture

**Status**: ✅ Complete (October 2025) - 134 tests, 100% pass rate

**Flow**: Touch → GestureHandler → HitDetection → TreeView callback → State update

**Core modules**: `GestureHandler.ts`, `HitDetection.ts`, `SelectionHandler.ts`

**Key pattern**: Memoized callbacks + coordinate transformation + permission checks

📖 Full docs: [`/docs/architecture/GESTURE_SYSTEM.md`](docs/architecture/GESTURE_SYSTEM.md)

## 🔧 Progressive Loading Cache Fix (October 26, 2025)

**Status**: ✅ Deployed - Migration applied, schema version bumped, hooks ready

**Problem Solved**: Profile edits disappearing after app restart
- Root cause: `get_structure_only()` RPC didn't return `version` field
- Non-enriched nodes had `version: undefined`
- Editing these nodes → `admin_update_profile` RPC rejected (missing p_version)
- AsyncStorage cache never invalidated → stale data loaded on restart

**Solution Implemented**:

### 1. Migration: Add version field to structure RPC ✅
**File**: `supabase/migrations/20251026000000_add_version_to_structure_only_rpc.sql`
- Added `version INT` to RPC returns
- All nodes now have version from initial structure load
- Impact: +12KB structure size (2.6% increase), negligible performance cost
- Status: **Deployed & Tested** ✅

### 2. Schema Version Bump ✅
**File**: `src/components/TreeView/hooks/useStructureLoader.js` (line 23)
- Changed: `TREE_STRUCTURE_SCHEMA_VERSION = '1.0.0'` → `'1.1.0'`
- Effect: Forces one-time cache invalidation on next app start
- Status: **Deployed** ✅

### 3. Enrich-on-Edit Hook (Ready to integrate) ⏳
**File**: `src/hooks/useEnsureProfileEnriched.js` (NEW)
- Purpose: Enrich non-enriched nodes before allowing edits
- Prevents editing nodes with `version: undefined`
- No-op if already enriched (zero performance cost)
- **Integration task**: Add hook to ProfileSheet/edit screens:
  ```javascript
  import { useEnsureProfileEnriched } from '../hooks/useEnsureProfileEnriched';

  export function EditScreen({ profile }) {
    useEnsureProfileEnriched(profile);  // ← Add this line
    // ... rest of component
  }
  ```

### 4. Cache Utilities (Manual use only) ✅
**File**: `src/utils/cacheInvalidation.js` (NEW)
- Functions: `invalidateStructureCache()`, `forceTreeReload()`, `debugCacheStatus()`
- Purpose: Manual debugging & maintenance only
- Not called automatically (preserves cache for performance)

**Architecture**: Enrich-on-edit pattern vs smart cache invalidation
- ✅ Fixes root cause (missing version) not symptom (stale cache)
- ✅ Works with all edit entry points (search, tree, admin)
- ✅ Aligns with Progressive Loading Phase 3B design
- ✅ Zero performance impact when already enriched

**Testing checklist**:
- ✅ Migration deployed & RPC returns version field
- ✅ Schema version bumped (1.0.0 → 1.1.0)
- ✅ Cache invalidates on next app start
- ⏳ Hook integrated into edit screens (next task)
- ⏳ Manual testing on device

**Commit**: `66a504bff` - "fix(progressive-loading): Add version field to structure RPC and enrich-on-edit hook"

📖 Full details: See commit message and migration file documentation

## 📱 Development Commands

```bash
# Development
npm start          # Expo dev server
npm run ios        # iOS simulator
npm run android    # Android emulator
```

### Database Operations (MCP Only)
- **Queries**: Use `mcp__supabase__execute_sql`
- **Migrations**: Use `mcp__supabase__apply_migration`
- **Schema**: Use `mcp__supabase__list_tables`

## 📱 iOS URL Schemes Configuration

**⚠️ IMPORTANT**: iOS 9+ requires URL schemes to be declared before using `Linking.canOpenURL()`.

**Declared URL Schemes** (via `app.json → expo.ios.infoPlist.LSApplicationQueriesSchemes`):
- **`whatsapp`** - WhatsApp deep linking (`whatsapp://send?phone=...`)
- **`tel`** - Phone call links (`tel:` URLs)
- **`https`** - Web fallbacks for WhatsApp (`https://wa.me/...`)

**Critical Notes:**
- URL schemes MUST be declared in `app.json`, NOT in `ios/Alqefari/Info.plist` directly
- Direct Info.plist edits get overwritten on `expo prebuild`
- Changes require **native rebuild** (not OTA-updatable)
- Required by iOS for `Linking.canOpenURL()` queries

**Adding New URL Schemes:**
1. Add to `expo.ios.infoPlist.LSApplicationQueriesSchemes` array in `app.json`
2. Run `eas build --platform ios` or `npx expo prebuild --clean`
3. Test with both `Linking.canOpenURL()` and `Linking.openURL()`
4. Verify in `ios/Alqefari/Info.plist` after prebuild

**Example:**
```json
"ios": {
  "infoPlist": {
    "LSApplicationQueriesSchemes": ["whatsapp", "tel", "https", "instagram"]
  }
}
```

**Common Error:**
```
Error: Unable to open URL: whatsapp://... Add whatsapp to LSApplicationQueriesSchemes
```
**Solution:** Add missing scheme to `app.json` and rebuild.

## 📱 QR Code & Deep Linking System

**Status**: 🚨 Security Fixes Required - B+ (87/100)
**Last Updated**: October 27, 2025
**Feature Flag**: `enableDeepLinking: __DEV__` (dev-only, not production)

**Quick Summary**: Production-grade QR code sharing with deep linking, but **requires 3 critical security fixes** before enabling in production.

### Core Features
- **Smart QR Generation**: 3-tier logo fallback (profile photo → emblem → plain)
- **Deep Linking**: Custom scheme (`alqefari://profile/H12345`) + universal links ready
- **10 Safety Checks**: Own profile detection, network check, permission validation, etc.
- **Analytics**: Tracks QR scans, link copies, WhatsApp shares via `profile_share_events` table
- **Platform Support**: iOS + Android with proper intent filters

### Key Files
- `src/components/sharing/ProfileQRCode.js` - QR generation with smart logo
- `src/components/sharing/ShareProfileSheet.js` - Share UI modal
- `src/utils/deepLinking.ts` - Link parsing and deep link handler (10 safety checks)
- `src/services/profileSharing.ts` - Share methods (copy, WhatsApp, native)
- `app/_layout.tsx` lines 79+ - Deep link event listeners (cold + warm start)
- `supabase/migrations/20251027000001_create_profile_share_events.sql` - Analytics table

### 🚨 Critical Security Issues (MUST FIX)

**Solution Auditor Grade**: B+ (87/100) - Down from self-assessed A- (92/100)

**Blockers for Production**:
1. **Analytics RLS Too Permissive**: `WITH CHECK (true)` allows ANY user to insert fake analytics data
   - **Risk**: Spam, corrupted metrics, database bloat
   - **Fix**: Require authenticated user + validate profile_id/sharer_id exist

2. **No Rate Limiting**: Users can scan unlimited QR codes
   - **Risk**: Analytics spam, DoS via database load
   - **Fix**: Add per-user rate limit (20 scans per 5 minutes)

3. **Unsanitized Image.prefetch()**: PhotoUrl not validated before prefetch
   - **Risk**: Potential file:// or data: URI exploitation
   - **Fix**: Validate photoUrl starts with `https://` before prefetch

### Medium Risks
- Global debounce (1-sec cooldown shared across all users in household)
- No enrichment timeout (can hang indefinitely on slow network)
- Feature flag disabled (not in production despite "production-ready" claim)

### Next Steps (Once Security Fixed)
1. Apply security fixes (RLS policy, rate limiting, URL validation)
2. Manual testing on physical devices (iOS + Android)
3. Enable production feature flag: `enableDeepLinking: true`
4. Deploy via OTA: `npm run update:production`
5. Monitor `profile_share_events` table for spam/abuse (first 48 hours)

### Usage
```javascript
// Generate QR code
<ProfileQRCode hid="H12345" photoUrl={profile.photo_url} />

// Share profile
<ShareProfileSheet
  visible={true}
  profile={profile}
  mode="share"  // or "invite"
  onClose={() => setVisible(false)}
/>
```

📖 **Full Documentation**: [`/docs/QR_CODE_DEEP_LINKING.md`](docs/QR_CODE_DEEP_LINKING.md) (528 lines)
🔒 **Security Audit**: Solution auditor report shows 3 critical fixes required before production

## 👥 Munasib Management System

Full management dashboard for Munasib (spouse) profiles:
- Search & filter by name, phone, location
- Family statistics (most common origins)
- Marriage connections

**Location**: `src/components/admin/MunasibManager.js` (Admin Dashboard)
**Identifying**: `profile.hid === null` (Munasib have NULL HID)

## 🏗 Project Structure

```
src/
├── components/      # Reusable UI components
│   ├── ui/         # Design system components
│   ├── admin/      # Admin-only features
│   └── TreeView/   # Phase 1: Modular tree architecture
│       ├── utils/       # Extracted constants & utilities
│       │   ├── constants/  # Viewport, nodes, performance (29 constants)
│       │   ├── colorUtils.ts  # Hex, grayscale, dimming (4 functions)
│       │   └── performanceMonitor.ts  # Layout tracking singleton
│       ├── types/       # TypeScript definitions (25 interfaces)
│       └── theme/       # Design tokens (Phase 3)
├── screens/        # App screens
├── services/       # API & Supabase
├── stores/         # Zustand state management
└── config/         # App configuration
```

## 🌳 TreeView Consolidated Node Constants (October 25, 2025)

**Status:** ✅ Complete & Audited
**Grade:** A- (92/100) - Fixed all audit recommendations
**Consolidation:** Eliminated 31px d3/renderer delta, single source of truth

### Node Constants - Central Registry

**Location:** `src/components/TreeView/rendering/nodeConstants.ts`

**Standard Node (Regular zoom):**
- Width: **58px** (50px photo + 4px padding × 2)
- Height: **75px** (photo) / 35px (text-only)
- Padding: 4px horizontal, 4px vertical (follows 8px Design System grid)
- Selection border: 2.5px (Najdi Crimson #A13333)
- Corner radius: 10px

**Root Node (Generation 1, no father):**
- Width: 120px, Height: 100px
- Border radius: 20px (extra rounded)
- Selection border: 2.5px

**G2 Parent (Generation 2 with children):**
- Width: 95px (photo) / 75px (text-only)
- Height: 75px (photo) / 35px (text-only)
- Border radius: 16px
- Selection border: 2px

**Text Pill (LOD Tier 2):**
- Width: 58px (matches standard photo nodes)
- Height: 26px
- Corner radius: 4px

**Import Path:**
```javascript
import {
  STANDARD_NODE,
  ROOT_NODE,
  NODE_WIDTH_WITH_PHOTO,  // Legacy: 58px
  NODE_HEIGHT_WITH_PHOTO, // Legacy: 75px
} from './TreeView/rendering/nodeConstants';
```

**Key Design Fixes:**
- ✅ Follows 8px Design System grid (4px padding minimum)
- ✅ Unified d3 layout and renderer (both use 58px)
- ✅ Selection border fits within padding (2.5px < 4px)
- ✅ Single source of truth (17% width reduction from 65px)
- ✅ 66 unit tests passing, 11 integration tests passing

### Phase 1 Refactor (October 2025)

**Status:** ✅ Complete (5 days, 27 hours)
**Grade:** 98/100 (A+)
**Commits:** 7 atomic commits, 4 checkpoint branches

Phase 1 extracted utilities, constants, and types from the monolithic TreeView.js (3,817 lines) into a modular architecture with zero regressions and comprehensive test coverage.

### Quick Reference

**Utilities Available:**
- 29 constants (viewport, nodes, performance)
- 4 color functions (hexToRgba, createGrayscaleMatrix, createDimMatrix, interpolateColor)
- 1 performance monitor (logLayoutTime, logRenderTime, logMemory)

**Import Path:**
```javascript
import {
  VIEWPORT_MARGIN_X,
  NODE_WIDTH_WITH_PHOTO,
  hexToRgba,
  performanceMonitor,
} from './TreeView/utils';
```

**Test Coverage:** 77 total tests (100% passing)
- 39 NodeRenderer unit tests
- 27 TextPillRenderer unit tests
- 11 Tree Layout integration tests

**Performance Impact:** +2.3% layout time, +2% memory (within 5% tolerance)

**Full Documentation:** [`/docs/treeview-refactor/phase1/`](docs/treeview-refactor/phase1/README.md)
- Quick Start & Architecture
- Usage Examples & Import Guides
- Test Results & Performance Data

## 🔄 Batch Operations & Version Control

**Pattern**: All multi-profile updates use batch RPCs with version validation

**Critical Rules**:
- ✅ Always include `version` field in SELECT queries
- ✅ Use `version ?? 1` fallback for null/undefined
- ✅ Batch RPCs > RPC loops (atomicity + 10-25x performance)
- ❌ NEVER use direct `.update()` for multi-row changes (no version check = data corruption)
- ❌ NEVER loop RPC calls from frontend (partial failure risk + slow)

**Example - Reorder Children with Version Validation**:

```javascript
// ✅ CORRECT: Single batch RPC call (atomic + version-safe)
const reorderOps = children.map((child, index) => ({
  id: child.id,
  new_sibling_order: index,
  version: child.version ?? 1  // Handles null/undefined
}));

const { data, error } = await supabase.rpc('admin_batch_reorder_children', {
  p_reorder_operations: reorderOps,
  p_parent_id: parentId
});

if (error?.message.includes('version')) {
  Alert.alert('خطأ', 'تم تحديث البيانات من قبل مستخدم آخر');  // Version conflict
  loadChildren();  // Reload to sync
  return;
}
```

**RPC Features**:
- Optimistic locking via version field
- Single parent permission check (not N+1 loop per child)
- Advisory lock prevents concurrent operations
- Operation group integration for grouped undo
- Comprehensive input validation (empty, duplicates, negatives, parent-child)
- Version increment after successful update
- Performance: <200ms for 50 children

📖 Full documentation: [`/docs/FIELD_MAPPING.md`](docs/FIELD_MAPPING.md#-batch-operations-pattern) (Batch Operations section)

## ⚡ TreeView Performance (Photo Update Freeze Fix)

**Status**: ✅ Fixed (October 27, 2025)

**Problem**: Photo changes caused 200-500ms freeze
**Solution**: O(n²)→O(1) prefetch + smart update path
**Result**: 96% faster (500ms → <20ms)

📖 Full docs: [`/docs/TREEVIEW_PERFORMANCE_OPTIMIZATION.md`](docs/TREEVIEW_PERFORMANCE_OPTIMIZATION.md)

## 🖼️ BlurHash Implementation (Image Placeholders)

**Status**: 🚧 Day 1 Backend (80% Complete) - October 27, 2025
**Purpose**: Show smooth blurred image placeholders while real photos load
**Timeline**: 10 mins remaining (Day 1) + 8 hours (Day 2 frontend)

**What It Is**: BlurHash generates a tiny ~25-character string representing a blurred version of an image. Used by Twitter, Medium, Unsplash for instant placeholder rendering.

**Example**:
```
Photo URL: https://.../profile-photo.jpg
BlurHash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj"  ← 25 chars
         ↓ decodes instantly ↓
     [Smooth blur preview] ← Shows while real photo loads
```

### Day 1 Backend (80% Complete)

**✅ Completed**:
- Database migration applied: Added `blurhash TEXT` column to profiles table
- RPC updated: `get_structure_only()` now returns blurhash (15th field)
- Edge Function created: `supabase/functions/generate-blurhash/index.ts`
  - Uses sharp@0.33.0 for image processing
  - Generates 32×32 blurhash (4x3 components)
- Batch script created: `scripts/generate-blurhashes-batch.ts`
  - Processes 68 existing photos in parallel (5 at a time)
  - Automatic retry, estimated 20 seconds runtime

**❌ Remaining (10 Minutes)**:
1. Deploy Edge Function via Supabase CLI: `npx supabase functions deploy generate-blurhash`
2. Run batch script: `npx ts-node scripts/generate-blurhashes-batch.ts`
3. Verify: `SELECT COUNT(*) FROM profiles WHERE blurhash IS NOT NULL;` (expect 68)

### Day 2 Frontend (Pending)

**Tasks (8 Hours Estimated)**:
1. Install `react-native-blurhash` native library
2. Create separate blurhash cache in `skiaImageCache.ts`
3. Integrate blurhash placeholders in TreeView node renderer
4. Bump schema version to 1.2.0 in `useStructureLoader.js` (forces cache invalidation)
5. Test on physical devices (blur → photo transition)

### Why BlurHash?

**Before BlurHash**:
```
[White box] → [Photo loads] (0-3 seconds, jarring)
```

**After BlurHash**:
```
[Instant blur preview] → [Photo fades in] (smooth, perceived performance)
```

**Benefits**:
- Improves perceived performance (no white boxes during loading)
- Tiny data size (~25 chars vs 50KB+ for real image)
- Works with Progressive Loading (blurhash in structure, photos on-demand)
- Industry-standard (BlurHash algorithm open-source)

### Key Files
- `supabase/migrations/20251027000000_add_blurhash_to_profiles_and_structure_rpc.sql` - DB schema
- `supabase/functions/generate-blurhash/index.ts` - Edge Function (NOT DEPLOYED)
- `scripts/generate-blurhashes-batch.ts` - Batch processor (NOT RUN)

### Next Steps
1. Deploy Edge Function (5 mins)
2. Run batch script (2-3 mins)
3. Continue to Day 2 frontend integration (8 hours)

📖 **Full Documentation**: [`/docs/BLURHASH_DAY1_COMPLETION.md`](docs/BLURHASH_DAY1_COMPLETION.md)

**Note**: BlurHash is **separate** from QR code work (different feature, happened same day).

## 🔑 Key Implementation Rules

### RTL Support
- All layouts must work in RTL
- Use `flexDirection: "row"` with proper RTL handling
- Test with Arabic content

### State Management
```javascript
// Single source of truth
const { nodes, updateNode } = useTreeStore();
```

### Error Handling
```javascript
if (error) {
  Alert.alert("خطأ", handleSupabaseError(error));
}
```

### Performance
- Branch-based loading (max depth 3-5)
- Viewport culling for visible nodes
- Debounce real-time subscriptions

### Tree Loading Limits

**Current Configuration:**
- **Database Max**: 10,000 profiles (safety buffer, supports design capacity)
- **Frontend Load**: 5,000 profiles (supports 3K incoming + 67% buffer)
- **Warning Threshold**: 3,750 profiles (75%)
- **Critical Threshold**: 4,750 profiles (95%)

**How It Works:**
- Tree uses viewport culling to render only visible nodes (~500 max)
- Database supports up to 10K profiles (matching original design intent)
- Frontend loads 5K profiles - viewport culling handles rendering efficiently
- Monitoring logs warn when approaching limits
- **Rendering performance: 60fps regardless of dataset size**

**Monitoring Tree Size:**
```javascript
// Check console on tree load
// ✅ Tree loaded: X profiles
// ⚠️ Approaching limit: 3750/5000 profiles. Consider increasing limit.
// 🚨 CRITICAL: 4750/5000 profiles. Immediate action required.

// Check tree size programmatically
console.log(useTreeStore.getState().treeData.length);
```

**When to Increase Limit or Implement Progressive Loading:**
- Tree size exceeds 4,500 profiles (90% of limit)
- Load times exceed 2 seconds on iPhone XR
- Memory usage exceeds 20MB for tree data
- User complaints about slow loading

**Performance Expectations:**
| Profiles | Load Time | Memory | Rendering | Status |
|----------|-----------|--------|-----------|--------|
| Current Size | <200ms | ~0.5MB | 60fps | ✅ Optimal |
| 2,000 | ~650ms | ~6MB | 60fps | ✅ Good |
| 3,000 (target) | ~950ms | ~9MB | 60fps | ✅ Good |
| 5,000 (limit) | ~1.3s | ~15MB | 60fps | ✅ Acceptable |
| 7,500 | ~1.6s | ~22MB | 60fps | ⚠️ Consider testing |

## 🚀 Best Practices

1. **Always use the color palette** - Never hardcode colors
2. **Follow the 8px grid** - All spacing must be multiples of 8
3. **Keep shadows subtle** - Max 0.08 opacity
4. **Use semantic naming** - `primaryButton` not `blueButton`
5. **Test on real devices** - Especially for RTL and gestures
6. **Commit atomically** - One feature per commit

## 📝 Git Workflow & Version Control

### CRITICAL: Always Save Your Work

```bash
# After EVERY feature/fix - commit immediately
git add -A
git commit -m "type: Clear description of changes"

# Commit types:
# feat: New feature
# fix: Bug fix
# docs: Documentation updates
# style: UI/styling changes
# refactor: Code restructuring
# test: Test additions/changes
```

### Git Best Practices
1. **Commit frequently** - After each working feature
2. **Never lose work** - Commit before switching tasks
3. **Clear messages** - Describe WHAT and WHY
4. **Update docs** - If you change functionality, update docs
5. **Check status** - `git status` before and after changes

### Documentation Updates
When you change code, update:
- `CLAUDE.md` - For design/system changes
- `README.md` - For major features
- Component comments - For complex logic

## ⚠️ Database Migrations

### CRITICAL: Use MCP Only

**All migrations use `mcp__supabase__apply_migration`. No CLI, no alternatives.**

Migration naming: `snake_case_descriptive_name`

### 🚨🚨🚨 CRITICAL: ALWAYS WRITE THE FILE FIRST! 🚨🚨🚨

**⚠️ INCIDENT REPORT: On Oct 18, 2025, violating this workflow caused 44+ profiles to have incorrect sibling_order values, requiring full database revert and system redesign. DO NOT REPEAT THIS MISTAKE!**

**NEVER apply a migration without saving the .sql file to the repo!**

The MCP tool `mcp__supabase__apply_migration` executes SQL directly on the database but **DOES NOT save the file to the filesystem**. This creates a critical problem:

---

## ❌ WRONG WORKFLOW (Database has it, repo doesn't):

```bash
1. mcp__supabase__apply_migration  # ❌ Applied to DB only
2. Code uses the new RPC           # ✅ Works locally
3. Git commit                      # ❌ Migration file not tracked!
```

**RESULT**:
- ✅ Works for you temporarily
- ❌ Breaks for everyone else
- ❌ Not in version control
- ❌ Can't reproduce on other environments
- ❌ Can't rollback easily
- ❌ Loses audit trail

---

## ✅ CORRECT WORKFLOW (Both database and repo have it):

```bash
1. Write tool → supabase/migrations/YYYYMMDDHHMMSS_name.sql  # ✅ Save file FIRST!
2. mcp__supabase__apply_migration with same SQL              # ✅ Apply to DB
3. Test the feature                                          # ✅ Verify it works
4. Git commit                                                # ✅ File is tracked
```

**RESULT**:
- ✅ Works for everyone
- ✅ Tracked in git
- ✅ Deployable to all environments
- ✅ Can rollback if needed
- ✅ Full audit trail

---

## 📋 Pre-Commit Checklist (MANDATORY)

Before **EVERY** `git commit`:

- [ ] If commit message mentions "migration", verify `.sql` files are staged
- [ ] Run `git status` and check for untracked `.sql` files in `supabase/migrations/`
- [ ] If adding RPC/schema changes, confirm migration file exists
- [ ] If using MCP tools, confirm corresponding `.sql` file was written FIRST

**Visual Check**:
```bash
# BEFORE committing, always run:
git status | grep "supabase/migrations"

# If you see "Untracked files" with .sql in the name → ADD THEM!
# If commit mentions "migration" but no .sql files → STOP! Create the file first!
```

---

## 🚫 Pre-Commit Hook Protection

A git pre-commit hook has been added (`.git/hooks/pre-commit`) that automatically checks:
- If commit message contains "migration"
- If any `.sql` files are being committed
- **Blocks the commit** if migration is mentioned but no `.sql` files found

To bypass (NOT recommended): `git commit --no-verify`

---

📖 **Incident Report**: See [`/docs/reports/MIGRATION_INCIDENT_OCT2025.md`](docs/reports/MIGRATION_INCIDENT_OCT2025.md) - Oct 18 incident with 44 affected families, now prevented by this system.

---

## ⚠️ CRITICAL: The Opposite Workflow Violation (Oct 25, 2025)

**New incident**: Three migration files existed in the repo but were **NEVER APPLIED TO THE DATABASE**.

This caused:
- ✅ Code expected `version` field on profiles
- ❌ Database returned profiles WITHOUT `version` field
- ❌ Result: "Person object missing version field" errors

**Key insight**: The problem isn't always "DB has it but repo doesn't". It can also be "repo has it but DB doesn't"!

### ✅ CORRECT MIGRATION WORKFLOW (MANDATORY)

```javascript
// Step 1: Write migration SQL file FIRST
Write migration file → supabase/migrations/YYYYMMDDHHMMSS_name.sql

// Step 2: IMMEDIATELY apply to database (within 5 minutes!)
await mcp__supabase__apply_migration({
  name: "fix_name",
  query: <content of .sql file>
});

// Step 3: TEST in database (verify field/RPC exists)
SELECT id, version FROM get_branch_data(NULL, 1, 1);

// Step 4: TEST in app (verify frontend receives field)
// Check console logs, inspect objects

// Step 5: ONLY THEN commit to git
git add supabase/migrations/YYYYMMDDHHMMSS_name.sql
git commit -m "migration: Add version field to RPC"
```

### 🚨 RED FLAGS (STOP IMMEDIATELY)

- ❌ You wrote a migration file but haven't applied it yet
- ❌ Commit message mentions "migration" but RPC doesn't have new field in database
- ❌ Code uses a field that doesn't exist in database RPC
- ❌ RPC signature changed but old function still exists
- ❌ "function is not unique" error (conflicting overloads)

### 🔍 VERIFICATION CHECKLIST

After writing ANY migration:

```javascript
// 1. Verify file exists
ls -la supabase/migrations/YYYYMMDDHHMMSS*.sql

// 2. Verify function/table exists in database
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'your_rpc_name';

// 3. Test the RPC returns expected fields
SELECT id, your_new_field FROM your_rpc();
// Should NOT return error about missing field

// 4. Check frontend doesn't break
// Restart app, check console, verify object structure
```

### 📝 Pre-Migration Checklist

Before EVERY migration:
- [ ] Is this adding a new field to profiles? → Update ALL RPCs that return profiles
- [ ] Is this creating a new RPC? → Test it immediately in database
- [ ] Are you modifying an existing RPC? → Check for old overloaded versions
- [ ] Did you write the .sql file? → Apply to DB within 5 minutes
- [ ] Did you test in database? → Verify field appears in RPC results
- [ ] Did you test in app? → Verify frontend can access field
- [ ] **Are there old versions of this RPC?** → Drop them to avoid "not unique" errors

---

## 🛠️ Tool Usage Constraints

### CRITICAL: Backend Operations = MCP Only

**All backend operations MUST use Supabase MCP tools. No alternatives.**

- ✅ Database queries → `mcp__supabase__execute_sql`
- ✅ Migrations → `mcp__supabase__apply_migration`
- ✅ Schema inspection → `mcp__supabase__list_tables`
- ❌ NO Bash/psql/supabase CLI for queries
- ❌ NO direct database connections
- ❌ NO workarounds or alternatives

If MCP fails: Tell user what needs to be done, then wait.

## 🔒 Security

- Never expose service role keys
- Use RPC functions for admin operations
- Implement row-level security (RLS)
- Validate all inputs

## 👥 Permission System v4.3 (Simplified)

**📖 Full Documentation**: [`/docs/PERMISSION_SYSTEM_V4.md`](docs/PERMISSION_SYSTEM_V4.md)

**Status**: ✅ Deployed and operational (January 2025)

**Major Update**: Removed 48-hour auto-approve complexity. All suggestions now require manual admin approval for simpler, more transparent workflow.

### Quick Reference

| Permission Level | Edit Rights | Example Relationships |
|-----------------|-------------|---------------------|
| `admin` | Direct edit | Super admin or admin role |
| `moderator` | Direct edit | Branch moderator for assigned subtree |
| `inner` | Direct edit | Self, spouse, parents, children, siblings, descendants |
| `suggest` | Suggest only (manual approval) | Grandparents, aunts, uncles, cousins, extended family |
| `blocked` | None | Explicitly blocked users |
| `none` | None | Not related to target profile |

### Key Function
```javascript
const { data: permission } = await supabase.rpc('check_family_permission_v4', {
  p_user_id: userProfile.id,   // IMPORTANT: Use profiles.id, NOT auth.users.id
  p_target_id: targetProfile.id
});
// Returns: 'admin', 'moderator', 'inner', 'suggest', 'blocked', or 'none'
```

### User Roles (Updated Arabic Labels)
- **super_admin** (المدير العام) - Manages roles, assigns moderators
- **admin** (مشرف) - Reviews suggestions, blocks users
- **moderator** (منسق) - Manages assigned family branch
- **user** (عضو) - Standard family member (permission based on relationship)

### Permission Manager (January 2025)

**Status**: ✅ Deployed and operational

**Location**: Admin Dashboard → Administrators → "إدارة الصلاحيات"

Complete refactoring for improved UX and performance:

**Features:**
- ✅ **Skeleton Loading** - No loading flash, optimistic rendering with 6 skeleton cards
- ✅ **Search Overlay** - Keeps data visible during search with subtle overlay indicator
- ✅ **iOS Segmented Control** - Filter by role: الكل, مدير رئيسي, مدير, مشرف
- ✅ **Pagination** - Simple prev/next buttons with page counter (50 users per page)
- ✅ **Pull-to-Refresh** - Najdi Crimson spinner
- ✅ **3 Empty States** - Initial state, empty search, empty filter
- ✅ **Optimized RPC** - Single `admin_list_permission_users()` query replaces 4 separate queries

**Performance:**
- **Before**: 4 separate Supabase queries per search (~600-800ms)
- **After**: 1 optimized RPC query (~150-250ms)
- **Improvement**: 70% faster search, reduced database load

**Backend:**
- Migration: `20251016120000_admin_list_permission_users_v2.sql`
- RPC: `admin_list_permission_users(p_search_query, p_role_filter, p_limit, p_offset)`
- Returns: photo_url, generation, professional_title, title_abbreviation, total_count
- Indexes: `idx_profiles_role`, `idx_profiles_user_id`

**UX Improvements:**
- Role check shows full page skeleton instead of lock screen flash
- Search loading keeps existing data visible with overlay
- Filter-specific empty states guide user actions
- Professional titles displayed throughout
- Avatar with colored circles for users without photos
- Generation badges (الجيل الأول, الثاني, etc.)

_See full documentation: [`/docs/FIELD_MAPPING.md`](docs/FIELD_MAPPING.md) (Helper Functions section)_

## 🗄️ Database Migrations

**📖 Full Documentation**: [`/docs/MIGRATION_GUIDE.md`](docs/MIGRATION_GUIDE.md)

### Critical Migrations Quick Reference

| Migration | Purpose | Status |
|-----------|---------|--------|
| **005** | Family Edit Permissions System | ✅ Deployed |
| **006** | Super Admin Permissions | ✅ Deployed |
| **077** | Admin Update Marriage RPC | ✅ Deployed |
| **078** | Marriage Status Simplification (current/past) | ✅ Deployed |
| **083** | Optimized Mother Picker Query | ✅ Deployed |
| **084a** | Batch Permission Validator | ✅ Deployed |
| **084b** | Cascade Soft Delete | ✅ Deployed |
| **20251014120000** | Undo System (initial) | ✅ Deployed |
| **20251015010000-050000** | Undo Safety Mechanisms (5 migrations) | ✅ Deployed |
| **20251015040000** | Operation Groups Integration | ✅ Deployed |
| **20251016120000** | Permission Manager Optimized RPC | ✅ Deployed |
| **20250116000000** | Simplified Permission System (v4.3) | ✅ Deployed |

### Field Mapping Checklist

When adding a **new column** to `profiles` table:
- [ ] `ALTER TABLE profiles ADD COLUMN`
- [ ] Update `get_branch_data()` - RETURNS TABLE + all SELECT statements
- [ ] Update `search_name_chain()` - RETURNS TABLE + all SELECT statements
- [ ] Update `admin_update_profile()` - whitelist
- [ ] Test in app - verify field persists

_See full documentation: [`/docs/FIELD_MAPPING.md`](docs/FIELD_MAPPING.md)_

### Deployment
Use `mcp__supabase__apply_migration` only. No CLI commands.

## 🗑️ Soft Delete Pattern Quick Ref

**Pattern**: Sets `deleted_at` timestamp (audit trail) + optimistic locking with `version` field

**Key Functions**:
- `admin_update_profile()` (requires `p_version`)
- `admin_cascade_delete_profile()` (with safety checks)

⚠️ **Critical**: Always include `p_version` parameter to prevent concurrent edit conflicts

📖 Full docs: [`/docs/SOFT_DELETE_PATTERN.md`](docs/SOFT_DELETE_PATTERN.md)

## 🔄 Undo System Quick Ref

**Status**: ✅ Deployed (7 migrations, 100% safe)

**System**: Audit log with version checking + idempotency protection + advisory locking

**Action Types**: `profile_update`, `profile_soft_delete`, `profile_cascade_delete`, `add_marriage`

**Limits**: 30 days for users, unlimited for admins

**Safety**: Version conflict prevention + parent validation + idempotency + operation groups

📖 Full docs: [`/docs/UNDO_SYSTEM_TEST_CHECKLIST.md`](docs/UNDO_SYSTEM_TEST_CHECKLIST.md) | Action types: [`/docs/REFERENCE_TABLES.md`](docs/REFERENCE_TABLES.md#undo-system---supported-action-types)

## 📰 News Screen Additions (January 2025)

- Added Najdi Sadu color tokens to `src/components/ui/tokens.js`
- Cached WordPress news service (`src/services/news.ts`) with 24h TTL
- Reusable news UI primitives (FeaturedNewsCarousel, NewsCard, RecentArticleItem)
- NewsScreen with Gregorian/Hijri headers, infinite scroll, shimmer loading

## 🚀 Over-The-Air (OTA) Updates Quick Ref

**Deploy JS/styling changes to users in minutes** (no App Store review)

**✅ Can update OTA**: JavaScript logic, styling, colors, text, UI layouts, Supabase calls
**❌ Cannot OTA**: Native modules, permissions, SDK upgrades, app icon

**Key commands**:
```bash
npm run update:preview -- --message "Fix"  # Test with admin team
npm run update:production -- --message "Fix" # Deploy to all users
npm run update:rollback                     # Emergency undo
```

**Decision**: Native code changed? → Rebuild + App Store (days) | JS/styling? → OTA (minutes)

📖 Full docs: [`/docs/OTA_UPDATES.md`](docs/OTA_UPDATES.md)

---

## 📱 Message Templates Quick Ref

**System**: Registry-based WhatsApp templates with dynamic variable replacement

**Usage**: `await openWhatsApp('template_id', profile)` auto-fills `{name_chain}`, `{phone}`, `{hid}`

**Admin**: Admin Dashboard → "قوالب الرسائل" | Location: `templateRegistry.ts`

📖 Full docs: [`/docs/MESSAGE_TEMPLATE_SYSTEM.md`](docs/MESSAGE_TEMPLATE_SYSTEM.md)

## 📊 Progressive Loading (Phase 3B) Quick Ref

**Status**: 🔄 Active Development - Feature Iteration

**Strategy**: Two-phase loading - structure (0.45 MB) + viewport enrichment

**Benefits**:
- 89.4% data reduction (0.45 MB vs 4.26 MB)
- <500ms initial load time (vs ~800ms full tree)
- Zero jumping (d3 layout determinism)
- Progressive photos as user scrolls

**Current State**:
- ✅ Enabled in production (`USE_PROGRESSIVE_LOADING = true`)
- ✅ Core testing completed
- 🔄 Iterating on additional features

**Architecture**:
- **Phase 1**: Load structure (RPC: `get_structure_only()`) → <500ms
- **Phase 2**: Calculate layout once with d3 → ~350ms
- **Phase 3**: Enrich visible nodes progressively → on scroll

**Components**:
- Backend: `get_structure_only()` RPC (Supabase)
- Service: `getStructureOnly()`, `enrichVisibleNodes()` methods
- Hooks: `useProgressiveTreeView()`, `useStructureLoader()`, `useViewportEnrichment()`
- Feature flag: `USE_PROGRESSIVE_LOADING` in TreeView.js

📖 Full docs: [`/docs/PTS/README.md`](docs/PTS/README.md) (Phase 3B section)

## 🚀 Multi-Agent Git Workflow

### CRITICAL: End-of-Session Protocol

When user says "ending for today" or similar, IMMEDIATELY:
1. Check commit count: `git rev-list --count origin/master..HEAD`
2. If > 20 commits → MUST merge today to prevent divergence
3. Run full audit from `END_OF_SESSION_PROTOCOL.md`

### Branch Strategy
- **One branch per session/feature** (not per agent)
- **Daily merges** to prevent divergence
- **Descriptive commits** with agent context: `feat(claude): Add feature X`
- **Maximum 20 commits** before mandatory merge

## 📚 Reference

- **Design Inspiration**: iOS Settings, WhatsApp, Linear
- **Typography**: SF Arabic for all Arabic text
- **Icons**: Ionicons for consistency
- **Testing**: Physical iOS device required for gestures

---

_This guide ensures consistency and premium quality throughout the Alqefari Family Tree app._
