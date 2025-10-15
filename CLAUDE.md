# Alqefari Family Tree - Development Guide

## 📖 Documentation Index

- **[Design System](docs/DESIGN_SYSTEM.md)** - Najdi Sadu color palette, typography, components
- **[Permission System](docs/PERMISSION_SYSTEM_V4.md)** - Family-based edit permissions & roles
- **[Field Mapping](docs/FIELD_MAPPING.md)** - RPC function field maintenance
- **[Migration Guide](docs/MIGRATION_GUIDE.md)** - Database migration details
- **[Soft Delete Pattern](docs/SOFT_DELETE_PATTERN.md)** - Soft delete & optimistic locking
- **[Undo System](docs/UNDO_SYSTEM_TEST_CHECKLIST.md)** - Activity log undo functionality
- **[Message Templates](docs/MESSAGE_TEMPLATE_SYSTEM.md)** - WhatsApp template system
- **[OTA Updates](docs/OTA_UPDATES.md)** - Over-the-air update deployment & rollback

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

| User Type | Can Edit Directly | Can Suggest Edits | Special Powers |
|-----------|------------------|-------------------|----------------|
| **Super Admin** | Everyone | N/A (direct edit) | Manage roles, assign moderators |
| **Admin** | Everyone | N/A (direct edit) | Approve suggestions, block users |
| **Branch Moderator** | Their branch + descendants | Other profiles | Manage assigned subtree |
| **Regular User** | Self, spouse, parents, siblings, all descendants | Everyone else | Create suggestions |

### Family Edit Rules for Regular Users
- ✅ **Direct Edit**: You, spouse, parents, siblings, children, grandchildren
- 💡 **Suggest Only**: Aunts, uncles, cousins, extended family
- 🚫 **Blocked**: No suggestions allowed if admin blocked you

### Finding the Features
- **Review Suggestions**: Admin Dashboard → Quick Actions → "مراجعة الاقتراحات"
- **Manage Permissions**: Admin Dashboard → Administrators → "إدارة الصلاحيات" (super admin only)
- **Suggest Edit**: Profile Sheet → Three dots menu (when not in admin mode)

_See full documentation: [`/docs/PERMISSION_SYSTEM_V4.md`](docs/PERMISSION_SYSTEM_V4.md)_

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

## 👥 Munasib Management System

Full management dashboard for Munasib (spouse) profiles:
- Search & filter by name, phone, location
- Family statistics (most common origins)
- Marriage connections
- Export to PDF

**Location**: `src/components/admin/MunasibManager.js` (Admin Dashboard)
**Identifying**: `profile.hid === null` (Munasib have NULL HID)

## 🏗 Project Structure

```
src/
├── components/      # Reusable UI components
│   ├── ui/         # Design system components
│   └── admin/      # Admin-only features
├── screens/        # App screens
├── services/       # API & Supabase
├── stores/         # Zustand state management
└── config/         # App configuration
```

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
- **Current Size**: ~779 profiles (7 generations)
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
// ✅ Tree loaded: 779 profiles
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
| 779 (current) | <500ms | ~2MB | 60fps | ✅ Optimal |
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

## 👥 Permission System v4.2

**📖 Full Documentation**: [`/docs/PERMISSION_SYSTEM_V4.md`](docs/PERMISSION_SYSTEM_V4.md)

**Status**: ✅ Deployed and operational

### Quick Reference

| Permission Level | Edit Rights | Example Relationships |
|-----------------|-------------|---------------------|
| `inner` | Direct edit | Self, spouse, parents, children, siblings, descendants |
| `family` | Suggest only (48h auto-approve) | Cousins, aunts/uncles |
| `extended` | Suggest only (manual) | Distant Al Qefari relatives |
| `admin`/`moderator` | Direct edit | Admin role or branch moderator |
| `blocked` | None | Explicitly blocked users |

### Key Function
```javascript
const { data: permission } = await supabase.rpc('check_family_permission_v4', {
  p_user_id: userProfile.id,   // IMPORTANT: Use profiles.id, NOT auth.users.id
  p_target_id: targetProfile.id
});
// Returns: 'inner', 'family', 'extended', 'admin', 'moderator', 'blocked', or 'none'
```

### User Roles
- **super_admin** - Manages roles, assigns moderators
- **admin** - Reviews suggestions, blocks users
- **moderator** - Manages assigned family branch
- **user** - Standard family member (permission based on relationship)

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

