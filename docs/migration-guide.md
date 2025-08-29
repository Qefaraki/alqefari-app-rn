# Migration Guide: v1 to v2 Schema

## Overview

This guide provides step-by-step instructions for migrating from the original schema (v1) to the refined normalized schema (v2). The migration removes redundant fields and enforces single source of truth principles.

## Key Changes

### 1. Removed Fields
- ❌ `spouse_count` - Use marriages table instead
- ❌ `spouse_names` - Use marriages table instead  
- ❌ `twitter`, `instagram`, `linkedin`, `website` - Consolidated into `social_media_links`
- ❌ `birth_date`, `death_date` - Use `dob_data`, `dod_data` JSONB instead

### 2. Modified Fields
- ✅ `hid` - Now required (NOT NULL)
- ✅ Added validation constraints on many fields
- ✅ Added `profile_visibility` for privacy control
- ✅ Added `created_by`, `updated_by` for audit trail

### 3. New Features
- ✅ Comprehensive JSONB validation functions
- ✅ Asynchronous layout calculations
- ✅ Safe frontend access functions
- ✅ Validation dashboard

---

## Pre-Migration Checklist

1. **Backup Current Data**
   ```sql
   -- Create backup table
   CREATE TABLE profiles_backup_v1 AS SELECT * FROM profiles;
   CREATE TABLE marriages_backup_v1 AS SELECT * FROM marriages;
   ```

2. **Audit Current Data**
   ```sql
   -- Check for profiles without HID
   SELECT COUNT(*) FROM profiles WHERE hid IS NULL;
   
   -- Check for duplicate social media data
   SELECT COUNT(*) FROM profiles 
   WHERE twitter IS NOT NULL 
   OR instagram IS NOT NULL;
   ```

3. **Test Migration Scripts**
   - Run on development environment first
   - Verify data integrity after migration

---

## Migration Steps

### Step 1: Create New Tables

First, rename existing tables:
```sql
ALTER TABLE profiles RENAME TO profiles_old;
ALTER TABLE marriages RENAME TO marriages_old;
```

Then run the new migration files:
```bash
supabase db push --file supabase/migrations/001_create_profiles_table_v2.sql
supabase db push --file supabase/migrations/002_create_validation_functions.sql
```

### Step 2: Migrate Profile Data

```sql
-- Migrate profiles with data transformation
INSERT INTO profiles (
    id, hid, father_id, mother_id, generation, sibling_order,
    name, kunya, nickname, gender, status,
    dob_data, dod_data, bio, birth_place, current_residence,
    occupation, education, phone, email, photo_url,
    social_media_links, achievements, timeline,
    dob_is_public, version, deleted_at, created_at, updated_at
)
SELECT 
    id,
    COALESCE(hid, 'TEMP_' || id), -- Temporary HID for NULL values
    father_id,
    mother_id,
    generation,
    sibling_order,
    name,
    kunya,
    nickname,
    gender,
    status,
    -- Convert text dates to JSONB
    CASE 
        WHEN birth_date IS NOT NULL THEN 
            jsonb_build_object('display', birth_date)
        ELSE dob_data
    END as dob_data,
    CASE 
        WHEN death_date IS NOT NULL THEN 
            jsonb_build_object('display', death_date)
        ELSE dod_data
    END as dod_data,
    bio,
    birth_place,
    current_residence,
    occupation,
    education,
    phone,
    email,
    photo_url,
    -- Consolidate social media links
    jsonb_strip_nulls(
        COALESCE(social_media_links, '{}'::jsonb) || 
        jsonb_build_object(
            'twitter', twitter,
            'instagram', instagram,
            'linkedin', linkedin,
            'website', website
        )
    ) as social_media_links,
    achievements,
    timeline,
    dob_is_public,
    version,
    deleted_at,
    created_at,
    updated_at
FROM profiles_old;
```

### Step 3: Fix Missing HIDs

```sql
-- Generate proper HIDs for temporary ones
WITH RECURSIVE hid_fix AS (
    -- Fix root nodes
    UPDATE profiles 
    SET hid = 'R' || ROW_NUMBER() OVER (ORDER BY created_at)
    WHERE hid LIKE 'TEMP_%' AND father_id IS NULL
    RETURNING id, hid
),
child_fix AS (
    -- Fix child nodes recursively
    UPDATE profiles p
    SET hid = parent.hid || '.' || (
        ROW_NUMBER() OVER (
            PARTITION BY p.father_id 
            ORDER BY p.sibling_order, p.created_at
        )
    )
    FROM profiles parent
    WHERE p.father_id = parent.id 
    AND p.hid LIKE 'TEMP_%'
    AND parent.hid NOT LIKE 'TEMP_%'
    RETURNING p.id, p.hid
)
SELECT COUNT(*) as fixed_count FROM (
    SELECT * FROM hid_fix
    UNION ALL
    SELECT * FROM child_fix
) fixes;
```

