# Quick Start Guide

**Essential commands and critical patterns for Alqefari Family Tree development.**

---

## 🚀 Development Commands

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

---

## 🔑 Critical Patterns

### Database Operations (MCP Only)
**All backend operations MUST use Supabase MCP tools:**
- ✅ Queries → `mcp__supabase__execute_sql`
- ✅ Migrations → `mcp__supabase__apply_migration`
- ✅ Schema → `mcp__supabase__list_tables`
- ❌ NO Bash/psql/supabase CLI

### RTL Support
```javascript
// The app runs in native RTL mode (I18nManager.forceRTL(true))
// ✅ CORRECT: Write layouts as if for LTR
flexDirection: "row"        // React Native flips automatically
textAlign: "left"           // Becomes right in RTL
alignItems: "flex-start"    // Auto-flipped

// ❌ WRONG: Don't manually flip
flexDirection: "row-reverse"  // Don't do this
textAlign: "right"            // Don't do this
```

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

### Version Control & Optimistic Locking
```javascript
// Always include version field
const reorderOps = children.map((child, index) => ({
  id: child.id,
  new_sibling_order: index,
  version: child.version ?? 1  // Handles null/undefined
}));

// Check for version conflicts
if (error?.message.includes('version')) {
  Alert.alert('خطأ', 'تم تحديث البيانات من قبل مستخدم آخر');
  loadChildren();  // Reload to sync
  return;
}
```

---

## 📝 Git Workflow

### Commit Immediately After Changes
```bash
git add -A
git commit -m "type: Specific description"

# Commit types: feat, fix, refactor, docs, test, chore
```

### Examples
- ✅ `fix: Restore recursive CTE in search_name_chain`
- ✅ `feat: Add crop fields to search RPC`
- ❌ `update code` (too vague)

---

## 🎨 Design System Essentials

### Najdi Sadu Colors
```javascript
import tokens from './src/components/ui/tokens';

tokens.colors.alJassWhite      // #F9F7F3 (background)
tokens.colors.camelHairBeige   // #D1BBA3 (containers)
tokens.colors.saduNight        // #242121 (text)
tokens.colors.najdiCrimson     // #A13333 (primary)
tokens.colors.desertOchre      // #D58C4A (secondary)
```

### Spacing (8px grid)
```javascript
tokens.spacing.xs   // 8
tokens.spacing.sm   // 12
tokens.spacing.md   // 16
tokens.spacing.lg   // 20
tokens.spacing.xl   // 24
tokens.spacing.xxl  // 32
```

### Typography
```javascript
tokens.typography.body          // 17 (iOS standard)
tokens.typography.bodyLarge     // 20
tokens.typography.title3        // 22
tokens.typography.title2        // 28
tokens.typography.largeTitle    // 34
```

---

## ⚠️ Critical Rules

### 1. Migration Workflow (MANDATORY)
```bash
# ✅ CORRECT WORKFLOW
1. Write tool → supabase/migrations/YYYYMMDDHHMMSS_name.sql
2. mcp__supabase__apply_migration with same SQL
3. Test in database + app
4. Git commit

# ❌ WRONG: Never apply migration without saving .sql file first!
```

**Why**: Oct 18, 2025 incident - 44 profiles corrupted from violating this rule.

### 2. Batch Operations > Loops
```javascript
// ✅ CORRECT: Single batch RPC (atomic + fast)
await supabase.rpc('admin_batch_reorder_children', {
  p_reorder_operations: reorderOps,
  p_parent_id: parentId
});

// ❌ WRONG: Loop RPC calls from frontend
for (const child of children) {
  await supabase.rpc('update_child', { ... });  // Slow + partial failure risk
}
```

### 3. Always Include Version Field
```javascript
// ✅ CORRECT
SELECT id, first_name, version FROM profiles WHERE id = 'xyz';

// ❌ WRONG (missing version = no optimistic locking)
SELECT id, first_name FROM profiles WHERE id = 'xyz';
```

---

## 🔧 Troubleshooting

### "Add whatsapp to LSApplicationQueriesSchemes"
→ Add to `app.json` (NOT Info.plist), then rebuild native app

### "Permission check failed"
→ Check network, verify profile.id (NOT auth.user.id)

### "Function is not unique"
→ Migration file saved but not applied to database. Apply it with MCP tool.

### "Version conflict" error
→ Profile was edited by another user. Reload and try again.

---

## 📚 Full Documentation

- **[CLAUDE.md](../CLAUDE.md)** - Main development guide with quick references
- **[Design System](DESIGN_SYSTEM.md)** - Complete color palette, typography, components
- **[Permission System](PERMISSION_SYSTEM_V4.md)** - Family-based edit permissions & roles
- **[Migration Guide](MIGRATION_GUIDE.md)** - Database migration workflow
- **[Field Mapping](FIELD_MAPPING.md)** - RPC function maintenance
- **[Git Workflow](development/GIT_WORKFLOW.md)** - Commit conventions & best practices
- **[OTA Updates](OTA_UPDATES.md)** - Over-the-air deployment guide

---

_Start here for quick development. See full docs for detailed implementation guides._