## 🗑️ Soft Delete Pattern

**📖 Full Documentation**: [`/docs/SOFT_DELETE_PATTERN.md`](docs/SOFT_DELETE_PATTERN.md)

**Status**: ✅ Deployed and operational

### Quick Summary

**Soft Delete**: Sets `deleted_at` timestamp instead of removing records. Data remains for audit trail and recovery.

**Optimistic Locking**: Each profile has `version` field. `admin_update_profile()` requires `p_version` parameter to prevent concurrent edits.

**Cascade Delete**: `admin_cascade_delete_profile()` recursively soft-deletes profile and all descendants with full safety mechanisms (permission checks, locks, limits, audit trail).

### Function Signature
```javascript
// Simple update with optimistic locking
await supabase.rpc('admin_update_profile', {
  p_id: profile.id,
  p_version: profile.version || 1,  // Required!
  p_updates: { name: 'New Name' }
});

// Cascade delete with safety checks
await supabase.rpc('admin_cascade_delete_profile', {
  p_profile_id: child.id,
  p_version: child.version || 1,
  p_confirm_cascade: true,
  p_max_descendants: 100
});
```

**Common Error**: Missing `p_version` parameter causes function not found error.

## 🔄 Undo System (January 2025)

**Status**: ✅ Deployed and operational

### Quick Summary

Production-ready undo functionality for audit log entries with comprehensive safety mechanisms, permission checks, and time limits.

### Migrations

| Migration | Purpose | Status |
|-----------|---------|--------|
| **20251014120000_undo_system.sql** | Initial undo system with 3 RPC functions | ✅ Deployed |
| **20251014150000_fix_undo_permission_actor_comparison.sql** | Fix actor_id mapping bug | ✅ Deployed |
| **20251015010000_fix_undo_profile_update_safety.sql** | Add version checking, parent validation, idempotency, locking | ✅ Deployed |
| **20251015020000_fix_undo_profile_delete_safety.sql** | Add idempotency, locking, version increment | ✅ Deployed |
| **20251015030000_fix_undo_cascade_delete_safety.sql** | Add safety checks to cascade undo | ✅ Deployed |
| **20251015040000_integrate_operation_groups_with_cascade_delete.sql** | Link cascade delete to operation_groups | ✅ Deployed |
| **20251015050000_fix_parent_validation_toctou.sql** | Fix parent locking TOCTOU vulnerability | ✅ Deployed |

### Supported Action Types

| Action Type | RPC Function | Admin Only | Time Limit | Dangerous |
|-------------|-------------|-----------|-----------|-----------|
| `profile_update` | `undo_profile_update` | ❌ | 30 days | ❌ |
| `profile_soft_delete` | `undo_profile_delete` | ❌ | 30 days | ❌ |
| `profile_cascade_delete` | `undo_cascade_delete` | ✅ | 7 days | ✅ |
| `add_marriage` | `undo_marriage_create` | ✅ | Unlimited | ✅ |
| `admin_update` | `undo_profile_update` | ❌ | 30 days | ❌ |
| `admin_delete` | `undo_profile_delete` | ❌ | 30 days | ❌ |

### Safety Mechanisms

**Version Conflict Prevention**:
- Checks current version vs expected version before undo
- Increments version after restore to prevent concurrent modifications
- Prevents overwriting newer changes with stale data
- Returns clear error message when version mismatch detected

**Parent Validation with Locking**:
- Locks parent profiles during validation (SELECT FOR UPDATE NOWAIT)
- Prevents orphan creation by verifying parent exists and is not deleted
- Eliminates TOCTOU (Time-of-Check-Time-of-Use) race conditions
- Maintains referential integrity throughout restore operation

**Idempotency Protection**:
- Checks `undone_at` timestamp before executing undo
- Prevents double-undo operations that could cause data corruption
- Shows friendly error message with timestamp when already undone
- Ensures operations can be safely retried without side effects

**Concurrent Operation Control**:
- Advisory locks (pg_advisory_xact_lock) for transaction-level coordination
- Row-level locks with NOWAIT for immediate failure on conflicts
- Clear error messages for lock conflicts ("عملية أخرى قيد التنفيذ")
- Prevents race conditions between multiple admin operations

**Batch Operation Tracking**:
- `operation_groups` table links related operations (cascade deletes)
- Cascade delete creates groups automatically via `admin_cascade_delete_profile`
- `undo_operation_group(group_id)` for atomic batch undo
- Maintains consistency across multi-profile operations

