/**
 * Permission & Authorization Tests for Undo System
 *
 * Tests that verify role-based access control and permission checks.
 * Total: 15 tests
 */

const { ProfileFixture } = require("../fixtures/profileFixtures.js");
const { AuditLogFixture } = require("../fixtures/auditLogFixtures.js");
const { UserFixture } = require("../fixtures/userFixtures.js");
const { assertUndoPermission, assertRPCError, assertRPCSuccess } = require("../utils/assertions.js");

describe('Permission & Authorization Tests', () => {
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

  describe('check_undo_permission', () => {
    test('1. Regular user can undo their own action within 30 days', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم' },
        { name: 'جديد' }
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: auditLog.id,
        p_user_profile_id: user.id,
      });

      assertUndoPermission(result, true);
    });

    test('2. Regular user CANNOT undo another user\'s action', async () => {
      const user1 = await userFixture.createRegularUser({ name: 'مستخدم 1' });
      const user2 = await userFixture.createRegularUser({ name: 'مستخدم 2' });
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم' },
        { name: 'جديد' }
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: auditLog.id,
        p_user_profile_id: user2.id,
      });

      assertUndoPermission(result, false, 'لا تملك صلاحية');
    });

    test('3. Admin can undo any user\'s action', async () => {
      const admin = await userFixture.createAdmin();
      const regularUser = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم' },
        { name: 'جديد' }
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: auditLog.id,
        p_user_profile_id: admin.id,
      });

      assertUndoPermission(result, true);
    });

    test('4. Super admin can undo any action with unlimited time', async () => {
      const superAdmin = await userFixture.createSuperAdmin();
      const regularUser = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      // Create old audit log (31 days ago)
      const oldAuditLog = await auditLogFixture.createOldAuditLog(
        'profile_update',
        profile.id,
        31
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: oldAuditLog.id,
        p_user_profile_id: superAdmin.id,
      });

      assertUndoPermission(result, true);
    });

    test('5. Regular user CANNOT undo action older than 30 days', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const oldAuditLog = await auditLogFixture.createOldAuditLog(
        'profile_update',
        profile.id,
        31
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: oldAuditLog.id,
        p_user_profile_id: user.id,
      });

      assertUndoPermission(result, false, 'انتهت المهلة');
    });

    test('6. Cascade delete requires admin role (regular user denied)', async () => {
      const regularUser = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const cascadeLog = await auditLogFixture.createCascadeDeleteLog(
        profile.id,
        regularUser.id,
        'CASCADE-123',
        { name: 'محذوف' }
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: cascadeLog.id,
        p_user_profile_id: regularUser.id,
      });

      assertUndoPermission(result, false, 'صلاحيات المسؤول');
    });

    test('7. Admin can undo cascade delete within 7 days', async () => {
      const admin = await userFixture.createAdmin();
      const profile = await profileFixture.createProfile();

      const cascadeLog = await auditLogFixture.createCascadeDeleteLog(
        profile.id,
        admin.id,
        'CASCADE-123',
        { name: 'محذوف' }
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: cascadeLog.id,
        p_user_profile_id: admin.id,
      });

      assertUndoPermission(result, true);
    });

    test('8. Admin CANNOT undo cascade delete after 7 days (strict limit)', async () => {
      const admin = await userFixture.createAdmin();
      const profile = await profileFixture.createProfile();

      const oldCascadeLog = await auditLogFixture.createOldAuditLog(
        'profile_cascade_delete',
        profile.id,
        8
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: oldCascadeLog.id,
        p_user_profile_id: admin.id,
      });

      assertUndoPermission(result, false, 'انتهت المهلة');
    });

    test('9. Marriage creation undo requires admin role', async () => {
      const regularUser = await userFixture.createRegularUser();
      const admin = await userFixture.createAdmin();
      const profile = await profileFixture.createProfile();

      const marriageLog = await auditLogFixture.createMarriageCreateLog(
        profile.id,
        regularUser.id,
        { husband_id: profile.id, wife_id: 'some-wife-id' }
      );

      // Regular user denied
      const userResult = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: marriageLog.id,
        p_user_profile_id: regularUser.id,
      });
      assertUndoPermission(userResult, false, 'صلاحيات المسؤول');

      // Admin allowed
      const adminResult = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: marriageLog.id,
        p_user_profile_id: admin.id,
      });
      assertUndoPermission(adminResult, true);
    });

    test('10. Already-undone action cannot be undone again (idempotency)', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const undoneLog = await auditLogFixture.createUndoneAuditLog(
        'profile_update',
        profile.id,
        { name: 'قديم' }
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: undoneLog.id,
        p_user_profile_id: user.id,
      });

      assertUndoPermission(result, false, 'تم التراجع');
    });

    test('11. Moderator can undo actions within their assigned branch', async () => {
      const branchRoot = await profileFixture.createProfile({ name: 'جذر الفرع' });
      const moderator = await userFixture.createModerator(branchRoot.id);
      const branchMember = await profileFixture.createChild(branchRoot.id);

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        branchMember.id,
        { name: 'قديم' },
        { name: 'جديد' }
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: auditLog.id,
        p_user_profile_id: moderator.id,
      });

      assertUndoPermission(result, true);
    });

    test('12. Blocked user CANNOT undo any actions', async () => {
      const blockedUser = await userFixture.createBlockedUser();
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم' },
        { name: 'جديد' }
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: auditLog.id,
        p_user_profile_id: blockedUser.id,
      });

      assertUndoPermission(result, false);
    });

    test('13. Permission check fails for non-existent audit log', async () => {
      const user = await userFixture.createRegularUser();
      const fakeAuditLogId = '00000000-0000-0000-0000-000000000000';

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: fakeAuditLogId,
        p_user_profile_id: user.id,
      });

      assertRPCError(result, 'سجل النشاط غير موجود');
    });

    test('14. Permission check fails for non-existent user', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم' },
        { name: 'جديد' }
      );

      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: auditLog.id,
        p_user_profile_id: fakeUserId,
      });

      assertRPCError(result, 'المستخدم غير موجود');
    });

    test('15. Admin update action follows same permission rules as profile_update', async () => {
      const user = await userFixture.createRegularUser();
      const admin = await userFixture.createAdmin();
      const profile = await profileFixture.createProfile();

      const adminUpdateLog = await auditLogFixture.createAdminUpdateLog(
        profile.id,
        admin.id,
        { name: 'قديم' },
        { name: 'جديد' }
      );

      // Admin can undo their own admin_update
      const adminResult = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: adminUpdateLog.id,
        p_user_profile_id: admin.id,
      });
      assertUndoPermission(adminResult, true);

      // Regular user CANNOT undo admin's update
      const userResult = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: adminUpdateLog.id,
        p_user_profile_id: user.id,
      });
      assertUndoPermission(userResult, false, 'لا تملك صلاحية');
    });
  });
});
