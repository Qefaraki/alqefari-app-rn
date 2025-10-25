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

## 🌳 TreeView Phase 1 Refactor (October 2025)

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

**Test Coverage:** 33 unit tests (100% passing)

**Performance Impact:** +2.3% layout time, +2% memory (within 5% tolerance)

**Full Documentation:** [`/docs/treeview-refactor/phase1/`](docs/treeview-refactor/phase1/README.md)
- Quick Start & Architecture
- Usage Examples & Import Guides
- Test Results & Performance Data

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

**Status**: ✅ Implementation Complete (Days 1-3) | ⏳ Testing In Progress (Day 4)

**Strategy**: Two-phase loading - structure (0.45 MB) + viewport enrichment

**Benefits**:
- 89.4% data reduction (0.45 MB vs 4.26 MB)
- <500ms initial load time (vs ~800ms full tree)
- Zero jumping (d3 layout determinism)
- Progressive photos as user scrolls

**Enable for Testing**:
```javascript
// src/components/TreeView.js line 215
const USE_PROGRESSIVE_LOADING = true; // Change false → true
```

**Architecture**:
- **Phase 1**: Load structure (RPC: `get_structure_only()`) → <500ms
- **Phase 2**: Calculate layout once with d3 → ~350ms
- **Phase 3**: Enrich visible nodes progressively → on scroll

**Components**:
- Backend: `get_structure_only()` RPC (Supabase)
- Service: `getStructureOnly()`, `enrichVisibleNodes()` methods
- Hooks: `useProgressiveTreeView()`, `useStructureLoader()`, `useViewportEnrichment()`
- Feature flag: `USE_PROGRESSIVE_LOADING` in TreeView.js

**Test Documentation**:
- **[Test Plan](docs/PROGRESSIVE_LOADING_TEST_PLAN.md)** - 50+ test cases covering all phases
- **[Integration Checklist](docs/PROGRESSIVE_LOADING_INTEGRATION_CHECKLIST.md)** - Verification & production readiness

**Next Steps**:
1. Run comprehensive test suite (2-3 hours)
2. Document results in `PROGRESSIVE_LOADING_TEST_RESULTS.md`
3. Integrate real-time subscriptions (~3 hours)
4. Production rollout planning

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
