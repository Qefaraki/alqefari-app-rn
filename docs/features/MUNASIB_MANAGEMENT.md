# Munasib Management System

**Status**: ✅ Complete
**Location**: Admin Dashboard → Munasib Management
**Component**: `src/components/admin/MunasibManager.js`

## Overview

The Munasib Management System is a comprehensive dashboard for managing Munasib (spouse) profiles in the Alqefari Family Tree. Munasib are individuals who marry into the family and don't have their own HID (Hereditary ID).

## What is a Munasib?

**Definition**: A spouse who marries into the Alqefari family but is not a blood relative.

**Identifying Characteristic**: `profile.hid === null`
- Alqefari family members have HIDs (e.g., "H12345")
- Munasib profiles have `hid = null` in the database

## Features

### 1. Search & Filter

**Search By**:
- Name (first name, last name, nick name)
- Phone number
- Location (city, country)
- Professional title

**Real-time Search**:
- Debounced search input (300ms delay)
- Instant results as you type
- Clears previous results

**Example**:
```javascript
// Search for Munasib named "Sarah"
searchQuery = "Sarah"
// Returns all Munasib profiles with "Sarah" in name fields
```

### 2. Family Statistics

**Most Common Origins**:
- Groups Munasib by city/country of origin
- Shows top 10 locations with counts
- Helps understand family connections and geographic patterns

**Example Output**:
```
الرياض: 15 munasib
جدة: 10 munasib
مكة: 8 munasib
...
```

**Use Cases**:
- Identify predominant geographic connections
- Track family expansion patterns
- Plan family gatherings by location

### 3. Marriage Connections

**View Spouse Links**:
- Shows which Alqefari family member the Munasib married
- Displays marriage status (current/past)
- Links to spouse's profile

**Data Displayed**:
- Munasib name and photo
- Spouse name and HID
- Marriage date
- Marriage status
- Children (count and names)

**Example**:
```
Munasib: Sarah Ahmed
Married to: محمد بن عبدالله الجفري (H12345)
Status: Current
Children: 3 (أحمد، فاطمة، خالد)
```

### 4. Profile Management

**Actions Available**:
- View full profile
- Edit profile information
- View family connections
- Manage marriage records
- View descendants

**Quick Actions**:
- Tap profile card to view details
- Long press for context menu
- Swipe for quick actions

## User Interface

### Profile Cards

**Display Elements**:
- Profile photo or avatar placeholder
- Full name (first + last)
- Professional title (if available)
- Location (city, country)
- Phone number
- Spouse information
- Number of children

### List View

**Sorting Options**:
- Alphabetical (default)
- By marriage date
- By number of children
- By location

**Filtering Options**:
- Current marriages only
- Past marriages only
- By location
- By number of children (0, 1-2, 3+)

### Statistics View

**Charts & Visualizations**:
- Bar chart: Top 10 origins
- Pie chart: Marriage status distribution
- Timeline: Marriages by year
- Heat map: Geographic distribution

## Technical Implementation

### Database Queries

**Identify Munasib**:
```sql
SELECT *
FROM profiles
WHERE hid IS NULL
AND deleted_at IS NULL;
```

**Get Marriage Connections**:
```sql
SELECT
  p1.first_name AS munasib_name,
  p1.photo_url AS munasib_photo,
  p2.first_name AS spouse_name,
  p2.hid AS spouse_hid,
  m.marriage_date,
  m.status AS marriage_status
FROM profiles p1
JOIN marriages m ON (m.profile1_id = p1.id OR m.profile2_id = p1.id)
JOIN profiles p2 ON (
  CASE
    WHEN m.profile1_id = p1.id THEN m.profile2_id
    ELSE m.profile1_id
  END = p2.id
)
WHERE p1.hid IS NULL
AND p1.deleted_at IS NULL;
```

**Geographic Statistics**:
```sql
SELECT
  city,
  country,
  COUNT(*) AS count
FROM profiles
WHERE hid IS NULL
AND deleted_at IS NULL
GROUP BY city, country
ORDER BY count DESC
LIMIT 10;
```

### Performance Optimizations

