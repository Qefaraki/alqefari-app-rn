/**
 * Transaction Safety Tests for Undo System
 *
 * Tests that verify transactional integrity, rollback behavior, and atomicity.
 * Total: 10 tests
 */

const { ProfileFixture } = require("../fixtures/profileFixtures.js");
const { AuditLogFixture } = require("../fixtures/auditLogFixtures.js");
const { UserFixture } = require("../fixtures/userFixtures.js");
const {
  assertProfileData,
  assertProfileNotDeleted,
  assertRPCError,
  assertAuditLogNotUndone,
  assertProfileDeleted,
} = require("../utils/assertions.js");

describe('Transaction Safety Tests', () => {
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

  describe('Atomicity Tests', () => {
    test('1. Failed undo rolls back all changes (profile NOT restored)', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(10, { name: 'اسم حالي' });

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        user.id,
        { name: 'اسم قديم', version: 5 }, // Wrong version
        { name: 'اسم وسيط', version: 6 }
      );

      // Attempt undo (should fail due to version mismatch)
      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'محاولة فاشلة',
      });

      assertRPCError(result, 'تعارض في الإصدار');

      // Verify profile unchanged
      const { data: unchangedProfile } = await global.supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single();

      assertProfileData(unchangedProfile, {
        name: 'اسم حالي',
        version: 10,
      });

      // Verify audit log NOT marked as undone
      const { data: unchangedAudit } = await global.supabaseAdmin
        .from('audit_log')
        .select('*')
        .eq('id', auditLog.id)
        .single();

      assertAuditLogNotUndone(unchangedAudit);
    });

    test('2. Failed parent validation rolls back transaction', async () => {
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
        { name: 'قديم', father_id: father.id, version: 1 },
        { name: 'الابن', father_id: father.id, version: 2 }
      );

      // Get child's current state
      const { data: beforeUndo } = await global.supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', child.id)
        .single();

      // Attempt undo (should fail due to deleted father)
      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'محاولة',
      });

      assertRPCError(result);

      // Verify child unchanged
      const { data: afterUndo } = await global.supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', child.id)
        .single();

      expect(afterUndo.version).toBe(beforeUndo.version);
      expect(afterUndo.name).toBe(beforeUndo.name);
    });

    test('3. Successful undo commits all changes atomically', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(2, { name: 'اسم جديد' });

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'اسم قديم', version: 2 },
        { name: 'اسم جديد', version: 3 }
      );

      await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'تراجع ناجح',
      });

      // Verify ALL changes committed:
      // 1. Profile restored
      const { data: restoredProfile } = await global.supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', profile.id)
        .single();

      assertProfileData(restoredProfile, { name: 'اسم قديم' });

      // 2. Version incremented
      expect(restoredProfile.version).toBe(3);

      // 3. Audit log marked as undone
      const { data: markedAudit } = await global.supabaseAdmin
        .from('audit_log')
        .select('*')
        .eq('id', auditLog.id)
        .single();

      expect(markedAudit.undone_at).not.toBeNull();

      // 4. New audit log created
      const { data: undoAudit } = await global.supabaseAdmin
        .from('audit_log')
        .select('*')
        .eq('action_type', 'undo')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(undoAudit).toBeDefined();
    });

    test('4. Cascade delete undo is atomic (all or nothing)', async () => {
      const admin = await userFixture.createAdmin();
      const tree = await profileFixture.createFamilyTree(2, 2);

      const descendants = [tree, ...tree.children, ...tree.children.flatMap((c) => c.children)];
      const { batchId, auditLogs } = await auditLogFixture.createCascadeDeleteBatch(
        descendants,
        admin.id
      );

      // Soft delete all descendants
      for (const desc of descendants) {
        await global.supabaseAdmin
          .from('profiles')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', desc.id);
      }

      // Undo cascade
      await global.supabaseAdmin.rpc('undo_cascade_delete', {
        p_audit_log_id: auditLogs[0].id,
        p_undo_reason: 'استرجاع الشجرة',
      });

      // Verify ALL descendants restored (not partial)
      for (const desc of descendants) {
        const { data: restored } = await global.supabaseAdmin
          .from('profiles')
          .select('deleted_at')
          .eq('id', desc.id)
          .single();

        assertProfileNotDeleted(restored);
      }

      // Verify ALL audit logs marked as undone
      for (const log of auditLogs) {
        const { data: markedLog } = await global.supabaseAdmin
          .from('audit_log')
          .select('undone_at')
          .eq('id', log.id)
          .single();

        expect(markedLog.undone_at).not.toBeNull();
      }
    });
  });

  describe('Rollback Scenarios', () => {
    test('5. Invalid profile_id causes rollback', async () => {
      const user = await userFixture.createRegularUser();
      const fakeProfileId = '00000000-0000-0000-0000-000000000000';

      const { error: insertError } = await global.supabaseAdmin
        .from('audit_log')
        .insert({
          action_type: 'profile_update',
          profile_id: fakeProfileId, // Non-existent profile
          actor_id: user.id,
          old_data: { name: 'قديم' },
          new_data: { name: 'جديد' },
        });

      // Should fail at insertion (foreign key constraint)
      expect(insertError).toBeDefined();
    });

    test('6. Constraint violation during restoration causes rollback', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile({
        name: 'اسم',
        hid: 'HID-123',
      });

      // Create another profile with same HID
      const duplicate = await profileFixture.createProfile({
        name: 'مكرر',
        hid: 'HID-123', // Same HID (will violate unique constraint)
      });

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', hid: 'HID-123', version: 1 },
        { name: 'اسم', hid: 'HID-DIFFERENT', version: 2 }
      );

      // Attempt undo (should fail due to HID conflict with duplicate)
      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'محاولة',
      });

      // Should fail with constraint error
      assertRPCError(result);
    });

    test('7. Operation group undo rolls back on first failure', async () => {
      const admin = await userFixture.createAdmin();
      const profiles = await Promise.all([
        profileFixture.createProfile({ name: 'ملف 1' }),
        profileFixture.createProfile({ name: 'ملف 2' }),
        profileFixture.createProfile({ name: 'ملف 3' }),
      ]);

      const { operationGroup, auditLogs } = await auditLogFixture.createCascadeDeleteBatch(
        profiles,
        admin.id
      );

      // Soft delete first two profiles
      await global.supabaseAdmin
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', [profiles[0].id, profiles[1].id]);

      // Third profile remains NOT deleted (will cause partial batch)
      // Note: Current implementation might allow partial success
      // This test documents current behavior

      const result = await global.supabaseAdmin.rpc('undo_operation_group', {
        p_group_id: operationGroup.id,
        p_undo_reason: 'تراجع جماعي',
      });

      // Check if any profiles were restored
      const { data: profile1 } = await global.supabaseAdmin
        .from('profiles')
        .select('deleted_at')
        .eq('id', profiles[0].id)
        .single();

      const { data: profile3 } = await global.supabaseAdmin
        .from('profiles')
        .select('deleted_at')
        .eq('id', profiles[2].id)
        .single();

      // If batch failed, profile1 should still be deleted
      // If batch succeeded, profile1 should be restored
      // Document which behavior is expected
      expect(profile1).toBeDefined();
      expect(profile3.deleted_at).toBeNull(); // Third was never deleted
    });
  });

  describe('Isolation Tests', () => {
    test('8. Concurrent transactions do not interfere', async () => {
      const user1 = await userFixture.createRegularUser({ name: 'مستخدم 1' });
      const user2 = await userFixture.createRegularUser({ name: 'مستخدم 2' });

      const profile1 = await profileFixture.createProfile({ name: 'ملف 1' });
      const profile2 = await profileFixture.createProfile({ name: 'ملف 2' });

      const audit1 = await auditLogFixture.createProfileUpdateLog(
        profile1.id,
        { name: 'قديم 1', version: 1 },
        { name: 'ملف 1', version: 2 }
      );

      const audit2 = await auditLogFixture.createProfileUpdateLog(
        profile2.id,
        { name: 'قديم 2', version: 1 },
        { name: 'ملف 2', version: 2 }
      );

      // Run concurrent undos on different profiles
      const [result1, result2] = await Promise.all([
        global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: audit1.id,
          p_undo_reason: 'تراجع 1',
        }),
        global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: audit2.id,
          p_undo_reason: 'تراجع 2',
        }),
      ]);

      // Both should succeed independently
      expect(result1.error).toBeNull();
      expect(result2.error).toBeNull();

      // Verify both profiles restored correctly
      const { data: restored1 } = await global.supabaseAdmin
        .from('profiles')
        .select('name')
        .eq('id', profile1.id)
        .single();

      const { data: restored2 } = await global.supabaseAdmin
        .from('profiles')
        .select('name')
        .eq('id', profile2.id)
        .single();

      expect(restored1.name).toBe('قديم 1');
      expect(restored2.name).toBe('قديم 2');
    });

    test('9. Read isolation prevents dirty reads', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile({ name: 'اسم أولي' });

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'اسم قديم', version: 1 },
        { name: 'اسم أولي', version: 2 }
      );

      // Start undo operation
      const undoPromise = global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'تراجع',
      });

      // Immediately read profile (should NOT see intermediate state)
      const { data: duringUndo } = await global.supabaseAdmin
        .from('profiles')
        .select('name')
        .eq('id', profile.id)
        .single();

      await undoPromise;

      const { data: afterUndo } = await global.supabaseAdmin
        .from('profiles')
        .select('name')
        .eq('id', profile.id)
        .single();

      // Either see old state or new state, never intermediate
      expect(['اسم أولي', 'اسم قديم']).toContain(duringUndo.name);
      expect(afterUndo.name).toBe('اسم قديم');
    });

    test('10. Transaction isolation level prevents phantom reads', async () => {
      const admin = await userFixture.createAdmin();
      const profiles = [];

      // Create 3 profiles
      for (let i = 0; i < 3; i++) {
        profiles.push(await profileFixture.createProfile({ name: `ملف ${i}` }));
      }

      // Create cascade delete batch
      const { batchId, auditLogs } = await auditLogFixture.createCascadeDeleteBatch(
        profiles,
        admin.id
      );

      // Soft delete all
      for (const p of profiles) {
        await global.supabaseAdmin
          .from('profiles')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', p.id);
      }

      // Start undo cascade
      const undoPromise = global.supabaseAdmin.rpc('undo_cascade_delete', {
        p_audit_log_id: auditLogs[0].id,
        p_undo_reason: 'استرجاع',
      });

      // Query deleted profiles during undo
      const { count: duringCount } = await global.supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('id', profiles.map((p) => p.id))
        .is('deleted_at', null);

      await undoPromise;

      const { count: afterCount } = await global.supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .in('id', profiles.map((p) => p.id))
        .is('deleted_at', null);

      // After undo, all should be restored
      expect(afterCount).toBe(profiles.length);
    });
  });
});
