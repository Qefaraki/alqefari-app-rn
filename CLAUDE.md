# Alqefari Family Tree - Development Guide

## 🚨 CRITICAL: Always Commit After Successful Changes

**After EVERY successful code change, migration, or fix:**

```bash
git add -A
git commit -m "type: Specific description of what was changed"
```

**Commit Message Format**:
- **feat**: New feature added
- **fix**: Bug fixed
- **refactor**: Code restructured (no behavior change)
- **docs**: Documentation updated
- **test**: Tests added/modified
- **chore**: Maintenance (deps, config, etc.)

**Examples**:
- ✅ `fix: Restore recursive CTE in search_name_chain (Munasib filter + full name chains)`
- ✅ `feat: Add crop fields to search RPC (4 numeric fields for photo cropping)`
- ❌ `update code` (too vague)

**Why**: Git commits create restore points. If something breaks later, you can always revert to the last working state.

---

## 📖 Documentation Index

### Core Systems
- **[Quick Start](docs/QUICK_START.md)** - Essential commands & critical patterns (⭐ START HERE)
- **[Design System](docs/DESIGN_SYSTEM.md)** - Najdi Sadu color palette, typography, components
- **[Permission System](docs/PERMISSION_SYSTEM_V4.md)** - Family-based edit permissions & roles
- **[Field Mapping](docs/FIELD_MAPPING.md)** - RPC function field maintenance
- **[Migration Guide](docs/MIGRATION_GUIDE.md)** - Database migration details
- **[Soft Delete Pattern](docs/SOFT_DELETE_PATTERN.md)** - Soft delete & optimistic locking
- **[Undo System](docs/UNDO_SYSTEM_TEST_CHECKLIST.md)** - Activity log undo functionality
- **[Message Templates](docs/MESSAGE_TEMPLATE_SYSTEM.md)** - WhatsApp template system
- **[OTA Updates](docs/OTA_UPDATES.md)** - Over-the-air update deployment & rollback

### Features
- **[QR Code & Deep Linking](docs/QR_CODE_DEEP_LINKING.md)** - QR code sharing with deep linking (security fixes Oct 28)
- **[Photo Crop System](docs/features/PHOTO_CROP_IMPLEMENTATION_PLAN.md)** - Non-destructive photo cropping
- **[Photo Approval System](docs/features/PHOTO_APPROVAL_SYSTEM.md)** - Admin-moderated photo changes (A+ grade, Oct 29)
- **[BlurHash System](docs/BLURHASH_DAY1_COMPLETION.md)** - Progressive photo placeholders
- **[Phone Number Change](docs/features/PHONE_CHANGE.md)** - Secure 4-step OTP verification flow
- **[Account Deletion](docs/features/ACCOUNT_DELETION.md)** - Secure 3-step deletion with OTP
- **[Family Statistics](docs/features/FAMILY_STATISTICS.md)** - Comprehensive family analytics with charts
- **[Munasib Management](docs/features/MUNASIB_MANAGEMENT.md)** - Manage families married into Al-Qefari
- **[News Screen](docs/features/NEWS_SCREEN.md)** - WordPress integration with dual calendar

### Architecture
- **[PTS Documentation Hub](docs/PTS/README.md)** - Perfect Tree System documentation
- **[TreeView Componentization](docs/TREEVIEW_COMPONENTIZATION.md)** - Branch tree refactor
- **[Gesture System](docs/architecture/GESTURE_SYSTEM.md)** - iOS-native physics + hit detection
- **[TreeView Node Constants](docs/architecture/TREEVIEW_NODE_CONSTANTS.md)** - Node dimensions & layout
- **[Tree Loading Limits](docs/architecture/TREE_LOADING_LIMITS.md)** - Database & frontend load limits
- **[Progressive Loading Cache Fix](docs/architecture/PROGRESSIVE_LOADING_CACHE_FIX.md)** - Version field fix

### Development
- **[Git Workflow](docs/development/GIT_WORKFLOW.md)** - Commit conventions & best practices
- **[Multi-Agent Workflow](docs/development/MULTI_AGENT_WORKFLOW.md)** - Branch strategy & daily merges
- **[Migration Workflow](docs/development/MIGRATION_WORKFLOW_DETAILED.md)** - Step-by-step migration process

