/**
 * Performance Tests for Undo System
 *
 * Tests that verify execution time, scalability, and performance characteristics.
 * Total: 5 tests
 */

const { ProfileFixture } = require("../fixtures/profileFixtures.js");
const { AuditLogFixture } = require("../fixtures/auditLogFixtures.js");
const { UserFixture } = require("../fixtures/userFixtures.js");
const { measureExecutionTime } = require("../utils/concurrency.js");
const { assertExecutionTime } = require("../utils/assertions.js");

describe('Performance Tests', () => {
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

  describe('Single Operation Performance', () => {
    test('1. undo_profile_update completes within 500ms', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم', version: 1 },
        { name: 'جديد', version: 2 }
      );

      const { durationMs } = await measureExecutionTime(() =>
        global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: auditLog.id,
          p_undo_reason: 'فحص الأداء',
        })
      );

      console.log(`undo_profile_update: ${durationMs}ms`);
      assertExecutionTime(durationMs, 500);
    });

    test('2. undo_profile_delete completes within 500ms', async () => {
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

      const { durationMs } = await measureExecutionTime(() =>
        global.supabaseAdmin.rpc('undo_profile_delete', {
          p_audit_log_id: auditLog.id,
          p_undo_reason: 'فحص الأداء',
        })
      );

      console.log(`undo_profile_delete: ${durationMs}ms`);
      assertExecutionTime(durationMs, 500);
    });

    test('3. check_undo_permission completes within 200ms', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        profile.id,
        { name: 'قديم' },
        { name: 'جديد' }
      );

      const { durationMs } = await measureExecutionTime(() =>
        global.supabaseClient.rpc('check_undo_permission', {
          p_audit_log_id: auditLog.id,
          p_user_profile_id: user.id,
        })
      );

      console.log(`check_undo_permission: ${durationMs}ms`);
      assertExecutionTime(durationMs, 200);
    });
  });

  describe('Batch Operation Performance', () => {
    test('4. undo_cascade_delete with 10 descendants completes within 2s', async () => {
      const admin = await userFixture.createAdmin();

      // Create tree with 10 descendants
      const tree = await profileFixture.createFamilyTree(3, 2); // 3 levels, 2 children = ~7 nodes
      const root = await profileFixture.createProfile({ name: 'جذر إضافي' });
      const extra1 = await profileFixture.createChild(root.id, { name: 'إضافي 1' });
      const extra2 = await profileFixture.createChild(root.id, { name: 'إضافي 2' });
      const extra3 = await profileFixture.createChild(root.id, { name: 'إضافي 3' });

      const allDescendants = [
        tree,
        ...(tree.children || []),
        ...(tree.children?.flatMap((c) => c.children) || []),
        root,
        extra1,
        extra2,
        extra3,
      ];

      const { batchId, auditLogs } = await auditLogFixture.createCascadeDeleteBatch(
        allDescendants,
        admin.id
      );

      // Soft delete all
      for (const desc of allDescendants) {
        await global.supabaseAdmin
          .from('profiles')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', desc.id);
      }

      const { durationMs } = await measureExecutionTime(() =>
        global.supabaseAdmin.rpc('undo_cascade_delete', {
          p_audit_log_id: auditLogs[0].id,
          p_undo_reason: 'فحص أداء الدفعة',
        })
      );

      console.log(`undo_cascade_delete (${allDescendants.length} nodes): ${durationMs}ms`);
      assertExecutionTime(durationMs, 2000);
    });

    test('5. undo_operation_group scales linearly with batch size', async () => {
      const admin = await userFixture.createAdmin();

      // Test with batch sizes: 5, 10, 15
      const batchSizes = [5, 10, 15];
      const timings = [];

      for (const size of batchSizes) {
        // Create profiles
        const profiles = [];
        for (let i = 0; i < size; i++) {
          profiles.push(await profileFixture.createProfile({ name: `ملف ${i}` }));
        }

        const { operationGroup } = await auditLogFixture.createCascadeDeleteBatch(
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

        const { durationMs } = await measureExecutionTime(() =>
          global.supabaseAdmin.rpc('undo_operation_group', {
            p_group_id: operationGroup.id,
            p_undo_reason: 'فحص التوسع',
          })
        );

        timings.push({ size, durationMs });
        console.log(`Batch size ${size}: ${durationMs}ms`);

        // Cleanup for next iteration
        await auditLogFixture.cleanup();
        await profileFixture.cleanup();
      }

      // Verify linear scaling (approximately)
      // Timing for 15 items should be roughly 3x timing for 5 items
      const ratio = timings[2].durationMs / timings[0].durationMs;
      console.log(`Scaling ratio (15/5): ${ratio.toFixed(2)}x`);

      // Allow some variance (2x to 4x is reasonable for linear scaling)
      expect(ratio).toBeGreaterThan(1.5);
      expect(ratio).toBeLessThan(5);
    });
  });

  describe('Query Performance Under Load', () => {
    test('6. Permission check performs well with large audit log table', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      // Create 100 audit logs to simulate load
      const auditLogs = [];
      for (let i = 0; i < 100; i++) {
        const log = await auditLogFixture.createProfileUpdateLog(
          profile.id,
          user.id,
          { name: `قديم ${i}` },
          { name: `جديد ${i}` }
        );
        auditLogs.push(log);
      }

      // Measure permission check on 50th log
      const targetLog = auditLogs[49];

      const { durationMs } = await measureExecutionTime(() =>
        global.supabaseClient.rpc('check_undo_permission', {
          p_audit_log_id: targetLog.id,
          p_user_profile_id: user.id,
        })
      );

      console.log(`Permission check with 100 audit logs: ${durationMs}ms`);

      // Should still be fast despite large table
      assertExecutionTime(durationMs, 300);
    });

    test('7. Undo maintains performance with deep family trees', async () => {
      const user = await userFixture.createRegularUser();

      // Create deep tree (5 generations)
      const createDeepTree = async (depth = 5) => {
        let parent = await profileFixture.createProfile({ name: 'جد الأسرة' });
        for (let i = 0; i < depth; i++) {
          parent = await profileFixture.createChild(parent.id, { name: `جيل ${i}` });
        }
        return parent;
      };

      const deepestChild = await createDeepTree(5);

      const auditLog = await auditLogFixture.createProfileUpdateLog(
        deepestChild.id,
        { name: 'قديم', version: 1 },
        { name: deepestChild.name, version: 2 }
      );

      const { durationMs } = await measureExecutionTime(() =>
        global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: auditLog.id,
          p_undo_reason: 'فحص شجرة عميقة',
        })
      );

      console.log(`Undo on deep tree (5 generations): ${durationMs}ms`);

      // Should not significantly degrade with tree depth
      assertExecutionTime(durationMs, 700);
    });

    test('8. Concurrent permission checks do not cause performance degradation', async () => {
      const users = await Promise.all([
        userFixture.createRegularUser({ name: 'مستخدم 1' }),
        userFixture.createRegularUser({ name: 'مستخدم 2' }),
        userFixture.createRegularUser({ name: 'مستخدم 3' }),
        userFixture.createRegularUser({ name: 'مستخدم 4' }),
        userFixture.createRegularUser({ name: 'مستخدم 5' }),
      ]);

      const profile = await profileFixture.createProfile();

      const auditLogs = await Promise.all(
        users.map((user) =>
          auditLogFixture.createProfileUpdateLog(
            profile.id,
            { name: 'قديم' },
            { name: 'جديد' }
          )
        )
      );

      // Measure concurrent permission checks
      const { durationMs } = await measureExecutionTime(async () => {
        await Promise.all(
          users.map((user, i) =>
            global.supabaseClient.rpc('check_undo_permission', {
              p_audit_log_id: auditLogs[i].id,
              p_user_profile_id: user.id,
            })
          )
        );
      });

      console.log(`5 concurrent permission checks: ${durationMs}ms`);

      // All 5 checks should complete within 1 second
      assertExecutionTime(durationMs, 1000);
    });
  });

  describe('Memory & Resource Usage', () => {
    test('9. Large JSONB old_data does not significantly impact performance', async () => {
      const user = await userFixture.createRegularUser();
      const profile = await profileFixture.createProfile();

      // Create large old_data (simulate profile with many fields)
      const largeOldData = {
        name: 'اسم طويل جداً '.repeat(10),
        father_name: 'والد',
        grandfather_name: 'جد',
        version: 1,
        metadata: {
          notes: 'ملاحظات طويلة جداً '.repeat(50),
          history: Array(20).fill({ event: 'حدث', date: '2024-01-01' }),
        },
      };

      const auditLog = await auditLogFixture.createAuditWithOldData(
        profile.id,
        user.id,
        largeOldData
      );

      const { durationMs } = await measureExecutionTime(() =>
        global.supabaseAdmin.rpc('undo_profile_update', {
          p_audit_log_id: auditLog.id,
          p_undo_reason: 'فحص بيانات كبيرة',
        })
      );

      console.log(`Undo with large JSONB: ${durationMs}ms`);

      // Should handle large JSONB without major slowdown
      assertExecutionTime(durationMs, 800);
    });

    test('10. Cleanup after tests maintains database performance', async () => {
      // Measure time to clean up all test data
      const profileIds = profileFixture.getCreatedIds();
      const auditLogIds = auditLogFixture.getCreatedIds();

      console.log(`Profiles to clean: ${profileIds.length}`);
      console.log(`Audit logs to clean: ${auditLogIds.length}`);

      const { durationMs: profileCleanupTime } = await measureExecutionTime(() =>
        profileFixture.cleanup()
      );

      const { durationMs: auditCleanupTime } = await measureExecutionTime(() =>
        auditLogFixture.cleanup()
      );

      console.log(`Profile cleanup: ${profileCleanupTime}ms`);
      console.log(`Audit log cleanup: ${auditCleanupTime}ms`);

      // Cleanup should be fast even with many records
      expect(profileCleanupTime + auditCleanupTime).toBeLessThan(2000);
    });
  });
});
