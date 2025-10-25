# Profile Sheet Redesign - Design & Implementation Specification
**Version**: 1.0
**Date**: October 25, 2025
**Status**: Ready for Implementation
**Estimated Time**: 8-10 hours

---

## 1. Overview

Transform the ProfileSheet from a form-like layout with oversized hero image to a modern, Instagram/LinkedIn-inspired design with compact circular photo, optimized information hierarchy, and graceful handling of missing data.

### Current Problems
- **Oversized hero**: 375x375px square photo consumes 45% of viewport
- **Low information density**: Only 3-4 data points visible above fold
- **Inefficient layouts**: Horizontal parent cards waste vertical space
- **Poor hierarchy**: All elements have similar visual weight
- **Scattered family data**: Parents and children in separate sections

### Goals
- **Space efficiency**: Reduce hero from 755px to ~220px (71% reduction)
- **Information density**: Show 7-9 data points above fold
- **Modern feel**: Match Instagram/LinkedIn patterns
- **Unified family section**: Single scrollable "العائلة" list
- **Graceful degradation**: Hide missing data without gaps

---

## 2. Design System Reference

### Najdi Sadu Color Palette
```
Al-Jass White:      #F9F7F3  (backgrounds, light surfaces)
Camel Hair Beige:   #D1BBA3  (borders, containers, accents)
Sadu Night:         #242121  (all text)
Najdi Crimson:      #A13333  (primary actions, avatars)
Desert Ochre:       #D58C4A  (avatars, accents)
```

### Typography Scale (iOS Standard)
```
34px (largeTitle) - Not used
28px (title1)     - Not used
22px (title2)     - Primary name
20px (title3)     - Section titles
17px (body)       - Default text, buttons
15px (subheadline)- Facts row
13px (footnote)   - Name chain, relationship labels
11px (caption1)   - Badges
```

### Spacing Grid (8px Base)
```
4px  - Tight gaps (bullet spacing)
8px  - Standard element gaps
12px - Section spacing
16px - Page margins, card padding
20px - Larger section spacing
24px - Major section breaks
```

### Shadows (iOS Standard)
```javascript
{
  shadowColor: '#000',
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 8 },
}
```

### Border Radius
```
6px  - Small badges
10px - Buttons, inline containers
12px - Cards, sections
50px - Circular elements (100px photo = 50px radius)
```

---

## 3. Component Architecture

### 3.1 Extract Colored Circle Avatar Component

**File**: `src/components/ui/ColoredCircleAvatar.js`

**Source**: Copy from `/src/components/search/SearchResultCard.js` lines 73-85

**Features**:
- Colored circle background with desert palette rotation
- White text showing first letter of Arabic name
- Multiple sizes: 36px (list), 44px (thumbnail), 100px (hero)
- Deterministic color based on index/ID

**Desert Color Palette** (from SearchResultCard.js lines 31-44):
```javascript
const desertPalette = [
  "#A13333",   // Najdi Crimson
  "#D58C4A",   // Desert Ochre
  "#D1BBA3",   // Camel Hair Beige
  "#A13333CC", // Najdi Crimson 80%
  "#D58C4ACC", // Desert Ochre 80%
  "#D1BBA3CC", // Camel Hair Beige 80%
  "#A1333399", // Najdi Crimson 60%
  "#D58C4A99", // Desert Ochre 60%
  "#D1BBA399", // Camel Hair Beige 60%
  "#A13333",   // Repeat
];
```

**API**:
```javascript
<ColoredCircleAvatar
  name="لجين"                 // For extracting initial
  photoUrl={person.photo_url} // Shows photo if exists
  size={100}                  // 36 | 44 | 100
  index={person.id}           // For color rotation
/>
```

**Implementation Notes**:
- If photoUrl exists → Show `<Image>` with circular mask
- If no photoUrl → Show colored circle with initial
- Initial: `name ? name.charAt(0) : "؟"`
- Background color: `desertPalette[index % desertPalette.length]`
- Text color: Always `#F9F7F3` (Al-Jass White)
- Font size: `size < 50 ? 18 : 40` (scale with avatar size)

---

## 4. Hero Section Redesign