### Components
- **[SegmentedControl](docs/components/SEGMENTED_CONTROL.md)** - iOS pill-style tabs
- **[Victory Native RTL](docs/components/VICTORY_NATIVE_RTL.md)** - RTL wrappers for charts

### Deployment
- **[iOS URL Schemes](docs/deployment/IOS_URL_SCHEMES.md)** - WhatsApp, tel, https schemes

### Reference
- **[Reference Tables](docs/REFERENCE_TABLES.md)** - Admin dashboard access, undo action types

---

## ⚠️ IMPORTANT: Native RTL Mode is ENABLED

**The app runs in native RTL mode** (`I18nManager.forceRTL(true)` in index.js).

**Simply write layouts as if for LTR, and React Native flips them for RTL.**

- ✅ Use `flexDirection: 'row'` (not 'row-reverse')
- ✅ Use `textAlign: 'left'` (not 'right')
- ✅ Use `alignItems: 'flex-start'` (not 'flex-end')
- ✅ Back buttons use `chevron-back` (not forward)

---

## 🔑 Quick Permission Reference

### Who Can Edit What?

| User Type | Can Edit Directly | Can Suggest Edits |
|-----------|------------------|-------------------|
| **Super Admin** (المدير العام) | Everyone | N/A (direct edit) |
| **Admin** (مشرف) | Everyone | N/A (direct edit) |
| **Branch Moderator** (منسق) | Their branch + descendants | Other profiles |
| **Regular User** (عضو) | Self, spouse, parents, siblings, descendants | Grandparents, aunts, uncles, cousins |

### Family Edit Rules for Regular Users
- ✅ **Direct Edit**: You, spouse, parents, siblings, all descendants
- 💡 **Suggest Only**: Grandparents, aunts, uncles, cousins, extended family
- 🚫 **Blocked**: No suggestions allowed if admin blocked you

### Key Function
```javascript
const { data: permission } = await supabase.rpc('check_family_permission_v4', {
  p_user_id: userProfile.id,   // IMPORTANT: Use profiles.id, NOT auth.users.id
  p_target_id: targetProfile.id
});
// Returns: 'admin', 'moderator', 'inner', 'suggest', 'blocked', or 'none'
```

📖 **Full Documentation**: [`/docs/PERMISSION_SYSTEM_V4.md`](docs/PERMISSION_SYSTEM_V4.md)

---

## 🎨 Design System Quick Reference

**Najdi Sadu Design Language** - Culturally authentic, iOS-inspired design system.

### Core Colors
```javascript
import tokens from './src/components/ui/tokens';

tokens.colors.alJassWhite      // #F9F7F3 (background)
tokens.colors.camelHairBeige   // #D1BBA3 (containers)
tokens.colors.saduNight        // #242121 (text)
tokens.colors.najdiCrimson     // #A13333 (primary)
tokens.colors.desertOchre      // #D58C4A (secondary)
```

### Quick Rules
- **Typography**: iOS sizes (17, 20, 22, 28, 34), SF Arabic font
- **Spacing**: 8px grid (8, 12, 16, 20, 24, 32)
- **Touch Targets**: 44px minimum
- **Shadows**: Max 0.08 opacity

