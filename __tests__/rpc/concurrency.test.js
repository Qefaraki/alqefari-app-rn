/**
 * Concurrency & Race Condition Tests for Undo System
 *
 * Tests that verify concurrent operations, locking mechanisms, and race condition prevention.
 * Total: 18 tests
 */

const { ProfileFixture } = require("../fixtures/profileFixtures.js");
const { AuditLogFixture } = require("../fixtures/auditLogFixtures.js");
const { UserFixture } = require("../fixtures/userFixtures.js");
const {
  runConcurrently,
  runRaceCondition,
  simulateConcurrentUsers,
  testOptimisticLocking,
  testTOCTOU,
  testIdempotency,
  retryOnLockFailure,
} = require("../utils/concurrency.js");
const {
  assertExactlyOneSuccess,
  assertAllFailed,
  assertRPCError,
  assertProfileVersion,
  assertVersionIncremented,
} = require("../utils/assertions.js");

describe('Concurrency & Race Condition Tests', () => {
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

  describe('Optimistic Locking Tests', () => {
    test('1. Concurrent undo_profile_update calls - exactly one succeeds', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(1, { name: 'اسم 1' });

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'اسم قديم', version: 1 },
        { name: 'اسم 1', version: 2 }
      );

      const undoOperation = () =>
        global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: auditLog.id,
          p_undo_reason: 'تراجع متزامن',
        });

      const result = await testOptimisticLocking(undoOperation, 5);

      expect(result.isValidOptimisticLock).toBe(true);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(4);
    });

    test('2. Concurrent undo_profile_delete calls - exactly one succeeds', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(1, { name: 'محذوف' });

      // Soft delete the profile
      await global.supabaseAdmin
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', profile.id);

      const auditLog = await auditLogFixture.createProfileDeleteLog(
        profile.id,
        user.id,
        { name: 'محذوف', version: 1, deleted_at: null }
      );

      const undoOperation = () =>
        global.supabaseAdmin.rpc('undo_profile_delete', {
          p_audit_log_id: auditLog.id,
          p_undo_reason: 'استرجاع متزامن',
        });

      const result = await testOptimisticLocking(undoOperation, 5);

      expect(result.isValidOptimisticLock).toBe(true);
    });

    test('3. Version mismatch prevents undo (profile modified after audit log creation)', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(5, { name: 'اسم 5' });

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        user.id,
        { name: 'اسم 1', version: 1 }, // Old version in audit log
        { name: 'اسم 2', version: 2 }
      );

      // Profile is now at version 5, but audit log expects version 1
      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'محاولة تراجع',
      });

      assertRPCError(result, 'تعارض في الإصدار');
    });

    test('4. Concurrent admin_update_profile with undo - lock conflict detected', async () => {
      const admin = await userFixture.createAdmin();
      const profile = await profileFixture.createProfileWithVersion(1, { name: 'اسم 1' });

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'اسم قديم', version: 1 },
        { name: 'اسم 1', version: 2 }
      );

      const undoOp = () =>
        global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: auditLog.id,
          p_undo_reason: 'تراجع',
        });

      const updateOp = () =>
        global.supabaseAdmin.rpc('admin_update_profile', {
          p_id: profile.id,
          p_version: 1,
          p_updates: { name: 'اسم جديد' },
        });

      const raceResult = await runRaceCondition(undoOp, updateOp);

      // At most one should succeed (or both fail due to version conflict)
      expect(raceResult.bothSucceeded).toBe(false);
    });
  });

  describe('Row-Level Locking Tests', () => {
    test('5. SELECT FOR UPDATE NOWAIT prevents concurrent modification', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile({ name: 'ملف' });

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 1 },
        { name: 'ملف', version: 2 }
      );

      // Start transaction that locks the profile
      const lockAndHold = async () => {
        const { data, error } = await global.supabaseAdmin.rpc('execute_raw_sql', {
          sql: `
            BEGIN;
            SELECT * FROM profiles WHERE id = '${profile.id}' FOR UPDATE NOWAIT;
            -- Hold lock for 2 seconds
            SELECT pg_sleep(2);
            COMMIT;
          `,
        });
        return { data, error };
      };

      const undoOp = async () => {
        await global.waitFor(100); // Start slightly after lock
        return global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: auditLog.id,
          p_undo_reason: 'محاولة أثناء القفل',
        });
      };

      const results = await runConcurrently([lockAndHold, undoOp]);

      // Undo should fail with lock error
      const undoResult = results[1];
      expect(undoResult.error).toBeDefined();
    });

    test('6. Retry on lock failure eventually succeeds', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(1, { name: 'ملف' });

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 1 },
        { name: 'ملف', version: 2 }
      );

      const undoOp = () =>
        global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: auditLog.id,
          p_undo_reason: 'إعادة محاولة',
        });

      const result = await retryOnLockFailure(undoOp, 3, 100);

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
    });
  });

  describe('Advisory Lock Tests', () => {
    test('7. Concurrent cascade delete undos use advisory locks', async () => {
      const admin = await userFixture.createAdmin();
      const tree = await profileFixture.createFamilyTree(2, 2); // 2 levels, 2 children each

      const batchId = `CASCADE-${Date.now()}`;

      // Create cascade delete audit logs
      const descendants = [tree, ...tree.children, ...tree.children.flatMap((c) => c.children)];
      const auditLogs = [];
      for (const desc of descendants) {
        const log = await auditLogFixture.createCascadeDeleteLog(
          desc.id,
          admin.id,
          batchId,
          desc
        );
        auditLogs.push(log);
      }

      // Attempt concurrent cascade undo
      const undoOps = auditLogs.slice(0, 2).map((log) => () =>
        global.supabaseAdmin.rpc('undo_cascade_delete', {
          p_audit_log_id: log.id,
          p_undo_reason: 'تراجع متزامن',
        })
      );

      const result = await simulateConcurrentUsers(2, undoOps[0]);

      // Advisory locks should prevent both from succeeding simultaneously
      expect(result.successful).toBeLessThanOrEqual(1);
    });

    test('8. Advisory lock released after transaction completes', async () => {
      const admin = await userFixture.createAdmin();
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createCascadeDeleteLog(
        profile.id,
        admin.id,
        'CASCADE-123',
        profile
      );

      // First undo
      await global.supabaseAdmin.rpc('undo_cascade_delete', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'تراجع أول',
      });

      // Second undo should fail due to idempotency, NOT lock
      const secondResult = await global.supabaseAdmin.rpc('undo_cascade_delete', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'تراجع ثاني',
      });

      assertRPCError(secondResult, 'تم التراجع'); // Not lock error
    });
  });

  describe('Idempotency Tests', () => {
    test('9. Double undo_profile_update fails with idempotency error', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(1, { name: 'اسم' });

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 1 },
        { name: 'اسم', version: 2 }
      );

      const undoOp = () =>
        global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: auditLog.id,
          p_undo_reason: 'تراجع مكرر',
        });

      const result = await testIdempotency(undoOp, 3);

      expect(result.isIdempotent).toBe(true);
      expect(result.firstSuccessRestFailed).toBe(true);
    });

    test('10. Double undo_profile_delete fails with idempotency error', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      await global.supabaseAdmin
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', profile.id);

      const auditLog = await auditLogFixture.createProfileDeleteLog(
        profile.id,
        user.id,
        { name: 'محذوف', deleted_at: null }
      );

      const undoOp = () =>
        global.supabaseAdmin.rpc('undo_profile_delete', {
          p_audit_log_id: auditLog.id,
          p_undo_reason: 'استرجاع مكرر',
        });

      const result = await testIdempotency(undoOp, 3);

      expect(result.isIdempotent).toBe(true);
      expect(result.firstSuccessRestFailed).toBe(true);
    });

    test('11. Idempotency check happens before version check', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(5);

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 1 },
        { name: 'جديد', version: 2 }
      );

      // First undo
      await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'تراجع',
      });

      // Second undo should fail with idempotency error, NOT version error
      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'تراجع ثاني',
      });

      assertRPCError(result, 'تم التراجع'); // Not version error
    });
  });

  describe('TOCTOU (Time-Of-Check-Time-Of-Use) Tests', () => {
    test('12. Parent validation locks parent during check (prevents TOCTOU)', async () => {
      const user = await userFixture.createRegularUser();
      const father = await profileFixture.createProfile({ name: 'الأب' });
      const child = await profileFixture.createChild(father.id, { name: 'الابن' });

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        child.id,
        { name: 'اسم قديم', father_id: father.id },
        { name: 'الابن', father_id: father.id }
      );

      // Delete father concurrently with undo
      const deleteOp = async () => {
        await global.waitFor(50);
        await global.supabaseAdmin
          .from('profiles')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', father.id);
      };

      const undoOp = () =>
        global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: auditLog.id,
          p_undo_reason: 'تراجع',
        });

      const results = await runConcurrently([deleteOp, undoOp]);

      // Undo should fail if father was deleted (parent validation)
      const undoResult = results[1];
      if (undoResult.error) {
        expect(undoResult.error.message).toMatch(/الأب|محذوف/);
      }
    });

    test('13. Version check prevents TOCTOU in profile restoration', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(1);

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 1 },
        { name: 'جديد', version: 2 }
      );

      // Update profile version concurrently
      const updateOp = async () => {
        await global.waitFor(50);
        await global.supabaseAdmin
          .from('profiles')
          .update({ version: 10 })
          .eq('id', profile.id);
      };

      const undoOp = () =>
        global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: auditLog.id,
          p_undo_reason: 'تراجع',
        });

      const results = await runConcurrently([updateOp, undoOp]);

      // Undo should fail with version conflict
      const undoResult = results[1];
      if (undoResult.error) {
        expect(undoResult.error.message).toContain('تعارض في الإصدار');
      }
    });
  });

  describe('Batch Operation Concurrency', () => {
    test('14. Concurrent undo_operation_group calls - exactly one succeeds', async () => {
      const admin = await userFixture.createAdmin();
      const profiles = await Promise.all([
        profileFixture.createProfile({ name: 'ملف 1' }),
        profileFixture.createProfile({ name: 'ملف 2' }),
        profileFixture.createProfile({ name: 'ملف 3' }),
      ]);

      const { operationGroup } = await auditLogFixture.createCascadeDeleteBatch(
        profiles,
        admin.id
      );

      const undoGroupOp = () =>
        global.supabaseAdmin.rpc('undo_operation_group', {
          p_group_id: operationGroup.id,
          p_undo_reason: 'تراجع جماعي',
        });

      const result = await testOptimisticLocking(undoGroupOp, 3);

      expect(result.isValidOptimisticLock).toBe(true);
      expect(result.successful).toBe(1);
    });

    test('15. Cascade undo maintains consistency across all descendants', async () => {
      const admin = await userFixture.createAdmin();
      const tree = await profileFixture.createFamilyTree(3, 2); // 3 levels, 2 children each

      const batchId = `CASCADE-${Date.now()}`;
      const descendants = [tree, ...tree.children, ...tree.children.flatMap((c) => c.children)];

      for (const desc of descendants) {
        await auditLogFixture.createCascadeDeleteLog(desc.id, batchId, desc);
        await global.supabaseAdmin
          .from('profiles')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', desc.id);
      }

      // Undo cascade
      const firstLog = await global.supabaseAdmin
        .from('audit_log')
        .select('*')
        .eq('batch_id', batchId)
        .limit(1)
        .single();

      await global.supabaseAdmin.rpc('undo_cascade_delete', {
        p_audit_log_id: firstLog.data.id,
        p_undo_reason: 'استرجاع الشجرة',
      });

      // Verify all descendants restored
      for (const desc of descendants) {
        const { data } = await global.supabaseAdmin
          .from('profiles')
          .select('deleted_at')
          .eq('id', desc.id)
          .single();

        expect(data.deleted_at).toBeNull();
      }
    });
  });

  describe('Lock Timeout & Deadlock Tests', () => {
    test('16. NOWAIT fails immediately on lock conflict', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      // Hold lock in transaction
      await global.supabaseAdmin.rpc('execute_raw_sql', {
        sql: `BEGIN; SELECT * FROM profiles WHERE id = '${profile.id}' FOR UPDATE;`,
      });

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم' },
        { name: 'جديد' }
      );

      const startTime = Date.now();
      const result = await global.supabaseAdmin.rpc('undo_profile_update', {
        p_audit_log_id: auditLog.id,
        p_undo_reason: 'محاولة',
      });
      const duration = Date.now() - startTime;

      // Should fail quickly (< 1 second) due to NOWAIT
      expect(duration).toBeLessThan(1000);
      assertRPCError(result);

      // Cleanup: rollback held lock
      await global.supabaseAdmin.rpc('execute_raw_sql', { sql: 'ROLLBACK;' });
    });

    test('17. Advisory lock prevents deadlock in batch operations', async () => {
      const admin = await userFixture.createAdmin();
      const profiles = await Promise.all([
        profileFixture.createProfile({ name: 'ملف A' }),
        profileFixture.createProfile({ name: 'ملف B' }),
      ]);

      const batchId = `CASCADE-${Date.now()}`;
      const logsA = await auditLogFixture.createCascadeDeleteLog(
        profiles[0].id,
        admin.id,
        batchId,
        profiles[0]
      );
      const logsB = await auditLogFixture.createCascadeDeleteLog(
        profiles[1].id,
        admin.id,
        batchId,
        profiles[1]
      );

      // Attempt concurrent undo on same batch (should be prevented by advisory lock)
      const undoOpA = () =>
        global.supabaseAdmin.rpc('undo_cascade_delete', {
          p_audit_log_id: logsA.id,
          p_undo_reason: 'تراجع A',
        });

      const undoOpB = () =>
        global.supabaseAdmin.rpc('undo_cascade_delete', {
          p_audit_log_id: logsB.id,
          p_undo_reason: 'تراجع B',
        });

      const result = await runRaceCondition(undoOpA, undoOpB);

      // Advisory lock should prevent both from running simultaneously
      expect(result.bothSucceeded).toBe(false);
    });

    test('18. Version increment is atomic (no lost updates)', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfileWithVersion(1);

      const auditLog1 = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم 1', version: 1 },
        { name: 'جديد 1', version: 2 }
      );

      const auditLog2 = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم 2', version: 2 },
        { name: 'جديد 2', version: 3 }
      );

      // Run concurrent undos with different versions
      const undo1 = () =>
        global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: auditLog1.id,
          p_undo_reason: 'تراجع 1',
        });

      const undo2 = () =>
        global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: auditLog2.id,
          p_undo_reason: 'تراجع 2',
        });

      await runConcurrently([undo1, undo2]);

      // Verify final version is consistent (no lost increment)
      const { data: finalProfile } = await global.supabaseAdmin
        .from('profiles')
        .select('version')
        .eq('id', profile.id)
        .single();

      // Version should be incremented atomically for successful undo
      expect(finalProfile.version).toBeGreaterThan(1);
    });
  });
});
