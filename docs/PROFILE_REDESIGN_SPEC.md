# Profile Screen Redesign - Implementation Specification

**Version**: 1.0
**Date**: October 25, 2025
**Status**: Ready for Implementation

---

## 🎯 Design Goals

1. **Compact hero** - Instagram-style small avatar (~60-70px)
2. **Information-dense** - Personal info integrated into hero
3. **Photos first** - Gallery positioned high in layout
4. **Family at bottom** - Vertical single-column list (no horizontal scroll)
5. **Simplified actions** - Edit button + 3-dot menu only
6. **No gaps** - Empty sections collapse completely

---

## 📐 Layout Structure

### Content Order (Top to Bottom)

```
1. Hero Section (~100-120px)
   ├─ Small avatar (60-70px circle)
   ├─ Name + lineage
   ├─ Generation + siblings inline
   ├─ Personal info inline (birth place, birth year)
   └─ Action buttons (top-right: Edit + Menu)

2. Photo Gallery (adaptive height)
   ├─ 1-2 photos: Vertical stack (260px each)
   ├─ 3-5 photos: Horizontal carousel (~240px)
   └─ 6+ photos: Grid mosaic

3. Timeline Section (if exists)
   └─ Chronological events

4. Professional Info Section (if exists)
   ├─ Education
   └─ Achievements (bullets)

5. Contact Section (if exists)
   ├─ Phone (tappable row)
   ├─ Email (tappable row)
   └─ Social media

6. Family Section (bottom, vertical list)
   ├─ Parents
   ├─ Spouse(s)
   └─ Children
   (All in single-column list format)
```

**Estimated Scroll Heights:**
- **Full schema**: ~900-1100px (vs 1200px before) - 8-16% reduction
- **Medium schema**: ~600-700px
- **Empty schema**: ~300-400px

---

## 🎨 Hero Section - Detailed Specification

### Visual Layout

```
┌─────────────────────────────────────────────────────┐
│  ┌──────┐  لجين القفاري                  [✏️] [⋯]  │
│  │      │  بنت عبدالله سليمان علي القفاري           │
│  │ 60px │  الجيل السادس • ٤ إخوة                   │
│  │  👤  │  📍 الرياض • 📅 1990                      │
│  └──────┘                                           │
└─────────────────────────────────────────────────────┘
Total height: ~100-120px
```

### Component Breakdown

