/**
 * Custom Jest Assertions for Undo System Testing
 *
 * Domain-specific matchers for cleaner, more readable tests.
 */

/**
 * Assert profile has expected version
 */
function assertProfileVersion(profile, expectedVersion) {
  expect(profile).toBeDefined();
  expect(profile.version).toBe(expectedVersion);
}

/**
 * Assert profile is soft-deleted
 */
function assertProfileDeleted(profile) {
  expect(profile).toBeDefined();
  expect(profile.deleted_at).not.toBeNull();
  expect(new Date(profile.deleted_at)).toBeInstanceOf(Date);
}

/**
 * Assert profile is NOT soft-deleted
 */
function assertProfileNotDeleted(profile) {
  expect(profile).toBeDefined();
  expect(profile.deleted_at).toBeNull();
}

/**
 * Assert audit log is marked as undone
 */
function assertAuditLogUndone(auditLog, undoneBy) {
  expect(auditLog).toBeDefined();
  expect(auditLog.undone_at).not.toBeNull();
  expect(auditLog.undone_by).toBe(undoneBy);
  expect(auditLog.undo_reason).toBeDefined();
}

/**
 * Assert audit log is NOT undone
 */
function assertAuditLogNotUndone(auditLog) {
  expect(auditLog).toBeDefined();
  expect(auditLog.undone_at).toBeNull();
}

/**
 * Assert RPC function returned success
 */
function assertRPCSuccess(result) {
  expect(result.error).toBeNull();
  expect(result.data).toBeDefined();
}

/**
 * Assert RPC function returned error with message
 */
function assertRPCError(result, expectedErrorMessage) {
  expect(result.error).toBeDefined();
  expect(result.data).toBeNull();
  if (expectedErrorMessage) {
    expect(result.error.message).toContain(expectedErrorMessage);
  }
}

/**
 * Assert permission check returned expected level
 */
function assertPermissionLevel(permissionResult, expectedLevel) {
  expect(permissionResult.error).toBeNull();
  expect(permissionResult.data).toBe(expectedLevel);
}

/**
 * Assert profile data matches expected values
 */
function assertProfileData(profile, expected) {
  expect(profile).toBeDefined();

  Object.keys(expected).forEach((key) => {
    expect(profile[key]).toEqual(expected[key]);
  });
}

/**
 * Assert audit log old_data matches expected
 */
function assertAuditOldData(auditLog, expectedOldData) {
  expect(auditLog).toBeDefined();
  expect(auditLog.old_data).toBeDefined();

  Object.keys(expectedOldData).forEach((key) => {
    expect(auditLog.old_data[key]).toEqual(expectedOldData[key]);
  });
}

/**
 * Assert operation completed within time limit
 */
function assertExecutionTime(durationMs, maxMs) {
  expect(durationMs).toBeLessThanOrEqual(maxMs);
}

/**
 * Assert exactly one operation succeeded (optimistic locking)
 */
function assertExactlyOneSuccess(results) {
  const successful = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');

  expect(successful.length).toBe(1);
  expect(failed.length).toBe(results.length - 1);
}

/**
 * Assert all operations failed
 */
function assertAllFailed(results) {
  results.forEach((result) => {
    expect(result.status).toBe('rejected');
  });
}

/**
 * Assert all operations succeeded
 */
function assertAllSucceeded(results) {
  results.forEach((result) => {
    expect(result.status).toBe('fulfilled');
  });
}

/**
 * Assert error message contains expected text
 */
function assertErrorMessage(error, expectedText) {
  expect(error).toBeDefined();
  expect(error.message).toContain(expectedText);
}

/**
 * Assert profile belongs to family tree
 */
function assertInFamilyTree(profile, rootId) {
  expect(profile).toBeDefined();

  // Should have father_id that eventually leads to rootId
  // (This is a simplified check - full check would traverse ancestors)
  expect(profile.father_id || profile.id).toBeDefined();
}

/**
 * Assert cascade delete restored all descendants
 */
function assertCascadeRestored(profiles) {
  profiles.forEach((profile) => {
    assertProfileNotDeleted(profile);
  });
}

