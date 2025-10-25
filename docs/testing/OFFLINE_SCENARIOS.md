# Offline Handling Test Checklist

**Status**: ✅ Implemented (October 2025)
**System**: Multi-layer offline protection with debouncing, network guards, and version locking
**Test Environment**: Physical iOS device with airplane mode toggle capability

## Test Scenarios

### Profile Editing (ProfileViewer)
- [ ] **Test 1.1**: Enable airplane mode → Edit profile field → Hit save → Verify offline alert shown immediately
  - **Expected**: "يرجى الانتظار" alert with message about being offline
  - **Duration**: <500ms from save press to alert
  - **Success**: User can tap "حسناً" and try again when online

- [ ] **Test 1.2**: Rapid save attempts (3x in 500ms) → Verify debounce alert on attempts 2-3
  - **Expected**: First save succeeds (debounce timer starts), attempts 2-3 show "يرجى الانتظار" message
  - **Duration**: Each debounce alert appears <100ms after tap
  - **Success**: Prevents server-side duplicate saves

- [ ] **Test 1.3**: Make edit, start save, toggle airplane mode mid-save → Verify proper error handling
  - **Expected**: If network fails mid-save, error alert shown, debounce timer resets, user can retry immediately
  - **Duration**: <1 second from error to retry opportunity
  - **Success**: User not stuck waiting 500ms on network failure

- [ ] **Test 1.4**: Make multiple edits, toggle online/offline several times → Verify no data loss
  - **Expected**: All edits persist locally, save attempts queued appropriately
  - **Duration**: Full cycle ~2 minutes
  - **Success**: No "lost edits" or blank fields after reconnection

### Profile Creation (QuickAddOverlay & MultiAddChildrenModal)
- [ ] **Test 2.1**: Enable airplane mode → Try to add new profile → Verify blocked
  - **Expected**: Network guard alert "يرجى التأكد من الاتصال بالإنترنت" (Arabic message)
  - **Duration**: <300ms from create button to alert
  - **Success**: No server error, clean user experience

- [ ] **Test 2.2**: Add multiple children (3+) while offline → Try to save all → Verify batch blocked
  - **Expected**: Single alert about offline status, all children remain unsaved in form
  - **Duration**: <300ms from save button to alert
  - **Success**: No partial batch creation, data consistency maintained

- [ ] **Test 2.3**: Create profile, connection drops mid-creation, user retries → Verify version conflict handled
  - **Expected**: First attempt fails with version conflict or network error, user can retry with fresh data
  - **Duration**: ~3 seconds for error + retry
  - **Success**: No duplicate profiles created, system maintains data integrity

### Admin Operations (Suggestions, Permissions, Munasib)
- [ ] **Test 3.1**: SuggestionReviewManager - Offline → Approve suggestion → Verify blocked
  - **Expected**: "يرجى التأكد من الاتصال بالإنترنت" alert
  - **Duration**: <300ms from approve button to alert
  - **Success**: No orphaned suggestion states in database

- [ ] **Test 3.2**: PermissionManager - Offline → Change user role → Verify blocked
  - **Expected**: Network guard alert before role change mutation
  - **Duration**: <300ms from role change to alert
  - **Success**: No invalid role states persisted

- [ ] **Test 3.3**: MunasibManager - Offline → Try operations → Verify all protected
  - **Expected**: All mutation attempts blocked with network guard
  - **Duration**: <300ms per operation
  - **Success**: Munasib data integrity maintained

### Flaky Network (Critical Production Scenario)
- [ ] **Test 4.1**: Toggle airplane mode during multi-second save operation → Verify graceful degradation
  - **Expected**: Network error caught, user notified, debounce resets for retry
  - **Duration**: <2 seconds from error to recovery
  - **Success**: No console errors, proper error message shown

- [ ] **Test 4.2**: Intermittent packet loss (use Charles Proxy or Network Link Conditioner) → Multiple save attempts
  - **Expected**: Occasional timeouts, proper retry mechanism, no infinite loops
  - **Duration**: 2-3 attempts succeed despite network issues
  - **Success**: System remains stable under flaky conditions