### 4.1 Layout Structure

**Instagram/LinkedIn Pattern**: Photo above, name below

```
┌─────────────────────────────────┐
│         ╔═══════╗               │  16px top margin
│         ║ Photo ║               │  100x100px circular
│         ║ 100px ║               │
│         ╚═══════╝               │
│                                 │  12px gap
│      لجين • أم خالد             │  22px name + kunya
│                                 │  4px gap
│  بنت عبدالله سليمان علي...     │  13px name chain
│                                 │  8px gap
│      ┌─────────────────┐        │  (Only if deceased)
│      │  الله يرحمه     │        │  Death badge
│      └─────────────────┘        │
│                                 │  12px gap
│ ┌─────────────────────────────┐ │  Facts row (if data exists)
│ │ الجيل السادس • 4 إخوة       │ │  44px height
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
Total height: ~220px (vs 755px current)
```

### 4.2 Name Display Logic

**CRITICAL**: Name chain first, THEN kunya

```javascript
// Current (WRONG):
person.name • person.kunya
fullName (ancestry chain)

// New (CORRECT):
fullName (person.name + بنت/بن + ancestors)
person.kunya (if exists)
```

**Display Format**:
```
Primary Line: "لجين بنت عبدالله سليمان علي جريبوع سليمان القفاري"
Secondary Line (if kunya exists): "أم خالد"
```

**Code Implementation**:
```javascript
{/* Primary Name Chain - Large, Bold */}
<Text style={styles.nameChain} numberOfLines={2}>
  {fullName || person.name || "بدون اسم"}
</Text>

{/* Kunya - Smaller, Secondary */}
{person.kunya && (
  <Text style={styles.kunya}>{person.kunya}</Text>
)}
```

**Typography**:
- **Name Chain**: 22px (title2), weight 700, color #242121, line height 28
- **Kunya**: 17px (body), weight 400, color #242121CC (80% opacity)

### 4.3 Status Badge (Deceased Only)

**Rule**: ONLY show badge if `person.status === 'deceased'`
**Text**: "الله يرحمه" (May Allah have mercy on him)
**Never show**: "على قيد الحياة" or any "alive" indicator

**Design**:
```javascript
{person.status === 'deceased' && (
  <View style={styles.deathBadge}>
    <Text style={styles.deathText}>الله يرحمه</Text>
  </View>
)}

// Styling
deathBadge: {
  backgroundColor: '#6B7280',    // Neutral gray
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 6,
  marginTop: 8,
  alignSelf: 'center',           // Center horizontally
},
deathText: {
  fontSize: 11,                  // caption1
  color: '#F9F7F3',              // Al-Jass White
  fontWeight: '600',
  fontFamily: 'SF Arabic',
}
```

### 4.4 Quick Facts Row

**Position**: Inside hero section (below name/kunya/status)

**Content**: Bullet-separated inline facts
```
"الجيل السادس • 4 إخوة • 23 من الأحفاد"
```

**Logic**:
```javascript
const validFacts = useMemo(() => {
  const facts = [];

  // Only show generation if person has HID (not Munasib)
  if (person.generation && person.hid !== null) {
    facts.push(getArabicOrdinal(person.generation));
  }

  // Only show if count > 0
  if (siblingsCount > 0) {
    facts.push(`${siblingsCount} إخوة`);
  }

  if (descendantsCount > 0) {
    facts.push(`${descendantsCount} من الأحفاد`);
  }

  return facts;
}, [person, siblingsCount, descendantsCount]);

// CRITICAL: Don't render if no facts
const hasFacts = validFacts.length > 0;
```

**Design**:
```javascript
{hasFacts && (
  <View style={styles.factsRow}>
    <Text style={styles.factsText}>
      {validFacts.join(' • ')}
    </Text>
  </View>
)}

// Styling
factsRow: {
  marginTop: 12,
  paddingHorizontal: 16,
  paddingVertical: 10,
  backgroundColor: '#D1BBA320',   // Camel Hair 20% opacity
  borderRadius: 10,
  minHeight: 44,                  // Touch target
  alignSelf: 'stretch',
  marginHorizontal: 16,
  justifyContent: 'center',
},
factsText: {
  fontSize: 15,                   // subheadline
  fontWeight: '600',
  color: '#242121',               // Sadu Night
  textAlign: 'center',
  fontFamily: 'SF Arabic',
}
```

