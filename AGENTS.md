# Alqefari Family Tree - AI Agent Guidelines

## 🎨 Design System: "Modern Arabic Elegance"

When implementing any UI components, follow this comprehensive design language that combines iOS Human Interface Guidelines with Arabic-first considerations.

### Color Palette (60-30-10 Rule)

```javascript
const colors = {
  // Dominant (60%) - Backgrounds
  background: "#F5F3F7",     // Lavender Gray - Main screens
  
  // Secondary (30%) - Primary/Secondary Elements  
  primary: "#957EB5",        // African Violet - CTAs, headers
  secondary: "#736372",      // Chinese Violet - Secondary buttons
  
  // Text
  text: "#120309",           // Licorice - All text content
  textSecondary: "#736372",  // Chinese Violet - Muted text
  
  // Accent (10%) - Special Highlights
  accent: "#E0C4A1",         // Muted Gold - Badges, special states
  
  // System
  white: "#FFFFFF",
  error: "#DC2626",
  success: "#10B981",
  warning: "#F59E0B",
}
```

### Typography Hierarchy

```javascript
const typography = {
  title: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "SF Arabic",
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "400",
    fontFamily: "SF Arabic",
    color: colors.textSecondary,
    lineHeight: 22,
  },
  body: {
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.text,
  },
  caption: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SF Arabic",
    color: colors.textSecondary,
  },
}
```

### Component Templates

#### Base Card Component
```javascript
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
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
    borderColor: colors.secondary + "20", // 20% opacity
  }
});
```

#### Primary Button (Main Actions)
```javascript
primaryButton: {
  backgroundColor: colors.primary,
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 32,
  minHeight: 48,
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "row",
  gap: 8,
}
```

#### Secondary Button
```javascript
secondaryButton: {
  backgroundColor: colors.background,
  borderWidth: 1.5,
  borderColor: colors.secondary,
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 32,
  minHeight: 48,
}
```

#### Navigation Bar
```javascript
navigationBar: {
  backgroundColor: colors.primary,
  paddingTop: safeAreaTop,
  paddingHorizontal: 16,
  paddingBottom: 12,
}
```

### Spacing System (8px Grid)

Always use multiples of 8 for spacing:
- `4px` - Extra small (tight spacing)
- `8px` - Small (compact elements)
- `16px` - Medium (default spacing)
- `24px` - Large (section spacing)
- `32px` - Extra large (major sections)

### Family-Specific Elements

When working with family elements:

```javascript
// Family member card with gold accent
memberCard: {
  ...baseCard,
  borderLeftWidth: 4,
  borderLeftColor: colors.accent,
}

// Direct ancestor highlight
directAncestor: {
  borderColor: colors.accent,
  backgroundColor: colors.accent + "10", // 10% opacity
}

// Use family crest (moon icon)
<Ionicons name="moon" size={24} color={colors.primary} />

// Reference family name
import appConfig from "../config/appConfig";
const familyName = appConfig.family.primaryFamilyName; // القفاري
```

### Interactive States

```javascript
// Touch feedback
activeOpacity: {
  cards: 0.95,
  buttons: 0.8,
  listItems: 0.7,
}

// Focus states
focus: {
  borderWidth: 2,
  borderColor: colors.primary,
  shadowOpacity: 0.1,
}

// Disabled states
disabled: {
  opacity: 0.4,
}
```

### Animation Guidelines

```javascript
// Standard durations
const animations = {
  quick: 200,    // Micro-interactions
  normal: 300,   // Standard transitions
  slow: 500,     // Page transitions
}

// Always use ease-out
Animated.timing(value, {
  duration: animations.normal,
  easing: Easing.out(Easing.ease),
  useNativeDriver: true,
})
```

## 📋 Implementation Checklist

When creating any UI component:

- [ ] Uses color variables from palette (no hardcoded colors)
- [ ] Follows 8px spacing grid
- [ ] Implements 60-30-10 color distribution
- [ ] Supports RTL layout
- [ ] Has 44px minimum touch targets
- [ ] Includes proper shadows (0.05-0.08 opacity)
- [ ] Uses SF Arabic font for Arabic text
- [ ] Has loading state
- [ ] Has error state
- [ ] Border radius is 12-16px
- [ ] Tested on physical device

## 🚫 Common Mistakes to Avoid

1. ❌ Using iOS blue (`#007AFF`) - Use our primary violet
2. ❌ Random spacing (13px, 17px) - Use 8px grid
3. ❌ Heavy shadows - Keep under 0.08 opacity
4. ❌ Small touch targets - Minimum 44px
5. ❌ Missing RTL support
6. ❌ Inconsistent border radius
7. ❌ Not using family colors
8. ❌ Console.log in production
9. ❌ Hardcoded text - Use i18n
10. ❌ Missing loading/error states

## 🎯 Quick Component Template

```javascript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import appConfig from '../config/appConfig';

const MyComponent = () => {
  const familyName = appConfig.family.primaryFamilyName;
  
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>عائلة {familyName}</Text>
        <Ionicons name="moon" size={24} color="#957EB5" />
      </View>
      <Text style={styles.body}>محتوى البطاقة</Text>
      <TouchableOpacity 
        style={styles.primaryButton}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>إجراء</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#73637220',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'SF Arabic',
    color: '#120309',
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'SF Arabic',
    color: '#120309',
    marginBottom: 24,
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: '#957EB5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SF Arabic',
  },
});

export default MyComponent;
```

## 🔧 Technical Requirements

### Database Operations
```javascript
// Always use RPC for admin operations
await supabase.rpc("admin_create_profile", params);

// Branch-based loading
await supabase.rpc("get_branch_data", { p_hid, p_max_depth: 3 });
```

### State Management
```javascript
// Single source of truth in Zustand
const { nodes, updateNode } = useTreeStore();
// Never duplicate state in components
```

### Error Handling
```javascript
const { data, error } = await profilesService.createProfile(profileData);
if (error) {
  Alert.alert("خطأ", handleSupabaseError(error));
}
```

### Performance
- Branch-based loading (max depth 3-5)
- Viewport culling for visible nodes
- Debounce real-time subscriptions
- Use FlatList for long lists
- Memoize expensive components

## 📱 Development Commands

```bash
# Development
npm start          # Expo dev server
npm run ios        # iOS simulator
npm run android    # Android emulator

# Database Deployment - ALWAYS DEPLOY YOURSELF
node scripts/execute-sql.js <sql-file>

# Validation
SELECT * FROM admin_validation_dashboard();
SELECT * FROM admin_auto_fix_issues();
```

## 🚀 Git Commit Format

```bash
git commit -m "feat: Add [component] with Modern Arabic Elegance design

- Implements 60-30-10 color rule
- Uses Lavender Gray/African Violet/Muted Gold palette
- Follows 8px spacing grid
- Supports RTL layout
- Tested on physical device"
```

---

_Always refer to CLAUDE.md for complete design system documentation._