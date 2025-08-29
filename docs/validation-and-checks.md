# Data Validation and Integrity Checks

## Overview

This document outlines all validation rules, integrity checks, and error recovery procedures implemented in the Alqefari Family Tree backend. The system enforces data integrity at multiple levels to ensure consistency and reliability.

## Table of Contents

1. [Schema-Level Validations](#schema-level-validations)
2. [JSONB Structure Validations](#jsonb-structure-validations)
3. [Relationship Validations](#relationship-validations)
4. [Admin Dashboard Checks](#admin-dashboard-checks)
5. [Error Codes and Recovery](#error-codes-and-recovery)
6. [Best Practices](#best-practices)

---

## Schema-Level Validations

### 1. Core Field Constraints

```sql
-- Name validation
name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) > 0)
-- Ensures names cannot be empty or just whitespace

-- Gender validation
gender TEXT NOT NULL CHECK (gender IN ('male', 'female'))
-- Enforces binary gender selection

-- Generation validation
generation INT NOT NULL CHECK (generation > 0)
-- Ensures positive generation numbers

-- Email validation
email TEXT CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
-- Validates email format if provided
```

### 2. HID Format Validation

```sql
-- HID must follow hierarchical pattern
CHECK (hid ~ '^[R]?\d+(\.\d+)*$')
```

Valid HIDs:
- `1` - Root level
- `1.1` - First child of node 1
- `1.1.3` - Third child of node 1.1
- `R1` - Alternative root notation

Invalid HIDs:
- `1..1` - Double dots
- `1.a` - Non-numeric
- `.1` - Leading dot

---

## JSONB Structure Validations

### 1. Date Data Validation

The `validate_date_jsonb()` function ensures proper date structure:

```json
{
  "hijri": {
    "year": 1445,      // Required: 1-2000
    "month": 7,        // Required: 1-12
    "day": 15         // Required: 1-30
  },
  "gregorian": {
    "year": 2024,      // Required: 1800-2200
    "month": 1,        // Optional if approximate
    "day": 20,         // Optional if approximate
    "approximate": true,
    "circa": "early 2024"
  },
  "display": "1445/7/15 هـ (~2024م)"  // Optional custom display
}
```

**Validation Rules:**
- At least one date system (hijri or gregorian) must be present
- Years must be within reasonable ranges
- Months and days must be valid
- Approximate dates don't require month/day

### 2. Social Media Links Validation

The `validate_social_media_jsonb()` function ensures:

```json
{
  "twitter": "https://twitter.com/username",
  "linkedin": "https://linkedin.com/in/username",
  "instagram": "https://instagram.com/username"
}
```

**Validation Rules:**
- Must be a JSON object
- Keys must be recognized platforms
- Values must be valid URLs with https://

**Supported Platforms:**
- twitter/x
- instagram
- linkedin
- facebook
- youtube
- tiktok
- snapchat
- website
- blog
- github

### 3. Timeline Validation

The `validate_timeline_jsonb()` function ensures:

```json
[
  {
    "year": "1445",
    "event": "تخرج من الجامعة"
  },
  {
    "year": "1446",
    "event": "تم التعيين في الوظيفة"
  }
]
```

**Validation Rules:**
- Must be an array
- Each entry must have `year` and `event`
- Event text cannot be empty

---

## Relationship Validations

### 1. Circular Relationship Prevention

The `check_no_circular_parents()` function prevents:
- A person being their own parent
- Circular chains (A → B → C → A)

```sql
-- Example check during insert/update
IF NOT check_no_circular_parents(NEW.id, NEW.father_id) THEN
    RAISE EXCEPTION 'Circular parent relationship detected';
END IF;
```

### 2. Generation Hierarchy Validation

The `validate_generation_hierarchy()` function ensures:
- Parents must be from earlier generations
- Children must be from later generations

```sql
-- Validation rules:
-- father.generation < person.generation
-- mother.generation < person.generation
-- person.generation < all_children.generation
```

### 3. Parent Existence Validation

Enforced by foreign key constraints:
```sql
father_id UUID REFERENCES profiles(id) ON DELETE SET NULL
mother_id UUID REFERENCES profiles(id) ON DELETE SET NULL
```

---

## Admin Dashboard Checks

The `admin_validation_dashboard()` function performs comprehensive health checks:

### 1. Orphaned Nodes Check
- **What it checks**: Profiles with non-existent parent references
- **Severity**: Error
- **Auto-fix**: Not available (requires manual intervention)

### 2. Generation Consistency Check
- **What it checks**: Children with generation ≤ parent generation
- **Severity**: Error
- **Auto-fix**: Update generation numbers maintaining hierarchy

### 3. Duplicate HIDs Check
- **What it checks**: Multiple profiles sharing the same HID
- **Severity**: Critical
- **Auto-fix**: Regenerate HIDs using `admin_auto_fix_issues()`

### 4. Missing Layout Positions
- **What it checks**: Profiles without calculated layout positions
- **Severity**: Warning
- **Auto-fix**: Queue for recalculation

### 5. Invalid Date Formats
- **What it checks**: Malformed date JSONB structures
- **Severity**: Warning
- **Auto-fix**: Manual correction required

### 6. Circular Relationships
- **What it checks**: Circular parent-child chains
- **Severity**: Critical
- **Auto-fix**: Break circular chain manually

### 7. Overall Health Summary
- **What it provides**: Statistics on data completeness
- **Includes**: Total profiles, photos, bios, dates, last update

---

## Error Codes and Recovery

### Common Error Messages

1. **"Validation failed: Check constraint violation"**
   - Cause: Data doesn't meet schema constraints
   - Recovery: Check specific constraint in error details

2. **"Circular parent relationship detected"**
   - Cause: Attempting to create circular reference
   - Recovery: Choose different parent

3. **"Generation hierarchy violation"**
   - Cause: Parent/child generation inconsistency
   - Recovery: Adjust generation numbers

4. **"Profile not found or version mismatch"**
   - Cause: Optimistic locking conflict
   - Recovery: Refresh data and retry

5. **"Insufficient permissions"**
   - Cause: User lacks required role
   - Recovery: Contact admin for role assignment

### Recovery Procedures

#### 1. Fixing Orphaned Nodes
```sql
-- Find orphaned nodes
SELECT * FROM profiles 
WHERE father_id IS NOT NULL 
AND NOT EXISTS (
    SELECT 1 FROM profiles p2 
    WHERE p2.id = father_id
);

-- Fix by setting father_id to NULL or correct parent
UPDATE profiles 
SET father_id = NULL 
WHERE id = 'orphaned-node-id';
```

#### 2. Fixing Generation Issues
```sql
-- Recalculate generations from root
WITH RECURSIVE generation_calc AS (
    SELECT id, 1 as correct_gen
    FROM profiles WHERE father_id IS NULL
    
    UNION ALL
    
    SELECT p.id, gc.correct_gen + 1
    FROM profiles p
    JOIN generation_calc gc ON p.father_id = gc.id
)
UPDATE profiles p
SET generation = gc.correct_gen
FROM generation_calc gc
WHERE p.id = gc.id;
```

#### 3. Running Auto-Fix
```sql
-- Run comprehensive auto-fix (Super Admin only)
SELECT * FROM admin_auto_fix_issues();
```

---

## Best Practices

### 1. Data Entry Guidelines

- **Always validate dates** before saving using `validate_date_jsonb()`
- **Check relationships** before creating using validation functions
- **Use transactions** for multi-step operations
- **Monitor validation dashboard** regularly

### 2. Performance Considerations

- **Validation functions are IMMUTABLE**: Results are cached
- **Use bulk operations** for multiple updates
- **Queue layout recalculations** asynchronously
- **Index frequently queried fields**

### 3. Error Handling in Frontend

```javascript
try {
  const result = await supabase.rpc('admin_create_profile', data);
} catch (error) {
  if (error.message.includes('Circular parent')) {
    // Handle circular relationship error
  } else if (error.message.includes('Generation hierarchy')) {
    // Handle generation error
  } else if (error.message.includes('version mismatch')) {
    // Handle optimistic locking conflict
  }
}
```

### 4. Regular Maintenance

1. **Daily**: Check validation dashboard
2. **Weekly**: Run auto-fix for minor issues
3. **Monthly**: Review performance metrics
4. **Quarterly**: Audit data integrity comprehensively

---

## Validation Function Reference

### Date Validation
```sql
SELECT validate_date_jsonb('{"hijri": {"year": 1445}}'); -- false (missing month/day)
SELECT validate_date_jsonb('{"gregorian": {"year": 2024, "approximate": true}}'); -- true
```

### Social Media Validation
```sql
SELECT validate_social_media_jsonb('{"twitter": "https://twitter.com/user"}'); -- true
SELECT validate_social_media_jsonb('{"invalid": "not-a-url"}'); -- false
```

### Relationship Validation
```sql
SELECT check_no_circular_parents('child-id', 'proposed-parent-id'); -- true/false
SELECT validate_generation_hierarchy('person-id', 5, 'father-id', 'mother-id'); -- true/false
```

---

## Monitoring and Alerts

### Performance Metrics Table
```sql
-- View slowest operations
SELECT function_name, 
       AVG(execution_time_ms) as avg_time,
       MAX(execution_time_ms) as max_time,
       COUNT(*) as call_count
FROM performance_metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY function_name
ORDER BY avg_time DESC;
```

### Queue Status Monitoring
```sql
-- Check pending layout recalculations
SELECT status, COUNT(*) 
FROM layout_recalc_queue 
GROUP BY status;
```

---

## Troubleshooting

### Common Issues and Solutions

1. **"Cannot delete profile with children"**
   - Solution: Use cascade option or delete children first
   - Command: `admin_delete_profile(id, cascade => true)`

2. **"HID already exists"**
   - Solution: Regenerate HIDs using auto-fix
   - Check: Duplicate entries in database

3. **"Layout position missing"**
   - Solution: Queue for recalculation
   - Monitor: Check queue status

4. **"Date validation failed"**
   - Solution: Check JSONB structure
   - Format: Use provided examples

---

This comprehensive validation system ensures data integrity while providing clear error messages and recovery paths for administrators.