**Interaction**: Tappable → scrolls to family section
```javascript
<Pressable onPress={scrollToFamily}>
  <View style={styles.factsRow}>
    {/* content */}
  </View>
</Pressable>
```

### 4.5 Complete Hero Styling

```javascript
compactHero: {
  alignItems: 'center',
  paddingTop: 16,
  paddingBottom: 20,
  paddingHorizontal: 16,
  backgroundColor: '#F9F7F3',     // Al-Jass White
},
heroPhoto: {
  width: 100,
  height: 100,
  borderRadius: 50,               // Circular
  borderWidth: 3,
  borderColor: '#F9F7F3',         // White border
  backgroundColor: '#D1BBA3',     // Fallback color
  shadowColor: '#000',
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 8 },
},
nameChain: {
  fontSize: 22,                   // title2
  fontWeight: '700',
  color: '#242121',               // Sadu Night
  textAlign: 'center',
  marginTop: 12,
  paddingHorizontal: 16,
  fontFamily: 'SF Arabic',
  lineHeight: 28,
  maxWidth: '90%',
},
kunya: {
  fontSize: 17,                   // body
  color: '#242121CC',             // 80% opacity
  fontWeight: '400',
  textAlign: 'center',
  marginTop: 4,
  fontFamily: 'SF Arabic',
}
```

---

## 5. Action Buttons

### 5.1 Layout

**Position**: Below hero, above family section

**Structure**: 2-button row (Edit + Share)

```
┌─────────────────────────────────┐
│ ┌───────────────┬─────────────┐ │
│ │  تعديل الملف  │   [share]   │ │  48px height
│ │   (flex: 2)   │  (flex: 1)  │ │  12px gap
│ └───────────────┴─────────────┘ │
└─────────────────────────────────┘
```

### 5.2 Primary Button (Edit/Suggest)

**Text Logic**:
```javascript
const buttonText = permissionLevel === 'inner'
                || permissionLevel === 'admin'
                || permissionLevel === 'moderator'
  ? 'تعديل الملف'
  : 'اقتراح تعديل';
```

**Design**:
```javascript
primaryButton: {
  flex: 2,
  backgroundColor: '#A13333',     // Najdi Crimson
  borderRadius: 10,
  height: 48,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
},
primaryButtonText: {
  fontSize: 17,                   // body
  fontWeight: '600',
  color: '#F9F7F3',               // Al-Jass White
  fontFamily: 'SF Arabic',
}
```

**Press Animation**:
```javascript
<TouchableOpacity
  onPress={handleEdit}
  activeOpacity={0.85}
  style={({ pressed }) => [
    styles.primaryButton,
    pressed && { transform: [{ scale: 0.96 }] }
  ]}
>
```

### 5.3 Secondary Button (Share)

**Icon**: SF Symbol (iOS) / Material (Android)
```javascript
<Ionicons
  name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'}
  size={22}
  color="#242121"
/>
```

**Design**:
```javascript
secondaryButton: {
  flex: 1,
  backgroundColor: 'transparent',
  borderWidth: 1.5,
  borderColor: '#D1BBA3',         // Camel Hair Beige
  borderRadius: 10,
  height: 48,
  alignItems: 'center',
  justifyContent: 'center',
},
```

### 5.4 Container Styling

```javascript
actionButtonsRow: {
  flexDirection: 'row',
  gap: 12,
  paddingHorizontal: 16,
  marginTop: 16,
  marginBottom: 16,
}
```

---

## 6. Unified Family Section

### 6.1 Section Structure

**Title**: "العائلة" (single section, not separate parents/children)

**Order**: Father → Mother → Children (oldest to youngest)

**Conditional Rendering**:
```javascript
// CRITICAL: Hide entire section if no family data
{(father || mother || sortedChildren.length > 0) && (
  <SectionCard title="العائلة" style={styles.familySection}>
    {/* content */}
  </SectionCard>
)}
```

