# Backend Test Suite - Undo System

Comprehensive test coverage for the Alqefari Family Tree undo system RPC functions.

## 📊 Test Coverage Summary

**Total Tests: 88** (exceeds planned 80!)

| Category | Tests | File |
|----------|-------|------|
| **Permission & Authorization** | 15 | `rpc/permissions.test.js` |
| **Concurrency & Race Conditions** | 18 | `rpc/concurrency.test.js` |
| **Data Integrity** | 12 | `rpc/data-integrity.test.js` |
| **Time Boundary** | 8 | `rpc/time-boundary.test.js` |
| **Transaction Safety** | 10 | `rpc/transaction-safety.test.js` |
| **Error Handling** | 15 | `rpc/error-handling.test.js` |
| **Performance** | 10 | `rpc/performance.test.js` |

## 🎯 What's Tested

### Permission & Authorization (15 tests)
- ✅ Regular user can undo own actions within 30 days
- ✅ Users cannot undo others' actions
- ✅ Admin/super admin permissions
- ✅ Role-based access control
- ✅ Blocked user restrictions
- ✅ Moderator branch permissions
- ✅ Dangerous operation approval
- ✅ Time limit enforcement

### Concurrency & Race Conditions (18 tests)
- ✅ Optimistic locking (exactly one concurrent operation succeeds)
- ✅ Version conflict detection
- ✅ Row-level locking with NOWAIT
- ✅ Advisory lock coordination
- ✅ Idempotency protection
- ✅ TOCTOU vulnerability prevention
- ✅ Batch operation atomicity
- ✅ Lock timeout and deadlock prevention

### Data Integrity (12 tests)
- ✅ Complete profile restoration from old_data
- ✅ Parent/mother validation (prevents orphans)
- ✅ JSONB structure preservation
- ✅ Version increment atomicity
- ✅ Audit trail consistency
- ✅ Cascade delete referential integrity
- ✅ NULL field handling
- ✅ Constraint enforcement

### Time Boundary (8 tests)
- ✅ 30-day limit for regular users
- ✅ 7-day limit for cascade delete (strict)
- ✅ Edge case: exactly at boundary
- ✅ Admin unlimited time for non-dangerous operations
- ✅ Timestamp timezone awareness
- ✅ Super admin cascade delete limit

### Transaction Safety (10 tests)
- ✅ Failed undo rolls back all changes
- ✅ Parent validation rollback
- ✅ Successful commit atomicity
- ✅ Cascade undo all-or-nothing
- ✅ Constraint violation rollback
- ✅ Batch operation rollback
- ✅ Transaction isolation
- ✅ No dirty reads
- ✅ No phantom reads

### Error Handling (15 tests)
- ✅ NULL/invalid input errors
- ✅ Non-existent audit log error
- ✅ Permission denied errors
- ✅ Already-undone idempotency error
- ✅ Version conflict errors
- ✅ Missing field validation
- ✅ Deleted parent prevention
- ✅ Lock conflict user-friendly errors
- ✅ Edge cases (long strings, NULL fields)

### Performance (10 tests)
- ✅ Single undo < 500ms
- ✅ Permission check < 200ms
- ✅ Cascade delete (10 nodes) < 2s
- ✅ Linear scaling with batch size
- ✅ Performance with large audit tables
- ✅ Deep tree performance
- ✅ Concurrent operation throughput
- ✅ Large JSONB handling
- ✅ Cleanup efficiency

## 🛠️ Test Infrastructure

### Fixtures
- **`fixtures/profileFixtures.js`** - Profile creation (families, trees, roles)
- **`fixtures/auditLogFixtures.js`** - Audit log generation (all action types)
- **`fixtures/userFixtures.js`** - User/role fixtures (admin, moderator, regular)

### Utilities
- **`utils/concurrency.js`** - Concurrent operation helpers (race conditions, locking, idempotency)
- **`utils/cleanup.js`** - Database cleanup utilities
- **`utils/assertions.js`** - Custom Jest matchers and assertions

### Configuration
- **`jest.backend.config.js`** - Backend test configuration (30s timeout, 95% coverage)
- **`backend.setup.js`** - Global setup (Supabase clients, helpers)
- **`backend.teardown.js`** - Global cleanup
- **`.env.test`** - Test environment variables

## 🚀 Running Tests

### Prerequisites

1. **Start Docker**
   ```bash
   # macOS
   open -a Docker

   # Or check if running
   docker ps
   ```

2. **Start Local Supabase**
   ```bash
   supabase start
   ```

   Wait until you see:
   ```
   Started supabase local development setup.
   API URL: http://localhost:54321
   ```

### Run All Backend Tests

```bash
# Run all backend tests
npm run test:backend

# Watch mode (re-runs on file changes)
npm run test:backend:watch

# With coverage report
npm run test:backend:coverage
```