#### 1. Avatar
- **Size**: 60-70px circular
- **Position**: Left-aligned (RTL), 16px margin from left
- **Border**: 3px white stroke
- **Shadow**: iOS standard (0-2px-4px rgba(36,33,33,0.08))
- **Fallback**: Beige circle (#D1BBA3) with first letter initials (32pt Bold)
- **Top margin**: 16px
- **Tappable**: Opens full-screen photo

#### 2. Name Block
- **Position**: Right of avatar (RTL), 12px gap
- **Top align**: Avatar top + 8px

**Name Text:**
- Font: 20pt SF Arabic Bold
- Color: Sadu Night (#242121)
- Lines: 1 line, ellipsis if overflow
- Include title: `formatNameWithTitle(person)`

**Lineage Text:**
- Font: 15pt SF Arabic Regular
- Color: Sadu Night 70% opacity (#242121B3)
- Lines: 1-2 lines max, ellipsis if overflow
- Margin top: 4px below name

**Metadata Row:**
- Font: 13pt SF Arabic Semibold
- Color: Sadu Night 85%
- Format: `الجيل ${generation} • ${siblingsCount} إخوة`
- Margin top: 8px below lineage
- Icon: Small generation badge circle (optional)

**Personal Info Row:**
- Font: 13pt SF Arabic Regular
- Color: Desert Ochre (#D58C4A)
- Format: `📍 ${birthPlace} • 📅 ${birthYear}`
- Margin top: 4px below metadata
- Conditional: Only show if data exists
- Icons: Ionicons 16px size

#### 3. Action Buttons
- **Position**: Top-right corner, absolute positioning
- **Top**: 16px
- **Right**: 16px (RTL)
- **Layout**: Horizontal flex, 8px gap

**Edit Button:**
- Size: 36×36px
- Background: Najdi Crimson (#A13333)
- Icon: `create-outline` (Ionicons), 20px, white
- Border radius: 8px
- Shadow: 0-1px-3px rgba(161,51,51,0.2)
- Conditional: Only show if user has edit permission

**Menu Button (3-dot):**
- Size: 36×36px
- Background: Camel Hair Beige (#D1BBA3)
- Icon: `ellipsis-horizontal` (Ionicons), 20px, Sadu Night
- Border radius: 8px
- Shadow: 0-1px-3px rgba(209,187,163,0.2)

**Menu Options:**
- Share Profile
- View in Tree
- Copy Link
- Report Issue (conditional)

### Code Structure

```javascript
// src/components/ProfileViewer/Hero/CompactHero.js

const CompactHero = ({ person, onEdit, onMenuPress, canEdit }) => {
  const generation = person.generation || 'غير معروف';
  const siblingsCount = person.siblings?.length || 0;
  const birthPlace = person.birth_place;
  const birthYear = person.dob_data?.year;

  return (
    <View style={styles.heroContainer}>
      {/* Avatar */}
      <TouchableOpacity onPress={() => openFullPhoto(person.photo_url)}>
        {person.photo_url ? (
          <Image source={{ uri: person.photo_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.initials}>{person.name[0]}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Name Block */}
      <View style={styles.nameBlock}>
        <Text style={styles.name} numberOfLines={1}>
          {formatNameWithTitle(person)}
        </Text>
        <Text style={styles.lineage} numberOfLines={2}>
          {person.full_name_chain || person.name_chain}
        </Text>
        <Text style={styles.metadata}>
          الجيل {generation} • {siblingsCount} إخوة
        </Text>
        {(birthPlace || birthYear) && (
          <View style={styles.personalInfo}>
            {birthPlace && (
              <Text style={styles.infoText}>
                <Ionicons name="location" size={16} /> {birthPlace}
              </Text>
            )}
            {birthYear && (
              <Text style={styles.infoText}>
                <Ionicons name="calendar" size={16} /> {birthYear}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {canEdit && (
          <TouchableOpacity style={styles.editButton} onPress={onEdit}>
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#242121" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heroContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#F9F7F3', // Al-Jass White
    minHeight: 100,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#242121',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D1BBA3', // Camel Hair Beige
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 32,
    fontWeight: '700',
    color: '#242121',
  },
  nameBlock: {
    flex: 1,
    marginLeft: 12, // RTL - this becomes right margin
    paddingTop: 8,
    paddingRight: 80, // Space for action buttons
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#242121',
  },
  lineage: {
    fontSize: 15,
    color: '#242121B3', // 70% opacity
    marginTop: 4,
  },
  metadata: {
    fontSize: 13,
    fontWeight: '600',
    color: '#242121D9', // 85% opacity
    marginTop: 8,
  },
  personalInfo: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  infoText: {
    fontSize: 13,
    color: '#D58C4A', // Desert Ochre
  },
  actionButtons: {
    position: 'absolute',
    top: 16,
    right: 16, // RTL
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#A13333',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A13333',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#D1BBA3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D1BBA3',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});
```

---

## 📸 Photo Gallery - Adaptive Strategy

### Decision Logic

```javascript
const photoCount = photos?.length || 0;

if (photoCount === 0) {
  // Section collapses completely
  return null;
} else if (photoCount === 1 || photoCount === 2) {
  // Vertical stack: full-width cards
  return <VerticalPhotoStack photos={photos} />;
} else if (photoCount >= 3 && photoCount <= 5) {
  // Horizontal carousel: swipeable cards
  return <HorizontalPhotoCarousel photos={photos} />;
} else {
  // Grid mosaic: for edge cases with 6+ photos
  return <PhotoGridMosaic photos={photos} />;
}
```

### Option A: Vertical Stack (1-2 photos)

```
┌─────────────────────────────────┐
│ الصور                           │
│                                 │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │         Photo 1             │ │ 260px
│ │      (full-width)           │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │ 8px gap
│ ┌─────────────────────────────┐ │
│ │         Photo 2             │ │ 260px
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Specs:**
- Card width: Full width minus 32px padding (16px each side)
- Card height: 260px
- Border radius: 12px
- Gap: 8px between cards
- Image fit: Cover (centered)
- Tap: Opens full-screen gallery

### Option B: Horizontal Carousel (3-5 photos)

```
┌─────────────────────────────────────┐
│ الصور                      [2/5]    │
│                                     │
│ ┌──────────┐ ┌──────────┐ ┌───     │
│ │          │ │          │ │        │
│ │  Photo 1 │ │  Photo 2 │ │ Photo  │ 200px
│ │          │ │          │ │        │
│ └──────────┘ └──────────┘ └───     │
│                                     │
│         ● ● ○ ○ ○                   │
└─────────────────────────────────────┘
```

**Specs:**
- Card width: 280px
- Card height: 200px
- Border radius: 12px
- Gap: 12px between cards
- Shows: 1.2 cards on screen (peek next)
- Scroll: Horizontal, momentum, snap to interval
- Pagination dots: 8px circles, 6px gap, Najdi Crimson active
- Counter: "2/5" format, top-right

---

## 👨‍👩‍👧‍👦 Family Section - Vertical List

### Layout

```
┌─────────────────────────────────────┐
│ العائلة                             │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ┌────┐  د. عبدالله القفاري     │ │
│ │ │ 44 │  الوالد             ›   │ │ 60px row
│ │ └────┘                          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ┌────┐  مريم السعودي          │ │
│ │ │ م  │  الوالدة            ›   │ │ 60px row
│ │ └────┘                          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ───────── الزوجة ─────────          │ Divider
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ┌────┐  نورة القفاري           │ │
│ │ │ 44 │  الزوجة             ›   │ │
│ │ └────┘                          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ───────── الأبناء (٣) ─────────     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ┌────┐  سليمان عبدالله         │ │
│ │ │ 44 │  الابن              ›   │ │
│ │ └────┘                          │ │
│ └─────────────────────────────────┘ │
│ ... (continues for all children)    │
└─────────────────────────────────────┘
```

### Specifications

**Section Title:**
- Font: 22pt SF Arabic Semibold
- Color: Sadu Night
- Padding: 16px top, 8px bottom
- Margin top: 24px (section spacing)

**Family Row:**
- Height: 60px (minimum 44px touch target)
- Background: White (#FFFFFF)
- Border radius: 12px
- Padding: 8px horizontal
- Margin bottom: 4px
- Shadow: 0-1px-2px rgba(36,33,33,0.04)

**Avatar:**
- Size: 44×44px circular
- Position: Left-aligned (RTL), 8px from edge
- Border: 2px white stroke
- Fallback: Beige circle with initials (20pt)

**Name Text:**
- Font: 17pt SF Arabic Semibold
- Color: Sadu Night
- Position: 12px right of avatar
- Lines: 1, ellipsis

**Relationship Label:**
- Font: 15pt SF Arabic Regular
- Color: Sadu Night 60% opacity
- Position: Below name, 2px gap
- Format: "الوالد", "الوالدة", "الزوجة", "الابن", etc.

**Chevron:**
- Icon: `chevron-back` (Ionicons) - correct for RTL
- Size: 20px
- Color: Camel Hair Beige
- Position: Right-aligned (RTL), 12px from edge

**Section Dividers:**
- Between parents/spouse/children groups
- Font: 13pt SF Arabic Semibold
- Color: Sadu Night 50%
- Background: Line with text overlay
- Format: "───── الأبناء (٣) ─────"
- Margin: 12px vertical

### Code Structure

```javascript
// src/components/ProfileViewer/ViewMode/cards/FamilyList.js

const FamilyList = ({ parents, spouses, children, onNavigate }) => {
  // Build list with section dividers
  const familyMembers = [];

  // Parents
  if (parents && parents.length > 0) {
    parents.forEach(parent => {
      familyMembers.push({
        type: 'member',
        person: parent,
        relationship: parent.gender === 'male' ? 'الوالد' : 'الوالدة',
      });
    });
  }

  // Spouse section
  if (spouses && spouses.length > 0) {
    familyMembers.push({ type: 'divider', label: 'الزوجة' });
    spouses.forEach(spouse => {
      familyMembers.push({
        type: 'member',
        person: spouse,
        relationship: spouse.gender === 'male' ? 'الزوج' : 'الزوجة',
      });
    });
  }

  // Children section
  if (children && children.length > 0) {
    familyMembers.push({
      type: 'divider',
      label: `الأبناء (${children.length})`
    });
    children.forEach(child => {
      familyMembers.push({
        type: 'member',
        person: child,
        relationship: child.gender === 'male' ? 'الابن' : 'الابنة',
      });
    });
  }

  if (familyMembers.length === 0) {
    return null; // Section collapses
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>العائلة</Text>
      {familyMembers.map((item, index) => {
        if (item.type === 'divider') {
          return (
            <View key={`divider-${index}`} style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{item.label}</Text>
              <View style={styles.dividerLine} />
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={item.person.id}
            style={styles.familyRow}
            onPress={() => onNavigate(item.person.id)}
            accessibilityLabel={`فتح ملف ${item.person.name}`}
          >
            {item.person.photo_url ? (
              <Image
                source={{ uri: item.person.photo_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>
                  {item.person.name[0]}
                </Text>
              </View>
            )}
            <View style={styles.nameBlock}>
              <Text style={styles.name} numberOfLines={1}>
                {formatNameWithTitle(item.person)}
              </Text>
              <Text style={styles.relationship}>
                {item.relationship}
              </Text>
            </View>
            <Ionicons
              name="chevron-back"
              size={20}
              color="#D1BBA3"
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#242121',
    marginBottom: 12,
  },
  familyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 4,
    shadowColor: '#242121',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D1BBA3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#242121',
  },
  nameBlock: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: '#242121',
  },
  relationship: {
    fontSize: 15,
    color: '#24212199', // 60% opacity
    marginTop: 2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#24212180', // 50% opacity
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#24212180',
    paddingHorizontal: 12,
  },
});
```

---

## 📋 Other Sections (Timeline, Professional, Contact)

### Timeline Section
- **Keep existing component** from `TimelineCard.js`
- **No changes needed** - vertical list works well
- Just ensure it's ordered correctly in main layout

### Professional Info Section
- **Keep existing component** from `ProfessionalCard.js`
- **No changes needed**
- Displays education + achievements

### Contact Section
- **Keep existing component** from `ContactCard.js`
- **No changes needed**
- Tappable rows for phone/email/WhatsApp

---

## 🗂️ File Structure

### New Files to Create

```
src/components/ProfileViewer/
├── Hero/
│   └── CompactHero.js         # NEW - Compact hero component
└── ViewMode/
    └── cards/
        └── FamilyList.js       # NEW - Vertical family list
```

### Files to Modify

```
src/components/ProfileViewer/
├── index.js                    # Reorder sections, use CompactHero
└── ViewMode/
    └── cards/
        ├── PersonalCard.js     # DELETE or mark deprecated
        └── DatesCard.js        # DELETE or mark deprecated
```

### Files to Keep As-Is

```
src/components/ProfileViewer/ViewMode/cards/
├── TimelineCard.js             # Keep
├── ProfessionalCard.js         # Keep
├── ContactCard.js              # Keep
└── PhotosCard.js               # Keep (or use new adaptive gallery)
```

---

## 🔄 Main Layout Changes

### Current Structure (ProfileViewer/index.js or ViewModeContent.js)

```javascript
// OLD ORDER
<ScrollView>
  <Hero />                  // 180px
  <MetricsRow />           // Complex pills
  <FamilyCard />           // Horizontal scroll
  <PersonalCard />         // Separate section
  <DatesCard />            // Separate section
  <ProfessionalCard />
  <TimelineCard />
  <PhotosCard />
  <ContactCard />
</ScrollView>
```

### New Structure

```javascript
// NEW ORDER
<ScrollView>
  <CompactHero />          // 100-120px - includes personal info
  <PhotoGallery />         // Adaptive (260-600px)
  <TimelineCard />         // If exists
  <ProfessionalCard />     // If exists
  <ContactCard />          // If exists
  <FamilyList />           // Bottom, vertical list
</ScrollView>
```

### Implementation

```javascript
// src/components/ProfileViewer/index.js

import CompactHero from './Hero/CompactHero';
import PhotoGallery from './ViewMode/cards/PhotoGallery'; // Or adaptive gallery
import TimelineCard from './ViewMode/cards/TimelineCard';
import ProfessionalCard from './ViewMode/cards/ProfessionalCard';
import ContactCard from './ViewMode/cards/ContactCard';
import FamilyList from './ViewMode/cards/FamilyList';

const ProfileViewer = ({ person, canEdit }) => {
  // Extract data
  const photos = person.photos || [];
  const timeline = person.timeline || [];
  const parents = [person.father, person.mother].filter(Boolean);
  const spouses = person.marriages?.filter(m => m.status === 'current') || [];
  const children = person.children || [];

  return (
    <ScrollView style={styles.container}>
      {/* 1. Compact Hero */}
      <CompactHero
        person={person}
        canEdit={canEdit}
        onEdit={handleEdit}
        onMenuPress={handleMenu}
      />

      {/* 2. Photo Gallery - Adaptive */}
      {photos.length > 0 && (
        <PhotoGallery photos={photos} />
      )}

      {/* 3. Timeline */}
      {timeline.length > 0 && (
        <TimelineCard timeline={timeline} />
      )}

      {/* 4. Professional */}
      <ProfessionalCard person={person} />

      {/* 5. Contact */}
      <ContactCard person={person} />

      {/* 6. Family List - Bottom */}
      <FamilyList
        parents={parents}
        spouses={spouses}
        children={children}
        onNavigate={handleNavigateToProfile}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F7F3', // Al-Jass White
  },
});
```

---

## 🎨 Design Tokens Reference

```javascript
// src/components/ui/tokens.js

export const colors = {
  najdi: {
    background: '#F9F7F3',      // Al-Jass White
    container: '#D1BBA3',        // Camel Hair Beige
    text: '#242121',             // Sadu Night
    primary: '#A13333',          // Najdi Crimson
    secondary: '#D58C4A',        // Desert Ochre
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const sizing = {
  heroAvatar: 64,              // Small hero avatar
  familyAvatar: 44,            // Family list avatar
  touchTarget: 44,             // Minimum touch target
  photoCardHeight: 260,        // Vertical stack photo
  carouselCardHeight: 200,     // Carousel photo
  carouselCardWidth: 280,
};

export const typography = {
  heroName: { fontSize: 20, fontWeight: '700' },
  heroLineage: { fontSize: 15, fontWeight: '400' },
  heroMeta: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 22, fontWeight: '600' },
  bodyLarge: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17, fontWeight: '400' },
  caption: { fontSize: 15, fontWeight: '400' },
  small: { fontSize: 13, fontWeight: '400' },
};

export const shadow = {
  ios: {
    shadowColor: '#242121',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  subtle: {
    shadowColor: '#242121',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
};
```

---

## ✅ Implementation Checklist

### Phase 1: Compact Hero (2-3 hours)
- [ ] Create `CompactHero.js` component
- [ ] Implement small avatar (64px) with fallback
- [ ] Add name + lineage text
- [ ] Add metadata row (generation + siblings)
- [ ] Integrate personal info (birth place + year)
- [ ] Add action buttons (Edit + Menu) top-right
- [ ] Test with full/medium/empty data schemas
- [ ] Verify RTL layout correctness

### Phase 2: Family Vertical List (3-4 hours)
- [ ] Create `FamilyList.js` component
- [ ] Implement single-column row layout
- [ ] Add section dividers (parents/spouse/children)
- [ ] Style avatars (44px with fallback)
- [ ] Add name + relationship labels
- [ ] Add chevron navigation icon
- [ ] Test with various family structures
- [ ] Verify no horizontal scrolling

### Phase 3: Layout Reordering (1 hour)
- [ ] Modify main ProfileViewer component
- [ ] Reorder sections: Hero → Photos → Timeline → Professional → Contact → Family
- [ ] Remove PersonalCard/DatesCard (data now in hero)
- [ ] Verify all sections collapse when empty
- [ ] Test scroll performance

### Phase 4: Photo Gallery (optional enhancement, 2-3 hours)
- [ ] Create adaptive photo gallery logic
- [ ] Implement vertical stack (1-2 photos)
- [ ] Implement horizontal carousel (3-5 photos)
- [ ] Implement grid mosaic (6+ photos fallback)
- [ ] Test transitions between layouts

### Phase 5: Testing (2 hours)
- [ ] Test with full data profile
- [ ] Test with medium data profile
- [ ] Test with minimal/empty data profile
- [ ] Verify no empty gaps/cards
- [ ] Test on multiple screen sizes (iPhone SE, 13, 14 Pro Max)
- [ ] Verify RTL layout on all sections
- [ ] Test all tap actions (edit, menu, family navigation)
- [ ] Test scroll performance with large family lists

### Phase 6: Polish (1 hour)
- [ ] Add loading states
- [ ] Add error boundaries
- [ ] Add accessibility labels
- [ ] Optimize images (lazy loading, blurhash)
- [ ] Add subtle animations (button press, transitions)

---

## 🚨 Edge Cases to Handle

### Empty Data Scenarios

1. **No photo**: Show beige circle with initials
2. **No lineage**: Show name only, skip lineage row
3. **No personal info**: Skip personal info row in hero
4. **No photos**: Collapse photo gallery section completely
5. **No timeline**: Collapse timeline section
6. **No family**: Collapse family section (show "لا توجد معلومات عائلية" empty state)
7. **No achievements/education**: Collapse professional section
8. **No contact info**: Collapse contact section

### Data Privacy

- **DOB privacy**: Check `dob_is_public` flag
  - If `false`: Show year only or "مخفي"
  - Show privacy badge when restricted
- **Phone privacy**: Respect profile settings
- **Photo privacy**: Handle missing photo gracefully

### Permission-Based UI

- **Edit button**: Only show if `canEdit === true`
- **Share button**: Show in menu for all users
- **Contact actions**: Only show if user has access permission

### RTL Considerations

- **Avatar**: Left-aligned in RTL (becomes visually right)
- **Action buttons**: Top-right in RTL (visually top-left)
- **Chevrons**: Use `chevron-back` (points right in RTL)
- **Flex direction**: Verify all layouts work in RTL
- **Text alignment**: Use `textAlign: 'left'` (auto-flips in RTL)

---

## 📊 Expected Improvements

### Space Efficiency

| Schema | Old Height | New Height | Improvement |
|--------|-----------|-----------|-------------|
| Full | ~1200px | ~1000px | 16% reduction |
| Medium | ~700px | ~650px | 7% reduction |
| Empty | ~450px | ~350px | 22% reduction |

### Scan Efficiency

| Task | Old Scrolls | New Scrolls | Improvement |
|------|-------------|-------------|-------------|
| Find family | 1 scroll | 3 scrolls | Moved to bottom |
| Find photos | 3 scrolls | 1 scroll | Moved up |
| View personal info | 2 scrolls | 0 scrolls | In hero |
| Complete scan | 3 swipes | 2-3 swipes | Similar |

### User Experience

- ✅ **Compact hero**: Less scrolling to reach content
- ✅ **Photos prominent**: Higher visual engagement
- ✅ **No horizontal scroll**: Better mobile UX (family section)
- ✅ **Personal info accessible**: Visible without scrolling
- ✅ **Simplified actions**: Edit + Menu (less clutter)
- ✅ **No empty gaps**: Cleaner layout with missing data

---

## 🎯 Success Criteria

### Visual Design
- [ ] Hero height ≤ 120px (vs 180px before)
- [ ] Avatar size 60-70px (Instagram-like)
- [ ] Personal info integrated in hero (no separate card)
- [ ] Action buttons simplified (Edit + Menu only)
- [ ] No horizontal scrolling anywhere

### Functionality
- [ ] All sections collapse when empty
- [ ] Family list supports unlimited vertical scroll
- [ ] Photo gallery adapts to photo count (1-2 vs 3-5)
- [ ] All tap actions work (edit, menu, navigation)
- [ ] RTL layout correct throughout

### Performance
- [ ] Scroll maintains 60fps
- [ ] Images load progressively (blurhash/placeholder)
- [ ] No layout shifts during render
- [ ] Memory usage stable with large family lists

### Accessibility
- [ ] All buttons have accessibility labels
- [ ] VoiceOver navigation works correctly
- [ ] Touch targets ≥ 44px
- [ ] Text contrast meets WCAG AA

---

## 📝 Notes for Implementation

1. **Start with CompactHero** - This is the most critical change and affects overall layout
2. **Test incrementally** - Verify each section works before moving to next
3. **Use existing components** where possible (Timeline, Professional, Contact)
4. **Delete carefully** - PersonalCard/DatesCard are being merged into Hero
5. **Monitor performance** - Large family lists (20+ members) should still scroll smoothly
6. **RTL testing is critical** - Test on actual device with Arabic content
7. **Empty state testing** - Verify graceful degradation with missing data

---

## 🔗 Related Documentation

- **Design System**: `/docs/DESIGN_SYSTEM.md`
- **Najdi Sadu Colors**: `/src/components/ui/tokens.js`
- **Permission System**: `/docs/PERMISSION_SYSTEM_V4.md`
- **Professional Titles**: `/src/services/professionalTitleService.js`
- **Name Chains**: `/src/utils/nameChainUtils.js`

---

**End of Specification**

**Questions? Clarifications needed?**
Contact: Refer to original discussion or design review session.

**Implementation Timeline**: 11-13 hours total
**Priority**: High - Improves core UX significantly
**Risk Level**: Medium - Major layout changes, thorough testing required
