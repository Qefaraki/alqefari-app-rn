# Spouse Profile System Documentation

## Overview

The Alqefari Family Tree application has a complete, well-architected spouse profile system that handles profiles for people who marry into the family. This system was discovered to be fully functional and requires no changes.

## System Architecture

### Profile Identification
Spouse profiles are uniquely identified by:
- **HID Pattern**: `2000.X` (where X is sequential: 2000.1, 2000.2, 2000.3...)
- **No Parents**: Both `father_id` and `mother_id` are NULL
- **Distinct from Roots**: Unlike family roots (`R1`, `R2`), spouses use the `2000.X` pattern

### Current Statistics
- **148 active spouse profiles** in the system
- All currently female (wives married into the family)
- Full profile data with all standard fields populated

## Database Schema

Spouse profiles use the same `profiles` table structure:

```sql
-- Example spouse profile structure
{
  id: UUID,                    -- Unique identifier
  hid: '2000.138',            -- Special spouse HID pattern
  name: 'نوف',                -- Full Arabic name
  gender: 'female',           -- Gender
  generation: 4,              -- Matches spouse's generation
  father_id: NULL,            -- No bloodline parent
  mother_id: NULL,            -- No bloodline parent
  bio: 'نبذة شخصية...',      -- Biography
  photo_url: 'https://...',   -- Profile photo
  social_media_links: {...},  -- Social media accounts
  achievements: [...],        -- Personal achievements
  education: '...',          -- Educational background
  occupation: '...',         -- Career information
  current_residence: '...',  -- Location
  phone: '...',             -- Contact info
  email: '...',             -- Email address
  user_id: NULL,            -- Ready for future authentication
  profile_visibility: 'public', -- Privacy settings
  tree_meta: {},            -- Available for metadata
  created_at: '2024-...',   -- Timestamp
  updated_at: '2024-...',   -- Last modified
  version: 1,               -- Version control
  deleted_at: NULL          -- Soft delete support
}
```

## How It Works

### 1. Profile Creation Flow
When a marriage is added through the MarriageEditor:

```javascript
// Automatic spouse profile creation
1. User selects "Create New Spouse"
2. System generates next HID: 
   - Queries MAX(2000.X) + 1
   - Assigns 2000.{next}
3. Creates profile with:
   - No parent IDs
   - Generation matching partner
   - Full profile fields
4. Links via marriages table
```

### 2. Profile Viewing
- **Access**: Click spouse name in marriages section of any profile
- **Display**: Full ProfileSheet with all information
- **Navigation**: Bidirectional between spouses and family members
- **Features**: Complete profile view including:
  - Personal information
  - Biography
  - Photos
  - Social media links
  - Achievements
  - Marriage connections

### 3. Profile Editing
- **Admin Mode**: Full edit capabilities
- **All Fields Editable**: Bio, photos, social media, etc.
- **Audit Trail**: All changes logged in audit_log
- **Version Control**: Automatic versioning on updates

### 4. Tree Visualization
- **Not Shown as Nodes**: Spouses don't appear on the family tree
- **Accessible via Marriage**: Click through from family member's marriage info
- **Design Rationale**: Maintains visual clarity of bloodline while preserving full profiles

## Code Examples

### Identifying Spouse Profiles

```javascript
// JavaScript helper function
const isSpouseProfile = (profile) => {
  return profile.hid?.startsWith('2000.') || 
         (!profile.father_id && !profile.mother_id && !profile.hid?.startsWith('R'));
};

// SQL query for all spouses
SELECT * FROM profiles 
WHERE hid LIKE '2000.%'
ORDER BY CAST(SUBSTRING(hid FROM 6) AS INTEGER);

// Get spouse with marriages
SELECT 
  p.*,
  CASE 
    WHEN m.husband_id = p.id THEN w.name
    ELSE h.name
  END as partner_name
FROM profiles p
LEFT JOIN marriages m ON (p.id = m.husband_id OR p.id = m.wife_id)
LEFT JOIN profiles h ON m.husband_id = h.id
LEFT JOIN profiles w ON m.wife_id = w.id
WHERE p.hid LIKE '2000.%';
```

### Creating a New Spouse Profile

```javascript
// Through MarriageEditor component
const createSpouseProfile = async (spouseData, partnerProfile) => {
  const newSpouse = {
    name: spouseData.name,
    gender: spouseData.gender,
    generation: partnerProfile.generation, // Match partner
    // No father_id or mother_id - this triggers 2000.X HID
    bio: spouseData.bio || null,
    photo_url: spouseData.photo_url || null,
    // ... other fields
  };
  
  const { data, error } = await profilesService.createProfile(newSpouse);
  // System automatically assigns 2000.X HID
  return { data, error };
};
```

