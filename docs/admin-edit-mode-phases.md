# Admin Edit Mode Implementation Phases

## Overview
This document outlines the phased implementation of the admin edit mode for the Alqefari family tree application. The goal is to create a world-class editing experience that feels native to iOS while using a premium neo‑native design system (no glass/blur).

## Current Status
- ✅ Admin authentication and role management
- ✅ Edit mode trigger (single tap in admin mode)
- ✅ Basic edit form structure
- ✅ Save/Cancel functionality
- ✅ Phase 1: Core Identity Fields (COMPLETED)
- ✅ Phase 2: Visual Identity (COMPLETED)

## Implementation Phases

### Phase 1: Core Identity Fields 🎯
**Priority: HIGH**
**Status: ✅ COMPLETED**

#### Fields
1. **Name** (الاسم) ✅
   - Fully editable with NameEditor component
   - Large 36px font with animations
   - Clear button with smooth animations
   - Real-time validation (min 2 characters)
   
2. **Bio** (السيرة الذاتية) ✅
   - Expandable textarea with BioEditor component
   - Auto-expanding from 3 to 10 lines
   - Arabic character counter (٢٥٠/٥٠٠)
   - Native card design (white surface, soft elevation)
   
3. **Sibling Order** (ترتيب الإخوة) ✅
   - SiblingOrderStepper component
   - Premium native controls
   - Haptic feedback on interactions
   - Live preview text showing position

#### UX Specifications
- **Name Input**
  - Large, prominent text input at top (like iOS Contacts)
  - Clear button on right when focused
  - RTL text alignment
  - Auto-capitalize first letter
  - Minimum 2 characters validation
  
- **Bio TextArea**
  - Expanding text area that grows with content
  - Character counter (e.g., "٢٥٠/٥٠٠")
  - Placeholder text: "أضف سيرة ذاتية..."
  - Minimum height: 3 lines
  - Maximum height: 10 lines before scrolling
  
- **Sibling Order Control**
  - Stepper control with +/- buttons
  - Visual number display between buttons
  - Disable minus at 0
  - Live preview showing position change
  - Subtle animation when order changes

#### Technical Implementation
```javascript
// Sibling order stepper component
<View style={styles.stepperContainer}>
  <TouchableOpacity onPress={() => handleSiblingOrderChange(-1)}>
    <Ionicons name="remove-circle" size={24} color="#007AFF" />
  </TouchableOpacity>
  <Text style={styles.stepperValue}>{editedData.sibling_order}</Text>
  <TouchableOpacity onPress={() => handleSiblingOrderChange(1)}>
    <Ionicons name="add-circle" size={24} color="#007AFF" />
  </TouchableOpacity>
</View>
```

---

### Phase 2: Visual Identity 📸
**Priority: MEDIUM**
**Status: ✅ COMPLETED (2025-09-04)**

#### Fields
1. **Photo Upload** (رفع الصورة) ✅
   - PhotoEditor component with native camera/gallery picker
   - Circular 160x160 preview with native surface framing (no blur)
   - Direct upload to Supabase storage
   - Client-side image optimization and EXIF stripping
   - Loading progress during upload
   - Error state with icon and message
   - "Remove Photo" button with gradient style

#### UX Specifications
- **Photo Editor**
  - Circular photo preview (160x160)
  - Tap photo to open picker sheet
  - Action sheet with Camera/Gallery/Remove options
  - Loading progress during optimization
  - Upload progress indicator
  - Error state with person silhouette placeholder
  - "Remove Photo" button (requires confirmation)
  
- **Interaction Flow**
  1. Tap photo circle or "Add Photo" button
  2. Action sheet appears with options
  3. Select Camera or Gallery
  4. Image optimization starts automatically
  5. Upload begins with progress indicator
  6. Photo updates upon successful upload

#### Technical Considerations
- Client-side image compression
- EXIF metadata stripping for privacy
- Retry mechanism for failed uploads
- Storage bucket with RLS policies
- Automatic cleanup of old photos

---

### Phase 3: Smart Date Editing 📅
**Priority: HIGH**
**Status: Not Started**

#### Fields
1. **Birth Date** (تاريخ الميلاد) - `dob_data` JSONB
2. **Death Date** (تاريخ الوفاة) - `dod_data` JSONB