### 6.2 Family Row Component

**Reusable Row**: Used for father, mother, and all children

**Layout** (60px height, RTL-aware):
```
┌────────────────────────────────┐
│ [›] [Name         ] [Photo 44] │  60px
│     [الوالد       ]            │  Relationship label
└────────────────────────────────┘
```

**Implementation**:
```javascript
const FamilyRow = ({ person, relationship, onPress, showDivider }) => (
  <>
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.familyRow,
        pressed && styles.familyRowPressed
      ]}
    >
      {/* Chevron - Left side (LTR, auto-flips to right in RTL) */}
      <Text style={styles.chevron}>›</Text>

      {/* Content - Center */}
      <View style={styles.familyInfo}>
        <View style={styles.familyTextContainer}>
          <Text style={styles.familyName}>{person.name}</Text>
          <Text style={styles.familyRelation}>{relationship}</Text>
        </View>

        {/* Avatar - Right side (LTR, auto-flips to left in RTL) */}
        <ColoredCircleAvatar
          name={person.name}
          photoUrl={person.photo_url}
          size={44}
          index={person.id}
        />
      </View>
    </Pressable>

    {/* Divider between rows */}
    {showDivider && <View style={styles.familyDivider} />}
  </>
);
```

### 6.3 Family Row Styling

```javascript
familyRow: {
  flexDirection: 'row',           // LTR: [chevron] [content] [avatar]
  alignItems: 'center',           // Auto-flips to RTL
  paddingVertical: 10,
  paddingHorizontal: 16,
  minHeight: 60,                  // Touch target
  backgroundColor: 'transparent',
},
familyRowPressed: {
  backgroundColor: '#D1BBA310',   // Subtle highlight
},
familyInfo: {
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginLeft: 12,                 // Space after chevron
},
familyTextContainer: {
  flex: 1,
  alignItems: 'flex-start',       // Flips to right in RTL
  marginRight: 12,                // Space before avatar
},
familyName: {
  fontSize: 17,                   // body
  fontWeight: '600',
  color: '#242121',
  marginBottom: 2,
  fontFamily: 'SF Arabic',
},
familyRelation: {
  fontSize: 13,                   // footnote
  fontWeight: '400',
  color: '#24212199',             // 60% opacity
  fontFamily: 'SF Arabic',
},
chevron: {
  fontSize: 20,
  color: '#D1BBA3',               // Camel Hair Beige
  fontWeight: '300',
},
familyDivider: {
  height: 1,
  backgroundColor: '#D1BBA320',   // 20% opacity
  marginLeft: 60,                 // Indent to align with text
}
```

### 6.4 Container Styling

```javascript
familySection: {
  marginBottom: 12,
  marginHorizontal: 16,
},
familyContainer: {
  backgroundColor: '#F9F7F3',     // Al-Jass White
  borderRadius: 12,
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: '#D1BBA340',       // Camel Hair 40%
}
```

### 6.5 Usage Example

```javascript
<SectionCard title="العائلة">
  <CardSurface style={styles.familyContainer}>
    {father && (
      <FamilyRow
        person={father}
        relationship="الوالد"
        onPress={() => navigateToPerson(father.id)}
        showDivider={mother || sortedChildren.length > 0}
      />
    )}

    {mother && (
      <FamilyRow
        person={mother}
        relationship="الوالدة"
        onPress={() => navigateToPerson(mother.id)}
        showDivider={sortedChildren.length > 0}
      />
    )}

    {sortedChildren.map((child, idx) => (
      <FamilyRow
        key={child.id}
        person={child}
        relationship={child.gender === 'male' ? 'ابن' : 'ابنة'}
        onPress={() => navigateToPerson(child.id)}
        showDivider={idx < sortedChildren.length - 1}
      />
    ))}
  </CardSurface>
</SectionCard>
```

---

## 7. Graceful Handling of Missing Data

### 7.1 Design Principle

**Never show empty states** - Hide sections completely if no data

**No gaps** - Remaining sections flow naturally without spacing issues

**No placeholders** - Don't show "لا توجد بيانات" or similar messages