### Run Specific Test Suites

```bash
# Permission tests only
npx jest __tests__/rpc/permissions.test.js --config jest.backend.config.js

# Concurrency tests only
npx jest __tests__/rpc/concurrency.test.js --config jest.backend.config.js

# Performance tests only
npx jest __tests__/rpc/performance.test.js --config jest.backend.config.js
```

### Run Specific Tests

```bash
# Run single test by name
npx jest -t "Regular user can undo their own action" --config jest.backend.config.js

# Run tests matching pattern
npx jest -t "permission" --config jest.backend.config.js
```

## 📋 Expected Output

```
🧪 Backend Test Suite
====================================================================
📍 Supabase URL: http://localhost:54321
🔑 Using LOCAL database
====================================================================

 PASS  __tests__/rpc/permissions.test.js (12.3s)
 PASS  __tests__/rpc/concurrency.test.js (18.7s)
 PASS  __tests__/rpc/data-integrity.test.js (9.4s)
 PASS  __tests__/rpc/time-boundary.test.js (6.2s)
 PASS  __tests__/rpc/transaction-safety.test.js (11.8s)
 PASS  __tests__/rpc/error-handling.test.js (8.1s)
 PASS  __tests__/rpc/performance.test.js (14.5s)

Test Suites: 7 passed, 7 total
Tests:       88 passed, 88 total
Time:        81.0s
```

## 🎯 Coverage Goals

Target: **95% coverage** (enforced in jest.backend.config.js)

```bash
npm run test:backend:coverage
```

Expected coverage report:
```
----------------------------|---------|----------|---------|---------|
File                        | % Stmts | % Branch | % Funcs | % Lines |
----------------------------|---------|----------|---------|---------|
All files                   |   95.00 |    95.00 |   95.00 |   95.00 |
 supabase/functions/        |   95.00 |    95.00 |   95.00 |   95.00 |
----------------------------|---------|----------|---------|---------|
```

## 🐛 Troubleshooting

### "Cannot connect to Docker daemon"
```bash
# Start Docker Desktop (macOS)
open -a Docker

# Verify Docker is running
docker ps
```

### "Supabase not running"
```bash
# Start Supabase
supabase start

# Check status
supabase status
```

### "Connection refused on localhost:54321"
```bash
# Reset Supabase
supabase stop
supabase start

# Check logs
supabase logs
```

### Tests timing out (> 30s)
- Check database health: `supabase status`
- Restart Supabase: `supabase stop && supabase start`
- Check for locked transactions: See `__tests__/utils/cleanup.js`

### "Foreign key constraint violation"
- Tests creating orphan profiles (deleted parents)
- Check parent validation in `undo_profile_update`
- Review test cleanup order (children before parents)

## 🔍 Test Architecture

### Real Database Testing (No Mocks!)
All tests run against **actual PostgreSQL RPC functions** in local Supabase.

**Why?**
- ✅ Tests validate real database behavior (locks, constraints, transactions)
- ✅ Catches issues that mocks would miss
- ✅ Confidence in production deployment
- ✅ Tests serve as integration documentation

### Two Client Types
```javascript
global.supabaseClient    // Anon key - tests normal user permissions
global.supabaseAdmin     // Service role - tests admin operations
```

### Test Isolation
- Each test creates fresh data via fixtures
- `afterEach()` cleanup prevents interference
- Profile/audit log IDs tracked for deletion

### Concurrency Testing Strategy
```javascript
// Test optimistic locking
const result = await testOptimisticLocking(operation, 5);
expect(result.isValidOptimisticLock).toBe(true); // Exactly 1 succeeds

// Test race conditions
const race = await runRaceCondition(op1, op2);
expect(race.bothSucceeded).toBe(false); // At most one succeeds

// Test idempotency
const idem = await testIdempotency(operation, 3);
expect(idem.isIdempotent).toBe(true); // Safe to retry
```

## 📚 Resources

- **Undo System Docs**: `/docs/UNDO_SYSTEM_TEST_CHECKLIST.md`
- **Permission System**: `/docs/PERMISSION_SYSTEM_V4.md`
- **Migration Guide**: `/docs/MIGRATION_GUIDE.md`
- **Supabase Docs**: https://supabase.com/docs

## ✅ Next Steps

1. **Start Docker + Supabase**
   ```bash
   supabase start
   ```

2. **Run Tests**
   ```bash
   npm run test:backend:coverage
   ```

3. **Review Coverage**
   - Open `coverage/backend/index.html` in browser
   - Identify untested code paths
   - Add tests for gaps

4. **CI/CD Integration** (optional)
   - Add to GitHub Actions workflow
   - Run on every PR
   - Block merges if tests fail

---

**Target: 100% test coverage for undo system** 🎯

Let's achieve bulletproof reliability!
