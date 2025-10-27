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
- **[BlurHash System](docs/BLURHASH_DAY1_COMPLETION.md)** - Progressive photo placeholders (skeleton→blur→photo) | [Day 2: Frontend](docs/BLURHASH_DAY2_COMPLETION.md)
- **[Photo Crop System](docs/features/PHOTO_CROP_IMPLEMENTATION_PLAN.md)** - Non-destructive photo cropping implementation plan (17h, A- grade)

### Perfect Tree System (PTS)
- **[PTS Documentation Hub](docs/PTS/README.md)** - Complete Perfect Tree System documentation
  - Phase 1: Component Extraction (18 modules, 6,635 lines)
  - Phase 2: Hook Extraction & Cleanup (288 lines)
  - Phase 3B: Progressive Loading (0.45 MB structure + viewport enrichment)
    - **[Test Plan](docs/PROGRESSIVE_LOADING_TEST_PLAN.md)** - 50+ test cases
    - **[Integration Checklist](docs/PROGRESSIVE_LOADING_INTEGRATION_CHECKLIST.md)** - Verification & deployment
    - **[Pitfalls & Solutions](docs/PROGRESSIVE_LOADING_PITFALLS.md)** - Self-view data completeness issue & prevention
  - Architecture, testing, audits, and daily logs
- **[TreeView Componentization](docs/TREEVIEW_COMPONENTIZATION.md)** - Branch tree refactor (-2,530 lines, A+ grade)

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

**Quick Summary**: 4-step OTP verification flow (current phone → new phone → complete). Session remains valid after change.

📖 **Full Documentation**: [`/docs/features/PHONE_CHANGE.md`](docs/features/PHONE_CHANGE.md)

## 🗑️ Delete Account (Settings)

**Status**: ✅ Complete - Secure 3-step deletion with OTP verification and rate limiting

**Quick Summary**: Hidden under Advanced Settings. OTP + text confirmation ("نعم") required. Global sign-out. Profile becomes read-only (preserves family history).

**Critical Notes**:
- ❌ Profile data DELETED: user_id link, admin access
- ✅ Profile data RETAINED: Names, dates, photos

📖 **Full Documentation**: [`/docs/features/ACCOUNT_DELETION.md`](docs/features/ACCOUNT_DELETION.md)

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

**Status**: ✅ Optimized (October 2025) - iOS-native physics + 134 tests passing

**Flow**: Touch → GestureHandler → HitDetection → TreeView callback → State update

**Feel**: iOS Photos-like momentum (1-2 sec pan coast, smooth zoom bounce)

**Core modules**:
- `GestureHandler.ts` - Pan, pinch, tap, long-press gestures
- `gesturePhysics.ts` - iOS-calibrated physics constants (**NEW**)
- `HitDetection.ts` - Coordinate-to-node mapping
- `SelectionHandler.ts` - Node selection logic

**Key physics** (from `gesturePhysics.ts`):
- Pan deceleration: **0.998** (iOS native, 1-2 sec coast)
- Velocity clamping: ±2000 pts/sec (no jarring flicks)
- Velocity threshold: 30 pts/sec (ignores micro-movements)
- Zoom spring: iOS-calibrated bounce (damping 0.7, stiffness 100)

**Key pattern**: Memoized callbacks + coordinate transformation + permission checks

📖 Full docs: [`/docs/architecture/GESTURE_SYSTEM.md`](docs/architecture/GESTURE_SYSTEM.md)

## 🔧 Progressive Loading Cache Fix (October 26, 2025)

**Status**: ✅ Deployed - Migration applied, schema version bumped

**Problem**: Profile edits disappearing after app restart (missing `version` field in structure RPC)
**Solution**: Add `version` to `get_structure_only()` RPC + schema version bump 1.0.0 → 1.1.0

📖 **Full Documentation**: [`/docs/architecture/PROGRESSIVE_LOADING_CACHE_FIX.md`](docs/architecture/PROGRESSIVE_LOADING_CACHE_FIX.md)

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

**⚠️ CRITICAL**: URL schemes MUST be declared in `app.json`, NOT `Info.plist` directly. Changes require native rebuild (not OTA-updatable).

**Declared**: `whatsapp`, `tel`, `https` (via `app.json → expo.ios.infoPlist.LSApplicationQueriesSchemes`)

**Common Error**: "Add whatsapp to LSApplicationQueriesSchemes" → Add to `app.json` and rebuild.

📖 **Full Documentation**: [`/docs/deployment/IOS_URL_SCHEMES.md`](docs/deployment/IOS_URL_SCHEMES.md)

## 📱 QR Code & Deep Linking System

**Status**: ✅ Security Fixes Applied (October 28, 2025)
**Last Updated**: October 28, 2025
**Feature Flag**: `enableDeepLinking: __DEV__` (ready for production after manual testing)
**Migrations**: 3 security migrations deployed successfully