### 7.2 Conditional Rendering Patterns

**Hero Section** (Always visible):
```javascript
{/* Photo - show avatar if no photo */}
<ColoredCircleAvatar
  name={person.name}
  photoUrl={person.photo_url}    // Handles undefined gracefully
  size={100}
  index={person.id}
/>

{/* Name chain - always show something */}
<Text style={styles.nameChain}>
  {fullName || person.name || "بدون اسم"}
</Text>

{/* Kunya - hide if not present */}
{person.kunya && person.kunya.trim() && (
  <Text style={styles.kunya}>{person.kunya}</Text>
)}

{/* Death badge - only if deceased */}
{person.status === 'deceased' && (
  <View style={styles.deathBadge}>
    <Text>الله يرحمه</Text>
  </View>
)}

{/* Facts row - only if has facts */}
{validFacts.length > 0 && (
  <View style={styles.factsRow}>
    {/* content */}
  </View>
)}
```

**Bio Section**:
```javascript
{person.biography && person.biography.trim().length > 0 && (
  <View style={styles.bioSection}>
    <Text numberOfLines={bioExpanded ? undefined : 3}>
      {person.biography}
    </Text>
  </View>
)}
```

**Family Section**:
```javascript
{(father || mother || sortedChildren.length > 0) && (
  <SectionCard title="العائلة">
    {/* Only render rows for existing family members */}
  </SectionCard>
)}
```

**Photo Gallery**:
```javascript
{/* CRITICAL: Don't show in view mode at all */}
{/* Only show in edit mode */}
{isEditing && person.id && (
  <PhotoGalleryMaps
    profileId={person.id}
    isEditMode={true}
  />
)}

{/* For read-only gallery (if implemented later): */}
{!isEditing && photos && photos.length > 0 && (
  <PhotoGallerySection photos={photos} />
)}
```

### 7.3 Edge Cases

**Munasib Profile** (hid === null):
```javascript
// Don't show generation in facts row
if (person.generation && person.hid !== null) {
  facts.push(getArabicOrdinal(person.generation));
}
```

**No Family Data**:
```javascript
// Entire family section hidden - no gap left behind
{(father || mother || sortedChildren.length > 0) && (
  <SectionCard title="العائلة">
    {/* ... */}
  </SectionCard>
)}
```

**Very Long Name Chain**:
```javascript
// Allow 2-line wrapping
<Text
  style={styles.nameChain}
  numberOfLines={2}
  ellipsizeMode="tail"
>
  {fullName}
</Text>
```

**No Siblings/Descendants**:
```javascript
// Filter out from facts array
if (siblingsCount > 0) {  // Not >= 0, strictly > 0
  facts.push(`${siblingsCount} إخوة`);
}
```

---

## 8. Animation & Interaction

### 8.1 Hero Photo Entrance

**Pattern**: Fade in + subtle scale

```javascript
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

const fadeAnim = useRef(new Animated.Value(0)).current;
const scaleAnim = useRef(new Animated.Value(0.9)).current;

useEffect(() => {
  Animated.parallel([
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }),
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }),
  ]).start();
}, [person.id]);

// Usage
<Animated.View
  style={{
    opacity: fadeAnim,
    transform: [{ scale: scaleAnim }]
  }}
>
  <ColoredCircleAvatar {...} />
</Animated.View>
```

### 8.2 Facts Row Press Feedback

```javascript
import * as Haptics from 'expo-haptics';

const handleFactsPress = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  scrollToFamily();
};

<Pressable
  onPress={handleFactsPress}
  style={({ pressed }) => [
    styles.factsRow,
    pressed && {
      opacity: 0.85,
      transform: [{ scale: 0.98 }]
    }
  ]}
>
```

### 8.3 Family Row Press Feedback

```javascript
<Pressable
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigateToPerson(person.id);
  }}
  style={({ pressed }) => [
    styles.familyRow,
    pressed && {
      backgroundColor: '#D1BBA310',
      transform: [{ scale: 0.99 }]
    }
  ]}
>
```

### 8.4 Action Button Press

