/**
 * Error Handling Tests for Undo System
 *
 * Tests that verify proper error messages, validation, and edge case handling.
 * Total: 12 tests
 */

const { ProfileFixture } = require("../fixtures/profileFixtures.js");
const { AuditLogFixture } = require("../fixtures/auditLogFixtures.js");
const { UserFixture } = require("../fixtures/userFixtures.js");
const { assertRPCError, assertErrorMessage } = require("../utils/assertions.js");

describe('Error Handling Tests', () => {
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

  describe('Invalid Input Errors', () => {
    test('1. NULL audit_log_id returns meaningful error', async () => {
      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: null,
        p_undo_reason: 'محاولة',
      });

      assertRPCError(result);
    });

    test('2. Non-existent audit_log_id returns "not found" error', async () => {
      const fakeAuditId = '00000000-0000-0000-0000-000000000000';

      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: fakeAuditId,
        p_undo_reason: 'محاولة',
      });

      assertRPCError(result, 'غير موجود');
    });

    test('3. Empty undo_reason is allowed (optional parameter)', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 1 },
        { name: 'جديد', version: 2 }
      );

      // Empty reason should be acceptable
      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: '',
      });

      expect(result.error).toBeNull();
    });

    test('4. Invalid UUID format returns database error', async () => {
      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: 'invalid-uuid',
        p_undo_reason: 'محاولة',
      });

      assertRPCError(result);
    });
  });

  describe('Permission Errors', () => {
    test('5. Blocked user receives clear permission error', async () => {
      const blockedUser = await userFixture.createBlockedUser();
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم' },
        { name: 'جديد' }
      );

      const permissionResult = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: auditLog.id,
        p_user_profile_id: blockedUser.id,
      });

      expect(permissionResult.data.can_undo).toBe(false);
    });

    test('6. Non-admin attempting cascade delete receives role error', async () => {
      const regularUser = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const cascadeLog = await auditLogFixture.createCascadeDeleteLog(
        profile.id,
        regularUser.id,
        'CASCADE-123',
        profile
      );

      const result = await global.supabaseClient.rpc('check_undo_permission', {
        p_audit_log_id: cascadeLog.id,
        p_user_profile_id: regularUser.id,
      });

      expect(result.data.can_undo).toBe(false);
      expect(result.data.reason).toContain('صلاحيات المسؤول');
    });

    test('7. User attempting to undo another user\'s action receives clear error', async () => {
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

      expect(result.data.can_undo).toBe(false);
      expect(result.data.reason).toContain('لا تملك صلاحية');
    });
  });

  describe('State Errors', () => {
    test('8. Already-undone action returns idempotency error', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 1 },
        { name: 'جديد', version: 2 }
      );

      // First undo
      await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'تراجع أول',
      });

      // Second undo
      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'تراجع ثاني',
      });

      assertRPCError(result, 'تم التراجع');
    });

    test('9. Version conflict returns clear version mismatch error', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(10);

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 5 },
        { name: 'جديد', version: 6 }
      );

      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'محاولة',
      });

      assertRPCError(result, 'تعارض في الإصدار');
    });

    test('10. Profile already deleted returns meaningful error', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      // Profile is NOT deleted
      const auditLog = await auditLogFixture.createProfileDeleteLog(
        profile.id,
        user.id,
        { name: 'ملف', deleted_at: null }
      );

      // Try to undo delete when profile is not actually deleted
      const result = await global.supabaseAdmin.rpc('undo_profile_delete', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'محاولة',
      });

      // Should fail because profile's deleted_at is NULL (not deleted)
      assertRPCError(result);
    });
  });

  describe('Data Validation Errors', () => {
    test('11. Missing required field in old_data causes error', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      // Create audit log with incomplete old_data (missing version)
      const { data: auditLog } = await global.supabaseAdmin
        .from('audit_log')
        .insert({
          action_type: 'profile_update',
          profile_id: profile.id,
          actor_id: user.id,
          old_data: { name: 'قديم' }, // Missing version!
          new_data: { name: 'جديد' },
        })
        .select()
        .single();

      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'محاولة',
      });

      // Should fail due to missing version in old_data
      assertRPCError(result);
    });

    test('12. Deleted parent prevents restoration with clear error', async () => {
      const user = await userFixture.createRegularUser();
      const father = await profileFixture.createProfile({ name: 'الأب' });
      const child = await profileFixture.createChild(father.id, { name: 'الابن' });

      // Delete father
      await global.supabaseAdmin
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', father.id);

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        child.id,
        { name: 'قديم', father_id: father.id, version: 1 },
        { name: 'الابن', father_id: father.id, version: 2 }
      );

      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'محاولة استرجاع',
      });

      assertRPCError(result, 'الأب محذوف');
    });
  });

  describe('Edge Cases', () => {
    test('13. Extremely long undo_reason is truncated gracefully', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 1 },
        { name: 'جديد', version: 2 }
      );

      // 1000 character reason
      const longReason = 'سبب طويل جداً '.repeat(100);

      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: longReason,
      });

      // Should succeed (database should handle truncation or allow long text)
      expect(result.error).toBeNull();
    });

    test('14. Undo operation on profile with NULL fields succeeds', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile({
        name: 'اسم',
        father_name: null,
        grandfather_name: null,
        birth_year_ad: null,
      });

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        {
          name: 'قديم',
          father_name: null,
          grandfather_name: null,
          birth_year_ad: null,
          version: 1,
        },
        {
          name: 'اسم',
          version: 2,
        }
      );

      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'استرجاع حقول فارغة',
      });

      expect(result.error).toBeNull();
    });

    test('15. Concurrent lock conflict returns user-friendly error', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 1 },
        { name: 'جديد', version: 2 }
      );

      // Hold lock on profile
      await global.supabaseAdmin.rpc('execute_raw_sql', {
        sql: `BEGIN; SELECT * FROM profiles WHERE id = '${profile.id}' FOR UPDATE;`,
      });

      // Attempt undo while lock held
      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'محاولة',
      });

      // Cleanup
      await global.supabaseAdmin.rpc('execute_raw_sql', { sql: 'ROLLBACK;' });

      assertRPCError(result, 'عملية أخرى قيد التنفيذ');
    });
  });
});