### Step 4: Migrate Marriage Data

```sql
-- Marriages table structure remains the same
INSERT INTO marriages SELECT * FROM marriages_old;
```

### Step 5: Calculate Missing Spouse Data

For applications that need spouse information:
```sql
-- Create a view for spouse data
CREATE OR REPLACE VIEW profile_spouse_info AS
SELECT 
    p.id,
    p.name,
    COUNT(DISTINCT m.id) as spouse_count,
    array_agg(DISTINCT spouse.name) as spouse_names
FROM profiles p
LEFT JOIN marriages m ON (m.husband_id = p.id OR m.wife_id = p.id)
LEFT JOIN profiles spouse ON 
    CASE 
        WHEN m.husband_id = p.id THEN m.wife_id = spouse.id
        WHEN m.wife_id = p.id THEN m.husband_id = spouse.id
    END
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name;
```

### Step 6: Validate Migration

Run the validation dashboard:
```sql
SELECT * FROM admin_validation_dashboard();
```

Expected results:
- ✅ No orphaned nodes
- ✅ Generation consistency maintained
- ✅ No duplicate HIDs
- ✅ Valid date formats

### Step 7: Update Application Code

1. **Update TypeScript Types**
   ```typescript
   // Remove old fields from interfaces
   // Use new DateData and SocialMediaLinks types
   ```

2. **Update API Calls**
   ```javascript
   // Old way (don't use)
   const spouseCount = profile.spouse_count;
   
   // New way
   const { data: marriages } = await supabase
     .rpc('get_person_marriages', { p_id: profile.id });
   const spouseCount = marriages.length;
   ```

3. **Update Social Media Access**
   ```javascript
   // Old way (don't use)
   const twitter = profile.twitter;
   
   // New way
   const twitter = profile.social_media_links.twitter;
   ```

---

## Rollback Procedure

If migration fails:

1. **Restore Original Tables**
   ```sql
   DROP TABLE IF EXISTS profiles CASCADE;
   DROP TABLE IF EXISTS marriages CASCADE;
   
   ALTER TABLE profiles_old RENAME TO profiles;
   ALTER TABLE marriages_old RENAME TO marriages;
   ```

2. **Restore Indexes and Constraints**
   ```sql
   -- Re-run original migration files
   ```

---

## Post-Migration Tasks

1. **Queue Layout Recalculation**
   ```sql
   INSERT INTO layout_recalc_queue (node_id, queued_at, status)
   SELECT id, NOW(), 'pending'
   FROM profiles
   WHERE layout_position IS NULL;
   ```

2. **Update Search Vectors**
   ```sql
   UPDATE profiles SET search_vector = NULL;
   -- Trigger will repopulate on next update
   ```

3. **Clean Up**
   ```sql
   -- After verifying success (keep for at least 30 days)
   DROP TABLE profiles_old;
   DROP TABLE marriages_old;
   ```

---

## Common Issues and Solutions

### Issue: "Check constraint violation"
**Solution**: Some data doesn't meet new validation rules
```sql
-- Find invalid emails
SELECT id, email FROM profiles 
WHERE email IS NOT NULL 
AND email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';

-- Fix or null out invalid data
UPDATE profiles SET email = NULL WHERE id = 'invalid-email-id';
```

### Issue: "Duplicate key value violates unique constraint"
**Solution**: Duplicate HIDs exist
```sql
-- Find duplicates
SELECT hid, COUNT(*), array_agg(id) as ids
FROM profiles
GROUP BY hid
HAVING COUNT(*) > 1;

-- Regenerate HIDs for duplicates
-- Use the fix script from Step 3
```

### Issue: "Foreign key constraint violation"
**Solution**: References to non-existent profiles
```sql
-- Find orphaned references
SELECT * FROM profiles 
WHERE father_id IS NOT NULL 
AND father_id NOT IN (SELECT id FROM profiles);

-- Fix by nulling invalid references
UPDATE profiles 
SET father_id = NULL 
WHERE father_id NOT IN (SELECT id FROM profiles);
```

---

## Performance Considerations

1. **Migration Time**: Expect ~1-5 minutes per 10,000 profiles
2. **Index Rebuild**: Happens automatically, may take additional time
3. **Layout Recalculation**: Process asynchronously after migration

---

## Support

If you encounter issues during migration:

1. Check error logs in Supabase dashboard
2. Run validation dashboard to identify issues
3. Use rollback procedure if needed
4. Contact support with specific error messages

Remember: Always test on development environment first!