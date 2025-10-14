# Alqefari Family Tree - Development Guide

## 📖 Documentation Index

- **[Design System](docs/DESIGN_SYSTEM.md)** - Najdi Sadu color palette, typography, components
- **[Permission System](docs/PERMISSION_SYSTEM_V4.md)** - Family-based edit permissions & roles
- **[Field Mapping](docs/FIELD_MAPPING.md)** - RPC function field maintenance
- **[Migration Guide](docs/MIGRATION_GUIDE.md)** - Database migration details
- **[Soft Delete Pattern](docs/SOFT_DELETE_PATTERN.md)** - Soft delete & optimistic locking
- **[Message Templates](docs/MESSAGE_TEMPLATE_SYSTEM.md)** - WhatsApp template system

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

# Database Migrations (Supabase CLI)
supabase db push                     # Push local migrations to remote
supabase db pull                     # Pull remote schema changes
supabase migration new <name>        # Create new timestamped migration
supabase migration list              # View migration status

# Validation
SELECT * FROM admin_validation_dashboard();
SELECT * FROM admin_auto_fix_issues();
```

## 📄 PDF Export System

The app includes comprehensive PDF export for Arabic-first family tree reports:

### Available Exports
1. **Full Family Tree** - All profiles organized by generation
2. **Individual Profile** - Single person report with relationships
3. **Munasib Report** - Profiles of spouses married into the family

### Usage
```javascript
import pdfExportService from './services/pdfExport';

await pdfExportService.exportFamilyTreePDF({
  title: "شجرة عائلة القفاري",
  includePhotos: true,
  includeMunasib: true
});
```

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

## ⚠️ Supabase CLI Migration Workflow

### CRITICAL: Use Supabase CLI for ALL Migrations

**Migration files MUST follow the timestamp naming pattern:**
- ✅ `20250114120000_descriptive_name.sql` (YYYYMMDDHHmmss format)
- ❌ `005_migration_name.sql` (old format - NOT recognized by CLI)

### Standard Workflow
```bash
# 1. Create new migration with automatic timestamp
supabase migration new descriptive_name

# 2. Write SQL in the generated file
# File will be created in supabase/migrations/

# 3. Push to remote database
supabase db push

# 4. Verify deployment
supabase migration list
```

### Migration Naming Rules
- **Timestamp format**: `YYYYMMDDHHmmss` (e.g., `20250114120530`)
- **Underscore separator**: `_` between timestamp and name
- **Descriptive names**: Use clear, concise descriptions
- **SQL extension**: Must end with `.sql`

### Troubleshooting
If migrations fail to push:
1. Check file naming matches pattern: `supabase migration list`
2. Ensure project is linked: `supabase link --project-ref <ref>`
3. Verify migration history: `supabase db pull` (if needed)

**Never use custom scripts or manual SQL execution - always use the CLI.**

## 🛠️ Tool Usage Constraints

### CRITICAL: MCP and CLI Only

**I MUST only use MCP servers and CLI tools. If they fail:**
- ✅ Use Supabase MCP for database queries
- ✅ Use CLI commands (npm, git, etc.) for development tasks
- ❌ DO NOT look for alternative methods or workarounds
- ❌ DO NOT try to access Supabase through other means
- ❌ DO NOT attempt to create custom scripts to bypass limitations

### When Tools Fail
If MCP or CLI tools don't work:
1. **Tell the user exactly what needs to be done**
2. **Wait for their response**
3. **Do not attempt alternatives**

### No Fallback Strategies
- If database queries fail → Tell user what SQL to run
- If file operations fail → Tell user what to check
- If deployments fail → Tell user what to deploy
- Never attempt to work around tool limitations

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

### Field Mapping Checklist

When adding a **new column** to `profiles` table:
- [ ] `ALTER TABLE profiles ADD COLUMN`
- [ ] Update `get_branch_data()` - RETURNS TABLE + all SELECT statements
- [ ] Update `search_name_chain()` - RETURNS TABLE + all SELECT statements
- [ ] Update `admin_update_profile()` - whitelist
- [ ] Test in app - verify field persists

_See full documentation: [`/docs/FIELD_MAPPING.md`](docs/FIELD_MAPPING.md)_

### Deployment Order
```bash
# Check deployed migrations
supabase migration list

# Push pending migrations
supabase db push

# View migration details
supabase migration list --debug
```

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

## 📰 News Screen Additions (January 2025)

- Added Najdi Sadu color tokens to `src/components/ui/tokens.js`
- Cached WordPress news service (`src/services/news.ts`) with 24h TTL
- Reusable news UI primitives (FeaturedNewsCarousel, NewsCard, RecentArticleItem)
- NewsScreen with Gregorian/Hijri headers, infinite scroll, shimmer loading

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