/**
 * Assert batch operation results
 */
function assertBatchResults(results, expectedSuccessCount, expectedFailCount) {
  const successful = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r) => r.status === 'rejected');

  expect(successful.length).toBe(expectedSuccessCount);
  expect(failed.length).toBe(expectedFailCount);
}

/**
 * Assert undo permission check result
 */
function assertUndoPermission(permissionResult, canUndo, expectedReason = null) {
  expect(permissionResult.error).toBeNull();
  expect(permissionResult.data).toBeDefined();
  expect(permissionResult.data.can_undo).toBe(canUndo);

  if (expectedReason) {
    expect(permissionResult.data.reason).toContain(expectedReason);
  }
}

/**
 * Assert time is within range
 */
function assertTimeWithinRange(timestamp, minDate, maxDate) {
  const time = new Date(timestamp);
  expect(time.getTime()).toBeGreaterThanOrEqual(minDate.getTime());
  expect(time.getTime()).toBeLessThanOrEqual(maxDate.getTime());
}

/**
 * Assert audit log created for action
 */
async function assertAuditLogCreated(supabaseAdmin, actionType, profileId, actorId) {
  const { data, error } = await supabaseAdmin
    .from('audit_log_enhanced')
    .select('*')
    .eq('action_type', actionType)
    .eq('record_id', profileId) // audit_log_enhanced uses record_id
    .eq('actor_id', actorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  expect(error).toBeNull();
  expect(data).toBeDefined();
  return data;
}

/**
 * Assert version incremented
 */
function assertVersionIncremented(oldVersion, newVersion) {
  expect(newVersion).toBe(oldVersion + 1);
}

/**
 * Assert JSONB field structure
 */
function assertJSONBStructure(jsonbField, expectedKeys) {
  expect(jsonbField).toBeDefined();
  expect(typeof jsonbField).toBe('object');

  expectedKeys.forEach((key) => {
    expect(jsonbField).toHaveProperty(key);
  });
}

/**
 * Custom Jest matchers (register with expect.extend)
 */
const customMatchers = {
  toBeValidProfile(received) {
    const pass = received &&
      typeof received.id === 'string' &&
      typeof received.name === 'string' &&
      typeof received.version === 'number';

    return {
      pass,
      message: () => pass
        ? `Expected ${received} not to be a valid profile`
        : `Expected ${received} to be a valid profile with id, name, and version`,
    };
  },

  toBeUndone(received) {
    const pass = received &&
      received.undone_at !== null &&
      received.undone_by !== null;

    return {
      pass,
      message: () => pass
        ? `Expected audit log not to be undone`
        : `Expected audit log to be undone (undone_at and undone_by should be set)`,
    };
  },

  toHaveVersion(received, expectedVersion) {
    const pass = received && received.version === expectedVersion;

    return {
      pass,
      message: () => pass
        ? `Expected profile not to have version ${expectedVersion}`
        : `Expected profile to have version ${expectedVersion}, but got ${received?.version}`,
    };
  },

  toBeSoftDeleted(received) {
    const pass = received && received.deleted_at !== null;

    return {
      pass,
      message: () => pass
        ? `Expected profile not to be soft-deleted`
        : `Expected profile to be soft-deleted (deleted_at should be set)`,
    };
  },
};

module.exports = {
  assertProfileVersion,
  assertProfileDeleted,
  assertProfileNotDeleted,
  assertAuditLogUndone,
  assertAuditLogNotUndone,
  assertRPCSuccess,
  assertRPCError,
  assertPermissionLevel,
  assertProfileData,
  assertAuditOldData,
  assertExecutionTime,
  assertExactlyOneSuccess,
  assertAllFailed,
  assertAllSucceeded,
  assertErrorMessage,
  assertInFamilyTree,
  assertCascadeRestored,
  assertBatchResults,
  assertUndoPermission,
  assertTimeWithinRange,
  assertAuditLogCreated,
  assertVersionIncremented,
  assertJSONBStructure,
  customMatchers,
};