### Using the Undo System

**From Activity Log Dashboard**:
```javascript
import undoService from '../../services/undoService';

// Check if action can be undone
const permission = await undoService.checkUndoPermission(auditLogId, userProfileId);
if (permission.can_undo) {
  // Perform undo
  const result = await undoService.undoAction(auditLogId, userProfileId, actionType);
  if (result.success) {
    console.log(result.message);  // "تم التراجع بنجاح"
  }
}
```

**Helper Methods**:
```javascript
undoService.isDangerousAction(actionType)       // Returns true for cascade_delete, add_marriage
undoService.requiresAdminApproval(actionType)   // Returns true for admin-only operations
undoService.getActionDescription(actionType)    // Returns Arabic description
undoService.getUndoTimeRemaining(createdAt)     // Returns time remaining (30 days for users)
```

**Batch Undo (Operation Groups)**:
```javascript
// Undo entire cascade delete operation as a group
const result = await supabase.rpc('undo_operation_group', {
  p_group_id: operationGroupId,
  p_undo_reason: 'استرجاع جماعي للحذف المتسلسل'
});
// Returns: { success: true, restored_count: number }
```

### Permission Rules

- **Regular Users**: Can undo their own actions within 30 days
- **Admins/Super Admins**: Can undo any action, unlimited time
- **Dangerous Operations**: Require confirmation dialog (cascade delete, marriage operations)
- **Already Undone**: Cannot undo the same action twice (idempotency)

### Database Functions

1. **`check_undo_permission(p_audit_log_id, p_user_profile_id)`**
   - Returns: `{can_undo: boolean, reason: string}`
   - Checks user role, time limits, action type, and undone status

2. **`undo_profile_update(p_audit_log_id, p_undo_reason)`**
   - Restores profile data from `old_data` in audit log
   - Version conflict prevention (checks current vs expected version)
   - Parent validation with locking (for father_id, mother_id changes)
   - Idempotency protection (checks undone_at)
   - Creates new audit entry for the undo action

3. **`undo_profile_delete(p_audit_log_id, p_undo_reason)`**
   - Clears `deleted_at` to restore soft-deleted profile
   - Idempotency protection (checks undone_at and current deleted_at)
   - Row-level locking with NOWAIT
   - Version increment after restore
   - Creates new audit entry for restoration

4. **`undo_cascade_delete(p_audit_log_id, p_undo_reason)`**
   - Restores entire family subtree using `batch_id`
   - Admin-only, 7-day time limit
   - Idempotency protection across all descendants
   - Advisory locking for batch coordination
   - Returns count of restored profiles

5. **`undo_marriage_create(p_audit_log_id, p_undo_reason)`**
   - Soft deletes incorrectly created marriage
   - Admin-only operation
   - Creates audit trail for marriage deletion

6. **`undo_operation_group(p_group_id, p_undo_reason)`**
   - Batch undo for operation groups (cascade deletes)
   - Atomically undoes all operations in group
   - Returns restored_count for UI feedback

### Known Limitations

- **Descendant Version Checking**: Cascade undo doesn't validate each descendant's version (acceptable risk - admin-only operation, rarely concurrent edits on deleted profiles)
- **Parent Lock Duration**: Holds parent locks during entire restore transaction (acceptable - rare operation, typical duration <100ms)
- **No Rollback for Partial Failures**: If batch undo fails midway, completed undos remain (mitigated by transaction atomicity and idempotency)

### UI Features

- **Undo Button**: Appears on undoable activity log entries
- **Dangerous Badge**: ⚠️ Warning icon for dangerous operations
- **Confirmation Dialog**: Shown before dangerous operations with clear warnings
- **Loading States**: Activity indicator during undo operation
- **Arabic Messages**: All errors and success messages in Arabic
- **Disabled State**: Shows "تم التراجع" badge when already undone

### Testing

See comprehensive test checklist: [`/docs/UNDO_SYSTEM_TEST_CHECKLIST.md`](docs/UNDO_SYSTEM_TEST_CHECKLIST.md)

### Architecture

**Registry Pattern** in `undoService.js`:
- `ACTION_TYPE_CONFIG` maps each action type to its RPC function
- No substring matching - explicit whitelist for safety
- Type-safe with built-in safety flags (dangerous, requiresAdmin, timeLimitDays)

