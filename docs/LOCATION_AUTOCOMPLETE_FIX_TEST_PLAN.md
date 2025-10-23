# Location Autocomplete Fix - Test Plan

**Migration**: `20251023150364_restore_correct_search_place_autocomplete.sql`
**Date**: October 23, 2025
**Status**: Ready for deployment

## Pre-Deployment Checklist

- [ ] Migration file saved to `supabase/migrations/`
- [ ] Rollback migration created (`20251023150365_rollback_search_place_autocomplete.sql`)
- [ ] All validation issues addressed (see Validation Report)
- [ ] Database backup completed (Supabase auto-backup verified)
- [ ] Team notified of maintenance window

---

## Test Scenarios

### 1. Basic Functionality Tests

#### Test 1.1: Arabic City Search
```sql
-- Expected: Returns Riyadh with Saudi Arabia as parent
SELECT * FROM search_place_autocomplete('رياض', 8);
```

**Expected Result**:
```json
{
  "id": 1,
  "display_name": "الرياض",
  "display_name_en": "Riyadh",
  "place_type": "city",
  "country_name": "السعودية",
  "region": "saudi",
  "normalized_data": {
    "original": "الرياض",
    "city": {"ar": "الرياض", "en": "Riyadh", "id": 1},
    "country": {"ar": "السعودية", "en": "Saudi Arabia", "code": "SA", "id": 999},
    "confidence": 1.0
  }
}
```

**Validation Points**:
- ✅ No error 42703 (column ps.country does not exist)
- ✅ No error 42804 (type mismatch)
- ✅ `country_name` populated correctly
- ✅ `normalized_data.country.code` is 'SA'
- ✅ `confidence` is 1.0 (exact match)

---

#### Test 1.2: Arabic Country Search
```sql
-- Expected: Returns Saudi Arabia as country
SELECT * FROM search_place_autocomplete('سعود', 8);
```

**Expected Result**:
```json
{
  "id": 999,
  "display_name": "السعودية",
  "display_name_en": "Saudi Arabia",
  "place_type": "country",
  "country_name": null,
  "region": "saudi",
  "normalized_data": {
    "original": "السعودية",
    "country": {"ar": "السعودية", "en": "Saudi Arabia", "code": "SA", "id": 999},
    "confidence": 1.0
  }
}
```

**Validation Points**:
- ✅ `country_name` is NULL (expected for countries)
- ✅ `normalized_data` has only `country` object (no `city`)

---

#### Test 1.3: Prefix Match (Not Exact)
```sql
-- Expected: Returns multiple matches, sorted by length
SELECT * FROM search_place_autocomplete('جد', 8);
```

**Expected Behavior**:
- Returns: جدة (Jeddah), جدة الصناعية, etc.
- Confidence scores: 0.8 (prefix match, not exact)
- Sorted by: `display_order` → match quality → length

---

### 2. Edge Case Tests

#### Test 2.1: Empty Query Guard
```sql
SELECT * FROM search_place_autocomplete('', 8);
```

**Expected**: Empty result set (no error)

---

#### Test 2.2: NULL Query Guard
```sql
SELECT * FROM search_place_autocomplete(NULL, 8);
```

**Expected**: Empty result set (no error)

---

#### Test 2.3: Whitespace-Only Query
```sql
SELECT * FROM search_place_autocomplete('   ', 8);
```

**Expected**: Empty result set (TRIM removes whitespace)

---

#### Test 2.4: Special Characters Query
```sql
SELECT * FROM search_place_autocomplete('!!!@@@###', 8);
```

**Expected**: Empty result set (normalization returns empty string)

---

#### Test 2.5: Alternate Names Search
```sql
-- Assuming 'الرياض' has alternate name 'الرياضة' in alternate_names[]
SELECT * FROM search_place_autocomplete('رياضة', 8);
```

**Expected**:
- Returns الرياض
- Confidence: 0.5 (alternate name match)

---

#### Test 2.6: Invalid Limit Values
```sql
-- Test negative limit
SELECT * FROM search_place_autocomplete('رياض', -1);

-- Test excessive limit
SELECT * FROM search_place_autocomplete('رياض', 999);

-- Test zero limit
SELECT * FROM search_place_autocomplete('رياض', 0);
```

**Expected**: All clamped to default (8) or safe range [1, 100]

---

### 3. Performance Tests

#### Test 3.1: Index Usage Verification
```sql
EXPLAIN ANALYZE
SELECT * FROM search_place_autocomplete('رياض', 8);
```

**Expected in Query Plan**:
- ✅ Index Scan using `idx_place_standards_normalized_name`
- ✅ No Sequential Scan on `place_standards`
- ✅ Execution time < 50ms

---

#### Test 3.2: Large Result Set Performance
```sql
-- Query returning many results
SELECT * FROM search_place_autocomplete('م', 100);
```

**Expected**:
- Execution time < 100ms
- LIMIT enforced at 100

---

#### Test 3.3: Concurrent Query Load
```bash
# Run 10 parallel queries
for i in {1..10}; do
  psql -c "SELECT * FROM search_place_autocomplete('رياض', 8);" &
done
wait
```

**Expected**:
- No lock conflicts
- All queries complete successfully
- PARALLEL SAFE attribute respected

---

### 4. Data Integrity Tests