📖 **Full Documentation**: [`/docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)

---

## 📱 Development Commands

```bash
# Development
npm start          # Expo dev server
npm run ios        # iOS simulator
npm run android    # Android emulator

# OTA Updates
npm run update:preview -- --message "Fix"      # Test with admin team
npm run update:production -- --message "Fix"   # Deploy to all users
npm run update:rollback                         # Emergency undo
```

### Database Operations (MCP Only)
- ✅ Queries: `mcp__supabase__execute_sql`
- ✅ Migrations: `mcp__supabase__apply_migration`
- ✅ Schema: `mcp__supabase__list_tables`
- ❌ NO Bash/psql/supabase CLI

---

## 📱 Feature Status Quick Reference

| Feature | Status | Location | Notes |
|---------|--------|----------|-------|
| **QR Code & Deep Linking** | ✅ Security fixes deployed | Admin Dashboard → Share Profile | Ready for testing, feature flag: `__DEV__` |
| **Photo Crop** | ✅ Production-ready | ProfileViewer → Edit Photo | Non-destructive, GPU rendering |
| **BlurHash** | 🚧 Day 1 (80%) | Backend deployed | Day 2: Frontend (8h) |
| **Family Statistics** | ✅ Complete | Admin Dashboard → إحصائيات العائلة | Victory Native charts |
| **Munasib Management** | ✅ Deployed | Admin Dashboard → Munasib Management | NULL HID identifier |
| **Permission System v4.3** | ✅ Deployed | All edit flows | Manual approval workflow |
| **Progressive Loading** | ✅ Production | TreeView | 89.4% data reduction |

---

## 🏗 Project Structure

```
src/
├── components/      # Reusable UI components
│   ├── ui/         # Design system components (tokens, buttons)
│   ├── admin/      # Admin-only features (dashboard, statistics)
│   └── TreeView/   # Modular tree architecture (Phase 1)
├── screens/        # App screens (Home, Profile, Admin)
├── services/       # API & Supabase (treeService, profileSharing)
├── stores/         # Zustand state management (useTreeStore)
└── config/         # App configuration (featureFlags, adminFeatures)
```

---

## 🔄 Batch Operations & Version Control

**Pattern**: All multi-profile updates use batch RPCs with version validation

**Example**:
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
  Alert.alert('خطأ', 'تم تحديث البيانات من قبل مستخدم آخر');
  loadChildren();  // Reload to sync
  return;
}
```

📖 **Full Documentation**: [`/docs/FIELD_MAPPING.md#batch-operations-pattern`](docs/FIELD_MAPPING.md#-batch-operations-pattern)

---

## 🔑 Key Implementation Rules

### RTL Support
- All layouts work in RTL automatically (native mode enabled)
- Use `flexDirection: "row"` with proper RTL handling
- Test with Arabic content

### State Management
```javascript
// Single source of truth (Zustand)
const { nodes, updateNode } = useTreeStore();
```

### Error Handling
```javascript
if (error) {
  Alert.alert("خطأ", handleSupabaseError(error));
}
```

### Version Control (Optimistic Locking)
```javascript
// Always include version field in queries
SELECT id, first_name, version FROM profiles WHERE id = 'xyz';

// Handle version conflicts
if (error?.message.includes('version')) {
  Alert.alert('خطأ', 'تم تحديث البيانات من قبل مستخدم آخر');
  reload();
  return;
}
```

---

## 🚀 Best Practices

1. **Always use the color palette** - Never hardcode colors
2. **Follow the 8px grid** - All spacing must be multiples of 8
3. **Keep shadows subtle** - Max 0.08 opacity
4. **Use semantic naming** - `primaryButton` not `blueButton`
5. **Test on real devices** - Especially for RTL and gestures
6. **Commit atomically** - One feature per commit

---

## 📝 Git Workflow & Version Control

### CRITICAL: Always Save Your Work

```bash
# After EVERY feature/fix - commit immediately
git add -A
git commit -m "type: Clear description of changes"
```

**Commit types**: feat, fix, docs, style, refactor, test, chore

📖 **Full Documentation**: [`/docs/development/GIT_WORKFLOW.md`](docs/development/GIT_WORKFLOW.md)

---

## ⚠️ Database Migrations

### CRITICAL: Use MCP Only

**All migrations use `mcp__supabase__apply_migration`. No CLI, no alternatives.**

### 🚨 ALWAYS WRITE THE FILE FIRST!

**⚠️ INCIDENT REPORT: On Oct 18, 2025, violating this workflow caused 44+ profiles to have incorrect sibling_order values, requiring full database revert and system redesign. DO NOT REPEAT THIS MISTAKE!**

### ✅ CORRECT WORKFLOW (MANDATORY)

```bash
1. Write tool → supabase/migrations/YYYYMMDDHHMMSS_name.sql  # ✅ Save file FIRST!
2. mcp__supabase__apply_migration with same SQL              # ✅ Apply to DB
3. Test in database (verify field/RPC exists)                # ✅ Verify it works
4. Test in app (verify frontend receives field)              # ✅ Verify integration
5. Git commit                                                # ✅ File is tracked
```

**RESULT**:
- ✅ Works for everyone
- ✅ Tracked in git
- ✅ Deployable to all environments
- ✅ Can rollback if needed
- ✅ Full audit trail

### 📋 Pre-Commit Checklist (MANDATORY)

Before **EVERY** `git commit`:

- [ ] If commit mentions "migration", verify `.sql` files are staged
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

---

## 🔒 Security

- Never expose service role keys
- Use RPC functions for admin operations
- Implement row-level security (RLS)
- Validate all inputs

---

## 🗄️ Database Migrations

**📖 Full Documentation**: [`/docs/MIGRATION_GUIDE.md`](docs/MIGRATION_GUIDE.md)

### Critical Migrations Quick Reference

| Migration | Purpose | Status |
|-----------|---------|--------|
| **005** | Family Edit Permissions System | ✅ Deployed |
| **006** | Super Admin Permissions | ✅ Deployed |
| **084a** | Batch Permission Validator | ✅ Deployed |
| **084b** | Cascade Soft Delete | ✅ Deployed |
| **20251014120000** | Undo System (initial) | ✅ Deployed |
| **20251015010000-050000** | Undo Safety Mechanisms (5 migrations) | ✅ Deployed |
| **20251016120000** | Permission Manager Optimized RPC | ✅ Deployed |
| **20250116000000** | Simplified Permission System (v4.3) | ✅ Deployed |
| **20251028000000-000003** | QR Security Fixes (4 migrations) | ✅ Deployed |
| **20251028000010-000012** | Family Statistics (3 migrations) | ✅ Deployed |

### Field Mapping Checklist

When adding a **new column** to `profiles` table:
- [ ] `ALTER TABLE profiles ADD COLUMN`
- [ ] Update `get_branch_data()` - RETURNS TABLE + all SELECT statements
- [ ] Update `search_name_chain()` - RETURNS TABLE + all SELECT statements
- [ ] Update `admin_update_profile()` - whitelist
- [ ] Test in app - verify field persists

📖 **Full Documentation**: [`/docs/FIELD_MAPPING.md`](docs/FIELD_MAPPING.md)

---

## 🗑️ Soft Delete Pattern Quick Ref

**Pattern**: Sets `deleted_at` timestamp (audit trail) + optimistic locking with `version` field

**Key Functions**:
- `admin_update_profile()` (requires `p_version`)
- `admin_cascade_delete_profile()` (with safety checks)

⚠️ **Critical**: Always include `p_version` parameter to prevent concurrent edit conflicts

📖 **Full Documentation**: [`/docs/SOFT_DELETE_PATTERN.md`](docs/SOFT_DELETE_PATTERN.md)

---

## 🔄 Undo System Quick Ref

**Status**: ✅ Deployed (7 migrations, 100% safe)

**System**: Audit log with version checking + idempotency protection + advisory locking

**Action Types**: `profile_update`, `profile_soft_delete`, `profile_cascade_delete`, `add_marriage`, `crop_update`

**Limits**: 30 days for users, unlimited for admins

**Safety**: Version conflict prevention + parent validation + idempotency + operation groups

📖 **Full Documentation**: [`/docs/UNDO_SYSTEM_TEST_CHECKLIST.md`](docs/UNDO_SYSTEM_TEST_CHECKLIST.md)

---

## 🚀 Multi-Agent Git Workflow

### CRITICAL: End-of-Session Protocol

When user says "ending for today" or similar, IMMEDIATELY:
1. Check commit count: `git rev-list --count origin/master..HEAD`
2. If > 20 commits → MUST merge today to prevent divergence
3. Run full audit from `END_OF_SESSION_PROTOCOL.md`

**Branch Strategy**: One branch per session/feature (not per agent), daily merges, descriptive commits with agent context, max 20 commits before merge.

📖 **Full Documentation**: [`/docs/development/MULTI_AGENT_WORKFLOW.md`](docs/development/MULTI_AGENT_WORKFLOW.md)

---

## 📚 Reference

- **Design Inspiration**: iOS Settings, WhatsApp, Linear
- **Typography**: SF Arabic for all Arabic text
- **Icons**: Ionicons for consistency
- **Testing**: Physical iOS device required for gestures

---

_This guide ensures consistency and premium quality throughout the Alqefari Family Tree app._