#### Data Structure
```json
{
  "hijri": {"year": 1445, "month": 7, "day": 15},
  "gregorian": {"year": 2024, "month": 1, "day": 20},
  "approximate": true,
  "display": "١٤٤٥/٧/١٥ هـ"
}
```

#### UX Specifications
- **Date Editor Component**
  - Toggle between Hijri/Gregorian calendars
  - "Approximate date" checkbox
  - Visual calendar picker
  - Manual text input option
  - Auto-conversion between calendar systems
  - Quick presets:
    - "Today" (اليوم)
    - "Unknown" (غير معروف)
    - "Approximate year only" (السنة التقريبية)
  
- **Validation**
  - Death date must be after birth date
  - Future dates not allowed for death
  - Hijri months respect actual days
  - Invalid dates show inline error

#### Technical Implementation
- Create `DateEditor` component
- Use date conversion library for Hijri/Gregorian
- Store both formats for flexibility
- Display format based on user preference

---

### Phase 4: Relationship Selector 👨‍👩‍👧
**Priority: MEDIUM**
**Status: Not Started**

#### Fields
1. **Father** (الوالد) - `father_id`
2. **Mother** (الوالدة) - `mother_id`

#### UX Specifications
- **Parent Selector Component**
  - Search input with Arabic keyboard
  - Filtered dropdown of potential parents
  - Smart suggestions:
    - Filter by appropriate generation
    - Show most likely candidates first
    - Indicate if person already has children
  - Mini family tree preview
  - Current selection shows:
    - Name
    - Generation
    - Number of children
  - "Clear selection" option
  
- **Search Features**
  - Real-time filtering as you type
  - Search by name or HID
  - Recent selections at top
  - Visual indicators for gender

#### Technical Considerations
- Prevent circular references
- Validate generation logic
- Efficient search with large datasets
- Cache frequent searches

---

### Phase 5: Advanced Controls 🛡️
**Priority: LOW**
**Status: Not Started**

#### Fields
1. **Role** (الدور) - admin/user (super admin only)
2. **HID** (المعرف الهرمي) - Read-only
3. **Death Place** (مكان الوفاة)

#### UX Specifications
- **Role Selector**
  - Only visible if current user is super admin
  - Segmented control: User | Admin
  - Confirmation dialog for role changes
  - Show last modified by/when
  
- **HID Display**
  - Read-only field with copy button
  - Explanation tooltip on tap
  - Format: "R1.2.3" with monospace font
  
- **Death Place**
  - Text input with location suggestions
  - Similar to current residence field
  - Only shown if status is "deceased"

#### Security Considerations
- Role changes logged in audit trail
- Only super admins can modify roles
- HID never editable through UI

---

### Phase 6: Marriage Management 💑
**Priority: HIGH**
**Status: Not Started**

#### Features
1. **Marriage Editor Component**
   - Add/Edit marriages for selected person
   - Spouse selector with smart filtering:
     - Filter by opposite gender
     - Suggest appropriate generation matches
     - Search by name with Arabic support
   - Marriage details:
     - Status (married/divorced/widowed)
     - Start date (with date picker)
     - End date (if divorced/widowed)
     - Munasib (منسب) - cultural context field
   
2. **UI Integration**
   - New section in ProfileSheet edit mode
   - "Add Marriage" button
   - List of existing marriages with edit/delete
   - Validation to prevent duplicate marriages

#### Technical Requirements
- Deploy `admin_create_marriage` function from scripts
- Create `admin_update_marriage` function
- Create `admin_delete_marriage` function
- Add MarriageEditor component
- Integrate with existing admin mode

---

## Future Enhancements

### Batch Editing
- Select multiple profiles
- Apply common changes
- Bulk status updates

### Change History
- View edit history
- Revert changes
- See who made what changes

### Field Templates
- Save common field combinations
- Quick apply templates
- Share templates between admins

### Offline Support
- Queue edits when offline
- Sync when connection restored
- Conflict resolution

## Design Principles

1. **Clarity**: Every action should be immediately understandable
2. **Feedback**: Instant visual feedback for all interactions
3. **Safety**: Destructive actions require confirmation
4. **Efficiency**: Common tasks should be fast
5. **Consistency**: Follow iOS HIG and our neo‑native design system (no glass)

## Success Metrics
- Time to complete common edits < 30 seconds
- Error rate < 5%
- All fields accessible within 2 taps
- Zero data loss from user errors