```javascript
<TouchableOpacity
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleEdit();
  }}
  activeOpacity={0.85}
  style={({ pressed }) => [
    styles.primaryButton,
    pressed && {
      transform: [{ scale: 0.96 }],
      shadowOpacity: 0.02,
    }
  ]}
>
```

---

## 9. Implementation Checklist

### Phase 1: Component Setup (1-2 hours)
- [ ] Create `src/components/ui/ColoredCircleAvatar.js`
- [ ] Copy avatar logic from SearchResultCard.js lines 73-85
- [ ] Add support for 36px, 44px, 100px sizes
- [ ] Test with and without photo_url

### Phase 2: Hero Section (2-3 hours)
- [ ] Remove old hero image (375x375px)
- [ ] Add ColoredCircleAvatar (100px)
- [ ] Update name display: name_chain THEN kunya
- [ ] Add death badge (deceased only)
- [ ] Add inline facts row with conditional logic
- [ ] Update styling per spec

### Phase 3: Action Buttons (1 hour)
- [ ] Remove three-dot menu from top
- [ ] Add 2-button row below hero
- [ ] Primary button: Text ("تعديل" or "اقتراح")
- [ ] Secondary button: Share icon (SF Symbol iOS)
- [ ] Add press animations

### Phase 4: Family Section (2-3 hours)
- [ ] Remove separate parent cards
- [ ] Remove separate children section
- [ ] Create unified "العائلة" section
- [ ] Implement FamilyRow component (father, mother, children)
- [ ] Add dividers between rows
- [ ] Ensure scrollable for large families

### Phase 5: Missing Data Handling (1 hour)
- [ ] Facts row: Only show if validFacts.length > 0
- [ ] Family section: Only show if father || mother || children
- [ ] Bio: Only show if biography.trim().length > 0
- [ ] Gallery: Hide in view mode, show in edit mode only
- [ ] Test with minimal profile (name only)

### Phase 6: Animations & Polish (1 hour)
- [ ] Hero photo fade in
- [ ] Facts row press feedback
- [ ] Family row press feedback
- [ ] Button press animations
- [ ] Haptic feedback for all interactions

### Phase 7: Testing (2 hours)
- [ ] Complete profile (all fields)
- [ ] Minimal profile (name only)
- [ ] Deceased profile (verify badge)
- [ ] Large family (20+ children scrollable)
- [ ] Munasib profile (no HID, no generation)
- [ ] RTL mode verification
- [ ] iPhone SE, 14 Pro, 14 Pro Max

---

## 10. Visual Design Mockup

### Before (Current)
```
┌─────────────────────────────────┐
│                                 │
│                                 │
│      ╔═══════════════════╗      │  375px
│      ║                   ║      │  Square
│      ║   HUGE PHOTO      ║      │  Photo
│      ║                   ║      │
│      ╚═══════════════════╝      │
│                                 │
│         لجين                    │  Name
│  بنت عبدالله سليمان...          │  Chain
│                                 │
│  ┌──────────┐  ┌──────────┐    │  Metrics
│  │ الجيل 6  │  │ 4 إخوة   │    │  Pills
│  └──────────┘  └──────────┘    │
│                                 │
└─────────────────────────────────┘
Above fold: 755px, 3-4 data points
```

### After (Proposed)
```
┌─────────────────────────────────┐
│         ╔═══════╗               │  100px
│         ║ Photo ║               │  Circular
│         ╚═══════╝               │  Photo
│                                 │
│  لجين بنت عبدالله سليمان...    │  Name Chain
│         أم خالد                 │  Kunya
│                                 │
│ ┌─────────────────────────────┐ │  Facts
│ │ الجيل السادس • 4 إخوة       │ │  Row
│ └─────────────────────────────┘ │
│                                 │
│ ┌───────────────┬─────────────┐ │  Action
│ │  تعديل الملف  │   [share]   │ │  Buttons
│ └───────────────┴─────────────┘ │
│                                 │
│ العائلة                         │  Family
│ ┌─────────────────────────────┐ │  Section
│ │ › د. عبدالله         [📷]  │ │
│ │   الوالد                    │ │
│ ├─────────────────────────────┤ │
│ │ › مريم السعدي        [📷]  │ │
│ │   الوالدة                   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
Above fold: 220px, 9 data points
```