**Audit Trail**:
- Every undo creates a new audit log entry with action_type 'undo'
- Original entry marked with `undone_at`, `undone_by`, `undo_reason`
- Full traceability of who undid what, when, and why
- Permanent record for compliance and debugging

**Operation Groups**:
- Links related operations (cascade deletes) for batch undo
- `operation_groups` table with group_id, description, created_at
- Foreign key from `audit_log` to `operation_groups` (optional)
- Enables "Undo All" functionality for complex operations

## 📰 News Screen Additions (January 2025)

- Added Najdi Sadu color tokens to `src/components/ui/tokens.js`
- Cached WordPress news service (`src/services/news.ts`) with 24h TTL
- Reusable news UI primitives (FeaturedNewsCarousel, NewsCard, RecentArticleItem)
- NewsScreen with Gregorian/Hijri headers, infinite scroll, shimmer loading

## 🚀 Over-The-Air (OTA) Updates (January 2025)

**📖 Full Documentation**: [`/docs/OTA_UPDATES.md`](docs/OTA_UPDATES.md)

**Status**: ✅ Configured and ready to use

### Quick Summary

Deploy JavaScript, styling, and asset changes to users in **minutes** without App Store review. Critical for rapid bug fixes, UI tweaks, and feature iterations.

### What Can Be Updated OTA

**✅ Update instantly (no rebuild):**
- JavaScript logic (permission calculations, undo system)
- Styling & colors (Najdi Sadu palette)
- Arabic text & translations
- UI layouts & RTL fixes
- Supabase RPC calls
- Admin dashboard features
- Assets (images, fonts)

**❌ Requires App Store rebuild:**
- Native modules (`expo-camera`, `expo-notifications`)
- App permissions & configuration
- Expo SDK upgrades
- App icon, splash screen

### Daily Workflow

```bash
# 1. Fix bug or make change (JS/styling only)
code src/components/ProfileEdit.js

# 2. Test locally
npm start

# 3. Publish to preview (admin team tests)
npm run update:preview -- --message "Fix profile edit bug"

# 4. Publish to production (all users)
npm run update:production -- --message "Fix profile edit bug"

# 5. Users get update on next app open (minutes!)
```

### Available Commands

```bash
npm run update:preview -- --message "Your change"   # Preview channel
npm run update:production -- --message "Your change" # Production channel
npm run update:list                                  # List recent updates
npm run update:rollback                              # Emergency rollback
npm run update:view                                  # View channel status
```

### Emergency Rollback

```bash
# Published bad update? Rollback in 30 seconds
npm run update:rollback
# Select previous good update
# All users get old version on next app open
```

### Decision Tree

```
Changed native code? ──┬─ YES → Rebuild + App Store (days)
                       │
                       └─ NO → OTA Update (minutes)
```

### Monitoring

**Dashboard:** https://expo.dev/accounts/alqefari/projects/alqefari-family-tree

**Expected adoption:**
- 1 hour: 20-30%
- 6 hours: 50-60%
- 24 hours: 70-80%
- 48 hours: 85-95%

### Configuration

**Runtime version:** Manual string (bare workflow)
- Current: `"1.0.0"`
- Increment when adding native code or upgrading SDK
- Keep same for JS-only changes

**Update timeout:** 5 seconds
- App waits 5s for update download
- If slow network, starts with cached version
- Update downloads in background and applies on next restart

_See full documentation: [`/docs/OTA_UPDATES.md`](docs/OTA_UPDATES.md)_

---

## 📱 WhatsApp Message Template System (January 2025)

**📖 Full Documentation**: [`/docs/MESSAGE_TEMPLATE_SYSTEM.md`](docs/MESSAGE_TEMPLATE_SYSTEM.md)

Unified, registry-based system for managing all WhatsApp contact messages with dynamic variable replacement.

### Quick Start
```typescript
// 1. Add to MESSAGE_TEMPLATES in templateRegistry.ts
{
  id: 'my_template',
  name: 'اسم القالب',
  defaultMessage: 'مرحباً {name_chain}، جوالك {phone}',
  category: 'support',
  variables: ['name_chain', 'phone'],
}

// 2. Use in components
const { openWhatsApp } = useMessageTemplate();
await openWhatsApp('my_template', profile);
```

### Key Features
- Registry-based: `src/services/messageTemplates/templateRegistry.ts`
- Variable replacement: `{name_chain}`, `{phone}`, `{hid}` auto-filled
- Admin UI: Admin Dashboard → "قوالب الرسائل"
- Type-safe: Full TypeScript support

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
