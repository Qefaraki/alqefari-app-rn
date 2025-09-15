# Alqefari Family Tree - Design System & Development Guide

## 🎨 Design Language: "Modern Arabic Elegance"

A premium design system combining iOS Human Interface Guidelines with Arabic-first considerations, creating a sophisticated and culturally appropriate family tree experience.

### Color Palette (60-30-10 Rule)

#### Dominant (60%): Background
- **Lavender Gray** `#F5F3F7` - Main screen backgrounds
- Creates clean, airy canvas that doesn't strain eyes
- Usage: All screen backgrounds, empty states

#### Secondary (30%): Primary & Secondary
- **African Violet** `#957EB5` - Primary brand color
  - Primary buttons, navigation headers, selected states
  - Important icons and active elements
- **Chinese Violet** `#736372` - Secondary interactions
  - Secondary buttons, card borders, inactive tabs
  - Supporting UI components

#### Text & Content
- **Licorice** `#120309` - All text content
  - Soft black for excellent readability
  - Body text, labels, descriptions

#### Accent (10%): Highlights
- **Muted Gold** `#E0C4A1` - Special emphasis
  - Notification badges, success states
  - Progress indicators, special achievements
  - Direct ancestor highlights in tree view

### Typography System

```javascript
// Text Hierarchy
title: {
  fontSize: 22,
  fontWeight: "700",
  fontFamily: "SF Arabic",
  color: "#120309",
  letterSpacing: -0.5,
}

subtitle: {
  fontSize: 15,
  fontWeight: "400",
  fontFamily: "SF Arabic",
  color: "#736372",
  lineHeight: 22,
}

body: {
  fontSize: 16,
  fontWeight: "500",
  fontFamily: "SF Arabic",
  color: "#120309",
}

caption: {
  fontSize: 13,
  fontWeight: "500",
  fontFamily: "SF Arabic",
  color: "#736372",
}
```

### Spacing System (8px Grid)

- **Extra Small**: 4px
- **Small**: 8px
- **Medium**: 16px
- **Large**: 24px
- **Extra Large**: 32px
- **Page Margins**: 16px horizontal

### Component Patterns

#### Base Card
```javascript
card: {
  backgroundColor: "#FFFFFF",
  marginHorizontal: 16,
  marginVertical: 8,
  borderRadius: 16,
  padding: 24,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 3,
  borderWidth: 1,
  borderColor: "#736372" + "20", // 20% opacity
}
```

#### Primary Button
```javascript
primaryButton: {
  backgroundColor: "#957EB5",
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 32,
  minHeight: 48,
  alignItems: "center",
  justifyContent: "center",
}

primaryButtonText: {
  color: "#FFFFFF",
  fontSize: 16,
  fontWeight: "600",
  fontFamily: "SF Arabic",
}
```

#### Secondary Button
```javascript
secondaryButton: {
  backgroundColor: "#F5F3F7",
  borderWidth: 1.5,
  borderColor: "#736372",
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 32,
}

secondaryButtonText: {
  color: "#736372",
  fontSize: 16,
  fontWeight: "600",
}
```

#### Navigation Bar
```javascript
navigationBar: {
  backgroundColor: "#957EB5",
  paddingTop: safeAreaTop,
  paddingHorizontal: 16,
  paddingBottom: 12,
}

navigationTitle: {
  color: "#FFFFFF",
  fontSize: 20,
  fontWeight: "700",
}
```

### Icon System

- **Primary Icons**: Use `#957EB5` for important actions
- **Secondary Icons**: Use `#736372` for supporting elements
- **Accent Icons**: Use `#E0C4A1` for special highlights
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
  borderLeftColor: "#E0C4A1", // Gold accent for family
}
```

#### Tree Node
```javascript
treeNode: {
  backgroundColor: "#FFFFFF",
  borderRadius: 12,
  borderWidth: 2,
  borderColor: "#736372",
  padding: 12,
  minWidth: 120,
}

// Direct ancestor gets gold highlight
directAncestor: {
  borderColor: "#E0C4A1",
  backgroundColor: "#E0C4A1" + "10", // 10% opacity
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
When you change code, ALWAYS check if you need to update:
- `CLAUDE.md` - For design system changes
- `agents.md` - For implementation guidelines
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

# The user should NEVER see SQL deployment instructions
```

### Database Change Workflow
1. Write SQL migration file
2. Deploy it myself using execute-sql.js
3. Verify deployment succeeded
4. Commit the migration file
5. Never ask user to run SQL manually

## 🔒 Security

- Never expose service role keys
- Use RPC functions for admin operations
- Implement row-level security (RLS)
- Validate all inputs

## 📚 Reference

- **Design Inspiration**: iOS Settings, WhatsApp, Linear
- **Typography**: SF Arabic for all Arabic text
- **Icons**: Ionicons for consistency
- **Testing**: Physical iOS device required for gestures

---

_This design system ensures consistency, cultural appropriateness, and premium feel throughout the Alqefari Family Tree app._