#### Test 4.1: Orphaned City Detection
```sql
-- Check migration warnings during deployment
-- Should log any cities with NULL or invalid parent_id
```

**Expected Migration Output**:
```
NOTICE:  Data integrity check passed: All cities have valid parent references.
```

OR if issues exist:
```
WARNING:  Found 2 cities without parent_id. These will show NULL country_name.
```

---

#### Test 4.2: City with NULL Parent Handling
```sql
-- If orphaned cities exist, verify graceful handling
SELECT * FROM search_place_autocomplete('[orphaned city name]', 8);
```

**Expected**:
- Query succeeds (no error)
- `country_name` is NULL
- `normalized_data.country.code` is 'XX' (fallback)

---

### 5. Frontend Integration Tests

#### Test 5.1: LocationInput Component
```javascript
// In LocationInput.js
const { data, error } = await supabase.rpc('search_place_autocomplete', {
  p_query: 'رياض',
  p_limit: 8,
});

console.log('Error:', error);  // Should be null
console.log('Data:', data);    // Should match schema
```

**Validation Points**:
- ✅ No error in response
- ✅ `data[0].id` is a number
- ✅ `data[0].display_name` exists
- ✅ `data[0].normalized_data` is an object
- ✅ `data[0].normalized_data.confidence` exists

---

#### Test 5.2: Dropdown Rendering
```javascript
// Test that LocationInput renders results correctly
// User types "رياض"
// Expected: Dropdown shows "الرياض، السعودية"
```

**Visual Validation**:
- ✅ City name displayed in Arabic
- ✅ Country name displayed below/beside
- ✅ Confidence score affects visual ranking (if implemented)

---

### 6. Rollback Testing

#### Test 6.1: Rollback Migration Dry Run
```sql
-- Test rollback WITHOUT applying
BEGIN;
  \i supabase/migrations/20251023150365_rollback_search_place_autocomplete.sql
ROLLBACK;
```

**Expected**:
- No errors during execution
- Backup retrieval succeeds
- Function would be restored (but transaction rolled back)

---

#### Test 6.2: Full Rollback Cycle
```sql
-- 1. Apply fix migration
\i supabase/migrations/20251023150364_restore_correct_search_place_autocomplete.sql

-- 2. Verify fix works
SELECT * FROM search_place_autocomplete('رياض', 8);

-- 3. Apply rollback migration
\i supabase/migrations/20251023150365_rollback_search_place_autocomplete.sql

-- 4. Verify rollback restored backup
SELECT * FROM search_place_autocomplete('رياض', 8);
-- (Should return error 42703 if rollback succeeded)
```

---

## Post-Deployment Monitoring

### Week 1: Critical Metrics

| Metric | Target | Monitoring Method |
|--------|--------|-------------------|
| Error Rate (42703/42804) | 0% | Supabase logs, Sentry |
| Query Response Time | <50ms p95 | Supabase Performance tab |
| Frontend Autocomplete Success Rate | >98% | User analytics |
| User Complaints | 0 | Support tickets |

---

### Week 2-4: Performance Validation

- Monitor query performance as dataset grows
- Validate index usage remains optimal
- Check for slow query logs (>100ms)
- Verify PARALLEL SAFE optimization active

---

## Known Limitations (Documented)

1. **JSONB ID Type**: IDs stored as JSONB numeric (safe for <2^53, no risk at genealogy scale)
2. **Confidence Hardcoded**: All matches show confidence scores, but formula may need tuning
3. **No Fuzzy Matching**: Exact/prefix only, no Levenshtein distance
4. **100 Result Limit**: Hard-coded safety limit (acceptable for autocomplete UX)

---

## Success Criteria

**Deployment is successful if:**
- ✅ Migration applies without errors
- ✅ All 6 validation tests pass (built into migration)
- ✅ Error 42703 eliminated (column ps.country does not exist)
- ✅ Error 42804 eliminated (type mismatch)
- ✅ Frontend LocationInput.js renders results correctly
- ✅ Query performance <50ms for typical searches
- ✅ No user complaints within 48 hours

**Deployment requires rollback if:**
- ❌ Migration fails to apply
- ❌ Any validation test fails
- ❌ Frontend shows errors or blank results
- ❌ Query performance >200ms
- ❌ User complaints increase

---

## Deployment Timeline

| Phase | Duration | Action |
|-------|----------|--------|
| **Pre-Deployment** | 30 min | Review migration, backup verification |
| **Deployment** | 5 min | Apply migration via MCP |
| **Validation** | 15 min | Run all 6 test scenarios |
| **Monitoring** | 2 hours | Watch logs, test frontend |
| **Rollback Window** | 24 hours | Ready to revert if issues |

---

## Emergency Contacts

- **Migration Author**: System (automated fix)
- **Database Admin**: [Your team lead]
- **Frontend Owner**: LocationInput.js maintainer
- **On-Call**: [Rotation schedule]

---

## Rollback Procedure

If critical issues detected:

```bash
# 1. Notify team
echo "🚨 Rolling back location autocomplete fix"

# 2. Apply rollback migration
npm run db:migrate -- 20251023150365_rollback_search_place_autocomplete.sql

# 3. Verify rollback
psql -c "SELECT * FROM search_place_autocomplete('رياض', 8);"

# 4. Investigate root cause
# 5. Prepare revised fix
```

---

_Last Updated: October 23, 2025_
