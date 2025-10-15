/**
 * Database Cleanup Utilities
 *
 * Helpers for cleaning up test data to ensure test isolation.
 */

/**
 * Clean up profiles by IDs
 */
async function cleanupProfiles(supabaseAdmin, profileIds) {
  if (!profileIds || profileIds.length === 0) return;

  const { error } = await supabaseAdmin
    .from('profiles')
    .delete()
    .in('id', profileIds);

  if (error && error.code !== 'PGRST116') {
    console.error('⚠️  Profile cleanup failed:', error.message);
  }
}

/**
 * Clean up audit logs by IDs
 */
async function cleanupAuditLogs(supabaseAdmin, auditLogIds) {
  if (!auditLogIds || auditLogIds.length === 0) return;

  const { error } = await supabaseAdmin
    .from('audit_log_enhanced')
    .delete()
    .in('id', auditLogIds);

  if (error && error.code !== 'PGRST116') {
    console.error('⚠️  Audit log cleanup failed:', error.message);
  }
}

/**
 * Clean up marriages by IDs
 */
async function cleanupMarriages(supabaseAdmin, marriageIds) {
  if (!marriageIds || marriageIds.length === 0) return;

  const { error } = await supabaseAdmin
    .from('marriages')
    .delete()
    .in('id', marriageIds);

  if (error && error.code !== 'PGRST116') {
    console.error('⚠️  Marriage cleanup failed:', error.message);
  }
}

/**
 * Clean up operation groups by IDs
 */
async function cleanupOperationGroups(supabaseAdmin, groupIds) {
  if (!groupIds || groupIds.length === 0) return;

  const { error } = await supabaseAdmin
    .from('operation_groups')
    .delete()
    .in('id', groupIds);

  if (error && error.code !== 'PGRST116') {
    console.error('⚠️  Operation group cleanup failed:', error.message);
  }
}

/**
 * Clean up all test data created in a test suite
 */
async function cleanupAllTestData(supabaseAdmin, {
  profileIds = [],
  auditLogIds = [],
  marriageIds = [],
  operationGroupIds = [],
}) {
  await Promise.all([
    cleanupAuditLogs(supabaseAdmin, auditLogIds),
    cleanupMarriages(supabaseAdmin, marriageIds),
    cleanupOperationGroups(supabaseAdmin, operationGroupIds),
    cleanupProfiles(supabaseAdmin, profileIds),
  ]);
}

/**
 * Clean up profiles with HID pattern (test profiles)
 */
async function cleanupTestProfiles(supabaseAdmin, hidPattern = 'TEST-%') {
  const { error } = await supabaseAdmin
    .from('profiles')
    .delete()
    .like('hid', hidPattern);

  if (error && error.code !== 'PGRST116') {
    console.error('⚠️  Test profile cleanup failed:', error.message);
  }
}

/**
 * Clean up audit logs older than N days
 */
async function cleanupOldAuditLogs(supabaseAdmin, daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const { error } = await supabaseAdmin
    .from('audit_log_enhanced')
    .delete()
    .lt('created_at', cutoffDate.toISOString());

  if (error && error.code !== 'PGRST116') {
    console.error('⚠️  Old audit log cleanup failed:', error.message);
  }
}

/**
 * Restore soft-deleted profiles (for cleanup)
 */
async function restoreSoftDeletedProfiles(supabaseAdmin, profileIds) {
  if (!profileIds || profileIds.length === 0) return;

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ deleted_at: null })
    .in('id', profileIds);

  if (error) {
    console.error('⚠️  Profile restoration failed:', error.message);
  }
}

/**
 * Delete all undone audit logs (for cleanup)
 */
async function cleanupUndoneAuditLogs(supabaseAdmin) {
  const { error } = await supabaseAdmin
    .from('audit_log_enhanced')
    .delete()
    .not('undone_at', 'is', null);

  if (error && error.code !== 'PGRST116') {
    console.error('⚠️  Undone audit log cleanup failed:', error.message);
  }
}

/**
 * Get count of test data (for verification)
 */
async function getTestDataCount(supabaseAdmin) {
  const [profiles, auditLogs, marriages, operationGroups] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).like('hid', 'TEST-%'),
    supabaseAdmin.from('audit_log_enhanced').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('marriages').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('operation_groups').select('id', { count: 'exact', head: true }),
  ]);

  return {
    profiles: profiles.count,
    auditLogs: auditLogs.count,
    marriages: marriages.count,
    operationGroups: operationGroups.count,
  };
}

/**
 * Truncate all test tables (DANGEROUS - use only in test environment)
 */
async function truncateTestTables(supabaseAdmin) {
  const isTestEnv = process.env.NODE_ENV === 'test';
  const isLocalDb = process.env.SUPABASE_TEST_URL?.includes('localhost');

  if (!isTestEnv || !isLocalDb) {
    throw new Error('⛔ Truncate only allowed in local test environment');
  }

  // Order matters: delete children before parents
  await supabaseAdmin.from('audit_log_enhanced').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('marriages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('operation_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabaseAdmin.from('profiles').delete().like('hid', 'TEST-%');

  console.log('🧹 Test tables truncated');
}

/**
 * Cleanup helper for afterEach/afterAll
 */
function createCleanupTracker() {
  const tracker = {
    profileIds: [],
    auditLogIds: [],
    marriageIds: [],
    operationGroupIds: [],
  };

  return {
    trackProfile: (id) => tracker.profileIds.push(id),
    trackAuditLog: (id) => tracker.auditLogIds.push(id),
    trackMarriage: (id) => tracker.marriageIds.push(id),
    trackOperationGroup: (id) => tracker.operationGroupIds.push(id),

    cleanup: async (supabaseAdmin) => {
      await cleanupAllTestData(supabaseAdmin, tracker);
      // Reset tracker
      tracker.profileIds = [];
      tracker.auditLogIds = [];
      tracker.marriageIds = [];
      tracker.operationGroupIds = [];
    },

    getTrackedData: () => ({ ...tracker }),
  };
}

module.exports = {
  cleanupProfiles,
  cleanupAuditLogs,
  cleanupMarriages,
  cleanupOperationGroups,
  cleanupAllTestData,
  cleanupTestProfiles,
  cleanupOldAuditLogs,
  restoreSoftDeletedProfiles,
  cleanupUndoneAuditLogs,
  getTestDataCount,
  truncateTestTables,
  createCleanupTracker,
};