### Linking Existing Profile as Spouse

```javascript
// When someone already in the system marries a family member
const linkExistingAsSpouse = async (existingPersonId, familyMemberId) => {
  // Just create the marriage - no new profile needed
  const marriage = {
    husband_id: familyMember.gender === 'male' ? familyMemberId : existingPersonId,
    wife_id: familyMember.gender === 'female' ? familyMemberId : existingPersonId,
    status: 'married'
  };
  
  return await profilesService.createMarriage(marriage);
};
```

## Future Authentication Support

The system is already prepared for spouse authentication:

```javascript
// When a spouse creates an account
const linkSpouseToAuth = async (spouseProfileId, authUserId) => {
  // Update the user_id field to link profile to auth
  await supabase
    .from('profiles')
    .update({ user_id: authUserId })
    .eq('id', spouseProfileId);
    
  // They can now log in and edit their own profile
};
```

## Visual Indicators (Optional Enhancements)

While the system is fully functional, these UX improvements could be added:

### 1. Profile Badge
```jsx
{isSpouseProfile(profile) && (
  <Badge text="متزوج في العائلة" color="purple" />
)}
```

### 2. Different Profile Color
```jsx
<ProfileCard 
  style={{
    borderColor: isSpouseProfile(profile) ? '#9333EA' : '#059669'
  }}
/>
```

### 3. Special Icon
```jsx
{profile.hid?.startsWith('2000.') && (
  <Icon name="rings" size={20} color="#9333EA" />
)}
```

## System Integrity Features

### Data Integrity
- **Unique HID Constraint**: Prevents duplicate spouse IDs
- **Foreign Key Constraints**: Maintains referential integrity with marriages
- **Generation Consistency**: Spouses match partner's generation

### Audit & Version Control
- **Audit Logging**: All changes tracked in audit_log table
- **Version Field**: Optimistic locking prevents conflicts
- **Soft Delete**: deleted_at field preserves historical data

### Privacy & Security
- **profile_visibility**: Controls who can view profile ('public', 'family', 'private')
- **RLS Policies**: Row-level security enforced
- **Admin Functions**: All edits go through secure RPCs

## FAQ

### Q: Why use HID pattern 2000.X for spouses?
**A:** This clearly distinguishes spouses from family members (who use patterns like 1.2.3) while maintaining a sequential, queryable structure.

### Q: Can spouses appear on the family tree visualization?
**A:** By design, no. This maintains visual clarity of the bloodline. Spouses are accessible through marriage connections on family member profiles.

### Q: What happens if two family members marry each other?
**A:** Both retain their original family HIDs. The marriage is recorded in the marriages table linking their existing profiles.

### Q: Can male spouses (husbands marrying into the family) be added?
**A:** Yes, the system supports any gender. Simply create a profile with gender='male' and no parent IDs.

### Q: How many spouses can one person have?
**A:** Unlimited. The marriages table supports multiple marriages per person with status tracking (married, divorced, widowed).

## Database Queries for Analysis

```sql
-- Count all spouse profiles
SELECT COUNT(*) FROM profiles WHERE hid LIKE '2000.%';

-- Get all spouses with their partners
SELECT 
  s.name as spouse_name,
  s.hid as spouse_hid,
  f.name as family_member_name,
  f.hid as family_hid,
  m.status as marriage_status
FROM profiles s
JOIN marriages m ON (s.id = m.wife_id OR s.id = m.husband_id)
JOIN profiles f ON (
  (m.wife_id = s.id AND m.husband_id = f.id) OR 
  (m.husband_id = s.id AND m.wife_id = f.id)
)
WHERE s.hid LIKE '2000.%'
ORDER BY CAST(SUBSTRING(s.hid FROM 6) AS INTEGER);

-- Find next available spouse HID
SELECT 'Next spouse HID: 2000.' || (
  COALESCE(MAX(CAST(SUBSTRING(hid FROM 6) AS INTEGER)), 0) + 1
) 
FROM profiles 
WHERE hid LIKE '2000.%';
```

## Conclusion

The spouse profile system is:
- ✅ **Fully Implemented**: No changes needed
- ✅ **Well-Architected**: Clean separation of concerns
- ✅ **Scalable**: Handles unlimited spouses efficiently
- ✅ **Future-Proof**: Ready for authentication and extended features
- ✅ **Currently Active**: Managing 148 spouse profiles successfully

The original system design elegantly solves the spouse profile challenge while maintaining the integrity and clarity of the family tree structure. This documentation serves as a reference for understanding and working with spouse profiles in the Alqefari Family Tree application.

---

*Last Updated: September 2025*
*Document Version: 1.0*