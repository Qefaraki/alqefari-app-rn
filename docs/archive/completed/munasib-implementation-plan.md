# Munasib System Implementation Plan

## Overview

Implementation of a proper spouse/mother profile system where spouses (منتسبين - Munasib) have profiles but are not part of the family tree hierarchy.

## Core Principle

- **Family members**: Have HID (Hierarchical ID), appear in tree
- **Munasib (spouses)**: Have profiles but NO HID, don't appear in tree
- **Visibility**: Munasib visible as mothers through children's profiles

## Implementation Phases

### Phase 1: Fix Immediate Issues ✅

- [ ] Fix column names in enhanced statistics function
- [ ] Update statistics to use correct marriage table columns
- [ ] Verify statistics function works

### Phase 2: Database Schema Updates

- [ ] Add profile type tracking fields
- [ ] Add family origin tracking for Munasib
- [ ] Create indexes for performance
- [ ] Add validation functions

### Phase 3: Data Migration

- [ ] Audit existing spouse profiles
- [ ] Identify profiles that should be Munasib
- [ ] Remove HIDs from Munasib profiles
- [ ] Update profile types

### Phase 4: Update Creation Flow

- [ ] Modify MarriageEditor to not assign HID to spouses
- [ ] Update profile creation to handle Munasib type
- [ ] Add duplicate detection for Munasib
- [ ] Implement family origin tracking

### Phase 5: Update UI Components

- [ ] Filter Munasib from tree view
- [ ] Show mothers in profile details
- [ ] Update admin dashboard for Munasib stats
- [ ] Add Munasib indicators in search

### Phase 6: Testing & Validation

- [ ] Test spouse creation flow
- [ ] Verify tree display filtering
- [ ] Validate statistics accuracy
- [ ] Test edge cases (cousin marriages)

## Database Changes

### 1. Profile Table Enhancements

```sql
-- Add tracking fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  family_origin TEXT,  -- For Munasib: which family they're from
  profile_type TEXT GENERATED ALWAYS AS (
    CASE WHEN hid IS NULL THEN 'munasib' ELSE 'family' END
  ) STORED,
  is_munasib BOOLEAN GENERATED ALWAYS AS (hid IS NULL) STORED;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_profiles_munasib ON profiles(id) WHERE hid IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_family ON profiles(id) WHERE hid IS NOT NULL;
```

### 2. Fix Statistics Function

```sql
-- Fix column names and logic in get_enhanced_statistics
-- Use husband_id/wife_id instead of spouse1_id/spouse2_id
-- Count profiles without HID as Munasib
```

## Code Changes

### 1. Profile Service

- Update `createProfile` to handle null HID for Munasib
- Add `createMunasibProfile` specific function
- Update search to include profile type

### 2. Marriage Editor

- Remove HID generation for new spouses
- Add family origin input field
- Implement duplicate detection

### 3. Tree View

- Filter out profiles where `hid IS NULL`
- Maintain mother connections through `mother_id`

### 4. Profile Display

- Show mother information even if mother has no HID
- Add Munasib indicator in admin view

## Migration Script

```javascript
// Identify and fix existing Munasib profiles
async function migrateMunasibProfiles() {
  // 1. Get all profiles that are likely Munasib
  // 2. Remove their HIDs
  // 3. Set family_origin if known
  // 4. Update statistics
}
```

## Testing Checklist

- [ ] Create new spouse → No HID assigned
- [ ] View tree → Spouse not shown
- [ ] View child profile → Mother visible
- [ ] Admin stats → Munasib count accurate
- [ ] Search → Can find Munasib profiles
- [ ] Cousin marriage → Handled correctly

## Rollback Plan

1. Keep backup of current profiles table
2. Document all HIDs removed
3. Have restore script ready

## Success Criteria

- Zero spouse profiles with HIDs (except cousin marriages)
- Munasib statistics show correct counts
- Tree view shows only family members
- Mother information accessible through children
- No performance degradation

## Timeline

- Phase 1: Immediate (30 min)
- Phase 2: 1 hour
- Phase 3: 1 hour
- Phase 4: 2 hours
- Phase 5: 1 hour
- Phase 6: 1 hour
  Total: ~6 hours

## Risks & Mitigations

| Risk                            | Impact | Mitigation                        |
| ------------------------------- | ------ | --------------------------------- |
| Breaking existing relationships | HIGH   | Careful migration with validation |
| Performance issues              | MEDIUM | Add proper indexes                |
| UI confusion                    | MEDIUM | Clear indicators for Munasib      |
| Data loss                       | HIGH   | Backup before migration           |

## Notes

- Cousin marriages: Person can be both family AND Munasib
- Name variations: Need fuzzy matching to prevent duplicates
- Privacy: Munasib only visible as mothers, not as wives
- Future: Design allows for Munasib family trees later