**Quick Summary**: Production-grade QR code sharing with deep linking. **All 3 critical security issues resolved** - ready for manual testing and production deployment.

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

### ✅ Security Fixes Applied (October 28, 2025)

All 3 critical security issues have been resolved with comprehensive fixes that exceed the original plan-validator recommendations.

**Implementation Grade**: Complete - 3 migrations + 3 code updates

#### 1. Secure RLS Policy ✅
**Migration**: `20251028000002_fix_share_events_rls.sql`
- **Fix**: Replaced permissive `WITH CHECK (true)` policy with secure authentication
- **Validation**: Ties scanner_id to auth.uid() (prevents User A from inserting analytics as User B)
- **Checks**: Validates profile_id exists, sharer_id exists (if provided), deleted profiles rejected
- **Deployment**: Atomic migration (CREATE new policy before DROP old, zero downtime)
- **Monitoring**: `check_share_events_rls_health()` diagnostic function added

#### 2. Server-Side Rate Limiting ✅
**Migration**: `20251028000000_add_qr_rate_limiting.sql`
- **Fix**: Database trigger enforces 20 scans per 5 minutes (NOT client-side Map)
- **Storage**: `user_rate_limits` table tracks per-user scan counts + window start time
- **Trigger**: `enforce_qr_scan_rate_limit()` BEFORE INSERT on `profile_share_events`
- **Benefits**: Persists across devices, survives app restarts, no memory leaks, multi-device safe
- **Monitoring**: `qr_scan_rate_limits` view for admin dashboard
- **Error Handling**: Arabic alert shown when rate limit exceeded (deepLinking.ts line 283-291)