### Version Conflict Detection (Concurrent Edits)
- [ ] **Test 5.1**: Two users edit same profile simultaneously → Second user's save fails with version conflict
  - **Expected**: Second user sees error about profile being updated elsewhere
  - **Duration**: Immediate (within 100ms of second save)
  - **Success**: Prevents silent overwrites of concurrent edits

- [ ] **Test 5.2**: Verify database version field increments on each successful save
  - **Expected**: profile.version increases from N to N+1 after each edit
  - **Duration**: Synchronous database operation
  - **Success**: Version locking system functional

### Metrics Logging Verification
- [ ] **Test 6.1**: Enable debug mode, perform offline saves → Check console for metrics logs
  - **Expected**: Console shows `[OFFLINE_ATTEMPT]`, `[DEBOUNCE]`, `[VERSION_CONFLICT]` messages
  - **Duration**: Logs appear immediately with ISO timestamps
  - **Success**: Logging system capturing all events

- [ ] **Test 6.2**: Verify metrics logs follow standard format: `[METRIC_TYPE] component.action details`
  - **Expected**: `[OFFLINE_ATTEMPT] ProfileViewer.saveProfile blocked - user offline`
  - **Duration**: N/A (format check)
  - **Success**: Consistent logging enables monitoring integration

---

## Success Metrics

### Performance Benchmarks (Target Values)
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Offline detection → alert | <500ms | TBD | Pending test |
| Debounce alert display | <100ms | TBD | Pending test |
| Network guard check | <300ms | TBD | Pending test |
| Version conflict detection | <100ms | TBD | Pending test |
| Error recovery (retry ready) | <1000ms | TBD | Pending test |

### Production Metrics (Target Goals)
| Metric | Target | Monitoring Method |
|--------|--------|-------------------|
| Network errors in production logs | <1% of saves | Sentry error tracking (TODO: integrate) |
| User-reported lost edits | <0.1% of active users | Support ticket tracking |
| Debounce triggers | <5% of save attempts | Analytics logging via offlineMetrics |
| Offline guard triggers | <2% of save attempts | Analytics logging via offlineMetrics |
| Version conflicts | <0.5% of simultaneous edits | Database audit logs |
| Retry success rate (after failure) | >95% | User session analytics |

---

## Test Execution Protocol

### Pre-Test Checklist
- [ ] Physical iOS device (not simulator - airplane mode behavior differs)
- [ ] App rebuilt with latest code
- [ ] Network monitor (Console.app or Charles Proxy) ready to capture logs
- [ ] Test account with multiple profiles created
- [ ] Test admin account for admin operation tests
- [ ] Battery >50% (offline testing can use significant power)

### During Each Test
1. Execute test step-by-step
2. Note exact timing and any unexpected behavior
3. Check console for error messages or warnings
4. Verify UI state after operation completes
5. Reconnect and verify data persistence if applicable

### After All Tests
- [ ] Document results in test summary below
- [ ] File bug reports for any failures
- [ ] Update monitoring dashboard with actual metrics
- [ ] Schedule regression testing for each release

---

## Test Results Log

### Test Session 1
**Date**: [TBD]
**Tester**: [TBD]
**Device**: [iPhone model, iOS version]
**App Version**: [Build number]

#### Profile Editing Tests
- [ ] Test 1.1: `PASS / FAIL` - Notes:
- [ ] Test 1.2: `PASS / FAIL` - Notes:
- [ ] Test 1.3: `PASS / FAIL` - Notes:
- [ ] Test 1.4: `PASS / FAIL` - Notes:

#### Profile Creation Tests
- [ ] Test 2.1: `PASS / FAIL` - Notes:
- [ ] Test 2.2: `PASS / FAIL` - Notes:
- [ ] Test 2.3: `PASS / FAIL` - Notes:

