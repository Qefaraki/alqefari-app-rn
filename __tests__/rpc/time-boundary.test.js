/**
 * Time Boundary Tests for Undo System
 *
 * Tests that verify time-based restrictions and limits for undo operations.
 * Total: 8 tests
 */

const { ProfileFixture } = require("../fixtures/profileFixtures.js");
const { AuditLogFixture } = require("../fixtures/auditLogFixtures.js");
const { UserFixture } = require("../fixtures/userFixtures.js");
const {
  assertUndoPermission,
  assertRPCError,
  assertRPCSuccess,
  assertTimeWithinRange,
} = require("../utils/assertions.js");

describe('Time Boundary Tests', () => {
  let profileFixture;
  let auditLogFixture;
  let userFixture;

  beforeAll(() => {
    profileFixture = new ProfileFixture(global.supabaseAdmin);
    auditLogFixture = new AuditLogFixture(global.supabaseAdmin);
    userFixture = new UserFixture(global.supabaseAdmin);
  });

  afterEach(async () => {
    await auditLogFixture.cleanup();
    await profileFixture.cleanup();
  });

  describe('30-Day Limit for Regular Users', () => {
    test('1. Regular user can undo within 30 days', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      // Create audit log 29 days old (within limit)
      const auditLog = await auditLogFixture.createOldAuditLog(
        'profile_update',
        profile.id,
        29
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: auditLog.id,
        p_user_profile_id: user.id,
      });

      assertUndoPermission(result, true);
    });

    test('2. Regular user CANNOT undo after 30 days', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      // Create audit log 31 days old (beyond limit)
      const auditLog = await auditLogFixture.createOldAuditLog(
        'profile_update',
        profile.id,
        31
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: auditLog.id,
        p_user_profile_id: user.id,
      });

      assertUndoPermission(result, false, 'انتهت المهلة');
    });

    test('3. Exactly at 30-day boundary (edge case)', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      // Create audit log exactly 30 days old
      const auditLog = await auditLogFixture.createOldAuditLog(
        'profile_update',
        profile.id,
        30
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: auditLog.id,
        p_user_profile_id: user.id,
      });

      // Should allow (30 days = 30 days exactly, not 31)
      assertUndoPermission(result, true);
    });

    test('4. Admin can undo beyond 30 days (unlimited)', async () => {
      const admin = await userFixture.createAdmin();
      const regularUser = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      // Create audit log 60 days old
      const auditLog = await auditLogFixture.createOldAuditLog(
        'profile_update',
        profile.id,
        60
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: auditLog.id,
        p_user_profile_id: admin.id,
      });

      assertUndoPermission(result, true);
    });
  });

  describe('7-Day Limit for Cascade Delete', () => {
    test('5. Admin can undo cascade delete within 7 days', async () => {
      const admin = await userFixture.createAdmin();
      const profile = await profileFixture.createProfile();

      // Create cascade delete log 6 days old
      const cascadeLog = await auditLogFixture.createOldAuditLog(
        'profile_cascade_delete',
        profile.id,
        6
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: cascadeLog.id,
        p_user_profile_id: admin.id,
      });

      assertUndoPermission(result, true);
    });

    test('6. Admin CANNOT undo cascade delete after 7 days (strict limit)', async () => {
      const admin = await userFixture.createAdmin();
      const profile = await profileFixture.createProfile();

      // Create cascade delete log 8 days old
      const cascadeLog = await auditLogFixture.createOldAuditLog(
        'profile_cascade_delete',
        profile.id,
        8
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: cascadeLog.id,
        p_user_profile_id: admin.id,
      });

      assertUndoPermission(result, false, 'انتهت المهلة');
    });

    test('7. Super admin CANNOT bypass 7-day cascade delete limit', async () => {
      const superAdmin = await userFixture.createSuperAdmin();
      const profile = await profileFixture.createProfile();

      // Create cascade delete log 10 days old
      const cascadeLog = await auditLogFixture.createOldAuditLog(
        'profile_cascade_delete',
        profile.id,
        10
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: cascadeLog.id,
        p_user_profile_id: superAdmin.id,
      });

      // Even super admin is bound by 7-day limit for dangerous operations
      assertUndoPermission(result, false, 'انتهت المهلة');
    });
  });

  describe('Timestamp Accuracy', () => {
    test('8. Timestamps are recorded with timezone awareness', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const beforeCreate = new Date();
      await global.waitFor(100); // Small delay

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم' },
        { name: 'جديد' }
      );

      await global.waitFor(100); // Small delay
      const afterCreate = new Date();

      // Verify timestamp is within expected range
      assertTimeWithinRange(auditLog.created_at, beforeCreate, afterCreate);

      // Perform undo
      await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'فحص الوقت',
      });

      const { data: markedLog } = await global.supabaseAdmin
        .from('audit_log')
        .select('undone_at')
        .eq('id', auditLog.id)
        .single();

      // Verify undone_at timestamp is recent
      const undoneTime = new Date(markedLog.undone_at);
      const now = new Date();
      const timeDiff = now - undoneTime;

      expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
    });
  });
});
