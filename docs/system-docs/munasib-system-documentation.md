# Munasib System Documentation

## Overview
The Munasib system tracks spouses who married into the Al-Qefari family from other families. This documentation is based on the working MunasibManager component we built together.

## Core Concept: What Makes a Profile "Munasib"

A Munasib profile is identified by two key characteristics:
1. **HID is NULL** - They don't have a Hierarchical ID because they're not blood family
2. **family_origin is populated** - Stores which family they come from (e.g., "العتيبي")

## How MunasibManager Works

### 1. Fetching Munasib Profiles (MunasibManager.js lines 42-46)

```javascript
const { data: profiles, error } = await supabase
  .from("profiles")
  .select("*")
  .is("hid", null)                    // MUST have NULL HID
  .not("family_origin", "is", null);  // MUST have family_origin
```

**Key Points:**
- Direct Supabase query, NOT using RPC functions
- Filters for NULL HID (this is how we identify Munasib)
- Requires family_origin to be present

### 2. Data Structure

Munasib profiles in the database have:
- `id`: UUID (standard)
- `hid`: NULL (always NULL for Munasib)
- `name`: Full name
- `gender`: male/female
- `family_origin`: Their original family name
- `generation`: Same as their spouse
- All other standard profile fields

### 3. Grouping by Family (MunasibManager.js lines 51-63)

The system groups Munasib profiles by their `family_origin`:
```javascript
profiles?.forEach((profile) => {
  const familyName = profile.family_origin;
  if (!familyGroups[familyName]) {
    familyGroups[familyName] = {
      family_name: familyName,
      members: [],
      count: 0,
    };
  }
  familyGroups[familyName].members.push(profile);
  familyGroups[familyName].count++;
});
```

## How SpouseManager Creates New Munasib

### Current Implementation (SpouseManager.js lines 133-156)

```javascript
// Step 1: Prepare profile data
const newProfileData = {
  name: newSpouseName.trim(),
  gender: spouseGender,
  generation: person.generation,
  is_root: false,
  family_origin: familyOrigin,    // Critical: Sets family origin
  phone: newSpousePhone.trim() || null,
};

// Step 2: Create profile (PROBLEM: This uses admin_create_profile RPC)
const { data: newPerson, error: createError } =
  await profilesService.createProfile(newProfileData);

// Step 3: Create marriage
const { data: marriage, error: marriageError } =
  await profilesService.createMarriage({
    husband_id,
    wife_id,
    munasib: true,
  });
```

## The Problem

**admin_create_profile ALWAYS generates an HID** (see migrations/025_consistency_fixes.sql line 83):
```sql
v_next_hid := generate_next_hid((SELECT hid FROM profiles WHERE id = p_father_id));
```

This means profiles created via `profilesService.createProfile()` will have an HID and won't be recognized as Munasib by MunasibManager.

## The Solution: Direct Insert Pattern

Since MunasibManager successfully queries Munasib profiles with NULL HID, we need to create them the same way:

```javascript
// Direct insert to ensure NULL HID
const { data: newPerson, error } = await supabase
  .from('profiles')
  .insert({
    name: spouseName.trim(),
    gender: spouseGender,
    generation: person.generation,
    family_origin: familyOrigin,
    hid: null,                     // Explicitly NULL for Munasib
    status: 'alive',
    is_root: false,
    sibling_order: 0,
    // ... other fields as needed
  })
  .select()
  .single();
```

## Key Principles

1. **Munasib = NULL HID** - This is the fundamental identifier
2. **Direct table access works** - We don't need special RPC functions
3. **family_origin is required** - Must extract from name or get from user
4. **Same generation as spouse** - They're married peers

## Components Using This System

1. **MunasibManager** - Views and manages all Munasib families
2. **FamilyDetailModal** - Shows members married to specific families
3. **SpouseManager** - Creates new spouse profiles (needs fix)
4. **InlineSpouseAdder** - Quick spouse addition (needs fix)

## Required Fixes

Both SpouseManager and InlineSpouseAdder need to:
1. Stop using `profilesService.createProfile()`
2. Use direct Supabase insert with `hid: null`
3. Ensure `family_origin` is always set
4. Follow the pattern that MunasibManager expects