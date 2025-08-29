# Frontend Update Guide for Backend v2

## Critical: Read This First

This guide contains **EVERYTHING** needed to update the React Native frontend to work with the new normalized backend schema. Follow this guide step-by-step to ensure a smooth transition.

**Context Window Warning**: This document captures all critical information before context is lost. Keep this guide open during implementation.

---

## Table of Contents

1. [Quick Reference Checklist](#quick-reference-checklist)
2. [Breaking Changes Summary](#breaking-changes-summary)
3. [Data Structure Updates](#data-structure-updates)
4. [API Function Replacements](#api-function-replacements)
5. [Component Updates](#component-updates)
6. [Service Layer Updates](#service-layer-updates)
7. [Admin Features Implementation](#admin-features-implementation)
8. [Migration Helpers](#migration-helpers)
9. [Testing Procedures](#testing-procedures)
10. [Deployment Steps](#deployment-steps)

---

## Quick Reference Checklist

### Priority 1: Critical Updates (App Won't Work Without These)
- [ ] Update `src/services/profiles.js` to use new RPC functions
- [ ] Replace all `get_tree_data()` calls with `get_branch_data()`
- [ ] Update TypeScript interfaces in `src/types/supabase.ts` ✅ (Already done)
- [ ] Fix date field access (birth_date → dob_data)
- [ ] Fix social media access (profile.twitter → profile.social_media_links.twitter)

### Priority 2: Data Access Pattern Updates
- [ ] Implement viewport-based loading in TreeView
- [ ] Update ProfileSheet to fetch marriages separately
- [ ] Replace full tree loading with branch loading
- [ ] Update search to use `search_profiles_safe()`

### Priority 3: New Features
- [ ] Add admin mode trigger (5-tap gesture)
- [ ] Create validation dashboard UI
- [ ] Implement profile edit forms
- [ ] Add layout recalculation status indicators

---

## Breaking Changes Summary

### 1. Removed Profile Fields
These fields NO LONGER EXIST on the Profile object:
- ❌ `spouse_count` - Use marriages table
- ❌ `spouse_names` - Use marriages table
- ❌ `birth_date` - Use `dob_data`
- ❌ `death_date` - Use `dod_data`
- ❌ `twitter` - Use `social_media_links.twitter`
- ❌ `instagram` - Use `social_media_links.instagram`
- ❌ `linkedin` - Use `social_media_links.linkedin`
- ❌ `website` - Use `social_media_links.website`

### 2. Required Fields
These fields are now REQUIRED:
- ✅ `hid` - Now NOT NULL
- ✅ `social_media_links` - Defaults to empty object

### 3. Renamed/Restricted Functions
- ❌ `get_tree_data()` → `internal_get_full_tree_for_layout()` (RESTRICTED)
- ✅ Use `get_branch_data()` instead

---

## Data Structure Updates

### 1. Date Format Changes

**OLD Structure:**
```javascript
profile.birth_date = "1445"  // Simple string
profile.death_date = "1390"
```

**NEW Structure:**
```javascript
profile.dob_data = {
  hijri: {
    year: 1445,
    month: 7,
    day: 15
  },
  gregorian: {
    year: 2024,
    month: 1,
    day: 20,
    approximate: true
  },
  display: "1445/7/15هـ"
}
```

**Update Code:**
```javascript
// OLD - Don't use
const birthYear = profile.birth_date;

// NEW - Use this
const birthYear = profile.dob_data?.hijri?.year || profile.dob_data?.gregorian?.year;
const birthDisplay = profile.dob_data?.display || formatDateDisplay(profile.dob_data);
```

### 2. Social Media Access

**OLD Structure:**
```javascript
profile.twitter = "https://twitter.com/username"
profile.instagram = "https://instagram.com/username"
```

**NEW Structure:**
```javascript
profile.social_media_links = {
  twitter: "https://twitter.com/username",
  instagram: "https://instagram.com/username",
  linkedin: "https://linkedin.com/in/username"
}
```

**Update Code:**
```javascript
// OLD - Don't use
if (profile.twitter) { ... }

// NEW - Use this
if (profile.social_media_links?.twitter) { ... }

// Getting all social links
const socialPlatforms = Object.entries(profile.social_media_links || {});
```

### 3. Spouse Information

**OLD Access:**
```javascript
const spouseCount = profile.spouse_count;
const spouseNames = profile.spouse_names;
```

**NEW Access:**
```javascript
// Must fetch from marriages table
const { data: marriages } = await supabase
  .rpc('get_person_marriages', { p_id: profile.id });

const spouseCount = marriages?.length || 0;
const spouseNames = marriages?.map(m => m.spouse_name) || [];
```

---

## API Function Replacements

### 1. Tree Data Loading

**OLD - Full Tree (DON'T USE):**
```javascript
const { data } = await supabase.rpc('get_tree_data');
```

**NEW - Branch Loading:**
```javascript
// Load a specific branch with depth limit
const { data } = await supabase.rpc('get_branch_data', {
  p_hid: '1.1',      // Branch HID
  p_max_depth: 3,    // Depth limit (1-10)
  p_limit: 100       // Node limit (1-500)
});

// Each node includes has_more_descendants flag
if (node.has_more_descendants) {
  // Load more on demand
}
```

### 2. Viewport-Based Loading

**NEW Function:**
```javascript
const { data } = await supabase.rpc('get_visible_nodes', {
  p_viewport: {
    left: -500,
    top: -300,
    right: 500,
    bottom: 700
  },
  p_zoom_level: 1.0,
  p_limit: 200
});
```

### 3. Safe Search

**OLD:**
```javascript
// Direct table query - unsafe
const { data } = await supabase
  .from('profiles')
  .select('*')
  .ilike('name', `%${query}%`);
```

**NEW:**
```javascript
const { data } = await supabase.rpc('search_profiles_safe', {
  p_query: searchTerm,
  p_limit: 50,
  p_offset: 0
});

// Returns with rank and total_count for pagination
```

### 4. Admin Functions (All Async Now)

**Create Profile:**
```javascript
const { data, error } = await supabase.rpc('admin_create_profile', {
  p_name: 'عبدالله',
  p_gender: 'male',
  p_father_id: parentId,
  p_generation: 4,
  p_dob_data: {
    hijri: { year: 1445 }
  },
  p_social_media_links: {
    twitter: 'https://twitter.com/username'
  }
});

// Layout recalculation happens async - check queue
```

**Update Profile:**
```javascript
const { data, error } = await supabase.rpc('admin_update_profile', {
  p_id: profileId,
  p_version: currentVersion, // Required for optimistic locking
  p_updates: {
    name: 'New Name',
    dob_data: { hijri: { year: 1446 } },
    social_media_links: { twitter: '...' }
  }
});
```

---

## Component Updates

### 1. TreeView.js Updates

**Key Changes:**
- Replace `get_tree_data()` with viewport-based loading
- Handle `has_more_descendants` flag
- Update date display logic

```javascript
// In TreeView.js

// OLD - Remove this
useEffect(() => {
  const { data } = await supabase.rpc('get_tree_data');
  setNodes(data);
}, []);

// NEW - Add this
useEffect(() => {
  // Initial load - get root branches
  const loadInitialData = async () => {
    const { data } = await supabase.rpc('get_branch_data', {
      p_hid: 'R1',  // Start from a root
      p_max_depth: 3,
      p_limit: 100
    });
    setNodes(data);
  };
  
  loadInitialData();
}, []);

// Add viewport-based loading
const loadVisibleNodes = async (viewport) => {
  const { data } = await supabase.rpc('get_visible_nodes', {
    p_viewport: viewport,
    p_zoom_level: scale.value,
    p_limit: 200
  });
  updateVisibleNodes(data);
};
```

### 2. ProfileSheet.js Updates

**Remove Direct Spouse Access:**
```javascript
// OLD - Remove
<Text>{person.spouse_count} أزواج</Text>
<Text>{person.spouse_names?.join('، ')}</Text>

// NEW - Add
const [marriages, setMarriages] = useState([]);

useEffect(() => {
  if (person?.id) {
    loadMarriages();
  }
}, [person?.id]);

const loadMarriages = async () => {
  const { data } = await supabase.rpc('get_person_marriages', {
    p_id: person.id
  });
  setMarriages(data || []);
};

// In render
{marriages.length > 0 && (
  <Text>{marriages.length} أزواج</Text>
  <Text>{marriages.map(m => m.spouse_name).join('، ')}</Text>
)}
```

**Update Date Display:**
```javascript
// OLD
<Text>{person.birth_date}هـ</Text>

// NEW
<Text>{formatDateDisplay(person.dob_data)}</Text>

// Helper function
const formatDateDisplay = (dateData) => {
  if (!dateData) return '—';
  if (dateData.display) return dateData.display;
  
  const hijri = dateData.hijri;
  const gregorian = dateData.gregorian;
  
  if (hijri?.year) {
    return `${hijri.year}هـ`;
  }
  if (gregorian?.year) {
    return gregorian.approximate ? `~${gregorian.year}م` : `${gregorian.year}م`;
  }
  return '—';
};
```

**Update Social Media:**
```javascript
// OLD
{person.twitter && (
  <Pressable onPress={() => Linking.openURL(person.twitter)}>
    <Text>Twitter</Text>
  </Pressable>
)}

// NEW
{person.social_media_links?.twitter && (
  <Pressable onPress={() => Linking.openURL(person.social_media_links.twitter)}>
    <Text>Twitter</Text>
  </Pressable>
)}

// Or iterate all social links
{Object.entries(person.social_media_links || {}).map(([platform, url]) => (
  <Pressable key={platform} onPress={() => Linking.openURL(url)}>
    <Text>{platform}</Text>
  </Pressable>
))}
```

### 3. family-data.js Migration

The local data needs updating to match new structure:

```javascript
// Update src/data/family-data.js

// OLD
export const rawFamilyData = [
  { 
    id: "uuid-1", 
    first_name: "سليمان",
    birth_date: "1320",
    twitter: "https://twitter.com/example"
  }
];

// NEW
export const rawFamilyData = [
  { 
    id: "uuid-1", 
    name: "سليمان", // first_name → name
    dob_data: {
      hijri: { year: 1320 },
      display: "1320هـ"
    },
    social_media_links: {
      twitter: "https://twitter.com/example"
    }
  }
];

// Update the processing function
export const familyData = rawFamilyData.map(person => ({
  ...person,
  hid: person.hid || `TEMP_${person.id}`, // HID now required
  social_media_links: person.social_media_links || {},
  // Remove spouse_count, spouse_names
}));
```

---

## Service Layer Updates

### 1. Update src/services/profiles.js

```javascript
import { supabase } from './supabase';

export const profilesService = {
  // Replace getTreeData with getBranchData
  async getBranchData(hid = null, maxDepth = 3) {
    const { data, error } = await supabase.rpc('get_branch_data', {
      p_hid: hid,
      p_max_depth: maxDepth,
      p_limit: 200
    });
    
    if (error) throw error;
    return data;
  },

  // Add viewport loading
  async getVisibleNodes(viewport, zoomLevel = 1.0) {
    const { data, error } = await supabase.rpc('get_visible_nodes', {
      p_viewport: viewport,
      p_zoom_level: zoomLevel,
      p_limit: 200
    });
    
    if (error) throw error;
    return data;
  },

  // Add safe search
  async searchProfiles(query, limit = 50, offset = 0) {
    const { data, error } = await supabase.rpc('search_profiles_safe', {
      p_query: query,
      p_limit: limit,
      p_offset: offset
    });
    
    if (error) throw error;
    return data;
  },

  // Add marriage fetching
  async getPersonMarriages(personId) {
    const { data, error } = await supabase.rpc('get_person_marriages', {
      p_id: personId
    });
    
    if (error) throw error;
    return data;
  },

  // Update admin functions
  async createProfile(profileData) {
    // Map old field names to new
    const mappedData = {
      p_name: profileData.name,
      p_gender: profileData.gender,
      p_father_id: profileData.father_id,
      p_generation: profileData.generation,
      p_dob_data: profileData.dob_data || null,
      p_photo_url: profileData.photo_url || null,
      p_bio: profileData.bio || null,
      p_current_residence: profileData.current_residence || null,
      p_occupation: profileData.occupation || null,
      p_social_media_links: profileData.social_media_links || {}
    };

    const { data, error } = await supabase.rpc('admin_create_profile', mappedData);
    
    if (error) {
      // Handle validation errors
      if (error.message.includes('Circular parent')) {
        throw new Error('Cannot create circular relationship');
      }
      throw error;
    }
    
    return data;
  },

  // Add validation dashboard access
  async getValidationDashboard() {
    const { data, error } = await supabase.rpc('admin_validation_dashboard');
    if (error) throw error;
    return data;
  }
};
```

### 2. Create Migration Helper Service

Create `src/services/migrationHelpers.js`:

```javascript
// Helper functions for backward compatibility during migration

export const migrationHelpers = {
  // Convert old date format to new
  convertDateToJSONB(dateString) {
    if (!dateString) return null;
    
    // Try to parse as Hijri year
    const yearMatch = dateString.match(/(\d{3,4})/);
    if (yearMatch) {
      return {
        hijri: { year: parseInt(yearMatch[1]) },
        display: `${yearMatch[1]}هـ`
      };
    }
    
    return null;
  },

  // Get spouse count without direct field
  async getSpouseCount(profileId) {
    const marriages = await profilesService.getPersonMarriages(profileId);
    return marriages?.length || 0;
  },

  // Format date for display
  formatDateDisplay(dateData) {
    if (!dateData) return '';
    if (dateData.display) return dateData.display;
    
    if (dateData.hijri?.year) {
      return `${dateData.hijri.year}هـ`;
    }
    if (dateData.gregorian?.year) {
      const prefix = dateData.gregorian.approximate ? '~' : '';
      return `${prefix}${dateData.gregorian.year}م`;
    }
    
    return '';
  },

  // Extract social media platform URL
  getSocialMediaUrl(profile, platform) {
    // Check new structure first
    if (profile.social_media_links?.[platform]) {
      return profile.social_media_links[platform];
    }
    
    // Fallback to old structure (for migration period)
    if (profile[platform]) {
      return profile[platform];
    }
    
    return null;
  }
};
```

---

## Admin Features Implementation

### 1. Admin Mode Store

Create `src/stores/useAdminStore.js`:

```javascript
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

export const useAdminStore = create((set, get) => ({
  isAdmin: false,
  tapCount: 0,
  lastTapTime: 0,
  showPasscodePrompt: false,
  
  handleAdminTap: async () => {
    const now = Date.now();
    const state = get();
    
    // Reset if too much time passed
    if (now - state.lastTapTime > 2000) {
      set({ tapCount: 1, lastTapTime: now });
      return;
    }
    
    const newCount = state.tapCount + 1;
    
    if (newCount >= 5) {
      // Trigger authentication
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (hasHardware) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Admin Access',
          fallbackLabel: 'Use Passcode'
        });
        
        if (result.success) {
          set({ isAdmin: true, tapCount: 0 });
          await AsyncStorage.setItem('isAdmin', 'true');
        }
      } else {
        set({ showPasscodePrompt: true, tapCount: 0 });
      }
    } else {
      set({ tapCount: newCount, lastTapTime: now });
    }
  },
  
  verifyPasscode: async (passcode) => {
    // In production, verify against secure backend
    const ADMIN_PASSCODE = '2025'; // Should be in env
    
    if (passcode === ADMIN_PASSCODE) {
      set({ isAdmin: true, showPasscodePrompt: false });
      await AsyncStorage.setItem('isAdmin', 'true');
      return true;
    }
    
    return false;
  },
  
  logout: async () => {
    set({ isAdmin: false });
    await AsyncStorage.removeItem('isAdmin');
  }
}));
```

### 2. Admin UI Overlay

Add to `App.js`:

```javascript
import { useAdminStore } from './src/stores/useAdminStore';

// In App component
const { handleAdminTap, isAdmin } = useAdminStore();

// Add invisible tap area in header
<Pressable 
  onPress={handleAdminTap}
  style={{
    position: 'absolute',
    top: 0,
    right: 0,
    width: 100,
    height: 100,
    zIndex: 999
  }}
/>

// Show admin indicator
{isAdmin && (
  <View style={styles.adminBadge}>
    <Text style={styles.adminText}>ADMIN</Text>
  </View>
)}
```

### 3. Validation Dashboard Component

Create `src/components/admin/ValidationDashboard.js`:

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { profilesService } from '../../services/profiles';

const ValidationDashboard = () => {
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadDashboard();
  }, []);
  
  const loadDashboard = async () => {
    try {
      const data = await profilesService.getValidationDashboard();
      setChecks(data);
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const runAutoFix = async () => {
    try {
      setLoading(true);
      await profilesService.runAutoFix();
      await loadDashboard(); // Reload
    } catch (error) {
      alert('Auto-fix failed: ' + error.message);
    }
  };
  
  if (loading) {
    return <ActivityIndicator />;
  }
  
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Validation Dashboard</Text>
      
      {checks.map((check, index) => (
        <View 
          key={index} 
          style={[
            styles.checkItem,
            { backgroundColor: check.status === 'PASS' ? '#e8f5e9' : '#ffebee' }
          ]}
        >
          <Text style={styles.checkName}>{check.check_name}</Text>
          <Text style={styles.checkStatus}>{check.status}</Text>
          {check.affected_count > 0 && (
            <Text style={styles.affectedCount}>
              {check.affected_count} affected
            </Text>
          )}
        </View>
      ))}
      
      <Pressable style={styles.autoFixButton} onPress={runAutoFix}>
        <Text style={styles.buttonText}>Run Auto-Fix</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  checkItem: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  checkName: {
    fontSize: 16,
    fontWeight: '600',
  },
  checkStatus: {
    fontSize: 14,
    marginTop: 4,
  },
  affectedCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  autoFixButton: {
    backgroundColor: '#2196f3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ValidationDashboard;
```

---

## Testing Procedures

### 1. Data Migration Tests

```javascript
// Test date conversion
console.assert(
  migrationHelpers.convertDateToJSONB("1445").hijri.year === 1445,
  "Date conversion failed"
);

// Test social media access
const testProfile = {
  social_media_links: { twitter: "https://twitter.com/test" }
};
console.assert(
  testProfile.social_media_links.twitter === "https://twitter.com/test",
  "Social media access failed"
);
```

### 2. API Function Tests

```javascript
// Test branch loading
const branchData = await profilesService.getBranchData('1.1', 2);
console.assert(branchData.length > 0, "Branch loading failed");
console.assert(branchData[0].hid !== undefined, "HID missing");

// Test safe search
const searchResults = await profilesService.searchProfiles('محمد', 10);
console.assert(searchResults.length <= 10, "Search limit failed");
```

### 3. Performance Tests

```javascript
// Measure viewport loading time
const start = Date.now();
const visibleNodes = await profilesService.getVisibleNodes({
  left: -1000,
  top: -1000,
  right: 1000,
  bottom: 1000
}, 1.0);
const loadTime = Date.now() - start;
console.log(`Viewport loaded ${visibleNodes.length} nodes in ${loadTime}ms`);
console.assert(loadTime < 1000, "Viewport loading too slow");
```

### 4. UI Regression Tests

Check these manually:
- [ ] Tree view loads and displays nodes
- [ ] Tapping a node opens ProfileSheet
- [ ] Profile data displays correctly (dates, social media)
- [ ] Admin mode activates with 5 taps
- [ ] Search returns results with Arabic text
- [ ] Zoom and pan work smoothly

---

## Error Handling Updates

### 1. Handle Validation Errors

```javascript
try {
  await profilesService.createProfile(data);
} catch (error) {
  if (error.message.includes('Circular parent')) {
    Alert.alert('خطأ', 'لا يمكن إنشاء علاقة دائرية');
  } else if (error.message.includes('Generation hierarchy')) {
    Alert.alert('خطأ', 'الجيل يجب أن يكون أكبر من جيل الوالد');
  } else if (error.message.includes('version mismatch')) {
    Alert.alert('خطأ', 'تم تحديث البيانات من مستخدم آخر. يرجى التحديث والمحاولة مرة أخرى');
  } else {
    Alert.alert('خطأ', error.message);
  }
}
```

### 2. Handle Missing Data

```javascript
// Safe access patterns
const birthYear = person?.dob_data?.hijri?.year || 
                 person?.dob_data?.gregorian?.year || 
                 'غير محدد';

const twitterUrl = person?.social_media_links?.twitter || null;

const spouseName = marriages?.[0]?.spouse_name || 'لا يوجد';
```

---

## Deployment Steps

### 1. Pre-Deployment Checklist

- [ ] All TypeScript errors resolved
- [ ] Console has no errors
- [ ] Tree loads with sample data
- [ ] Search works
- [ ] Profile sheet displays correctly
- [ ] Admin mode accessible

### 2. Environment Variables

Add to `.env`:
```bash
EXPO_PUBLIC_SUPABASE_URL=https://ezkioroyhzpavmbfavyn.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...
ADMIN_PASSCODE=2025
```

### 3. Build Commands

```bash
# Development build
expo run:ios

# Production build
eas build --platform ios --profile production

# Test on device
expo start --dev-client
```

### 4. Post-Deployment Monitoring

Monitor these metrics:
- Average load time < 2 seconds
- No crashes in first 24 hours
- Search returns results
- Layout calculations complete

---

## Quick Fixes Reference

### Common Issues

**Issue**: "Cannot read property 'twitter' of undefined"
```javascript
// Fix: Use optional chaining
profile?.social_media_links?.twitter
```

**Issue**: "spouse_count is not a function"
```javascript
// Fix: Fetch from marriages
const marriages = await getPersonMarriages(id);
const count = marriages.length;
```

**Issue**: "birth_date is undefined"
```javascript
// Fix: Use dob_data
const year = profile?.dob_data?.hijri?.year;
```

---

## Critical Files to Update

1. **src/components/TreeView.js**
   - Replace get_tree_data()
   - Add viewport loading
   - Update node rendering for new fields

2. **src/components/ProfileSheet.js**
   - Remove spouse_count/spouse_names
   - Update date display
   - Fix social media links

3. **src/services/profiles.js**
   - Add all new RPC functions
   - Remove deprecated calls

4. **src/data/family-data.js**
   - Update local test data structure

5. **App.js**
   - Add admin mode trigger
   - Add admin UI indicators

---

## Final Notes

This guide contains **EVERYTHING** needed for the frontend migration. Keep this document accessible during implementation. The backend is already set up with all these functions - you just need to update the frontend to use them correctly.

Remember: The goal is to maintain the same user experience while gaining massive performance improvements and data integrity.

Good luck! 🚀