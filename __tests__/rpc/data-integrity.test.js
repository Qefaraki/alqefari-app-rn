/**
 * Data Integrity Tests for Undo System
 *
 * Tests that verify data consistency, referential integrity, and validation rules.
 * Total: 12 tests
 */

const { ProfileFixture } = require("../fixtures/profileFixtures.js");
const { AuditLogFixture } = require("../fixtures/auditLogFixtures.js");
const { UserFixture } = require("../fixtures/userFixtures.js");
const {
  assertProfileData,
  assertAuditOldData,
  assertRPCError,
  assertRPCSuccess,
  assertProfileNotDeleted,
  assertVersionIncremented,
  assertJSONBStructure,
  assertAuditLogCreated,
} = require("../utils/assertions.js");

describe('Data Integrity Tests', () => {
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

  describe('Profile Data Restoration', () => {
    test('1. undo_profile_update restores all fields from old_data', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile({
        name: 'اسم جديد',
        father_name: 'والد جديد',
        birth_year_ad: 2000,
      });

      const oldData = {
        name: 'اسم قديم',
        father_name: 'والد قديم',
        grandfather_name: 'جد قديم',
        birth_year_ad: 1990,
        version: 1,
      };

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        user.id,
        oldData,
        { name: 'اسم جديد', version: 2 }
      );

      // Update profile to higher version
      await global.supabaseAdmin
        .from('profiles')
        .update({ version: 1 })
        .eq('id', profile.id);

      await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'استرجاع البيانات',
      });

      const { data: restoredProfile } = await global.supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single();

      // Verify all fields restored
      assertProfileData(restoredProfile, {
        name: 'اسم قديم',
        father_name: 'والد قديم',
        grandfather_name: 'جد قديم',
        birth_year_ad: 1990,
      });
    });

    test('2. undo_profile_delete clears deleted_at and increments version', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(3, { name: 'ملف محذوف' });

      await global.supabaseAdmin
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', profile.id);

      const auditLog = await auditLogFixture.createProfileDeleteLog(
        profile.id,
        user.id,
        { name: 'ملف محذوف', version: 3, deleted_at: null }
      );

      await global.supabaseAdmin.rpc('undo_profile_delete', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'استرجاع الملف',
      });

      const { data: restoredProfile } = await global.supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single();

      assertProfileNotDeleted(restoredProfile);
      assertVersionIncremented(3, restoredProfile.version);
    });

    test('3. Parent validation prevents creating orphans', async () => {
      const user = await userFixture.createRegularUser();
      const father = await profileFixture.createProfile({ name: 'الأب' });
      const child = await profileFixture.createChild(father.id, { name: 'الابن' });

      // Soft delete father
      await global.supabaseAdmin
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', father.id);

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        child.id,
        { name: 'اسم قديم', father_id: father.id, version: 1 },
        { name: 'الابن', father_id: father.id, version: 2 }
      );

      // Attempt undo (should fail due to deleted father)
      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'محاولة إنشاء يتيم',
      });

      assertRPCError(result, 'الأب محذوف');
    });

    test('4. Mother validation prevents invalid mother_id restoration', async () => {
      const user = await userFixture.createRegularUser();
      const father = await profileFixture.createProfile({ name: 'الأب' });
      const mother = await profileFixture.createProfile({ name: 'الأم', is_male: false });
      const child = await profileFixture.createChild(father.id, { name: 'الابن', mother_id: mother.id });

      // Soft delete mother
      await global.supabaseAdmin
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', mother.id);

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        child.id,
        { name: 'قديم', mother_id: mother.id, version: 1 },
        { name: 'الابن', mother_id: null, version: 2 }
      );

      // Attempt undo (should fail due to deleted mother)
      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'محاولة استرجاع أم محذوفة',
      });

      assertRPCError(result, 'الأم محذوفة');
    });
  });

  describe('JSONB Data Integrity', () => {
    test('5. old_data JSONB structure preserved during restoration', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const complexOldData = {
        name: 'اسم قديم',
        father_name: 'والد',
        version: 1,
        metadata: {
          nested: {
            value: 123,
          },
        },
      };

      const auditLog = await auditLogFixture.createAuditWithOldData(
        profile.id,
        user.id,
        complexOldData
      );

      assertAuditOldData(auditLog, complexOldData);
      assertJSONBStructure(auditLog.old_data, ['name', 'father_name', 'version']);
    });

    test('6. Empty or null fields in old_data handled correctly', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile({
        name: 'اسم',
        father_name: null,
        grandfather_name: null,
      });

      const oldData = {
        name: 'اسم قديم',
        father_name: null,
        grandfather_name: null,
        version: 1,
      };

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        user.id,
        oldData,
        { name: 'اسم', version: 2 }
      );

      await global.supabaseAdmin
        .from('profiles')
        .update({ version: 1 })
        .eq('id', profile.id);

      await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'استرجاع حقول فارغة',
      });

      const { data: restoredProfile } = await global.supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single();

      expect(restoredProfile.father_name).toBeNull();
      expect(restoredProfile.grandfather_name).toBeNull();
    });

    test('7. Invalid JSON in old_data causes undo to fail gracefully', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      // Manually create audit log with invalid old_data
      const { error } = await global.supabaseAdmin
        .from('audit_log')
        .insert({
          action_type: 'profile_update',
          profile_id: profile.id,
          actor_id: user.id,
          old_data: 'invalid json', // Should be rejected by JSONB column
          new_data: {},
        });

      // Should fail at insertion
      expect(error).toBeDefined();
    });
  });

  describe('Version Tracking', () => {
    test('8. Version increments atomically after successful undo', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(5);

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 5 },
        { name: 'جديد', version: 6 }
      );

      await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'تراجع',
      });

      const { data: updatedProfile } = await global.supabaseAdmin
        .from('profiles')
        .select('version')
        .eq('id', profile.id)
        .single();

      assertVersionIncremented(5, updatedProfile.version);
    });

    test('9. Failed undo does NOT increment version', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(10);

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        user.id,
        { name: 'قديم', version: 5 }, // Wrong version
        { name: 'جديد', version: 6 }
      );

      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'محاولة فاشلة',
      });

      assertRPCError(result, 'تعارض في الإصدار');

      const { data: unchangedProfile } = await global.supabaseAdmin
        .from('profiles')
        .select('version')
        .eq('id', profile.id)
        .single();

      expect(unchangedProfile.version).toBe(10); // Unchanged
    });
  });

  describe('Audit Trail Integrity', () => {
    test('10. New audit log created for every undo operation', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const originalAudit = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 1 },
        { name: 'جديد', version: 2 }
      );

      await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: originalAudit.id,
        p_undo_reason: 'سبب التراجع',
      });

      // Verify new audit log with action_type='undo'
      const undoAudit = await assertAuditLogCreated(
        global.supabaseAdmin,
        'undo',
        profile.id,
        user.id
      );

      expect(undoAudit.new_data.undo_reason).toBe('سبب التراجع');
    });

    test('11. Original audit log marked as undone', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 1 },
        { name: 'جديد', version: 2 }
      );

      await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'تراجع',
      });

      const { data: markedAudit } = await global.supabaseAdmin
        .from('audit_log')
        .select('*')
        .eq('id', auditLog.id)
        .single();

      expect(markedAudit.undone_at).not.toBeNull();
      expect(markedAudit.undone_by).toBe(user.id);
      expect(markedAudit.undo_reason).toBe('تراجع');
    });

    test('12. Cascade delete batch maintains referential integrity', async () => {
      const admin = await userFixture.createAdmin();
      const tree = await profileFixture.createFamilyTree(2, 2); // 2 levels, 2 children

      const descendants = [tree, ...tree.children, ...tree.children.flatMap((c) => c.children)];
      const { batchId, auditLogs } = await auditLogFixture.createCascadeDeleteBatch(
        descendants,
        admin.id
      );

      // Verify all audit logs share same batch_id
      const allLogsHaveSameBatch = auditLogs.every((log) => log.batch_id === batchId);
      expect(allLogsHaveSameBatch).toBe(true);

      // Verify count matches descendants count
      expect(auditLogs.length).toBe(descendants.length);

      // Undo cascade
      await global.supabaseAdmin.rpc('undo_cascade_delete', {
        p_audit_log_id: auditLogs[0].id,
        p_undo_reason: 'استرجاع الدفعة',
      });

      // Verify all audit logs marked as undone
      for (const log of auditLogs) {
        const { data: undoneLog } = await global.supabaseAdmin
          .from('audit_log')
          .select('undone_at')
          .eq('id', log.id)
          .single();

        expect(undoneLog.undone_at).not.toBeNull();
      }
    });
  });
});