#### Admin Operation Tests
- [ ] Test 3.1: `PASS / FAIL` - Notes:
- [ ] Test 3.2: `PASS / FAIL` - Notes:
- [ ] Test 3.3: `PASS / FAIL` - Notes:

#### Flaky Network Tests
- [ ] Test 4.1: `PASS / FAIL` - Notes:
- [ ] Test 4.2: `PASS / FAIL` - Notes:

#### Version Conflict Tests
- [ ] Test 5.1: `PASS / FAIL` - Notes:
- [ ] Test 5.2: `PASS / FAIL` - Notes:

#### Metrics Logging Tests
- [ ] Test 6.1: `PASS / FAIL` - Notes:
- [ ] Test 6.2: `PASS / FAIL` - Notes:

**Overall Result**: [PASS / FAIL with summary]

---

## Monitoring Integration (Production)

Once deployed, monitor these signals in production:

### Error Tracking (Sentry)
```javascript
// Example: In offlineMetrics.js, replace TODO comments with:
import * as Sentry from "sentry-react-native";

export function logOfflineError(screen, action, error) {
  if (__DEV__) {
    console.error(`[OFFLINE_ERROR] ${screen}.${action}`, error);
  } else {
    Sentry.captureException(error, {
      tags: {
        component: screen,
        action: action,
        type: 'offline',
      },
    });
  }
}
```

### Analytics Tracking (Firebase Analytics or Amplitude)
```javascript
// Example: Track debounce triggers to measure system load
export function logDebounceTrigger(screen, timeSinceLastAttempt = null) {
  if (!__DEV__) {
    analytics.logEvent('debounce_triggered', {
      screen,
      time_since_last: timeSinceLastAttempt,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Observability Queries
- **Network Errors**: `SELECT COUNT(*) FROM error_logs WHERE tag='offline' AND timestamp > NOW() - INTERVAL '24 hours'`
- **User Impact**: `SELECT COUNT(DISTINCT user_id) FROM lost_edit_reports WHERE created_at > NOW() - INTERVAL '7 days'`
- **System Health**: Check debounce/guard trigger rates in analytics dashboard - should remain <5% and <2% respectively

---

## Known Limitations & Future Work

### Current System Limitations
1. **Debounce is client-only**: If app crashes between debounce check and save, could theoretically allow duplicate
   - **Mitigation**: Database-level version locking provides final safety
   - **Future**: Implement server-side request deduplication (idempotency keys in Supabase Edge Functions)

2. **Offline detection uses NetInfo**: May have false positives/negatives on flaky networks
   - **Mitigation**: Real operations fail gracefully with proper error handling
   - **Future**: Implement connectivity scoring (multiple connectivity checks)

3. **No queue persistence**: If app closes while offline, unsaved changes are lost
   - **Mitigation**: User feedback (debounce alerts) ensures awareness
   - **Future**: Implement AsyncStorage-backed operation queue for offline persistence

### Phase 2 Enhancements (Post-Production)
- [ ] Implement offline operation queue with AsyncStorage persistence
- [ ] Add Sentry integration for production error tracking
- [ ] Implement connectivity scoring for flaky network detection
- [ ] Add analytics dashboard for offline metrics monitoring
- [ ] Implement server-side idempotency keys for request deduplication
- [ ] Add manual retry UI for failed operations
- [ ] Implement exponential backoff for network retries

---

## References

- **Offline Protection System**: Implemented in ProfileViewer (src/components/ProfileViewer/index.js)
- **Network Guard Hook**: `src/hooks/useNetworkGuard.js`
- **Metrics Logging Utility**: `src/utils/offlineMetrics.js`
- **Network State Store**: `src/stores/networkStore.js` (via Zustand)
- **Database Version Locking**: admin_update_profile() RPC with p_version parameter
- **Soft Delete Pattern**: `/docs/SOFT_DELETE_PATTERN.md`
- **Permission System**: `/docs/PERMISSION_SYSTEM_V4.md`