---

## 11. Files to Modify

### Create New
- `src/components/ui/ColoredCircleAvatar.js`

### Modify Existing
- `src/components/ProfileSheet.js`
  - Lines 1050-1200: Hero section
  - Lines 2100-2230: Family section
  - Add action buttons section
  - Update conditional rendering logic

### Do NOT Modify
- Name chain calculation (`fullName` useMemo) - Keep as is
- Existing data fetching logic
- Bottom sheet behavior
- Edit mode functionality
- Photo gallery component (only change visibility logic)

---

## 12. Success Metrics

### Quantitative
✅ Hero height: 755px → 220px (71% reduction)
✅ Data points above fold: 3-4 → 9 (125% increase)
✅ Components created: 1 (ColoredCircleAvatar)
✅ Lines modified: ~200 (ProfileSheet.js)
✅ Breaking changes: 0

### Qualitative
✅ Feels like Instagram/LinkedIn
✅ No visual gaps from missing data
✅ Family data easy to scan (vertical list)
✅ Clear visual hierarchy
✅ Native iOS animations
✅ RTL perfect

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Name chain display wrong | High | Preserve existing `fullName` logic, only change display order |
| RTL layout breaks | High | Use standard `flexDirection: 'row'`, test thoroughly |
| Avatar colors inconsistent | Low | Use exact desert palette from SearchResultCard.js |
| Large families crash | Medium | Test with 50+ children, ensure ScrollView performance |
| Missing data shows gaps | Medium | Strict conditional rendering, hide entire sections |

---

## 14. Testing Scenarios

### Scenario 1: Complete Profile
**Data**: Photo, kunya, bio, both parents, 5 children, 3 photos
**Expected**: All sections visible, no gaps, smooth scrolling
**Verify**: Death badge not shown, facts row shows 3 items

### Scenario 2: Minimal Profile
**Data**: Name only (no photo, kunya, parents, children)
**Expected**: Colored avatar, name chain, action buttons only
**Verify**: No empty sections, no gaps, layout looks intentional

### Scenario 3: Deceased Profile
**Data**: Deceased status set
**Expected**: "الله يرحمه" badge visible below name
**Verify**: Badge color #6B7280, text white, centered

### Scenario 4: Large Family
**Data**: 25 children
**Expected**: Scrollable family list, all children visible
**Verify**: 60fps scrolling, proper dividers, no layout issues

### Scenario 5: Munasib Profile
**Data**: hid === null, no generation
**Expected**: Facts row hides generation, shows siblings only
**Verify**: No "undefined" or "null" text displayed

### Scenario 6: No Facts Data
**Data**: No generation, 0 siblings, 0 descendants
**Expected**: Facts row completely hidden
**Verify**: No empty container, hero flows to buttons

### Scenario 7: RTL Verification
**Platform**: iOS with Arabic locale
**Expected**: All layouts flip correctly
**Verify**: Avatar right, chevron left, text right-aligned

---

## 15. Handoff Notes

### For the Developer

1. **Start with ColoredCircleAvatar** - This is self-contained and can be built/tested independently

2. **Preserve existing logic** - Don't change:
   - `fullName` calculation (lines 310-332)
   - Permission checking
   - Navigation functions
   - Data fetching

3. **Test incrementally**:
   - Build hero → Test with real data
   - Build buttons → Test permissions
   - Build family section → Test with varying data
   - Test missing data scenarios last

4. **Use existing components**:
   - Keep using `SectionCard`, `CardSurface`, `ProgressiveImage`
   - Reuse existing animations patterns
   - Follow existing press feedback patterns

5. **Questions?**
   - Name display order: name_chain first, kunya second
   - Avatar source: SearchResultCard.js lines 73-85
   - Color palette: Exact colors from SearchResultCard.js
   - Death badge: Only if status === 'deceased', never show "alive"

### Design Files
- Figma: N/A (spec is comprehensive)
- Color tokens: See section 2
- Typography: iOS standard scale
- Reference: Instagram profile screen, LinkedIn mobile

---

**End of Specification**