**Indexes**:
```sql
CREATE INDEX idx_profiles_hid_null ON profiles(id) WHERE hid IS NULL;
CREATE INDEX idx_profiles_city ON profiles(city);
CREATE INDEX idx_profiles_country ON profiles(country);
```

**Query Caching**:
- Statistics cached for 1 hour
- Profile list cached for 5 minutes
- Invalidate cache on profile updates

**Pagination**:
- Load 50 profiles per page
- Infinite scroll for better UX
- Virtual scrolling for large lists

## Access Control

### Who Can Access?

**Admin Roles**:
- Super Admin (full access)
- Admin (full access)
- Moderator (view only)

**Permissions**:
- View Munasib profiles
- Edit Munasib profiles
- Manage marriage records
- View statistics

**Check Access**:
```javascript
const { data: userProfile } = await supabase
  .from('profiles')
  .select('role')
  .eq('user_id', userId)
  .single();

const canAccessMunasibManager = ['super_admin', 'admin', 'moderator'].includes(userProfile.role);
```

## Use Cases

### 1. Family Expansion Tracking

Track how the family has grown through marriages:
- Total Munasib count
- Marriages per year
- Average children per marriage
- Geographic spread

### 2. Event Planning

Plan family events based on Munasib locations:
- Group by city for regional gatherings
- Identify far-away relatives for special invites
- Track RSVP patterns by location

### 3. Genealogical Research

Document family history through marriage connections:
- Preserve Munasib names and origins
- Link families through marriage
- Track lineage and descendants

### 4. Data Quality

Ensure complete Munasib profiles:
- Identify profiles missing photos
- Flag incomplete names
- Check for missing marriage records

## Common Workflows

### Adding a New Munasib

1. Navigate to Admin Dashboard → Munasib Management
2. Tap "Add New Munasib" button
3. Fill in profile details:
   - Name (first, last, nick name)
   - Photo (optional)
   - Birth date
   - Location (city, country)
   - Professional title (optional)
   - Phone number (optional)
4. Link to spouse via marriage record
5. Save profile

### Editing Munasib Profile

1. Search for Munasib by name
2. Tap profile card to view details
3. Tap "Edit" button
4. Update fields
5. Save changes

### Viewing Family Connections

1. Open Munasib profile
2. Navigate to "Family" tab
3. View:
   - Spouse information
   - Marriage details
   - Children list
   - Extended family (in-laws)

## Data Model

### Profile Fields (Munasib-Specific)

```javascript
{
  id: UUID,
  hid: null,                    // ← Always null for Munasib
  first_name: "Sarah",
  last_name: "Ahmed",
  nick_name: null,
  photo_url: "https://...",
  birth_date: "1990-01-15",
  city: "الرياض",
  country: "السعودية",
  professional_title: "مهندسة",
  phone: "+966501234567",
  user_id: UUID,               // ← Linked if has app account
  can_edit: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  deleted_at: null
}
```

### Marriage Record

```javascript
{
  id: UUID,
  profile1_id: UUID,           // ← Munasib ID
  profile2_id: UUID,           // ← Alqefari family member ID
  marriage_date: "2015-05-20",
  status: "current",           // or "past"
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z"
}
```

## Best Practices

### 1. Complete Profiles

Encourage complete Munasib profiles:
- Add photos (improves tree visualization)
- Include professional titles (context for family)
- Add locations (helpful for events)
- Link phone numbers (communication)

### 2. Verify Marriage Records

Ensure accurate marriage data:
- Verify marriage dates with family members
- Update status when marriages end
- Link children correctly
- Document multiple marriages if applicable

### 3. Respect Privacy

Handle Munasib data with care:
- Don't share profiles without consent
- Redact sensitive info in screenshots
- Use privacy settings for sensitive profiles
- Get permission before adding photos

### 4. Regular Updates

Keep Munasib profiles current:
- Update photos periodically
- Refresh location data
- Add new children as born
- Update professional titles

## Related Documentation

- [Permission System](../PERMISSION_SYSTEM_V4.md) - Access control for Munasib management
- [Marriage System](../MARRIAGE_DELETION_DEEP_DIVE.md) - Marriage record management
- [Profile Management](../PROFILE_REDESIGN_SPEC.md) - Profile editing workflows
- [Admin Dashboard](../REFERENCE_TABLES.md) - Admin feature access matrix
