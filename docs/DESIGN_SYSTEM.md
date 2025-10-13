# Najdi Sadu Design System

A culturally authentic design system inspired by Najdi Sadu weaving traditions, creating a warm, sophisticated, and uniquely Saudi family tree experience.

## 🎨 Color Palette (60-30-10 Rule)

### Dominant (60%): Background

- **Al-Jass White** `#F9F7F3` - Primary background
  - All screens, pages, and modals
  - Clean canvas with warm undertones

### Secondary (30%): Containers

- **Camel Hair Beige** `#D1BBA3` - Content containers
  - Cards, sidebars, input fields
  - Visually distinct from primary background

### Text & Base Elements

- **Sadu Night** `#242121` - All text content
  - Body copy, headlines, labels
  - High contrast without pure black harshness

### Primary Accent (10%): Actions

- **Najdi Crimson** `#A13333` - Primary actions
  - Main buttons, important links
  - Active navigation states
  - Critical notifications

### Secondary Accent: Highlights

- **Desert Ochre** `#D58C4A` - Secondary emphasis
  - Secondary icons, tags
  - Progress bars, warm accents
  - Non-competing highlights

## Typography System

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

## Spacing System (8px Grid)

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

## Component Patterns

### Base Card

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

### Primary Button

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

### Secondary Button

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

### Input Field

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

## Sadu Pattern Usage

Sadu patterns should enrich the design without compromising readability:

### Permitted Uses:

- **Background Textures**: Hero sections at 5-10% opacity
- **Decorative Borders**: UI cards or section dividers
- **Element Fills**: Profile avatars, decorative placeholders
- **Loading States**: Subtle pattern animations

### Restrictions:

- Never over text content
- Maximum 10% opacity for backgrounds
- Use sparingly for cultural accent

## Icon System

- **Primary Icons**: Use `#A13333` (Najdi Crimson) for actions
- **Secondary Icons**: Use `#242121` (Sadu Night) for navigation
- **Accent Icons**: Use `#D58C4A` (Desert Ochre) for highlights
- **Icon Sizes**: 20px (small), 24px (default), 28px (large)

## Interactive States

### Touch Feedback

- **Cards**: `activeOpacity: 0.95`
- **Buttons**: `activeOpacity: 0.8`
- **List Items**: `activeOpacity: 0.7`

### Focus States

- Add `#957EB5` border with 2px width
- Include 4px focus ring with 20% opacity

### Disabled States

- 40% opacity on all elements
- Remove shadows and borders

## Animation Values

- **Quick**: 200ms (micro-interactions)
- **Normal**: 300ms (standard transitions)
- **Slow**: 500ms (page transitions)
- **Easing**: `ease-out` for most animations
- **Spring**: Use for playful elements

## Design Principles

1. **Generous White Space**: Never cramped, always breathing room
2. **Clear Hierarchy**: Important elements stand out naturally
3. **Cultural Sensitivity**: RTL-first, Arabic typography considerations
4. **Accessibility**: 44px minimum touch targets, high contrast
5. **Consistency**: Same patterns throughout the app

## Family-Specific Elements

### Family Member Card

```javascript
memberCard: {
  ...baseCard,
  borderLeftWidth: 4,
  borderLeftColor: "#D58C4A", // Desert Ochre accent
}
```

### Tree Node

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

## Component Examples

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

## Best Practices

1. **Always use the color palette** - Never hardcode colors outside the palette
2. **Follow the 8px grid** - All spacing must be multiples of 8
3. **Keep shadows subtle** - Max 0.08 opacity
4. **Use semantic naming** - `primaryButton` not `blueButton`
5. **Test on real devices** - Especially for RTL and gestures
6. **Maintain consistency** - Same patterns throughout the app

## Token Usage

Access design tokens via `src/components/ui/tokens.js`:

```javascript
import { tokens } from './components/ui/tokens';

// Colors
tokens.colors.najdi.alJass      // #F9F7F3
tokens.colors.najdi.camelHair   // #D1BBA3
tokens.colors.najdi.crimson     // #A13333
tokens.colors.najdi.ochre       // #D58C4A
tokens.colors.najdi.night       // #242121

// Typography
tokens.typography.largeTitle
tokens.typography.body
tokens.typography.footnote

// Spacing
tokens.spacing.xs    // 8
tokens.spacing.md    // 16
tokens.spacing.xl    // 24
```

## Reference

- **Design Inspiration**: iOS Settings, WhatsApp, Linear
- **Typography**: SF Arabic for all Arabic text
- **Icons**: Ionicons for consistency
- **Testing**: Physical iOS device required for gestures

---

_This design system ensures consistency, cultural appropriateness, and premium feel throughout the Alqefari Family Tree app._
