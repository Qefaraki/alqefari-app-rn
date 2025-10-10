# Alqefari Family Tree - Design System & Development Guide

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

_See full documentation in [Permission System & User Roles](#-permission-system--user-roles) section below._

## 🎨 Design Language: "Najdi Sadu"

A culturally authentic design system inspired by Najdi Sadu weaving traditions, creating a warm, sophisticated, and uniquely Saudi family tree experience.

### Color Palette (60-30-10 Rule)

#### Dominant (60%): Background

- **Al-Jass White** `#F9F7F3` - Primary background
  - All screens, pages, and modals
  - Clean canvas with warm undertones

#### Secondary (30%): Containers

- **Camel Hair Beige** `#D1BBA3` - Content containers
  - Cards, sidebars, input fields
  - Visually distinct from primary background

#### Text & Base Elements

- **Sadu Night** `#242121` - All text content
  - Body copy, headlines, labels
  - High contrast without pure black harshness

#### Primary Accent (10%): Actions

- **Najdi Crimson** `#A13333` - Primary actions
  - Main buttons, important links
  - Active navigation states
  - Critical notifications

#### Secondary Accent: Highlights

- **Desert Ochre** `#D58C4A` - Secondary emphasis
  - Secondary icons, tags
  - Progress bars, warm accents
  - Non-competing highlights

### Typography System

**iOS-Standard Scale** - Use these exact sizes for consistency:

```javascript
// iOS Text Styles (from tokens.js)
largeTitle: {
  fontSize: 34,
  fontWeight: "700",
  lineHeight: 41,
  fontFamily: "SF Arabic",
  color: "#242121", // Sadu Night
}

title2: {
  fontSize: 22,
  fontWeight: "700",
  lineHeight: 28,
  fontFamily: "SF Arabic",
  color: "#242121",
}

title3: {
  fontSize: 20,
  fontWeight: "600",
  lineHeight: 25,
  fontFamily: "SF Arabic",
  color: "#242121",
}

body: {
  fontSize: 17,
  fontWeight: "400",
  lineHeight: 22,
  fontFamily: "SF Arabic",
  color: "#242121",
}

subheadline: {
  fontSize: 15,
  fontWeight: "400",
  lineHeight: 20,
  fontFamily: "SF Arabic",
  color: "#242121CC", // Sadu Night 80%
}

footnote: {
  fontSize: 13,
  fontWeight: "400",
  lineHeight: 18,
  fontFamily: "SF Arabic",
  color: "#24212199", // Sadu Night 60%
}

caption1: {
  fontSize: 12,
  fontWeight: "400",
  lineHeight: 16,
  fontFamily: "SF Arabic",
  color: "#24212199",
}
```

**Valid iOS Font Sizes**: 11, 12, 13, 15, 17, 20, 22, 28, 34
**Never use**: 14, 16, 18, 19 (non-standard)

### Spacing System (8px Grid)

**iOS-Standard Scale** - Use these exact values:

- **XXS**: 4px
- **XS**: 8px
- **Small**: 12px
- **Medium**: 16px
- **Large**: 20px
- **XL**: 24px
- **XXL**: 32px
- **Touch Target**: 44px minimum (all interactive elements)
- **Page Margins**: 16px horizontal

**Never use**: 6px, 10px, 14px, 18px (breaks 8px grid rhythm)

### Component Patterns

#### Base Card

```javascript
card: {
  backgroundColor: "#F9F7F3", // Al-Jass White
  marginHorizontal: 16,
  marginVertical: 8,
  borderRadius: 12,
  padding: 24,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
  elevation: 3,
  borderWidth: 1,
  borderColor: "#D1BBA3" + "40", // Camel Hair Beige 40%
}
```

#### Primary Button

```javascript
primaryButton: {
  backgroundColor: "#A13333", // Najdi Crimson
  borderRadius: 10,
  paddingVertical: 14,
  paddingHorizontal: 32,
  minHeight: 48,
  alignItems: "center",
  justifyContent: "center",
}

primaryButtonText: {
  color: "#F9F7F3", // Al-Jass White
  fontSize: 16,
  fontWeight: "600",
  fontFamily: "SF Arabic",
}
```

#### Secondary Button

```javascript
secondaryButton: {
  backgroundColor: "transparent",
  borderWidth: 1.5,
  borderColor: "#D1BBA3", // Camel Hair Beige
  borderRadius: 10,
  paddingVertical: 14,
  paddingHorizontal: 32,
}

secondaryButtonText: {
  color: "#242121", // Sadu Night
  fontSize: 16,
  fontWeight: "600",
}
```

#### Input Field

```javascript
inputField: {
  backgroundColor: "#D1BBA3" + "20", // Camel Hair Beige 20%
  borderWidth: 1,
  borderColor: "#D1BBA3" + "40",
  borderRadius: 8,
  paddingVertical: 12,
  paddingHorizontal: 16,
  fontSize: 16,
  color: "#242121",
}

inputFieldFocused: {
  borderColor: "#A13333", // Najdi Crimson on focus
}
```

### Sadu Pattern Usage

Sadu patterns should enrich the design without compromising readability:

#### Permitted Uses:

- **Background Textures**: Hero sections at 5-10% opacity
- **Decorative Borders**: UI cards or section dividers
- **Element Fills**: Profile avatars, decorative placeholders
- **Loading States**: Subtle pattern animations

#### Restrictions:

- Never over text content
- Maximum 10% opacity for backgrounds
- Use sparingly for cultural accent

### Icon System

- **Primary Icons**: Use `#A13333` (Najdi Crimson) for actions
- **Secondary Icons**: Use `#242121` (Sadu Night) for navigation
- **Accent Icons**: Use `#D58C4A` (Desert Ochre) for highlights
- **Icon Sizes**: 20px (small), 24px (default), 28px (large)

### Interactive States

#### Touch Feedback

- **Cards**: `activeOpacity: 0.95`
- **Buttons**: `activeOpacity: 0.8`
- **List Items**: `activeOpacity: 0.7`

#### Focus States

- Add `#957EB5` border with 2px width
- Include 4px focus ring with 20% opacity

#### Disabled States

- 40% opacity on all elements
- Remove shadows and borders

### Animation Values

- **Quick**: 200ms (micro-interactions)
- **Normal**: 300ms (standard transitions)
- **Slow**: 500ms (page transitions)
- **Easing**: `ease-out` for most animations
- **Spring**: Use for playful elements

### Design Principles

1. **Generous White Space**: Never cramped, always breathing room
2. **Clear Hierarchy**: Important elements stand out naturally
3. **Cultural Sensitivity**: RTL-first, Arabic typography considerations
4. **Accessibility**: 44px minimum touch targets, high contrast
5. **Consistency**: Same patterns throughout the app

### Family-Specific Elements

#### Family Member Card

```javascript
memberCard: {
  ...baseCard,
  borderLeftWidth: 4,
  borderLeftColor: "#D58C4A", // Desert Ochre accent
}
```

#### Tree Node

```javascript
treeNode: {
  backgroundColor: "#F9F7F3", // Al-Jass White
  borderRadius: 10,
  borderWidth: 2,
  borderColor: "#D1BBA3",
  padding: 12,
  minWidth: 120,
}

// Direct ancestor highlight
directAncestor: {
  borderColor: "#A13333", // Najdi Crimson
  backgroundColor: "#A13333" + "08", // 8% opacity
}
```

## 📱 Development Commands

```bash
# Development
npm start          # Expo dev server
npm run ios        # iOS simulator
npm run android    # Android emulator

# Database
node scripts/execute-sql.js <file>  # Deploy SQL to Supabase

# Validation
SELECT * FROM admin_validation_dashboard();
SELECT * FROM admin_auto_fix_issues();
```

## 📄 PDF Export System

The app includes a comprehensive PDF export service for generating Arabic-first family tree reports:

### Available Exports

1. **Full Family Tree** - All profiles organized by generation
2. **Individual Profile** - Single person report with relationships
3. **Munasib Report** - Profiles of spouses married into the family

### Export Service Usage

```javascript
import pdfExportService from './services/pdfExport';

// Export full family tree
await pdfExportService.exportFamilyTreePDF({
  title: "شجرة عائلة القفاري",
  includePhotos: true,
  includeMunasib: true
});

// Export Munasib report
await pdfExportService.exportMunasibReport();
```

### PDF Features

- RTL Arabic typography with Noto Naskh font
- Generation-based organization
- Statistics (total count, gender breakdown)
- Photo inclusion (optional)
- Munasib highlighting
- Sharing via iOS/Android native share

## 👥 Munasib Management System

Full management dashboard for Munasib (spouse) profiles:

### Features

- **Search & Filter**: Find Munasib by name, phone, location
- **Family Statistics**: Ranked list of most common family origins
- **Marriage Connections**: See which Al-Qefari member they're married to
- **Export to PDF**: Generate Munasib-specific reports

### Identifying Munasib

```javascript
// Munasib profiles have NULL HID
const isMunasib = profile.hid === null;
```

### Component Location

`src/components/admin/MunasibManager.js` - Accessible from admin dashboard

## 🏗 Project Structure

```
src/
├── components/      # Reusable UI components
│   ├── ui/         # Design system components
│   └── admin/      # Admin-only features
│       └── MunasibManager.js  # Munasib management dashboard
├── screens/        # App screens
├── services/       # API & Supabase
│   └── pdfExport.js  # PDF generation service
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

## 🎯 Component Examples

### Hero Card (Sign-in, Welcome)

```javascript
<View style={styles.heroCard}>
  <View style={styles.iconContainer}>
    <Ionicons name="moon" size={28} color="#957EB5" />
  </View>
  <Text style={styles.heroTitle}>انضم إلى عائلة القفاري</Text>
  <Text style={styles.heroSubtitle}>تواصل مع عائلتك</Text>
  <TouchableOpacity style={styles.primaryButton}>
    <Text style={styles.primaryButtonText}>تسجيل الدخول</Text>
  </TouchableOpacity>
</View>
```

### Profile Card

```javascript
<TouchableOpacity style={styles.profileCard}>
  <Image source={profileImage} style={styles.profileImage} />
  <View style={styles.profileInfo}>
    <Text style={styles.profileName}>{name}</Text>
    <Text style={styles.profileDetail}>{phone}</Text>
  </View>
  <Ionicons name="chevron-forward" size={20} color="#736372" />
</TouchableOpacity>
```

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

## ⚠️ Supabase Deployment Rules

### CRITICAL: NEVER Ask User to Deploy

**I MUST deploy all database changes myself. NEVER tell the user to:**

- ❌ "Run this in Supabase Dashboard"
- ❌ "Go to Supabase and execute this"
- ❌ "You need to deploy this SQL"

### Always Deploy Automatically

```bash
# I will ALWAYS run these myself:
node scripts/execute-sql.js migrations/new-migration.sql

# If that fails, I'll create a direct deploy script
node scripts/direct-deploy.js

# ONLY after 5 failed attempts: Copy SQL to clipboard
# NEVER ask user to find it themselves
```

### Database Change Workflow

1. Write SQL migration file
2. Deploy it myself using execute-sql.js
3. Verify deployment succeeded
4. Commit the migration file
5. Never ask user to run SQL manually

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

Example:
- "The Supabase MCP isn't connecting. You need to create a Personal Access Token in your Supabase dashboard."
- "The npm command failed. Please run `npm install` manually and let me know when it's complete."

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

The app uses a family-relationship-based permission system with three circles:

| Permission Level | Edit Rights | Auto-Approve | Example Relationships |
|-----------------|-------------|--------------|---------------------|
| `inner` | Direct edit | N/A | Self, spouse, parents, children, siblings, all descendants |
| `family` | Suggest only | 48 hours | Cousins, aunts/uncles (shared grandparent) |
| `extended` | Suggest only | Manual | Distant Al Qefari relatives |
| `admin`/`moderator` | Direct edit | N/A | Admin role or branch moderator |
| `blocked` | None | Never | Explicitly blocked users |

### Key Function

```javascript
// Check permission level for a user to edit a profile
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

**See full documentation for**: Database schema, API reference, testing, troubleshooting
- **Version Control**: All edits tracked with versions for rollback

### UI Components

1. **PermissionManager** (`src/components/admin/PermissionManager.js`)
   - Super admin interface for role management
   - Name chain search
   - Branch moderator assignment

2. **SuggestionModal** (`src/components/SuggestionModal.js`)
   - Used by regular users to suggest edits
   - Shows current vs new values
   - Optional reason field

3. **SuggestionReviewManager** (`src/components/admin/SuggestionReviewManager.js`)
   - Admin interface for reviewing suggestions
   - Tabbed view (pending/approved/rejected)
   - Bulk actions support

### Common Workflows

#### Making Someone an Admin
1. Super admin opens Permission Manager
2. Searches for user by name
3. Selects user and changes role to "admin"
4. Change logged in audit trail

#### Assigning a Branch Moderator
1. Super admin identifies family branch head
2. Assigns user as moderator for that branch
3. User can now edit entire subtree
4. Assignment visible in their permissions summary

#### Handling Edit Suggestions
1. User suggests edit through profile sheet
2. Admin sees notification in dashboard
3. Reviews change (old vs new value)
4. Approves or rejects with reason
5. System applies change if approved
6. Audit log tracks entire flow

### Troubleshooting

**"ERROR: 23514: new row violates check constraint 'check_profile_role'"**
```sql
-- Two conflicting constraints exist, drop the old one:
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS check_profile_role;
-- Keep only 'check_valid_role' which allows super_admin
```

**"ERROR: 23514: audit_log violates check constraint 'audit_log_action_check'"**
```sql
-- The audit_log doesn't accept 'ROLE_CHANGE' action
-- Skip audit logging when changing roles for now
-- TODO: Update audit_log_action_check constraint
```

**"I don't see admin buttons"**
- Check your role: `SELECT role FROM profiles WHERE user_id = auth.uid()`
- Must be 'admin' or 'super_admin'
- Ensure migrations 005 and 006 are deployed
- Check if functions exist: `SELECT proname FROM pg_proc WHERE proname LIKE '%suggestion%'`

**"Permission Manager won't open"**
- Only super_admin role can access this feature
- Regular admins see "طلب صلاحية" instead
- Verify: `SELECT role FROM profiles WHERE id = 'your-profile-id'`

**"Functions missing after deployment"**
```sql
-- Check what functions exist:
SELECT proname FROM pg_proc
WHERE proname IN ('get_pending_suggestions', 'approve_suggestion',
                  'grant_admin_role', 'super_admin_search_by_name_chain');

-- If missing, redeploy migrations 005 and 006
```

**"MCP in read-only mode"**
- MCP server configured with `--read-only` flag
- Cannot use `apply_migration` function
- Solution: Copy SQL to clipboard and run manually in Supabase Dashboard

**"Can't find user by phone number"**
- Phone authentication stored in auth.users.phone
- Profile phone field may be NULL
- Use join: `profiles p JOIN auth.users au ON au.id = p.user_id`

## 🗄️ Database Migrations

### Critical Migrations for Permission System

#### Migration 005: Family Edit Permissions System
**File**: `migrations/005_family_edit_permissions_system.sql`

Creates the foundation for granular edit permissions:
- **Tables Created**:
  - `profile_suggestions` - Edit suggestions from non-admins
  - `profile_link_requests` - Requests to link new family members
- **Functions Created**:
  - `get_pending_suggestions()` - View pending edits
  - `approve_suggestion()` - Approve and apply edits
  - `reject_suggestion()` - Reject with notes
  - `get_pending_link_requests()` - View link requests
  - `approve_link_request()` - Approve connections
  - `reject_link_request()` - Reject with reason
- **Columns Added to profiles**:
  - `can_edit` - BOOLEAN (deprecated)
  - `is_moderator` - BOOLEAN
  - `moderated_branch` - TEXT (HID of branch)

#### Migration 006: Super Admin Permissions
**File**: `migrations/006_super_admin_permissions.sql`

Adds super admin role and management functions:
- **Functions Created**:
  - `grant_admin_role()` - Promote user to admin
  - `revoke_admin_role()` - Demote admin to user
  - `grant_moderator_role()` - Assign branch moderator
  - `revoke_moderator_role()` - Remove moderator
  - `super_admin_search_by_name_chain()` - Search with ancestry
- **Important Notes**:
  - Renamed search function to avoid collision
  - Only super_admin can call role management functions
  - All functions include authorization checks

#### Migration 077: Admin Update Marriage RPC
**File**: `migrations/077_admin_update_marriage.sql`

Secure RPC function for updating marriage records with permission checks:
- **Function Created**: `admin_update_marriage(p_marriage_id UUID, p_updates JSONB)`
- **Features**:
  - Permission check: User must have admin/moderator/inner permission on either spouse
  - Validates status values (only 'current' or 'past' allowed after migration 078)
  - Creates audit log entry for all changes
  - Uses whitelist approach for security
- **Important Notes**:
  - Replaces direct UPDATE on marriages table (blocked by RLS)
  - Includes DROP FUNCTION to avoid parameter name conflicts
  - Validates date fields and status values

#### Migration 078: Simplify Marriage Status Values
**File**: `migrations/078_simplify_marriage_status.sql`

**Status**: ✅ Deployed (January 2025)

Replaces stigmatizing marriage status terms with neutral language:
- **Old Values**: `'married'`, `'divorced'`, `'widowed'`
- **New Values**: `'current'` (حالي), `'past'` (سابق)

**Changes**:
1. Updates all existing records: married→current, divorced/widowed→past
2. Drops old constraint, adds new constraint accepting only current/past
3. Updates default value to 'current'
4. Adds documentation comment explaining the change

**Why This Migration**:
- Removes cultural stigma from marriage status terminology
- Simplifies UI (2 options instead of 3)
- More neutral and inclusive language

**App Code Updates Required**:
When this migration is deployed, **all app references to marriage status must be updated**:

Critical Files Updated (committed 2a7cde41f, ad643c193):
- ✅ `TabFamily.js` - Spouse filters and display
- ✅ `EditChildModal.js` - Mother selection
- ✅ `EditMarriageModal.js` - Status options (already done)
- ✅ `InlineSpouseAdder.js` - Default status on creation
- ✅ `profiles.js` - Default status in createMarriage
- ✅ `SpouseEditor.js` - Status options and logic
- ✅ `FatherSelectorSimple.js` - Status filter
- ✅ `MotherSelector.js` - is_current derivation
- ✅ Test files - Mock data updated

**Backward Compatibility**: App code now supports both old and new values during transition period.

**Common Issue**: If wives disappear after migration, check that spouse filters accept both 'current' AND 'married' values:
```javascript
// ✅ Correct
const activeSpouses = spouses.filter(s => s.status === 'current' || s.status === 'married');

// ❌ Wrong (causes wives to disappear)
const activeSpouses = spouses.filter(s => s.status === 'married');
```

### 🗑️ Soft Delete Pattern & Optimistic Locking

**Status**: ✅ Deployed and operational (January 2025)

The app uses soft deletion for profile records, combined with optimistic locking for concurrent edit protection.

#### Soft Delete Behavior

**What is Soft Delete?**
- Sets `deleted_at` timestamp instead of removing records from database
- Profile disappears from queries (`WHERE deleted_at IS NULL`)
- Data remains in database for audit trail and potential recovery
- **Reversible** - Admin can restore by setting `deleted_at` back to NULL

**Why Soft Delete?**
1. **Data Preservation** - Never lose family history data
2. **Audit Trail** - Track who deleted what and when
3. **Reversibility** - Mistakes can be undone
4. **Reference Integrity** - Foreign keys remain valid

#### Optimistic Locking with `p_version`

**What is Optimistic Locking?**
- Each profile has a `version` field that increments on every update
- `admin_update_profile()` requires `p_version` parameter
- Function checks if version matches before updating
- Prevents concurrent edits from overwriting each other

**Function Signature**:
```sql
admin_update_profile(
  p_id UUID,
  p_version INTEGER,  -- REQUIRED for optimistic locking
  p_updates JSONB
)
```

**Version Fallback Pattern**:
```javascript
// Always use fallback to handle profiles created before version tracking
const { error } = await supabase.rpc('admin_update_profile', {
  p_id: profile.id,
  p_version: profile.version || 1,  // Fallback to 1 if version is NULL
  p_updates: { name: 'New Name' }
});
```

#### Edge Cases & Warnings

**Descendant Orphaning**:
- Soft deleting a profile does NOT cascade to descendants
- Children/grandchildren remain in tree with NULL parent reference
- **Best Practice**: Check for descendants before deleting

**Example - Delete with Descendant Warning**:
```javascript
// From TabFamily.js:666-731
const handleDeleteChild = async (child) => {
  try {
    // 1. Check for descendants before deleting
    const { data: descendants } = await supabase
      .from('profiles')
      .select('id, name, gender')
      .or(`father_id.eq.${child.id},mother_id.eq.${child.id}`)
      .is('deleted_at', null);

    const descendantCount = descendants?.length || 0;

    // 2. Build warning message
    let message = `هل أنت متأكد من حذف ${child.name} من العائلة؟`;

    if (descendantCount > 0) {
      message += `\n\n⚠️ تحذير: لديه ${descendantCount} ${
        descendantCount === 1 ? 'طفل' : 'أطفال'
      }.\n\nملاحظة: الأطفال سيبقون في الشجرة لكن بدون والد ظاهر.`;
    }

    Alert.alert('تأكيد الحذف', message, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          // 3. Soft delete with optimistic locking
          const { error } = await supabase.rpc('admin_update_profile', {
            p_id: child.id,
            p_version: child.version || 1,
            p_updates: { deleted_at: new Date().toISOString() },
          });
          // ... handle error
        },
      },
    ]);
  } catch (err) {
    Alert.alert('خطأ', 'حدث خطأ أثناء التحقق من البيانات');
  }
};
```

#### Code Locations Using This Pattern

All locations **MUST** include `p_version` parameter when calling `admin_update_profile()`:

1. **TabFamily.js:700** - Delete child (soft delete)
2. **TabFamily.js:747** - Set mother (family relationship update)
3. **TabFamily.js:779** - Clear mother (family relationship update)
4. **EditChildModal.js:74** - Update child profile
5. **SelectMotherModal.js:97** - Update person's mother

**Common Error if `p_version` Missing**:
```
ERROR: "Could not find the function public.admin_update_profile(p_id, p_updates) in the schema cache"
HINT: "Perhaps you meant to call admin_update_profile(p_id, p_updates, p_version)"
```

**Fix**: Add `p_version: object.version || 1` to all RPC calls

#### Migration History

- **Migration 007**: Added `version` field to profiles table with optimistic locking
- **Migration 013**: Updated `admin_update_profile()` to require p_version parameter
- **Dropped 2-parameter version**: Only 3-parameter version exists now (p_id, p_version, p_updates)

### Deployment Order

Always deploy migrations in sequence:
```bash
# Check deployed migrations
SELECT version, name FROM migrations ORDER BY version;

# Deploy missing migrations
node scripts/execute-sql.js migrations/005_family_edit_permissions_system.sql
node scripts/execute-sql.js migrations/006_super_admin_permissions.sql

# Or use combined script
node scripts/execute-sql.js scripts/deploy-missing-admin-migrations.sql
```

### Known Issues

1. **Constraint Conflicts**: Old `check_profile_role` vs new `check_valid_role`
2. **Audit Log**: `audit_log_action_check` doesn't accept 'ROLE_CHANGE'
3. **MCP Read-Only**: Cannot deploy via MCP, must use clipboard method
4. **Search Function Collision**: Fixed by renaming to `super_admin_search_by_name_chain`

### ⚠️ CRITICAL: Field Mapping Maintenance

**Full Documentation**: [`/docs/FIELD_MAPPING.md`](docs/FIELD_MAPPING.md)

#### The Problem
When you add a new field to the `profiles` table, it will **save correctly but disappear on reload** unless you update ALL relevant RPC functions.

#### The "Weird Dance" (Now Fixed!)
This happened **3 times**:
1. **Titles**: Added `professional_title` → had to update 3 functions (migrations 012, 013)
2. **Achievements**: Added `achievements` & `timeline` → had to update 3 functions (migration 015)
3. **Next field?** → Use the checklist below!

#### The Checklist: "Add Once, Update Everywhere"

When adding a **new column** to `profiles` table:

- [ ] **1. profiles table** - `ALTER TABLE profiles ADD COLUMN new_field TYPE`
- [ ] **2. get_branch_data()** - Add to RETURNS TABLE + all 3 SELECT statements
- [ ] **3. search_name_chain()** - Add to RETURNS TABLE + all 3 SELECT statements
- [ ] **4. admin_update_profile()** - Add to UPDATE statement whitelist
- [ ] **5. Test in app** - Verify field persists across save/reload

#### Quick Test
```javascript
// 1. Save a field
await supabase.rpc('admin_update_profile', {
  p_updates: { your_new_field: 'test value' }
});

// 2. Reload profile
const profile = await supabase.rpc('get_branch_data', {...});

// 3. Check it's there
console.log(profile.your_new_field);  // Should NOT be undefined!
```

#### Reference Migrations
- **Migration 012**: `migrations/012_add_titles_to_rpc_functions.sql` - Title fields example
- **Migration 013**: `migrations/013_add_titles_to_admin_update_profile.sql` - Update function example
- **Migration 015**: `migrations/015_comprehensive_profile_fields.sql` - Complete coverage

**See [`docs/FIELD_MAPPING.md`](docs/FIELD_MAPPING.md) for step-by-step guide and examples.**

### Current System Status (January 2025)

- **Super Admin**: علي (phone: 966501669043, ID: ff239ed7-24d5-4298-a135-79dc0f70e5b8)
- **Authentication**: Phone-based only (no email logins)
- **Migrations Deployed**: 005, 006 (permission system), 012, 013, 015 (field mapping), 077, 078 (marriage status)
- **Admin Functions**: All 10 core functions deployed and operational
- **Constraint Status**: Fixed - only `check_valid_role` active
- **Field Coverage**: Migration 015 ensures all 41 profile fields are returned by RPC functions
- **Marriage Status**: Migration 078 deployed - uses 'current'/'past' terminology (January 2025)

## 📚 Reference

- **Design Inspiration**: iOS Settings, WhatsApp, Linear
- **Typography**: SF Arabic for all Arabic text
- **Icons**: Ionicons for consistency
- **Testing**: Physical iOS device required for gestures

---

_This design system ensures consistency, cultural appropriateness, and premium feel throughout the Alqefari Family Tree app._

## 📰 News Screen Additions (January 2025)

- Added Najdi Sadu color tokens to `src/components/ui/tokens.js` (`tokens.colors.najdi`) for quick access to Al-Jass, Camel Hair, Najdi Crimson, and Desert Ochre across new components.
- Introduced cached WordPress news service (`src/services/news.ts`) with 24h TTL and background refresh.
- Created reusable news UI primitives (`FeaturedNewsCarousel`, `NewsCard`, `RecentArticleItem`) that lean on the Najdi palette and subtle Sadu patterns.
- Added `NewsScreen` with localized Gregorian/Hijri headers, Expo-router tab integration, proactive prefetching/infinite scroll, shimmer loading states, and link-out article viewing.

## 📱 WhatsApp Message Template System (January 2025)

**Full Documentation**: [`/docs/MESSAGE_TEMPLATE_SYSTEM.md`](docs/MESSAGE_TEMPLATE_SYSTEM.md)

A unified, registry-based system for managing all WhatsApp contact messages with dynamic variable replacement.

### Quick Start

**Adding a new template**:
```typescript
// 1. Add to MESSAGE_TEMPLATES in templateRegistry.ts
{
  id: 'my_template',
  name: 'اسم القالب',
  defaultMessage: 'مرحباً {name_chain}، جوالك {phone}',
  category: 'support',
  variables: ['name_chain', 'phone'],
  // ... rest of config
}

// 2. Use in components
const { openWhatsApp } = useMessageTemplate();
await openWhatsApp('my_template', profile);
```

### Key Features

- **Registry-based**: Single source of truth (`src/services/messageTemplates/templateRegistry.ts`)
- **Variable replacement**: `{name_chain}`, `{phone}`, `{hid}`, etc. auto-filled from user profile
- **Admin UI**: Visual interface in Admin Dashboard → "قوالب الرسائل"
- **Type-safe**: Full TypeScript support with compile-time checks
- **Easy to extend**: Just add to registry, UI auto-generates

### Architecture

```
src/
├── services/messageTemplates/
│   ├── templateRegistry.ts    # Single source of truth
│   ├── templateService.ts     # Business logic
│   ├── variables.ts           # Common variables
│   └── types.ts               # TypeScript types
├── hooks/
│   └── useMessageTemplate.ts  # React hook
└── components/admin/
    └── MessageTemplateManager.tsx  # Admin UI
```

### Important: Name Chain Building

The system relies on `profile.fullNameChain` for proper ancestry display. The **AuthContext automatically builds this** when loading profiles:

```javascript
// AuthContextSimple.js builds fullNameChain on sign-in
const { data: allProfiles } = await supabase
  .from('profiles')
  .select('id, name, father_id, gender');

const fullChain = buildNameChain(profile, allProfiles);
profile.fullNameChain = fullChain;  // e.g., "محمد بن علي عبدالله القفاري"
```

### Current Templates

- **onboarding_help** - Help button on onboarding screen
- **article_suggestion** - Article viewer suggest button (`src/components/ArticleViewer/components/ArticleActions.tsx:56`)
- **contact_admin** - General admin contact
- **profile_link_request** - Profile linking requests
- **report_issue** - Bug reporting

### Common Issues

**"الاسم غير متوفر"**: Profile missing fullNameChain (AuthContext should build it automatically)

**"رقم الجوال غير متوفر"**: User's phone field is NULL in database

## 🚀 Multi-Agent Git Workflow

### CRITICAL: End-of-Session Protocol

When user says "ending for today" or similar, IMMEDIATELY:

1. Check commit count: `git rev-list --count origin/master..HEAD`
2. If > 20 commits → MUST merge today to prevent divergence
3. Run full audit from `END_OF_SESSION_PROTOCOL.md`

### Branch Strategy for Multiple Agents

- **One branch per session/feature** (not per agent)
- **Daily merges** to prevent divergence
- **Descriptive commits** with agent context: `feat(claude): Add feature X`
- **Maximum 20 commits** before mandatory merge

See `END_OF_SESSION_PROTOCOL.md` for complete checklist.