#### 3. URL Validation & Whitelisting ✅
**New File**: `src/utils/urlValidation.ts` (security utility module)
**Updated**: `src/components/sharing/ProfileQRCode.js` (lines 75-92)
- **Fix**: Comprehensive URL validation before Image.prefetch()
- **Whitelist**: Only allows `https://<project>.supabase.co/storage/v1/object/(public|authenticated)/`
- **Security Checks** (6 layers):
  1. Must be HTTPS (blocks file://, data:, javascript:)
  2. Must match Supabase storage domain pattern
  3. No path traversal (..)
  4. No encoded path traversal (%2e%2e)
  5. No redirect parameters (redirect, url, return, next, goto)
  6. No null bytes (\\0, %00)
- **Fallback**: Falls back to emblem logo if validation fails (graceful degradation)

#### Additional Security Enhancement
**Migration**: `20251028000001_add_scanner_id_to_share_events.sql`
- **Added**: `scanner_id UUID` column to separate "who scanned" from "who shared"
- **Purpose**: Enables RLS policy to tie analytics to authenticated user (fixes plan-validator issue #1)
- **Analytics**: Created 2 views (`top_qr_scanners`, `most_scanned_profiles`) for admin dashboard
- **Indexes**: Added `idx_share_events_scanner_id` and `idx_share_events_scanner_shared_at` for performance

### Next Steps (Testing & Deployment)
1. ✅ Apply security fixes (RLS policy, rate limiting, URL validation) - COMPLETE
2. ⏳ Git commit all changes (migrations + code updates)
3. ⏳ Manual testing on physical devices (iOS + Android)
   - Test rate limiting (21st scan shows alert)
   - Test RLS policy (unauthenticated insert fails)
   - Test URL validation (file:// URLs rejected)
   - Test analytics logging (scanner_id matches auth user)
4. ⏳ Enable production feature flag: `enableDeepLinking: true`
5. ⏳ Deploy via OTA: `npm run update:production`
6. ⏳ Monitor `profile_share_events` table for spam/abuse (first 48 hours)

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
✅ **Security Status**: All 3 critical issues resolved (October 28, 2025). Ready for manual testing and production deployment.
📋 **Deployment Checklist**: [`/docs/DEPLOYMENT_CHECKLIST_OCT2025.md`](docs/DEPLOYMENT_CHECKLIST_OCT2025.md) - Updated with implementation details

## 👥 Munasib Management System

**Location**: Admin Dashboard → Munasib Management (`src/components/admin/MunasibManager.js`)
**Identifier**: `profile.hid === null` (Munasib have NULL HID)

📖 **Full Documentation**: [`/docs/features/MUNASIB_MANAGEMENT.md`](docs/features/MUNASIB_MANAGEMENT.md)

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

## 🌳 TreeView Node Constants

**Status**: ✅ Complete & Audited (October 25, 2025) - Grade A- (92/100)
**Location**: `src/components/TreeView/rendering/nodeConstants.ts`

**Standard Node**: 58px × 75px (4px padding, follows 8px grid)

**Import**:
```javascript
import { STANDARD_NODE, ROOT_NODE } from './TreeView/rendering/nodeConstants';
```

📖 **Full Documentation**: [`/docs/architecture/TREEVIEW_NODE_CONSTANTS.md`](docs/architecture/TREEVIEW_NODE_CONSTANTS.md)

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
**Purpose**: Show smooth blurred image placeholders while real photos load (~25 char string)
**Timeline**: 10 mins remaining (Day 1: deploy + run batch) + 8 hours (Day 2: frontend)

**What**: Tiny ~25-char string representing blurred image. Used by Twitter, Medium, Unsplash.

📖 **Full Documentation**: [`/docs/features/BLURHASH.md`](docs/features/BLURHASH.md)

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

**Current**: Database Max 10K, Frontend Load 5K, Warning at 3.75K (75%), Critical at 4.75K (95%)
**Key**: Viewport culling renders ~500 nodes max. **60fps regardless of dataset size**.

📖 **Full Documentation**: [`/docs/architecture/TREE_LOADING_LIMITS.md`](docs/architecture/TREE_LOADING_LIMITS.md)

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

# Commit types: feat, fix, docs, style, refactor, test
```

**Git Best Practices**: Commit frequently, never lose work, clear messages, update docs, check status before/after changes.

📖 **Full Documentation**: [`/docs/development/GIT_WORKFLOW.md`](docs/development/GIT_WORKFLOW.md)

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

## ⚠️ CRITICAL: Migration Workflow Violations

### 🚨 Common Violations
1. **Oct 18, 2025**: Applied migration without saving .sql file → 44 profiles corrupted
2. **Oct 25, 2025**: Saved .sql file but never applied to database → "missing version field" errors

### ✅ CORRECT WORKFLOW (MANDATORY)
1. Write .sql file FIRST
2. IMMEDIATELY apply to database (within 5 minutes!)
3. TEST in database (verify field/RPC exists)
4. TEST in app (verify frontend receives field)
5. ONLY THEN commit to git

### 🚨 RED FLAGS (STOP IMMEDIATELY)
- ❌ Migration file not applied to database yet
- ❌ Code uses field that doesn't exist in database
- ❌ RPC signature changed but old function still exists
- ❌ "function is not unique" error

📖 **Full Documentation**: [`/docs/development/MIGRATION_WORKFLOW_DETAILED.md`](docs/development/MIGRATION_WORKFLOW_DETAILED.md)

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

### ⏱️ Permission Check Timeout Protection (October 28, 2025)

**Status**: ✅ Deployed - Network timeout protection across all permission checks

**Issue**: Permission checks hung indefinitely on slow/flaky networks, blocking users from editing profiles, scanning QR codes, and submitting suggestions.

**Solution**:
- **Frontend**: `fetchWithTimeout()` wrapper with 3-second timeout
- **Backend**: `SET LOCAL statement_timeout = '3000'` in `check_family_permission_v4()`
- **Error UX**: Network-specific messages + retry button (with 1-second debounce)

**Protected Locations**:
1. `src/components/ProfileViewer/index.js:845-892` - Edit button permission check
2. `src/utils/deepLinking.ts:215-257` - QR code deep link permission check
3. `src/services/suggestionService.js:49-82` - Suggestion submission permission check

**Error Messages**:
- `NETWORK_OFFLINE` → "لا يوجد اتصال بالإنترنت"
- `NETWORK_TIMEOUT` → "انتهت المهلة" + "إعادة المحاولة" button
- Other errors → Generic "فشل التحقق من الصلاحيات"

**Key Files**:
- Migration: `supabase/migrations/20251028000003_add_permission_check_timeout.sql`
- Utility: `src/utils/fetchWithTimeout.js` (3-second timeout matches `useProfilePermissions`)

**Security Notes** (per plan-validator):
- Permission check is NOT redundant (catches role changes during 5-min cache TTL)
- NO self-view bypass (would create security hole)
- Maintains optimistic locking flow
- Network timeout is defensive, not a security bypass

📖 **Related**: [Permission System v4.3](docs/PERMISSION_SYSTEM_V4.md)

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

## 📰 News Screen (January 2025)

**Components**: Najdi Sadu tokens, WordPress service (24h cache), FeaturedNewsCarousel, NewsCard, RecententArticleItem
**Features**: Dual calendar (Gregorian/Hijri), infinite scroll, shimmer loading

📖 **Full Documentation**: [`/docs/features/NEWS_SCREEN.md`](docs/features/NEWS_SCREEN.md)

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

**Branch Strategy**: One branch per session/feature (not per agent), daily merges, descriptive commits with agent context, max 20 commits before merge.

📖 **Full Documentation**: [`/docs/development/MULTI_AGENT_WORKFLOW.md`](docs/development/MULTI_AGENT_WORKFLOW.md)

## 📚 Reference

- **Design Inspiration**: iOS Settings, WhatsApp, Linear
- **Typography**: SF Arabic for all Arabic text
- **Icons**: Ionicons for consistency
- **Testing**: Physical iOS device required for gestures

---

_This guide ensures consistency and premium quality throughout the Alqefari Family Tree app._
