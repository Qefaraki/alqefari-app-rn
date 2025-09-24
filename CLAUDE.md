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

```javascript
// Text Hierarchy
title: {
  fontSize: 22,
  fontWeight: "700",
  fontFamily: "SF Arabic",
  color: "#242121", // Sadu Night
  letterSpacing: -0.5,
}

subtitle: {
  fontSize: 15,
  fontWeight: "400",
  fontFamily: "SF Arabic",
  color: "#242121CC", // Sadu Night 80%
  lineHeight: 22,
}

body: {
  fontSize: 16,
  fontWeight: "500",
  fontFamily: "SF Arabic",
  color: "#242121", // Sadu Night
}

caption: {
  fontSize: 13,
  fontWeight: "500",
  fontFamily: "SF Arabic",
  color: "#24212199", // Sadu Night 60%
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

## 📰 News Screen Additions (January 2025)

- Added Najdi Sadu color tokens to `src/components/ui/tokens.js` (`tokens.colors.najdi`) for quick access to Al-Jass, Camel Hair, Najdi Crimson, and Desert Ochre across new components.
- Introduced cached WordPress news service (`src/services/news.ts`) with 24h TTL and background refresh.
- Created reusable news UI primitives (`FeaturedNewsCarousel`, `NewsCard`, `RecentArticleItem`) that lean on the Najdi palette and subtle Sadu patterns.
- Added `NewsScreen` with localized Gregorian/Hijri headers, Expo-router tab integration, proactive prefetching/infinite scroll, shimmer loading states, and link-out article viewing.

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
